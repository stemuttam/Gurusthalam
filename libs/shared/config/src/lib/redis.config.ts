export interface RedisConfig {
  readonly url: string;
}

export function getRedisConfig(): RedisConfig {
  const url =
    process.env.REDIS_URL ??
    'redis://localhost:6379';

  return {
    url,
  };
}