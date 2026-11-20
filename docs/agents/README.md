# Agent handoff index

This folder is the living handoff for SnapSchool Web. The repository-root `AGENTS.md` contains the mandatory workflow; do not replace it with a chat summary or rely on a previous agent's memory.

For a broader product and whole-project introduction, read the [cofounder and engineering handbook](../handbook/README.md).

## Reading order

1. [Current state](current-state.md): behavior, verification boundaries and unfinished work.
2. [Change log](change-log.md): recent decisions and implementation history.
3. [Feature map](feature-map.md): exact files to inspect for the task.
4. [Architecture](../architecture.md), [setup](../getting-started.md) and [contribution rules](../../CONTRIBUTING.md) as needed.

## Updating the handoff

Every logical change needs a change-log entry and an update to the root AGENTS.md Latest handoff. Update current-state and feature-map notes when affected. Commit these with the implementation.

Use this change-log format:

```text
## YYYY-MM-DD — Concrete outcome
- Request/reason:
- Changes and affected paths:
- Verification: exact checks and results; state when none were run.
- Operations: local/committed/pushed/deployed/schema-applied/live-verified, as applicable.
- Remaining work / next step:
```

The date uses the user's timezone. Do not copy secrets, private records or whole command outputs. Do not claim that a pushed migration was applied, or that a successful unit test verifies production.
