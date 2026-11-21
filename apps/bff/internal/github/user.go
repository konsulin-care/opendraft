package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// User is the GitHub identity of the authenticated user.
type User struct {
	// Login is the GitHub handle.
	Login string `json:"login"`
	// Name is the display name, possibly empty.
	Name string `json:"name"`
	// ID is the numeric GitHub user id.
	ID int64 `json:"id"`
}

// RevokeToken revokes accessToken by calling
// DELETE {APIURL}/applications/{client_id}/token with HTTP Basic client
// credentials. It accepts any 2xx status and never relays the upstream body.
func (c *Client) RevokeToken(ctx context.Context, accessToken string) error {
	payload, err := json.Marshal(struct {
		AccessToken string `json:"access_token"`
	}{AccessToken: accessToken})
	if err != nil {
		return fmt.Errorf("github: encode revoke request: %w", err)
	}

	target := c.APIURL + "/applications/" + url.PathEscape(c.ClientID) + "/token"
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, target, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("github: build revoke request: %w", err)
	}
	req.SetBasicAuth(c.ClientID, c.ClientSecret)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "opendraft-bff")

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return fmt.Errorf("github: revoke request: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("github: revoke status %d", resp.StatusCode)
	}
	return nil
}

// FetchUser returns the identity of the user owning accessToken by calling
// GET {APIURL}/user. It never relays the upstream response body in errors.
func (c *Client) FetchUser(ctx context.Context, accessToken string) (User, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.APIURL+"/user", nil)
	if err != nil {
		return User{}, fmt.Errorf("github: build user request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("User-Agent", "opendraft-bff")

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return User{}, fmt.Errorf("github: user request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return User{}, fmt.Errorf("github: user status %d", resp.StatusCode)
	}

	var user User
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&user); err != nil {
		return User{}, fmt.Errorf("github: decode user response: %w", err)
	}
	if user.Login == "" {
		return User{}, fmt.Errorf("github: user response missing login")
	}
	return user, nil
}
