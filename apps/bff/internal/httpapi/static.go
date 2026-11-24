// Package httpapi wires the HTTP routes of the BFF onto a single handler.
package httpapi

import (
	"io"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"strings"
)

func init() {
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
}

const (
	assetsPrefix    = "/@assets/"
	assetDirName    = "assets"
	cacheImmutable  = "public, max-age=31536000, immutable"
	cacheRevalidate = "no-cache"
	indexFile       = "index.html"
)

// NewStaticHandler returns a handler that serves the built web app from dir.
// Files under /@assets/ are cached immutably, root files whose first path
// segment contains a dot are served as-is, and every other path falls back to
// index.html. Invalid paths never escape dir and answer 404.
func NewStaticHandler(dir string) http.Handler {
	fsys := os.DirFS(dir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		setStaticSecurityHeaders(w)

		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		path := r.URL.Path
		if strings.HasPrefix(path, assetsPrefix) {
			w.Header().Set("Cache-Control", cacheImmutable)
			serveAsset(w, r, fsys, strings.TrimPrefix(path, assetsPrefix))
			return
		}

		w.Header().Set("Cache-Control", cacheRevalidate)
		name := strings.TrimPrefix(path, "/")
		if firstSegmentHasDot(name) {
			if !serveStaticFile(w, r, fsys, name) {
				http.NotFound(w, r)
			}
			return
		}

		if !serveStaticFile(w, r, fsys, indexFile) {
			http.NotFound(w, r)
		}
	})
}

// setStaticSecurityHeaders applies the headers every static response carries.
func setStaticSecurityHeaders(w http.ResponseWriter) {
	header := w.Header()
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	header.Set("X-Frame-Options", "DENY")
}

// firstSegmentHasDot reports whether the first path segment of name contains a
// dot, which marks a root file such as /favicon.ico or /manifest.webmanifest.
func firstSegmentHasDot(name string) bool {
	segment, _, _ := strings.Cut(name, "/")
	return strings.Contains(segment, ".")
}

// serveAsset serves a hashed build asset. Vite emits assets into the assets
// directory while the URL namespace is /@assets/, so both layouts are tried.
func serveAsset(w http.ResponseWriter, r *http.Request, fsys fs.FS, name string) {
	for _, candidate := range []string{assetDirName + "/" + name, assetsPrefix[1:] + name} {
		if serveStaticFile(w, r, fsys, candidate) {
			return
		}
	}
	http.NotFound(w, r)
}

// serveStaticFile serves the named file from fsys and reports whether it wrote
// a response. Invalid names, missing files, and directories are not served.
func serveStaticFile(w http.ResponseWriter, r *http.Request, fsys fs.FS, name string) bool {
	if name == "" || name == "." || !fs.ValidPath(name) {
		return false
	}

	file, err := fsys.Open(name)
	if err != nil {
		return false
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil || info.IsDir() {
		return false
	}

	seeker, ok := file.(io.ReadSeeker)
	if !ok {
		return false
	}

	http.ServeContent(w, r, name, info.ModTime(), seeker)
	return true
}
