import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazy initialization — avoids crashing at module load if env vars are missing.
// Redis.fromEnv() throws immediately if UPSTASH_REDIS_REST_URL is not set,
// which would crash every API route on cold start. We defer until first use.
let _redis: InstanceType<typeof Redis> | null = null;

function getRedis(): InstanceType<typeof Redis> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL is not set. Add it to your Vercel environment variables.",
    );
  }
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      "UPSTASH_REDIS_REST_TOKEN is not set. Add it to your Vercel environment variables.",
    );
  }
  if (!_redis) {
    _redis = Redis.fromEnv();
  }
  return _redis;
}

// Proxy object — passes calls through to the lazily-initialized Redis client
const redisProxy = new Proxy({} as InstanceType<typeof Redis>, {
  get(_target, prop) {
    const client = getRedis();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export const RATE_LIMITS = {
  AUTH: new Ratelimit({
    redis: redisProxy,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "rl:auth",
  }),

  DEFAULT: new Ratelimit({
    redis: redisProxy,
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    prefix: "rl:default",
  }),

  AI: new Ratelimit({
    redis: redisProxy,
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "rl:ai",
  }),

  READ: new Ratelimit({
    redis: redisProxy,
    limiter: Ratelimit.slidingWindow(120, "60 s"),
    prefix: "rl:read",
  }),
};
