package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// Repo is the subset of a GitHub repository the BFF returns to the web app.
type Repo struct {
	// Owner is the login of the repository owner.
	Owner string
	// Name is the repository name without the owner prefix.
	Name string
	// HTMLURL is the browser URL of the repository.
	HTMLURL string
	// DefaultBranch is the repository's default branch name.
	DefaultBranch string
}

var (
	// ErrNameTaken is returned when GitHub rejects the repository name as
	// already taken or invalid (HTTP 422).
	ErrNameTaken = errors.New("github: repository name taken")
	// ErrForbidden is returned when the token is not allowed to create the
	// repository (HTTP 401, 403 or 404).
	ErrForbidden = errors.New("github: repository forbidden")
	// ErrUpstream is returned for any other GitHub failure. It never carries
	// the upstream response body.
	ErrUpstream = errors.New("github: upstream error")
)

// createRepoRequest is the JSON body sent to the GitHub repo creation API.
type createRepoRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Private     bool   `json:"private"`
	AutoInit    bool   `json:"auto_init"`
}

// repoResponse is the subset of GitHub's repository JSON the BFF reads.
type repoResponse struct {
	Name          string `json:"name"`
	HTMLURL       string `json:"html_url"`
	DefaultBranch string `json:"default_branch"`
	Owner         struct {
		Login string `json:"login"`
	} `json:"owner"`
}

// CreateRepo creates a repository owned by the authenticated user (when
// ownerIsUser) or by the organisation named owner. It POSTs to
// {APIURL}/user/repos or {APIURL}/orgs/{owner}/repos with auto_init disabled
// and returns the created repository. Status 422 maps to ErrNameTaken,
// 401/403/404 to ErrForbidden and every other failure to ErrUpstream.
func (c *Client) CreateRepo(ctx context.Context, token, owner string, ownerIsUser bool, name, description string, private bool) (Repo, error) {
	payload, err := json.Marshal(createRepoRequest{
		Name:        name,
		Description: description,
		Private:     private,
		AutoInit:    false,
	})
	if err != nil {
		return Repo{}, fmt.Errorf("github: encode repo request: %w", err)
	}

	target := c.APIURL + "/user/repos"
	if !ownerIsUser {
		target = c.APIURL + "/orgs/" + url.PathEscape(owner) + "/repos"
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, bytes.NewReader(payload))
	if err != nil {
		return Repo{}, fmt.Errorf("github: build repo request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "opendraft-bff")

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return Repo{}, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode <= 299:
	case resp.StatusCode == http.StatusUnprocessableEntity:
		return Repo{}, ErrNameTaken
	case resp.StatusCode == http.StatusUnauthorized,
		resp.StatusCode == http.StatusForbidden,
		resp.StatusCode == http.StatusNotFound:
		return Repo{}, ErrForbidden
	default:
		return Repo{}, fmt.Errorf("%w: status %d", ErrUpstream, resp.StatusCode)
	}

	var parsed repoResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&parsed); err != nil {
		return Repo{}, fmt.Errorf("%w: decode repo response", ErrUpstream)
	}

	repoOwner := parsed.Owner.Login
	if repoOwner == "" {
		repoOwner = owner
	}
	repoName := parsed.Name
	if repoName == "" {
		repoName = name
	}
	return Repo{
		Owner:         repoOwner,
		Name:          repoName,
		HTMLURL:       parsed.HTMLURL,
		DefaultBranch: parsed.DefaultBranch,
	}, nil
}
