/** Recorded audience samples in the rolling realtime preview window. */
export interface RealtimeAudienceHistory {
  average: number | null;
  peak: number | null;
  sampleCount: number;
  points: Array<{ at: string; online: number }>;
  windowMinutes: 60;
  from?: string;
  to?: string;
}
