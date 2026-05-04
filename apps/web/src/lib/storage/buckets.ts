function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const ORIGINALS_BUCKET = must("S3_BUCKET_ORIGINALS");
export const HLS_BUCKET = must("S3_BUCKET_HLS");
