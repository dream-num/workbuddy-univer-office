---
name: univer-cross-unit-formula
description: Create or diagnose formulas referencing another Unit in WorkBuddy Univer Office, with explicit source and revision checks.
---

Read [the shared Univer workflow](../univer/SKILL.md) for file resolution, editable worktrees, confirmed writes and human review. Use the available workbuddy-univer-office MCP tools.

Resolve source and destination Unit IDs and their draft or trunk context first. Discover cross-Unit formula syntax and calculation/resource requirements through `univer_api`; do not guess a reference from a display name or apply ordinary worksheet syntax to another Unit.

Inspect source types and values, use the installed public methods to configure the dependency, and write only to an editable destination worktree. After a confirmed commit, calculate and reload the destination, checking both formula text and raw result against an independently derived expectation. If source changes are authorized, verify recalculation from such a change.

Check missing sources, incompatible types and branch/version selection when a formula fails. Do not replace the requested live formula with a constant to make the test pass. Exported cached values and live cross-Unit recalculation are different behaviors and need separate checks. This capability is still under end-to-end validation; ordinary Base or Sheet formula success does not prove it.
