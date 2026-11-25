// Package config loads the BFF runtime configuration from environment
// variables and optional secret files.
package config

import (
	"crypto/rsa"
	"encoding/base64"
	"fmt"
	"strings"
)

const defaultAddr = ":8080"
const defaultStaticDir = "/srv/web"
const defaultGitHubWebURL = "https://github.com"
const defaultGitHubAPIURL = "https://api.github.com"
const sessionKeySize = 32
const callbackPath = "/@api/auth/callback"
const envAddr = "BFF_ADDR"
const envPublicOrigin = "BFF_PUBLIC_ORIGIN"
const envStaticDir = "BFF_STATIC_DIR"
const envGitHubClientID = "BFF_GITHUB_CLIENT_ID"
const envGitHubClientSecret = "BFF_GITHUB_CLIENT_SECRET"
const envGitHubClientSecretFile = "BFF_GITHUB_CLIENT_SECRET_FILE"
const envGitHubAppSlug = "BFF_GITHUB_APP_SLUG"
const envGitHubAppPrivateKey = "BFF_GITHUB_APP_PRIVATE_KEY"
const envSessionKey = "BFF_SESSION_KEY"
const envSessionKeyFile = "BFF_SESSION_KEY_FILE"
const envSessionKeyPrevious = "BFF_SESSION_KEY_PREVIOUS"
const envGitHubWebURL = "BFF_GITHUB_WEB_URL"
const envGitHubAPIURL = "BFF_GITHUB_API_URL"
const requiredFormat = "%s is required"

// Config holds the validated configuration of the BFF service.
type Config struct {
	// Addr is the listen address of the HTTP server.
	Addr string
	// PublicOrigin is the externally visible origin, without a trailing slash.
	PublicOrigin string
	// StaticDir is the directory containing the built web app. An empty value
	// disables static file serving.
	StaticDir string
	// GitHubClientID is the OAuth client id of the GitHub App.
	GitHubClientID string
	// GitHubClientSecret is the OAuth client secret of the GitHub App.
	GitHubClientSecret string
	// GitHubAppSlug is the URL slug of the GitHub App.
	GitHubAppSlug string
	// GitHubAppPrivateKey is the optional RSA private key of the GitHub App.
	// When set it enables repo-level installation checks via an app JWT.
	GitHubAppPrivateKey *rsa.PrivateKey
	// GitHubWebURL is the base URL of the GitHub web frontend.
	GitHubWebURL string
	// GitHubAPIURL is the base URL of the GitHub REST API.
	GitHubAPIURL string
	// SessionKey is the current 32-byte session encryption key.
	SessionKey []byte
	// SessionKeyPrevious is the optional previous 32-byte session key used
	// during key rotation.
	SessionKeyPrevious []byte
	// LoginEnabled reports whether the GitHub App credentials are complete and
	// sign-in is therefore available. When false the BFF runs in anonymous,
	// read-only mode.
	LoginEnabled bool
}

// CallbackURL returns the public OAuth callback URL of the BFF.
func (c Config) CallbackURL() string {
	return c.PublicOrigin + callbackPath
}

// Load reads and validates configuration using getenv for environment
// variables and readFile for secret-file variants. It returns one error that
// names every missing or invalid required variable.
func Load(getenv func(string) string, readFile func(string) ([]byte, error)) (Config, error) {
	if getenv == nil {
		getenv = func(string) string { return "" }
	}
	if readFile == nil {
		readFile = func(string) ([]byte, error) {
			return nil, fmt.Errorf("no file reader configured")
		}
	}

	var problems []string
	cfg := applyDefaults(getenv)

	if cfg.PublicOrigin == "" {
		problems = append(problems, fmt.Sprintf(requiredFormat, envPublicOrigin))
	}

	cfg.GitHubClientSecret = loadClientSecret(getenv, readFile, &problems)
	cfg.GitHubAppPrivateKey = loadAppPrivateKey(getenv, &problems)
	cfg.LoginEnabled = checkPartialCredentials(credentialFields(cfg), &problems)
	cfg.SessionKey = loadCurrentSessionKey(getenv, readFile, cfg.LoginEnabled, &problems)
	cfg.SessionKeyPrevious = loadPreviousSessionKey(getenv, readFile, &problems)

	if len(problems) > 0 {
		return Config{}, fmt.Errorf("%s", strings.Join(problems, "; "))
	}
	return cfg, nil
}

// applyDefaults builds a Config from environment values, applying the
// documented defaults for optional settings.
func applyDefaults(getenv func(string) string) Config {
	return Config{
		Addr:           defaultWhenEmpty(getenv(envAddr), defaultAddr),
		PublicOrigin:   strings.TrimSpace(getenv(envPublicOrigin)),
		StaticDir:      defaultWhenEmpty(getenv(envStaticDir), defaultStaticDir),
		GitHubClientID: strings.TrimSpace(getenv(envGitHubClientID)),
		GitHubAppSlug:  strings.TrimSpace(getenv(envGitHubAppSlug)),
		GitHubWebURL:   defaultWhenEmpty(getenv(envGitHubWebURL), defaultGitHubWebURL),
		GitHubAPIURL:   defaultWhenEmpty(getenv(envGitHubAPIURL), defaultGitHubAPIURL),
	}
}

