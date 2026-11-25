import { GoogleGenAI } from '@google/genai';

export type AiErrorCategory =
  | 'missing key'
  | 'invalid key'
  | 'quota'
  | 'timeout'
  | 'truncated'
  | 'empty response'
  | 'bad JSON'
  | 'request error';

export interface AiTelemetryData {
  last_ai_call: string;
  note_sent: boolean;
}

let aiTelemetry: AiTelemetryData = {
  last_ai_call: 'none',
  note_sent: false,
};

export function recordAiTelemetry(status: string, noteSent: boolean): void {
  aiTelemetry = {
    last_ai_call: status,
    note_sent: noteSent,
  };
}

export function getAiTelemetry(): AiTelemetryData {
  return { ...aiTelemetry };
}

export function resetAiTelemetry(): void {
  aiTelemetry = {
    last_ai_call: 'none',
    note_sent: false,
  };
}

/**
 * Removes markdown code block fences (```json ... ``` or ``` ... ```) and trims whitespace.
 */
export function stripCodeFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

/**
 * Extracts and cleans a JSON substring from raw text:
 * 1. Strips ```json or ``` fences and trims.
 * 2. If valid JSON directly, returns it.
 * 3. If parsing still fails, extracts the substring from the first "{" to the last "}".
 * 4. Returns empty string if raw is empty/undefined or no valid brace boundaries exist.
 */
export function extractJson(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  let cleaned = stripCodeFences(raw);
  if (!cleaned) {
    return '';
  }

  // If already directly valid JSON, return it
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // If parsing fails, take substring from first "{" to last "}"
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1).trim();
      return candidate;
    }

    return cleaned;
  }
}

/**
 * Resolves the operational Gemini model name:
 * - Uses process.env.GEMINI_MODEL or default 'gemini-3.5-flash'.
 * - Safely maps deprecated model identifiers (e.g. 'gemini-2.5-flash', 'gemini-2.0-flash')
 *   to active working model 'gemini-3.5-flash'.
 */
export function resolveModelName(model?: string): string {
  const chosen = (model || process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim();
  if (chosen === 'gemini-2.5-flash' || chosen === 'gemini-2.0-flash') {
    return 'gemini-3.5-flash';
  }
  return chosen;
}

/**
 * Normalizes any error or finishReason into one of the standard Mindora error categories:
 * 'missing key' | 'invalid key' | 'quota' | 'timeout' | 'truncated' | 'empty response' | 'bad JSON'
 * Never prints or leaks keys or private user text.
 */
export function categorizeAiError(err: unknown, finishReason?: string): AiErrorCategory {
  if (finishReason === 'MAX_TOKENS') {
    return 'truncated';
  }

  const msg = err instanceof Error ? err.message : String(err || '');
  const lower = msg.toLowerCase();

  if (lower.includes('missing key') || lower.includes('no api key')) {
    return 'missing key';
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline')
  ) {
    return 'timeout';
  }

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthenticated') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('permission_denied')
  ) {
    return 'invalid key';
  }

  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
    return 'quota';
  }

  if (lower.includes('max_tokens') || lower.includes('truncated')) {
    return 'truncated';
  }

  if (lower.includes('empty response') || lower.includes('no text')) {
    return 'empty response';
  }

  if (err instanceof SyntaxError || lower.includes('json')) {
    return 'bad JSON';
  }

  return 'request error';
}

export interface GeminiRequestOptions {
  contents: string;
  systemInstruction?: string;
  responseSchema?: unknown;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  timeoutMs?: number;
}

export interface GeminiCallSuccess<T = unknown> {
  success: true;
  rawText: string;
  cleanedJson: string;
  data: T;
  finishReason: string;
}

export interface GeminiCallFailure {
  success: false;
  category: AiErrorCategory;
  rawText: string;
  finishReason: string;
  blockReason?: string;
  errorSummary?: string;
  error?: unknown;
}

