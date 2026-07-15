# Agent-First CLI Contract Matrix

Fill this in before implementing a new command or changing an existing one.

## Command

| Field | Decision |
|---|---|
| Domain and action |  |
| Read / write / destructive |  |
| Synchronous / streaming / Job |  |
| Required inputs |  |
| Optional inputs and defaults |  |
| Flags / JSON / file / stdin |  |
| Input precedence or exclusivity |  |
| Configuration sources |  |
| Timeout and cancellation semantics |  |

## Machine Contract

| Field | Decision |
|---|---|
| Success stdout envelope |  |
| Streaming event schema |  |
| stderr diagnostic schema |  |
| Error codes and repair hints |  |
| Exit codes |  |
| Schema version |  |
| Help and Schema discovery |  |
| Default/max output bounds |  |
| Pagination or continuation handle |  |

## State and Safety

| Field | Decision |
|---|---|
| Idempotency key and scope |  |
| Concurrency/version guard |  |
| Preview/plan/apply semantics |  |
| Partial success or atomicity |  |
| Receipt returned after mutation |  |
| Secret and permission boundaries |  |

## Acceptance Evidence

- [ ] No-TTY/no-stdin test
- [ ] stdout/stderr parsing test
- [ ] Schema compatibility test
- [ ] Error repair test
- [ ] Retry/idempotency test
- [ ] Job or streaming lifecycle test
- [ ] Output-bound test
- [ ] Help/discovery test
- [ ] Destructive-action gate test
