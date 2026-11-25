/**
 * Mindora Safety Phrases
 *
 * NOTE: This is a basic phrase-based crisis trigger, NOT a reliable risk assessment or clinical diagnostic tool.
 * It is designed as an initial safety safeguard to redirect users indicating immediate distress,
 * self-harm, or danger toward human support resources without invoking AI recommendations.
 */

export const CRISIS_PHRASES: readonly string[] = [
  // Suicide and suicidal ideation
  'suicide',
  'suicidal',
  'commit suicide',
  'committing suicide',
  'kill myself',
  'killing myself',
  'take my own life',
  'taking my own life',
  'take my life',
  'taking my life',

  // Wanting to die / wishing for death
  'want to die',
  'wanting to die',
  'wants to die',
  'wanna die',
  'wish i was dead',
  'wish i were dead',
  'wishing i was dead',
  'wishing i were dead',
  'better off dead',
  'rather be dead',
  'ready to die',

  // Ending life / giving up
  'end my life',
  'ending my life',
  'ended my life',
  'end it all',
  'ending it all',
  'not worth living',
  'no reason to live',
  'give up on life',
  'giving up on life',
  'done with life',
  'tired of living',

  // Self-harm
  'self harm',
  'self-harm',
  'self harming',
  'self-harming',
  'hurt myself',
  'hurting myself',
  'harm myself',
  'harming myself',
  'cut myself',
  'cutting myself',

  // Not wanting to be alive / live
  'dont want to live',
  "don't want to live",
  'do not want to live',
  'dont want to be alive',
  "don't want to be alive",
  'do not want to be alive',
  'hate being alive',

  // Harming others
  'harm others',
  'harming others',
  'hurt others',
  'hurting others',
  'kill others',
  'killing others',
  'kill someone else',
  'kill someone',
  'killing someone',
  'harm someone else',
  'want to harm others',
  'want to hurt others',
  'want to kill someone',
];
