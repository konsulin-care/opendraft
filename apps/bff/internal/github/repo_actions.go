package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// repoSettings is the subset of GitHub's repository JSON used by the
// permissions endpoint.
type repoSettings struct {
	DefaultBranch string `json:"default_branch"`
	Private       bool   `json:"private"`
	AllowForking  bool   `json:"allow_forking"`
	Permissions   struct {
		Push bool `json:"push"`
	} `json:"permissions"`
}

// RepoPermissions is the answer of the permissions endpoint: the viewer's push
// access, whether the app is installed on the repository, its default branch
// and the fork/installation facts the edit plan needs.
type RepoPermissions struct {
	DefaultBranch      string
	Push               bool
	Installed          bool
	Private            bool
	AllowForking       bool
	ViewerInstalledAll bool
}

// installation is one GitHub App installation visible to a user token.
type installation struct {
	Account struct {
		Login string `json:"login"`
	} `json:"account"`
	RepositorySelection string `json:"repository_selection"`
	ID                  int64  `json:"id"`
}

// installationList mirrors GET /user/installations.
type installationList struct {
	Installations []installation `json:"installations"`
}

// installationRepos mirrors GET /user/installations/{id}/repositories.
type installationRepos struct {
	Repositories []struct {
		FullName string `json:"full_name"`
	} `json:"repositories"`
}

// pullRequest is the JSON body of a pull request creation.
type pullRequest struct {
	Title               string `json:"title"`
	Head                string `json:"head"`
	Base                string `json:"base"`
	Body                string `json:"body"`
	MaintainerCanModify bool   `json:"maintainer_can_modify"`
}

// pullResponse is the subset of GitHub's pull request JSON the BFF reads.
type pullResponse struct {
	HTMLURL string `json:"html_url"`
	Number  int    `json:"number"`
}

// forkRequest is the JSON body of a fork creation.
type forkRequest struct {
	DefaultBranchOnly bool `json:"default_branch_only"`
}

// RepoPermissions reports whether the token can push to the repository, whether
// the GitHub App is installed on it, its default branch and its fork/private
// settings. Installation is true when a user installation belongs to the same
// owner and either covers all repositories or lists the repository on one of
// the first ten pages. ViewerInstalledAll is true when an installation belongs
// to viewer with repository_selection "all".
func (c *Client) RepoPermissions(ctx context.Context, token, viewer, owner, repo string) (RepoPermissions, error) {
	settingsURL := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo)
	var settings repoSettings
	if err := c.getActionJSON(ctx, token, settingsURL, &settings); err != nil {
		return RepoPermissions{}, err
	}

	installationsURL := c.APIURL + "/user/installations"
	var list installationList
	if err := c.getActionJSON(ctx, token, installationsURL, &list); err != nil {
		return RepoPermissions{}, err
	}

	result := RepoPermissions{
		Push:          settings.Permissions.Push,
		DefaultBranch: settings.DefaultBranch,
		Private:       settings.Private,
		AllowForking:  !settings.Private || settings.AllowForking,
	}
	if err := c.applyInstallations(ctx, token, viewer, owner, owner+"/"+repo, list.Installations, &result); err != nil {
		return RepoPermissions{}, err
	}
	return result, nil
}

// applyInstallations fills the installation facts of result from the user's
// installations, resolving selected-repository installations through the
// installation repositories endpoint.
func (c *Client) applyInstallations(ctx context.Context, token, viewer, owner, fullName string, installations []installation, result *RepoPermissions) error {
	const allRepositories = "all"
	for _, inst := range installations {
		if strings.EqualFold(inst.Account.Login, viewer) && inst.RepositorySelection == allRepositories {
			result.ViewerInstalledAll = true
		}
		if !strings.EqualFold(inst.Account.Login, owner) || result.Installed {
			continue
		}
		if inst.RepositorySelection == allRepositories {
			result.Installed = true
			continue
		}
		found, err := c.installationCoversRepo(ctx, token, inst.ID, fullName)
		if err != nil {
			return err
		}
		if found {
			result.Installed = true
		}
	}
	return nil
}

