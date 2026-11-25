'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardData, Mood, Rating } from '@/types';

const MOOD_COLORS: Record<Mood, { badge: string; text: string; bg: string }> = {
  Anxious: { badge: 'bg-amber-100 text-amber-800 border-amber-200', text: 'text-amber-800', bg: 'bg-amber-50' },
  Stressed: { badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', text: 'text-indigo-800', bg: 'bg-indigo-50' },
  Sad: { badge: 'bg-sky-100 text-sky-800 border-sky-200', text: 'text-sky-800', bg: 'bg-sky-50' },
  Overwhelmed: { badge: 'bg-teal-100 text-teal-800 border-teal-200', text: 'text-teal-800', bg: 'bg-teal-50' },
  Okay: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'text-emerald-800', bg: 'bg-emerald-50' },
};

const RATING_BADGES: Record<Rating, { label: string; color: string; icon: string }> = {
  yes: { label: 'Helpful', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '🌿' },
  a_little: { label: 'A little', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🌤️' },
  no: { label: 'Not helpful', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: '☁️' },
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function fetchInitialDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          throw new Error('Failed to load dashboard data');
        }
        const json = await res.json();
        if (!isCancelled) {
          setData(json);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your history');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchInitialDashboard();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleDeleteAllData = async () => {
    try {
      setDeleting(true);
      const res = await fetch('/api/data', { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete data');
      }
      setShowDeleteConfirm(false);
      setDeleteSuccessMessage('All your stored check-ins, sessions, and journal entries have been erased.');
      const refreshRes = await fetch('/api/dashboard');
      if (refreshRes.ok) {
        const json = await refreshRes.json();
        setData(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading your wellbeing history...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-3xl text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Dashboard Unavailable</h2>
        <p className="text-sm text-slate-600">{error || 'Could not load data'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { stats, recentCheckins, recentSessions } = data;

  return (
    <div className="space-y-8 pb-10">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Wellbeing Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            A quiet overview of your recent practices and check-in history.
          </p>
        </div>

        <Link
          href="/"
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-xs"
        >
          + New Check-in
        </Link>
      </div>

      {process.env.NODE_ENV === 'production' && (
        <div
          role="note"
          className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs sm:text-sm text-amber-900"
        >
          Demo deployment: data is shared and may be reset. Don&apos;t enter personal information.
        </div>
      )}

      {deleteSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <span>✓ {deleteSuccessMessage}</span>
          <button
            type="button"
            onClick={() => setDeleteSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Practices
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-800">
            {stats.completedSessions}
          </div>
          <span className="text-[11px] text-slate-500">completed sessions</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Time
          </span>
          <div className="text-2xl sm:text-3xl font-black text-teal-700">
            {stats.totalMinutesPracticed}m
          </div>
          <span className="text-[11px] text-slate-500">mindful minutes</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Completion Rate
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-800">
            {stats.completionRate}%
          </div>
          <span className="text-[11px] text-slate-500">sessions finished</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Check-ins
          </span>
          <div className="text-2xl sm:text-3xl font-black text-indigo-700">
            {recentCheckins.length}
          </div>
          <span className="text-[11px] text-slate-500">total moods logged</span>
        </div>
      </div>

      {/* Mood Distribution Breakdown */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Mood History Distribution
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {(Object.keys(stats.moodCounts) as Mood[]).map((mood) => {
            const count = stats.moodCounts[mood] || 0;
            const colors = MOOD_COLORS[mood];
            return (
              <div
                key={mood}
                className={`p-3 rounded-2xl border ${colors.badge} flex flex-col items-center text-center`}
              >
                <span className="text-xs font-semibold">{mood}</span>
                <span className="text-xl font-bold mt-0.5">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Recent Check-ins & Recent Completed Activities */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Recent Check-ins */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center justify-between">
            <span>Recent Check-ins</span>
            <span className="text-xs font-normal text-slate-400">
              {recentCheckins.length} recorded
            </span>
          </h2>

          {recentCheckins.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-200 text-center text-slate-400 text-xs">
              No check-ins yet. Take your first one today!
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentCheckins.slice(0, 8).map((chk) => {
                const colors = MOOD_COLORS[chk.mood];
                return (
                  <div
                    key={chk.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${colors.badge}`}
                      >
                        {chk.mood}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(chk.created_at)}
                      </span>
                    </div>
                    {chk.note && (
                      <p className="text-xs text-slate-600 line-clamp-2 italic">
                        &ldquo;{chk.note}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activities & Feedback */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center justify-between">
            <span>Practices &amp; Feedback</span>
            <span className="text-xs font-normal text-slate-400">
              {recentSessions.length} sessions
            </span>
          </h2>

          {recentSessions.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-200 text-center text-slate-400 text-xs">
              No completed sessions yet. Start a recommended practice!
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentSessions.slice(0, 8).map((sess) => {
                const feedbackBadge = sess.feedback
                  ? RATING_BADGES[sess.feedback.rating]
                  : null;

                return (
                  <div
                    key={sess.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm text-slate-900">
                        {sess.activity?.title || sess.activity_id}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(sess.completed_at || sess.started_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 capitalize">
                        {sess.activity?.type || 'Practice'} ({sess.activity?.duration_minutes || 2}m)
                      </span>

                      {feedbackBadge ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border text-[11px] ${feedbackBadge.color}`}
                        >
                          <span>{feedbackBadge.icon}</span>
                          <span>{feedbackBadge.label}</span>
                        </span>
                      ) : sess.completed ? (
                        <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                          Completed
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Incomplete
                        </span>
                      )}
                    </div>

                    {sess.journalEntry && (
                      <div className="mt-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-0.5">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">
                          Journal Note
                        </span>
                        <p className="text-slate-700 italic">
                          &ldquo;{sess.journalEntry.text}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Privacy & Delete Data Section */}
      <div className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-0.5 text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Privacy &amp; Data Control</p>
          <p>You can erase all your stored check-ins, sessions, and journal entries anytime.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 text-xs font-semibold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          Delete my data
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Erase all your data?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              This will permanently delete all your check-ins, completed activities, feedback, and private journal entries from this device.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteAllData}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 text-white font-medium text-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Erasing...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
