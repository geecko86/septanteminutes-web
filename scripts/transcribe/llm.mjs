// scripts/transcribe/llm.mjs
//
// Backend-agnostic structured-output prompts against Claude.
// Primary backend: the `claude` CLI (Opus, subscription auth via keychain).
// Fallback: @anthropic-ai/sdk when the CLI is unavailable but
// ANTHROPIC_API_KEY is set.

import { spawn } from 'node:child_process';
import { ROOT_DIR, CLAUDE_CLI_MODEL, ANTHROPIC_SDK_MODEL, LLM_TIMEOUT_MS } from './config.mjs';

// Opus 4.8 pricing, used to estimate SDK-backend cost from usage.
const SDK_INPUT_USD_PER_MTOK = 5;
const SDK_OUTPUT_USD_PER_MTOK = 25;

let backendPromise = null;
let resolvedModel = null;

/** Thrown for retryable LLM transport/format failures. */
export class LlmCallError extends Error {}

/**
 * Thrown when the Claude subscription quota is exhausted. Unlike LlmCallError
 * this is NOT retryable — the pipeline should abort immediately on seeing it.
 */
export class QuotaExhaustedError extends Error {}

const QUOTA_PATTERNS = /usage.?limit|quota.?exceed|credit.?exhaust|out.?of.?credit|billing|insufficient.?credit/i;

/**
 * The concrete model id the CLI alias resolved to (e.g. 'opus' →
 * 'claude-opus-4-8'), captured from the first successful call's envelope.
 * Null until a CLI call succeeds; the SDK backend uses its pinned id instead.
 */
export function getResolvedModel() {
  return resolvedModel;
}

/**
 * Detects the backend once per run and logs the choice.
 * @returns {Promise<{ type: 'cli' | 'sdk', label: string }>}
 */
export function detectBackend({ log = console.log } = {}) {
  backendPromise ??= (async () => {
    if (await claudeCliAvailable()) {
      const backend = { type: 'cli', label: `claude-cli/${CLAUDE_CLI_MODEL}` };
      log(`llm: using backend ${backend.label}`);
      return backend;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      const backend = { type: 'sdk', label: `anthropic-sdk/${ANTHROPIC_SDK_MODEL}` };
      log(`llm: claude CLI unavailable, using backend ${backend.label}`);
      return backend;
    }
    throw new Error(
      'No Claude backend available: install the `claude` CLI or set ANTHROPIC_API_KEY in .env.local',
    );
  })();
  return backendPromise;
}

/** Test seam: forget the cached backend decision. */
export function resetBackend() {
  backendPromise = null;
  resolvedModel = null;
}

/**
 * Runs one prompt with a JSON-schema-constrained output.
 *
 * @param {{ prompt: string, schema: object, timeoutMs?: number, log?: (msg: string) => void }} params
 * @returns {Promise<{ output: object, costUsd: number }>}
 */
export async function runStructuredPrompt({ prompt, schema, timeoutMs = LLM_TIMEOUT_MS, log = console.log }) {
  const backend = await detectBackend({ log });
  return backend.type === 'cli'
    ? runViaCli({ prompt, schema, timeoutMs })
    : runViaSdk({ prompt, schema });
}

