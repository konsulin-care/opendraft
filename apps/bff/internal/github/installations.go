package github

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
