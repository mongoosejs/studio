# Agent eval harness

Standalone (non-Mocha) harness for evaluating the chat agent end-to-end.

It spins up an in-memory MongoDB, seeds fixture databases, runs each case through `runChatAgent`, executes the agent's final script in the same `createSandbox` used in production, and asserts against the script's return value.

## Run it

```
ANTHROPIC_API_KEY=... npm run eval:agent
```

OpenAI and Google Gemini keys also work — set exactly one of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GEMINI_API_KEY`.

## Common flags

```
node eval/agent/run.js --category=safety
node eval/agent/run.js --id=simple-2-most-expensive-product --runs=3
node eval/agent/run.js --model=claude-haiku-4-5-20251001
node eval/agent/run.js --no-traces
```

See `--help` for the full list.

## Structure

- `run.js` — CLI entrypoint.
- `cases.js` — the regression suite; each case has a prompt, fixture, and an `assert(trace)` function.
- `fixtures/` — schemas + seed data for the `ecommerce` and `carsharing` worlds.
- `traces/<run-id>/` — JSON traces (one per case/run) written on every invocation unless `--no-traces`.

## Adding a case

Each entry in `cases.js` is `{ id, category, fixture, prompt, assert(trace) }`.
The `assert` function receives the captured trace and runs native `node:assert/strict` checks; any thrown assertion fails the case.
The trace exposes `text`, `finalCode`, `toolCalls`, `toolResults`, `output`, `logs`, `executionError`, and `durationMs`.
`trace.output` is the value returned by running the agent's final script in `createSandbox` against the seeded fixture connection.
The fixture database is dropped after each case, so any writes the script makes are discarded.

## Exit code

The script exits non-zero if the overall pass rate is below `--threshold` (default `0.8`), making it usable in CI once an agent budget is allocated.

## Layers covered

Outcome tests via real sandbox execution plus targeted tool-trajectory checks. LLM-as-judge graders are deliberately out of scope.
