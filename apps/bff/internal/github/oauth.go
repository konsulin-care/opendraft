// Package github implements the narrow GitHub API surface the BFF needs:
// GitHub App OAuth (authorization code + PKCE), token refresh and install URLs.
// It never proxies arbitrary GitHub requests.
package github

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Tokens is the result of an OAuth code exchange or refresh.
type Tokens struct {
	// AccessExpiresAt is when AccessToken stops working.
	AccessExpiresAt time.Time
	// RefreshExpiresAt is when RefreshToken stops working.
	RefreshExpiresAt time.Time
	// AccessToken is the GitHub App user access token.
	AccessToken string
	// RefreshToken is the token used to obtain a new access token.
	RefreshToken string
}

// Client talks to one GitHub deployment. WebURL and APIURL are configurable so
// tests can point the client at a fake server.
type Client struct {
	// HTTP is the HTTP client used for OAuth requests. Nil means
	// http.DefaultClient.
	HTTP *http.Client
	// Now returns the current time. Nil means time.Now.
	Now func() time.Time
	// WebURL is the base URL of the GitHub web frontend.
	WebURL string
	// APIURL is the base URL of the GitHub REST API.
	APIURL string
	// ClientID is the OAuth client id of the GitHub App.
	ClientID string
	// ClientSecret is the OAuth client secret of the GitHub App.
	ClientSecret string
	// AppKey is the optional GitHub App private key. Nil disables
	// app-authenticated calls.
	AppKey *rsa.PrivateKey
	// appToken caches the minted app JWT until it nears expiry.
	appToken appTokenCache
}

// accessTokenResponse mirrors GitHub's JSON answer to an OAuth token request.
// GitHub answers HTTP 200 even for failures, carrying an "error" field instead.
type accessTokenResponse struct {
	AccessToken           string `json:"access_token"`
	RefreshToken          string `json:"refresh_token"`
	TokenType             string `json:"token_type"`
	Error                 string `json:"error"`
	ErrorDescription      string `json:"error_description"`
	ExpiresIn             int64  `json:"expires_in"`
	RefreshTokenExpiresIn int64  `json:"refresh_token_expires_in"`
}

// oauthClientIDKey is the OAuth form field carrying the client id.
const oauthClientIDKey = "client_id"

// ErrOAuth is returned when GitHub answers an OAuth request with an error
// field. It wraps the GitHub error code but never includes token values.
var ErrOAuth = errors.New("github: oauth error")

// ErrUnverifiedEmail is returned when GitHub refuses a token because the
// account's primary email address is not verified. It is wrapped with ErrOAuth
// so callers can treat it as a specific OAuth failure.
var ErrUnverifiedEmail = errors.New("github: unverified user email")

// NewPKCE returns a fresh PKCE verifier and its S256 challenge. The verifier
// is 32 random bytes encoded as unpadded base64url; the challenge is the
// unpadded base64url SHA-256 of the verifier.
func NewPKCE() (verifier string, challenge string) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		// crypto/rand failing is unrecoverable; fall back to the zero vector
		// rather than panicking so callers can still handle a failed flow.
		for i := range raw {
			raw[i] = 0
		}
	}
	verifier = base64.RawURLEncoding.EncodeToString(raw)
	sum := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(sum[:])
	return verifier, challenge
}

// AuthorizeURL builds the GitHub App authorization URL. The client secret is
// never part of it.
func (c *Client) AuthorizeURL(redirectURI, state, challenge string) string {
	query := url.Values{}
	query.Set(oauthClientIDKey, c.ClientID)
	query.Set("redirect_uri", redirectURI)
	query.Set("state", state)
	query.Set("code_challenge", challenge)
	query.Set("code_challenge_method", "S256")
	return c.WebURL + "/login/oauth/authorize?" + query.Encode()
}

// InstallURL builds the GitHub App installation URL for slug.
func (c *Client) InstallURL(slug, state string) string {
	query := url.Values{}
	query.Set("state", state)
	return c.WebURL + "/apps/" + url.PathEscape(slug) + "/installations/new?" + query.Encode()
}

// ExchangeCode exchanges an authorization code for tokens using the PKCE
// verifier. It returns an error when GitHub reports one.
func (c *Client) ExchangeCode(ctx context.Context, code, verifier, redirectURI string) (Tokens, error) {
	form := url.Values{}
	form.Set(oauthClientIDKey, c.ClientID)
	form.Set("client_secret", c.ClientSecret)
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("code_verifier", verifier)
	return c.requestTokens(ctx, form)
}

// Refresh exchanges a refresh token for a new pair of tokens. It returns an
// error when GitHub reports one.
func (c *Client) Refresh(ctx context.Context, refreshToken string) (Tokens, error) {
	form := url.Values{}
	form.Set(oauthClientIDKey, c.ClientID)
	form.Set("client_secret", c.ClientSecret)
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", refreshToken)
	return c.requestTokens(ctx, form)
}

// requestTokens POSTs form to the OAuth access-token endpoint and converts the
// response into Tokens, deriving expiries from Now.
func (c *Client) requestTokens(ctx context.Context, form url.Values) (Tokens, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.WebURL+"/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return Tokens{}, fmt.Errorf("github: build oauth request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return Tokens{}, fmt.Errorf("github: oauth request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Tokens{}, fmt.Errorf("github: read oauth response: %w", err)
	}

	var parsed accessTokenResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return Tokens{}, fmt.Errorf("github: decode oauth response: %w", err)
	}
	if parsed.Error != "" {
		if parsed.Error == "unverified_user_email" {
			return Tokens{}, fmt.Errorf("%w: %w: %s", ErrOAuth, ErrUnverifiedEmail, parsed.Error)
		}
		return Tokens{}, fmt.Errorf("%w: %s", ErrOAuth, parsed.Error)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return Tokens{}, fmt.Errorf("github: oauth status %d", resp.StatusCode)
	}
	if parsed.AccessToken == "" {
		return Tokens{}, fmt.Errorf("%w: missing access token", ErrOAuth)
	}

	now := c.now()
	return Tokens{
		AccessToken:      parsed.AccessToken,
		AccessExpiresAt:  now.Add(time.Duration(parsed.ExpiresIn) * time.Second),
		RefreshToken:     parsed.RefreshToken,
		RefreshExpiresAt: now.Add(time.Duration(parsed.RefreshTokenExpiresIn) * time.Second),
	}, nil
}

// httpClient returns the configured HTTP client or the default one.
func (c *Client) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}

// now returns the configured clock or the wall clock.
func (c *Client) now() time.Time {
	if c.Now != nil {
		return c.Now()
	}
	return time.Now()
}
