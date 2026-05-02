import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exam } from './exam.entity';
import type { QuestionChoice } from '@classroom/shared';

@Entity('questions')
@Index('uniq_questions_exam_ordinal', ['exam_id', 'ordinal'], { unique: true })
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  exam_id!: string;

  @ManyToOne(() => Exam, (e) => e.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam!: Exam;

  @Column({ type: 'integer' })
  ordinal!: number;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'jsonb' })
  choices!: QuestionChoice[];

  @Column({ type: 'text' })
  correct_id!: string;

  @Column({ type: 'integer', default: 1 })
  points!: number;
}
