'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChatMessage,
  ChatResponse,
  Need,
  PlanNextItem,
  PlanNowItem,
  Recommendation,
  Situation,
  Understanding,
  WellbeingPlan,
} from '@/types';

interface RecommendationsViewProps {
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
  hasNote?: boolean;
  initialNowDone?: boolean;
  onCancel: () => void;
  onSafetyTrigger?: () => void;
}

const QUICK_CHIPS = [
  'Shorter please',
  'No breathing exercises',
  'Something different',
  'Why these?',
];

const ACTIVE_PLAN_STORAGE_KEY = 'mindora_active_plan';

export function RecommendationsView({
  checkinId,
  plan,
  recommendations,
  acknowledgement,
  next_step,
  need,
  understanding,
  situation,
  situation_by = 'rules',
  constraintsRelaxed = false,
  hasNote = false,
  initialNowDone = false,
  onCancel,
  onSafetyTrigger,
}: RecommendationsViewProps) {
  const router = useRouter();
  const [startingActivityId, setStartingActivityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Build initial "now" and "next" items from plan (with fallback to flat recommendations)
  const fallbackNow: PlanNowItem | undefined =
    plan?.now ||
    (recommendations[0]
      ? {
          activity: recommendations[0].activity,
          reason: recommendations[0].reason,
          instruction: recommendations[0].activity.description,
          by: recommendations[0].personalised_by,
        }
      : undefined);

  const fallbackNext: PlanNextItem[] =
    plan?.next ||
    recommendations.slice(1, 3).map((r) => ({
      activity: r.activity,
      reason: r.reason,
      by: r.personalised_by,
    }));

  const [currentNow, setCurrentNow] = useState<PlanNowItem | undefined>(fallbackNow);
  const [currentNext, setCurrentNext] = useState<PlanNextItem[]>(fallbackNext);
  const [isRelaxed, setIsRelaxed] = useState<boolean>(constraintsRelaxed);
  const [nowDone, setNowDone] = useState<boolean>(initialNowDone);
  const [highlightCards, setHighlightCards] = useState<boolean>(false);

  // Follow-up chat state (ephemeral, client state only)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    setNowDone(initialNowDone);
  }, [initialNowDone]);

  const persistActivePlan = (
    nextNowDone: boolean,
    updatedNow?: PlanNowItem,
    updatedNext?: PlanNextItem[],
    relaxedFlag?: boolean
  ) => {
    try {
      const updatedPlan: WellbeingPlan | undefined = plan
        ? {
            ...plan,
            now: updatedNow || currentNow || plan.now,
            next: updatedNext || currentNext || plan.next,
          }
        : undefined;

      sessionStorage.setItem(
        ACTIVE_PLAN_STORAGE_KEY,
        JSON.stringify({
          checkinId,
          plan: updatedPlan,
          recommendations: updatedPlan
            ? [
                {
                  activity: updatedPlan.now.activity,
                  reason: updatedPlan.now.reason,
                  personalised_by: updatedPlan.now.by,
                },
                ...updatedPlan.next.map((n) => ({
                  activity: n.activity,
                  reason: n.reason,
                  personalised_by: n.by,
                })),
              ]
            : recommendations,
          acknowledgement: plan?.acknowledgement || acknowledgement,
          next_step: plan?.later?.next_step || next_step,
          need: need || plan?.understanding?.need || understanding?.need,
          understanding: plan?.understanding || understanding,
          situation: plan?.situation || situation,
          situation_by: plan?.situation_by || situation_by,
          constraintsRelaxed: relaxedFlag ?? isRelaxed,
          hasNote,
          nowDone: nextNowDone,
        })
      );
    } catch {
      // Ignore storage errors
    }
  };

  const handleStart = async (activityId: string, stage: 'now' | 'next') => {
    try {
      setStartingActivityId(activityId);
      setError(null);
      persistActivePlan(nowDone);

      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkinId,
          activityId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to start session');
      }

      const data = await res.json();
      const sessionId = data.session?.id;

      if (sessionId) {
        router.push(`/activity/${sessionId}?stage=${stage}`);
      } else {
        throw new Error('Missing session identifier');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start activity');
      setStartingActivityId(null);
    }
  };

  const handleSendMessage = async (msgToSend?: string) => {
    const text = (msgToSend !== undefined ? msgToSend : inputText).trim();
    if (!text || isChatLoading || chatMessages.length >= 6) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);
    setInputText('');
    setChatError(null);
    setIsChatLoading(true);

    try {
      const currentActivityIds = [
        ...(currentNow ? [currentNow.activity.id] : []),
        ...currentNext.map((n) => n.activity.id),
      ];
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkinId,
          message: text,
          history: chatMessages.slice(-6),
          current_activity_ids: currentActivityIds,
        }),
      });

      if (!res.ok) {
        throw new Error('Could not adjust plan right now.');
      }

      const data: ChatResponse = await res.json();

      if (data.safety) {
        if (onSafetyTrigger) {
          onSafetyTrigger();
        }
        return;
      }

      let updatedNowState = currentNow;
      let updatedNextState = currentNext;

      // Update ONLY Right now and Next in place; never touch Situation or Later
      if (data.now) {
        updatedNowState = data.now;
        setCurrentNow(data.now);
      } else if (data.recommendations && data.recommendations.length > 0) {
        updatedNowState = {
          activity: data.recommendations[0].activity,
          reason: data.recommendations[0].reason,
          instruction: currentNow?.instruction || data.recommendations[0].activity.description,
          by: data.recommendations[0].personalised_by,
        };
        setCurrentNow(updatedNowState);
      }

      if (data.next && data.next.length > 0) {
        updatedNextState = data.next;
        setCurrentNext(data.next);
      } else if (data.recommendations && data.recommendations.length > 1) {
        updatedNextState = data.recommendations.slice(1, 3).map((r) => ({
          activity: r.activity,
          reason: r.reason,
          by: r.personalised_by,
        }));
        setCurrentNext(updatedNextState);
      }

      const nextRelaxed = Boolean(data.constraints_relaxed || data.relaxation_note);
      setIsRelaxed(nextRelaxed);
      persistActivePlan(nowDone, updatedNowState, updatedNextState, nextRelaxed);

      setHighlightCards(true);
      setTimeout(() => setHighlightCards(false), 1200);

      if (data.reply) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: data.reply,
          personalised_by: data.personalised_by,
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsChatLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'breathing':
        return { label: 'Breathing', color: 'bg-sky-50 text-sky-700 border-sky-200', icon: '🌬️' };
      case 'grounding':
        return { label: 'Grounding', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '🌿' };
      case 'journaling':
        return { label: 'Journaling', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: '📝' };
      case 'break':
        return { label: 'Quick Break', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '☕' };
      default:
        return { label: type, color: 'bg-slate-50 text-slate-700 border-slate-200', icon: '✨' };
    }
  };

  const effectiveAck = plan?.acknowledgement || acknowledgement;
  const ackSource = plan?.acknowledgement_by || currentNow?.by || 'rules';
  const effectiveNeed = need || plan?.understanding?.need || understanding?.need;
  const effectiveWhyOrder = plan?.why_this_order;
  const whyOrderSource = plan?.why_this_order_by || ackSource;
  const effectiveSituation = plan?.situation || situation;
  const sitSource = plan?.situation_by || situation_by || 'rules';
  const effectiveActionSteps = plan?.later?.action_steps || effectiveSituation?.action_steps || [];
  const effectiveNextStep = plan?.later?.next_step || next_step;
  const laterSource = plan?.later?.by || sitSource;
  const isNoteInterpreted = Boolean(
    hasNote &&
      (plan?.note_interpreted ??
        (ackSource === 'ai' || sitSource === 'ai'))
  );

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Your personal wellbeing plan
        </h2>
        {hasNote && isNoteInterpreted && (
          <p className="text-slate-600 text-xs sm:text-sm font-medium">
            Based on what you wrote and how you feel
          </p>
        )}
        {hasNote && !isNoteInterpreted && (
          <p className="text-slate-600 text-xs sm:text-sm font-medium">
            Turn on AI mode to get suggestions based on your note.
          </p>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm text-center">
          {error}
        </div>
      )}

      {/* 1. Acknowledgement, "Looks like you need: X", and why_this_order */}
      {effectiveAck && (
        <section
          aria-label="Reflection"
          className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-teal-900 text-sm font-semibold">
              <span aria-hidden="true">🌱</span>
              <span>A gentle reflection for you</span>
            </div>
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                ackSource === 'ai'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {ackSource === 'ai' ? 'AI' : 'Rules'}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-slate-700">{effectiveAck}</p>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {effectiveNeed && (
              <span
                data-testid="need-tag"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
              >
                <span aria-hidden="true">🎯</span>
                <span>
                  Looks like you need: <strong className="capitalize">{effectiveNeed}</strong>
                </span>
              </span>
            )}
          </div>

          {effectiveWhyOrder && (
            <div className="pt-2 border-t border-slate-200/70 flex items-start justify-between gap-2 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong className="text-slate-800">Why this order:</strong> {effectiveWhyOrder}
              </p>
              <span
                className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  whyOrderSource === 'ai'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {whyOrderSource === 'ai' ? 'AI' : 'Rules'}
              </span>
            </div>
          )}
        </section>
      )}

      {/* 2. "Your situation" card (summary, what's in your control) */}
      {effectiveSituation && (
        <section
          aria-label="Your situation"
          className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base sm:text-lg">
              <span aria-hidden="true">🧭</span>
              <span>Your situation</span>
            </div>
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                sitSource === 'ai'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {sitSource === 'ai' ? 'AI-written' : 'Template'}
            </span>
          </div>

          <p className="text-sm text-slate-800 leading-relaxed font-medium">
            {effectiveSituation.summary}
          </p>

          {effectiveSituation.what_is_in_your_control && (
            <div className="bg-teal-50/70 border border-teal-200/70 rounded-2xl p-3.5 text-xs sm:text-sm text-teal-900 flex items-start gap-2.5">
              <span className="text-teal-700 text-base leading-none mt-0.5" aria-hidden="true">
                🎯
              </span>
              <div>
                <strong className="font-semibold text-teal-950 block mb-0.5">
                  What&apos;s in your control:
                </strong>
                <span className="text-teal-900/90 leading-relaxed">
                  {effectiveSituation.what_is_in_your_control}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {isRelaxed && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 text-center"
        >
          We loosened a filter slightly so your Right now and Next options stay gentle and balanced.
        </div>
      )}

      {/* 3. "Right now (about 1-2 minutes)" prominent card + Start now button */}
      {currentNow && (
        <section aria-label="Right now" className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span aria-hidden="true">⚡</span>
              <span>Right now (about 1–2 minutes)</span>
            </h3>
            <div className="flex items-center gap-2">
              {nowDone && (
                <span
                  data-testid="now-done-badge"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"
                >
                  ✓ Done
                </span>
              )}
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  currentNow.by === 'ai'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {currentNow.by === 'ai' ? 'AI' : 'Rules'}
              </span>
            </div>
          </div>

          {(() => {
            const typeBadge = getTypeBadge(currentNow.activity.type);
            const isStarting = startingActivityId === currentNow.activity.id;

            return (
              <div
                data-testid="now-card"
                className={`rounded-3xl p-5 sm:p-6 shadow-sm border-2 transition-all duration-200 motion-reduce:transition-none space-y-4 ${
                  nowDone
                    ? 'bg-emerald-50/30 border-emerald-200/80'
                    : highlightCards
                    ? 'bg-teal-50/20 border-teal-500 ring-2 ring-teal-400/50'
                    : 'bg-white border-teal-500/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${typeBadge.color}`}
                    >
                      <span>{typeBadge.icon}</span>
                      <span>{typeBadge.label}</span>
                    </span>
                    <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200/70 px-2.5 py-0.5 rounded-full">
                      {currentNow.activity.duration_minutes} min • Quick relief
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1.5">
                    {currentNow.activity.title}
                  </h4>
                  <div className="bg-teal-50/70 border border-teal-200/60 rounded-2xl p-3.5 text-sm text-teal-950 font-medium leading-relaxed mb-3">
                    {currentNow.instruction}
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-xs sm:text-sm text-slate-700 flex items-start gap-2">
                    <span className="text-teal-600 mt-0.5" aria-hidden="true">
                      💡
                    </span>
                    <span>
                      <strong>Why this:</strong> {currentNow.reason}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(startingActivityId)}
                  onClick={() => handleStart(currentNow.activity.id, 'now')}
                  className={`w-full py-3.5 px-6 rounded-2xl font-bold text-base transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500 disabled:opacity-50 ${
                    nowDone
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                  }`}
                >
                  {isStarting
                    ? 'Starting...'
                    : nowDone
                    ? 'Completed ✓ — Practice again →'
                    : 'Start now →'}
                </button>
              </div>
            );
          })()}
        </section>
      )}

      {/* 4. "Next, when you're ready": 2 activity cards */}
      {currentNext.length > 0 && (
        <section
          aria-label="Next, when you're ready"
          data-testid="next-section"
          data-highlighted={nowDone ? 'true' : 'false'}
          className={`space-y-3 rounded-3xl p-4 sm:p-5 transition-all duration-300 motion-reduce:transition-none ${
            nowDone
              ? 'bg-teal-50/40 border-2 border-teal-400 ring-2 ring-teal-400/40'
              : 'bg-transparent p-0'
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span aria-hidden="true">🪜</span>
              <span>Next, when you&apos;re ready</span>
            </h3>
            {nowDone && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-600 text-white">
                Up next
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {currentNext.map((item) => {
              const { activity, reason, by } = item;
              const typeBadge = getTypeBadge(activity.type);
              const isStarting = startingActivityId === activity.id;

              return (
                <div
                  key={activity.id}
                  data-testid="next-card"
                  className={`bg-white border rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 motion-reduce:transition-none ${
                    highlightCards
                      ? 'border-teal-400 ring-2 ring-teal-400/50 bg-teal-50/10'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${typeBadge.color}`}
                        >
                          <span>{typeBadge.icon}</span>
                          <span>{typeBadge.label}</span>
                        </span>
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {activity.duration_minutes} min
                        </span>
                      </div>

                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          by === 'ai'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {by === 'ai' ? 'AI' : 'Rules'}
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-slate-900 mb-1.5">{activity.title}</h4>
                    <p className="text-slate-600 text-sm leading-relaxed mb-3">
                      {activity.description}
                    </p>

                    <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-3 text-xs sm:text-sm text-slate-700 mb-4 flex items-start gap-2">
                      <span className="text-teal-600 mt-0.5" aria-hidden="true">
                        💡
                      </span>
                      <span>
                        <strong>Why this:</strong> {reason}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(startingActivityId)}
                    onClick={() => handleStart(activity.id, 'next')}
                    className="w-full px-5 py-2.5 rounded-full bg-slate-900 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500 disabled:opacity-50"
                  >
                    {isStarting ? 'Starting...' : 'Start Activity →'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. "Later today": 3 action steps + Disclaimer + "One small step for today" */}
      {(effectiveActionSteps.length > 0 || effectiveNextStep) && (
        <section aria-label="Later today" className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span aria-hidden="true">🗓️</span>
                <span>Later today</span>
              </h3>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  laterSource === 'ai'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {laterSource === 'ai' ? 'AI-written' : 'Template'}
              </span>
            </div>

            {effectiveActionSteps.length > 0 && (
              <div className="grid sm:grid-cols-3 gap-3">
                {effectiveActionSteps.map((step, idx) => {
                  const timeChip =
                    step.time === 'now'
                      ? { label: 'Now', color: 'bg-amber-50 text-amber-700 border-amber-200/70' }
                      : step.time === 'today'
                      ? { label: 'Today', color: 'bg-teal-50 text-teal-700 border-teal-200/70' }
                      : {
                          label: 'This week',
                          color: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
                        };

                  return (
                    <div
                      key={idx}
                      data-testid="later-step-card"
                      className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-3.5 flex flex-col justify-between space-y-2"
                    >
                      <div className="space-y-1">
                        <span
                          className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${timeChip.color}`}
                        >
                          {timeChip.label}
                        </span>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                          {step.step}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{step.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[11px] text-slate-500 text-center pt-1 border-t border-slate-100">
              These are everyday coping ideas, not medical, legal or professional advice.
            </p>
          </div>

          {effectiveNextStep && (
            <section
              aria-label="One small step for today"
              className="bg-teal-50/60 border border-teal-200/70 rounded-2xl p-5 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-teal-900 text-sm font-semibold">
                  <span aria-hidden="true">✨</span>
                  <span>One small step for today</span>
                </div>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    laterSource === 'ai'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-teal-100 text-teal-800'
                  }`}
                >
                  {laterSource === 'ai' ? 'AI' : 'Rules'}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{effectiveNextStep}</p>
            </section>
          )}
        </section>
      )}

      {/* 6. Follow-up Chat Panel: Want to adjust these? */}
      <section
        aria-label="Adjust recommendations chat"
        className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>💬</span>
              <span>Want to adjust these?</span>
            </h3>
            <p className="text-xs text-slate-500">
              Refine Right now and Next activities with quick requests or short notes.
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              chatMessages.length >= 6
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {chatMessages.length}/6 messages
          </span>
        </div>

        {/* Quick-reply chips */}
        <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Quick adjustment chips">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={isChatLoading || chatMessages.length >= 6}
              onClick={() => handleSendMessage(chip)}
              className="text-xs font-medium px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 border border-slate-200/80 text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-40 disabled:pointer-events-none"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Conversation Message List */}
        {chatMessages.length > 0 && (
          <div
            aria-live="polite"
            className="space-y-3 pt-2 border-t border-slate-100 max-h-72 overflow-y-auto"
          >
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-xs'
                      : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
                        Mindora Coach
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          msg.personalised_by === 'ai'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {msg.personalised_by === 'ai' ? 'AI' : 'Rules'}
                      </span>
                    </div>
                  )}
                  <p>{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {isChatLoading && (
          <div aria-live="polite" className="flex items-center gap-2 text-xs text-slate-500 italic py-1">
            <span className="animate-spin motion-reduce:animate-none text-teal-600">🌀</span>
            <span>Adjusting your suggestions...</span>
          </div>
        )}

        {chatError && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {chatError}
          </div>
        )}

        {chatMessages.length >= 6 ? (
          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center">
            You have reached the 6-message adjustment limit. Please choose an activity above to begin your practice.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            autoComplete="off"
            className="space-y-2 pt-1"
          >
            <div className="relative">
              <label htmlFor="chat-message-input" className="sr-only">
                Adjust your suggestions
              </label>
              <input
                id="chat-message-input"
                name="chat-message"
                type="text"
                autoComplete="off"
                data-lpignore="true"
                maxLength={300}
                disabled={isChatLoading || chatMessages.length >= 6}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a request (e.g., 'no breathing', 'short', 'why these?')..."
                className="w-full pl-3.5 pr-20 py-2.5 rounded-2xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:border-teal-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 pr-1">{inputText.length}/300</span>
                <button
                  type="submit"
                  disabled={!inputText.trim() || isChatLoading || chatMessages.length >= 6}
                  className="px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  aria-label="Send message"
                >
                  Send
                </button>
              </div>
            </div>
          </form>
        )}

        <p className="text-[11px] text-slate-500 text-center pt-1 border-t border-slate-100">
          This chat only adjusts your suggestions. It isn&apos;t therapy or an emergency service.
        </p>
      </section>

      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-500 hover:text-slate-800 underline transition-colors"
        >
          ← Back to check-in
        </button>

        <Link
          href="/dashboard"
          className="text-sm font-semibold text-teal-700 hover:text-teal-900 underline transition-colors"
        >
          View Dashboard →
        </Link>
      </div>
    </div>
  );
}
