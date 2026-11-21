package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const indexMarker = "<!doctype html><title>opendraft</title>"

// newStaticFixture creates a static directory with an index page and a few
// root and asset files, returning the directory path.
func newStaticFixture(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	files := map[string]string{
		"index.html":             indexMarker,
		"favicon.ico":            "favicon-bytes",
		"sw.js":                  "self.addEventListener('install', () => {});",
		"manifest.webmanifest":   `{"name":"opendraft"}`,
		"robots.txt":             "User-agent: *",
		"assets/app-abc123.js":   "console.log('asset');",
		"assets/app-abc123.css":  "body{color:red}",
		"assets/nested/deep.css": "main{color:blue}",
		"@assets/legacy.js":      "console.log('legacy');",
	}
	for name, content := range files {
		path := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", path, err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}
	return dir
}

// assertSecurityHeaders checks the headers every static response must carry.
func assertSecurityHeaders(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()

	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("X-Content-Type-Options = %q, want nosniff", got)
	}
	if got := rec.Header().Get("Referrer-Policy"); got != "strict-origin-when-cross-origin" {
		t.Errorf("Referrer-Policy = %q, want strict-origin-when-cross-origin", got)
	}
	if got := rec.Header().Get("X-Frame-Options"); got != "DENY" {
		t.Errorf("X-Frame-Options = %q, want DENY", got)
	}
}

// getStatic issues a GET request against handler and returns the recorder.
func getStatic(handler http.Handler, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
	return rec
}

func TestStaticHandlerAssets(t *testing.T) {
	handler := NewStaticHandler(newStaticFixture(t))

	rec := getStatic(handler, "/@assets/app-abc123.js")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Body.String(); got != "console.log('asset');" {
		t.Errorf("body = %q, want asset contents", got)
	}
	if got := rec.Header().Get("Cache-Control"); got != cacheImmutable {
		t.Errorf("Cache-Control = %q, want %q", got, cacheImmutable)
	}
	assertSecurityHeaders(t, rec)

	nested := getStatic(handler, "/@assets/nested/deep.css")
	if nested.Code != http.StatusOK {
		t.Fatalf("nested asset status = %d, want 200", nested.Code)
	}

	legacy := getStatic(handler, "/@assets/legacy.js")
	if legacy.Code != http.StatusOK {
		t.Fatalf("@assets layout status = %d, want 200", legacy.Code)
	}

	missing := getStatic(handler, "/@assets/missing.js")
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing asset status = %d, want 404", missing.Code)
	}
	if strings.Contains(missing.Body.String(), indexMarker) {
		t.Error("missing asset served index.html instead of 404")
	}
	if got := missing.Header().Get("Cache-Control"); got != cacheImmutable {
		t.Errorf("missing asset Cache-Control = %q, want %q", got, cacheImmutable)
	}
	assertSecurityHeaders(t, missing)
}

func TestStaticHandlerRootFiles(t *testing.T) {
	handler := NewStaticHandler(newStaticFixture(t))

	cases := map[string]string{
		"/favicon.ico":          "favicon-bytes",
		"/sw.js":                "self.addEventListener('install', () => {});",
		"/manifest.webmanifest": `{"name":"opendraft"}`,
		"/robots.txt":           "User-agent: *",
	}
	for target, want := range cases {
		rec := getStatic(handler, target)
		if rec.Code != http.StatusOK {
			t.Errorf("%s status = %d, want 200", target, rec.Code)
			continue
		}
		if got := rec.Body.String(); got != want {
			t.Errorf("%s body = %q, want %q", target, got, want)
		}
		if got := rec.Header().Get("Cache-Control"); got != cacheRevalidate {
			t.Errorf("%s Cache-Control = %q, want %q", target, got, cacheRevalidate)
		}
		assertSecurityHeaders(t, rec)
	}
}

func TestStaticHandlerMissingRootFile(t *testing.T) {
	handler := NewStaticHandler(newStaticFixture(t))

	for _, target := range []string{"/missing.js", "/nope.ico"} {
		rec := getStatic(handler, target)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s status = %d, want 404", target, rec.Code)
		}
		if strings.Contains(rec.Body.String(), indexMarker) {
			t.Errorf("%s served index.html instead of 404", target)
		}
		assertSecurityHeaders(t, rec)
	}
}

func TestStaticHandlerTraversal(t *testing.T) {
	dir := newStaticFixture(t)
	if err := os.WriteFile(filepath.Join(filepath.Dir(dir), "secret.txt"), []byte("secret"), 0o644); err != nil {
		t.Fatalf("write secret: %v", err)
	}
	handler := NewStaticHandler(dir)

	for _, target := range []string{
		"/../secret.txt",
		"/@assets/../../etc/passwd",
		"/@assets/../secret.txt",
		"/@assets/../index.html",
		"/..%2fetc/passwd",
	} {
		rec := getStatic(handler, target)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s status = %d, want 404", target, rec.Code)
		}
		if strings.Contains(rec.Body.String(), "secret") || strings.Contains(rec.Body.String(), indexMarker) {
			t.Errorf("%s escaped the static dir or fell back to index.html", target)
		}
		assertSecurityHeaders(t, rec)
	}
}

func TestStaticHandlerSPAFallback(t *testing.T) {
	handler := NewStaticHandler(newStaticFixture(t))

	for _, target := range []string{
		"/",
		"/konsulin-care/citizen-science",
		"/konsulin-care/citizen-science/tree/main",
		"/o/r/tree/feature%2Fbranch",
		"/a/b/blob/main/README.md/",
	} {
		rec := getStatic(handler, target)
		if rec.Code != http.StatusOK {
			t.Errorf("%s status = %d, want 200", target, rec.Code)
			continue
		}
		if got := rec.Body.String(); got != indexMarker {
			t.Errorf("%s body = %q, want index.html", target, got)
		}
		if got := rec.Header().Get("Cache-Control"); got != cacheRevalidate {
			t.Errorf("%s Cache-Control = %q, want %q", target, got, cacheRevalidate)
		}
		assertSecurityHeaders(t, rec)
	}
}

func TestStaticHandlerMethodNotAllowed(t *testing.T) {
	handler := NewStaticHandler(newStaticFixture(t))

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(method, "/", nil))
		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s status = %d, want 405", method, rec.Code)
		}
		if got := rec.Header().Get("Allow"); got != "GET, HEAD" {
			t.Errorf("%s Allow = %q, want GET, HEAD", method, got)
		}
		assertSecurityHeaders(t, rec)
	}
}

func TestStaticHandlerHead(t *testing.T) {
	handler := NewStaticHandler(newStaticFixture(t))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodHead, "/@assets/app-abc123.js", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("HEAD status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != cacheImmutable {
		t.Errorf("HEAD Cache-Control = %q, want %q", got, cacheImmutable)
	}
	assertSecurityHeaders(t, rec)
}

func TestStaticHandlerIndexMissing(t *testing.T) {
	handler := NewStaticHandler(t.TempDir())

	rec := getStatic(handler, "/")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 when index.html is absent", rec.Code)
	}
	assertSecurityHeaders(t, rec)
}
