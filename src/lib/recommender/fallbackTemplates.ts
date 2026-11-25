import { Mood, Theme, Need, Suggestion, Understanding, Situation } from '@/types';
import { getFallbackSuggestions } from './fallbackSuggestions';
import { getFallbackSituation, selectPrimaryTheme } from './fallbackSituations';

export * from './fallbackSuggestions';
export * from './fallbackSituations';

export interface GuidanceResult {
  acknowledgement: string;
  next_step: string;
  need: Need;
  now_instruction?: string;
  why_this_order?: string;
  suggestions?: Suggestion[];
  understanding?: Understanding;
  situation?: Situation;
}

/**
 * Fallback templated acknowledgements and concrete next steps.
 * Structured by situational theme and mood.
 * Enforces non-clinical, warm, empathetic language without diagnosis or toxic positivity.
 * All next_step strings are concrete, low-effort actions strictly under 30 words.
 */
export const THEME_FALLBACK_TEMPLATES: Record<
  Theme,
  {
    acknowledgements: Record<Mood, string>;
    next_step: string;
    need: Need;
  }
> = {
  academics: {
    need: 'focus',
    acknowledgements: {
      Anxious:
        "It makes complete sense to feel anxious when academic deadlines and expectations are weighing on you. You're carrying a lot of mental pressure right now.",
      Stressed:
        "Balancing coursework, exams, and deadlines is genuinely demanding. Feeling stressed under heavy academic workloads is completely understandable.",
      Overwhelmed:
        "When assignments, study topics, and expectations pile up at once, feeling overwhelmed is a natural response. You don't have to conquer everything right this second.",
      Sad:
        "Academic setbacks or relentless study pressure can be deeply draining. It's okay to feel low energy or disappointed today.",
      Okay:
        "Navigating your studies with steady focus is a wonderful space to be in. Supporting your mental clarity will keep you balanced.",
    },
    next_step:
      "List the one topic or assignment you'd feel best finishing today, and set a gentle timer for 15 minutes.",
  },
  work: {
    need: 'focus',
    acknowledgements: {
      Anxious:
        "Workplace responsibilities and high-stakes demands can stir up significant anxiety. It's understandable to feel on edge when so much is expected of you.",
      Stressed:
        "Heavy workloads, meetings, and workplace pressure can leave you feeling tight and strained. Taking a moment to acknowledge that weight is a good first step.",
      Overwhelmed:
        "When job tasks and conflicting deadlines collide, it's easy to feel stretched beyond capacity. You are allowed to take this one hour at a time.",
      Sad:
        "Work challenges and career fatigue can take an emotional toll. Give yourself credit for showing up even when things feel heavy.",
      Okay:
        "Having a grounded, steady mindset at work is valuable. Maintaining this calm balance will help you navigate your day with ease.",
    },
    next_step:
      "Pick the single highest-priority work task for this afternoon, and close any unrelated browser tabs.",
  },
  sleep: {
    need: 'calm',
    acknowledgements: {
      Anxious:
        "Trying to sleep when anxious thoughts are racing is exhausting. It is completely natural to feel restless when your mind hasn't found quiet yet.",
      Stressed:
        "Physical stress and daytime tension can make unwinding for sleep feel like an uphill battle. Your body deserves gentle patience right now.",
      Overwhelmed:
        "When mental clutter keeps you awake, everything feels louder at night. You don't have to resolve any of tomorrow's problems tonight.",
      Sad:
        "Struggling to find restful sleep can leave you feeling emotionally drained and sensitive. Offer yourself deep tenderness as you rest.",
      Okay:
        "Preparing your body for calm, restorative sleep helps sustain the steady energy you're feeling right now.",
    },
    next_step:
      "Dim your surrounding lights, put your phone face down, and take three slow, unhurried breaths.",
  },
  relationships: {
    need: 'connection',
    acknowledgements: {
      Anxious:
        "Relationship tensions and sensitive conversations can trigger real vulnerability and worry. It's understandable to feel unsettled when connections feel strained.",
      Stressed:
        "Navigating friction with people in your life can create heavy emotional tension. Taking a step back to breathe gives you room to center yourself.",
      Overwhelmed:
        "When interpersonal conflicts or family demands become intense, feeling emotionally overwhelmed is completely normal.",
      Sad:
        "Heartache or disconnect in relationships hurts deeply. It's okay to feel sad, and you deserve gentle patience with yourself right now.",
      Okay:
        "Feeling peaceful and grounded in your relationships provides a lovely foundation. A mindful moment can help you appreciate that steady connection.",
    },
    next_step:
      "Step away from messaging for twenty minutes, and allow yourself a quiet moment to recenter.",
  },
  loneliness: {
    need: 'comfort',
    acknowledgements: {
      Anxious:
        "Feeling lonely or unsupported can heighten anxious feelings and make everything seem more intimidating. Your need for connection is completely valid.",
      Stressed:
        "Carrying life's stresses without feeling a strong support system around you is genuinely hard. Acknowledge your courage in holding this weight.",
      Overwhelmed:
        "Facing complex demands while feeling isolated can amplify the sense of being overwhelmed. Take this one gentle breath at a time.",
      Sad:
        "Loneliness can feel like a heavy, quiet ache in the chest. Be especially gentle with yourself right now; you matter and you are not broken.",
      Okay:
        "Even in quiet moments of solitude, taking time to nurture your own inner companion brings a sense of peace.",
    },
    next_step:
      "Send a simple emoji or low-effort greeting to one person you feel comfortable around.",
  },
  health_worry: {
    need: 'calm',
    acknowledgements: {
      Anxious:
        "Physical symptoms and health uncertainties can easily trigger acute anxiety. It makes complete sense to feel protective and worried about your body.",
      Stressed:
        "Coping with physical discomfort or waiting on health answers brings tremendous stress. Your body is doing its best right now.",
      Overwhelmed:
        "When health questions swirl, feeling flooded with worry is a very human reaction. You don't have to predict the future right now.",
      Sad:
        "Health struggles or physical fatigue can leave you feeling low and vulnerable. Treat your body with deep kindness and rest.",
      Okay:
        "Noticing that your body feels relatively comfortable right now is a moment of ease worth appreciating.",
    },
    next_step:
      "Drink a warm glass of water and rest your hands gently over your stomach.",
  },
  money: {
    need: 'calm',
    acknowledgements: {
      Anxious:
        "Financial worries and expenses can trigger immediate, intense stress. It is completely understandable to feel anxious when resources feel tight.",
      Stressed:
        "Managing budgets, bills, and unexpected costs creates relentless daily pressure. Acknowledging that strain is an important first step.",
      Overwhelmed:
        "When financial demands feel larger than what you can solve today, feeling overwhelmed is natural. Focus only on what is in your direct control.",
      Sad:
        "Financial stress can feel discouraging and heavy over time. Remember that your personal worth is not defined by financial balances.",
      Okay:
        "Having a sense of balance around your finances brings peace of mind. Keeping this steady perspective supports your day.",
    },
    next_step:
      "Write down the single financial detail you can address today, and set the rest aside.",
  },
  teamwork: {
    need: 'focus',
    acknowledgements: {
      Anxious:
        "Navigating group project uncertainties and communication gaps can stir up real worry. It makes complete sense to feel anxious when group outcomes affect you.",
      Stressed:
        "Carrying a team project when contributions feel uneven is genuinely exhausting. Taking a moment to breathe gives you room to separate what is yours to do from what is not.",
      Overwhelmed:
        "When teamwork breaks down and deadlines draw near, feeling overwhelmed is completely natural. You do not have to carry the entire team on your own shoulders.",
      Sad:
        "Feeling let down or isolated within a group effort is emotionally draining. Give yourself credit for showing up even when collaboration is frustrating.",
      Okay:
        "Navigating team projects with a calm, steady presence helps anchor productive collaboration for everyone involved.",
    },
    next_step:
      "List the specific project deliverable you own, and communicate your timeline clearly to the group.",
  },
  conflict: {
    need: 'calm',
    acknowledgements: {
      Anxious:
        "Experiencing friction or tense disagreements can trigger immediate anxiety and physical tension. Your desire for peace and understanding is completely valid.",
      Stressed:
        "Interpersonal friction and unresolved arguments can create heavy mental stress throughout the day. Stepping back allows emotional heat to dissipate.",
      Overwhelmed:
        "When disagreements escalate or arguments feel unrelenting, feeling emotionally swamped is a normal reaction. You can pause the conversation to protect your wellbeing.",
      Sad:
        "Disagreements with people in your life can leave a deep ache and sadness. Give yourself permission to feel hurt and take gentle care of yourself.",
      Okay:
        "Maintaining your composure and grounded perspective helps resolve difficult conversations with fairness and empathy.",
    },
    next_step:
      "Take a twenty-minute pause before replying to any charged message, allowing your body to settle.",
  },
  general: {
    need: 'calm',
    acknowledgements: {
      Anxious:
        "It makes complete sense to feel on edge right now. Giving yourself permission to pause and breathe is the kindest thing you can do.",
      Stressed:
        "You're carrying a noticeable amount of tension today. Taking this moment to check in with yourself is a meaningful step toward relief.",
      Overwhelmed:
        "When everything feels like too much at once, slowing down is an act of care. You only need to navigate the next five minutes.",
      Sad:
        "Feeling low or down is a valid part of being human. Give yourself permission to move slowly and be gentle with yourself today.",
      Okay:
        "Checking in with yourself when things feel steady helps anchor this positive momentum throughout your day.",
    },
    next_step:
      "Pick one small priority for today before pausing to settle.",
  },
};

