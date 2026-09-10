---
name: univer-embed
description: Embed or inspect linked content between Units in a WorkBuddy Univer Office file while preserving source identity.
---

Read [the shared Univer workflow](../univer/SKILL.md) for file resolution, editable worktrees, confirmed writes and human review. Use the available workbuddy-univer-office MCP tools.

Resolve the source and destination Units with `univer_status`; inspect their kinds, revisions and worktree context. Use `univer_api` to discover the installed public embedding contract for the destination type. Do not invent an embed payload or write internal resource JSON.

Verify whether the requested behavior is a live reference or a fixed snapshot. Use stable source IDs and the intended branch/version. If a required public API is unavailable, describe that specific gap rather than substituting an image and calling it a live embed.

After confirmed destination edits, reload and inspect the reference, render the destination, and verify its behavior when source content changes in an authorized draft. Check export separately: a rendered embed does not prove that standard Office export retains its link. Cross-Unit embedding remains under end-to-end validation in this plugin.
