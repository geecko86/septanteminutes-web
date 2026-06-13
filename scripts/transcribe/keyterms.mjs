// scripts/transcribe/keyterms.mjs
//
// Builds the ElevenLabs `keyterms` proper-noun hints for one episode:
// the show, the host, the guest, plus capitalized terms mined from the
// episode description (guest organizations, places, acronyms…).

import { SHOW_NAME, HOST_NAME } from './config.mjs';
import { getGuestName } from './episodes.mjs';
import { stripHtml } from './postprocess.mjs';

/** Words that are capitalized for grammatical reasons, not because they name something. */
const SINGLE_WORD_STOPLIST = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de',
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'si',
  'ce', 'cet', 'cette', 'ces', 'il', 'elle', 'ils', 'elles', 'on',
  'je', 'tu', 'nous', 'vous', 'mon', 'ma', 'mes', 'son', 'sa', 'ses',
  'pour', 'dans', 'sur', 'avec', 'sans', 'sous', 'chez', 'vers', 'entre',
  'quand', 'comment', 'pourquoi', 'parce', 'comme', 'alors', 'enfin',
  'bonjour', 'merci', 'bonne', 'bon', 'voilà', 'aujourd', "aujourd'hui",
]);

/** ElevenLabs rejects keyterms containing more than 4 spaces. */
const MAX_KEYTERM_SPACES = 4;
const MAX_KEYTERM_CHARS = 60;

/**
 * HTML → text for phrase mining. Unlike plain stripHtml, block boundaries
 * (</p>, <br>, </li>…) become sentence breaks — otherwise a name ending one
 * paragraph merges with a capitalized phrase opening the next into a single
 * bogus keyterm ("Mardaga Septante Minutes Avec Elisa Rojas").
 */
function descToText(html) {
  return stripHtml(
    String(html)
      .replace(/<br\s*\/?>/gi, '. ')
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '. '),
  );
}

/**
 * Extracts the keyterm list for an episode (deduplicated, capped, and
 * conforming to ElevenLabs limits).
 *
 * @param {{ title?: string, desc?: string }} episode
 * @param {{ max?: number }} [options]
 * @returns {string[]}
 */
export function extractKeyterms(episode, { max = 100 } = {}) {
  const base = [SHOW_NAME, HOST_NAME, getGuestName(episode?.title)].filter(Boolean);
  const seen = new Set(base.map((term) => term.toLowerCase()));

  const terms = [...base];
  for (const phrase of capitalizedPhrases(descToText(episode?.desc ?? ''))) {
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    if (phrase.split(' ').length - 1 > MAX_KEYTERM_SPACES) continue;
    if (phrase.length > MAX_KEYTERM_CHARS) continue;
    seen.add(key);
    terms.push(phrase);
  }

  return terms.slice(0, max);
}

/**
 * Yields capitalized words/phrases from plain text:
 * - consecutive capitalized words merge into one phrase ("Isabella Lenarduzzi");
 * - all-caps acronyms ("JUMP", "RTBF") are kept anywhere, even sentence-initial;
 * - a single capitalized word at the start of a sentence is skipped (it is
 *   capitalized grammatically, not semantically) unless it is an acronym;
 * - grammatical capitals ("Le", "Pour"…) are filtered via a stoplist.
 */
function capitalizedPhrases(text) {
  const phrases = [];
  const sentences = text.split(/(?<=[.!?…:;])\s+/u);

  for (const sentence of sentences) {
    const tokens = [...sentence.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu)];
    let group = [];
    let groupStartsSentence = false;

    const flush = () => {
      if (group.length === 0) return;
      const words = group.map((m) => m[0].replace(/[.,]+$/u, ''));
      const phrase = words.join(' ');
      if (group.length > 1) {
        phrases.push(phrase);
      } else {
        const word = words[0];
        const isAcronym = word.length >= 2 && /^[\p{Lu}\d.-]+$/u.test(word);
        const stoplisted = SINGLE_WORD_STOPLIST.has(word.toLowerCase());
        if (word.length >= 2 && !stoplisted && (isAcronym || !groupStartsSentence)) {
          phrases.push(phrase);
        }
      }
      group = [];
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const isCapitalized = /^\p{Lu}/u.test(token[0]);
      // Phrases only span tokens separated by plain whitespace — a comma or
      // other punctuation between two names means two distinct terms.
      const contiguous =
        group.length === 0 ||
        /^\s+$/u.test(sentence.slice(group[group.length - 1].index + group[group.length - 1][0].length, token.index));

      if (isCapitalized && contiguous) {
        if (group.length === 0) groupStartsSentence = i === 0;
        group.push(token);
      } else {
        flush();
        if (isCapitalized) {
          group = [token];
          groupStartsSentence = i === 0;
        }
      }
    }
    flush();
  }

  return phrases;
}