// credentialField records whether one GitHub App credential is set.
type credentialField struct {
	name string
	set  bool
}

// credentialFields lists the GitHub App credential variables and whether each
// is populated in cfg.
func credentialFields(cfg Config) []credentialField {
	return []credentialField{
		{envGitHubClientID, cfg.GitHubClientID != ""},
		{envGitHubClientSecret, cfg.GitHubClientSecret != ""},
		{envGitHubAppSlug, cfg.GitHubAppSlug != ""},
	}
}

// checkPartialCredentials reports whether all credentials are present. When
// only some are set it appends an error for every missing variable and returns
// false.
func checkPartialCredentials(fields []credentialField, problems *[]string) bool {
	configured := 0
	var missing []string
	for _, field := range fields {
		if field.set {
			configured++
			continue
		}
		missing = append(missing, field.name)
	}
	if configured == len(fields) {
		return true
	}
	if configured > 0 {
		for _, name := range missing {
			*problems = append(*problems, fmt.Sprintf(requiredFormat, name))
		}
	}
	return false
}

// loadClientSecret resolves the GitHub App client secret and appends a problem
// when its secret file cannot be read or is empty.
func loadClientSecret(getenv func(string) string, readFile func(string) ([]byte, error), problems *[]string) string {
	secret, problem := loadSecret(getenv, readFile, envGitHubClientSecret, envGitHubClientSecretFile)
	if problem != "" {
		*problems = append(*problems, problem)
	}
	return secret
}

// loadCurrentSessionKey resolves and decodes the current session key. When
// login is enabled an absent key is reported as required.
func loadCurrentSessionKey(getenv func(string) string, readFile func(string) ([]byte, error), loginEnabled bool, problems *[]string) []byte {
	key, problem := loadSessionKey(getenv, readFile, envSessionKey, envSessionKeyFile)
	if problem != "" {
		*problems = append(*problems, problem)
		return nil
	}
	if len(key) == 0 && loginEnabled {
		*problems = append(*problems, fmt.Sprintf(requiredFormat, envSessionKey))
	}
	return key
}

// loadPreviousSessionKey resolves and decodes the optional previous session
// key.
func loadPreviousSessionKey(getenv func(string) string, readFile func(string) ([]byte, error), problems *[]string) []byte {
	key, problem := loadSessionKey(getenv, readFile, envSessionKeyPrevious, "")
	if problem != "" {
		*problems = append(*problems, problem)
		return nil
	}
	return key
}

// loadSessionKey resolves a session key from the environment or its secret
// file and decodes it into its 32-byte form.
func loadSessionKey(getenv func(string) string, readFile func(string) ([]byte, error), env, fileEnv string) ([]byte, string) {
	secret, problem := loadSecret(getenv, readFile, env, fileEnv)
	if problem != "" {
		return nil, problem
	}
	if secret == "" {
		return nil, ""
	}
	decoded, err := decodeSessionKey(env, secret, false)
	if err != nil {
		return nil, err.Error()
	}
	return decoded, ""
}

// defaultWhenEmpty returns fallback when value is blank, otherwise the trimmed
// value.
func defaultWhenEmpty(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

// loadSecret resolves a value from the plain environment variable or, when it
// is empty, from the path named by fileEnv. The returned problem describes a
// file read failure or an empty secret file; an empty problem and empty value
// mean the variable is absent.
func loadSecret(getenv func(string) string, readFile func(string) ([]byte, error), env, fileEnv string) (string, string) {
	value := strings.TrimSpace(getenv(env))
	if value != "" {
		return value, ""
	}
	if fileEnv == "" {
		return "", ""
	}
	path := strings.TrimSpace(getenv(fileEnv))
	if path == "" {
		return "", ""
	}
	data, err := readFile(path)
	if err != nil {
		return "", fmt.Sprintf("%s: cannot read %s: %v", env, path, err)
	}
	value = strings.TrimSpace(string(data))
	if value == "" {
		return "", fmt.Sprintf("%s: file %s is empty", env, path)
	}
	return value, ""
}

// decodeSessionKey decodes a base64 session key and enforces the exact key
// size. current controls whether an empty value is reported as missing.
func decodeSessionKey(env, encoded string, current bool) ([]byte, error) {
	if encoded == "" {
		if current {
			return nil, fmt.Errorf("%s is required", env)
		}
		return nil, nil
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("%s: invalid base64: %v", env, err)
	}
	if len(decoded) != sessionKeySize {
		return nil, fmt.Errorf("%s: decoded key must be exactly %d bytes, got %d", env, sessionKeySize, len(decoded))
	}
	return decoded, nil
}
