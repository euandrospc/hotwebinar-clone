import { Redis, type RedisOptions } from "ioredis";

let cached: Redis | undefined;

export function getRedisConnection(): Redis {
  if (cached) return cached;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Missing env: REDIS_URL");
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
  cached = new Redis(url, options);
  return cached;
}
