# Univer Office for WorkBuddy

<img src="assets/univer-office.png" alt="Univer Office" width="64" height="64">

[简体中文](README.zh-CN.md)

Create, inspect and review local spreadsheets, documents, slides, Base tables and Board canvases from WorkBuddy. Built directly on public Univer Office SDK APIs, with a local MCP server, read-only live previews and a versioned draft review workflow.

**Development preview — not a production release or an officially listed WorkBuddy marketplace package.** See [release readiness](docs/release-readiness.md) for known gaps and the [specification](docs/workbuddy-univer-office-spec.md) for the full acceptance scope.

## Workflow

1. Ask WorkBuddy to create or modify Office content.
2. Agent changes are committed to an isolated draft (worktree).
3. Inspect the read-only preview and compare fixed versions, with semantic changes and navigation for all five content types.
4. Explicitly confirm merging or discarding the draft. Human editing is permitted only on trunk after a confirmed, complete merge.
5. Export supported formats from a selected confirmed version.

Worktree View and Compare are always read-only, without a Ribbon. The current verified WorkBuddy 5.5.4 integration displays the live MCP App preview in the right panel; full review and editing open in an external browser.

## Local development

Prerequisites: Node.js **22.12 or newer**, pnpm **10.33.4**, and access to the SDK registry configured in `.npmrc`. Dependencies are pinned to a matching SDK cohort. Some SDK features require a separate Univer Pro license; configure `UNIVER_LICENSE` for the intended deployment.

```sh
git clone https://github.com/dream-num/workbuddy-univer-office.git
cd workbuddy-univer-office
pnpm install --frozen-lockfile
pnpm build:server
pnpm build:viewer
pnpm build:render
pnpm build:app
```

Build targets sequentially. During development, rebuild only the target you changed.

Start the development HTTP MCP server against an existing, authorized workspace directory:

```sh
WORKBUDDY_OFFICE_WORKSPACE=/absolute/path/to/office-files node dist/mcp/http.js
```

The server listens on `127.0.0.1`, choosing an available port starting at 9080. It writes the connection URL and headers to `.data/http-mcp-runtime.json` with mode `0600`. Use those values in WorkBuddy's custom HTTP MCP connector configuration. Keep the process running, and update the connection after a restart changes its port or credentials. Never commit or share that runtime file.

Only one Office service may own a workspace at a time. The plugin manifest also includes a stdio entry point; do not enable it alongside the HTTP development connector for the same workspace. Formal marketplace installation, automatic runtime configuration and complete in-host review remain under validation.

The plugin exposes one user-facing Skill, `univer-office`, and one MCP service. Product and cross-Unit guidance lives in seven ordinary Markdown files under `skills/univer-office/references/`, loaded only as needed. A standalone Skill ZIP is available through `python3 scripts/package-workbuddy-skills.py`; it contains instructions, not the Office runtime.

The official marketplace candidate uses **MCP + Skill**, with a local stdio process. `bin/univer-office.mjs` provides the npx executable and requires an explicit absolute `WORKBUDDY_OFFICE_WORKSPACE`. The connector's setup form supplies this local directory; it requires no cloud account or Office API key. The published-runtime builder includes a production npm shrinkwrap lock. This is separate from the earlier expert ZIP, which requires manually starting an HTTP service.

Build the candidate after building the runtime targets: `node scripts/package-connector-runtime.mjs`, then `python3 scripts/package-workbuddy-connector.py`. The ZIP contains the connector metadata, MCP configuration, directory form, logo and one Skill; the runtime is downloaded as a fixed GitHub release asset. First-time installation may take several minutes. Platform parsing, protocol-level previews and actual WorkBuddy panel behavior are separate acceptance checks; see [submission status](docs/marketplace-submission.md).

If you previously imported the eight separate development Skills, updating the plugin does not automatically remove those independent user installations. After installing the unified Skill, remove only the old Univer Skills through WorkBuddy's installed-Skills manager; do not remove the Office connector or user Office files.

## Checks and local packaging

```sh
pnpm typecheck
pnpm test
```

Integration tests run serially. The latest complete source regression recorded 45 passing tests; subsequent logo changes passed the four targeted MCP/HTTP tests. These checks are not a substitute for WorkBuddy installation, full UI or native Office export acceptance.

```sh
pnpm pack:plugin
```

This builds each runtime target sequentially and creates a development archive under `.data/packages/`, with an audited file list and SHA-512. It does not publish to npm, GitHub Releases or the WorkBuddy marketplace. Runtime dependencies still need installation; the archive does not include `node_modules` or a Pro license.

## Documentation and limitations

- [Product and technical specification](docs/workbuddy-univer-office-spec.md)
- [Release readiness](docs/release-readiness.md)
- [Official marketplace submission status](docs/marketplace-submission.md)
- [SDK compatibility and known integration gaps](docs/sdk-compatibility.md)
- [Viewer UI](docs/viewer-ui.md)
- [Chronological validation notes](docs/workbuddy-univer-office-validation.md)

Known gaps include formal host installation/lifecycle acceptance, full review localization, Slide read-only editing affordances, complex Doc rendering, and complete cross-Unit/export/platform/performance acceptance. Existing scoped successes must not be presented as full feature parity.

Validation notes refer to local `.data/` artifacts and `docs/screenshots/` captures. Those files remain on the development machine and are intentionally excluded from this public repository, along with credentials, workspace databases, generated bundles and dependency directories. Historical notes describe the state at the time; use the latest specific evidence and readiness report for current status.

## License and dependencies

This project's application code is licensed under [Apache-2.0](LICENSE). Dependencies retain their own licenses and usage requirements; this license does not grant a Univer Pro license or trademark rights.

[dsh-univer-office](https://github.com/dream-num/dsh-univer-office) is an interaction reference. This application does not depend on its package, copy its host implementation, or patch installed SDK internals. Reference checkouts and submodules are not included.
