package httpapi

import "net/http"

const (
	// loginDisabledCode is the JSON error code returned by every gated route
	// when login is not configured.
	loginDisabledCode = "login_disabled"
	// reposPrefix gates every path below the repository namespace.
	reposPrefix = "/@api/repos/"
	// gitPrefix gates every path below the git relay namespace.
	gitPrefix = "/@api/git/"
)

// handleLoginDisabled answers a gated route with the login_disabled error.
func handleLoginDisabled(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusForbidden, map[string]string{"error": loginDisabledCode})
}

// handleSessionDisabled answers GET /@api/auth/session when login is not
// configured, reporting that login is disabled instead of a session.
func handleSessionDisabled(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"loginEnabled": false})
}

// registerDisabledRoutes installs the stub handlers used when the GitHub client
// or the sealer is not wired. Health, session, static files and the SPA
// fallback are registered by the caller and stay ungated.
func registerDisabledRoutes(api *http.ServeMux) {
	api.HandleFunc("GET "+loginPath, handleLoginDisabled)
	api.HandleFunc("GET "+installPath, handleLoginDisabled)
	api.HandleFunc("GET "+callbackPath, handleLoginDisabled)
	api.HandleFunc("POST "+logoutPath, handleLoginDisabled)
	api.HandleFunc("GET "+sessionPath, handleSessionDisabled)
	api.HandleFunc("POST "+reposPath, handleLoginDisabled)
	api.HandleFunc(reposPrefix, handleLoginDisabled)
	api.HandleFunc(gitPrefix, handleLoginDisabled)
}
