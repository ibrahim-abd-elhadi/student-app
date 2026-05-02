import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Session } from './session.entity';
import { User } from './user.entity';
import type { AttemptState } from '@classroom/shared';

@Entity('attempts')
@Index('uniq_attempts_session_student', ['session_id', 'student_id'], { unique: true })
export class Attempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  session_id!: string;

  @ManyToOne(() => Session, (s) => s.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: Session;

  @Column({ type: 'uuid' })
  student_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @Column({
    type: 'enum',
    enum: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'CANCELLED'],
    enumName: 'attempt_state',
    default: 'ASSIGNED',
  })
  state!: AttemptState;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  answers!: Record<string, string>;

  @Column({ type: 'integer', nullable: true })
  score!: number | null;

  @Column({ type: 'integer', default: 0 })
  answered_count!: number;

  @Column({ type: 'timestamptz', nullable: true })
  started_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at!: Date | null;

  @Column({ type: 'bigint', default: 0, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  client_seq!: number;
}
