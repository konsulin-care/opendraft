package logging

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestRequestLoggerLogsPathWithoutQuery checks the logged fields and that the
// query string is absent from the output.
func TestRequestLoggerLogsPathWithoutQuery(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	handler := RequestLogger(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))

	request := httptest.NewRequest(http.MethodGet, "/@api/auth/callback?code=abc123&state=xyz", nil)
	handler.ServeHTTP(httptest.NewRecorder(), request)

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("decode log line %q: %v", buf.String(), err)
	}
	if entry["method"] != http.MethodGet {
		t.Errorf("method = %v, want GET", entry["method"])
	}
	if entry["path"] != "/@api/auth/callback" {
		t.Errorf("path = %v, want /@api/auth/callback", entry["path"])
	}
	if status, ok := entry["status"].(float64); !ok || int(status) != http.StatusCreated {
		t.Errorf("status = %v, want %d", entry["status"], http.StatusCreated)
	}
	if _, ok := entry["duration_ms"]; !ok {
		t.Errorf("duration_ms missing from log entry")
	}
	if strings.Contains(buf.String(), "abc123") || strings.Contains(buf.String(), "xyz") {
		t.Errorf("query string leaked into log: %s", buf.String())
	}
}

// TestRequestLoggerDefaultsToOKStatus checks the status when the handler never
// writes a header.
func TestRequestLoggerDefaultsToOKStatus(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	handler := RequestLogger(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/health", nil))

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("decode log line %q: %v", buf.String(), err)
	}
	if status, ok := entry["status"].(float64); !ok || int(status) != http.StatusOK {
		t.Errorf("status = %v, want %d", entry["status"], http.StatusOK)
	}
}
