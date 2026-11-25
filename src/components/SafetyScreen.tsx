'use client';

import React from 'react';

interface SafetyScreenProps {
  onBack: () => void;
}

export function SafetyScreen({ onBack }: SafetyScreenProps) {
  return (
    <div className="max-w-xl mx-auto my-6 p-6 sm:p-8 bg-white border border-rose-200/80 rounded-3xl shadow-sm text-slate-800">
      <div className="flex items-center gap-3 text-rose-600 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Your wellbeing and safety come first
        </h2>
      </div>

      <div className="space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
        <p>
          It sounds like you might be going through an especially difficult or overwhelming moment.
          Mindora is designed only for small everyday stress breaks and cannot provide crisis or
          medical support.
        </p>

        <p className="font-medium text-slate-800">
          Please consider reaching out right now to someone who can help support you:
        </p>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl">🤝</span>
            <div>
              <div className="font-semibold text-slate-900">A Trusted Person</div>
              <div className="text-slate-600">
                Call, text, or sit with a close friend, family member, mentor, or colleague who can
                be with you right now.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl">📞</span>
            <div>
              <div className="font-semibold text-slate-900">Local Crisis Helpline</div>
              <div className="text-slate-600">
                Trained listeners are available 24/7, free and confidential:
                <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs sm:text-sm text-slate-700">
                  <li><strong>US &amp; Canada:</strong> Call or text <strong>988</strong></li>
                  <li><strong>United Kingdom:</strong> Call <strong>111</strong> (NHS) or <strong>116 123</strong> (Samaritans)</li>
                  <li><strong>Australia:</strong> Call <strong>13 11 14</strong> (Lifeline)</li>
                  <li><strong>International:</strong> Find your local helpline at <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" className="text-teal-700 underline font-medium">findahelpline.com</a> or <a href="https://www.befrienders.org" target="_blank" rel="noopener noreferrer" className="text-teal-700 underline font-medium">befrienders.org</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl">🚑</span>
            <div>
              <div className="font-semibold text-slate-900">Local Emergency Services</div>
              <div className="text-slate-600">
                If you feel in immediate danger of hurting yourself or someone else, please dial your
                local emergency number (e.g. 911, 999, 112) or go to the nearest emergency room.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          Return to Check-in
        </button>
      </div>
    </div>
  );
}
