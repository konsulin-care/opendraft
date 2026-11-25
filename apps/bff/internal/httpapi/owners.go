package httpapi

import (
	"net/http"

	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const ownersPath = "/@api/owners"

// ownersHandler serves the owner list used by the publish flow.
type ownersHandler struct {
	auth   *authHandler
	github *github.Client
}

// newOwnersHandler builds the owners handler on the shared auth handler so
// every request goes through session authentication.
func newOwnersHandler(auth *authHandler, deps Deps) *ownersHandler {
	return &ownersHandler{auth: auth, github: deps.GitHub}
}

// ownerResponse is one entry of the owners endpoint answer.
type ownerResponse struct {
	Login     string `json:"login"`
	Type      string `json:"type"`
	AvatarURL string `json:"avatarUrl"`
	AllRepos  bool   `json:"allRepos"`
}

// handleList serves GET /@api/owners with the accounts the viewer can publish
// to. It answers 401 unauthenticated without a session.
func (h *ownersHandler) handleList(w http.ResponseWriter, r *http.Request) {
	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		owners, err := h.github.ListOwners(r.Context(), sess.AccessToken)
		if err != nil {
			writeRepoError(w, err)
			return
		}

		result := make([]ownerResponse, 0, len(owners))
		for _, owner := range owners {
			result = append(result, ownerResponse{
				Login:     owner.Login,
				Type:      owner.Type,
				AvatarURL: owner.AvatarURL,
				AllRepos:  owner.AllRepos,
			})
		}
		writeJSON(w, http.StatusOK, result)
	}).ServeHTTP(w, r)
}
