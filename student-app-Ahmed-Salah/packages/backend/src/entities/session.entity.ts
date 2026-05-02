import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Classroom } from './classroom.entity';
import { Exam } from './exam.entity';
import { User } from './user.entity';
import { Attempt } from './attempt.entity';
import type { SessionState } from '@classroom/shared';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  classroom_id!: string;

  @ManyToOne(() => Classroom)
  @JoinColumn({ name: 'classroom_id' })
  classroom!: Classroom;

  @Column({ type: 'uuid' })
  exam_id!: string;

  @ManyToOne(() => Exam)
  @JoinColumn({ name: 'exam_id' })
  exam!: Exam;

  @Column({ type: 'uuid' })
  tutor_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tutor_id' })
  tutor!: User;

  @Column({ type: 'integer' })
  duration_minutes!: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'ACTIVE', 'CLOSED', 'CANCELLED'],
    enumName: 'session_state',
    default: 'PENDING',
  })
  state!: SessionState;

  @Column({ type: 'timestamptz', nullable: true })
  started_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deadline_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @OneToMany(() => Attempt, (a) => a.session)
  attempts!: Attempt[];
}
