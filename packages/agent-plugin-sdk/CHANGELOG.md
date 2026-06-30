## @jalco/ap-sdk@0.2.0

### Install plugins straight from GitHub

`ap-sdk install` and `ap-sdk check` now accept a GitHub source — `owner/repo`,
`github:owner/repo`, or a github.com URL, with an optional `#ref` for a branch,
tag, or commit. The repository is downloaded, **validated for compatibility with
the ap-sdk plugin format**, and only installed if it default-exports a valid
`definePlugin(...)` result; otherwise the install is aborted with the reason.

Pass `--path <dir>` for a plugin in a subdirectory, and set `GITHUB_TOKEN` for
private repos or a higher API rate limit.
