# WorkBuddy marketplace submission

Status: **not submitted**. A single Univer Office connector candidate has been packaged; this document is not an approval record. Distribution requires the installation and host checks below.

## 2026-09-11 connector candidate

The selected submission route is a local **MCP + Skill connector**, not the expert or Buddy App routes. The earlier expert ZIP remains a manual-HTTP development package and is not the connector submission artifact.

Implemented an npx executable with explicit absolute-directory validation, removed the human launch credential from stdio startup logs, and added the official connector ZIP generator. The connector uses a local directory form, managed Node >=22.12.0 <23, one stdio server and one Skill. The runtime builder packages a production npm shrinkwrap lock, without development dependencies. The configuration allows up to 15 minutes for a cold connection; this is not a measured startup guarantee.

On a fresh npm cache without the user's npm configuration, the executable installed and reported its version. A subsequent protocol verification through npx created a Sheet, confirmed a draft write, read back SUM=2000, rendered PNG, exported XLSX, loaded the MCP App resource and received HTTP 200 from the preview page. This does not establish actual WorkBuddy panel discovery. Missing, relative and unexpanded workspace values are rejected before service startup. Type checking and three targeted MCP integration tests passed.

The official platform accepted the initial connector ZIP and reached the information-confirmation step. The service category is Tools / Office. Public runtime publication is recorded below. Updated package upload, actual host verification and final review submission must be recorded separately; parsing success is not marketplace approval. The user is handling the platform listing form; no final review submission has been made by this task.

## Installation download follow-up

The runtime and initial connector ZIP were published as assets of GitHub prerelease `v0.1.0-preview.1`. Direct GitHub access timed out on the test machine, while its configured network proxy could reach the asset. The verifier had omitted proxy environment variables; it now preserves only those network settings, isolates both npm configuration files, and runs outside the source checkout to avoid inheriting its `.npmrc`. Empty npm caches are the default; `--reuse-cache` is an explicit diagnostic option. Reports distinguish installation in progress, failure and success.

With the configured proxy and reused dependency cache, the public GitHub URL initialized in 15.25 seconds and passed the Sheet/formula/export/preview protocol checks. This is not a cold-install result or proof of WorkBuddy's managed installation.

A separate test installed the local runtime tarball outside the repository with an empty npm cache and empty user/global configuration, using the connector's public Univer registry and the machine's configured proxy. Dependency download and initialization took 111.393 seconds. All 15 tools were discovered; Sheet creation, a confirmed write, SUM=2000, PNG, XLSX, MCP App resource retrieval and preview HTTP 200 passed. This establishes the dependency installation path without developer npm configuration; the final public npm runtime URL still needs its own test after publication. It does not simulate a new machine or prove managed Node installation.

The revised connector targets the fixed public npm URL `https://registry.npmjs.org/workbuddy-univer-office/-/workbuddy-univer-office-0.1.0.tgz`; SDK dependencies continue to use the public Univer registry. This removes GitHub from the install path. The audited 18,906,130-byte runtime was published publicly as `workbuddy-univer-office@0.1.0` under the `preview` tag after the publisher completed npm 2FA. Anonymous registry metadata matches the local tarball's SHA-512 integrity, and the actual npm page shows version 0.1.0 as public. Installing users do not need npm accounts.

The first post-publish tarball request returned a cached CDN 404 with `max-age=300`; a cache-bypassed request returned HTTP 200. After that cache expired, the unchanged connector URL returned HTTP 200. The connector retains the standard versioned npm URL without a cache-bypass query parameter. Publication success alone is not download acceptance.

The final public npm URL subsequently passed the complete isolated installation check: empty npm cache, empty user/global npm configuration, workspace outside this checkout, and the exact registry/arguments used by the connector. Download and initialization took 190.276 seconds on the test machine's configured network; the runtime tarball download itself took 65.672 seconds. The check discovered 15 tools, created a Sheet, confirmed a draft write, calculated SUM=2000, rendered PNG, exported XLSX, retrieved the MCP App resource and opened the preview page with HTTP 200. This is a measured installation result on macOS, not a startup SLA or a managed WorkBuddy panel acceptance result.

The updated connector ZIP is 25,303 bytes and includes exactly one MCP server and one Skill. Its SHA-256 is `9acc75b4055cfd07ae549ef82354851ccd6629c2942fde7fff7f426bd328e2b1`. It is the npm-based candidate for host validation and replaces the earlier GitHub-download candidate. npm publication does not publish the connector to WorkBuddy's marketplace.

Reproduce the isolated download and functional check with:

