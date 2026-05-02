import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('devices')
@Index('uniq_devices_user_fingerprint', ['user_id', 'fingerprint'], { unique: true })
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text' })
  hostname!: string;

  @Column({ type: 'text' })
  os!: string;

  @Column({ type: 'text' })
  fingerprint!: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_seen_at!: Date | null;
}
