/**
 * TypeScript types for episode transcripts.
 *
 * These types mirror the JSON schema produced by the transcription pipeline
 * (scripts/transcribe/) and stored in public/transcripts/{num}.json.
 *
 * Think of a TranscriptSegment like one line of a printed interview:
 * it knows who spoke, exactly when (in seconds from the start), and what was said.
 */

/** A single spoken segment — one "turn" or part of a turn in the conversation. */
export type TranscriptSegment = {
  /** Sequential index, 0-based, matches position in the segments array. */
  id: number;
  /** Start time in seconds from the beginning of the audio. */
  start: number;
  /** End time in seconds from the beginning of the audio. */
  end: number;
  /** Speaker identifier — key into the Transcript.speakers map (e.g. "speaker_0"). */
  speaker: string;
  /** The spoken text, punctuated and corrected by the post-processing pass. */
  text: string;
};

/** The full transcript for one episode. */
export type Transcript = {
  /**
   * Schema version.
   * - 0 = synthetic dev fixture (pipeline will regenerate on next run)
   * - 1 = real pipeline output
   */
  version: number;

  /** Episode number as a string, matching Episode.num (e.g. "84"). */
  num: string;

  /** BCP-47 language code (always "fr" for this podcast). */
  language: string;

  /** Human-readable map from speaker_id to display name, e.g. { "speaker_0": "Guillaume" }. */
  speakers: Record<string, string>;

  /** Ordered list of spoken segments covering the full episode. */
  segments: TranscriptSegment[];

  /** ISO 8601 timestamp of when this transcript was generated. */
  generatedAt?: string;

  /** ASR engine used, e.g. "elevenlabs/scribe_v2". */
  engine?: string;

  /** Post-processing pass applied, e.g. "claude-cli/opus". */
  postProcessing?: string;

  /**
   * Developer-only note field present only on synthetic fixtures (version 0).
   * Not present on real pipeline output.
   */
  _note?: string;
};
