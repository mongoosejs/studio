#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const studio = require('../..');
const runChatAgent = require('../../backend/chatAgent/runChatAgent');
const createSandbox = require('../../backend/sandbox/createSandbox');
const allCases = require('./cases');
const fixtures = {
  ecommerce: require('./fixtures/ecommerce'),
  carsharing: require('./fixtures/carsharing')
};

const args = parseArgs(process.argv.slice(2));

studio.enableDebugging();

main().catch(err => {
  console.error(err);
  process.exit(1);
});

async function main() {
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const llmOptions = buildLlmOptionsFromEnv();
  if (!llmOptions) {
    console.error('No LLM API key found. Set one of:');
    console.error('  ANTHROPIC_API_KEY');
    console.error('  OPENAI_API_KEY');
    console.error('  GOOGLE_GEMINI_API_KEY');
    process.exit(1);
  }
  if (args.model) {
    llmOptions.model = args.model;
  }

  const selected = filterCases(allCases, args);
  if (selected.length === 0) {
    console.error('No cases matched the filter.');
    process.exit(1);
  }
  const runs = args.runs ?? 1;

  let replSet = null;
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('Starting in-memory MongoDB replSet...');
    replSet = await MongoMemoryReplSet.create({
      replSet: { name: 'rs0', count: 1 },
      binary: { version: process.env.MONGOMS_VERSION || '8.0.0' }
    });
    uri = replSet.getUri();
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const traceDir = args.noTraces ? null : path.join(__dirname, 'traces', runId);
  if (traceDir) {
    fs.mkdirSync(traceDir, { recursive: true });
    console.log(`Writing traces to ${traceDir}`);
  }

  console.log(`Running ${selected.length} case(s) × ${runs} run(s) using provider "${llmOptions.providerName}" (${llmOptions.model || 'default model'})\n`);

  const results = [];
  for (const caseDef of selected) {
    for (let i = 0; i < runs; i++) {
      const result = await runCase(uri, caseDef, llmOptions);
      result.runIndex = i;
      results.push(result);
      if (traceDir) {
        const filename = `${caseDef.id}${runs > 1 ? `__run${i}` : ''}.json`;
        fs.writeFileSync(path.join(traceDir, filename), JSON.stringify(serializeResult(result), null, 2));
      }
      printCaseLine(result);
    }
  }

  printSummary(results);

  if (replSet) {
    await replSet.stop();
  }

  const overallPass = results.filter(r => r.passed).length / results.length;
  process.exit(overallPass >= (args.threshold ?? 0.8) ? 0 : 1);
}