export const NOW_INSTRUCTION_TEMPLATES: Record<Theme, Record<Mood, string>> = {
  academics: {
    Anxious: "Step back from study notes for sixty seconds and slow your breathing down.",
    Stressed: "Look away from your books, drop your shoulders, and take two steady breaths.",
    Overwhelmed: "Close all study tabs except one and pause gently for sixty seconds.",
    Sad: "Name one small study effort you made recently and take a warm pause.",
    Okay: "Acknowledge one topic you feel ready to tackle clearly over the next hour.",
  },
  work: {
    Anxious: "Push back slightly from your desk and feel both feet steady on the floor.",
    Stressed: "Unclench your hands from the keyboard and take three slow, steady exhales.",
    Overwhelmed: "Mute work chat notifications for five minutes while you take a calm breath.",
    Sad: "Notice one piece of work you completed honestly today and pause gently.",
    Okay: "Pick your top workplace focus before opening your inbox again.",
  },
  sleep: {
    Anxious: "Dim bright screens nearby and let your exhale last twice as long as inhale.",
    Stressed: "Drop your jaw, soften your eyes, and release tension along your shoulders.",
    Overwhelmed: "Tell yourself tomorrow's tasks can wait until morning while you settle.",
    Sad: "Wrap up comfortably in a warm layer and offer yourself gentle rest.",
    Okay: "Do a slow, calm physical wind-down to support steady evening sleep.",
  },
  relationships: {
    Anxious: "Put your phone face down for two minutes and focus on steady breathing.",
    Stressed: "Step away from recent messages and let physical tension leave your chest.",
    Overwhelmed: "Give yourself permission to pause responding while you gather calm space.",
    Sad: "Place a gentle hand over your chest and allow yourself quiet warmth.",
    Okay: "Think of one person you appreciate and notice that calm connection.",
  },
  loneliness: {
    Anxious: "Notice three comforting physical textures nearby to ground yourself right now.",
    Stressed: "Stretch your arms wide, exhale gently, and soften tightness across your chest.",
    Overwhelmed: "Sit quietly for sixty seconds without demanding anything from yourself right now.",
    Sad: "Play one comforting song or send a tiny hello to someone warm.",
    Okay: "Send a friendly emoji or check-in message to someone you enjoy.",
  },
  health_worry: {
    Anxious: "Place both feet flat on the floor and take three slow, steady breaths.",
    Stressed: "Notice physical tension around your stomach and let it soften gently.",
    Overwhelmed: "Focus strictly on the next calm sixty seconds rather than tomorrow's what-ifs.",
    Sad: "Take a slow sip of warm water and rest quietly for a minute.",
    Okay: "Notice one physical sensation of comfort and steadiness in your body.",
  },
  money: {
    Anxious: "Close your banking tabs for two minutes and focus on steady breathing.",
    Stressed: "Relax your brow and jaw, and take two unhurried breaths away from budgets.",
    Overwhelmed: "Set aside billing worries for sixty seconds while your mind resets.",
    Sad: "Remind yourself your worth is separate from money balances and breathe gently.",
    Okay: "Acknowledge one sensible financial step you took recently.",
  },
  teamwork: {
    Anxious: "Pause away from group chat for sixty seconds so your breathing slows down.",
    Stressed: "Step back from shared files and take two slow exhales before listing tasks.",
    Overwhelmed: "Stop mentally carrying teammates' shares for sixty seconds and reset your breath.",
    Sad: "Validate the honest effort you contributed today before planning your next step.",
    Okay: "Review your own project deliverable with a clear, steady eye.",
  },
  conflict: {
    Anxious: "Put messages aside for sixty seconds and anchor on two slow exhales.",
    Stressed: "Step away from the tense conversation and let your shoulders drop down.",
    Overwhelmed: "Give yourself sixty quiet seconds to de-escalate before composing any reply.",
    Sad: "Place a hand over your heart and let hurt feelings breathe gently.",
    Okay: "Center yourself calmly before stepping into any sensitive conversation.",
  },
  general: {
    Anxious: "Notice your feet on the floor and take three slow, grounding breaths right now.",
    Stressed: "Unclench your jaw, drop your shoulders low, and take two unhurried exhales.",
    Overwhelmed: "Pause everything for sixty seconds and focus solely on one gentle breath.",
    Sad: "Notice one comforting thing nearby or play one soft, uplifting track.",
    Okay: "Name one thing going steadily today to reinforce your calm momentum.",
  },
};

