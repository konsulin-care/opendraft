package httpapi

import (
	"encoding/json"
	"net/http"
	"regexp"
	"unicode/utf8"

	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	permissionsPath = "/@api/repos/{owner}/{repo}/permissions"
	pullsPath       = "/@api/repos/{owner}/{repo}/pulls"
	forksPath       = "/@api/repos/{owner}/{repo}/forks"
	ownerParam      = "owner"
	repoParam       = "repo"
	titleField      = "title"
	headField       = "head"
	baseField       = "base"
	repoField       = "repo"
	maxTitleLength  = 256
)

var (
	pathOwnerPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,39}$`)
	pathRepoPattern  = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}$`)
	headBasePattern  = regexp.MustCompile(`^[A-Za-z0-9._/:-]{1,255}$`)
)

// repoActionsHandler serves permissions, pull request and fork operations for
// the authenticated user.
type repoActionsHandler struct {
	auth   *authHandler
	github *github.Client
}

// newRepoActionsHandler builds the repository actions handler on the shared
// auth handler so every request goes through session authentication.
func newRepoActionsHandler(auth *authHandler, deps Deps) *repoActionsHandler {
	return &repoActionsHandler{auth: auth, github: deps.GitHub}
}

// permissionsResponse is the JSON answer of the permissions endpoint.
type permissionsResponse struct {
	Push          bool   `json:"push"`
	Installed     bool   `json:"installed"`
	DefaultBranch string `json:"defaultBranch"`
}

// pullsRequest is the JSON body of a pull request creation.
type pullsRequest struct {
	Title string `json:"title"`
	Head  string `json:"head"`
	Base  string `json:"base"`
	Body  string `json:"body"`
}

// pullsResponse is the JSON answer of a successful pull request creation.
type pullsResponse struct {
	Number int    `json:"number"`
	URL    string `json:"url"`
}

// forkResponse is the JSON answer of a successful fork creation.
type forkResponse struct {
	Owner         string `json:"owner"`
	Repo          string `json:"repo"`
	DefaultBranch string `json:"defaultBranch"`
}

// handlePermissions serves GET /@api/repos/{owner}/{repo}/permissions.
func (h *repoActionsHandler) handlePermissions(w http.ResponseWriter, r *http.Request) {
	owner, repo, ok := repoPathParams(w, r)
	if !ok {
		return
	}
	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		push, installed, branch, err := h.github.RepoPermissions(r.Context(), sess.AccessToken, owner, repo)
		if err != nil {
			writeRepoError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, permissionsResponse{
			Push:          push,
			Installed:     installed,
			DefaultBranch: branch,
		})
	}).ServeHTTP(w, r)
}

// handlePulls serves POST /@api/repos/{owner}/{repo}/pulls. It validates the
// body before any GitHub call and maps failures to stable JSON error codes.
func (h *repoActionsHandler) handlePulls(w http.ResponseWriter, r *http.Request) {
	owner, repo, ok := repoPathParams(w, r)
	if !ok {
		return
	}
	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		var body pullsRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
			writeInvalidRequest(w, titleField)
			return
		}
		if field := validatePullRequest(body); field != "" {
			writeInvalidRequest(w, field)
			return
		}

		number, htmlURL, err := h.github.CreatePull(r.Context(), sess.AccessToken, owner, repo, body.Title, body.Head, body.Base, body.Body)
		if err != nil {
			writeRepoError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, pullsResponse{Number: number, URL: htmlURL})
	}).ServeHTTP(w, r)
}

// handleForks serves POST /@api/repos/{owner}/{repo}/forks.
func (h *repoActionsHandler) handleForks(w http.ResponseWriter, r *http.Request) {
	owner, repo, ok := repoPathParams(w, r)
	if !ok {
		return
	}
	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		fork, err := h.github.CreateFork(r.Context(), sess.AccessToken, owner, repo)
		if err != nil {
			writeRepoError(w, err)
			return
		}
		writeJSON(w, http.StatusAccepted, forkResponse{
			Owner:         fork.Owner,
			Repo:          fork.Name,
			DefaultBranch: fork.DefaultBranch,
		})
	}).ServeHTTP(w, r)
}

// repoPathParams validates the owner and repo path segments of r and writes a
// 400 JSON answer when either is invalid.
func repoPathParams(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	owner := r.PathValue(ownerParam)
	repo := r.PathValue(repoParam)
	if !pathOwnerPattern.MatchString(owner) {
		writeInvalidRequest(w, ownerField)
		return "", "", false
	}
	if repo == "." || repo == ".." || !pathRepoPattern.MatchString(repo) {
		writeInvalidRequest(w, repoField)
		return "", "", false
	}
	return owner, repo, true
}

// validatePullRequest returns the name of the first invalid field, or an empty
// string when the body is valid.
func validatePullRequest(body pullsRequest) string {
	titleLength := utf8.RuneCountInString(body.Title)
	if titleLength < 1 || titleLength > maxTitleLength {
		return titleField
	}
	if !headBasePattern.MatchString(body.Head) {
		return headField
	}
	if !headBasePattern.MatchString(body.Base) {
		return baseField
	}
	return ""
}
