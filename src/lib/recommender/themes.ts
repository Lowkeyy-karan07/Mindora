import { THEMES, Theme } from '@/types';
import { THEME_KEYWORDS } from './themeKeywords';

/**
 * Escapes characters with special meaning in RegExp.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks whether a single keyword or multi-word phrase appears in the note
 * as a distinct word or whole phrase (case-insensitive, whole-word boundaries).
 */
function matchesKeyword(note: string, keyword: string): boolean {
  // Use regex with non-word character or boundary delimiters
  const escaped = escapeRegExp(keyword.trim());
  const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:[^a-zA-Z0-9]|$)`, 'i');
  return regex.test(note);
}

/**
 * Detects situation-specific themes from a user's check-in note.
 *
 * Rules:
 * - Returns [] for empty or whitespace-only notes.
 * - Matching is case-insensitive.
 * - Uses whole-word / whole-phrase boundaries to avoid partial word matches (e.g., 'example' != 'exam').
 * - Deterministic output: maintains THEMES enum order.
 * - Pure function without side-effects or external dependencies.
 *
 * @param note The optional user check-in note
 * @returns Array of detected Theme values
 */
export function detectThemes(note?: string | null): Theme[] {
  if (!note || !note.trim()) {
    return [];
  }

  // Neutralize medical/health test phrases before checking academic keyword "test"
  const noteForAcademics = note.replace(
    /\b(?:medical|blood|lab|health|diagnostic|clinic|hospital)\s+tests?\b/gi,
    ''
  );

  const detected = new Set<Theme>();

  for (const theme of THEMES) {
    const keywords = THEME_KEYWORDS[theme] || [];
    const targetText = theme === 'academics' ? noteForAcademics : note;
    for (const keyword of keywords) {
      if (matchesKeyword(targetText, keyword)) {
        detected.add(theme);
        break; // theme already matched, move to next theme
      }
    }
  }

  // Return themes in deterministic order (THEMES order)
  return THEMES.filter((t) => detected.has(t));
}