export const WHY_THIS_ORDER_TEMPLATES: Record<Theme, Record<Mood, string>> = {
  academics: {
    Anxious: "Steadying anxious energy first clears focus so breaking down study work feels manageable.",
    Stressed: "Releasing physical study tension quickly helps you plan your next academic steps clearly.",
    Overwhelmed: "Pausing overload first restores bandwidth before tackling single study priorities.",
    Sad: "A gentle lift restores warmth first so studying feels less draining afterwards.",
    Okay: "A brief positive anchor maintains balance before focusing on upcoming coursework.",
  },
  work: {
    Anxious: "Grounding fast first helps settle nervous energy before organizing work deliverables.",
    Stressed: "Stepping out of fight-or-flight tension first lets you sort tasks calmly next.",
    Overwhelmed: "Quiet relief comes first so picking one clear work priority is easier.",
    Sad: "Gentle encouragement lifts energy first before returning to steady work actions.",
    Okay: "Quick clarity first reinforces calm momentum through your remaining workday.",
  },
  sleep: {
    Anxious: "Quiet breathing slows racing thoughts first, preparing your body for deeper rest.",
    Stressed: "Releasing daytime tension first eases you gently into evening wind-down practices.",
    Overwhelmed: "Short relief lowers mental overload first so bedtime routines feel soothing.",
    Sad: "A gentle comforting pause supports emotional warmth before resting for the night.",
    Okay: "A brief reset reinforces calm habits ahead of tonight's wind-down.",
  },
  relationships: {
    Anxious: "Calming your nervous system first prevents reactive replies and clarifies what matters.",
    Stressed: "Releasing interpersonal tightness first supports grounded, respectful next steps.",
    Overwhelmed: "Taking quiet space first restores clarity before addressing relationship demands.",
    Sad: "Soft self-compassion comes first before choosing gentle connection next.",
    Okay: "A quick grounding moment nurtures steady care in your connections.",
  },
  loneliness: {
    Anxious: "Grounding quickly eases isolated tension before extending one low-pressure outreach.",
    Stressed: "Softening chest tension first opens room for warm connection afterwards.",
    Overwhelmed: "Gentle calm reduces isolation heaviness first before small comforting steps.",
    Sad: "Small warm connection lifts your mood gently before reflective self-kindness.",
    Okay: "Reaching out briefly strengthens positive social connection today.",
  },
  health_worry: {
    Anxious: "Physical grounding calms acute worry spikes first so parking fears feels easier.",
    Stressed: "Settling bodily tightness first creates room to step back from health stress.",
    Overwhelmed: "Short calming relief reduces worry swirl before gentle perspective-taking.",
    Sad: "A soothing physical comfort supports care first before gentle grounding next.",
    Okay: "Notice body ease first before maintaining balanced everyday self-care.",
  },
  money: {
    Anxious: "Calming immediate panic first helps you handle financial details with a clear head.",
    Stressed: "Lowering physical bill stress first makes picking one budget action practical.",
    Overwhelmed: "A brief pause cuts financial overwhelm before slicing tasks down.",
    Sad: "Gentle reassurance restores dignity first before looking calmly at numbers.",
    Okay: "Quick reflection anchors steady financial clarity for the week.",
  },
  teamwork: {
    Anxious: "Calming nervous pressure first lets you organize team tasks and asks neutrally.",
    Stressed: "Lowering acute tension first helps you map ownership and write a clear ask.",
    Overwhelmed: "Stopping group overload first frees mental space for a realistic backup plan.",
    Sad: "Gentle lift restores self-worth first before drafting practical team clarity.",
    Okay: "Brief alignment first supports smooth, fair collaboration with your group.",
  },
  conflict: {
    Anxious: "Steadying your breath first keeps you grounded before separating facts from feelings.",
    Stressed: "Releasing heated tension first ensures calm, constructive communication next.",
    Overwhelmed: "Taking a quiet pause first prevents escalation before picking your moment.",
    Sad: "Warm self-care eases hurt first before processing your thoughts safely.",
    Okay: "Quick centering maintains fairness and calm in tricky conversations.",
  },
  general: {
    Anxious: "Add a little more detail in your note next time; quick grounding settles tension first.",
    Stressed: "Add a little more detail in your note next time; quick tension relief clears space first.",
    Overwhelmed: "Add a little more detail in your note next time; pausing briefly breaks overload first.",
    Sad: "Add a little more detail in your note next time; a gentle lift brings warmth first.",
    Okay: "Add a little more detail in your note next time; a quick check-in maintains your balance.",
  },
};

