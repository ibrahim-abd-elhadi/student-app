import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntry } from '../entities';



@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntry)
    private readonly repo: Repository<AuditLogEntry>,
  ) {}

  async record(entry: {
    classroom_id?: string | null;
    actor_id?: string | null;
    action: string;
    target_type?: string;
    target_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.repo.insert({
        classroom_id: entry.classroom_id ?? null,
        actor_id: entry.actor_id ?? null,
        action: entry.action,
        target_type: entry.target_type ?? null,
        target_id: entry.target_id ?? null,
        metadata: (entry.metadata as any) ?? null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit log for action: ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
      // Don't throw - audit logging shouldn't break the application
    }
  }

  async findByActor(
    actorId: string,
    limit: number = 100,
  ): Promise<AuditLogEntry[]> {
    return this.repo.find({
      where: { actor_id: actorId },
      take: limit,
      order: { created_at: 'DESC' },
    });
  }
}
