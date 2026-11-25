package github

import "context"

// Owner is a GitHub account the viewer can publish to through an app
// installation.
type Owner struct {
	// Login is the account handle.
	Login string
	// Type is "User" or "Organization".
	Type string
	// AvatarURL is the account avatar image URL.
	AvatarURL string
	// AllRepos is true when the installation covers all repositories.
	AllRepos bool
}

// ownerInstallationAccount is the account subset of a user installation.
type ownerInstallationAccount struct {
	Login     string `json:"login"`
	Type      string `json:"type"`
	AvatarURL string `json:"avatar_url"`
}

// ownerInstallation is one GitHub App installation visible to a user token.
type ownerInstallation struct {
	Account             ownerInstallationAccount `json:"account"`
	RepositorySelection string                   `json:"repository_selection"`
}

// ownerInstallationList mirrors GET /user/installations.
type ownerInstallationList struct {
	Installations []ownerInstallation `json:"installations"`
}

// ListOwners returns the accounts whose installations are visible to the
// token, in GitHub's order. AllRepos is true only when the installation
// covers all repositories. No installations yields an empty slice, not nil.
func (c *Client) ListOwners(ctx context.Context, token string) ([]Owner, error) {
	target := c.APIURL + "/user/installations"
	var list ownerInstallationList
	if err := c.getActionJSON(ctx, token, target, &list); err != nil {
		return nil, err
	}

	owners := make([]Owner, 0, len(list.Installations))
	for _, inst := range list.Installations {
		owners = append(owners, Owner{
			Login:     inst.Account.Login,
			Type:      inst.Account.Type,
			AvatarURL: inst.Account.AvatarURL,
			AllRepos:  inst.RepositorySelection == "all",
		})
	}
	return owners, nil
}
