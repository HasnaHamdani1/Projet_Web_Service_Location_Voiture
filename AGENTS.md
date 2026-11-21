# Instructions for coding agents

## Team coordination

Before changing a shared API, database schema, service boundary, authentication rule, Docker Compose setup, or cross-service workflow, read [`TEAM_SYNC.md`](TEAM_SYNC.md) and inspect the relevant implementation files.

Use `TEAM_SYNC.md` as the repository's shared coordination reference:

- Preserve decisions that are marked as agreed or currently implemented.
- Treat items marked proposed, recommended, pending, or requiring confirmation as unresolved. Do not present them as team agreements or implement a breaking change based only on a proposal.
- When a change affects a shared contract, update the relevant section of `TEAM_SYNC.md` in the same change. State what is implemented, what is proposed, and what still needs an owner or team decision.
- If the guide and code disagree, inspect the code and Git history, then correct the guide or flag the disagreement. Do not silently change another service owner's API or behavior.
- In the completion summary, tell the team what changed and identify any decisions or follow-up work that remain.

`TEAM_SYNC.md` is a committed document, not a live synchronization mechanism. It does not notify teammates or update their working copies. Team members must share changes through the repository's normal Git workflow and discuss unresolved decisions with the relevant owners.

