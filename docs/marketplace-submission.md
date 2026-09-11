# WorkBuddy marketplace submission

Status: **not submitted**. This is the submission brief for a single Univer Office connector, not an installable official connector package or an approval record.

## 2026-09-11 connector candidate

The selected submission route is a local **MCP + Skill connector**, not the expert or Buddy App routes. The earlier expert ZIP remains a manual-HTTP development package and is not the connector submission artifact.

Implemented an npx executable with explicit absolute-directory validation, removed the human launch credential from stdio startup logs, and added the official connector ZIP generator. The connector uses a local directory form, managed Node >=22.12.0 <23, one stdio server and one Skill. The runtime builder packages a production npm shrinkwrap lock, without development dependencies. The configuration allows up to 15 minutes for a cold connection; this is not a measured startup guarantee.

On a fresh npm cache without the user's npm configuration, the executable installed and reported its version. A subsequent protocol verification through npx created a Sheet, confirmed a draft write, read back SUM=2000, rendered PNG, exported XLSX, loaded the MCP App resource and received HTTP 200 from the preview page. This does not establish actual WorkBuddy panel discovery. Missing, relative and unexpanded workspace values are rejected before service startup. Type checking and three targeted MCP integration tests passed.

The official platform accepted the initial connector ZIP and reached the information-confirmation step. The service category is Tools / Office. Final runtime asset publication, updated package upload, actual host verification and final review submission must be recorded separately; parsing success is not marketplace approval.

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

1. Validate a public, versioned runtime installation in WorkBuddy's managed Node environment, including scoped SDK registries and native dependencies. This project is not currently published as an npm executable; an `npx` package name must not be invented.
2. Verify how the official connector receives the authorized workspace directory and resolves its installed assets. The development plugin's `CODEBUDDY_PLUGIN_ROOT` and `CODEBUDDY_PROJECT_DIR` substitutions have not been established for this separate connector path.
3. Verify automatic startup and MCP App discovery using that exact installation. The existing HTTP development integration verifies a read-only right-panel preview; complete review and editing currently open externally.
4. Complete connector metadata and configuration against the verified installation, then submit the directory to WorkBuddy for review. Record the submission identifier and decision only after the platform returns them.

On 2026-09-10, attempts to load the [official platform](https://open.workbuddy.cn/) from the current environment timed out before reaching a submission form. No login state, publisher verification, submission identifier or approval was established. The documented official contact is [openworkbuddy@tencent.com](https://open.workbuddy.cn/docs/contact).

## Reviewer notes

The application source is Apache-2.0; SDK dependencies retain their own license requirements. Worktree View and Compare are read-only, and human editing requires a confirmed complete merge. Base PDF and Board file export are unsupported. Complex content, export fidelity, other operating systems and full host installation remain subject to the acceptance gaps in [release readiness](release-readiness.md). Do not advertise full CLI/DSH parity or production readiness based on this packaging change.
