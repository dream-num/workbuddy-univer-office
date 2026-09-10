---
name: univer-slide
description: Create and edit slide presentations in WorkBuddy Univer Office and deliver PPTX or PDF.
---

Read [the shared Univer workflow](../univer/SKILL.md) for file resolution, editable worktrees, confirmed writes and human review. Use the available workbuddy-univer-office MCP tools.

Use the `presentation` binding. Resolve page IDs and dimensions through public Facades, then edit only the requested pages. Discover shape, text, table and image methods through `univer_api`; keep content as native editable objects when those are available.

After confirmed edits, call `univer_lint` for changed pages and inspect screenshots for clipping, overlap, contrast and legibility. Inspect every requested page, not only the first. Export to a new PPTX or PDF. Basic native shapes have been verified in PowerPoint; this does not establish charts, transitions or multi-page fidelity.

The live preview is read-only. The currently visible add-slide control is a known UI inconsistency, not permission to mutate trunk or ready content. Direct editing belongs in the authorized editable draft Viewer.
