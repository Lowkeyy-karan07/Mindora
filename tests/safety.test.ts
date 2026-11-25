import { describe, it, expect } from 'vitest';
import { checkSafety } from '../src/lib/safety';

describe('Safety Check - Crisis Phrases (MUST Trigger)', () => {
  const crisisPhrases = [
    'I want to end my life',
    'I have been thinking about suicide lately',
    'I just want to kill myself',
    "I don't want to live anymore",
    'I feel an urge to hurt myself today',
    'He was talking about committing suicide',
    'Sometimes I feel like I would be better off dead',
    'I feel completely empty and I want to die',
    'Dealing with intense self-harm urges this afternoon',
    'I am afraid I might harm others',
    'I do not want to be alive anymore',
    'I feel hopeless and I want to give up on life',
  ];

  for (const phrase of crisisPhrases) {
    it(`triggers for crisis note: "${phrase}"`, () => {
      const result = checkSafety(phrase);
      expect(result.triggered).toBe(true);
      expect(result.matchedPhrase).toBeDefined();
    });
  }

  it('handles variations with punctuation, casing, and hyphens', () => {
    expect(checkSafety('SELF-HARM urges!').triggered).toBe(true);
    expect(checkSafety('...want to die...').triggered).toBe(true);
    expect(checkSafety("DONT WANT TO LIVE!!!").triggered).toBe(true);
    expect(checkSafety('Thinking of ending my life.').triggered).toBe(true);
  });
});

describe('Safety Check - Everyday Expressions (MUST NOT Trigger)', () => {
  const nonCrisisPhrases = [
    'this deadline is killing me',
    'my back hurts',
    "I'm dying to see the results",
    'I killed it in my presentation',
    'my feet hurt after running a marathon',
    "I'm worried I might hurt his feelings",
    'the suspense is killing me',
    'this spicy food hurts',
    'we need to kill the hanging background process',
    'I was dying of laughter during the comedy show',
    'she hurts whenever she remembers the missed flight',
    'my muscles hurt from yesterday’s workout',
    'Today was quite busy, feeling overwhelmed by meetings',
    'Just feeling a bit anxious about the upcoming exam',
  ];

  for (const phrase of nonCrisisPhrases) {
    it(`does NOT trigger for ordinary sentence: "${phrase}"`, () => {
      const result = checkSafety(phrase);
      expect(result.triggered).toBe(false);
      expect(result.matchedPhrase).toBeUndefined();
    });
  }

  it('safely handles empty, null, or whitespace-only inputs', () => {
    expect(checkSafety('').triggered).toBe(false);
    expect(checkSafety('   ').triggered).toBe(false);
    // @ts-expect-error test invalid input types
    expect(checkSafety(null).triggered).toBe(false);
    // @ts-expect-error test invalid input types
    expect(checkSafety(undefined).triggered).toBe(false);
  });
});
