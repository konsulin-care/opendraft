package config

import (
	"encoding/base64"
	"errors"
	"strings"
	"testing"
)

const (
	testPublicOrigin = "https://publish.example.test"
	testClientID     = "client-id"
	testClientSecret = "client-secret"
	testAppSlug      = "opendraft"
	testLoadError    = "Load returned error: %v"
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
	env[envPublicOrigin] = testPublicOrigin
	env[envGitHubClientID] = testClientID
	env[envGitHubClientSecret] = testClientSecret
	env[envGitHubAppSlug] = testAppSlug
	env[envSessionKey] = validSessionKey(2)
	return env
}

// assertPartialCredentials asserts that Load rejects env and that the error
// names every missing variable without naming any configured one.
func assertPartialCredentials(t *testing.T, env map[string]string, missing, configured []string) {
	t.Helper()
	_, err := Load(fakeEnv(env), nil)
	if err == nil {
		t.Fatal("Load returned nil error for partial credentials")
	}
	message := err.Error()
	for _, name := range missing {
		if !strings.Contains(message, name) {
			t.Errorf("error %q does not name missing variable %s", message, name)
		}
	}
	for _, name := range configured {
		if strings.Contains(message, name) {
			t.Errorf("error %q unexpectedly names configured variable %s", message, name)
		}
	}
}

// TestLoadAllowsAnonymousMode asserts that only BFF_PUBLIC_ORIGIN is always
// required and that an anonymous configuration has no session key.
func TestLoadAllowsAnonymousMode(t *testing.T) {
	cfg, err := Load(fakeEnv(map[string]string{
		envPublicOrigin: testPublicOrigin,
	}), nil)
	if err != nil {
		t.Fatalf(testLoadError, err)
	}
	if cfg.LoginEnabled {
		t.Error("LoginEnabled = true, want false")
	}
	if len(cfg.SessionKey) != 0 {
		t.Errorf("SessionKey = %v, want empty", cfg.SessionKey)
	}
}

// TestLoadReportsPartialCredentials asserts that a partial credential set
// fails and names only the variables that are left unset.
func TestLoadReportsPartialCredentials(t *testing.T) {
	t.Run("only client id", func(t *testing.T) {
		env := map[string]string{
			envPublicOrigin:       testPublicOrigin,
			envGitHubClientID:     testClientID,
			envSessionKeyPrevious: validSessionKey(3),
		}
		assertPartialCredentials(t, env,
			[]string{envGitHubClientSecret, envGitHubAppSlug},
			[]string{envGitHubClientID, envPublicOrigin, envSessionKey})
	})

	t.Run("secret and slug", func(t *testing.T) {
		env := map[string]string{
			envPublicOrigin:       testPublicOrigin,
			envGitHubClientSecret: testClientSecret,
			envGitHubAppSlug:      testAppSlug,
		}
		assertPartialCredentials(t, env,
			[]string{envGitHubClientID},
			[]string{envGitHubClientSecret, envGitHubAppSlug, envSessionKey})
	})
}

// TestLoadRequiresSessionKeyWhenLoginEnabled asserts that complete credentials
// enable login and require a valid session key.
func TestLoadRequiresSessionKeyWhenLoginEnabled(t *testing.T) {
	env := requiredEnv()
	delete(env, envSessionKey)
	_, err := Load(fakeEnv(env), nil)
	if err == nil {
		t.Fatal("Load returned nil error without a session key")
	}
	if !strings.Contains(err.Error(), envSessionKey) {
		t.Errorf("error %q does not name %s", err, envSessionKey)
	}

	cfg, err := Load(fakeEnv(requiredEnv()), nil)
	if err != nil {
		t.Fatalf(testLoadError, err)
	}
	if !cfg.LoginEnabled {
		t.Error("LoginEnabled = false, want true")
	}
	if len(cfg.SessionKey) != 32 {
		t.Errorf("SessionKey length = %d, want 32", len(cfg.SessionKey))
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
	env[envPublicOrigin] = testPublicOrigin
	env[envGitHubClientID] = testClientID
	env[envGitHubClientSecretFile] = "/run/secrets/client-secret"
	env[envGitHubAppSlug] = testAppSlug
	env[envSessionKeyFile] = "/run/secrets/session-key"
	readFile := func(path string) ([]byte, error) {
		value, ok := files[path]
		if !ok {
			return nil, errors.New("not found")
		}
		return []byte(value), nil
	}

	cfg, err := Load(fakeEnv(env), readFile)
	if err != nil {
		t.Fatalf(testLoadError, err)
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
	if got, want := cfg.CallbackURL(), testPublicOrigin+"/@api/auth/callback"; got != want {
		t.Errorf("CallbackURL() = %q, want %q", got, want)
	}
}

// assertInvalidSessionKey asserts that Load rejects the given session keys and
// names want in the error.
func assertInvalidSessionKey(t *testing.T, current, previous, want string) {
	t.Helper()
	env := requiredEnv()
	env[envSessionKey] = current
	env[envSessionKeyPrevious] = previous
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
		assertInvalidSessionKey(t, "not base64!", "", envSessionKey)
	})
	t.Run("current wrong length", func(t *testing.T) {
		assertInvalidSessionKey(t, shortKey, "", envSessionKey)
	})
	t.Run("previous invalid base64", func(t *testing.T) {
		assertInvalidSessionKey(t, validSessionKey(2), "not base64!", envSessionKeyPrevious)
	})
	t.Run("previous wrong length", func(t *testing.T) {
		assertInvalidSessionKey(t, validSessionKey(2), shortKey, envSessionKeyPrevious)
	})
}

// TestLoadAppliesDefaults asserts the optional settings fall back to their
// documented defaults.
func TestLoadAppliesDefaults(t *testing.T) {
	cfg, err := Load(fakeEnv(requiredEnv()), nil)
	if err != nil {
		t.Fatalf(testLoadError, err)
	}
	if cfg.Addr != defaultAddr {
		t.Errorf("Addr = %q, want %s", cfg.Addr, defaultAddr)
	}
	if cfg.StaticDir != defaultStaticDir {
		t.Errorf("StaticDir = %q, want %s", cfg.StaticDir, defaultStaticDir)
	}
	if cfg.GitHubWebURL != defaultGitHubWebURL {
		t.Errorf("GitHubWebURL = %q, want %s", cfg.GitHubWebURL, defaultGitHubWebURL)
	}
	if cfg.GitHubAPIURL != defaultGitHubAPIURL {
		t.Errorf("GitHubAPIURL = %q, want %s", cfg.GitHubAPIURL, defaultGitHubAPIURL)
	}
}
