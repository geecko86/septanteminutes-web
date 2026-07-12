// scripts/dub/translate.mjs
//
// The disfluency-PRESERVING FR->EN translator for the dubbing cascade.
//
// This is deliberately the OPPOSITE of scripts/transcribe/postprocess.mjs's v2
// cleanup: that pass strips spoken disfluencies to make a transcript pleasant
// to READ; here we keep them so the dubbed speech sounds like a real person
// talking (hesitations, false starts, involuntary repetitions, fillers). The
// raw ASR cache still carries these — translate from it, never from the
// cleaned-up public transcript.
//
// Used by cascade.mjs: batch the clip's utterances through runStructuredPrompt
// with TRANSLATION_SCHEMA, mapping results back by id.

/**
 * JSON schema for one translation batch. Per input utterance we get back the
 * same integer id, one English string, and an `intensity` (0..1) rating of the
 * utterance's EMOTIONAL INTENSITY / arousal — used downstream to drive per-turn
 * EMOTION-ADAPTIVE expressiveness in the TTS engine (calm lines flat, heated
 * lines dramatic) instead of a single global exaggeration.
 */
export const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          en: { type: 'string' },
          // Emotional intensity / arousal of the utterance, 0 (flat/calm) ..
          // 1 (shouting/shock/anger). Required so EVERY utterance carries an
          // expressiveness rating; the cascade maps it to a TTS exaggeration.
          intensity: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['id', 'en', 'intensity'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

/**
 * Builds the disfluency-preserving translation prompt for a batch of French
 * utterances.
 *
 * @param {Array<{ id: number, text: string }>} utterances
 * @returns {string}
 */
export function buildTranslationPrompt(utterances) {
  const payload = utterances.map(({ id, text }) => ({ id, fr: text }));

  return [
    'You are translating the spoken French of a Belgian podcast into English for a DUB.',
    'The dub must sound like a real person actually talking. Two goals pull in opposite',
    'directions and you MUST honour BOTH at once:',
    '  (A) The WORDING must be natural, idiomatic, conversational American English — what a',
    '      native speaker would actually SAY out loud, not a word-for-word calque of the French.',
    '  (B) The DISFLUENCIES (hesitations, fillers, false starts, self-corrections, involuntary',
    '      repetitions) must be KEPT, one-for-one, in the same places — do NOT clean them up,',
    '      do NOT make it read like polished prose.',
    'Think of it as: translate the FLUENT parts idiomatically, but carry the BUMPS across verbatim.',
    '',
    'Natural, NOT over-literal (goal A):',
    '- Translate the MEANING and the idiom, never the surface words. Use the English a person would',
    '  actually utter; avoid French sentence shapes and calques.',
    '    "je pense que oui" -> "I think so" (NOT "I think that yes").',
    '    "ça fait que" -> "so" / "which means" (NOT "that makes that").',
    '    "il y a" -> "there\'s" / "there are" (NOT "it has there").',
    '    "c\'est-à-dire" -> "I mean" / "that is" (NOT "that is to say" unless it truly fits).',
    '    "en fait" -> "actually" / "I mean" (NOT "in fact" mechanically).',
    '    "tout à fait" -> "exactly" / "absolutely" (NOT "all to fact").',
    '- Keep the speaker\'s casual register: use contractions ("I\'m", "you\'re", "it\'s", "gonna",',
    '  "wanna", "kind of") as a real speaker would.',
    '',
    'KEEP every disfluency (goal B) — these are the WHOLE POINT, never drop or smooth them:',
    '- Hesitations / fillers, rendered as the natural English equivalent:',
    '    "euh" -> "uh", "bah"/"ben" -> "well", "hein" -> "huh" or "right", "quoi" (filler) -> "you know",',
    '    "voilà" (filler) -> "there you go" / "you know", "du coup" -> "so", "genre" -> "like".',
    '- False starts and self-corrections, mirroring the broken-off word and keeping the dash:',
    '    "au- aujourd\'hui" -> "to- today", "c\'est— enfin" -> "it\'s— I mean".',
    '- Involuntary repetitions, the same number of times: "je, je pense" -> "I, I think",',
    '    "le le truc" -> "the the thing".',
    '- Filler phrases where the French has "tu vois", "enfin", "genre": "you know" / "I mean" / "like".',
    '- If an utterance is ONLY a hesitation (e.g. "Euh…"), translate it to the equivalent English',
    '  hesitation ("Uh…") — never return it empty.',
    '',
    'Content fidelity:',
    '- Do NOT summarise, do NOT add content, do NOT drop content. Produce exactly ONE English string',
    '  per input utterance, with the SAME id.',
    '- Preserve Belgian-specific meaning naturally (e.g. "septante" = "seventy", "nonante" = "ninety",',
    '  "GSM" = "cell phone") but keep the casual tone.',
    '',
    'EMOTIONAL INTENSITY rating (the "intensity" field — this drives how dramatically the dub is',
    'voiced, so rate it honestly per utterance from the FRENCH source + surrounding context):',
    '- intensity is a number from 0 to 1 measuring the utterance\'s emotional AROUSAL / energy — how',
    '  worked-up the speaker is — NOT whether the content is positive or negative, and NOT how long it is.',
    '- Calibrate it like this:',
    '    0.1-0.3  flat / calm: a matter-of-fact statement, an aside, a quiet "voilà", routine narration.',
    '    0.3-0.5  neutral: ordinary conversational delivery, a plain question, mild interest.',
    '    0.5-0.7  animated / insistent: emphatic, excited, pressing a point, clearly engaged.',
    '    0.7-1.0  high arousal: shock, disbelief, indignation, anger, shouting, strong exclamation.',
    '- Cues that PUSH intensity UP: exclamation marks, ALL-CAPS or stretched words, "mais enfin!",',
    '  "c\'est pas possible!", "n\'importe quoi!", repeated emphatic words, swearing, incredulous',
    '  questions ("quoi?!", "sérieux?!"). Cues that keep it LOW: even pacing, hedging, a trailing',
    '  "…", purely informational content. A line being only a filler ("Euh…") is low (~0.1-0.2)',
    '  UNLESS the context makes it an emphatic outburst.',
    '- Judge the DELIVERY the words imply, independent of the wording you chose for "en".',
    '',
    'PUNCTUATION — English only (this matters; output is read aloud by a voice engine):',
    '- Use ONLY standard English punctuation. NEVER emit French quotation marks or guillemets',
    '  (« » „ " " ‹ ›) — if the French quotes something, use straight English quotes "like this".',
    '- NEVER copy French spacing-before-punctuation: write "it\'s, right?" not "it\'s , right ?".',
    '  No space before , . ; : ! ? — those marks sit tight against the previous word.',
    '- Do NOT let ANY source-language punctuation artifact leak through, especially a stray closing',
    '  guillemet » or « at the start/end of a line. Strip them; never carry them into the English.',
    '- Keep the em dash (—) ONLY where it marks a genuine self-correction/false start as shown above.',
    '',
    'Examples (French -> English: idiomatic wording, disfluencies kept, English punctuation only,',
    'plus the emotional-intensity rating). Note especially the FLAT line vs the HEATED line:',
    '  { "fr": "Euh, ben, je, je pense que c\'est, c\'est compliqué, quoi." }',
    '    -> { "en": "Uh, well, I, I think it\'s, it\'s complicated, you know.", "intensity": 0.35 }',
    '  { "fr": "Au- aujourd\'hui, du coup, on a euh décidé de, enfin, de continuer." }',
    '    -> { "en": "To- today, so, we, uh, decided to, I mean, to keep going.", "intensity": 0.3 }',
    '  // FLAT / calm — a quiet, matter-of-fact aside: low intensity.',
    '  { "fr": "Voilà. C\'est ça, hein." }',
    '    -> { "en": "There you go. That\'s it, right.", "intensity": 0.2 }',
    '  { "fr": "Il a dit « on verra », quoi, en fait je, je sais pas trop, hein." }',
    '    -> { "en": "He said \\"we\'ll see,\\" you know, actually I, I don\'t really know, right.", "intensity": 0.4 }',
    '  // HEATED — incredulous, shouting outburst: high intensity.',
    '  { "fr": "Mais enfin, c\'est, c\'est pas possible, ça! N\'importe quoi!" }',
    '    -> { "en": "Oh come on, that\'s, that\'s just not possible! That\'s ridiculous!", "intensity": 0.9 }',
    '',
    'Utterances to translate (JSON):',
    JSON.stringify(payload),
    '',
    'Answer strictly via the provided JSON schema:',
    '  { "items": [ { "id": <same id>, "en": "<idiomatic English, disfluencies kept, English punctuation>",',
    '                 "intensity": <number 0..1, the utterance\'s emotional arousal> }, ... ] }',
    'with exactly one item per input utterance, the same ids, and an intensity for EVERY item.',
  ].join('\n');
}