async function runCase(uri, caseDef, llmOptions) {
  const fixture = fixtures[caseDef.fixture];
  if (!fixture) {
    return {
      caseDef,
      trace: emptyTrace(caseDef),
      assertionError: new Error(`unknown fixture "${caseDef.fixture}"`),
      passed: false
    };
  }

  const dbName = `eval_${caseDef.id.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;
  const conn = mongoose.createConnection();
  await conn.openUri(uri, { dbName });

  let trace = emptyTrace(caseDef);
  trace.model = llmOptions.model || null;
  trace.provider = llmOptions.providerName;

  const started = Date.now();
  try {
    const models = fixture.defineModels(conn);
    await fixture.seed(models);

    const stream = runChatAgent({
      db: conn,
      llmMessages: [{ role: 'user', content: [{ type: 'text', text: caseDef.prompt }] }],
      currentDateTime: caseDef.currentDateTime ?? '2026-05-13T12:00:00',
      options: llmOptions
    });

    for await (const event of stream) {
      if (typeof event === 'string') {
        trace.text += event;
      } else if (event.toolCall) {
        trace.toolCalls.push({ toolName: event.toolCall.toolName, input: event.toolCall.input });
      } else if (event.toolResult) {
        trace.toolResults.push({ toolName: event.toolResult.toolName, output: summarizeToolOutput(event.toolResult.output) });
      }
    }
  } catch (err) {
    trace.error = err?.message || String(err);
  }
  trace.durationMs = Date.now() - started;
  trace.finalCode = extractFinalCode(trace.text);

  await executeFinalCode(conn, trace);

  try {
    await conn.dropDatabase();
  } catch (_) { /* ignore */ }
  await conn.close();

  let assertionError = null;
  try {
    caseDef.assert(trace);
  } catch (err) {
    assertionError = err;
  }
  const passed = !trace.error && !assertionError;

  return { caseDef, trace, assertionError, passed };
}

async function executeFinalCode(conn, trace) {
  if (!trace.finalCode) {
    return;
  }
  const sandbox = createSandbox({ db: conn });
  try {
    trace.output = await sandbox.runScript({ script: trace.finalCode });
    trace.logs = sandbox.getLogs();
  } catch (err) {
    trace.executionError = err?.message || String(err);
  } finally {
    try { await sandbox.close(); } catch (_) { /* ignore */ }
  }
}

function emptyTrace(caseDef) {
  return {
    caseId: caseDef.id,
    category: caseDef.category,
    fixture: caseDef.fixture,
    prompt: caseDef.prompt,
    text: '',
    toolCalls: [],
    toolResults: [],
    finalCode: null,
    output: undefined,
    logs: null,
    executionError: null,
    error: null,
    durationMs: 0
  };
}

function extractFinalCode(text) {
  if (!text) return null;
  const matches = [...text.matchAll(/```(?:javascript|js)?\s*\n([\s\S]*?)```/g)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1].trim();
}

function summarizeToolOutput(output) {
  if (output == null) return null;
  if (typeof output !== 'object') return output;
  const summary = {};
  for (const [k, v] of Object.entries(output)) {
    if (Array.isArray(v)) {
      summary[k] = { __array: true, length: v.length, sample: v.slice(0, 2) };
    } else if (v && typeof v === 'object') {
      const str = safeStringify(v);
      summary[k] = str.length > 500 ? str.slice(0, 500) + '...[truncated]' : v;
    } else {
      summary[k] = v;
    }
  }
  return summary;
}

function safeStringify(v) {
  try { return JSON.stringify(v); } catch (_) { return String(v); }
}

function serializeResult(result) {
  return {
    caseId: result.caseDef.id,
    category: result.caseDef.category,
    fixture: result.caseDef.fixture,
    prompt: result.caseDef.prompt,
    runIndex: result.runIndex,
    passed: result.passed,
    assertionError: result.assertionError
      ? { message: result.assertionError.message, stack: result.assertionError.stack }
      : null,
    trace: result.trace
  };
}

function buildLlmOptionsFromEnv() {
  if (process.env.ANTHROPIC_API_KEY) {
    return { anthropicAPIKey: process.env.ANTHROPIC_API_KEY, providerName: 'anthropic' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { openAIAPIKey: process.env.OPENAI_API_KEY, providerName: 'openai' };
  }
  if (process.env.GOOGLE_GEMINI_API_KEY) {
    return { googleGeminiAPIKey: process.env.GOOGLE_GEMINI_API_KEY, providerName: 'google' };
  }
  return null;
}

function filterCases(cases, args) {
  return cases.filter(c => {
    if (args.id && c.id !== args.id) return false;
    if (args.category && c.category !== args.category) return false;
    return true;
  });
}

function printCaseLine(result) {
  const status = result.passed ? 'PASS' : 'FAIL';
  const symbol = result.passed ? '✓' : '✗';
  const dur = `${result.trace.durationMs}ms`;
  const tools = `${result.trace.toolCalls.length} tool calls`;
  console.log(`  ${symbol} [${status}] ${result.caseDef.category}/${result.caseDef.id} — ${dur}, ${tools}`);
  if (!result.passed) {
    if (result.trace.error) {
      console.log(`      error: ${result.trace.error}`);
    }
    if (result.assertionError) {
      console.log(`      assertion: ${result.assertionError.message}`);
    }
  }
}

function printSummary(results) {
  const byCategory = {};
  for (const r of results) {
    const cat = r.caseDef.category;
    byCategory[cat] = byCategory[cat] || { passed: 0, total: 0 };
    byCategory[cat].total += 1;
    if (r.passed) byCategory[cat].passed += 1;
  }
  console.log('\n=== Summary ===');
  for (const [cat, { passed, total }] of Object.entries(byCategory)) {
    const pct = ((passed / total) * 100).toFixed(0);
    console.log(`  ${cat.padEnd(12)} ${passed}/${total} (${pct}%)`);
  }
  const totalPassed = results.filter(r => r.passed).length;
  const pct = ((totalPassed / results.length) * 100).toFixed(0);
  console.log(`  ${'overall'.padEnd(12)} ${totalPassed}/${results.length} (${pct}%)`);
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') { out.help = true; continue; }
    if (arg === '--no-traces') { out.noTraces = true; continue; }
    const m = arg.match(/^--([a-zA-Z-]+)=(.*)$/);
    if (m) {
      const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = m[2];
      out[key] = /^\d+$/.test(value) ? Number(value) : value;
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node eval/agent/run.js [options]

Options:
  --id=<case-id>          Run only the case with this id
  --category=<name>       Run only cases in this category (simple|nested|dashboard|ambiguous)
  --runs=<n>              Run each case N times (default 1)
  --model=<id>            Override LLM model (e.g. claude-haiku-4-5-20251001)
  --threshold=<0..1>      Exit non-zero if overall pass rate is below this (default 0.8)
  --no-traces             Don't write trace JSON files to disk
  --help                  Show this help

Environment:
  ANTHROPIC_API_KEY | OPENAI_API_KEY | GOOGLE_GEMINI_API_KEY (set exactly one)
  MONGODB_URI             Use an existing MongoDB instead of the in-memory replSet
  MONGOMS_VERSION         MongoDB version for the in-memory replSet
`);
}
