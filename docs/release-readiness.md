# Release readiness — 2026-09-10

Decision: **not ready for a formal release claiming the agreed CLI/DSH interaction and full spec scope**.
The current build remains a local development preview. This assessment checks current source,
existing validation evidence and the existing archive. A fresh serial integration regression is
recorded below; it is not a new WorkBuddy end-to-end or candidate-package acceptance run.

## Current release decision audit

- Fresh typecheck and server build passed. All current integration tests ran serially:
  **45 passed, 0 failed, 0 skipped**, 110.04 seconds (`.data/release-audit-tests.log`).
  The Viewer/MCP card were not rebuilt in this audit, and the existing archive was not used as
  the test subject. These results cover source integration, not clean installation or full UI parity.
- Rechecked the agreed DSH source checkout at `f3a8845dd4c863072b0ae555cdb6a58076c165e7`.
  Its comparison viewer supports locale-aware read-only presentation, and its client has a persistent
  automatic-live-preview preference. This audit does not expand the agreed Chinese/English scope
  to every upstream language.
- Current card code forwards host locale/theme to the live preview and uses public SDK locale APIs.
  This supersedes earlier statements that all UI language is hardcoded. Full review, comparison,
  history and dialog localization are still incomplete; automatic-preview preference parity is open.
- The card review action still calls `app.openLink`; actual host evidence records an external browser.
  The plugin manifest still starts the stdio entry point, while successful desktop App evidence uses
  the manually configured HTTP connector. Formal installation and update acceptance remain open.
- Reopened the existing `0.1.0` archive without extracting it: `package.json`,
  `dist/viewer/index.html` and `dist/mcp-app/index.html` differ from current files; its package manifest
  has no direct `@univerjs/icons` dependency. No replacement archive was built or published.
- Remaining Slide read-only affordances and complex Doc header/chart failures are unresolved findings
  from the latest relevant browser/fixture records. This audit did not rerun those browser scenarios
  and does not infer that read-only affordances permit unauthorized writes.

Release order: establish the supported formal WorkBuddy installation/review path, close known
functional and presentation gaps, then validate one exact candidate across the declared platforms,
recovery/lifecycle, complex five-product content, native exports, license configuration and P95 budgets.
Passing integration tests alone does not close the 25 spec acceptance criteria.