function claudeCliAvailable() {
  return new Promise((resolve) => {
    const child = spawn('claude', ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Verified invocation for claude CLI 2.1.x:
 * - prompt is piped on stdin (never argv), args passed as an array (no shell);
 * - --max-turns must be 2: the structured-output response consumes a
 *   tool-use turn (with 1 the envelope comes back as subtype "error_max_turns");
 * - no --bare: bare mode skips keychain auth and fails with "Not logged in";
 * - stdout is a JSON envelope; the validated object is in .structured_output.
 */
function runViaCli({ prompt, schema, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--model', CLAUDE_CLI_MODEL,
      '--effort', 'medium',
      '--tools', '',
      '--max-turns', '2',
      '--no-session-persistence',
      '--output-format', 'json',
      '--json-schema', JSON.stringify(schema),
    ];
    const child = spawn('claude', args, {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
    });

    let stdout = '';
    let stderr = '';
    let spawnErrored = false;
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => {
      spawnErrored = true;
      reject(new LlmCallError(`claude CLI spawn failed: ${error.message}`));
    });

    child.on('close', (code, signal) => {
      // 'close' fires after 'error' too (code=null) — the real cause was already rejected.
      if (spawnErrored) return;
      if (signal) {
        const detail = tail(stderr || stdout);
        reject(
          new LlmCallError(
            `claude CLI killed by ${signal} (timeout ${timeoutMs}ms?)${detail ? `: ${detail}` : ''}`,
          ),
        );
        return;
      }
      if (code !== 0) {
        const detail = tail(stderr || stdout);
        if (QUOTA_PATTERNS.test(detail)) {
          reject(new QuotaExhaustedError(`Claude quota exhausted: ${detail}`));
        } else {
          reject(new LlmCallError(`claude CLI exited with code ${code}: ${detail}`));
        }
        return;
      }

      let envelope;
      try {
        envelope = JSON.parse(stdout);
      } catch {
        reject(new LlmCallError(`claude CLI produced unparseable stdout: ${tail(stdout)}`));
        return;
      }

      if (envelope.subtype !== 'success' || envelope.is_error || envelope.structured_output == null) {
        const detail = tail(envelope.result ?? '');
        if (QUOTA_PATTERNS.test(detail)) {
          reject(new QuotaExhaustedError(`Claude quota exhausted: ${detail}`));
        } else {
          reject(
            new LlmCallError(
              `claude CLI call failed (subtype=${envelope.subtype}, is_error=${envelope.is_error}): ${detail}`,
            ),
          );
        }
        return;
      }

      // The alias ('opus') resolves server-side; record the concrete model id
      // for transcript provenance. The main model is the modelUsage entry that
      // generated the most output tokens (the CLI also runs a small helper).
      const usage = envelope.modelUsage ?? {};
      const main = Object.keys(usage).sort(
        (a, b) => (usage[b]?.outputTokens ?? 0) - (usage[a]?.outputTokens ?? 0),
      )[0];
      if (main) resolvedModel = main;

      resolve({ output: envelope.structured_output, costUsd: envelope.total_cost_usd ?? 0 });
    });

    child.stdin.on('error', () => {}); // EPIPE if the child dies early; surfaced via 'close'
    child.stdin.end(prompt);
  });
}

async function runViaSdk({ prompt, schema }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();

  let response;
  try {
    response = await client.messages.create({
      model: ANTHROPIC_SDK_MODEL,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    });
  } catch (error) {
    if (QUOTA_PATTERNS.test(error.message)) throw new QuotaExhaustedError(`Claude quota exhausted: ${error.message}`);
    throw new LlmCallError(`Anthropic SDK call failed: ${error.message}`);
  }

  const text = response.content.find((block) => block.type === 'text')?.text;
  if (!text || response.stop_reason === 'refusal') {
    throw new LlmCallError(`Anthropic SDK returned no usable output (stop_reason=${response.stop_reason})`);
  }

  let output;
  try {
    output = JSON.parse(text);
  } catch {
    throw new LlmCallError(`Anthropic SDK output is not valid JSON: ${tail(text)}`);
  }

  const { input_tokens: inTok = 0, output_tokens: outTok = 0 } = response.usage ?? {};
  const costUsd = (inTok * SDK_INPUT_USD_PER_MTOK + outTok * SDK_OUTPUT_USD_PER_MTOK) / 1_000_000;
  return { output, costUsd };
}

function tail(text, max = 400) {
  const trimmed = String(text).trim();
  return trimmed.length <= max ? trimmed : `…${trimmed.slice(-max)}`;
}
