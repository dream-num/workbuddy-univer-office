# WorkBuddy panel and responsive review

Verified in WorkBuddy 5.5.4 on 2026-09-10.

## Default right panel

`univer_preview` declares `_meta.workbuddy.ui.launchSurface = "panel"` alongside the standard MCP App resource metadata. The installed WorkBuddy renderer reads this host extension from tool metadata, falling back to inline for unsupported surfaces. Its `surface-metadata.ts` resolver accepts `inline` and `panel`. No SDK or WorkBuddy package was modified.

The existing connection initially retained its old tool registration. Disabling and re-enabling this development connector loaded the updated tool metadata. A subsequent read-only preview appeared in the actual right panel while the conversation remained visible: WorkBuddy screenshot（本地验证截图：`screenshots/workbuddy-default-right-panel.jpg`）.

This changes preview placement. The current review button still calls MCP `openLink`, which this WorkBuddy version routes through `adapter.openExternal`. Embedded review is not implemented by this change.

## Responsive review

- View/Compare stays centered and moves to a separate row at an available main-pane width of 1100px or less, with two equal-width buttons filling the row. The mode switch, header actions, and review actions use the same 32px height. This follows the container-width approach in the local Univer CLI workbench.
- Narrow comparisons split the available editor height equally between the two fixed versions, keeping both visible simultaneously. Each editor scrolls independently. The comparison change list occupies a 268px left sidebar on wide screens and is hidden at main-pane widths up to 1100px, following the DSH comparison layout; it no longer occupies a bottom panel. This shared layout applies to Sheet, Doc, Slide, Base, and Board.
- At viewport widths up to 1100px, the file sidebar defaults to closed and opens as a drawer. It has a close button and Escape support; selecting a file closes it.
- Slide thumbnail sidebars are capped at 96px in Office containers up to 600px wide, leaving room for the canvas.
- No snapshot content is changed by the responsive styles or comparison overlays.

The toolbar follows the local CLI `SidebarToggleButton` pattern: a 32px ghost icon button with `title`, `aria-label`, `aria-controls`, and `aria-expanded`. The file toggle sits beside the document title. Theme, fullscreen, export, fit-page, and history tools use consistent 16px outline icons; View/Compare and review decisions retain text. On narrow screens the title and utility controls share one row, and both version headings remain visible while scrolling inside either editor. Entering Compare also closes the file sidebar when the available main pane is narrow.

Validation: typecheck and targeted viewer/server builds passed; the three MCP integration tests passed, including the panel metadata assertion. The five-product snapshot comparison remained unchanged. Browser checks cover 390px and 768px review layouts, sidebar open/close, and internal comparison scrolling. The real WorkBuddy right-panel screenshot independently verifies a narrow live Slide preview. These checks do not imply exhaustive mobile editor coverage for every product.

Official overview: [WorkBuddy right sidebar](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Right-Sidebar).

## Review and post-merge editing

Worktree View and Compare remain read-only for Sheet, Doc, Slide, Base, and Board, with no Ribbon. Reopening permits Agent edits only; the review page cannot edit any worktree, even with a trunk edit session.

Merge opens a confirmation dialog. Cancel leaves the draft unchanged; confirmation uses the reviewed fingerprint. Only a complete successful merge switches the page to the trunk and opens an edit session for that Unit. Partial or failed merges do not enable editing. The editing page restores the SDK Ribbon and saves directly to trunk. Completing editing flushes pending changes before revoking the session and returning to read-only View. Previously merged trunk content can also be opened for editing through its confirmation button.

The server issues edit sessions only for retained trunk Units with a completed merge. Sessions are scoped to file, Unit, and trunk; ordinary viewer cookies, preview capabilities, Agent credentials, revoked sessions, and sessions for another Unit cannot write trunk. Agent draft editing remains available. Session path prefixes preserve authentication through SDK URL resolution; no SDK code is changed.

Validation: typecheck and targeted server/viewer builds passed, along with 15 integration tests covering merge confirmation fingerprints, five-product permissions, committed trunk editing, worktree rejection, session revocation, partial merge, preview, and existing Office workflows. Browser verification confirms cancellation, successful five-Unit merge, restored edit controls, and Sheet cell input plus Base record creation persisted on trunk. Original five-product verification snapshots remained unchanged.

Screenshots: merge confirmation（本地验证截图：`screenshots/merge-confirm.jpg`）, editable trunk（本地验证截图：`screenshots/merged-trunk-editable.jpg`）, read-only narrow Compare（本地验证截图：`screenshots/readonly-compare-390.jpg`）.

## Worktree interaction alignment

The DSH reference `src/viewer-app/ui/app.tsx#doMerge` shows a toast, refreshes current-version content, and exits the worktree after success. `app-view.tsx#WorktreeTitle` exposes Submit/Discard for draft and Merge/Discard for ready; there is no persistent list of successful merge results.

The WorkBuddy review now follows that interaction: draft offers Submit for confirmation/Discard, ready offers Merge/Discard, and both submission and discard have confirmation dialogs. The extra reopen, manual draft creation, and mark-removal buttons were removed from this review flow; the Agent APIs remain available. The sidebar uses document names and modification states, and includes a return-to-current-version entry.

Successful merge shows a transient message and returns to the current version without a result panel. Only unresolved merge items produce a compact notice with a details dialog and retry action. Successful siblings are omitted from the error dialog. The user's required post-merge editing behavior is retained: complete confirmed merge can open trunk editing, while every worktree remains read-only.

Browser validation covers draft actions, submit confirmation, ready actions, cancel discard, merge success without a persistent result list, and a real SDK partial merge with one successful and one failed Unit. Screenshots: current version after merge（本地验证截图：`screenshots/worktree-flow-after.jpg`）, failure details（本地验证截图：`screenshots/worktree-merge-failure-details.jpg`）. Typecheck and the targeted viewer build passed. This aligns the reviewed worktree action flow; it does not establish complete feature parity with CLI/DSH.

## Finding worktrees and merged content

Within the selected Office file, Current version lists trunk Units; while reviewing a worktree this section is titled This modification. A separate AI modifications section lists all draft/ready/merging worktrees, including the selected one, and opens their View/Compare review. A collapsed Merged section retains completed worktree records with links to each affected Unit's current trunk version. These links are explicitly current-version links, not historical snapshots. Removed Units have disabled destinations; ordinary history remains available from the current-version viewer.

Merge writes back into the original `.univer` container; it does not create a separate merged file. The merged group preserves its expanded state during refresh and navigation. Verification covered entering a pending worktree, opening the merged group, and following a completed worktree's Doc link back to trunk. Typecheck and the targeted viewer build passed. Screenshot: worktree and merged content navigation（本地验证截图：`screenshots/worktree-navigation-merged.jpg`）.

## Flat file navigation

The sidebar now starts with a compact native file selector and a flat list of the selected
file's saved Units. Each row shows the official colored product icon from `@univerjs/icons` (Sheet, Doc, Slide,
Base, Board) and the Unit name. Icons are 18px; Chinese product names remain in tooltips
and accessible button labels. This uses the same five MultiIcon components as DSH. There is no workspace/folder or current-version heading above this list.
Selecting any row opens that Unit on trunk, including after a merge.

Pending changes have a separate entry. Selecting a worktree exposes its affected Units
under that entry, while the saved-content list stays available for returning to trunk.
Completed change records remain collapsed by default and link to the latest saved content;
they are not additional files or historical snapshots. File switching is disabled during
an active edit session, as before. The selector and navigation use the existing narrow-screen
drawer and do not change SDK permissions or storage.