Reference baseline: the agreed DSH commit `f3a8845dd4c863072b0ae555cdb6a58076c165e7` in
[the spec](./workbuddy-univer-office-spec.md), with the current
[CLI README](https://github.com/dream-num/univer-cli) used as an additional comparison.
New upstream features do not silently expand the agreed release scope.

## Confirmed differences and gaps

| Area | Evidence and current behavior | Required closure |
| --- | --- | --- |
| Compare controls | Content/Formatting, shared-formula display, scope selection, grouping and search are now implemented. Sheet controls have browser evidence; 2205-item Sheet pagination, search and navigation now have browser evidence; populated two-page Slide/two-table Base scope synchronization now has browser evidence; inserted/deleted scopes and other Base view types remain unverified. | Align agreed comparison navigation and controls; distinguish missing controls from the already working five-product highlights. |
| Compare source and freshness | Implemented a source selector, freshness endpoint and explicit refresh. Polling only reports changes; closed sources are rejected for new comparisons. | API tests and desktop/390px browser verification passed. More complex five-product source/refresh cases remain part of final acceptance. |
| Host review | MCP metadata requests WorkBuddy's right panel for read-only preview. Editing/review still opens the external browser. | Verify the agreed in-host flow or explicitly declare a supported host limitation; browser screenshots are not host evidence. |
| Read-only restoration | Fixed: prepare/confirm/cancel now require a live edit grant scoped to the trunk Unit; UI restoration is only exposed during editing. Read-only history browsing remains available. | Targeted integration tests and real Viewer checks passed; include this change in candidate-package regression. |
| Language/preferences | MCP card and live preview now consume host locale and support Chinese/English through public SDK locale APIs. The full review/Compare/history/dialog flow still uses Chinese; automatic-preview preferences and complete host evidence remain open. | Complete U13 across the full flow; card/preview support alone does not close this gate. |
| Complex content | The most recent complex Doc evidence still records duplicated headers after reload and a chart `clipBounds` error. | Resolve through supported SDK integration or a verified upstream SDK fix; rerun the failing fixture and native DOCX/PDF checks. Do not patch SDK internals or hide failures. |

## Release blockers beyond layout

- The plugin manifest still launches `dist/mcp/main.js` (stdio). The verified WorkBuddy 5.5.4 App path
  uses a manually started/configured HTTP connector. Automatic runtime startup, credential update,
  plugin loading and discovery of all eight Skills need a real installation acceptance run.
- The existing `.data/packages/workbuddy-univer-office-0.1.0.tgz` is stale: its `package.json` and
  `dist/viewer/index.html` differ from current files, and it has no direct `@univerjs/icons` dependency.
  It must not be presented as containing the latest navigation or icons.
- A fresh macOS/Windows/Linux installation, upgrade/uninstall and restart recovery cycle has not
  been established for the current candidate, as required by spec 13.1.25.
- Trusted task scope, same-file concurrency edge cases, cancellation, idle shutdown and no remaining
  owned processes/locks still need the full acceptance evidence. Workspace locking and scoped preview/
  editing grants already exist; they do not by themselves prove all of these requirements.
- The current service reads `UNIVER_LICENSE` from runtime configuration. Recent screenshots show
  the SDK license-required watermark; the package does not include a Pro license. Validate the intended
  deployment's license configuration without copying credentials from DSH.
- Full complex five-product, cross-Unit reference/embedding and supported export acceptance remains
  incomplete. Performance budgets require measured P95 evidence, not successful builds alone.

## What has been verified

Recent work verified flat file navigation, five official product icons, the centered compact View/
Compare switch, read-only worktree View and Compare without Ribbon, five-product highlight fixtures,
left-hand change navigation, narrow-screen stacked compare, merge confirmation and scoped trunk editing
only after a complete merge. The merge/edit regression log records 15 passing tests; the latest icon
change passed typecheck and a targeted Viewer build. These are scoped results, not a release certificate.

Automatic editing after a completed, confirmed merge and the flat navigation are explicit user-approved
choices. They are not regressions merely because DSH returns to its home view after merging.

## Recommended order

1. Complete the formal plugin/HTTP startup path and verify real WorkBuddy review behavior. The read-only restoration gap is already closed.
2. Complete inserted/deleted-scope and complex comparison acceptance, and remove remaining Slide editing affordances through supported integration; populated scope synchronization, paging and controls/source/freshness are implemented.
3. Resolve known complex Doc failures and complete five-product/export/cross-Unit acceptance.
4. Build one candidate archive from the final source, then validate clean installation, platforms,
   permissions, recovery, shutdown, license configuration and performance on that exact candidate.

Existing chronological validation notes contain superseded failures and successes. Use the latest
specific evidence for each item; do not count old failure headings as current defects or old passes
as proof that the current package passed.


## Implementation progress in the active release goal

- History restore authorization gap fixed and verified (see validation log).
- Compare alternate-source selection and explicit freshness/refresh implemented and verified.
- Current full integration run: **29 passed, 0 failed**, `.data/release-progress-regression.log`;
  all integration files run serially against the rebuilt server. The latest Viewer and typecheck passed.
- Installed WorkBuddy source was rechecked read-only: its `createMcpAppsHost` composes remote
  connector discovery and `BuiltinLocalMcpAppDiscovery` rooted at its bundled marketplace. The
  bundled bootstrap is for an internal product, not evidence of a public third-party startup API.
  CLI documentation mentions stdio Apps generally, but that does not prove this desktop's external
  plugin discovery path. No host patch, internal-product impersonation or SDK patch was introduced.

Still active: full Compare navigation acceptance and full CLI visual parity, host installation and in-host review,
complex content failures, language/preferences, candidate packaging and all remaining release gates.

Latest UI milestone: Tailwind 4.3.3 official Vite integration, styled keyboard/pointer icon tooltips, and official product icons throughout Worktree navigation. Full serial integration run now passes 31/31 (`.data/compare-presentation-regression.log`). This is not formal release acceptance.

Viewer shell migration completed: one Tailwind stylesheet replaces both legacy Viewer sheets; application dialogs are scoped, mobile drawer focus is verified, and Compare refresh preserves filters. Sheet Compare dark mode is verified. See `docs/viewer-ui.md` and the latest validation section. Full five-product theme/navigation acceptance remains open.

## Latest source/evidence audit

The MCP card now has Tailwind styles, official product icons and icon tooltips in source. Its targeted
build completed (`.data/mcp-tailwind-app.log`); this does not establish that the running WorkBuddy host
has loaded or visually passed the new resource. Host verification and candidate regression remain open.

Comparison queries now drain every SDK item page and Doc paragraph-alignment page from fixed
snapshots before presenting a complete comparison. A real 2205-item Sheet exposed and led to fixes
for premature worker IPC disconnection, excessive per-cell highlight controls and selection without
scrolling. Browser verification now reaches and highlights A2205 on both sides, retains search after
refresh, and preserves equal stacked panes with no overflow at 390px. These changes do not establish
large-document or general P95 acceptance.

The latest full serial integration run passed 36/36 after the IPC fix; the subsequent compact-range
coverage test passed separately (1/1). Final typecheck and targeted Viewer build passed after the
public-API scrolling fix. No release candidate was produced. Hardcoded Chinese locale, external
review/edit, and the stdio manifest/manual HTTP installation split remain open.

MCP card follow-up: the actual WorkBuddy 5.5.4 right panel now displays the new Tailwind Sheet card,
official icon and compact buttons after the HTTP connector was reconnected. Refresh returned to the
same read-only target; the accessibility tree exposed the keyboard tooltip. The protocol harness
verified all five product card icons, 384px layout, dark Sheet preview and display-mode round trips.
Targeted MCP/HTTP tests pass 4/4. Initial browser execution found a missing production `NODE_ENV`
replacement in the IIFE; this is fixed. See the latest validation section for limitations.

The host's installed-Skills UI now visibly lists all eight Univer Skills on this machine. This provides
local discovery evidence, but does not establish automatic installation from the candidate archive.
Old cards/resources survived a runtime update until connector reconnection; automatic update and
resource refresh remain part of the installation/lifecycle gap.

Populated scope follow-up: a real two-page Slide/two-table Base fixture reproduced and fixed native
scope changes leaving the opposite comparison pane on another page/table. Scope selection and change
selection now share the same current-scope state; programmatic navigation does not echo as a user
scope change. Browser screenshots and source readback are in the latest validation section.

Still open in Slide: read-only previews show the thumbnail add button and empty-layout editing
prompts. Disabling editor interactions via the public SDK configuration failed with a dependency
registration error. Reading-scene/placeholder configuration did not remove the prompts in this
integration. Those experiments were reverted; do not count them as fixes or as permission bypasses.

Change-list readability follow-up: five-product descriptions now translate common SDK fields,
deduplicate text projections, retain cell addresses, replace generated names with stable change
numbers, and describe Board endpoints without raw IDs. Targeted description/presentation tests pass
8/8, with browser checks for Slide, Base, Doc, Board and Sheet. This improves the existing Tailwind
list presentation; it does not close the host, complex-content, language, lifecycle or packaging gates.
