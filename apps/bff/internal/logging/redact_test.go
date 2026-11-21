package logging

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
)

// logJSON runs a log call through the redacting handler and decodes the single
// JSON line it produces.
func logJSON(t *testing.T, logFn func(logger *slog.Logger)) map[string]any {
	t.Helper()
	var buf bytes.Buffer
	logger := slog.New(NewRedactingHandler(slog.NewJSONHandler(&buf, nil)))
	logFn(logger)
	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("decode log line %q: %v", buf.String(), err)
	}
	return entry
}

// TestSensitiveKeysAreRedacted checks that attributes naming sensitive fields
// are replaced, including inside nested groups.
func TestSensitiveKeysAreRedacted(t *testing.T) {
	keys := []string{
		"token", "access_token", "CLIENT_SECRET", "code", "state",
		"code_verifier", "Authorization", "Cookie", "password",
	}
	entry := logJSON(t, func(logger *slog.Logger) {
		attrs := make([]any, 0, len(keys))
		for _, key := range keys {
			attrs = append(attrs, slog.String(key, "original-value"))
		}
		logger.Info("test", attrs...)
	})

	for _, key := range keys {
		value, ok := entry[key]
		if !ok {
			t.Fatalf("key %q missing from log entry", key)
		}
		if value != redacted {
			t.Errorf("%s = %v, want %s", key, value, redacted)
		}
	}
}

// TestSensitiveKeysInsideGroupsAreRedacted checks nested group members.
func TestSensitiveKeysInsideGroupsAreRedacted(t *testing.T) {
	entry := logJSON(t, func(logger *slog.Logger) {
		logger.Info("test", slog.Group("outer",
			slog.String("token", "secret-value"),
			slog.Group("inner", slog.String("state", "abc")),
			slog.String("safe", "kept"),
		))
	})

	outer, ok := entry["outer"].(map[string]any)
	if !ok {
		t.Fatalf("outer group missing or not an object: %v", entry["outer"])
	}
	if outer["token"] != redacted {
		t.Errorf("outer.token = %v, want %s", outer["token"], redacted)
	}
	inner, ok := outer["inner"].(map[string]any)
	if !ok {
		t.Fatalf("inner group missing or not an object: %v", outer["inner"])
	}
	if inner["state"] != redacted {
		t.Errorf("outer.inner.state = %v, want %s", inner["state"], redacted)
	}
	if outer["safe"] != "kept" {
		t.Errorf("outer.safe = %v, want kept", outer["safe"])
	}
}

// TestGitHubTokenValuesAreRedacted checks token-shaped strings under any key.
func TestGitHubTokenValuesAreRedacted(t *testing.T) {
	tokens := []string{
		"gho_abcdefghijklmnop",
		"ghu_abcdefghijklmnop",
		"ghr_abcdefghijklmnop",
		"ghs_abcdefghijklmnop",
		"ghp_abcdefghijklmnop",
		"github_pat_11ABCDEFG_abcdefghijklmnop",
	}
	for _, token := range tokens {
		token := token
		t.Run(token[:4], func(t *testing.T) {
			entry := logJSON(t, func(logger *slog.Logger) {
				logger.Info("test", slog.String("message", "prefix "+token+" suffix"))
			})
			if entry["message"] != redacted {
				t.Errorf("message = %v, want %s", entry["message"], redacted)
			}
			if strings.Contains(entry["message"].(string), token) {
				t.Errorf("token leaked in %v", entry["message"])
			}
		})
	}
}

// TestWithAttrsAreRedacted checks attributes attached via WithAttrs.
func TestWithAttrsAreRedacted(t *testing.T) {
	entry := logJSON(t, func(logger *slog.Logger) {
		logger.With(slog.String("secret", "value")).Info("test")
	})
	if entry["secret"] != redacted {
		t.Errorf("secret = %v, want %s", entry["secret"], redacted)
	}
}
