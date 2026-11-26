import { Mood, Situation, Theme } from '@/types';

/**
 * Fallback situation templates when AI is unavailable or fails validation.
 * Covers all 5 moods x 10 themes (academics, work, sleep, relationships, loneliness, health_worry, money, teamwork, conflict, general),
 * plus unclassified notes and empty notes.
 *
 * Rules:
 * - summary: max 25 words.
 * - what_is_in_your_control: max 30 words.
 * - action_steps: exactly 3 items, at least one "now" (under 5 mins).
 * - step title: max 6 words.
 * - step detail: max 40 words.
 * - strictly non-clinical, practical coping, non-adversarial.
 */

interface SituationTemplate {
  summary: string;
  what_is_in_your_control: string;
  action_steps: [
    { step: string; detail: string; time: 'now' | 'today' | 'this_week' },
    { step: string; detail: string; time: 'now' | 'today' | 'this_week' },
    { step: string; detail: string; time: 'now' | 'today' | 'this_week' }
  ];
}

// --------------------------------------------------------------------------
// 1. Templates by Theme x Mood
// --------------------------------------------------------------------------
export const THEME_SITUATION_TEMPLATES: Record<
  Theme,
  Record<Mood, SituationTemplate>
> = {
  teamwork: {
    Stressed: {
      summary: "You are dealing with an uneven workload or uncommitted teammates close to an important deadline.",
      what_is_in_your_control: "You can specify remaining deliverables, set firm written timeframes, and report progress neutrally to your project supervisor.",
      action_steps: [
        { step: "List remaining unowned tasks", detail: "Write down the exact sections or tasks that still need completion today.", time: "now" },
        { step: "Send clear alignment message", detail: "Message your group stating which item you will finish and asking who owns the rest.", time: "today" },
        { step: "Escalate neutrally if needed", detail: "If no response by tomorrow, update your lead or instructor on project status.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "Group project uncertainty and lack of collaboration are creating worry about results and deadlines.",
      what_is_in_your_control: "You can focus entirely on completing your designated share and documenting communication calmly.",
      action_steps: [
        { step: "Clarify your single deliverable", detail: "Pick your own assigned section and focus on outlining it first.", time: "now" },
        { step: "Send polite check-in note", detail: "Share a friendly update in the group chat outlining the current timeline.", time: "today" },
        { step: "Ask supervisor for guidance", detail: "Consult your teacher or manager for advice on dividing remaining group responsibilities.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "Carrying group tasks alone while others remain unresponsive is causing significant mental overload.",
      what_is_in_your_control: "You do not have to do everyone's job; establish what you can realistically deliver.",
      action_steps: [
        { step: "Pause and drop extra tasks", detail: "Step away for two minutes; stop volunteering for additional unassigned work.", time: "now" },
        { step: "Outline core essentials", detail: "Strip the project down to minimum requirements needed to submit on time.", time: "today" },
        { step: "Schedule brief team sync", detail: "Call a ten-minute meeting to reallocate tasks before the due date.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "Feeling isolated or let down by teammates when working on a shared commitment.",
      what_is_in_your_control: "You can validate your effort, protect your energy, and communicate without self-blame.",
      action_steps: [
        { step: "Acknowledge your own contributions", detail: "Recognize that you showed up and did your part honestly today.", time: "now" },
        { step: "Send simple status update", detail: "State what you have completed so everyone has visibility into the work.", time: "today" },
        { step: "Seek supportive advice", detail: "Talk with a trusted peer or mentor about managing group dynamics.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "Navigating team coordination and project workflows with a steady, constructive perspective.",
      what_is_in_your_control: "You can maintain clear documentation and encourage collaborative momentum across the group.",
      action_steps: [
        { step: "Organize shared file links", detail: "Put all relevant project links in one accessible document for teammates.", time: "now" },
        { step: "Confirm milestone dates", detail: "Verify that everyone understands the upcoming review date and expectations.", time: "today" },
        { step: "Celebrate progress together", detail: "Acknowledge everyone's completed milestones at the end of the sprint.", time: "this_week" },
      ],
    },
  },

  conflict: {
    Stressed: {
      summary: "Experiencing friction, tension, or a difficult disagreement with someone in your circle.",
      what_is_in_your_control: "You can control your tone, avoid retaliatory reactions, and choose calm timing for discussions.",
      action_steps: [
        { step: "Step back before replying", detail: "Do not respond to tense messages while your heart is racing; take five minutes.", time: "now" },
        { step: "Draft neutral bullet points", detail: "Write down the objective problem you need resolved without emotional accusations.", time: "today" },
        { step: "Propose a calm conversation", detail: "Ask the person if they can talk briefly tomorrow in a neutral setting.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "Interpersonal tension or fear of confrontation is creating ongoing apprehension and worry.",
      what_is_in_your_control: "You can articulate your perspective clearly and remember you cannot control others' reactions.",
      action_steps: [
        { step: "Exhale and ground yourself", detail: "Take three slow breaths and remind yourself that disagreement is part of life.", time: "now" },
        { step: "Write down your boundary", detail: "Clarify what you need to feel safe and respected in this interaction.", time: "today" },
        { step: "Involve a neutral mediator", detail: "If direct communication stays hostile, speak with a neutral third party.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "Arguments and lingering friction are draining your mental bandwidth on top of everyday responsibilities.",
      what_is_in_your_control: "You can put emotional debates on pause until your immediate stress levels subside.",
      action_steps: [
        { step: "Declare a temporary timeout", detail: "Send a polite note saying you need some quiet space before continuing.", time: "now" },
        { step: "Focus on basic needs", detail: "Drink a glass of water, eat a nourishing snack, and rest your eyes.", time: "today" },
        { step: "Revisit with clear intent", detail: "Return to the topic only after you have slept and regained perspective.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "Hurt feelings or strained relationships are creating emotional heaviness and disconnect.",
      what_is_in_your_control: "You can offer yourself kindness and speak honestly about your feelings when ready.",
      action_steps: [
        { step: "Allow yourself to feel", detail: "Sit quietly for two minutes and acknowledge that hurt feelings are natural.", time: "now" },
        { step: "Write an unsent letter", detail: "Express your raw thoughts on paper to process pain without sending it.", time: "today" },
        { step: "Reach out to confidant", detail: "Share your experience with an empathetic friend who listens without judging.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "Addressing a difference in viewpoints with maturity and a collaborative problem-solving attitude.",
      what_is_in_your_control: "You can listen actively to understand the other side while maintaining your boundaries.",
      action_steps: [
        { step: "Reflect on their perspective", detail: "Consider what valid concerns the other party might be trying to express.", time: "now" },
        { step: "Offer constructive bridge", detail: "Send a message proposing a compromise that honors both people's priorities.", time: "today" },
        { step: "Review relationship balance", detail: "Check in later to ensure mutual respect and positive communication continue.", time: "this_week" },
      ],
    },
  },

  academics: {
    Stressed: {
      summary: "Academic deadlines, grading expectations, and study loads are straining your cognitive focus.",
      what_is_in_your_control: "You can organize your study materials, prioritize one assignment, and eliminate distractions.",
      action_steps: [
        { step: "Pick your single priority", detail: "Select the most urgent assignment and close all unrelated browser tabs.", time: "now" },
        { step: "Complete one study sprint", detail: "Dedicate 25 focused minutes to drafting or problem solving without interruption.", time: "today" },
        { step: "Review syllabus milestones", detail: "Map out deadlines for the next seven days to prevent unexpected surprises.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "Upcoming tests or academic performance expectations are sparking anticipatory worry and self-doubt.",
      what_is_in_your_control: "You can prepare in small, realistic increments rather than attempting to memorize everything at once.",
      action_steps: [
        { step: "Write down one topic", detail: "Write the easiest review topic on an index card to get started gently.", time: "now" },
        { step: "Review for fifteen minutes", detail: "Read through your summary notes once with a warm cup of tea.", time: "today" },
        { step: "Join study group session", detail: "Compare questions with a classmate to confirm core exam themes.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "Coursework, exams, and projects have piled up at once, making starting feel paralyzing.",
      what_is_in_your_control: "You do not need to finish everything today; starting one tiny step restores momentum.",
      action_steps: [
        { step: "Clear your desk completely", detail: "Leave only the notebook or book you need for the immediate task.", time: "now" },
        { step: "Set a tiny timer", detail: "Commit to working on one paragraph or problem for just ten minutes.", time: "today" },
        { step: "Ask instructor for clarification", detail: "Email your teacher or TA about any confusing assignment requirements.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "Academic setbacks or exhaustion are making motivation and focus feel difficult to access.",
      what_is_in_your_control: "You can be patient with low energy and adjust your daily study goals to what is doable.",
      action_steps: [
        { step: "Take a restful breather", detail: "Step away from study desks for five minutes of gentle stretching.", time: "now" },
        { step: "Read just two pages", detail: "Review a brief section of notes without demanding perfection.", time: "today" },
        { step: "Plan a rewarding break", detail: "Schedule an enjoyable activity after your upcoming academic milestone.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "Maintaining a balanced and structured rhythm across your study goals and assignments.",
      what_is_in_your_control: "You can protect your clear focus and reinforce consistent daily learning habits.",
      action_steps: [
        { step: "Review today's checklist", detail: "Confirm your top academic targets for the afternoon.", time: "now" },
        { step: "Organize summary flashcards", detail: "Synthesize key concepts into short, memorable bullet points.", time: "today" },
        { step: "Look ahead at assignments", detail: "Begin early reading for next week's seminars to stay ahead.", time: "this_week" },
      ],
    },
  },

  work: {
    Stressed: {
      summary: "Workplace volume, manager requests, and competing project demands are causing acute tension.",
      what_is_in_your_control: "You can filter urgent requests, decline non-essential tasks, and establish a clear end of day.",
      action_steps: [
        { step: "Identify your top deliverable", detail: "Select the single work item that matters most before closing today.", time: "now" },
        { step: "Communicate realistic timelines", detail: "Let stakeholders know when to expect updates without overcommitting.", time: "today" },
        { step: "Block daily focus hours", detail: "Reserve two hours on your calendar for uninterrupted deep work this week.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "Performance reviews, presentations, or workplace uncertainty are triggering persistent anxiety.",
      what_is_in_your_control: "You can prepare key facts and remember that one meeting does not define your worth.",
      action_steps: [
        { step: "Organize your talking points", detail: "Write three clear, factual bullet points for your upcoming discussion.", time: "now" },
        { step: "Do a practice run-through", detail: "Review your update out loud once in a calm, steady voice.", time: "today" },
        { step: "Check in with mentor", detail: "Ask an experienced colleague for guidance on handling workplace transitions.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "Inboxes, meetings, and competing deadlines have crowded out all available mental space.",
      what_is_in_your_control: "You can step off the treadmill briefly and triage what is truly essential versus optional.",
      action_steps: [
        { step: "Silence notification pings", detail: "Turn off non-essential desktop notifications for forty-five minutes.", time: "now" },
        { step: "Triage your inbox", detail: "Answer only the top three messages and leave the rest for tomorrow.", time: "today" },
        { step: "Align expectations with manager", detail: "Meet briefly with your supervisor to clarify priority rankings.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "Feeling depleted, undervalued, or emotionally detached from your daily workplace routine.",
      what_is_in_your_control: "You can pace yourself gently and seek small moments of satisfaction outside work.",
      action_steps: [
        { step: "Step away from monitors", detail: "Walk to a window or outside to look at daylight for two minutes.", time: "now" },
        { step: "Finish one easy chore", detail: "Check off one low-stakes task to create a small sense of completion.", time: "today" },
        { step: "Plan evening wind-down", detail: "Set a firm cutoff time this evening to fully disconnect from work apps.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "Navigating your daily workplace responsibilities with steady progress and professional balance.",
      what_is_in_your_control: "You can streamline your workflows and support colleagues with your steady focus.",
      action_steps: [
        { step: "Review weekly priorities", detail: "Ensure your primary quarterly deliverables are on track.", time: "now" },
        { step: "Offer positive feedback", detail: "Send a quick note of appreciation to a coworker who helped recently.", time: "today" },
        { step: "Clean up digital folders", detail: "Organize shared project folders for smoother future teamwork.", time: "this_week" },
      ],
    },
  },

  sleep: {
    Stressed: {
      summary: "Racing thoughts and physical tension are interfering with deep, restorative nightly rest.",
      what_is_in_your_control: "You can create a calm transition routine between today's thoughts and nighttime rest.",
      action_steps: [
        { step: "Dim surrounding lights", detail: "Lower brightness around you and switch to warm, soft lighting.", time: "now" },
        { step: "Park lingering worries on paper", detail: "Write down anything swirling on your mind so you do not have to hold it in bed.", time: "today" },
        { step: "Keep consistent bedtime", detail: "Aim to settle into rest at a steady hour over the next three nights.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "Nighttime worry and anticipatory restlessness are keeping your nervous system on high alert.",
      what_is_in_your_control: "You can soothe your physical senses and remove clocks or phones from immediate view.",
      action_steps: [
        { step: "Place phone across room", detail: "Put your phone out of arm's reach so you avoid middle-of-night checking.", time: "now" },
        { step: "Sip non-caffeinated tea", detail: "Enjoy a warm cup of chamomile or warm water thirty minutes before sleep.", time: "today" },
        { step: "Practice wind-down reading", detail: "Read a physical book for ten minutes instead of browsing social feeds.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "A heavy mental burden is preventing your body from shutting down and resting peacefully.",
      what_is_in_your_control: "You can remind your body that the day is complete and rest is your immediate priority.",
      action_steps: [
        { step: "Do a 2-minute brain dump", detail: "Write every lingering thought on a scrap of paper and close the notebook.", time: "now" },
        { step: "Cool your bedroom space", detail: "Crack a window or turn on a gentle fan to keep the room cool and fresh.", time: "today" },
        { step: "Protect your morning buffer", detail: "Set your alarm with ten quiet minutes before jumping into messages.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "Emotional fatigue and heaviness are disrupting your natural sleep cycle or making waking hard.",
      what_is_in_your_control: "You can treat your resting environment as a gentle sanctuary of comfort and care.",
      action_steps: [
        { step: "Wrap up in comfortable blanket", detail: "Notice the weight of your bedding supporting your body right now.", time: "now" },
        { step: "Listen to soothing audio", detail: "Put on quiet nature sounds or calming rain audio as you settle in.", time: "today" },
        { step: "Step into morning sun", detail: "Get five minutes of natural sunlight upon waking to reset circadian rhythm.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "Experiencing steady rest patterns and maintaining mindful bedtime habits.",
      what_is_in_your_control: "You can reinforce restorative nighttime sleep routines that sustain your daily energy.",
      action_steps: [
        { step: "Acknowledge good energy", detail: "Notice how refreshed your body feels after adequate rest.", time: "now" },
        { step: "Maintain evening calm", detail: "Avoid heavy caffeine or intense screen usage late into the evening.", time: "today" },
        { step: "Refresh bedding setup", detail: "Wash your sheets and pillows to keep your sleep environment inviting.", time: "this_week" },
      ],
    },
  },

  relationships: {
    Stressed: {
      summary: "Demands, misunderstandings, or complex expectations in a close relationship are causing strain.",
      what_is_in_your_control: "You can state your availability clearly, listen without interrupting, and set gentle boundaries.",
      action_steps: [
        { step: "Pause before reacting", detail: "Take a brief breath before answering difficult questions or messages.", time: "now" },
        { step: "Communicate clearly in writing", detail: "Send a thoughtful note stating when you will be free to connect calmly.", time: "today" },
        { step: "Schedule quality time", detail: "Plan a distraction-free activity with your partner or family member.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "Fear of abandonment, rejection, or relationship friction is stirring up emotional unease.",
      what_is_in_your_control: "You can seek factual reassurance and remind yourself that relationships have natural rhythms.",
      action_steps: [
        { step: "Ground your immediate reality", detail: "Remind yourself of past supportive moments you have shared together.", time: "now" },
        { step: "Express a sincere wish", detail: "Tell the person what would help you feel connected today in simple terms.", time: "today" },
        { step: "Engage in independent hobby", detail: "Spend an hour doing an activity you enjoy entirely on your own.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "Family or relationship obligations feel demanding on top of your existing daily load.",
      what_is_in_your_control: "You can communicate your boundaries with kindness and decline requests gracefully.",
      action_steps: [
        { step: "Step into private space", detail: "Take three quiet minutes alone to center your thoughts and breathe.", time: "now" },
        { step: "Communicate your limits", detail: "Politely let family know you cannot take on additional favors today.", time: "today" },
        { step: "Protect your weekend schedule", detail: "Keep half of your weekend open for personal rest and recovery.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "Grief, heartbreak, or disconnect in a meaningful relationship is weighing heavily on you.",
      what_is_in_your_control: "You can honor your feelings, give yourself time to heal, and lean on supportive allies.",
      action_steps: [
        { step: "Place hand on chest", detail: "Offer yourself a physical moment of warmth and unconditional acceptance.", time: "now" },
        { step: "Message a reliable friend", detail: "Reach out to someone who holds space without offering unsolicited advice.", time: "today" },
        { step: "Allow gradual healing", detail: "Give yourself permission to feel sad without rushing to fix everything.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "Enjoying meaningful connection, mutual trust, and healthy balance in your relationships.",
      what_is_in_your_control: "You can nurture appreciation and celebrate shared milestones with the people you care about.",
      action_steps: [
        { step: "Send genuine compliment", detail: "Tell someone in your life one thing you appreciate about them today.", time: "now" },
        { step: "Plan a shared meal", detail: "Coordinate an enjoyable lunch or dinner together with a friend.", time: "today" },
        { step: "Catch up with distant contact", detail: "Call or message a family member or friend you have not spoken to lately.", time: "this_week" },
      ],
    },
  },

  loneliness: {
    Stressed: {
      summary: "Feeling isolated while simultaneously carrying stress makes everything feel doubly burdensome.",
      what_is_in_your_control: "You can connect in small, low-demand ways to feel community without exhausting yourself.",
      action_steps: [
        { step: "Step outside among people", detail: "Walk to a local park or cafe just to feel the presence of others.", time: "now" },
        { step: "Send low-stakes text message", detail: "Say hello to an old acquaintance without expecting a lengthy dialogue.", time: "today" },
        { step: "Visit a community venue", detail: "Spend an hour at a public library, bookstore, or community garden.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "Feelings of disconnection are fueling social anxiety and self-conscious doubts about belonging.",
      what_is_in_your_control: "You can remember that many people crave connection, and reaching out is brave.",
      action_steps: [
        { step: "Send a friendly emoji", detail: "Send a warm emoji to a friend to open a zero-pressure line of contact.", time: "now" },
        { step: "Attend a public group event", detail: "Consider joining an open interest group, club, or fitness meetup.", time: "today" },
        { step: "Join online hobby group", detail: "Participate in a forum or group focused on a topic you genuinely love.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "Coping with solitude while feeling inundated by internal thoughts and practical demands.",
      what_is_in_your_control: "You can seek gentle company in low-pressure spaces that do not require conversation.",
      action_steps: [
        { step: "Put on friendly podcast", detail: "Listen to a warm, conversational audio show to bring comforting voices in.", time: "now" },
        { step: "Take a quiet neighborhood walk", detail: "Walk around your block and notice the world moving around you.", time: "today" },
        { step: "Schedule a video check-in", detail: "Arrange a fifteen-minute catch-up with an understanding family member.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "Feeling lonely and disconnected from a sense of warm belonging or shared understanding.",
      what_is_in_your_control: "You can acknowledge this loneliness with compassion rather than shame or self-criticism.",
      action_steps: [
        { step: "Wrap yourself in warmth", detail: "Put on a cozy sweater or wrap in a blanket and drink something warm.", time: "now" },
        { step: "Write down your qualities", detail: "List three qualities you bring to friendships and relationships.", time: "today" },
        { step: "Volunteer or give back", detail: "Explore helping a local group or animal shelter to connect with others.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "Appreciating peaceful solitude while maintaining healthy bridges to your social world.",
      what_is_in_your_control: "You can enjoy quiet independent time while proactively staying connected to friends.",
      action_steps: [
        { step: "Enjoy quiet present moment", detail: "Savor a few minutes of quiet stillness without distraction.", time: "now" },
        { step: "Send friendly check-in", detail: "Reach out to a peer to ask how their week is developing.", time: "today" },
        { step: "Plan a weekend gathering", detail: "Invite two friends over for tea, games, or a casual walk.", time: "this_week" },
      ],
    },
  },

  health_worry: {
    Stressed: {
      summary: "Physical discomfort, symptoms, or medical appointments are causing worry and stress.",
      what_is_in_your_control: "You can consult qualified medical professionals, rest your body, and avoid internet rabbit holes.",
      action_steps: [
        { step: "Close online symptom search", detail: "Stop searching medical forums; search engines amplify worst-case fears.", time: "now" },
        { step: "Drink water and rest", detail: "Drink a large glass of cool water and rest your body in a comfortable seat.", time: "today" },
        { step: "Schedule doctor consultation", detail: "Book an appointment with your healthcare provider for factual guidance.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "Health-related anxiety and hyper-awareness of bodily sensations are creating distress.",
      what_is_in_your_control: "You can gently anchor attention away from bodily scanning toward external sensory cues.",
      action_steps: [
        { step: "Notice 5 external objects", detail: "Count five blue or green items in the room to break internal scanning.", time: "now" },
        { step: "Write down factual symptoms", detail: "Log only objective physical sensations to share with your physician.", time: "today" },
        { step: "Consult primary care clinic", detail: "Call your primary doctor's nurse line for professional advice.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "Managing health concerns while juggling daily tasks feels completely exhausting.",
      what_is_in_your_control: "You can prioritize your physical recuperation and clear non-vital appointments.",
      action_steps: [
        { step: "Lie down and rest eyes", detail: "Give your body ten uninterrupted minutes of quiet resting time.", time: "now" },
        { step: "Postpone non-urgent tasks", detail: "Reschedule errands that can wait until you feel more physically rested.", time: "today" },
        { step: "Follow professional plan", detail: "Stick closely to the routine suggested by your trusted doctor.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "Chronic fatigue, illness, or physical vulnerability are taking an emotional toll.",
      what_is_in_your_control: "You can honor your body's current limits and celebrate every small bit of comfort.",
      action_steps: [
        { step: "Offer your body gratitude", detail: "Thank your body for carrying you through everything today.", time: "now" },
        { step: "Eat a nourishing snack", detail: "Prepare a warm, comforting broth or nutritious snack to support recovery.", time: "today" },
        { step: "Ask loved one for support", detail: "Ask a family member or friend to help with an errand or grocery run.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "Tuning into your physical health with proactive, balanced, and sustainable daily habits.",
      what_is_in_your_control: "You can maintain steady nutrition, hydration, and mindful physical movement.",
      action_steps: [
        { step: "Stretch your body gently", detail: "Stand up and gently stretch your back and arms for two minutes.", time: "now" },
        { step: "Drink adequate water", detail: "Fill a water bottle and keep it beside you throughout the afternoon.", time: "today" },
        { step: "Take a rejuvenating walk", detail: "Enjoy a twenty-minute brisk walk outdoors to boost circulation.", time: "this_week" },
      ],
    },
  },

  money: {
    Stressed: {
      summary: "Expenses, bills, or financial uncertainty are generating pressing pressure and concern.",
      what_is_in_your_control: "You can inspect current accounts factually, create a single realistic budget step, and pause spending.",
      action_steps: [
        { step: "Take a calming breath", detail: "Step away from spreadsheets for three minutes to reset your composure.", time: "now" },
        { step: "List immediate priority bills", detail: "Write down the single most urgent payment due in the next seven days.", time: "today" },
        { step: "Review monthly recurring charges", detail: "Cancel one unused digital subscription to free up immediate funds.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "Financial anxiety and future financial security worries are creating persistent stress.",
      what_is_in_your_control: "You can focus on actionable numbers today rather than catastrophic future scenarios.",
      action_steps: [
        { step: "Write down one practical fact", detail: "Check your exact balance rather than guessing worst-case estimates.", time: "now" },
        { step: "Set a daily spending cap", detail: "Establish a modest, realistic cash limit for today's incidental spending.", time: "today" },
        { step: "Consult a financial advisor", detail: "Explore low-cost community counseling or financial planning tools.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "Multiple bills, expenses, and financial decisions feel too heavy to navigate simultaneously.",
      what_is_in_your_control: "You can address one bill at a time rather than tackling your entire financial life today.",
      action_steps: [
        { step: "Stack bills in order of date", detail: "Put the earliest due bill on top and set the other papers aside.", time: "now" },
        { step: "Call one service provider", detail: "Ask about payment extension options on your most pressing utility bill.", time: "today" },
        { step: "Build a minimal buffer plan", detail: "Map out fifty dollars into an emergency fund over the coming month.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "Financial constraints are limiting your choices or generating feelings of defeat.",
      what_is_in_your_control: "You can remember your human dignity is separate from your account balance.",
      action_steps: [
        { step: "Acknowledge your resilience", detail: "Remind yourself of challenges you have overcome in the past.", time: "now" },
        { step: "Enjoy a free comfort", detail: "Take a walk in a public garden or listen to library music without cost.", time: "today" },
        { step: "Seek community resources", detail: "Look into local assistance programs or student support grants.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "Managing your personal finances with steady awareness and deliberate budgeting.",
      what_is_in_your_control: "You can reinforce prudent saving habits and plan intentional investments in your wellbeing.",
      action_steps: [
        { step: "Check budget category totals", detail: "Glance at your weekly spending to ensure you remain within targets.", time: "now" },
        { step: "Set aside planned savings", detail: "Transfer a designated portion of savings into your reserve account.", time: "today" },
        { step: "Plan upcoming month goals", detail: "Review major expected costs for next month to avoid surprises.", time: "this_week" },
      ],
    },
  },

  general: {
    Stressed: {
      summary: "You are carrying noticeable physical and mental tension right now.",
      what_is_in_your_control: "Turn on AI mode to get suggestions based on your note. Right now you can take one calming pause.",
      action_steps: [
        { step: "Unclench jaw and shoulders", detail: "Notice physical tension and let your shoulders drop gently down.", time: "now" },
        { step: "Slow your breathing pace", detail: "Take five unhurried breaths with a slightly longer exhale than inhale.", time: "today" },
        { step: "Give yourself quiet space", detail: "Protect ten quiet minutes later today to let your nervous system settle.", time: "this_week" },
      ],
    },
    Anxious: {
      summary: "You are noticing anxious energy in your body and mind right now.",
      what_is_in_your_control: "Turn on AI mode to get suggestions based on your note. Right now you can ground yourself gently.",
      action_steps: [
        { step: "Anchor with physical touch", detail: "Feel both feet flat on the floor and take two slow, calming breaths.", time: "now" },
        { step: "Name five steady sights", detail: "Look around the room and quietly notice five calm, neutral details.", time: "today" },
        { step: "Talk with someone trusted", detail: "Share how you have been feeling with someone who makes you feel safe.", time: "this_week" },
      ],
    },
    Overwhelmed: {
      summary: "Things feel heavy right now, and slowing down comes first.",
      what_is_in_your_control: "Turn on AI mode to get suggestions based on your note. You only need one calm step right now.",
      action_steps: [
        { step: "Pause for sixty quiet seconds", detail: "Rest your eyes for a minute and breathe softly without rushing.", time: "now" },
        { step: "Take one gentle sensory reset", detail: "Drink cool water or feel the support of your chair beneath you.", time: "today" },
        { step: "Protect quiet recovery time", detail: "Give yourself permission to keep the rest of your week lighter where possible.", time: "this_week" },
      ],
    },
    Sad: {
      summary: "You are feeling low or emotionally heavy right now.",
      what_is_in_your_control: "Turn on AI mode to get suggestions based on your note. Move gently and be kind to yourself.",
      action_steps: [
        { step: "Offer yourself gentle warmth", detail: "Place a hand over your heart and let yourself move gently right now.", time: "now" },
        { step: "Enjoy one soft comfort", detail: "Wrap up in something warm, listen to calm audio, or rest quietly.", time: "today" },
        { step: "Connect with someone kind", detail: "Spend time with a supportive person or sit somewhere peaceful.", time: "this_week" },
      ],
    },
    Okay: {
      summary: "You are checking in with steady calm right now.",
      what_is_in_your_control: "Turn on AI mode to get suggestions based on your note. You can protect this steady pace.",
      action_steps: [
        { step: "Notice one calm anchor", detail: "Take thirty seconds to notice what feels steady in your body right now.", time: "now" },
        { step: "Take an unhurried breather", detail: "Enjoy two slow breaths before moving on with your day.", time: "today" },
        { step: "Keep room for rest", detail: "Leave a small pocket of unscheduled quiet time later this week.", time: "this_week" },
      ],
    },
  },
};

export const HIGH_CONFIDENCE_SITUATIONS = [
  'sleep',
  'exam',
  'conflict',
  'loneliness',
  'romance',
  'money',
] as const;
export type HighConfidenceSituation = (typeof HIGH_CONFIDENCE_SITUATIONS)[number];

export const ROMANCE_SITUATION_TEMPLATES: Record<Mood, SituationTemplate> = {
  Stressed: {
    summary: "Tension or uncertainty in a romantic relationship is weighing on you right now.",
    what_is_in_your_control: "You can slow down reactive tension and choose calm, honest communication when ready.",
    action_steps: [
      { step: "Pause before replying", detail: "Give yourself five quiet minutes to settle before responding to any message.", time: "now" },
      { step: "Write down what matters", detail: "Jot one calm sentence about what you actually feel or need right now.", time: "today" },
      { step: "Talk when both feel calm", detail: "Pick a quiet, unhurried time to share your thoughts respectfully.", time: "this_week" },
    ],
  },
  Anxious: {
    summary: "Worry or uncertainty around a romantic connection is stirring up anxious feelings.",
    what_is_in_your_control: "You can ground yourself in the present moment rather than trying to predict every outcome.",
    action_steps: [
      { step: "Ground in three slow breaths", detail: "Feel both feet steady on the floor and lengthen each exhale gently.", time: "now" },
      { step: "Notice facts vs fears", detail: "Separate what was actually said from anxious worst-case guesses.", time: "today" },
      { step: "Share openly when ready", detail: "Express one simple need calmly without rushing for an instant fix.", time: "this_week" },
    ],
  },
  Overwhelmed: {
    summary: "Strong feelings around a romantic situation feel heavy right now.",
    what_is_in_your_control: "You can take quiet breathing room right now without solving everything today.",
    action_steps: [
      { step: "Take sixty quiet seconds", detail: "Step away from messages for one minute and let your shoulders drop.", time: "now" },
      { step: "Tend to simple comfort", detail: "Drink some water and give your mind a brief break from replaying conversations.", time: "today" },
      { step: "Lean on trusted support", detail: "Check in with a supportive friend who listens calmly.", time: "this_week" },
    ],
  },
  Sad: {
    summary: "Heartache, distance, or disappointment in a romantic relationship is hurting right now.",
    what_is_in_your_control: "You can treat yourself with deep gentleness and take things one hour at a time.",
    action_steps: [
      { step: "Offer yourself gentle warmth", detail: "Place a hand on your chest and allow yourself to feel hurt without judgment.", time: "now" },
      { step: "Choose one small comfort", detail: "Wrap up somewhere cozy or message a caring friend for quiet company.", time: "today" },
      { step: "Give feelings room to settle", detail: "Move slowly this week without forcing immediate answers.", time: "this_week" },
    ],
  },
  Okay: {
    summary: "Checking in thoughtfully around a romantic connection with calm perspective.",
    what_is_in_your_control: "You can stay grounded in kindness, honesty, and mutual respect.",
    action_steps: [
      { step: "Take one steady breath", detail: "Notice what feels calm and clear inside you right now.", time: "now" },
      { step: "Share one warm word", detail: "Express simple appreciation or care when the moment feels natural.", time: "today" },
      { step: "Protect unhurried time", detail: "Keep space this week for calm, distraction-free connection.", time: "this_week" },
    ],
  },
};

export function matchHighConfidenceSituation(
  note?: string | null
): HighConfidenceSituation | null {
  if (!note || typeof note !== 'string' || !note.trim()) {
    return null;
  }
  const text = note.trim();

  // 1. Sleep / late-night sleeplessness FIRST so "3am, can't sleep, exam tomorrow" routes to sleep, never study
  if (
    /\b(can(?:'|no)?t\s+sleep|cannot\s+sleep|unable\s+to\s+sleep|hard\s+to\s+sleep|struggling\s+to\s+sleep|insomnia|sleepless|wide\s+awake|lying\s+awake|staying\s+awake|restless\s+night|(?:1[0-2]|0?[1-5])\s*(?::\d{2})?\s*a\.?m\.?|midnight|late\s+night|middle\s+of\s+the\s+night|bedtime|nightmares?|waking\s+up\s+at\s+night)\b/i.test(
      text
    )
  ) {
    return 'sleep';
  }

  // 2. Interpersonal conflict
  if (
    /\b(argued|arguing|argument|fight|fighting|conflict|conflicts|disagreement|disagreements|falling\s+out|confrontation|yelled|screamed|shouted|hostile|disrespected)\b/i.test(
      text
    )
  ) {
    return 'conflict';
  }

  // 3. Romance
  if (
    /\b(boyfriend|girlfriend|spouse|husband|wife|break\s*up|breakup|broke\s+up|heartbreak|heartbroken|romantic\s+partner|dating|fiance|fiancee|crush|divorce|ex-boyfriend|ex-girlfriend)\b/i.test(
      text
    )
  ) {
    return 'romance';
  }

  // 4. Loneliness
  if (
    /\b(lonely|loneliness|isolated|isolation|miss\s+my\s+friends?|missed\s+my\s+friends?|nobody\s+to\s+talk\s+to|no\s+one\s+to\s+talk\s+to|feel\s+so\s+alone|all\s+alone|left\s+out|disconnected)\b/i.test(
      text
    )
  ) {
    return 'loneliness';
  }

  // 5. Money (avoid matching physical damage like "phone broke")
  if (
    /\b(money|rent|bills?|debt|debts|financial|finances|expenses?|paycheck|budget|afford|savings|flat\s+broke|dead\s+broke|went\s+broke|i(?:'m|\s+am)\s+broke)\b/i.test(
      text
    )
  ) {
    return 'money';
  }

  // 6. Exam / academics (exclude medical/lab/blood/health/driving tests)
  const sanitizedForExam = text.replace(
    /\b(?:medical|blood|lab|health|diagnostic|clinic|hospital|driving)\s+tests?\b/gi,
    ''
  );
  if (
    /\b(exam|exams|finals|midterm|midterms|homework|assignment|assignments|coursework|syllabus|thesis|dissertation|academics?|grades?|marks|gpa|studying|study\s+(?:for|session|load|plan)|performing\s+well\s+in\s+academics|failing\s+(?:class|course|exam|test|semester)|test\s+(?:tomorrow|today|next\s+week|score))\b/i.test(
      sanitizedForExam
    )
  ) {
    return 'exam';
  }

  return null;
}

export function highConfidenceToTheme(sit: HighConfidenceSituation): Theme {
  if (sit === 'exam') return 'academics';
  if (sit === 'romance') return 'relationships';
  return sit;
}

export function selectPrimaryTheme(detectedThemes: Theme[] = []): Theme | undefined {
  if (!detectedThemes || detectedThemes.length === 0) return undefined;
  if (detectedThemes.includes('sleep')) return 'sleep';
  if (detectedThemes.includes('conflict')) return 'conflict';
  if (detectedThemes.includes('loneliness')) return 'loneliness';
  if (detectedThemes.includes('money')) return 'money';
  if (detectedThemes.includes('academics')) return 'academics';
  if (detectedThemes.includes('relationships')) return 'relationships';
  return undefined;
}

export function getUnclassifiedNoteSituation(mood: Mood): Situation {
  return THEME_SITUATION_TEMPLATES.general[mood];
}

// --------------------------------------------------------------------------
// 3. Empty Note Templates (Mood-based only)
// --------------------------------------------------------------------------
export const EMPTY_NOTE_SITUATIONS: Record<Mood, Situation> = {
  Anxious: {
    summary: "You are experiencing a wave of anxiety right now with no note provided.",
    what_is_in_your_control: "You can slow down your pace and gently steady your immediate space.",
    action_steps: [
      { step: "Anchor with physical touch", detail: "Feel your feet flat on the floor and take two slow breaths.", time: "now" },
      { step: "Step away from screens", detail: "Take a brief physical pause without digital stimulation.", time: "today" },
      { step: "Note triggers when ready", detail: "Write a short sentence in future check-ins if specific worries emerge.", time: "this_week" },
    ],
  },
  Stressed: {
    summary: "You are feeling stressed and holding tension with no note provided.",
    what_is_in_your_control: "You can pause work for two minutes and release physical tension.",
    action_steps: [
      { step: "Drop your shoulders", detail: "Unclench your jaw and let your neck and shoulders soften down.", time: "now" },
      { step: "Take a brief walking pause", detail: "Walk around for five minutes to allow physical adrenaline to dissipate.", time: "today" },
      { step: "Protect your evening rest", detail: "Set a clear boundary to disconnect from work tasks tonight.", time: "this_week" },
    ],
  },
  Overwhelmed: {
    summary: "Everything feels like too much all at once with no note provided.",
    what_is_in_your_control: "You do not need to solve the entire day in this moment.",
    action_steps: [
      { step: "Breathe quietly for one minute", detail: "Close your eyes and breathe softly without judging your pace.", time: "now" },
      { step: "Pick just one tiny task", detail: "Focus on one simple micro-step and let the rest wait.", time: "today" },
      { step: "Create space in your calendar", detail: "Clear one optional commitment this week to relieve pressure.", time: "this_week" },
    ],
  },
  Sad: {
    summary: "You are feeling low energy or heavy today with no note provided.",
    what_is_in_your_control: "You can offer yourself warm patience without demanding high energy.",
    action_steps: [
      { step: "Offer yourself gentle patience", detail: "Place a hand over your heart and allow yourself to feel low.", time: "now" },
      { step: "Do one small comforting act", detail: "Prepare a warm drink or wrap up in a comfortable blanket.", time: "today" },
      { step: "Reach out to one friend", detail: "Send a friendly greeting to a person you trust when ready.", time: "this_week" },
    ],
  },
  Okay: {
    summary: "You are feeling steady and balanced today with no note provided.",
    what_is_in_your_control: "You can deliberately protect your ease and set one clear priority.",
    action_steps: [
      { step: "Notice your present ease", detail: "Take thirty seconds to enjoy this steady, balanced feeling.", time: "now" },
      { step: "Anchor with a kind gesture", detail: "Share a warm word or friendly message with a colleague or friend.", time: "today" },
      { step: "Try an engaging hobby", detail: "Dedicate an hour this weekend to a project or activity you love.", time: "this_week" },
    ],
  },
};

/**
 * Main selector for fallback situation output.
 * Honest rules mode: only uses situation templates for the 6 high-confidence categories
 * (sleep, exam, conflict, loneliness, romance, money). Unmatched notes get pure mood-based calming steps.
 */
export function getFallbackSituation(
  mood: Mood,
  _detectedThemes: Theme[] = [],
  note?: string | null
): Situation {
  const hasNote = Boolean(note && typeof note === 'string' && note.trim().length > 0);

  // If no note provided at all -> mood-based general situation
  if (!hasNote) {
    return EMPTY_NOTE_SITUATIONS[mood];
  }

  const matched = matchHighConfidenceSituation(note);
  if (!matched) {
    return getUnclassifiedNoteSituation(mood);
  }

  if (matched === 'romance') {
    return ROMANCE_SITUATION_TEMPLATES[mood];
  }

  const themeKey = highConfidenceToTheme(matched);
  const themeMap = THEME_SITUATION_TEMPLATES[themeKey];
  if (themeMap && themeMap[mood]) {
    return themeMap[mood];
  }

  return getUnclassifiedNoteSituation(mood);
}
