package httpapi

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	branchDeletePath = "/@api/repos/{owner}/{repo}/branches/{branch...}"
	branchFieldName  = "branch"
)

// branchSuffixPattern limits the part of a deletable branch after the viewer's
// namespace to characters that are safe in a git ref. Structural checks
// (empty components, dot components) are done separately.
var branchSuffixPattern = regexp.MustCompile(`^[A-Za-z0-9._/-]{1,200}$`)

// handleBranchDelete serves DELETE /@api/repos/{owner}/{repo}/branches/{branch...}.
// It accepts only branches under the signed-in user's own od-<login>/ or
// opendraft/<login>/ prefix and answers 204 No Content on success.
func (h *suggestionsHandler) handleBranchDelete(w http.ResponseWriter, r *http.Request) {
	owner, repo, ok := repoPathParams(w, r)
	if !ok {
		return
	}
	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		branch := r.PathValue("branch")
		if !allowedBranchForLogin(branch, sess.Login) {
			writeInvalidRequest(w, branchFieldName)
			return
		}
		if err := h.github.DeleteBranch(r.Context(), sess.AccessToken, owner, repo, branch); err != nil {
			writeRepoError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}).ServeHTTP(w, r)
}

// allowedBranchForLogin reports whether branch belongs to the viewer's own
// od-<login>/ or opendraft/<login>/ namespace. The login comparison is
// case-insensitive; the remainder must be a non-empty safe branch name.
func allowedBranchForLogin(branch, login string) bool {
	if login == "" {
		return false
	}
	lower := strings.ToLower(branch)
	for _, prefix := range []string{"od-" + strings.ToLower(login) + "/", "opendraft/" + strings.ToLower(login) + "/"} {
		if !strings.HasPrefix(lower, prefix) {
			continue
		}
		return safeBranchSuffix(branch[len(prefix):])
	}
	return false
}

// safeBranchSuffix reports whether suffix is a safe non-empty branch name
// without empty, dot or dot-dot path components.
func safeBranchSuffix(suffix string) bool {
	if !branchSuffixPattern.MatchString(suffix) {
		return false
	}
	for _, part := range strings.Split(suffix, "/") {
		if part == "" || part == "." || part == ".." {
			return false
		}
	}
	return true
}
