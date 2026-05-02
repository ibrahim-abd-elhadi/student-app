import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Attempt, Exam, Question, Session, User } from '../entities';
import { CreateSessionDto } from './dto';
import { ExamsService } from '../exams/exams.service';
import { AuditService } from '../common/audit.service';
import type {
  AttemptDto,
  SessionDto,
  StudentExamPayload,
} from '@classroom/shared';

export interface StartedSession {
  session: Session;
  exam: StudentExamPayload;
  attempts: Attempt[];
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(Attempt) private readonly attempts: Repository<Attempt>,
    @InjectRepository(Exam) private readonly exams: Repository<Exam>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    private readonly examsService: ExamsService,
    private readonly audit: AuditService,
    private readonly ds: DataSource,
  ) {}

  async create(
    tutorId: string,
    classroomId: string,
    dto: CreateSessionDto,
  ): Promise<{ session: SessionDto; attempts: AttemptDto[] }> {
    return this.ds.transaction(async (m) => {
      const exam = await m.findOne(Exam, { where: { id: dto.exam_id } });
      if (!exam || exam.classroom_id !== classroomId) {
        throw new NotFoundException('exam_not_found');
      }
      if (!exam.is_published) {
        throw new ConflictException('exam_not_published');
      }
      const qcount = await m.count(Question, { where: { exam_id: exam.id } });
      if (qcount === 0) {
        throw new ConflictException('exam_has_no_questions');
      }

      // Validate every student is in this classroom and active.
      const students = await m.find(User, {
        where: {
          id: In(dto.student_ids),
          role: 'STUDENT',
          classroom_id: classroomId,
          is_active: true,
        },
      });
      if (students.length !== dto.student_ids.length) {
        throw new ConflictException('invalid_student_ids');
      }

      const session = m.create(Session, {
        classroom_id: classroomId,
        exam_id: exam.id,
        tutor_id: tutorId,
        duration_minutes: dto.duration_minutes,
        state: 'PENDING',
      });
      await m.save(session);

      const attempts = students.map((s) =>
        m.create(Attempt, {
          session_id: session.id,
          student_id: s.id,
          state: 'ASSIGNED',
        }),
      );
      await m.save(attempts);

      await this.audit.record({
        classroom_id: classroomId,
        actor_id: tutorId,
        action: 'SESSION_CREATE',
        target_type: 'session',
        target_id: session.id,
        metadata: { exam_id: exam.id, student_count: students.length },
      });

      return {
        session: this.toSessionDto(session),
        attempts: attempts.map(this.toAttemptDto),
      };
    });
  }

  async start(sessionId: string, tutorId: string): Promise<StartedSession> {
    return this.ds.transaction(async (m) => {
      const session = await m
        .createQueryBuilder(Session, 's')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id: sessionId })
        .getOne();
      if (!session) throw new NotFoundException('session_not_found');
      if (session.tutor_id !== tutorId) throw new ConflictException('not_owner');
      if (session.state !== 'PENDING') {
        throw new ConflictException(`bad_state:${session.state}`);
      }
      const now = new Date();
      session.state = 'ACTIVE';
      session.started_at = now;
      session.deadline_at = new Date(
        now.getTime() + session.duration_minutes * 60_000,
      );
      await m.save(session);

      const attempts = await m.find(Attempt, { where: { session_id: session.id } });
      const exam = await this.examsService.loadStudentPayload(session.exam_id);

      await this.audit.record({
        classroom_id: session.classroom_id,
        actor_id: tutorId,
        action: 'SESSION_START',
        target_type: 'session',
        target_id: session.id,
        metadata: { deadline_at: session.deadline_at.toISOString() },
      });

      return { session, exam, attempts };
    });
  }

  async stop(
    sessionId: string,
    tutorId: string | null,
    reason: 'TUTOR_STOP' | 'DEADLINE' | 'ALL_SUBMITTED',
  ): Promise<Session> {
    return this.ds.transaction(async (m) => {
      const session = await m
        .createQueryBuilder(Session, 's')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id: sessionId })
        .getOne();
      if (!session) throw new NotFoundException('session_not_found');
      if (
        reason === 'TUTOR_STOP' &&
        tutorId &&
        session.tutor_id !== tutorId
      ) {
        throw new ConflictException('not_owner');
      }
      if (session.state !== 'ACTIVE') return session; // idempotent

      session.state = 'CLOSED';
      session.closed_at = new Date();
      await m.save(session);

      // Auto-grade SUBMITTED attempts that don't yet have a score
      // (e.g. submitted via partial flow), and EXPIRE the rest.
      const attemptRows = await m.find(Attempt, {
        where: { session_id: session.id },
      });
      const questions = await m.find(Question, {
        where: { exam_id: session.exam_id },
      });
      for (const a of attemptRows) {
        if (a.state === 'SUBMITTED' && a.score == null) {
          a.score = this.scoreAnswers(a.answers, questions);
          await m.save(a);
        } else if (a.state === 'ASSIGNED' || a.state === 'IN_PROGRESS') {
          a.state = 'EXPIRED';
          a.score = this.scoreAnswers(a.answers, questions);
          await m.save(a);
        }
      }

      await this.audit.record({
        classroom_id: session.classroom_id,
        actor_id: tutorId,
        action: 'SESSION_STOP',
        target_type: 'session',
        target_id: session.id,
        metadata: { reason },
      });

      return session;
    });
  }

  async getDetail(
    classroomId: string,
    sessionId: string,
  ): Promise<{
    session: SessionDto;
    attempts: AttemptDto[];
  }> {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.classroom_id !== classroomId) {
      throw new NotFoundException('session_not_found');
    }
    const attempts = await this.attempts.find({
      where: { session_id: sessionId },
      order: { started_at: 'ASC' },
    });
    return {
      session: this.toSessionDto(session),
      attempts: attempts.map(this.toAttemptDto),
    };
  }

  /** Used by scheduler. Returns ACTIVE sessions whose deadline has passed. */
  async findExpiredActive(): Promise<Session[]> {
    return this.sessions
      .createQueryBuilder('s')
      .where('s.state = :st', { st: 'ACTIVE' })
      .andWhere('s.deadline_at IS NOT NULL')
      .andWhere('s.deadline_at < NOW()')
      .getMany();
  }

  scoreAnswers(answers: Record<string, string>, questions: Question[]): number {
    let score = 0;
    for (const q of questions) {
      if (answers[q.id] && answers[q.id] === q.correct_id) {
        score += q.points;
      }
    }
    return score;
  }

  private toSessionDto = (s: Session): SessionDto => ({
    id: s.id,
    classroom_id: s.classroom_id,
    exam_id: s.exam_id,
    tutor_id: s.tutor_id,
    duration_minutes: s.duration_minutes,
    state: s.state,
    started_at: s.started_at?.toISOString() ?? null,
    deadline_at: s.deadline_at?.toISOString() ?? null,
    closed_at: s.closed_at?.toISOString() ?? null,
    created_at: s.created_at.toISOString(),
  });

  private toAttemptDto = (a: Attempt): AttemptDto => ({
    id: a.id,
    session_id: a.session_id,
    student_id: a.student_id,
    state: a.state,
    answered_count: a.answered_count,
    score: a.score,
    started_at: a.started_at?.toISOString() ?? null,
    submitted_at: a.submitted_at?.toISOString() ?? null,
  });
}
