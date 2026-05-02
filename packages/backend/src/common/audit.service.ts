import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntry } from '../entities';

@Injectable()
export class AuditService {
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
    await this.repo.insert({
      classroom_id: entry.classroom_id ?? null,
      actor_id: entry.actor_id ?? null,
      action: entry.action,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      metadata: (entry.metadata as any) ?? null,
    });
  }
}