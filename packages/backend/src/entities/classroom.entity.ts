import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { Exam } from './exam.entity';

@Entity('classrooms')
export class Classroom {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @OneToMany(() => User, (u) => u.classroom)
  users!: User[];

  @OneToMany(() => Exam, (e) => e.classroom)
  exams!: Exam[];
}
