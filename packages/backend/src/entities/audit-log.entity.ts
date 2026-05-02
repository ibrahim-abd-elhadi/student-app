import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_log')
export class AuditLogEntry {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  classroom_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  actor_id!: string | null;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text', nullable: true })
  target_type!: string | null;

  @Column({ type: 'uuid', nullable: true })
  target_id!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
