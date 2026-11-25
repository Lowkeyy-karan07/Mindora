import { Mood, Suggestion, Theme } from '@/types';

/**
 * Templated everyday suggestions for rules mode & fallback.
 * Structured by Mood x Theme (5 moods x 8 themes).
 * Exactly 3 suggestions per (mood, theme) pair.
 * Rules:
 * - title: max 6 words
 * - detail: max 35 words, practical, concrete, low-effort
 * - timeframe: mix at least one 'now' (under 5 mins) and one 'today'
 * - distinct from curated activity catalog and next_step
 * - everyday wellbeing only, strictly non-clinical, zero medical advice
 */
export const FALLBACK_SUGGESTIONS: Record<Theme, Record<Mood, Suggestion[]>> = {
  academics: {
    Anxious: [
      {
        title: 'Clear Immediate Desk Space',
        detail: 'Move everything off your desk except the single page or textbook you need to review right now.',
        when: 'now',
      },
      {
        title: 'Draft Three-Item Study List',
        detail: 'Jot down just three manageable topics you want to review before taking your evening rest.',
        when: 'today',
      },
      {
        title: 'Coordinate Classmate Check-in',
        detail: 'Send a quick message to a study friend to share notes or compare assignment questions this week.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Five-Minute Gaze Break',
        detail: 'Look out a window or focus on a distant spot across the room to rest strained study eyes.',
        when: 'now',
      },
      {
        title: 'Prioritize Today’s Top Assignment',
        detail: 'Highlight the single assignment with the closest deadline and leave lower-priority tasks for tomorrow.',
        when: 'today',
      },
      {
        title: 'Reserve Weekend Study-Free Window',
        detail: 'Block out four uninterrupted hours this weekend with zero schoolwork to let your mental energy recover.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Prepare Warm Tea Ritual',
        detail: 'Brew a gentle cup of tea or warm water to sip slowly while reading your materials.',
        when: 'now',
      },
      {
        title: 'Lower Today’s Study Milestone',
        detail: 'Give yourself permission to finish just one manageable chapter or practice problem set today.',
        when: 'today',
      },
      {
        title: 'Change Study Environment',
        detail: 'Plan to spend an afternoon studying at a quiet local cafe or community library later this week.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Stow Away Extra Binders',
        detail: 'Pack away all textbooks and syllabi except the one task in front of you to clear visual clutter.',
        when: 'now',
      },
      {
        title: 'Separate Questions onto Index Cards',
        detail: 'Write each individual problem onto its own card so you only look at one problem at a time.',
        when: 'today',
      },
      {
        title: 'Draft Questions for Office Hours',
        detail: 'Write down two specific concepts you want to ask your instructor or teaching assistant about this week.',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Tidy Study Highlighters',
        detail: 'Organize your study tools and bookmark upcoming chapters while your focus feels clear and stable.',
        when: 'now',
      },
      {
        title: 'Outline Weekly Course Goals',
        detail: 'Spend ten minutes mapping out lecture readings and project checkpoints across the upcoming days.',
        when: 'today',
      },
      {
        title: 'Preview Next Week’s Topic',
        detail: 'Skim the introductory summary of next week’s syllabus topic while your curiosity and focus are steady.',
        when: 'this_week',
      },
    ],
  },
  work: {
    Anxious: [
      {
        title: 'Step Away from Workstation',
        detail: 'Stand up, walk to the water fountain or kitchen, and give yourself two minutes away from screens.',
        when: 'now',
      },
      {
        title: 'Silence Low-Priority Notifications',
        detail: 'Mute non-urgent chat channels or email alerts for the next two hours to reduce notification anxiety.',
        when: 'today',
      },
      {
        title: 'Review Upcoming Meeting Agenda',
        detail: 'Look over your calendar for the rest of the week and decline or shorten optional gatherings.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Shoulder Drop and Unclench',
        detail: 'Consciously drop your shoulders away from your ears and unclench your jaw while sitting upright.',
        when: 'now',
      },
      {
        title: 'Set Hard Work Wrap-Up',
        detail: 'Pick a specific time this evening to shut down your work laptop and step away completely.',
        when: 'today',
      },
      {
        title: 'Schedule Catch-Up Focus Block',
        detail: 'Reserve a two-hour focus block on your calendar with no meetings to clear backlog items.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Step Outside for Fresh Air',
        detail: 'Take a three-minute stroll outdoors to feel natural sunlight and breathe fresh air.',
        when: 'now',
      },
      {
        title: 'Celebrate One Completed Deliverable',
        detail: 'Acknowledge even a small task you wrapped up today and note it down as progress.',
        when: 'today',
      },
      {
        title: 'Plan Relaxing Lunch Break',
        detail: 'Arrange to take your full lunch break away from your desk with a non-work colleague this week.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Close Unrelated Browser Tabs',
        detail: 'Close or bookmark every open browser tab except the single document you are actively editing.',
        when: 'now',
      },
      {
        title: 'Pick Single Afternoon Priority',
        detail: 'Identify the one work deliverable that matters most before 5 PM and defer other requests.',
        when: 'today',
      },
      {
        title: 'Draft Workload Update to Manager',
        detail: 'Draft a short, neutral summary of your current project commitments to align on priorities.',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Organize Your Desktop Files',
        detail: 'Archive old downloads and organize active project folders while your mind feels calm and organized.',
        when: 'now',
      },
      {
        title: 'Send Supportive Team Note',
        detail: 'Send a quick message of appreciation to a coworker who helped you on a recent task.',
        when: 'today',
      },
      {
        title: 'Brainstorm One Process Improvement',
        detail: 'Note down one recurring work friction point you could streamline or simplify this week.',
        when: 'this_week',
      },
    ],
  },
  sleep: {
    Anxious: [
      {
        title: 'Dim Bedroom Lighting',
        detail: 'Turn off overhead lights and switch to a warm, dim bedside lamp right now.',
        when: 'now',
      },
      {
        title: 'Park Tomorrow’s To-Do List',
        detail: 'Write down three reminders for tomorrow onto paper so your mind doesn’t loop through them in bed.',
        when: 'today',
      },
      {
        title: 'Set Bedtime Screen Boundary',
        detail: 'Commit to docking your phone across the room 30 minutes before sleep for the next three nights.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Warm Face Cloth Rinse',
        detail: 'Rinse your face with pleasantly warm water to physically signal your body to unwind.',
        when: 'now',
      },
      {
        title: 'Skip Late Caffeine Intake',
        detail: 'Switch from afternoon coffee or sodas to water or chamomile tea for the rest of today.',
        when: 'today',
      },
      {
        title: 'Fresh Pillowcase Refresh',
        detail: 'Put fresh, clean pillowcases onto your bed to create an inviting, restful sleeping atmosphere.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Slip into Soft Clothes',
        detail: 'Change into your softest, most comfortable lounge clothes to give your body soothing physical comfort.',
        when: 'now',
      },
      {
        title: 'Listen to Gentle Audio',
        detail: 'Queue up quiet ambient nature sounds or soft acoustic music to drift off peacefully tonight.',
        when: 'today',
      },
      {
        title: 'Protect One Restful Morning',
        detail: 'Pick one weekend morning to wake up naturally without setting an early alarm clock.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Clear Clutter Off Bed',
        detail: 'Remove books, laundry, or laptops from your bed so your sleep area is completely open.',
        when: 'now',
      },
      {
        title: 'Step Away from Displays Early',
        detail: 'Power down TVs, tablets, and computer monitors an hour before your intended bedtime tonight.',
        when: 'today',
      },
      {
        title: 'Establish Evening Wind-down Pattern',
        detail: 'Practice a consistent 15-minute sequence of dimming lights and quiet reading before bed this week.',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Check Bedroom Temperature',
        detail: 'Adjust your room thermostat or crack a window slightly to ensure a cool, comfortable sleep space.',
        when: 'now',
      },
      {
        title: 'Note Restful Night Reflection',
        detail: 'Briefly note how good sleep supported your clear energy today so you can repeat the habit.',
        when: 'today',
      },
      {
        title: 'Maintain Consistent Sleep Schedule',
        detail: 'Aim to sleep and wake at the same target hours across the next four days to lock in rhythm.',
        when: 'this_week',
      },
    ],
  },
  relationships: {
    Anxious: [
      {
        title: 'Delay Impulsive Text Replies',
        detail: 'Take a three-minute pause before replying to a message so you can answer from a calm space.',
        when: 'now',
      },
      {
        title: 'Write Feelings in Private Notes',
        detail: 'Draft what you want to say in a private scratchpad first to clarify your true boundary.',
        when: 'today',
      },
      {
        title: 'Schedule Low-Key Walk and Talk',
        detail: 'Invite a close friend for a casual, no-pressure walk outdoors in your neighbourhood.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Unclench and Take Space',
        detail: 'Step into a quiet room alone for two minutes to let interpersonal tension soften.',
        when: 'now',
      },
      {
        title: 'State Gentle Time Boundary',
        detail: 'Politely let someone know you will catch up with them this evening after you decompress.',
        when: 'today',
      },
      {
        title: 'Plan Shared Uplifting Activity',
        detail: 'Coordinate a low-friction dinner or coffee with someone whose presence feels soothing.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Send Brief Heart Emoji',
        detail: 'Send a simple warm emoji to a caring friend or family member just to feel connected.',
        when: 'now',
      },
      {
        title: 'Express Simple Appreciation',
        detail: 'Tell someone one small thing they did recently that brought ease or comfort into your life.',
        when: 'today',
      },
      {
        title: 'Share Casual Phone Call',
        detail: 'Reach out to an old friend for a brief 15-minute catch-up to reconnect without expectations.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Pause Group Chat Notifications',
        detail: 'Mute busy group messaging threads for two hours so you aren’t bombarded with social pings.',
        when: 'now',
      },
      {
        title: 'Decline One Optional Obligation',
        detail: 'Kindly say no to an optional social plan this evening to preserve your remaining energy.',
        when: 'today',
      },
      {
        title: 'Clarify Shared Responsibilities',
        detail: 'Have a brief, practical conversation with a partner or housemate about dividing household chores.',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Send Spontaneous Friendly Note',
        detail: 'Text a friend to wish them a great afternoon while your spirit feels bright and generous.',
        when: 'now',
      },
      {
        title: 'Offer Helpful Gesture',
        detail: 'Do a small kind deed for someone you live with or work alongside without being asked.',
        when: 'today',
      },
      {
        title: 'Organize Weekend Gathering',
        detail: 'Suggest a relaxed park picnic or casual meetup with friends for the upcoming weekend.',
        when: 'this_week',
      },
    ],
  },
  loneliness: {
    Anxious: [
      {
        title: 'Listen to Familiar Voice',
        detail: 'Turn on a gentle podcast or comforting audio show to hear friendly human voices around you.',
        when: 'now',
      },
      {
        title: 'Send Low-Pressure Friendly Text',
        detail: 'Message someone you trust: "Hey, thinking of you! Hope your week is going gently."',
        when: 'today',
      },
      {
        title: 'Visit Community Third Place',
        detail: 'Spend an hour working, reading, or resting at a bustling local bookstore or coffee shop.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Step Into Shared Common Area',
        detail: 'Walk to a shared public room or building lobby just to feel the quiet presence of others.',
        when: 'now',
      },
      {
        title: 'Exchange Small Daily Pleasantry',
        detail: 'Smile or say a genuine hello to your building attendant, barista, or postal carrier today.',
        when: 'today',
      },
      {
        title: 'Attend Local Interest Meetup',
        detail: 'Look up a local book club, walking group, or community volunteer session for this weekend.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Wrap in Comfortable Blanket',
        detail: 'Wrap yourself in a warm blanket and hold a comforting warm beverage to ease the hollow ache.',
        when: 'now',
      },
      {
        title: 'Reach Out to One Person',
        detail: 'Send a message or voice note to a loved one letting them know you’d appreciate a quick chat.',
        when: 'today',
      },
      {
        title: 'Schedule Regular Social Anchor',
        detail: 'Plan a recurring weekly phone call or coffee date with a dependable friend or relative.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Step Away from Social Feeds',
        detail: 'Close social media apps that make you feel isolated or envious of others’ curated highlights.',
        when: 'now',
      },
      {
        title: 'Write Note to Future Self',
        detail: 'Remind yourself in writing that feelings of isolation are temporary and do not define your worth.',
        when: 'today',
      },
      {
        title: 'Explore Hobby Group Online',
        detail: 'Join an interest group centered on a quiet creative hobby you enjoy (crafts, gardening, reading).',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Say Hello to Neighbour',
        detail: 'Wave or greet a neighbour or colleague passing by with genuine warmth.',
        when: 'now',
      },
      {
        title: 'Re-engage Old Friendship',
        detail: 'Send a warm message to an old classmate or colleague you haven’t spoken with in months.',
        when: 'today',
      },
      {
        title: 'Host Informal Gathering',
        detail: 'Invite two acquaintances for tea or a walk to cultivate deeper, ongoing connections.',
        when: 'this_week',
      },
    ],
  },
  health_worry: {
    Anxious: [
      {
        title: 'Stop Online Symptom Searching',
        detail: 'Close all health forum search tabs and step away from self-diagnosing searches right now.',
        when: 'now',
      },
      {
        title: 'Write Down Physical Facts Only',
        detail: 'List the basic factual sensations you notice without speculating on worst-case explanations.',
        when: 'today',
      },
      {
        title: 'Schedule Routine Consultation',
        detail: 'Book a standard check-in appointment with your regular doctor if a question remains unresolved.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Drink Glass of Cold Water',
        detail: 'Slowly sip a full glass of cool water to physically hydrate and regulate your nervous system.',
        when: 'now',
      },
      {
        title: 'Take Nourishing Meal Break',
        detail: 'Sit down and eat a balanced, simple meal without looking at medical articles or phones.',
        when: 'today',
      },
      {
        title: 'Plan Gentle Rest Afternoon',
        detail: 'Schedule an evening of calm, restful reading with zero physically taxing chores this week.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Place Hand Over Heart',
        detail: 'Rest your palm gently on your chest to offer your physical body kindness and reassurance.',
        when: 'now',
      },
      {
        title: 'Acknowledge Your Body’s Work',
        detail: 'Remind yourself that your body works hard to support you every single day through fatigue.',
        when: 'today',
      },
      {
        title: 'Arrange Supportive Walk with Friend',
        detail: 'Ask a trusted friend to accompany you on a relaxed walk to share company and ease worry.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Disconnect from Health Alerts',
        detail: 'Turn off fitness tracker notifications and heart-rate monitoring dials for the afternoon.',
        when: 'now',
      },
      {
        title: 'Focus on One Practical Need',
        detail: 'Address one simple physical comfort: adjust your posture, rest your legs, or dim your lights.',
        when: 'today',
      },
      {
        title: 'Draft Questions for Healthcare Team',
        detail: 'Write three concise questions to bring to your upcoming healthcare visit to stay focused.',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Refill Water Bottle',
        detail: 'Fill a fresh bottle of water to keep on your desk and stay pleasantly hydrated all afternoon.',
        when: 'now',
      },
      {
        title: 'Enjoy Nourishing Whole Snack',
        detail: 'Prepare a crisp piece of fruit or handful of nuts to celebrate taking care of your body.',
        when: 'today',
      },
      {
        title: 'Plan Outdoor Nature Walk',
        detail: 'Map out a scenic trail or botanical garden walk to enjoy healthy movement this coming weekend.',
        when: 'this_week',
      },
    ],
  },
  money: {
    Anxious: [
      {
        title: 'Step Away from Banking Apps',
        detail: 'Close banking dashboards and account balances right now to prevent compulsive checking.',
        when: 'now',
      },
      {
        title: 'List Essential Monthly Fixed Costs',
        detail: 'Write down only your core essentials (housing, food, utilities) to ground what is necessary.',
        when: 'today',
      },
      {
        title: 'Review Subscription Cancellations',
        detail: 'Identify one unused streaming or app subscription you can cancel to save effortlessly.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Take Deep Breath Before Purchases',
        detail: 'Pause and put non-essential online shopping carts on hold for twenty-four hours.',
        when: 'now',
      },
      {
        title: 'Cook Simple Pantry Meal',
        detail: 'Cook a hearty meal using ingredients already in your pantry instead of ordering takeout.',
        when: 'today',
      },
      {
        title: 'Draft Simple Spending Snapshot',
        detail: 'Dedicate 20 quiet minutes to write a simple outline of your weekly cash flow without judgment.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Remind Yourself of Non-Monetary Gifts',
        detail: 'Note three things you deeply enjoy that cost nothing (a walk, quiet library books, good friends).',
        when: 'now',
      },
      {
        title: 'Treat Yourself to Free Comfort',
        detail: 'Enjoy a warm bath, favorite playlist, or cozy blanket to nurture yourself without spending.',
        when: 'today',
      },
      {
        title: 'Explore Free Community Events',
        detail: 'Check local library or community boards for free weekend concerts, museums, or lectures.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Stack Bills into Single Envelope',
        detail: 'Place all paper statements into one envelope so they aren’t scattered visibly across your table.',
        when: 'now',
      },
      {
        title: 'Address Single Utility Bill',
        detail: 'Pay or set up an automatic payment for just one single utility bill to make measurable progress.',
        when: 'today',
      },
      {
        title: 'Check Community Assistance Resources',
        detail: 'Research local utility discount programs or community assistance options available this month.',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Review Recent Savings Progress',
        detail: 'Take a quick glance at your savings balance and acknowledge your disciplined habits.',
        when: 'now',
      },
      {
        title: 'Plan Weekly Grocery Budget',
        detail: 'Jot down a straightforward meal plan for the rest of the week before visiting the store.',
        when: 'today',
      },
      {
        title: 'Automate Small Weekly Transfer',
        detail: 'Set up a small automated transfer into your savings account for the upcoming pay period.',
        when: 'this_week',
      },
    ],
  },
  teamwork: {
    Anxious: [
      {
        title: 'Outline Your Own Deliverable',
        detail: 'Write down the single section you are responsible for so you have absolute clarity.',
        when: 'now',
      },
      {
        title: 'Send Friendly Group Update',
        detail: 'Post a brief message in the group chat outlining what you plan to complete today.',
        when: 'today',
      },
      {
        title: 'Check In With Project Lead',
        detail: 'If deadlines remain unclear, schedule a 5-minute alignment check with your supervisor or instructor.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Step Away from Group Chat',
        detail: 'Mute non-urgent project notifications for thirty minutes to let physical tension subside.',
        when: 'now',
      },
      {
        title: 'Clarify Remaining Project Sections',
        detail: 'List unfinished tasks in the shared document so responsibilities are visible to everyone.',
        when: 'today',
      },
      {
        title: 'Propose a Brief Team Sync',
        detail: 'Suggest a focused 15-minute meeting before the deadline to confirm who owns final submissions.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Acknowledge Your Honest Effort',
        detail: 'Take a quiet moment to recognize how hard you have worked, regardless of other team members.',
        when: 'now',
      },
      {
        title: 'Focus on One Personal Milestone',
        detail: 'Complete one small part of your assigned share and reward yourself with a warm drink.',
        when: 'today',
      },
      {
        title: 'Connect with a Supportive Peer',
        detail: 'Talk with an encouraging friend outside this project to gain perspective and emotional support.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Stop Taking on Extra Work',
        detail: 'Take two deep breaths and give yourself permission to stick strictly to your own assigned share.',
        when: 'now',
      },
      {
        title: 'Strip Tasks to Core Essentials',
        detail: 'Highlight only the mandatory requirements needed to submit the project successfully on time.',
        when: 'today',
      },
      {
        title: 'Request Supervisor Clarification',
        detail: 'Ask your instructor or team manager for guidance on dividing workload fairly if teammates stay unresponsive.',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Review Shared Project Outline',
        detail: 'Take two minutes to review progress and make sure all current files are organized.',
        when: 'now',
      },
      {
        title: 'Send an Encouraging Note',
        detail: 'Drop a friendly thank you or positive remark to a teammate who helped out.',
        when: 'today',
      },
      {
        title: 'Plan Early Submission Review',
        detail: 'Set aside thirty minutes a day before the due date for final formatting and polish.',
        when: 'this_week',
      },
    ],
  },
  conflict: {
    Anxious: [
      {
        title: 'Pause Before Answering Messages',
        detail: 'Step away from the screen for three minutes before replying to any charged or tense note.',
        when: 'now',
      },
      {
        title: 'Draft Thoughts in Private Notes',
        detail: 'Write out what you feel in a private memo first to organize your thoughts calmly.',
        when: 'today',
      },
      {
        title: 'Schedule an Unhurried Talk',
        detail: 'Suggest a quiet, neutral time to talk through differences when both sides feel rested and composed.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Release Tension from Shoulders',
        detail: 'Drop your shoulders away from your ears and let your hands rest gently on your lap.',
        when: 'now',
      },
      {
        title: 'Establish a Respectful Boundary',
        detail: 'Communicate clearly when you are available to continue the conversation without emotional pressure.',
        when: 'today',
      },
      {
        title: 'Reflect on What Matters Most',
        detail: 'Identify the core outcome you need from this relationship and set secondary disagreements aside.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Offer Yourself Gentle Comfort',
        detail: 'Place a hand over your heart and remind yourself that difficult disagreements take time to heal.',
        when: 'now',
      },
      {
        title: 'Do One Restorative Activity',
        detail: 'Spend half an hour on a creative or quiet hobby to restore your emotional energy.',
        when: 'today',
      },
      {
        title: 'Seek Advice from Trusted Confidant',
        detail: 'Share your feelings with someone outside the situation who listens with compassion and fairness.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Step Out of the Room',
        detail: 'Take five quiet minutes outside or in another space to de-escalate emotional intensity.',
        when: 'now',
      },
      {
        title: 'Limit Conflict Discussions Today',
        detail: 'Politely state that you need time to process before resuming any intense discussion today.',
        when: 'today',
      },
      {
        title: 'Focus on Shared Common Ground',
        detail: 'Write down two points where you and the other person already agree to rebuild trust.',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Anchor Your Calm Presence',
        detail: 'Take a deep breath and appreciate your steady ability to handle interpersonal friction calmly.',
        when: 'now',
      },
      {
        title: 'Extend a Generous Perspective',
        detail: 'Consider the situation from the other person\'s viewpoint to maintain mutual respect.',
        when: 'today',
      },
      {
        title: 'Practice Constructive Listening',
        detail: 'In your next conversation, listen attentively without interrupting before sharing your perspective.',
        when: 'this_week',
      },
    ],
  },
  general: {
    Anxious: [
      {
        title: 'Unclench Jaws and Hands',
        detail: 'Open your palms flat against your lap and soften your jaw to physically release tension.',
        when: 'now',
      },
      {
        title: 'Step Away from Distracting News',
        detail: 'Put news feeds and headlines on silent for the rest of the day to let your mind quiet down.',
        when: 'today',
      },
      {
        title: 'Plan Restful Solitary Evening',
        detail: 'Block out an evening this week with no social duties, dedicated strictly to quiet rest.',
        when: 'this_week',
      },
    ],
    Stressed: [
      {
        title: 'Stand and Stretch Arms Overhead',
        detail: 'Reach your arms high above your head, stretch your torso gently, and breathe out slowly.',
        when: 'now',
      },
      {
        title: 'Drink Tall Glass of Water',
        detail: 'Hydrate fully with a tall glass of cool water and take a five-minute break away from screens.',
        when: 'today',
      },
      {
        title: 'Clear Out One Cluttered Drawer',
        detail: 'Spend 15 minutes organizing a small corner of your living area to create physical calm.',
        when: 'this_week',
      },
    ],
    Sad: [
      {
        title: 'Wrap in Cozy Warmth',
        detail: 'Pull on a favorite warm sweater or cozy blanket to provide physical soothing right now.',
        when: 'now',
      },
      {
        title: 'Listen to Uplifting Music Album',
        detail: 'Play an album or acoustic playlist that evokes comfort and peace as you go through your evening.',
        when: 'today',
      },
      {
        title: 'Schedule Time with Trusted Person',
        detail: 'Reach out to a trusted loved one or friend to arrange a gentle, restorative catch-up.',
        when: 'this_week',
      },
    ],
    Overwhelmed: [
      {
        title: 'Close Your Eyes for Two Minutes',
        detail: 'Rest your eyes in darkness for two quiet minutes and allow your thoughts to settle.',
        when: 'now',
      },
      {
        title: 'Pick Just One Manageable Task',
        detail: 'Choose one small, easy errand to finish today and consciously permit yourself to leave the rest.',
        when: 'today',
      },
      {
        title: 'Take a Walk in Green Space',
        detail: 'Plan a calm walk in a local park or quiet tree-lined street to reset your sensory system.',
        when: 'this_week',
      },
    ],
    Okay: [
      {
        title: 'Savor This Present Moment',
        detail: 'Take a slow, appreciative breath and acknowledge the pleasant sense of balance you feel right now.',
        when: 'now',
      },
      {
        title: 'Set One Uplifting Intention',
        detail: 'Decide on one positive, grounded focus for how you want to spend your evening hours.',
        when: 'today',
      },
      {
        title: 'Try Something New This Weekend',
        detail: 'Pick a new walking path, recipe, or book to explore while your energy is steady and positive.',
        when: 'this_week',
      },
    ],
  },
};

/**
 * Returns 3 templated suggestions for a given mood and detected themes.
 */
export function getFallbackSuggestions(
  mood: Mood,
  detectedThemes: Theme[] = []
): Suggestion[] {
  const primaryTheme: Theme = detectedThemes.length > 0 ? detectedThemes[0] : 'general';
  const themeMap = FALLBACK_SUGGESTIONS[primaryTheme] || FALLBACK_SUGGESTIONS.general;
  const moodSuggestions = themeMap[mood] || themeMap.Okay || FALLBACK_SUGGESTIONS.general[mood];
  return moodSuggestions;
}
