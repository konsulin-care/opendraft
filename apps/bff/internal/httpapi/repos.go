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
	reposPath          = "/@api/repos"
	invalidRequestCode = "invalid_request"
	nameTakenCode      = "name_taken"
	forbiddenCode      = "forbidden"
	upstreamErrorCode  = "upstream_error"
	publicVisibility   = "public"
	privateVisibility  = "private"
	ownerField         = "owner"
	nameField          = "name"
	visibilityField    = "visibility"
)

var (
	ownerPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,39}$`)
	namePattern  = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}$`)
)

// reposHandler serves repository creation for the authenticated user.
type reposHandler struct {
	auth   *authHandler
	github *github.Client
}

// newReposHandler builds the repository handler on the shared auth handler so
// every request goes through session authentication.
func newReposHandler(auth *authHandler, deps Deps) *reposHandler {
	return &reposHandler{auth: auth, github: deps.GitHub}
}

// createRepoRequest is the JSON body of POST /@api/repos.
type createRepoRequest struct {
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	Visibility  string `json:"visibility"`
	Description string `json:"description"`
}

// createRepoResponse is the JSON answer of a successful repository creation.
type createRepoResponse struct {
	Owner         string `json:"owner"`
	Name          string `json:"name"`
	HTMLURL       string `json:"htmlUrl"`
	DefaultBranch string `json:"defaultBranch"`
}

// handleCreate serves POST /@api/repos. It validates the body before any
// GitHub call and maps GitHub failures to stable JSON error codes.
func (h *reposHandler) handleCreate(w http.ResponseWriter, r *http.Request) {
	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		var body createRepoRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
			writeInvalidRequest(w, ownerField)
			return
		}

		if field := validateRepoRequest(body); field != "" {
			writeInvalidRequest(w, field)
			return
		}

		private := body.Visibility == privateVisibility
		ownerIsUser := strings.EqualFold(body.Owner, sess.Login)

		repo, err := h.github.CreateRepo(r.Context(), sess.AccessToken, body.Owner, ownerIsUser, body.Name, body.Description, private)
		if err != nil {
			writeRepoError(w, err)
			return
		}

		writeJSON(w, http.StatusCreated, createRepoResponse{
			Owner:         repo.Owner,
			Name:          repo.Name,
			HTMLURL:       repo.HTMLURL,
			DefaultBranch: repo.DefaultBranch,
		})
	}).ServeHTTP(w, r)
}

// validateRepoRequest returns the name of the first invalid field, or an empty
// string when the body is valid.
func validateRepoRequest(body createRepoRequest) string {
	if !ownerPattern.MatchString(body.Owner) {
		return ownerField
	}
	if body.Name == "." || body.Name == ".." || !namePattern.MatchString(body.Name) {
		return nameField
	}
	if body.Visibility != publicVisibility && body.Visibility != privateVisibility {
		return visibilityField
	}
	return ""
}

// writeInvalidRequest answers 400 with the invalid_request code and the name of
// the offending field.
func writeInvalidRequest(w http.ResponseWriter, field string) {
	writeJSON(w, http.StatusBadRequest, map[string]string{
		"error": invalidRequestCode,
		"field": field,
	})
}

// writeRepoError maps a GitHub client error to its stable status and code
// without relaying any upstream body.
func writeRepoError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, github.ErrNameTaken):
		writeJSON(w, http.StatusConflict, map[string]string{"error": nameTakenCode})
	case errors.Is(err, github.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": forbiddenCode})
	default:
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": upstreamErrorCode})
	}
}