```sh
node scripts/verify-connector-runtime.mjs https://registry.npmjs.org/workbuddy-univer-office/-/workbuddy-univer-office-0.1.0.tgz
```

The verifier uses an empty cache, empty user/global npm configuration and a temporary workspace outside this repository. `CONNECTOR_VERIFY_REGISTRY` can override the connector's public Univer registry for diagnostics. A successful protocol result still leaves managed Node setup, the platform directory form and the actual WorkBuddy panel to be verified in the host.

## Listing information

| Field | Proposed value |
| --- | --- |
| Publisher | dream-num |
| Name / English name | Univer Office |
| Chinese name | Univer Office 办公套件 |
| Source identifier | `univer-office` (availability must be confirmed by WorkBuddy) |
| Integration | MCP + Skill, one local stdio MCP server |
| Version | 0.1.0 development preview |
| WorkBuddy version tested | 5.5.4 on macOS |
| Runtime requirement | Node.js >=22.12.0 |
| Source | https://github.com/dream-num/workbuddy-univer-office |
| Logo | [`assets/univer-office.png`](../assets/univer-office.png) |
| Skill | [`skills/univer-office/SKILL.md`](../skills/univer-office/SKILL.md) |

Chinese description: 在 WorkBuddy 中创建、编辑、查看、对比和导出表格、文档、幻灯片、多维表格与白板。通过修改草稿和人工审阅管理变更。

English description: Create, edit, inspect, compare and export local spreadsheets, documents, slides, Base tables and Board canvases in WorkBuddy, with draft changes and human review.

Example prompts:

- 根据这份销售数据创建表格和图表，预览后交给我审核。
- 将项目说明整理成文档和演示文稿，显示修改前后的差异。
- Create a sales spreadsheet with a chart and show the draft for my review.
- Turn the project brief into a document and a presentation, then compare the changes.

## Prepared and verified

- Exactly one discoverable `SKILL.md`, with seven ordinary Markdown references. No separate product skills are installed by the new package.
- The Skill ZIP includes the entry point and all seven references; packaging checks validate links, archive contents and CRC.
- The complete development archive includes one MCP service, the unified Skill, supplied logo and built runtime assets. Its audited file list and integrity are generated under `.data/packages/`.
- WorkBuddy's own `codebuddy plugin validate .`, TypeScript checking and the sequential runtime build passed for this consolidation.
- On the development machine, the eight previously imported skills were backed up and replaced by one `univer-office` installation. WorkBuddy's installed-Skills UI changed from 45 entries to 38 and exposed the new entry. This verifies local Skill discovery, not official connector installation.

Reproduce the packages with:

```sh
python3 scripts/package-workbuddy-skills.py
pnpm pack:plugin
```

The Skill ZIP contains instructions only. The runtime archive requires dependency installation and does not include a Pro license.

## Remaining submission work

The [official connector specification](https://open.workbuddy.cn/docs/connector) requires `connector-meta.json`, `mcp.json`, an icon and the Skill directory. The existing `.workbuddy-plugin/plugin.json` is a development plugin manifest and must not be presented as the official connector configuration.

Before submitting an installable connector:

1. Validate the published `workbuddy-univer-office@0.1.0` runtime in WorkBuddy's managed Node environment, including its public SDK registry and native dependencies. npm publication and standalone installation do not establish managed-host setup.
2. Verify how the official connector receives the authorized workspace directory and resolves its installed assets. The development plugin's `CODEBUDDY_PLUGIN_ROOT` and `CODEBUDDY_PROJECT_DIR` substitutions have not been established for this separate connector path.
3. Verify automatic startup and MCP App discovery using that exact installation. The existing HTTP development integration verifies a read-only right-panel preview; complete review and editing currently open externally.
4. Complete connector metadata and configuration against the verified installation, then submit the directory to WorkBuddy for review. Record the submission identifier and decision only after the platform returns them.

On 2026-09-10, attempts to load the [official platform](https://open.workbuddy.cn/) from the current environment timed out before reaching a submission form. No login state, publisher verification, submission identifier or approval was established. The documented official contact is [openworkbuddy@tencent.com](https://open.workbuddy.cn/docs/contact).

## Reviewer notes

The application source is Apache-2.0; SDK dependencies retain their own license requirements. Worktree View and Compare are read-only, and human editing requires a confirmed complete merge. Base PDF and Board file export are unsupported. Complex content, export fidelity, other operating systems and full host installation remain subject to the acceptance gaps in [release readiness](release-readiness.md). Do not advertise full CLI/DSH parity or production readiness based on this packaging change.
