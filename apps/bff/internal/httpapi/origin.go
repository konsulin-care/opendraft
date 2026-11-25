package httpapi

import "net/http"

const forbiddenOriginCode = "forbidden_origin"

// requireSameOrigin wraps next with a strict CSRF origin check. Requests whose
// method is not GET, HEAD or OPTIONS must carry an Origin header equal to
// publicOrigin exactly; otherwise they are rejected with 403 and the JSON
// {"error":"forbidden_origin"} body. Safe methods pass through without an
// Origin header.
func requireSameOrigin(publicOrigin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			next.ServeHTTP(w, r)
			return
		}

		if r.Header.Get("Origin") != publicOrigin {
			writeError(w, http.StatusForbidden, forbiddenOriginCode)
			return
		}

		next.ServeHTTP(w, r)
	})
}