/**
 * Fallback when note is empty or without situation themes.
 */
export const MOOD_DEFAULT_FALLBACKS: Record<Mood, GuidanceResult> = {
  Anxious: {
    need: 'calm',
    acknowledgement:
      "Feeling anxious can make your thoughts race. Taking this pause gives your body a chance to settle and reset.",
    next_step:
      "Choose one simple activity below that feels easiest to begin right now.",
    now_instruction:
      "Plant both feet firmly on the ground and lengthen one slow exhale right now.",
    why_this_order:
      "Quieting physical anxiety first helps your mind engage calmly with practical next activities.",
  },
  Stressed: {
    need: 'calm',
    acknowledgement:
      "You're holding noticeable tension right now. Pausing for a mindful exercise can help release that tightness.",
    next_step:
      "Step away from your display for a brief physical stretch before continuing.",
    now_instruction:
      "Drop your shoulders down away from your ears and soften your jaw right now.",
    why_this_order:
      "Releasing stored tension rapidly resets your nervous system before stepping into longer relief.",
  },
  Overwhelmed: {
    need: 'focus',
    acknowledgement:
      "When things feel heavy, you don't have to carry it all. Settle in for one simple, guided pause.",
    next_step:
      "Pick one tiny priority for today and give yourself permission to ignore the rest.",
    now_instruction:
      "Look away from everything demanding right now and take two quiet, unhurried breaths.",
    why_this_order:
      "Slowing overload first creates mental breathing space before selecting one small next action.",
  },
  Sad: {
    need: 'comfort',
    acknowledgement:
      "It's okay to feel low today. Give yourself permission to move gently and take comfort in this quiet moment.",
    next_step:
      "Offer yourself a moment of patience and try one soothing exercise below.",
    now_instruction:
      "Think of one tiny kindness or comfort you can offer yourself over sixty seconds.",
    why_this_order:
      "A soft, zero-pressure lift brings gentle warmth first before deeper self-compassion.",
  },
  Okay: {
    need: 'reflect',
    acknowledgement:
      "It's wonderful to check in when you're feeling balanced. A mindful practice can help sustain your steady ease.",
    next_step:
      "Select an activity to anchor your clear, steady focus for the rest of your day.",
    now_instruction:
      "Notice one steady, positive part of your morning and appreciate it briefly.",
    why_this_order:
      "A brief positive check-in reinforces balance before purposeful daily reflection.",
  },
};

