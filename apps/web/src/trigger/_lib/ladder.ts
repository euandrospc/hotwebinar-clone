export interface Variant {
  height: number;
  width: number;
  bitrate: string;
  audioBitrate: string;
}

export const LADDER: ReadonlyArray<Variant> = [
  { height: 360, width: 640, bitrate: "800k", audioBitrate: "96k" },
  { height: 720, width: 1280, bitrate: "2500k", audioBitrate: "128k" },
  { height: 1080, width: 1920, bitrate: "5000k", audioBitrate: "128k" },
  { height: 1440, width: 2560, bitrate: "8000k", audioBitrate: "192k" }
];

export function selectLadder(sourceHeight: number): Variant[] {
  if (sourceHeight <= 0) return [];
  const fitting = LADDER.filter((v) => v.height <= sourceHeight);
  if (fitting.length === 0) {
    // source is below the smallest preset; encode at source height with 360p bitrate
    const base = LADDER[0];
    return [{ ...base, height: sourceHeight, width: Math.round((sourceHeight * 16) / 9) }];
  }
  return fitting.map((v) => ({ ...v }));
}
