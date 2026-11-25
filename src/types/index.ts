// Mindora shared types and interfaces

export const MOODS = ['Anxious', 'Stressed', 'Sad', 'Overwhelmed', 'Okay'] as const;
export type Mood = (typeof MOODS)[number];

export const ACTIVITY_TYPES = ['breathing', 'grounding', 'journaling', 'break'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const RATINGS = ['yes', 'a_little', 'no'] as const;
export type Rating = (typeof RATINGS)[number];

export type MoodFitScore = 1 | 2 | 3;
export type MoodFit = Partial<Record<Mood, MoodFitScore>>;

export const THEMES = [
  'academics',
  'work',
  'sleep',
  'relationships',
  'loneliness',
  'health_worry',
  'money',
  'teamwork',
  'conflict',
  'general',
] as const;
export type Theme = (typeof THEMES)[number];

export type ReliefType = 'calm' | 'lift' | 'both';

export interface Activity {
  id: string;
  title: string;
  type: ActivityType;
  duration_minutes: number;
  quick?: boolean;
  relief?: ReliefType;
  mood_fit: MoodFit;
  target_moods?: Mood[];
  target_themes?: Theme[];
  description: string;
  steps: string[];
}

export interface User {
  id: string;
  created_at: string;
}

export interface Checkin {
  id: string;
  user_id: string;
  mood: Mood;
  note: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  checkin_id: string | null;
  activity_id: string;
  started_at: string;
  completed_at: string | null;
  completed: boolean;
}

export interface Feedback {
  id: string;
  user_id: string;
  session_id: string;
  rating: Rating;
  mood?: Mood | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  session_id: string;
  prompt: string;
  text: string;
  created_at: string;
}

export const NEEDS = [
  'calm',
  'focus',
  'comfort',
  'connection',
  'energy',
  'reflect',
  'rest',
  'clarity',
] as const;
export type Need = (typeof NEEDS)[number];

export const INTENSITIES = ['low', 'medium', 'high'] as const;
export type Intensity = (typeof INTENSITIES)[number];

export interface Understanding {
  main_concern: string;
  intensity: Intensity;
  need: Need;
}

export interface Recommendation {
  activity: Activity;
  reason: string;
  personalised_by: 'ai' | 'rules';
}

export interface PlanNowItem {
  activity: Activity;
  reason: string;
  instruction: string;
  by: 'ai' | 'rules';
  personalised_by?: 'ai' | 'rules';
}

export interface PlanNextItem {
  activity: Activity;
  reason: string;
  by: 'ai' | 'rules';
  personalised_by?: 'ai' | 'rules';
}

export interface PlanLater {
  action_steps: SituationActionStep[];
  next_step: string;
  by: 'ai' | 'rules';
  personalised_by?: 'ai' | 'rules';
}

export interface WellbeingPlan {
  understanding?: Understanding;
  acknowledgement: string;
  acknowledgement_by?: 'ai' | 'rules';
  why_this_order: string;
  why_this_order_by?: 'ai' | 'rules';
  situation: Situation;
  situation_by?: 'ai' | 'rules';
  now: PlanNowItem;
  next: PlanNextItem[];
  later: PlanLater;
  relevant_themes?: Theme[];
}

export const WHEN_TIMEFRAMES = ['now', 'today', 'this_week'] as const;
export type WhenTimeframe = (typeof WHEN_TIMEFRAMES)[number];

export interface Suggestion {
  title: string;
  detail: string;
  when: WhenTimeframe;
}

export const SITUATION_TIME_VALUES = ['now', 'today', 'this_week'] as const;
export type SituationTime = (typeof SITUATION_TIME_VALUES)[number];

export interface SituationActionStep {
  step: string;
  detail: string;
  time: SituationTime;
}

export interface Situation {
  summary: string;
  what_is_in_your_control: string;
  action_steps: SituationActionStep[];
}

export interface RecommendationResult {
  understanding?: Understanding;
  need?: Need;
  acknowledgement: string;
  recommendations: Recommendation[];
  next_step: string;
  suggestions?: Suggestion[];
  suggestions_by?: 'ai' | 'rules';
  situation?: Situation;
  situation_by?: 'ai' | 'rules';
  relevant_themes?: Theme[];
  has_note?: boolean;
  plan?: WellbeingPlan;
  constraints_relaxed?: boolean;
}

export interface LatestActivityFeedback {
  activity_id: string;
  rating: Rating;
  mood?: Mood | null;
  weight?: number;
  effectivePreference?: number;
  created_at: string;
  session_id: string;
}

export interface DashboardData {
  user: User;
  recentCheckins: Checkin[];
  recentSessions: (Session & {
    activity?: Activity;
    feedback?: Feedback;
    journalEntry?: JournalEntry;
  })[];
  stats: {
    totalSessions: number;
    completedSessions: number;
    totalMinutesPracticed: number;
    completionRate: number;
    moodCounts: Record<Mood, number>;
    activityTypeCounts: Record<ActivityType, number>;
  };
}

// ================= API Request & Response Types ================= //

// 1. Checkin API (/api/checkin)
export interface CheckinRequest {
  mood: Mood;
  note?: string;
}

export interface CheckinResponse {
  isCrisis?: boolean;
  safety?: boolean;
  checkinId?: string;
  checkin?: Checkin;
  plan?: WellbeingPlan;
  constraints_relaxed?: boolean;
  mode?: 'ai' | 'rules';
  recommendations?: Recommendation[];
  acknowledgement?: string;
  next_step?: string;
  understanding?: Understanding;
  need?: Need;
  suggestions?: Suggestion[];
  suggestions_by?: 'ai' | 'rules';
  situation?: Situation;
  situation_by?: 'ai' | 'rules';
  relevant_themes?: Theme[];
  has_note?: boolean;
  supportiveResources?: SupportiveResources;
  error?: string;
}

// 2. Sessions API (/api/sessions)
export interface CreateSessionRequest {
  activity_id: string;
  checkin_id?: string | null;
}

export interface CreateSessionResponse {
  session: Session;
  error?: string;
}

// 3. Complete Session API (/api/sessions/[id]/complete)
export interface CompleteSessionRequest {
  completed?: boolean;
}

export interface CompleteSessionResponse {
  session: Session;
  error?: string;
}

// 4. Feedback API (/api/feedback)
export interface FeedbackRequest {
  session_id: string;
  rating: Rating;
}

export interface FeedbackResponse {
  feedback: Feedback;
  error?: string;
}

// 5. Journal Entry API (/api/journal)
export interface SaveJournalRequest {
  session_id: string;
  prompt: string;
  text: string;
}

export interface SaveJournalResponse {
  journalEntry: JournalEntry;
  error?: string;
}

// 6. Dashboard API (/api/dashboard)
export interface DashboardResponse {
  data: DashboardData;
  error?: string;
}

// 7. Delete User Data API (/api/user/data)
export interface DeleteUserDataResponse {
  success: boolean;
  message: string;
  error?: string;
}

// 8. Supportive Crisis Resources
export interface SupportiveResources {
  message: string;
  supportiveText: string;
  immediateSteps: string[];
  contacts: {
    name: string;
    description: string;
    howToReach: string;
  }[];
}

// 9. Follow-up Chat Types & API (/api/chat)
export interface ParsedConstraints {
  max_minutes?: number | null;
  exclude_types: ActivityType[];
  include_types: ActivityType[];
  wants_swap: boolean;
  wants_why: boolean;
  wants_steps: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  personalised_by?: 'ai' | 'rules';
}

export interface ChatRequest {
  checkinId: string;
  message: string;
  history?: ChatMessage[];
  current_activity_ids?: string[];
}

export interface ChatResponse {
  reply: string;
  now?: PlanNowItem;
  next?: PlanNextItem[];
  constraints_relaxed?: boolean;
  recommendations: Recommendation[];
  personalised_by: 'ai' | 'rules';
  relaxation_note?: string;
  safety?: boolean;
  supportiveResources?: SupportiveResources;
  error?: string;
}

// 10. Status API (/api/status)
export interface StatusResponse {
  mode: 'ai' | 'rules';
  last_ai_call?: string;
  note_sent?: boolean;
}
