'use client';

import React, { useState, useEffect } from 'react';
import {
  Mood,
  Need,
  Recommendation,
  Situation,
  Understanding,
  WellbeingPlan,
} from '@/types';
import { MoodSelector } from '@/components/MoodSelector';
import { SafetyScreen } from '@/components/SafetyScreen';
import { RecommendationsView } from '@/components/RecommendationsView';

const ACTIVE_PLAN_STORAGE_KEY = 'mindora_active_plan';

interface StoredPlanState {
  checkinId: string;
  plan?: WellbeingPlan;
  recommendations: Recommendation[];
  acknowledgement?: string;
  next_step?: string;
  need?: Need;
  understanding?: Understanding;
  situation?: Situation;
  situation_by?: 'ai' | 'rules';
  constraintsRelaxed?: boolean;
  mode?: 'ai' | 'rules';
  hasNote?: boolean;
  nowDone?: boolean;
}

export default function HomePage() {
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMode, setStatusMode] = useState<'ai' | 'rules'>('rules');

  // Flow states
  const [isSafetyTriggered, setIsSafetyTriggered] = useState<boolean>(false);
  const [recommendationData, setRecommendationData] = useState<StoredPlanState | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((d) => {
        if (d?.mode === 'ai' || d?.mode === 'rules') {
          setStatusMode(d.mode);
        }
      })
      .catch(() => {
        setStatusMode('rules');
      });

    // Restore active plan if returning from completing the "Right now" activity
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'plan') {
        const raw = sessionStorage.getItem(ACTIVE_PLAN_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredPlanState;
          if (parsed && parsed.checkinId && parsed.plan) {
            if (params.get('doneNow') === '1') {
              parsed.nowDone = true;
            }
            setRecommendationData(parsed);
          }
        }
        window.history.replaceState({}, '', '/');
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMood) {
      setError('Please select how you are feeling.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: selectedMood,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Check-in failed');
      }

      const data = await res.json();

      if (data.safety) {
        try {
          sessionStorage.removeItem(ACTIVE_PLAN_STORAGE_KEY);
        } catch {
          // ignore
        }
        setIsSafetyTriggered(true);
        setRecommendationData(null);
      } else if (data.checkinId && (data.plan || data.recommendations)) {
        const nextState: StoredPlanState = {
          checkinId: data.checkinId,
          plan: data.plan,
          recommendations: data.recommendations || [],
          acknowledgement: data.plan?.acknowledgement || data.acknowledgement,
          next_step: data.plan?.later?.next_step || data.next_step,
          need: data.need || data.plan?.understanding?.need || data.understanding?.need,
          understanding: data.plan?.understanding || data.understanding,
          situation: data.plan?.situation || data.situation,
          situation_by: data.plan?.situation_by || data.situation_by,
          constraintsRelaxed: Boolean(data.constraints_relaxed),
          mode: data.mode,
          hasNote: data.has_note ?? Boolean(note && note.trim().length > 0),
          nowDone: false,
        };
        try {
          sessionStorage.setItem(ACTIVE_PLAN_STORAGE_KEY, JSON.stringify(nextState));
        } catch {
          // ignore
        }
        setRecommendationData(nextState);
        setIsSafetyTriggered(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    try {
      sessionStorage.removeItem(ACTIVE_PLAN_STORAGE_KEY);
    } catch {
      // ignore
    }
    setIsSafetyTriggered(false);
    setRecommendationData(null);
    setSelectedMood(null);
    setNote('');
    setError(null);
  };

  // State 1: Safety Screen
  if (isSafetyTriggered) {
    return <SafetyScreen onBack={handleReset} />;
  }

  // State 2: Ordered Plan / Recommendations View
  if (recommendationData) {
    return (
      <RecommendationsView
        checkinId={recommendationData.checkinId}
        plan={recommendationData.plan}
        recommendations={recommendationData.recommendations}
        acknowledgement={recommendationData.acknowledgement}
        next_step={recommendationData.next_step}
        need={recommendationData.need}
        understanding={recommendationData.understanding}
        situation={recommendationData.situation}
        situation_by={recommendationData.situation_by}
        constraintsRelaxed={recommendationData.constraintsRelaxed}
        hasNote={recommendationData.hasNote}
        initialNowDone={recommendationData.nowDone}
        onCancel={handleReset}
        onSafetyTrigger={() => {
          try {
            sessionStorage.removeItem(ACTIVE_PLAN_STORAGE_KEY);
          } catch {
            // ignore
          }
          setIsSafetyTriggered(true);
          setRecommendationData(null);
        }}
      />
    );
  }

  // State 3: Check-in Form
  return (
    <div className="space-y-8 my-auto">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              statusMode === 'ai'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                statusMode === 'ai' ? 'bg-purple-500' : 'bg-slate-400'
              }`}
            />
            {statusMode === 'ai' ? 'AI personalisation: on' : 'Rules mode'}
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          How are you feeling right now?
        </h1>
        <p className="text-slate-600 text-sm sm:text-base max-w-lg mx-auto">
          Take a single breath, notice how you feel, and let Mindora suggest 3 gentle, simple practices.
        </p>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
        {/* Mood Selector */}
        <div className="space-y-2.5">
          <label className="block text-sm font-semibold text-slate-700">
            Select your mood <span className="text-rose-500">*</span>
          </label>
          <MoodSelector selectedMood={selectedMood} onSelectMood={setSelectedMood} />
        </div>

        {/* Optional Note */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="checkin-note" className="block text-sm font-semibold text-slate-700">
              Add a brief thought <span className="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <span
              className={`text-xs ${
                note.length > 280 ? 'text-amber-600 font-semibold' : 'text-slate-400'
              }`}
            >
              {note.length}/300
            </span>
          </div>

          <textarea
            id="checkin-note"
            name="checkin-note"
            autoComplete="off"
            data-lpignore="true"
            rows={3}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What feels heavy, tight, or on your mind? (e.g. deadline pressure, restless energy...)"
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none shadow-sm"
          />
        </div>

        {/* Privacy Disclosure Notice */}
        <div className="p-3.5 rounded-2xl bg-slate-100/70 border border-slate-200/60 text-xs text-slate-500 flex items-start gap-2.5 leading-relaxed">
          <span className="text-base leading-none mt-0.5">🔒</span>
          <div>
            <strong>Privacy &amp; Data:</strong> Your wellbeing history is stored locally on this
            device. When AI personalization is active, your selected mood and note may be sent to
            Google Gemini to explain recommendations, without your name or identifying information.
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedMood || loading}
          className="w-full py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold text-base transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Finding matching activities...</span>
            </>
          ) : (
            <span>Get suggestions →</span>
          )}
        </button>
      </form>
    </div>
  );
}
