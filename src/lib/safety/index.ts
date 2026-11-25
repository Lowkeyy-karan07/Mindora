/**
 * Mindora Safety Trigger
 *
 * IMPORTANT NOTICE:
 * This is a basic, phrase-based crisis trigger, NOT a reliable risk assessment,
 * diagnostic tool, or clinical evaluation.
 *
 * In accordance with the Mindora specification, this check runs first prior to
 * any recommendation generation or LLM interaction. If triggered, Mindora immediately
 * bypasses AI calls and presents human-centered crisis resources (trusted contacts,
 * local emergency services, and local crisis hotlines).
 */

import { CRISIS_PHRASES } from './phrases';

export interface SafetyCheckResult {
  triggered: boolean;
  matchedPhrase?: string;
}

/**
 * Normalizes text for whole-phrase matching:
 * - Converts to lower case
 * - Normalizes unicode (NFKD)
 * - Replaces hyphens and underscores with spaces so "self-harm" matches "self harm"
 * - Removes apostrophes so "don't" matches "dont"
 * - Replaces punctuation with spaces
 * - Collapses consecutive whitespace
 * - Wraps with boundary spaces for exact token/phrase boundary detection
 */
function normalizeForMatching(text: string): string {
  const cleaned = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[-_]/g, ' ')
    .replace(/['’‘]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .join(' ');

  return ` ${cleaned} `;
}

/**
 * Pre-normalized phrase cache for optimal runtime performance
 */
const NORMALIZED_CRISIS_PHRASES: { original: string; normalized: string }[] =
  CRISIS_PHRASES.map((phrase) => ({
    original: phrase,
    normalized: normalizeForMatching(phrase),
  }));

/**
 * Evaluates user input against the curated crisis phrase list.
 * Matches complete phrases using word/phrase boundaries, never isolated words like "kill" or "hurt".
 *
 * @param note User-provided text (e.g. check-in note, journal entry)
 * @returns { triggered: boolean, matchedPhrase?: string }
 */
export function checkSafety(note: string): SafetyCheckResult {
  if (!note || typeof note !== 'string') {
    return { triggered: false };
  }

  const normalizedNote = normalizeForMatching(note);

  // If the normalized note is effectively empty
  if (normalizedNote === '  ') {
    return { triggered: false };
  }

  for (const { original, normalized } of NORMALIZED_CRISIS_PHRASES) {
    if (normalizedNote.includes(normalized)) {
      return {
        triggered: true,
        matchedPhrase: original,
      };
    }
  }

  return { triggered: false };
}

export * from './phrases';