// installationCoversRepo reports whether the installation lists fullName on one
// of the first ten repository pages.
func (c *Client) installationCoversRepo(ctx context.Context, token string, id int64, fullName string) (bool, error) {
	const maxPages = 10
	const perPage = 100
	for page := 1; page <= maxPages; page++ {
		target := fmt.Sprintf("%s/user/installations/%d/repositories?per_page=%d&page=%d", c.APIURL, id, perPage, page)
		var repos installationRepos
		if err := c.getActionJSON(ctx, token, target, &repos); err != nil {
			return false, err
		}
		for _, entry := range repos.Repositories {
			if strings.EqualFold(entry.FullName, fullName) {
				return true, nil
			}
		}
		if len(repos.Repositories) < perPage {
			return false, nil
		}
	}
	return false, nil
}

// CreatePull opens a pull request and returns its number and HTML URL.
func (c *Client) CreatePull(ctx context.Context, token, owner, repo, title, head, base, body string) (int, string, error) {
	target := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) + "/pulls"
	payload := pullRequest{
		Title:               title,
		Head:                head,
		Base:                base,
		Body:                body,
		MaintainerCanModify: true,
	}
	var parsed pullResponse
	if err := c.postActionJSON(ctx, token, target, payload, &parsed); err != nil {
		return 0, "", err
	}
	return parsed.Number, parsed.HTMLURL, nil
}

// CreateFork forks a repository with default_branch_only enabled and returns
// the fork's owner, name and default branch.
func (c *Client) CreateFork(ctx context.Context, token, owner, repo string) (Repo, error) {
	target := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) + "/forks"
	var parsed repoResponse
	if err := c.postActionJSON(ctx, token, target, forkRequest{DefaultBranchOnly: true}, &parsed); err != nil {
		return Repo{}, err
	}
	forkOwner := parsed.Owner.Login
	if forkOwner == "" {
		forkOwner = owner
	}
	forkName := parsed.Name
	if forkName == "" {
		forkName = repo
	}
	return Repo{
		Owner:         forkOwner,
		Name:          forkName,
		HTMLURL:       parsed.HTMLURL,
		DefaultBranch: parsed.DefaultBranch,
	}, nil
}

// getActionJSON performs an authenticated GitHub GET and decodes the JSON
// answer into out.
func (c *Client) getActionJSON(ctx context.Context, token, target string, out any) error {
	req, err := c.newActionRequest(ctx, http.MethodGet, token, target, nil)
	if err != nil {
		return err
	}
	return c.doActionJSON(req, out)
}

// postActionJSON performs an authenticated GitHub POST with payload and decodes
// the JSON answer into out.
func (c *Client) postActionJSON(ctx context.Context, token, target string, payload, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("github: encode request: %w", err)
	}
	req, err := c.newActionRequest(ctx, http.MethodPost, token, target, body)
	if err != nil {
		return err
	}
	return c.doActionJSON(req, out)
}

// newActionRequest builds a GitHub API request with the standard headers.
func (c *Client) newActionRequest(ctx context.Context, method, token, target string, body []byte) (*http.Request, error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return nil, fmt.Errorf("github: build request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "opendraft-bff")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req, nil
}

// doActionJSON sends req, maps non-2xx statuses to the shared errors and
// decodes the body into out.
func (c *Client) doActionJSON(req *http.Request, out any) error {
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode <= 299:
	case resp.StatusCode == http.StatusUnprocessableEntity:
		return ErrNameTaken
	case resp.StatusCode == http.StatusUnauthorized,
		resp.StatusCode == http.StatusForbidden,
		resp.StatusCode == http.StatusNotFound:
		return ErrForbidden
	default:
		return fmt.Errorf("%w: status %d", ErrUpstream, resp.StatusCode)
	}

	if out == nil {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
		return nil
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(out); err != nil {
		return fmt.Errorf("%w: decode response", ErrUpstream)
	}
	return nil
}
