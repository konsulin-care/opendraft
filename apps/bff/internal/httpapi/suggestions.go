package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	branchesPath      = "/@api/repos/{owner}/{repo}/branches"
	mergeUpstreamPath = "/@api/repos/{owner}/{repo}/merge-upstream"
	prefixField       = "prefix"
	branchField       = "branch"
	conflictCode      = "conflict"
)

// branchPrefixPattern limits suggestion branch prefixes to the legacy
// opendraft/ namespace and the od-<login> namespace so the endpoint can never
// enumerate unrelated branches. Both `od-<login>` and `od-<login>/...` forms
// are accepted; od-/x and bare od- are rejected.
var branchPrefixPattern = regexp.MustCompile(`^(opendraft/[A-Za-z0-9._/-]{1,200}|od-[A-Za-z0-9-]{1,39}(/[A-Za-z0-9._/-]{0,200})?)$`)

// suggestionsHandler serves the branch, pull request and upstream-merge
// endpoints used by the suggestion flow.
type suggestionsHandler struct {
	auth   *authHandler
	github *github.Client
}

// newSuggestionsHandler builds the suggestions handler on the shared auth
// handler so every request goes through session authentication.
func newSuggestionsHandler(auth *authHandler, deps Deps) *suggestionsHandler {
	return &suggestionsHandler{auth: auth, github: deps.GitHub}
}

// branchRefResponse is one entry of the branches endpoint answer.
type branchRefResponse struct {
	Name string `json:"name"`
	SHA  string `json:"sha"`
}

// pullInfoResponse is the JSON answer of the pull lookup endpoint.
type pullInfoResponse struct {
	Number      int    `json:"number"`
	URL         string `json:"url"`
	State       string `json:"state"`
	ReviewState string `json:"reviewState"`
}

// mergeUpstreamBody is the JSON body of the merge-upstream endpoint.
type mergeUpstreamBody struct {
	Branch string `json:"branch"`
}

// mergeUpstreamResponse is the JSON answer of a successful upstream merge.
type mergeUpstreamResponse struct {
	Merged bool `json:"merged"`
}

// handleBranches serves GET /@api/repos/{owner}/{repo}/branches. It validates
// the prefix query before any GitHub call and returns matching branch names
// with their head SHA.
func (h *suggestionsHandler) handleBranches(w http.ResponseWriter, r *http.Request) {
	owner, repo, ok := repoPathParams(w, r)
	if !ok {
		return
	}
	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		prefix := r.URL.Query().Get(prefixField)
		if !branchPrefixPattern.MatchString(prefix) {
			writeInvalidRequest(w, prefixField)
			return
		}

		branches, err := h.github.MatchingBranches(r.Context(), sess.AccessToken, owner, repo, prefix)
		if err != nil {
			writeRepoError(w, err)
			return
		}

		refs := make([]branchRefResponse, 0, len(branches))
		for _, branch := range branches {
			refs = append(refs, branchRefResponse{Name: branch.Name, SHA: branch.SHA})
		}
		writeJSON(w, http.StatusOK, refs)
	}).ServeHTTP(w, r)
}

// handlePullLookup serves GET /@api/repos/{owner}/{repo}/pulls with a head
// query. It answers the newest matching pull request or 404 not_found.
func (h *suggestionsHandler) handlePullLookup(w http.ResponseWriter, r *http.Request) {
	owner, repo, ok := repoPathParams(w, r)
	if !ok {
		return
	}
	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		head := r.URL.Query().Get(headField)
		if !headBasePattern.MatchString(head) {
			writeInvalidRequest(w, headField)
			return
		}
		if !strings.Contains(head, ":") {
			writeInvalidRequest(w, headField)
			return
		}

		pull, found, err := h.github.LatestPull(r.Context(), sess.AccessToken, owner, repo, head)
		if err != nil {
			writeRepoError(w, err)
			return
		}
		if !found {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": errorCode})
			return
		}
		writeJSON(w, http.StatusOK, pullInfoResponse{
			Number:      pull.Number,
			URL:         pull.HTMLURL,
			State:       pull.State,
			ReviewState: pull.ReviewState,
		})
	}).ServeHTTP(w, r)
}

// handleMergeUpstream serves POST /@api/repos/{owner}/{repo}/merge-upstream.
// A GitHub merge conflict maps to 409 conflict.
func (h *suggestionsHandler) handleMergeUpstream(w http.ResponseWriter, r *http.Request) {
	owner, repo, ok := repoPathParams(w, r)
	if !ok {
		return
	}
	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		var body mergeUpstreamBody
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
			writeInvalidRequest(w, branchField)
			return
		}
		if !headBasePattern.MatchString(body.Branch) {
			writeInvalidRequest(w, branchField)
			return
		}

		err := h.github.MergeUpstream(r.Context(), sess.AccessToken, owner, repo, body.Branch)
		if errors.Is(err, github.ErrConflict) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": conflictCode})
			return
		}
		if err != nil {
			writeRepoError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mergeUpstreamResponse{Merged: true})
	}).ServeHTTP(w, r)
}
