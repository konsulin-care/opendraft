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
	pathFormat            = "path = %q"
	callsFormat           = "calls = %+v"
	latestPullFailed      = "LatestPull: %v"

	testRepoURL       = "https://github.example/" + testOwner + "/" + testRepo
	testOrgRepoURL    = "https://github.example/" + testOrg + "/" + testRepo
	testPull13URL     = testRepoURL + "/pull/13"
	testPull14URL     = testRepoURL + "/pull/14"
	testPull6URL      = testRepoURL + "/pull/6"
	testReviewsPath12 = pullsPath + "/12/reviews"

	testClientID     = "client-id-123"
	testClientSecret = "client-secret-456"
	testRedirectURI  = "https://app.example/cb"
	testContentType  = "application/json"
	testEmptyJSON    = "[]"
	testGitHubURL    = "https://github.example"

	testSuggestionPrefix  = "opendraft/ada/"
	testSuggestionBranch  = testSuggestionPrefix + "20260101-120000"
	testSuggestionBranch2 = testSuggestionPrefix + "20260102-130000"
	testSuggestionRefs    = settingsPath + "/git/matching-refs/heads/" + testSuggestionPrefix
	testHeadLabel         = testOwner + ":" + testSuggestionBranch
	testPaperHead         = testOwner + ":" + testBranch
	testStateOpen         = "open"
	testReviewNone        = "none"
)
