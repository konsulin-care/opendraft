package github

// Shared literals used by the github package tests.
const (
	installationsPath     = "/user/installations"
	installationReposPath = "/user/installations/9/repositories"
	testToken             = "ghu_token"
	testBearer            = "Bearer " + testToken
	testOwner             = "octocat"
	testRepo              = "draft"
	testDefaultBranch     = "main"
	testViewer            = "viewer"
	testOrg               = "acme"
	testPaper             = "paper"
	testBranch            = "od-ada/paper"
	testBranchSpaced      = testBranch + " one"
	settingsPath          = "/repos/" + testOwner + "/" + testRepo
	pullsPath             = settingsPath + "/pulls"
	forksPath             = settingsPath + "/forks"
	pullURL               = "https://github.example/octocat/draft/pull/12"
	acmePaperPath         = "/repos/" + testOrg + "/" + testPaper
	deleteBranchPath      = settingsPath + "/git/refs/heads/" + testBranchSpaced
	unexpectedPath        = "unexpected path %q"
	repoPermissionsFailed = "RepoPermissions: %v"
)
