package github

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// DeleteBranch deletes the branch named branch from owner/repo through the
// GitHub git refs API. A missing branch (404) or an unprocessable ref (422) is
// treated as already deleted and returns nil, making the call idempotent.
// Unauthorized and forbidden answers map to ErrForbidden, any other status or
// transport failure to ErrUpstream.
func (c *Client) DeleteBranch(ctx context.Context, token, owner, repo, branch string) error {
	target := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) +
		"/git/refs/heads/" + escapePathSegments(branch)
	req, err := c.newActionRequest(ctx, http.MethodDelete, token, target, nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode <= 299:
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
		return nil
	case resp.StatusCode == http.StatusNotFound,
		resp.StatusCode == http.StatusUnprocessableEntity:
		return nil
	case resp.StatusCode == http.StatusUnauthorized,
		resp.StatusCode == http.StatusForbidden:
		return ErrForbidden
	default:
		return fmt.Errorf("%w: status %d", ErrUpstream, resp.StatusCode)
	}
}
