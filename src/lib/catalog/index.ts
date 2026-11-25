import activitiesData from './activities.json';
import { Activity, Mood } from '@/types';

export const activities: Activity[] = (activitiesData as Activity[]).map((act) => ({
  ...act,
  target_moods: Object.keys(act.mood_fit || {}) as Mood[],
}));

export function getAllActivities(): Activity[] {
  return activities;
}

export function getActivityById(id: string): Activity | undefined {
  return activities.find((act) => act.id === id);
}

export function getActivitiesByMood(mood: Mood): Activity[] {
  return activities.filter((act) => (act.mood_fit?.[mood] ?? 0) >= 1);
}
