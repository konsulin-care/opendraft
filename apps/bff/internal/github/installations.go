package github

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// RepoInstalled reports whether the GitHub App is installed on owner/repo. It
// calls GET {APIURL}/repos/{owner}/{repo}/installation authenticated as the app
// with a freshly minted app JWT. HTTP 200 means installed, HTTP 404 means not
// installed and every other status maps to ErrUpstream.
func (c *Client) RepoInstalled(ctx context.Context, owner, repo string) (bool, error) {
	token, err := c.AppJWT()
	if err != nil {
		return false, err
	}

	target := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) + "/installation"
	req, err := c.newActionRequest(ctx, http.MethodGet, token, target, nil)
	if err != nil {
		return false, fmt.Errorf("github: build installation request: %w", err)
	}

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return false, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode <= 299:
		return true, nil
	case resp.StatusCode == http.StatusNotFound:
		return false, nil
	default:
		return false, fmt.Errorf("%w: status %d", ErrUpstream, resp.StatusCode)
	}
}

// userInstallations returns the installations visible to the user token. It
// reads GET /user/installations across up to ten pages of 100 entries and stops
// at the first page with fewer than 100 entries.
func (c *Client) userInstallations(ctx context.Context, token string) ([]installation, error) {
	const maxPages = 10
	const perPage = 100

	var all []installation
	for page := 1; page <= maxPages; page++ {
		target := fmt.Sprintf("%s/user/installations?per_page=%d&page=%d", c.APIURL, perPage, page)
		var list installationList
		if err := c.getActionJSON(ctx, token, target, &list); err != nil {
			return nil, err
		}
		all = append(all, list.Installations...)
		if len(list.Installations) < perPage {
			break
		}
	}
	return all, nil
}

// applyViewerInstallation sets ViewerInstalledAll when an installation belongs
// to viewer with repository_selection "all".
func applyViewerInstallation(installations []installation, viewer string, result *RepoPermissions) {
	for _, inst := range installations {
		if strings.EqualFold(inst.Account.Login, viewer) && inst.RepositorySelection == "all" {
			result.ViewerInstalledAll = true
			return
		}
	}
}

// applyInstallations fills the installation facts of result from the user's
// installations, resolving selected-repository installations through the
// installation repositories endpoint.
func (c *Client) applyInstallations(ctx context.Context, token, viewer, owner, fullName string, installations []installation, result *RepoPermissions) error {
	const allRepositories = "all"
	applyViewerInstallation(installations, viewer, result)
	for _, inst := range installations {
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
