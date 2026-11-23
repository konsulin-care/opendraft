// Package httpapi wires the HTTP routes of the BFF onto a single handler.
package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/logging"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	healthPath  = "/@api/health"
	apiPrefix   = "/@api/"
	rootPath    = "/"
	contentType = "application/json"
	errorCode   = "not_found"
)

// Deps holds the runtime dependencies the BFF handler needs.
type Deps struct {
	// Logger receives request log lines. A nil logger falls back to the
	// default slog logger.
	Logger *slog.Logger
	// Now supplies the current time. A nil value falls back to time.Now.
	Now func() time.Time
	// GitHub is the GitHub App client used by the auth endpoints.
	GitHub *github.Client
	// Sealer seals and opens the session and OAuth transaction cookies.
	Sealer *session.Sealer
	// Version is the build version reported by the health endpoint.
	Version string
}

// New builds the BFF handler: the health endpoint, the JSON 404 catch-all for
// the reserved /@api/ namespace, and the static web app at /. Every request is
// wrapped by the request logger.
func New(cfg config.Config, deps Deps) http.Handler {
	if deps.Now == nil {
		deps.Now = time.Now
	}

	api := http.NewServeMux()
	if deps.GitHub == nil || deps.Sealer == nil {
		registerDisabledRoutes(api)
	} else {
		auth := newAuthHandler(cfg, deps)
		logout := newLogoutHandler(deps)
		repos := newReposHandler(auth, deps)
		actions := newRepoActionsHandler(auth, deps)
		suggestions := newSuggestionsHandler(auth, deps)
		git := newGitRelayHandler(cfg, auth)
		owners := newOwnersHandler(auth, deps)

		api.HandleFunc("GET "+loginPath, auth.handleLogin)
		api.HandleFunc("GET "+installPath, auth.handleInstall)
		api.HandleFunc("GET "+installCallbackPath, auth.handleInstallCallback)
		api.HandleFunc("GET "+callbackPath, auth.handleCallback)
		api.HandleFunc("GET "+sessionPath, auth.handleSession)
		api.HandleFunc("POST "+logoutPath, logout.handleLogout)
		api.HandleFunc("POST "+reposPath, repos.handleCreate)
		api.HandleFunc("GET "+permissionsPath, actions.handlePermissions)
		api.HandleFunc("GET "+ownersPath, owners.handleList)
		api.HandleFunc("POST "+pullsPath, actions.handlePulls)
		api.HandleFunc("POST "+forksPath, actions.handleForks)
		api.HandleFunc("GET "+branchesPath, suggestions.handleBranches)
		api.HandleFunc("GET "+pullsPath, suggestions.handlePullLookup)
		api.HandleFunc("POST "+mergeUpstreamPath, suggestions.handleMergeUpstream)
		api.HandleFunc("GET "+gitRelayPath, git.handleRelay)
		api.HandleFunc("POST "+gitRelayPath, git.handleRelay)
	}
	api.HandleFunc("GET "+healthPath, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"version": deps.Version,
		})
	})
	api.HandleFunc(apiPrefix, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": errorCode})
	})
	// ServeMux redirects /@api to /@api/; register the bare prefix so unknown
	// API paths always answer JSON instead of a redirect.
	api.HandleFunc(strings.TrimSuffix(apiPrefix, "/"), func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": errorCode})
	})

	mux := http.NewServeMux()
	protectedAPI := requireSameOrigin(cfg.PublicOrigin, api)
	mux.Handle(apiPrefix, protectedAPI)
	mux.Handle(strings.TrimSuffix(apiPrefix, "/"), protectedAPI)
	if cfg.StaticDir != "" {
		mux.Handle(rootPath, NewStaticHandler(cfg.StaticDir))
	}

	return logging.RequestLogger(deps.Logger, mux)
}

// writeJSON writes payload as a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
