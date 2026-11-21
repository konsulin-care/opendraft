package httpapi

import (
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	gitRelayPath    = "/@api/git/{owner}/{repo}/{rest...}"
	gitRepoSuffix   = ".git"
	gitRestParam    = "rest"
	gitServiceParam = "service"
	gitUploadPack   = "git-upload-pack"
	gitReceivePack  = "git-receive-pack"
	gitInfoRefs     = "info/refs"
	gitUserAgent    = "opendraft-bff"
	gitTokenUser    = "x-access-token"
	// maxGitBodyBytes is the largest git request body the relay accepts.
	maxGitBodyBytes = 50 << 20
	// gitRelayTimeout bounds one upstream git request.
	gitRelayTimeout = 5 * time.Minute
	tooLargeCode    = "too_large"
)

// gitRelayHandler forwards the three smart-HTTP git shapes to the GitHub web
// frontend with the session's user token.
type gitRelayHandler struct {
	auth   *authHandler
	webURL string
	client *http.Client
}

// newGitRelayHandler builds the git relay handler on the shared auth handler.
func newGitRelayHandler(cfg config.Config, auth *authHandler) *gitRelayHandler {
	return &gitRelayHandler{
		auth:   auth,
		webURL: strings.TrimSuffix(cfg.GitHubWebURL, "/"),
		client: &http.Client{Timeout: gitRelayTimeout},
	}
}

// handleRelay validates the smart-HTTP target, requires a session and streams
// the request upstream.
func (h *gitRelayHandler) handleRelay(w http.ResponseWriter, r *http.Request) {
	owner := r.PathValue(ownerParam)
	repo := r.PathValue(repoParam)
	rest := r.PathValue(gitRestParam)
	if !validGitRelayTarget(owner, repo, rest, r) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": errorCode})
		return
	}

	h.auth.requireSession(func(w http.ResponseWriter, r *http.Request, sess session.Session) {
		h.forward(w, r, sess, owner, repo, rest)
	}).ServeHTTP(w, r)
}

// validGitRelayTarget reports whether the method, repository segments and path
// form one of the three allowed smart-HTTP shapes.
func validGitRelayTarget(owner, repo, rest string, r *http.Request) bool {
	if !pathOwnerPattern.MatchString(owner) {
		return false
	}
	stem := strings.TrimSuffix(repo, gitRepoSuffix)
	if stem == repo || stem == "." || stem == ".." || !namePattern.MatchString(stem) {
		return false
	}

	switch r.Method {
	case http.MethodGet:
		if rest != gitInfoRefs {
			return false
		}
		return allowedGitService(r.URL.Query().Get(gitServiceParam))
	case http.MethodPost:
		return rest == gitUploadPack || rest == gitReceivePack
	default:
		return false
	}
}

// allowedGitService reports whether service names a smart-HTTP service.
func allowedGitService(service string) bool {
	return service == gitUploadPack || service == gitReceivePack
}

// forward streams the validated request to GitHub and relays the upstream
// status, content headers and body.
func (h *gitRelayHandler) forward(w http.ResponseWriter, r *http.Request, sess session.Session, owner, repo, rest string) {
	if r.ContentLength > maxGitBodyBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": tooLargeCode})
		return
	}

	target := h.upstreamURL(owner, repo, rest, r)
	var body io.Reader
	if r.Body != nil {
		limited := http.MaxBytesReader(w, r.Body, maxGitBodyBytes)
		body = limited
		defer limited.Close()
	}

	req, err := http.NewRequestWithContext(r.Context(), r.Method, target, body)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": upstreamErrorCode})
		return
	}
	req.ContentLength = r.ContentLength
	copyGitRequestHeaders(req.Header, r.Header)
	req.Header.Set("User-Agent", gitUserAgent)
	req.Header.Set("Authorization", gitBasicAuth(sess.AccessToken))

	resp, err := h.client.Do(req)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": tooLargeCode})
			return
		}
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": upstreamErrorCode})
		return
	}
	defer resp.Body.Close()

	if resp.Header.Get("Content-Type") != "" {
		w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	}
	if resp.Header.Get("Cache-Control") != "" {
		w.Header().Set("Cache-Control", resp.Header.Get("Cache-Control"))
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// upstreamURL builds the GitHub web URL of the relayed request, adding the
// service query parameter for info/refs requests only.
func (h *gitRelayHandler) upstreamURL(owner, repo, rest string, r *http.Request) string {
	target := h.webURL + "/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) + "/" + rest
	if rest == gitInfoRefs {
		service := url.QueryEscape(r.URL.Query().Get(gitServiceParam))
		target += "?" + gitServiceParam + "=" + service
	}
	return target
}

// copyGitRequestHeaders copies the client headers git needs upstream. Cookie
// and Authorization are never copied.
func copyGitRequestHeaders(dst, src http.Header) {
	for _, name := range []string{"Content-Type", "Accept", "Git-Protocol", "Content-Encoding"} {
		if value := src.Get(name); value != "" {
			dst.Set(name, value)
		}
	}
}

// gitBasicAuth returns the HTTP Basic value GitHub expects for user tokens.
func gitBasicAuth(token string) string {
	raw := gitTokenUser + ":" + token
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(raw))
}
