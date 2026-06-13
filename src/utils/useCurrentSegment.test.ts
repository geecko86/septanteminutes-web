/**
 * Unit tests for findSegmentIndex — the pure binary search at the heart
 * of transcript highlight synchronisation.
 *
 * These tests cover every edge case the plan requires:
 *   - empty array
 *   - t before first segment
 *   - exact boundary (t == segment.start)
 *   - mid-gap (t falls between two segments)
 *   - past last segment
 */

import { describe, it, expect } from 'vitest';
import { findSegmentIndex } from './useCurrentSegment';
import type { TranscriptSegment } from '../types/transcript';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal segment array for testing.
 * Each entry has start/end times; text and speaker are irrelevant here.
 */
function makeSegments(pairs: [start: number, end: number][]): TranscriptSegment[] {
  return pairs.map(([start, end], id) => ({
    id,
    start,
    end,
    speaker: 'speaker_0',
    text: `segment ${id}`,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('findSegmentIndex', () => {
  it('returns -1 for an empty segments array', () => {
    expect(findSegmentIndex([], 5)).toBe(-1);
  });

  it('returns -1 when t is before the first segment start', () => {
    const segs = makeSegments([[2.0, 5.0], [6.0, 9.0]]);
    expect(findSegmentIndex(segs, 0)).toBe(-1);
    expect(findSegmentIndex(segs, 1.99)).toBe(-1);
  });

  it('returns 0 when t equals the exact start of the first segment', () => {
    const segs = makeSegments([[2.0, 5.0], [6.0, 9.0]]);
    expect(findSegmentIndex(segs, 2.0)).toBe(0);
  });

  it('returns the correct index when t falls in the middle of a segment', () => {
    const segs = makeSegments([[1.0, 4.0], [5.0, 8.0], [9.0, 12.0]]);
    // t=6.5 is inside segment 1 (start=5.0)
    expect(findSegmentIndex(segs, 6.5)).toBe(1);
  });

  it('returns the earlier segment index when t falls in a gap between two segments', () => {
    // Gap between segment 0 (end=4.0) and segment 1 (start=6.0)
    const segs = makeSegments([[1.0, 4.0], [6.0, 9.0]]);
    // t=5.0 is after segment 0's start but before segment 1's start
    expect(findSegmentIndex(segs, 5.0)).toBe(0);
  });

  it('returns the last segment index when t is past the final segment end', () => {
    const segs = makeSegments([[1.0, 4.0], [6.0, 9.0], [10.0, 15.0]]);
    expect(findSegmentIndex(segs, 9999)).toBe(2);
  });

  it('returns the correct index for an exact start boundary mid-array', () => {
    const segs = makeSegments([[1.0, 3.0], [5.0, 8.0], [10.0, 14.0]]);
    // t exactly equals start of segment 2
    expect(findSegmentIndex(segs, 10.0)).toBe(2);
  });

  it('handles a single-segment array correctly', () => {
    const segs = makeSegments([[3.0, 7.0]]);
    expect(findSegmentIndex(segs, 0)).toBe(-1);   // before
    expect(findSegmentIndex(segs, 3.0)).toBe(0);  // exact start
    expect(findSegmentIndex(segs, 5.0)).toBe(0);  // inside
    expect(findSegmentIndex(segs, 9.0)).toBe(0);  // after end
  });
});