export type GeminiCallOutcome<T = unknown> = GeminiCallSuccess<T> | GeminiCallFailure;

interface RawGeminiPart {
  text?: string;
  thought?: boolean;
}

interface RawGeminiResponse {
  text?: string;
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: RawGeminiPart[];
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

/**
 * Extracts response text robustly:
 * 1. Checks `response.text` (a string property in @google/genai, never called as a function).
 * 2. If empty, joins `.text` of non-thought parts in `candidates[0].content.parts`.
 */
export function extractResponseText(response: RawGeminiResponse | null | undefined): string {
  if (!response) return '';

  if (typeof response.text === 'string' && response.text.length > 0) {
    return response.text;
  }

  const parts = response.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .filter((p): p is RawGeminiPart & { text: string } => Boolean(p && !p.thought && typeof p.text === 'string'))
      .map((p) => p.text)
      .join('');
    if (joined.length > 0) {
      return joined;
    }
  }

  return '';
}

/**
 * Shared executor for all Gemini API calls across check-ai, compare-ai, recommender, and chat.
 * - Uses apiVersion 'v1beta' so aliases like gemini-flash-lite-latest and responseMimeType work consistently.
 * - Omits thinkingConfig and responseSchema (which caused INVALID_ARGUMENT on flash-lite); validates with Zod instead.
 * - Reads text via response.text property with fallback to non-thought candidate parts.
 * - Detects finishReason: MAX_TOKENS -> "truncated", empty text -> "empty response", non-empty invalid JSON -> "bad JSON".
 * - Strictly categorizes all failures without logging private user data.
 */
export async function executeGeminiJsonCall<T = unknown>(
  options: GeminiRequestOptions
): Promise<GeminiCallOutcome<T>> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      category: 'missing key',
      rawText: '',
      finishReason: 'unknown',
    };
  }

  const modelName = resolveModelName(options.model);
  const timeoutMs = options.timeoutMs ?? 8000;

  try {
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

    const callPromise = ai.models.generateContent({
      model: modelName,
      contents: options.contents,
      config: {
        ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
        responseMimeType: 'application/json',
        temperature: options.temperature ?? 0.6,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );

    const response = (await Promise.race([callPromise, timeoutPromise])) as RawGeminiResponse;

    const rawText = extractResponseText(response);
    const candidateFinishReason = response?.candidates?.[0]?.finishReason;
    const blockReason = response?.promptFeedback?.blockReason;
    const finishReason = candidateFinishReason || (rawText.trim() ? 'STOP' : 'unknown');

    if (finishReason === 'MAX_TOKENS') {
      return {
        success: false,
        category: 'truncated',
        rawText,
        finishReason,
        blockReason,
      };
    }

    if (!rawText || rawText.trim() === '') {
      return {
        success: false,
        category: 'empty response',
        rawText: '',
        finishReason,
        blockReason,
      };
    }

    const cleanedJson = extractJson(rawText);
    try {
      const parsed = JSON.parse(cleanedJson) as T;
      if (parsed && typeof parsed === 'object') {
        return {
          success: true,
          rawText,
          cleanedJson,
          data: parsed,
          finishReason,
        };
      } else {
        return {
          success: false,
          category: 'bad JSON',
          rawText,
          finishReason,
        };
      }
    } catch (parseErr) {
      return {
        success: false,
        category: 'bad JSON',
        rawText,
        finishReason,
        error: parseErr,
      };
    }
  } catch (err: unknown) {
    const category = categorizeAiError(err);
    const rawMsg = err instanceof Error ? err.message : String(err || '');
    const safeMsg = apiKey ? rawMsg.split(apiKey).join('[REDACTED]') : rawMsg;
    return {
      success: false,
      category,
      rawText: '',
      finishReason: 'unknown',
      errorSummary: safeMsg.slice(0, 180),
      error: err,
    };
  }
}
