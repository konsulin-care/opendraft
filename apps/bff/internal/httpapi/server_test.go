package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
)

// newServer builds the full BFF handler for a configuration with static files
// served from a temporary directory containing the index marker.
func newServer(t *testing.T, version string) http.Handler {
	t.Helper()

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(indexMarker), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}

	cfg := config.Config{StaticDir: dir}
	deps := Deps{Version: version, Now: func() time.Time { return time.Unix(0, 0) }}
	return New(cfg, deps)
}

// decodeJSON decodes the recorder body into a generic JSON object.
func decodeJSON(t *testing.T, rec *httptest.ResponseRecorder) map[string]string {
	t.Helper()

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode JSON body %q: %v", rec.Body.String(), err)
	}
	return body
}

func TestHealthEndpoint(t *testing.T) {
	handler := newServer(t, testVersion)

	rec := getStatic(handler, "/@api/health")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/json") {
		t.Errorf("Content-Type = %q, want application/json", got)
	}

	body := decodeJSON(t, rec)
	if body["status"] != "ok" {
		t.Errorf("status field = %q, want ok", body["status"])
	}
	if body["version"] != testVersion {
		t.Errorf("version field = %q, want %s", body["version"], testVersion)
	}
}

func TestUnknownAPIPathReturnsJSONNotFound(t *testing.T) {
	handler := newServer(t, testVersion)

	for _, target := range []string{"/@api/unknown", "/@api", "/@api/auth/nope"} {
		rec := getStatic(handler, target)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s status = %d, want 404", target, rec.Code)
			continue
		}
		if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/json") {
			t.Errorf("%s Content-Type = %q, want application/json", target, got)
		}
		body := decodeJSON(t, rec)
		if body[errorKey] != "not_found" {
			t.Errorf("%s error field = %q, want not_found", target, body[errorKey])
		}
		if strings.Contains(rec.Body.String(), indexMarker) {
			t.Errorf("%s served index.html instead of the API error", target)
		}
	}
}

func TestRootServesStaticIndex(t *testing.T) {
	handler := newServer(t, testVersion)

	rec := getStatic(handler, "/")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Body.String(); got != indexMarker {
		t.Errorf("body = %q, want index marker", got)
	}
}

func TestStaticDisabledServesNoIndex(t *testing.T) {
	handler := New(config.Config{}, Deps{Version: testVersion})

	rec := getStatic(handler, "/")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 when static is disabled", rec.Code)
	}
}
