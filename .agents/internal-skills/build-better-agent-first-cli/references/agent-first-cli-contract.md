# Agent-First CLI Contract

This internal development reference is the normative companion to `SKILL.md`. Use `MUST` for release-blocking requirements, `SHOULD` for defaults that need an explicit exception, and `MAY` for optional extensions.

## Invocation and Modes

### AFCLI-001: Machine mode is the default

The CLI MUST behave as a non-interactive machine interface unless the caller explicitly selects `--human` or `--interactive`. It MUST NOT infer a semantic mode from TTY presence.

Missing input MUST fail promptly with a structured error. It MUST NOT wait for a prompt, pager, editor, key press, or implicit confirmation.

### AFCLI-002: Human modes are adapters

`--human` MAY add colors, tables, or prose. `--interactive` MAY collect input. Neither MAY alter the normalized request, validation, side effects, state transitions, or exit-code meaning.

## Command and Input Design

### AFCLI-003: Commands express one domain action

Commands SHOULD follow `<domain> <action>` with a clear leaf verb. The action MUST have one predictable intent and a documented side-effect level. Avoid ambiguous verbs such as `do`, `manage`, or `process`, and avoid aliases whose semantics differ.

### AFCLI-004: Input has one source of truth

Flags, complete JSON, files, and stdin MUST be validated against the same Schema. Commands MUST document whether input forms are mutually exclusive or how precedence works; silent merging is prohibited.

Complete JSON SHOULD be available for structured or batch operations through a file or stdin, not only a shell-quoted inline string. Secrets SHOULD avoid argv and MUST NOT be echoed.

### AFCLI-005: Configuration is inspectable

The precedence of flags, environment variables, config files, and defaults MUST be documented. A machine-readable effective-config or equivalent diagnostic SHOULD exist. Hidden profiles, working-directory magic, caches, and implicit network targets MUST NOT change semantics without being inspectable.

## Output and Errors

### AFCLI-006: stdout and stderr have separate contracts

Successful non-streaming data MUST be one JSON envelope on stdout. Progress, warnings, and diagnostics MUST be structured JSON/JSONL on stderr. On failure, stdout MUST NOT contain a success payload; stderr MUST contain the error envelope and the exit code MUST be non-zero.

### AFCLI-007: Envelopes are stable and versioned

Every structured result SHOULD include `schema_version`, `ok`, `data` or `error`, and `meta`. Field types, null/missing semantics, time format, and ordering rules MUST be documented. Breaking changes MUST be versioned.

Recommended success shape:

```json
{
  "schema_version": "1",
  "ok": true,
  "data": {},
  "meta": {"command": "jobs.submit", "request_id": "req_123"}
}
```

Recommended error shape:

```json
{
  "schema_version": "1",
  "ok": false,
  "error": {
    "code": "invalid_argument",
    "message": "model is required",
    "retryable": false,
    "details": {"field": "model"},
    "repair_hint": "Provide --model <id>."
  },
  "meta": {"command": "jobs.submit", "request_id": "req_123"}
}
```

### AFCLI-008: Errors are repairable

Errors MUST distinguish validation, authentication, authorization, not-found, conflict, rate-limit, timeout, remote failure, and internal failure where those distinctions change the next action. They MUST state whether the operation was not applied, partially applied, or completed despite the error.

### AFCLI-009: Exit codes are small and stable

The CLI MUST document a small exit-code taxonomy. Exit codes express broad result classes; structured error codes carry detailed causes and repair hints. A caller MUST NOT need to parse human text to determine success or retryability.

## Streaming and Jobs

### AFCLI-010: Streaming is JSONL

Machine-mode streams MUST contain one complete JSON event per line and MUST NOT mix prose, ANSI controls, or unframed logs. Events SHOULD include `type`, `seq`, `timestamp`, and `data`; a stream MUST end with a terminal `result` or `error` event.

### AFCLI-011: Long work uses a Job model

An operation MUST use a Job when it can outlive the caller process, exceed normal command timeouts, incur meaningful remote cost, or require polling, cancellation, or later result retrieval.

The Job lifecycle MUST use one canonical state vocabulary. A practical default is `queued`, `running`, `succeeded`, `failed`, and `canceled`; additional states need distinct semantics. `wait` timeout SHOULD stop local waiting without silently canceling the remote Job.

### AFCLI-012: Job results are verifiable

Job submission MUST return a stable Job ID before long work completes. Status, timestamps, owner/target, error details, cancellation result, and output handles MUST be queryable afterward.

## Side Effects, Retries, and Safety

### AFCLI-013: Mutations are idempotent

Create, send, charge, publish, and other retriable mutations MUST accept an idempotency key or an equivalent deterministic request identity. Replaying the same request MUST return the original receipt or a clear conflict, never create a second effect.

### AFCLI-014: Updates protect against stale state

Updates SHOULD require an expected version, ETag, generation, or equivalent concurrency token when a stale write could overwrite another change. Conflicts MUST be explicit and retry guidance MUST be safe.

### AFCLI-015: High-impact changes use two phases

Irreversible, broad, expensive, or externally visible operations MUST support preview/plan followed by apply. The apply token MUST bind the target, action, relevant version, and expiry. `--yes` alone is not a sufficient safety protocol for high-impact changes.

### AFCLI-016: Partial success is explicit

Batch operations MUST declare whether they are atomic. If partial success is allowed, each item MUST have its own status and receipt, and the process exit/result MUST make partial completion visible.

## Discovery, Bounds, and Verification

### AFCLI-017: Help is progressive and truthful

`--help` MUST describe purpose, required/optional arguments, types, defaults, enums, side effects, output mode, exit codes, and at least one valid example. Help MUST remain aligned with the executable parser.

### AFCLI-018: Schema is self-describing

Structured commands MUST expose machine-readable input and output Schemas through `--schema`, `schema <command>`, `capabilities`, or an equivalent interface. The description SHOULD cover success, error, and event shapes.

### AFCLI-019: Output is bounded

List, search, log, and history commands MUST have a default limit and a maximum limit. They SHOULD support filters, field selection, ranges, pagination, or cursors. Truncation MUST be explicit and provide a next handle when more data exists.

### AFCLI-020: Completion is black-box verifiable

The release MUST test the executable CLI for no-TTY/no-stdin behavior, JSON/JSONL parsing, channel separation, exit codes, schema stability, idempotent replay, Job transitions, timeout/cancellation semantics, output limits, and destructive-action gates.
