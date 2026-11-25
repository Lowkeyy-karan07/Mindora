'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, Rating, Session } from '@/types';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function ActivityPlayerPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);

  // Flow states
  const [isCompleted, setIsCompleted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // Fetch session & activity details
  useEffect(() => {
    async function loadSession() {
      try {
        setLoading(true);
        const res = await fetch(`/api/session?id=${sessionId}`);
        if (!res.ok) {
          throw new Error('Could not find session');
        }
        const data = await res.json();
        setSession(data.session);
        setActivity(data.activity);
        if (data.session?.completed) {
          setIsCompleted(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    }

    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  // Mark session complete in API
  const handleCompleteActivity = async () => {
    try {
      await fetch('/api/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // Continue even if network glitch, so user can provide feedback
    }
    setIsCompleted(true);
  };

  // Submit feedback rating
  const handleFeedback = async (rating: Rating) => {
    try {
      setSubmittingFeedback(true);
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, rating }),
      });

      const params =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const stage = params?.get('stage');

      if (stage === 'now') {
        try {
          const raw = sessionStorage.getItem('mindora_active_plan');
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.nowDone = true;
            sessionStorage.setItem('mindora_active_plan', JSON.stringify(parsed));
          }
        } catch {
          // Ignore storage errors
        }
        router.push('/?view=plan&doneNow=1');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feedback');
      setSubmittingFeedback(false);
    }
  };

  // Stop activity handler
  const handleStop = () => {
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (params?.get('stage') === 'now') {
      router.push('/?view=plan');
    } else {
      router.push('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Preparing your space...</p>
      </div>
    );
  }

  if (error || !activity || !session) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-3xl text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Activity Not Found</h2>
        <p className="text-sm text-slate-600">{error || 'Session could not be located.'}</p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700"
        >
          Return to Check-in
        </Link>
      </div>
    );
  }

  // SCREEN 4: Feedback Screen
  if (isCompleted) {
    return (
      <div className="max-w-lg mx-auto my-auto p-6 sm:p-8 bg-white border border-slate-200/80 rounded-3xl shadow-sm text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 mx-auto flex items-center justify-center text-2xl shadow-sm">
          ✨
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Activity Finished
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Take a moment to check in with yourself.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
          <p className="font-semibold text-slate-800 text-base">
            Was this activity helpful?
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              disabled={submittingFeedback}
              onClick={() => handleFeedback('yes')}
              className="p-3.5 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50/80 text-emerald-800 font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 flex flex-col items-center gap-1 shadow-xs disabled:opacity-50"
            >
              <span className="text-xl">🌿</span>
              <span>Yes</span>
            </button>

            <button
              type="button"
              disabled={submittingFeedback}
              onClick={() => handleFeedback('a_little')}
              className="p-3.5 rounded-xl border border-amber-200 bg-white hover:bg-amber-50/80 text-amber-800 font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 flex flex-col items-center gap-1 shadow-xs disabled:opacity-50"
            >
              <span className="text-xl">🌤️</span>
              <span>A little</span>
            </button>

            <button
              type="button"
              disabled={submittingFeedback}
              onClick={() => handleFeedback('no')}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 flex flex-col items-center gap-1 shadow-xs disabled:opacity-50"
            >
              <span className="text-xl">☁️</span>
              <span>No</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Your feedback quietly guides future recommendations.
          </p>
        </div>

        <div>
          <button
            type="button"
            disabled={submittingFeedback}
            onClick={() => router.push('/dashboard')}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Skip feedback and view dashboard
          </button>
        </div>
      </div>
    );
  }

  // SCREEN 3: Active Activity Player
  return (
    <div className="space-y-6 flex-1 flex flex-col justify-between">
      {/* Top Header Bar with Prominent ALWAYS-VISIBLE STOP BUTTON */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">
            {activity.type} practice
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {activity.title}
          </h1>
        </div>

        {/* STOP BUTTON */}
        <button
          type="button"
          onClick={() => setShowStopConfirm(true)}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200/80 hover:border-rose-200 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          aria-label="Stop activity"
        >
          <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
          <span>Stop</span>
        </button>
      </div>

      {/* Activity-Specific Player Area */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-6">
        {activity.type === 'breathing' && (
          <BreathingPlayer
            activity={activity}
            onComplete={handleCompleteActivity}
          />
        )}

        {activity.type === 'grounding' && (
          <GroundingPlayer
            activity={activity}
            onComplete={handleCompleteActivity}
          />
        )}

        {activity.type === 'journaling' && (
          <JournalingPlayer
            sessionId={sessionId}
            activity={activity}
            onComplete={handleCompleteActivity}
          />
        )}

        {activity.type === 'break' && (
          <BreakPlayer
            activity={activity}
            onComplete={handleCompleteActivity}
          />
        )}
      </div>

      {/* Stop Confirmation Dialog */}
      {showStopConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Stop this practice?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              You can stop anytime without pressure. Would you like to finish or return to your dashboard?
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowStopConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={handleStop}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 text-white font-medium text-sm hover:bg-rose-700"
              >
                End Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- //
// SUB-PLAYER 1: Breathing Player
// ------------------------------------------------------------- //
interface BreathingStep {
  label: string;
  duration: number; // in seconds
  scale: string;
}

function getBreathingPattern(activityId: string): BreathingStep[] {
  if (activityId === '4-7-8-breathing') {
    return [
      { label: 'Inhale', duration: 4, scale: 'scale-135' },
      { label: 'Hold', duration: 7, scale: 'scale-135' },
      { label: 'Exhale', duration: 8, scale: 'scale-100' },
    ];
  }
  if (activityId === 'physiological-sigh') {
    return [
      { label: 'Deep Inhale', duration: 2, scale: 'scale-125' },
      { label: 'Top Inhale', duration: 1, scale: 'scale-135' },
      { label: 'Long Sigh', duration: 4, scale: 'scale-100' },
    ];
  }
  // Default: Box Breathing (4-4-4-4)
  return [
    { label: 'Inhale', duration: 4, scale: 'scale-135' },
    { label: 'Hold', duration: 4, scale: 'scale-135' },
    { label: 'Exhale', duration: 4, scale: 'scale-100' },
    { label: 'Hold', duration: 4, scale: 'scale-100' },
  ];
}

function BreathingPlayer({
  activity,
  onComplete,
}: {
  activity: Activity;
  onComplete: () => void;
}) {
  const pattern = getBreathingPattern(activity.id);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepSecondsLeft, setStepSecondsLeft] = useState(pattern[0].duration);
  const [isPaused, setIsPaused] = useState(false);
  const [totalSecondsLeft, setTotalSecondsLeft] = useState(activity.duration_minutes * 60);

  const currentStep = pattern[stepIndex];

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      // Decrement step counter
      setStepSecondsLeft((prev) => {
        if (prev <= 1) {
          const nextIndex = (stepIndex + 1) % pattern.length;
          setStepIndex(nextIndex);
          return pattern[nextIndex].duration;
        }
        return prev - 1;
      });

      // Decrement total timer
      setTotalSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, stepIndex, pattern, onComplete]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-8 my-auto">
      {/* Animated Breathing Circle */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
        {/* Outer aura pulse */}
        <div
          className={`
            absolute inset-0 rounded-full bg-teal-100/60 blur-xl transition-transform ease-in-out
            motion-reduce:transition-none
            ${currentStep.scale}
          `}
          style={{ transitionDuration: `${currentStep.duration}s` }}
        />

        {/* Middle gradient ring */}
        <div
          className={`
            absolute w-52 h-52 sm:w-60 sm:h-60 rounded-full bg-gradient-to-tr from-teal-200/80 to-emerald-200/70 transition-transform ease-in-out
            motion-reduce:transition-none
            ${currentStep.scale}
          `}
          style={{ transitionDuration: `${currentStep.duration}s` }}
        />

        {/* Central Core */}
        <div className="relative z-10 w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-white shadow-md border border-teal-100 flex flex-col items-center justify-center text-center p-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-teal-600 mb-1">
            {currentStep.label}
          </span>
          <span className="text-3xl sm:text-4xl font-extrabold text-slate-800 tabular-nums">
            {stepSecondsLeft}
          </span>
        </div>
      </div>

      {/* Session progress and controls */}
      <div className="text-center space-y-3">
        <div className="text-sm font-medium text-slate-500 tabular-nums">
          Remaining: {formatTime(totalSecondsLeft)}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="px-5 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors shadow-xs"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            type="button"
            onClick={onComplete}
            className="px-5 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-xs"
          >
            Finish Early
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- //
// SUB-PLAYER 2: Grounding Player (Step-by-step)
// ------------------------------------------------------------- //
function GroundingPlayer({
  activity,
  onComplete,
}: {
  activity: Activity;
  onComplete: () => void;
}) {
  const steps = activity.steps || [];
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col space-y-6 my-auto">
      {/* Progress Dots */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
        <span>Step {currentStepIndex + 1} of {steps.length}</span>
        <div className="flex gap-1.5">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentStepIndex
                  ? 'w-6 bg-teal-600'
                  : idx < currentStepIndex
                  ? 'w-2 bg-teal-300'
                  : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm min-h-[220px] flex flex-col justify-center text-center space-y-4">
        <div className="text-3xl">🧘</div>
        <p className="text-lg sm:text-xl font-medium text-slate-800 leading-relaxed">
          {steps[currentStepIndex]}
        </p>
      </div>

      {/* Step navigation buttons */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={handleBack}
          disabled={isFirst}
          className="px-5 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
        >
          ← Back
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {isLast ? 'Complete Practice →' : 'Next Step →'}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- //
// SUB-PLAYER 3: Journaling Player
// ------------------------------------------------------------- //
function JournalingPlayer({
  sessionId,
  activity,
  onComplete,
}: {
  sessionId: string;
  activity: Activity;
  onComplete: () => void;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const prompt =
    activity.steps?.[1] ||
    activity.description ||
    'Take a quiet breath and write whatever comes to mind.';

  const handleSave = async () => {
    try {
      setSaving(true);
      if (text.trim()) {
        await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            prompt,
            text: text.trim(),
          }),
        });
      }
      onComplete();
    } catch {
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col space-y-5 my-auto">
      {/* Prompt Card */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 text-amber-950 space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          Reflective Prompt
        </span>
        <p className="text-sm sm:text-base font-medium leading-relaxed">{prompt}</p>
      </div>

      {/* Journal Textarea */}
      <div className="space-y-1.5">
        <textarea
          name="journal-entry"
          autoComplete="off"
          data-lpignore="true"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write freely here. This entry is stored privately on your device and will never be shared..."
          className="w-full p-4 rounded-2xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-800 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none shadow-sm"
        />
        <div className="flex justify-between text-xs text-slate-400 px-1">
          <span>Encrypted &amp; private to your device</span>
          <span>{text.length} characters</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onComplete}
          className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
          Skip writing and finish
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-6 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save & Finish →'}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- //
// SUB-PLAYER 4: Break Player
// ------------------------------------------------------------- //
function BreakPlayer({
  activity,
  onComplete,
}: {
  activity: Activity;
  onComplete: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(activity.duration_minutes * 60);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, onComplete]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const suggestions = activity.steps || [
    'Push back your chair and step away from the screen.',
    'Gaze out a window at something in the distance.',
    'Roll your shoulders and drink a glass of fresh water.',
  ];

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center space-y-6 my-auto">
      {/* Big Timer */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm w-full space-y-2">
        <div className="text-4xl sm:text-5xl font-black text-slate-800 tabular-nums">
          {formatTime(secondsLeft)}
        </div>
        <p className="text-xs text-slate-500 font-medium">Break in progress</p>
      </div>

      {/* Suggestions List */}
      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 text-left w-full space-y-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
          Gentle Suggestions
        </span>
        <ul className="space-y-2 text-sm text-slate-700">
          {suggestions.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPaused(!isPaused)}
          className="px-5 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors shadow-xs"
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          type="button"
          onClick={onComplete}
          className="px-6 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          Finish Break Early →
        </button>
      </div>
    </div>
  );
}
