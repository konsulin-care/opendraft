package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// healthServerAddr starts a server with the given status and returns its
// listen address.
func healthServerAddr(t *testing.T, status int) (string, *http.Client) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/@api/health" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if status == http.StatusOK {
			_, _ = w.Write([]byte(`{"status":"ok","version":"1.2.3"}`))
			return
		}
		w.WriteHeader(status)
	}))
	t.Cleanup(server.Close)

	addr := server.Listener.Addr().String()
	return addr, server.Client()
}

func TestRunHealthcheckHealthy(t *testing.T) {
	addr, client := healthServerAddr(t, http.StatusOK)

	if got := runHealthcheck(addr, client); got != 0 {
		t.Errorf("runHealthcheck = %d, want 0", got)
	}
}

func TestRunHealthcheckUnhealthy(t *testing.T) {
	addr, client := healthServerAddr(t, http.StatusInternalServerError)

	if got := runHealthcheck(addr, client); got != 1 {
		t.Errorf("runHealthcheck = %d, want 1 for non-200", got)
	}
}

func TestRunHealthcheckUnreachable(t *testing.T) {
	// Start a server only to obtain a free port, then close it so the port is
	// no longer reachable.
	server := httptest.NewServer(http.NotFoundHandler())
	closedAddr := server.Listener.Addr().String()
	server.Close()

	if got := runHealthcheck(closedAddr, nil); got != 1 {
		t.Errorf("runHealthcheck = %d, want 1 for unreachable server", got)
	}
}
