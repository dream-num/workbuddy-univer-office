---
name: univer
description: Create, inspect and edit local Univer Office files through the workbuddy-univer-office MCP tools.
---

Use `univer_status` to resolve the current file and Unit. Create a `.univer` container with `univer_new`, create a worktree, then create content with `univer_unit`.

All Agent writes target an editable worktree. Never write trunk or claim that executing JavaScript means it was committed. Check the returned `outcome` and `commit` first. For an unknown outcome, inspect current state before any retry; do not repeat append-style programs blindly.

Use `univer_api` to find and show installed public Facade methods before writing code. `univer_execute` binds `workbook` for Sheet, `doc` for Doc, `presentation` for Slide, `base` for Base, and `board` for Board. `api` and `univerAPI` are also available.

Return JSON-compatible values from execution. Do not return live Facade objects or objects containing `undefined`, functions, or cycles. Return selected primitives, or serialize a public snapshot with `JSON.parse(JSON.stringify(snapshot))` when appropriate. A result-serialization error does not prove that changes were committed; inspect the authoritative target before retrying.

After editing, read the content back. Formula results may only become available after calculation; reload and inspect actual results. Use screenshots for visual checks and `univer_lint` for changed Slide pages. Do not describe a tool error or an unavailable capability as success.

Call `univer_preview` after the first confirmed visible content and after completing edits, or when the user explicitly asks to see content. It returns a MCP App preview card with an actual SDK screenshot and a human review entry. Do not automatically open previews for pure reads. In the verified WorkBuddy 5.5.4 HTTP connector, previews default to the right panel through the WorkBuddy launchSurface metadata and embed a read-only live Viewer. Existing connections may require reconnection to load the new tool metadata. Review opens the browser Viewer. Worktree View and Compare are always read-only without a Ribbon; reopening permits Agent edits only. Human editing is available exclusively on trunk after a confirmed, completed merge, through a scoped edit session with the Ribbon restored. A screenshot fallback represents its capture revision. Stdio tool availability alone does not establish MCP App support. Never attempt to extract or use the UI-only launch capability to approve your own work.

Interpret preview state literally: `ready` is frozen and awaiting human review; it is not editable until reopened. The embedded preview is always read-only, including for an editable draft. A null `revision` means no captured revision was supplied (for example capture=false); it does not establish that there are no pending changes. Use the returned `worktreeEditable` and `awaitingHumanReview` fields when available.

Mark the worktree ready after checking the selected version. Merge and discard require an explicit user review; a model-supplied approval flag is not authorization. Report pending-review honestly. Basic live previews have been verified for all five products; full review interactions and formal plugin installation remain under validation.

Export to new files inside the host-authorized workspace. Never overwrite sources or existing deliverables. Source imports support XLSX/CSV/TSV/DOCX/PPTX. PDF supports Sheet/Doc/Slide/Board, not Base.

For Doc delivery, explicitly set the intended font and real table borders through public Facades when they matter to the requested design. Editor gridlines are not proof of exported borders. Verify that the chosen font is available in the target rendering environment; do not silently replace fonts in imported user documents. Open representative DOCX exports in an independent compatible reader and compare characters, widths and pagination. A successful SDK screenshot alone does not prove DOCX fidelity.

For Base export, pass `baseSelection: {tableId, viewId?}` to `univer_export`. Resolve IDs through public Facades; never guess the first table. With a view, output preserves visible field order and filtered/sorted rows; without one, it includes all non-system fields and records of that table. Check the returned revision and record count. Text and numeric fixtures are verified; complex field representations are rejected until supported. Host-local numeric, text and boolean formula results are verified for filtered views with hidden inputs. Calculate and confirm the source first; missing cached results are rejected. Cross-Unit formula delivery remains unverified. Do not describe Base export as fully verified for every field type.

For product-specific work, read the matching sibling skill: [Sheet](../univer-sheet/SKILL.md), [Doc](../univer-doc/SKILL.md), [Slide](../univer-slide/SKILL.md), [Base](../univer-base/SKILL.md), or [Board](../univer-board/SKILL.md). For linked content, use [embedding](../univer-embed/SKILL.md) or [cross-Unit formulas](../univer-cross-unit-formula/SKILL.md). These use this plugin's MCP tools, not an external Univer CLI installation.
