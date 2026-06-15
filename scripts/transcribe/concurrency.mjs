// scripts/transcribe/concurrency.mjs
//
// Concurrency primitives for the transcription pipeline:
//   - mapWithConcurrency: a minimal worker pool (used by the Claude
//     correction-chunk pass and the --asr-only batch).
//   - startBounded: a producer that runs ahead, bounded-parallel, exposing a
//     per-item promise so a sequential consumer can await results in order
//     (used to pipeline the parallel ASR producer into the sequential Claude
//     consumer).

/**
 * @template T
 * @param {T[]} items
 * @param {number} limit max tasks in flight (clamped to [1, items.length])
 * @param {(item: T) => Promise<void>} fn
 */
export async function mapWithConcurrency(items, limit, fn) {
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        if (index >= items.length) return;
        await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
}

/**
 * Bounded "start N ahead" producer. Eagerly runs `fn` over `items` with at most
 * `limit` tasks in flight, and returns a `results` array of promises — one per
 * item, in input order — that settle as each task finishes.
 *
 * This pipelines a parallel producer into a sequential consumer: the consumer
 * does `for (let i = 0; i < items.length; i++) { const r = await results[i]; … }`
 * and processes item i as soon as its task resolves, while the producer keeps
 * filling later slots up to `limit`. Because the producer is bounded, at most
 * `limit` tasks (and their in-memory results) are live at once; once the
 * consumer has awaited a slot it can let the result be GC-able.
 *
 * Each promise resolves with `{ ok: true, value }` or `{ ok: false, error }` so
 * one failed item never rejects a shared promise or aborts its siblings — the
 * consumer decides per item how to handle a failure.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit max tasks in flight (clamped to [1, items.length])
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {{ results: Promise<{ ok: true, value: R } | { ok: false, error: Error }>[], done: Promise<void> }}
 *   `results[i]` settles when item i's task finishes; `done` resolves once every
 *   task has settled (handy when there is no consumer, e.g. --asr-only).
 */
export function startBounded(items, limit, fn) {
  const settle = items.map(() => {
    let resolve;
    const promise = new Promise((res) => {
      resolve = res;
    });
    return { promise, resolve };
  });

  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        if (index >= items.length) return;
        try {
          settle[index].resolve({ ok: true, value: await fn(items[index], index) });
        } catch (error) {
          settle[index].resolve({ ok: false, error });
        }
      }
    },
  );

  return { results: settle.map((s) => s.promise), done: Promise.all(workers).then(() => undefined) };
}
