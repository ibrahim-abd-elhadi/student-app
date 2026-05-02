import { Classroom } from './classroom.entity';
import { User } from './user.entity';
import { Device } from './device.entity';
import { Exam } from './exam.entity';
import { Question } from './question.entity';
import { Session } from './session.entity';
import { Attempt } from './attempt.entity';
import { AuditLogEntry } from './audit-log.entity';
import { RefreshToken } from './refresh-token.entity';

export const entities = [
  Classroom,
  User,
  Device,
  Exam,
  Question,
  Session,
  Attempt,
  AuditLogEntry,
  RefreshToken,
];

export {
  Classroom,
  User,
  Device,
  Exam,
  Question,
  Session,
  Attempt,
  AuditLogEntry,
  RefreshToken,
};
