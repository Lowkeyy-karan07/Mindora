import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractJson,
  stripCodeFences,
  categorizeAiError,
  resolveModelName,
  executeGeminiJsonCall,
} from '../src/lib/ai/gemini';

// Mock @google/genai
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
    };
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
  };
});

describe('Gemini Helper: extractJson', () => {
  it('handles plain JSON correctly', () => {
    const input = '{"status":"ok","count":3}';
    const result = extractJson(input);
    expect(result).toBe('{"status":"ok","count":3}');
    expect(JSON.parse(result)).toEqual({ status: 'ok', count: 3 });
  });

  it('handles fenced JSON with ```json and ``` fences', () => {
    const inputWithJson = '```json\n{"status":"ok"}\n```';
    expect(extractJson(inputWithJson)).toBe('{"status":"ok"}');
    expect(JSON.parse(extractJson(inputWithJson))).toEqual({ status: 'ok' });

    const inputBareFence = '```\n{"status":"ok"}\n```';
    expect(extractJson(inputBareFence)).toBe('{"status":"ok"}');
    expect(JSON.parse(extractJson(inputBareFence))).toEqual({ status: 'ok' });
  });

  it('handles JSON with leading and trailing prose', () => {
    const inputWithProse =
      'Here is the JSON you requested for this wellbeing check-in:\n{"status":"ok","need":"calm"}\nHope this helps you!';
    const result = extractJson(inputWithProse);
    expect(result).toBe('{"status":"ok","need":"calm"}');
    expect(JSON.parse(result)).toEqual({ status: 'ok', need: 'calm' });
  });

  it('handles truncated JSON by returning the substring/content which fails parsing', () => {
    const truncatedInput = '{"status":"incom';
    const result = extractJson(truncatedInput);
    expect(result).toBe('{"status":"incom');
    expect(() => JSON.parse(result)).toThrow();
  });

  it('handles empty string, null, and undefined cleanly', () => {
    expect(extractJson('')).toBe('');
    expect(extractJson('   ')).toBe('');
    expect(extractJson(null)).toBe('');
    expect(extractJson(undefined)).toBe('');
  });
});

describe('Gemini Helper: resolveModelName', () => {
  it('maps deprecated gemini-2.5-flash to working gemini-3.5-flash', () => {
    expect(resolveModelName('gemini-2.5-flash')).toBe('gemini-3.5-flash');
    expect(resolveModelName('gemini-2.0-flash')).toBe('gemini-3.5-flash');
  });

  it('preserves valid custom model names', () => {
    expect(resolveModelName('gemini-3.5-flash')).toBe('gemini-3.5-flash');
    expect(resolveModelName('gemini-3.8-flash')).toBe('gemini-3.8-flash');
  });
});

describe('Gemini Helper: categorizeAiError', () => {
  it('categorizes finishReason MAX_TOKENS as truncated', () => {
    expect(categorizeAiError(new Error('Some error'), 'MAX_TOKENS')).toBe('truncated');
  });

  it('categorizes quota errors', () => {
    expect(categorizeAiError(new Error('Resource exhausted (429)'))).toBe('quota');
    expect(categorizeAiError(new Error('Quota exceeded'))).toBe('quota');
  });

  it('categorizes invalid key and unauthenticated errors', () => {
    expect(categorizeAiError(new Error('API key not valid (400)'))).toBe('invalid key');
    expect(categorizeAiError(new Error('Unauthenticated (401)'))).toBe('invalid key');
    expect(categorizeAiError(new Error('Permission denied (403)'))).toBe('invalid key');
  });

  it('categorizes timeout errors', () => {
    expect(categorizeAiError(new Error('Promise timeout'))).toBe('timeout');
    expect(categorizeAiError(new Error('Deadline exceeded'))).toBe('timeout');
  });

  it('categorizes empty response errors', () => {
    expect(categorizeAiError(new Error('Empty response from model'))).toBe('empty response');
  });

  it('defaults to bad JSON for syntax/parse issues', () => {
    expect(categorizeAiError(new SyntaxError('Unexpected token'))).toBe('bad JSON');
  });
});

describe('Gemini Helper: executeGeminiJsonCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns missing key category when apiKey is absent', async () => {
    const result = await executeGeminiJsonCall({
      contents: 'test',
      apiKey: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.category).toBe('missing key');
    }
  });

  it('returns success: true and parsed object on valid Gemini response', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '{"status":"ok"}',
      candidates: [{ finishReason: 'STOP' }],
    });

    const result = await executeGeminiJsonCall<{ status: string }>({
      contents: 'test',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ status: 'ok' });
      expect(result.finishReason).toBe('STOP');
    }
  });

  it('returns truncated category when finishReason is MAX_TOKENS', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '{"status":"incom',
      candidates: [{ finishReason: 'MAX_TOKENS' }],
    });

    const result = await executeGeminiJsonCall({
      contents: 'test',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.category).toBe('truncated');
      expect(result.finishReason).toBe('MAX_TOKENS');
    }
  });

  it('returns empty response category when text is whitespace', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '   ',
      candidates: [{ finishReason: 'STOP' }],
    });

    const result = await executeGeminiJsonCall({
      contents: 'test',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.category).toBe('empty response');
    }
  });

  it('returns bad JSON category when text cannot be parsed', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Not JSON at all',
      candidates: [{ finishReason: 'STOP' }],
    });

    const result = await executeGeminiJsonCall({
      contents: 'test',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.category).toBe('bad JSON');
    }
  });

  it('reads text as a property (getter or string)', async () => {
    const responseWithGetter = {
      get text() {
        return '{"status":"ok","via":"getter"}';
      },
      candidates: [{ finishReason: 'STOP' }],
    };
    mockGenerateContent.mockResolvedValueOnce(responseWithGetter);

    const result = await executeGeminiJsonCall<{ status: string; via: string }>({
      contents: 'test',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ status: 'ok', via: 'getter' });
    }
  });

  it('falls back to candidates[0].content.parts text when response.text is empty and skips thought parts', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '',
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [
              { thought: true, text: 'Let me think carefully first...' },
              { text: '{"status":' },
              { text: '"ok"}' },
            ],
          },
        },
      ],
    });

    const result = await executeGeminiJsonCall<{ status: string }>({
      contents: 'test',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ status: 'ok' });
    }
  });

  it('returns empty response with blockReason on blocked prompt', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: undefined,
      candidates: [],
      promptFeedback: { blockReason: 'SAFETY' },
    });

    const result = await executeGeminiJsonCall({
      contents: 'test',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.category).toBe('empty response');
      expect(result.blockReason).toBe('SAFETY');
      expect(result.finishReason).toBe('unknown');
    }
  });

  it('parses fenced JSON returned by Gemini', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '```json\n{"status":"ok","fenced":true}\n```',
      candidates: [{ finishReason: 'STOP' }],
    });

    const result = await executeGeminiJsonCall<{ status: string; fenced: boolean }>({
      contents: 'test',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ status: 'ok', fenced: true });
    }
  });

  it('does not categorize arbitrary SDK/network errors as bad JSON', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('503 Service Unavailable'));

    const result = await executeGeminiJsonCall({
      contents: 'test',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.category).toBe('request error');
    }
  });
});
