import { describe, it, expect } from 'vitest';
import { mapWithConcurrency, startBounded } from './concurrency.mjs';

/** A promise plus its resolve/reject, so a test can settle tasks by hand. */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('mapWithConcurrency', () => {
  it('runs every item and never exceeds the limit in flight', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let inFlight = 0;
    let peak = 0;
    const seen = [];
    await mapWithConcurrency(items, 3, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      seen.push(item);
      inFlight -= 1;
    });
    expect(seen.sort((a, b) => a - b)).toEqual(items);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('clamps the limit to at least 1 and handles an empty list', async () => {
    const seen = [];
    await mapWithConcurrency([1, 2], 0, async (n) => void seen.push(n));
    expect(seen.sort()).toEqual([1, 2]);
    await expect(mapWithConcurrency([], 4, async () => {})).resolves.toBeUndefined();
  });
});

describe('startBounded', () => {
  it('settles each item promise with { ok: true, value } in input order', async () => {
    const { results, done } = startBounded([1, 2, 3], 2, async (n) => n * 10);
    await done;
    expect(await Promise.all(results)).toEqual([
      { ok: true, value: 10 },
      { ok: true, value: 20 },
      { ok: true, value: 30 },
    ]);
  });

  it('isolates a failed item — its sibling promises still resolve ok', async () => {
    const boom = new Error('boom');
    const { results } = startBounded([1, 2, 3], 3, async (n) => {
      if (n === 2) throw boom;
      return n;
    });
    expect(await results[0]).toEqual({ ok: true, value: 1 });
    expect(await results[1]).toEqual({ ok: false, error: boom });
    expect(await results[2]).toEqual({ ok: true, value: 3 });
  });

  it('runs ahead bounded-parallel: at most `limit` tasks start before any settles', async () => {
    const gates = [deferred(), deferred(), deferred(), deferred()];
    let started = 0;
    let peak = 0;
    const { results } = startBounded([0, 1, 2, 3], 2, async (i) => {
      started += 1;
      peak = Math.max(peak, started);
      await gates[i].promise;
      started -= 1;
      return i;
    });

    // Give the producer a tick to fill its slots, then assert it stopped at 2.
    await new Promise((r) => setTimeout(r, 5));
    expect(peak).toBe(2);

    // Release task 0 — the producer should now pull task 2 into the freed slot.
    gates[0].resolve();
    expect(await results[0]).toEqual({ ok: true, value: 0 });
    gates[1].resolve();
    gates[2].resolve();
    gates[3].resolve();
    expect(await Promise.all(results)).toEqual([0, 1, 2, 3].map((value) => ({ ok: true, value })));
  });

  it('pipelines: a consumer can await item i before later items finish', async () => {
    const gate = deferred();
    const order = [];
    // limit 1 keeps the producer strictly in order so the assertion is deterministic.
    const { results } = startBounded([0, 1], 1, async (i) => {
      if (i === 1) await gate.promise; // item 1 hangs until released
      order.push(`done:${i}`);
      return i;
    });

    // Consumer pattern: await item 0 — must resolve while item 1 is still pending.
    expect(await results[0]).toEqual({ ok: true, value: 0 });
    order.push('consumed:0');
    expect(order).toEqual(['done:0', 'consumed:0']);

    gate.resolve();
    expect(await results[1]).toEqual({ ok: true, value: 1 });
  });

  it('handles an empty list', async () => {
    const { results, done } = startBounded([], 4, async () => {});
    expect(results).toEqual([]);
    await expect(done).resolves.toBeUndefined();
  });
});
