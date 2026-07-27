---
name: build-better-agent-first-cli
description: Use when designing, implementing, reviewing, or refactoring a CLI whose primary caller is an AI agent or automation. Enforces a deterministic machine contract for commands, input, output, errors, jobs, retries, side effects, discovery, and bounded context use.
version: 1.0.0
license: MIT
metadata:
  author: yoko19191
  internal: true
  scope: repository-development
  tags: [agents, cli, automation, machine-contract, json, idempotency, jobs]
  related_skills: [build-better-agent-tools, build-better-skills]
---

# Build Better Agent-First CLI

## Overview

An agent-first CLI is a process-level machine protocol, not a human terminal UI with a JSON flag added later. Its default behavior must be deterministic, parseable, recoverable, composable, verifiable, and bounded in output size.

The machine contract is always enabled by default. `--human` may change presentation and `--interactive` may collect missing input, but neither may change command meaning, validation, side effects, state transitions, or exit semantics.

Use the normative rules in [the contract reference](references/agent-first-cli-contract.md) and the acceptance matrix in [the verification guide](references/verification-guide.md). Use [the contract matrix template](templates/contract-matrix.md) before implementation.

## When to Use

Use this skill when:

- creating a new CLI primarily called by an AI agent, shell automation, CI, or another program;
- adding commands, structured output, streaming, long-running jobs, or destructive operations to such a CLI;
- reviewing an existing CLI for hangs, ambiguous output, unsafe retries, context floods, or weak discovery;
- converting a human-first CLI into a machine-first interface.

Do not use it as a generic API design guide, an MCP/function-tool design guide, or a project-specific command reference. Use `build-better-agent-tools` for the agent-facing tool surface and keep domain facts in project documentation.

## Operating Rules

The contract uses three levels:

- **MUST**: a violation blocks an agent-first release.
- **SHOULD**: the default; a deviation needs a written reason and a test.
- **MAY**: optional capability that cannot weaken the machine contract.

Apply the following workflow in order:

1. **Classify the command surface.** Identify domains, leaf actions, read/write risk, expected duration, remote state, data volume, and whether an operation must survive the caller process. Mark each command as synchronous, streaming, or Job-based.
   - Done when every command has one clear domain action, an explicit side-effect level, and a stated completion model.
2. **Write the machine contract first.** Define the canonical command name, accepted input forms, normalized request, success envelope, error envelope, event schema, exit-code map, and configuration precedence. Keep flags and complete JSON input on the same validation path.
   - Done when a fresh caller can construct a valid request without reading implementation code.
3. **Design state and side effects.** Add idempotency for retriable mutations, optimistic concurrency for updates, and `plan/apply` or equivalent two-phase semantics for irreversible or high-impact actions. Model long work as a Job when it can outlive the caller, exceed normal timeouts, incur cost, or require polling/cancellation.
   - Done when a timeout, process crash, duplicate request, or stale resource cannot silently create a second effect.
4. **Design discovery and boundedness.** Make `--help` progressively useful and provide machine-readable Schema/capability discovery for structured commands. Add filtering, field selection, limits, pagination, cursors, ranges, and stable handles for large results.
   - Done when an agent can discover the next valid call and cannot accidentally load an unbounded result into context.
5. **Implement one semantic core.** Human and interactive modes must adapt rendering or input collection only. Do not maintain a second command implementation for human output.
   - Done when the same normalized request produces the same state transition regardless of TTY or presentation mode.
6. **Verify as a black box.** Run the checks in [the verification guide](references/verification-guide.md), including no-TTY/no-stdin execution, stdout/stderr separation, JSON/JSONL parsing, schema stability, exit codes, retry safety, Job transitions, truncation, and destructive-action gates.
   - Done when the tests prove the contract through the executable CLI, not only through internal functions.

## Default Machine Contract

- Successful non-streaming data: one JSON envelope on **stdout**.
- Streaming data: JSONL events on **stdout**, with a terminal `result` or `error` event.
- Progress, warnings, and diagnostics: structured JSON/JSONL on **stderr**.
- Failed invocation: no success payload on stdout; a structured error on stderr; exit code is authoritative.
- No prompts, colors, animation, pager, editor, locale-dependent formatting, or hidden TTY mode switches.
- Input validation happens before side effects whenever possible.
- Every mutation returns a verifiable receipt: ID, URL, status, version, path, or equivalent.

Use the envelope and event shapes in the contract reference. Keep field names and types stable; version breaking changes rather than silently changing them.

## Common Pitfalls

| Pitfall | Repair |
|---|---|
| A missing value opens a prompt | Fail immediately with a structured repair hint; accept explicit flags, JSON, file, or stdin. |
| Human text is mixed into JSON | Keep stdout data-only and stderr structured; make `--human` explicit. |
| `fixed schema` means frozen forever | Require stable, documented, versioned schemas with compatibility rules. |
| Similar status names drift across commands | Define one lifecycle vocabulary per CLI/domain and test transitions. |
| Network timeout causes duplicate creation | Use idempotency keys and return the existing receipt on replay. |
| `--yes` hides a dangerous mutation | Use a target-bound preview/plan and explicit apply token for high-impact actions. |
| A list or log command floods context | Add default/max limits, filters, cursors, ranges, truncation metadata, and follow-up handles. |
| Help is prose but not discoverable | Add structured Schema/capability output and document side effects, defaults, and examples. |
| Human and machine modes diverge | Normalize both modes into the same request and semantic core. |

## Verification Checklist

- [ ] The default invocation completes without TTY input, prompts, animation, or a pager.
- [ ] Success stdout parses as the declared JSON or JSONL contract.
- [ ] stderr contains only declared structured diagnostics in machine mode.
- [ ] Exit codes are small, stable, documented, and distinguish invocation/business failure from transport/system failure.
- [ ] Input flags and complete JSON use the same Schema and have explicit precedence/exclusivity.
- [ ] Errors include stable codes, repair hints, retryability, and partial-application state where relevant.
- [ ] Mutations are idempotent; updates detect stale versions; destructive operations have an explicit safety gate.
- [ ] Long work has a Job lifecycle with canonical states, polling, timeout, cancellation semantics, and verifiable results.
- [ ] Streaming output is JSONL only and has sequence numbers plus a terminal event.
- [ ] Help is hierarchical and structured Schema/capability discovery exists where needed.
- [ ] Large outputs are bounded and advertise truncation or the next retrieval handle.
- [ ] `--human` and `--interactive` change only presentation/input collection.
- [ ] Tests exercise the actual executable CLI and cover the failure paths above.

## One-Sentence Rule

If an agent cannot call the CLI without guessing, parse its result without scraping prose, recover without duplicating a side effect, and verify what happened afterward, the CLI is not agent-first yet.
