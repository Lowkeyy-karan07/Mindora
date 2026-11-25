'use client';

import React from 'react';
import { Mood, MOODS } from '@/types';

interface MoodSelectorProps {
  selectedMood: Mood | null;
  onSelectMood: (mood: Mood) => void;
}

interface MoodConfig {
  mood: Mood;
  label: string;
  emoji: string;
  description: string;
  activeColor: string;
  borderColor: string;
  bgGradient: string;
  badgeBg: string;
}

const MOOD_CONFIGS: Record<Mood, MoodConfig> = {
  Anxious: {
    mood: 'Anxious',
    label: 'Anxious',
    emoji: '🌪️',
    description: 'Racing thoughts, fluttery nerves, tension',
    activeColor: 'border-amber-400 bg-amber-50/90 text-amber-950 ring-2 ring-amber-400/60 shadow-sm',
    borderColor: 'border-amber-200/80 hover:border-amber-300 hover:bg-amber-50/50',
    bgGradient: 'from-amber-50 to-orange-50/50',
    badgeBg: 'bg-amber-100 text-amber-800',
  },
  Stressed: {
    mood: 'Stressed',
    label: 'Stressed',
    emoji: '⚡',
    description: 'Pressure, tight shoulders, busy mind',
    activeColor: 'border-indigo-400 bg-indigo-50/90 text-indigo-950 ring-2 ring-indigo-400/60 shadow-sm',
    borderColor: 'border-indigo-200/80 hover:border-indigo-300 hover:bg-indigo-50/50',
    bgGradient: 'from-indigo-50 to-violet-50/50',
    badgeBg: 'bg-indigo-100 text-indigo-800',
  },
  Sad: {
    mood: 'Sad',
    label: 'Sad',
    emoji: '🌧️',
    description: 'Heavy heart, low energy, quiet gloom',
    activeColor: 'border-sky-400 bg-sky-50/90 text-sky-950 ring-2 ring-sky-400/60 shadow-sm',
    borderColor: 'border-sky-200/80 hover:border-sky-300 hover:bg-sky-50/50',
    bgGradient: 'from-sky-50 to-blue-50/50',
    badgeBg: 'bg-sky-100 text-sky-800',
  },
  Overwhelmed: {
    mood: 'Overwhelmed',
    label: 'Overwhelmed',
    emoji: '🌊',
    description: 'Too much to carry, stuck or scattered',
    activeColor: 'border-teal-400 bg-teal-50/90 text-teal-950 ring-2 ring-teal-400/60 shadow-sm',
    borderColor: 'border-teal-200/80 hover:border-teal-300 hover:bg-teal-50/50',
    bgGradient: 'from-teal-50 to-cyan-50/50',
    badgeBg: 'bg-teal-100 text-teal-800',
  },
  Okay: {
    mood: 'Okay',
    label: 'Okay',
    emoji: '🌱',
    description: 'Steady, neutral, looking to stay centered',
    activeColor: 'border-emerald-400 bg-emerald-50/90 text-emerald-950 ring-2 ring-emerald-400/60 shadow-sm',
    borderColor: 'border-emerald-200/80 hover:border-emerald-300 hover:bg-emerald-50/50',
    bgGradient: 'from-emerald-50 to-teal-50/50',
    badgeBg: 'bg-emerald-100 text-emerald-800',
  },
};

export function MoodSelector({ selectedMood, onSelectMood }: MoodSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3" role="radiogroup" aria-label="Select your current mood">
      {MOODS.map((mood) => {
        const config = MOOD_CONFIGS[mood];
        const isSelected = selectedMood === mood;

        return (
          <button
            key={mood}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelectMood(mood)}
            className={`
              relative flex flex-col items-center justify-between p-3.5 sm:p-4 rounded-2xl border text-center transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500
              motion-reduce:transition-none
              ${
                isSelected
                  ? config.activeColor
                  : `bg-white text-slate-700 ${config.borderColor}`
              }
            `}
          >
            <div className="text-2xl sm:text-3xl mb-1.5 motion-safe:hover:scale-110 transition-transform">
              {config.emoji}
            </div>
            <div className="font-semibold text-sm sm:text-base tracking-tight mb-1">
              {config.label}
            </div>
            <div className="text-[11px] leading-snug text-slate-500 hidden sm:block">
              {config.description}
            </div>

            {isSelected && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] shadow">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
