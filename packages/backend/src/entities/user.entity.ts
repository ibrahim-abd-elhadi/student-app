import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Classroom } from './classroom.entity';
import type { UserRole } from '@classroom/shared';

@Entity('users')
@Index('uniq_users_classroom_username', ['classroom_id', 'username'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  classroom_id!: string;

  @ManyToOne(() => Classroom, (c) => c.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroom_id' })
  classroom!: Classroom;

  @Column({ type: 'text' })
  username!: string;

  @Column({ type: 'text' })
  display_name!: string;

  @Column({ type: 'text' })
  password_hash!: string;

  @Column({ type: 'enum', enum: ['TUTOR', 'STUDENT', 'ADMIN'], enumName: 'user_role' })
  role!: UserRole;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
