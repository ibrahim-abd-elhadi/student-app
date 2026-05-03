import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),
  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'verbose', 'log', 'warn', 'error']).default('log'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  httpPort: env.HTTP_PORT,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  jwtSecret: env.JWT_SECRET,
  jwtAccessTtl: env.JWT_ACCESS_TTL,
  jwtRefreshTtl: env.JWT_REFRESH_TTL,
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
  logLevel: env.LOG_LEVEL,
  requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
} as const;
