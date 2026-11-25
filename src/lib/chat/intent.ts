import { ActivityType, ParsedConstraints } from '@/types';

/**
 * Pure function that parses phrase-based constraints from user chat messages (rules, no AI).
 * Case-insensitive and handles negation, duration limits, type exclusions/inclusions, swaps, why, and steps.
 *
 * Examples:
 * - "only 2 minutes" / "short" -> max_minutes
 * - "no breathing" / "don't like breathing" -> exclude breathing
 * - "something else" / "another" / "something different" -> wants_swap
 * - "why" / "why these?" -> wants_why
 * - "how do I do this" / "steps" -> wants_steps
 */
export function parseConstraints(message: string): ParsedConstraints {
  if (!message || typeof message !== 'string') {
    return {
      max_minutes: null,
      exclude_types: [],
      include_types: [],
      wants_swap: false,
      wants_why: false,
      wants_steps: false,
    };
  }

  const clean = message.trim().toLowerCase();

  // 1. Duration / max_minutes parsing
  let max_minutes: number | null = null;
  const numMatch = clean.match(
    /(?:only|under|less\s+than|max|at\s+most|within)?\s*(\d+)\s*(?:m|min|mins|minute|minutes)\b/i
  );
  if (numMatch && numMatch[1]) {
    const val = parseInt(numMatch[1], 10);
    if (!isNaN(val) && val > 0) {
      max_minutes = val;
    }
  } else if (/\b(short|shorter|quick|quicker|brief|fast|less\s+time)\b/i.test(clean)) {
    // Default duration for "short" / "shorter please"
    max_minutes = 2;
  }

  // 2. Exclude types
  const exclude_types: ActivityType[] = [];
  if (
    /(?:no|without|skip|stop|avoid|don'?t\s+like|hate|not|any\s+but|except)\s+(?:any\s+)?(?:breathing|breathwork|breath\s+exercises?|breath)\b/i.test(
      clean
    )
  ) {
    exclude_types.push('breathing');
  }
  if (
    /(?:no|without|skip|stop|avoid|don'?t\s+like|hate|not|any\s+but|except)\s+(?:any\s+)?(?:grounding)\b/i.test(
      clean
    )
  ) {
    exclude_types.push('grounding');
  }
  if (
    /(?:no|without|skip|stop|avoid|don'?t\s+like|hate|not|any\s+but|except)\s+(?:any\s+)?(?:journaling|journal|writing|write)\b/i.test(
      clean
    )
  ) {
    exclude_types.push('journaling');
  }
  if (
    /(?:no|without|skip|stop|avoid|don'?t\s+like|hate|not|any\s+but|except)\s+(?:any\s+)?(?:break|movement|stretching)\b/i.test(
      clean
    )
  ) {
    exclude_types.push('break');
  }

  // 3. Include types (if user explicitly requests only/just a type)
  const include_types: ActivityType[] = [];
  if (/\b(?:only|just|prefer)\s+(?:breathing|breathwork)\b/i.test(clean) && !exclude_types.includes('breathing')) {
    include_types.push('breathing');
  }
  if (/\b(?:only|just|prefer)\s+(?:grounding)\b/i.test(clean) && !exclude_types.includes('grounding')) {
    include_types.push('grounding');
  }
  if (/\b(?:only|just|prefer)\s+(?:journaling|journal|writing)\b/i.test(clean) && !exclude_types.includes('journaling')) {
    include_types.push('journaling');
  }
  if (/\b(?:only|just|prefer)\s+(?:break|breaks|movement)\b/i.test(clean) && !exclude_types.includes('break')) {
    include_types.push('break');
  }

  // 4. Wants swap
  const wants_swap =
    /\b(something\s+else|something\s+different|another|other|swap|change|replace|different|new\s+options?|other\s+options?|not\s+these)\b/i.test(
      clean
    );

  // 5. Wants why
  const wants_why = /\b(why|why\s+these|why\s+this|reason|reasons|explain|explanation)\b/i.test(clean);

  // 6. Wants steps
  const wants_steps =
    /\b(how\s+do\s+i|how\s+to|steps|instructions|how\s+does\s+it\s+work|walkthrough|guide\s+me)\b/i.test(clean);

  return {
    max_minutes,
    exclude_types,
    include_types,
    wants_swap,
    wants_why,
    wants_steps,
  };
}
