---
name: univer-base
description: Create and edit structured Base tables, records and views in WorkBuddy Univer Office; export selected tables or views.
---

Read [the shared Univer workflow](../univer/SKILL.md) for file resolution, editable worktrees, confirmed writes and human review. Use the available workbuddy-univer-office MCP tools.

Use the `base` binding. Discover fields, records, tables and views through `univer_api`; resolve IDs from existing content rather than display order. Preserve field types and record identities during updates.

For export, specify `baseSelection: {tableId, viewId?}`. With a view, delivery preserves visible field order and its filtered/sorted records. Without a view, it includes the chosen table's non-system fields and records. Check the returned revision and record count. Base PDF is unavailable.

Text/numeric fixtures and local numeric/text/boolean formula results in filtered views are verified. Calculate the source before delivery; missing cached results and unsupported complex fields are rejected. Do not silently stringify complex fields or label unverified field representations as supported. Inspect the actual result of requested relationships, attachments or other field types before promising delivery.
