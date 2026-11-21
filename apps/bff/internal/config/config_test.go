package config

import (
	"encoding/base64"
	"errors"
	"strings"
	"testing"
)

// fakeEnv builds a getenv function backed by a map.
func fakeEnv(values map[string]string) func(string) string {
	return func(name string) string {
		return values[name]
	}
}

// validSessionKey returns base64 of a 32-byte session key.
func validSessionKey(fill byte) string {
	key := make([]byte, 32)
	for i := range key {
		key[i] = fill + byte(i)
	}
	return base64.StdEncoding.EncodeToString(key)
}

// requiredEnv returns an environment with every required variable set.
func requiredEnv() map[string]string {
	env := map[string]string{}
	env["BFF_PUBLIC_ORIGIN"] = "https://publish.example.test"
	env["BFF_GITHUB_CLIENT_ID"] = "client-id"
	env["BFF_GITHUB_CLIENT_SECRET"] = "client-secret"
	env["BFF_GITHUB_APP_SLUG"] = "opendraft"
	env["BFF_SESSION_KEY"] = validSessionKey(2)
	return env
}

// TestLoadReportsEveryMissingRequiredVariable asserts that one error names all
// required variables when none are configured.
func TestLoadReportsEveryMissingRequiredVariable(t *testing.T) {
	_, err := Load(fakeEnv(nil), nil)
	if err == nil {
		t.Fatal("Load returned nil error for empty environment")
	}
	message := err.Error()
	for _, name := range []string{
		"BFF_PUBLIC_ORIGIN",
		"BFF_GITHUB_CLIENT_ID",
		"BFF_GITHUB_CLIENT_SECRET",
		"BFF_GITHUB_APP_SLUG",
		"BFF_SESSION_KEY",
	} {
		if !strings.Contains(message, name) {
			t.Errorf("error %q does not name missing variable %s", message, name)
		}
	}
}

// TestLoadReadsSecretFiles asserts that the _FILE variants supply the client
// secret and session key when the plain variables are empty.
func TestLoadReadsSecretFiles(t *testing.T) {
	sessionKey := validSessionKey(1)
	files := map[string]string{}
	files["/run/secrets/client-secret"] = "  file-client-secret\n"
	files["/run/secrets/session-key"] = sessionKey + "\n"
	env := map[string]string{}
	env["BFF_PUBLIC_ORIGIN"] = "https://publish.example.test"
	env["BFF_GITHUB_CLIENT_ID"] = "client-id"
	env["BFF_GITHUB_CLIENT_SECRET_FILE"] = "/run/secrets/client-secret"
	env["BFF_GITHUB_APP_SLUG"] = "opendraft"
	env["BFF_SESSION_KEY_FILE"] = "/run/secrets/session-key"
	readFile := func(path string) ([]byte, error) {
		value, ok := files[path]
		if !ok {
			return nil, errors.New("not found")
		}
		return []byte(value), nil
	}

	cfg, err := Load(fakeEnv(env), readFile)
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if cfg.GitHubClientSecret != "file-client-secret" {
		t.Errorf("GitHubClientSecret = %q, want file value", cfg.GitHubClientSecret)
	}
	decoded, err := base64.StdEncoding.DecodeString(sessionKey)
	if err != nil {
		t.Fatalf("test session key does not decode: %v", err)
	}
	if string(cfg.SessionKey) != string(decoded) {
		t.Errorf("SessionKey = %v, want file key", cfg.SessionKey)
	}
	if got, want := cfg.CallbackURL(), "https://publish.example.test/@api/auth/callback"; got != want {
		t.Errorf("CallbackURL() = %q, want %q", got, want)
	}
}

// assertInvalidSessionKey asserts that Load rejects the given session keys and
// names want in the error.
func assertInvalidSessionKey(t *testing.T, current, previous, want string) {
	t.Helper()
	env := requiredEnv()
	env["BFF_SESSION_KEY"] = current
	env["BFF_SESSION_KEY_PREVIOUS"] = previous
	_, err := Load(fakeEnv(env), nil)
	if err == nil {
		t.Fatal("Load returned nil error for invalid session key")
	}
	if !strings.Contains(err.Error(), want) {
		t.Errorf("error %q does not name %s", err, want)
	}
}

// TestLoadRejectsInvalidSessionKeys asserts that current and previous session
// keys must decode to exactly 32 bytes.
func TestLoadRejectsInvalidSessionKeys(t *testing.T) {
	shortKey := base64.StdEncoding.EncodeToString([]byte("too-short"))
	t.Run("current invalid base64", func(t *testing.T) {
		assertInvalidSessionKey(t, "not base64!", "", "BFF_SESSION_KEY")
	})
	t.Run("current wrong length", func(t *testing.T) {
		assertInvalidSessionKey(t, shortKey, "", "BFF_SESSION_KEY")
	})
	t.Run("previous invalid base64", func(t *testing.T) {
		assertInvalidSessionKey(t, validSessionKey(2), "not base64!", "BFF_SESSION_KEY_PREVIOUS")
	})
	t.Run("previous wrong length", func(t *testing.T) {
		assertInvalidSessionKey(t, validSessionKey(2), shortKey, "BFF_SESSION_KEY_PREVIOUS")
	})
}

// TestLoadAppliesDefaults asserts the optional settings fall back to their
// documented defaults.
func TestLoadAppliesDefaults(t *testing.T) {
	cfg, err := Load(fakeEnv(requiredEnv()), nil)
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if cfg.Addr != ":8080" {
		t.Errorf("Addr = %q, want :8080", cfg.Addr)
	}
	if cfg.StaticDir != "/srv/web" {
		t.Errorf("StaticDir = %q, want /srv/web", cfg.StaticDir)
	}
	if cfg.GitHubWebURL != "https://github.com" {
		t.Errorf("GitHubWebURL = %q, want https://github.com", cfg.GitHubWebURL)
	}
	if cfg.GitHubAPIURL != "https://api.github.com" {
		t.Errorf("GitHubAPIURL = %q, want https://api.github.com", cfg.GitHubAPIURL)
	}
}
