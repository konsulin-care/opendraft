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
	Permissions   struct {
		Push bool `json:"push"`
	} `json:"permissions"`
}

// installation is one GitHub App installation visible to a user token.
type installation struct {
	ID                  int64  `json:"id"`
	RepositorySelection string `json:"repository_selection"`
	Account             struct {
		Login string `json:"login"`
	} `json:"account"`
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
	Number  int    `json:"number"`
	HTMLURL string `json:"html_url"`
}

// forkRequest is the JSON body of a fork creation.
type forkRequest struct {
	DefaultBranchOnly bool `json:"default_branch_only"`
}

// RepoPermissions reports whether the token can push to the repository, whether
// the GitHub App is installed on it, and its default branch. Installation is
// true when a user installation belongs to the same owner and either covers all
// repositories or lists the repository on one of the first ten pages.
func (c *Client) RepoPermissions(ctx context.Context, token, owner, repo string) (bool, bool, string, error) {
	settingsURL := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo)
	var settings repoSettings
	if err := c.getActionJSON(ctx, token, settingsURL, &settings); err != nil {
		return false, false, "", err
	}

	installationsURL := c.APIURL + "/user/installations"
	var list installationList
	if err := c.getActionJSON(ctx, token, installationsURL, &list); err != nil {
		return false, false, "", err
	}

	fullName := owner + "/" + repo
	for _, inst := range list.Installations {
		if !strings.EqualFold(inst.Account.Login, owner) {
			continue
		}
		if inst.RepositorySelection == "all" {
			return settings.Permissions.Push, true, settings.DefaultBranch, nil
		}
		found, err := c.installationCoversRepo(ctx, token, inst.ID, fullName)
		if err != nil {
			return false, false, "", err
		}
		if found {
			return settings.Permissions.Push, true, settings.DefaultBranch, nil
		}
	}
	return settings.Permissions.Push, false, settings.DefaultBranch, nil
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
	defer resp.Body.Close()

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
