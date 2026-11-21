// Package config loads the BFF runtime configuration from environment
// variables and optional secret files.
package config

import (
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
const envSessionKey = "BFF_SESSION_KEY"
const envSessionKeyFile = "BFF_SESSION_KEY_FILE"
const envSessionKeyPrevious = "BFF_SESSION_KEY_PREVIOUS"
const envGitHubWebURL = "BFF_GITHUB_WEB_URL"
const envGitHubAPIURL = "BFF_GITHUB_API_URL"

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
	// SessionKey is the current 32-byte session encryption key.
	SessionKey []byte
	// SessionKeyPrevious is the optional previous 32-byte session key used
	// during key rotation.
	SessionKeyPrevious []byte
	// GitHubWebURL is the base URL of the GitHub web frontend.
	GitHubWebURL string
	// GitHubAPIURL is the base URL of the GitHub REST API.
	GitHubAPIURL string
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

	cfg := Config{}
	cfg.Addr = defaultWhenEmpty(getenv(envAddr), defaultAddr)
	cfg.PublicOrigin = strings.TrimSpace(getenv(envPublicOrigin))
	cfg.StaticDir = defaultWhenEmpty(getenv(envStaticDir), defaultStaticDir)
	cfg.GitHubClientID = strings.TrimSpace(getenv(envGitHubClientID))
	cfg.GitHubAppSlug = strings.TrimSpace(getenv(envGitHubAppSlug))
	cfg.GitHubWebURL = defaultWhenEmpty(getenv(envGitHubWebURL), defaultGitHubWebURL)
	cfg.GitHubAPIURL = defaultWhenEmpty(getenv(envGitHubAPIURL), defaultGitHubAPIURL)

	required := []string{envPublicOrigin, envGitHubClientID, envGitHubAppSlug}
	for _, name := range required {
		if strings.TrimSpace(getenv(name)) == "" {
			problems = append(problems, fmt.Sprintf("%s is required", name))
		}
	}

	secret, secretProblem := loadSecret(getenv, readFile, envGitHubClientSecret, envGitHubClientSecretFile)
	if secretProblem != "" {
		problems = append(problems, secretProblem)
	} else if secret == "" {
		problems = append(problems, fmt.Sprintf("%s is required", envGitHubClientSecret))
	}
	cfg.GitHubClientSecret = secret

	sessionKey, keyProblem := loadSecret(getenv, readFile, envSessionKey, envSessionKeyFile)
	if keyProblem != "" {
		problems = append(problems, keyProblem)
	} else if sessionKey == "" {
		problems = append(problems, fmt.Sprintf("%s is required", envSessionKey))
	} else {
		decoded, err := decodeSessionKey(envSessionKey, sessionKey, true)
		if err != nil {
			problems = append(problems, err.Error())
		} else {
			cfg.SessionKey = decoded
		}
	}

	previous, previousProblem := loadSecret(getenv, readFile, envSessionKeyPrevious, "")
	if previousProblem != "" {
		problems = append(problems, previousProblem)
	} else if previous != "" {
		decoded, err := decodeSessionKey(envSessionKeyPrevious, previous, false)
		if err != nil {
			problems = append(problems, err.Error())
		} else {
			cfg.SessionKeyPrevious = decoded
		}
	}

	if len(problems) > 0 {
		return Config{}, fmt.Errorf("%s", strings.Join(problems, "; "))
	}
	return cfg, nil
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
