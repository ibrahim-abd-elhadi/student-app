import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from '../config/configuration';

const PRESENCE_TTL_SECONDS = 30;

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('PresenceService');
  private redis!: Redis;

  async onModuleInit(): Promise<void> {
    this.redis = new Redis(config.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
    this.redis.on('error', (e) => this.log.error(`Redis error: ${e.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  private key(userId: string) {
    return `presence:${userId}`;
  }

  async markOnline(userId: string): Promise<void> {
    await this.redis.set(
      this.key(userId),
      new Date().toISOString(),
      'EX',
      PRESENCE_TTL_SECONDS,
    );
  }

  async refresh(userId: string): Promise<void> {
    await this.redis.expire(this.key(userId), PRESENCE_TTL_SECONDS);
  }

  async markOffline(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  async getMany(userIds: string[]): Promise<
    Record<string, { online: boolean; last_seen_at: string | null }>
  > {
    if (userIds.length === 0) return {};
    const keys = userIds.map(this.key);
    const values = await this.redis.mget(...keys);
    const out: Record<string, { online: boolean; last_seen_at: string | null }> = {};
    userIds.forEach((id, i) => {
      out[id] = { online: values[i] != null, last_seen_at: values[i] ?? null };
    });
    return out;
  }
}
