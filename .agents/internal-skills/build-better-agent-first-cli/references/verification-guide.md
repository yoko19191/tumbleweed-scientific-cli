# Verification Guide

Use this internal guide as a black-box test plan. Adapt commands and the project test framework, but preserve the assertions.

## Invocation

- Run a command with stdin closed and no TTY. Assert it exits within a bounded timeout.
- Omit each required input in turn. Assert there is no prompt and the error identifies the field and repair.
- Run with `--human` and `--interactive`. Assert they change rendering or input collection only, not the normalized request or side effect.
- Run under a non-default locale and with a pipe. Assert no hidden mode switch, pager, animation, or locale-dependent value formatting.

## Channels and Schemas

- Parse every successful stdout response as JSON, or every streaming stdout line as JSONL.
- Assert stdout contains no ANSI escape sequence, progress text, log line, or stack trace in machine mode.
- Parse stderr as the declared diagnostic/event format. Assert progress and errors do not contaminate stdout.
- Assert failures emit no success payload on stdout, a structured stderr error, and the documented non-zero exit code.
- Snapshot the success, error, and event Schemas. Fail on unreviewed field/type changes.

## Errors and Retries

- Send malformed, incomplete, unknown, unauthorized, conflicting, rate-limited, timed-out, and unavailable requests. Assert stable error codes, retryability, and repair hints.
- Repeat every mutation with the same idempotency key after a simulated timeout. Assert one effect and a reusable receipt.
- Repeat with the same key but different content. Assert an explicit conflict.
- Interrupt a local `wait` and assert the documented remote Job behavior; it must not silently cancel work.

## Jobs and Side Effects

- Submit a Job and assert an ID is returned before completion.
- Exercise every documented state transition, terminal state, cancellation path, timeout path, and result handle.
- Run a plan twice and apply the same plan twice. Assert target/version binding and no duplicate effect.
- Run batch operations with one failing item. Assert atomicity or per-item partial results exactly as documented.

## Bounds and Discovery

- Run list/search/log commands without a limit. Assert a finite default result.
- Exceed the maximum limit and assert a clear validation error.
- Force truncation. Assert `truncated`, total/omitted information where available, and a next cursor or handle.
- Invoke root and nested `--help`; invoke the machine Schema/capability command. Assert examples and descriptions match the executable parser.