/**
 * Returns situation-specific fallback acknowledgement, next_step, need, now_instruction, why_this_order, and suggestions.
 */
export function getFallbackGuidance(
  mood: Mood,
  detectedThemes: Theme[] = [],
  note?: string | null
): GuidanceResult {
  const primaryTheme = selectPrimaryTheme(detectedThemes);
  const suggestions = getFallbackSuggestions(mood, primaryTheme ? [primaryTheme] : detectedThemes);
  const situation = getFallbackSituation(mood, detectedThemes, note);

  // If specific non-general theme detected
  if (primaryTheme && primaryTheme !== 'general') {
    const template = THEME_FALLBACK_TEMPLATES[primaryTheme];
    if (template) {
      return {
        acknowledgement: template.acknowledgements[mood] || template.acknowledgements.Stressed,
        next_step: template.next_step,
        need: template.need,
        now_instruction: NOW_INSTRUCTION_TEMPLATES[primaryTheme][mood],
        why_this_order: WHY_THIS_ORDER_TEMPLATES[primaryTheme][mood],
        suggestions,
        situation,
        understanding: {
          main_concern: note?.trim() || `${primaryTheme} situation`,
          intensity: 'medium',
          need: template.need,
        },
      };
    }
  }

  // If note has text but no theme triggered (or only 'general')
  if (note && note.trim().length > 0) {
    const general = THEME_FALLBACK_TEMPLATES.general;
    return {
      acknowledgement: `${general.acknowledgements[mood] || general.acknowledgements.Stressed} Add a little more detail in your note and the plan can be more specific.`,
      next_step: general.next_step,
      need: general.need,
      now_instruction: NOW_INSTRUCTION_TEMPLATES.general[mood],
      why_this_order: WHY_THIS_ORDER_TEMPLATES.general[mood],
      suggestions,
      situation,
      understanding: {
        main_concern: note.trim(),
        intensity: 'medium',
        need: general.need,
      },
    };
  }

  // Default mood-specific fallback for empty notes
  const fallback = MOOD_DEFAULT_FALLBACKS[mood] || MOOD_DEFAULT_FALLBACKS.Okay;
  return {
    ...fallback,
    suggestions,
    situation,
    understanding: {
      main_concern: `Feeling ${mood.toLowerCase()}`,
      intensity: 'low',
      need: fallback.need,
    },
  };
}
