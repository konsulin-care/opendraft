package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// ErrConflict is returned when GitHub refuses an upstream merge because the
// branch has conflicting changes (HTTP 409).
var ErrConflict = errors.New("github: merge conflict")

// BranchRef is a branch returned by the matching-refs endpoint.
type BranchRef struct {
	// Name is the branch name with the refs/heads/ prefix removed.
	Name string
	// SHA is the commit SHA the branch currently points at.
	SHA string
}

// PullInfo is the subset of a pull request the suggestion flow reads.
type PullInfo struct {
	// HTMLURL is the browser URL of the pull request.
	HTMLURL string
	// State is "open", "closed" or "merged".
	State string
	// ReviewState summarises the latest review per reviewer: "changes_requested",
	// "approved" or "none".
	ReviewState string
	// HeadSHA is the commit SHA the pull request head branch points at.
	HeadSHA string
	// Number is the pull request number within the repository.
	Number int
}

// matchingRef mirrors one entry of GET /git/matching-refs/heads/{prefix}.
type matchingRef struct {
	Ref    string `json:"ref"`
	Object struct {
		SHA string `json:"sha"`
	} `json:"object"`
}

// pullSummary mirrors the subset of a pull request list entry the BFF reads.
type pullSummary struct {
	HTMLURL  string  `json:"html_url"`
	State    string  `json:"state"`
	MergedAt *string `json:"merged_at"`
	Head     struct {
		Label string `json:"label"`
		SHA   string `json:"sha"`
	} `json:"head"`
	Number int `json:"number"`
}

// reviewSummary mirrors the subset of a pull request review the BFF reads.
type reviewSummary struct {
	State string `json:"state"`
	User  struct {
		Login string `json:"login"`
	} `json:"user"`
	ID int64 `json:"id"`
}

// mergeUpstreamRequest is the JSON body of a merge-upstream call.
type mergeUpstreamRequest struct {
	Branch string `json:"branch"`
}

// MatchingBranches lists the branches of owner/repo whose names start with
// prefix. The returned names have the refs/heads/ prefix stripped and carry the
// branch head SHA. No matches yields an empty slice, not nil.
func (c *Client) MatchingBranches(ctx context.Context, token, owner, repo, prefix string) ([]BranchRef, error) {
	target := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) +
		"/git/matching-refs/heads/" + escapePathSegments(prefix)
	var refs []matchingRef
	if err := c.getActionJSON(ctx, token, target, &refs); err != nil {
		return nil, err
	}
	branches := make([]BranchRef, 0, len(refs))
	for _, ref := range refs {
		branches = append(branches, BranchRef{
			Name: strings.TrimPrefix(ref.Ref, "refs/heads/"),
			SHA:  ref.Object.SHA,
		})
	}
	return branches, nil
}

// LatestPull returns the newest pull request whose head matches head (of the
// form owner:branch) across all states. It reports found false when GitHub
// returns no pull request, and also when the newest pull request of the
// repository comes from another head: GitHub ignores an unqualified head
// filter, so the response is verified against head.label. A set merged_at
// makes the state "merged".
func (c *Client) LatestPull(ctx context.Context, token, owner, repo, head string) (PullInfo, bool, error) {
	query := url.Values{}
	query.Set("head", head)
	query.Set("state", "all")
	query.Set("sort", "created")
	query.Set("direction", "desc")
	query.Set("per_page", "1")
	target := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) +
		"/pulls?" + query.Encode()

	var pulls []pullSummary
	if err := c.getActionJSON(ctx, token, target, &pulls); err != nil {
		return PullInfo{}, false, err
	}
	if len(pulls) == 0 {
		return PullInfo{}, false, nil
	}
	newest := pulls[0]
	if !strings.EqualFold(newest.Head.Label, head) {
		return PullInfo{}, false, nil
	}
	state := newest.State
	if newest.MergedAt != nil {
		state = "merged"
	}
	reviewState, err := c.pullReviewState(ctx, token, owner, repo, newest.Number)
	if err != nil {
		return PullInfo{}, false, err
	}
	return PullInfo{
		Number:      newest.Number,
		HTMLURL:     newest.HTMLURL,
		State:       state,
		ReviewState: reviewState,
		HeadSHA:     newest.Head.SHA,
	}, true, nil
}

// pullReviewState reads the reviews of a pull request and summarises the latest
// review per reviewer. Change requests win over approvals; no relevant review
// yields "none".
func (c *Client) pullReviewState(ctx context.Context, token, owner, repo string, number int) (string, error) {
	target := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) +
		"/pulls/" + fmt.Sprint(number) + "/reviews?per_page=100"
	var reviews []reviewSummary
	if err := c.getActionJSON(ctx, token, target, &reviews); err != nil {
		return "", err
	}
	return summarizeReviews(reviews), nil
}

// summarizeReviews keeps the latest review per reviewer (by review id) and
// returns changes_requested when any latest review requests changes, approved
// when any latest review approves, and none otherwise.
func summarizeReviews(reviews []reviewSummary) string {
	latest := make(map[string]reviewSummary, len(reviews))
	for _, review := range reviews {
		if previous, ok := latest[review.User.Login]; ok && previous.ID > review.ID {
			continue
		}
		latest[review.User.Login] = review
	}
	approved := false
	for _, review := range latest {
		switch review.State {
		case "CHANGES_REQUESTED":
			return "changes_requested"
		case "APPROVED":
			approved = true
		}
	}
	if approved {
		return "approved"
	}
	return "none"
}

// MergeUpstream asks GitHub to merge the upstream default branch into the fork
// branch named branch. A 409 answer maps to ErrConflict.
func (c *Client) MergeUpstream(ctx context.Context, token, owner, repo, branch string) error {
	target := c.APIURL + "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) + "/merge-upstream"
	body, err := json.Marshal(mergeUpstreamRequest{Branch: branch})
	if err != nil {
		return fmt.Errorf("github: encode merge request: %w", err)
	}
	req, err := c.newActionRequest(ctx, http.MethodPost, token, target, body)
	if err != nil {
		return err
	}
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode <= 299:
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
		return nil
	case resp.StatusCode == http.StatusConflict:
		return ErrConflict
	case resp.StatusCode == http.StatusUnauthorized,
		resp.StatusCode == http.StatusForbidden,
		resp.StatusCode == http.StatusNotFound:
		return ErrForbidden
	default:
		return fmt.Errorf("%w: status %d", ErrUpstream, resp.StatusCode)
	}
}

// escapePathSegments escapes each slash-separated segment of value while
// keeping the slashes themselves, so branch prefixes stay valid API paths.
func escapePathSegments(value string) string {
	segments := strings.Split(value, "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}
