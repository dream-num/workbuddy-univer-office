---
name: univer-office
description: Create, edit, inspect, compare and export local Univer Office spreadsheets, documents, slides, Base tables and Board canvases through the WorkBuddy Univer Office MCP service.
description_zh: 在 WorkBuddy 中创建、编辑、查看、对比和导出表格、文档、幻灯片、多维表格与白板。
description_en: Create, edit, inspect, compare and export spreadsheets, documents, slides, Base tables and Board canvases in WorkBuddy.
version: 0.1.0
author: dream-num
---

Use the `univer_*` MCP tools provided by the Univer Office connector. If they are unavailable, explain that the connector must be installed and connected; this Skill alone does not install the Office runtime. Do not substitute a global Univer CLI or claim that a missing connection is working.

## Select the relevant guidance

Read only the references needed for the user's content. These are internal documents, not separate skills to install.

| Work | Reference |
| --- | --- |
| Spreadsheets, formulas, charts, pivots, XLSX/CSV/TSV | [Sheet](references/sheet.md) |
| Rich text, tables, pagination, DOCX/PDF | [Doc](references/doc.md) |
| Slide pages, SVG authoring, PPTX/PDF | [Slide](references/slide.md) |
| Base tables, fields, records, views and export | [Base](references/base.md) |
| Board objects, connectors and diagrams | [Board](references/board.md) |
| Linked content between Units | [Embedding](references/embed.md) |
| Formulas referencing another Unit | [Cross-Unit formulas](references/cross-unit-formula.md) |

## File and content workflow

Resolve the current file and Unit with `univer_status`. To create new content, use `univer_new` for a `.univer` container, `univer_worktree` for its draft, then `univer_unit` for the required content type. Existing Office input formats are XLSX, CSV, TSV, DOCX and PPTX through `univer_import`.

Use `univer_api` to discover the installed public Facade methods before writing code. `univer_execute` provides `workbook` for Sheet, `doc` for Doc, `presentation` for Slide, `base` for Base and `board` for Board, plus `api`/`univerAPI`. Select the required worksheet, page or table explicitly; do not infer its identity from display order.

All Agent writes target editable drafts, never trunk or frozen ready content. Check the authoritative returned `outcome` and `commit` before reporting success. If the outcome is unknown, inspect current state before retrying; do not repeat append-style changes blindly. Return JSON-compatible values, not Facade objects, functions, cycles or `undefined`. A result serialization error does not establish whether the write committed.

After confirmed edits, read back the actual content and calculated results. Use SDK screenshots for visual verification and `univer_lint` for changed Slide pages. `univer_compile_svg` and `univer_resources` support Slide authoring and assets where applicable. Preserve unrelated user content and formatting.

## Preview and review

Call `univer_preview` after the first confirmed visible content, after completing edits, or when the user requests a preview. Pure reads should not automatically open previews. The verified WorkBuddy 5.5.4 HTTP integration displays a read-only live MCP App in the right panel; full review and editing currently open in an external browser. A screenshot fallback represents its captured revision.

Worktree View and Compare are always read-only without a Ribbon. `ready` means frozen and awaiting human review; reopening permits Agent edits only. Human editing is permitted only on trunk after a confirmed, complete merge, through the scoped edit session. A null preview revision means no capture revision was supplied, not that no changes exist.

Mark a checked draft ready with `univer_worktree`. Merge and discard require explicit human review; report `pending-review` honestly. Never extract UI-only launch credentials or use them to approve your own work. Partial merge does not grant editing or imply that every Unit succeeded.

## Delivery and capability limits

Use `univer_export` or `univer_print_pdf` for new files in the authorized workspace. Do not overwrite source files or existing deliverables. PDF supports Sheet, Doc, Slide and Board; Base PDF and Board file export are unsupported. For Base export, resolve and pass `baseSelection: {tableId, viewId?}`.

Open representative Office exports in an independent compatible reader when fidelity matters. A successful screenshot or an output file's existence does not establish export fidelity. Complex content, cross-Unit embedding/formulas, full host installation and review remain under acceptance testing; state the checks actually performed and specific gaps instead of claiming complete support.
