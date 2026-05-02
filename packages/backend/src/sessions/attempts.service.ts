import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Attempt, Question, Session } from '../entities';
import { SessionsService } from './sessions.service';
import { AuditService } from '../common/audit.service';

export interface UpsertAnswerInput {
  student_id: string;
  session_id: string;
  question_id: string;
  choice_id: string;
  client_seq: number;
}

export interface UpsertAnswerResult {
  server_seq: number;
  answered_count: number;
}

@Injectable()
export class AttemptsService {
  constructor(
    @InjectRepository(Attempt) private readonly attempts: Repository<Attempt>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    private readonly sessionsService: SessionsService,
    private readonly audit: AuditService,
    private readonly ds: DataSource,
  ) {}

  async upsertAnswer(input: UpsertAnswerInput): Promise<UpsertAnswerResult> {
    return this.ds.transaction(async (m) => {
      const attempt = await m
        .createQueryBuilder(Attempt, 'a')
        .setLock('pessimistic_write')
        .where('a.session_id = :s AND a.student_id = :u', {
          s: input.session_id,
          u: input.student_id,
        })
        .getOne();
      if (!attempt) throw new NotFoundException('attempt_not_found');
      if (attempt.state === 'SUBMITTED' || attempt.state === 'EXPIRED') {
        throw new ConflictException('attempt_finalized');
      }

      // Drop replays / out-of-order frames.
      if (input.client_seq <= attempt.client_seq) {
        return {
          server_seq: attempt.client_seq,
          answered_count: attempt.answered_count,
        };
      }

      const session = await m.findOneByOrFail(Session, { id: input.session_id });
      if (session.state !== 'ACTIVE') {
        throw new ConflictException('session_not_active');
      }
      if (session.deadline_at && session.deadline_at.getTime() < Date.now()) {
        throw new ConflictException('past_deadline');
      }

      // Make sure the question belongs to the exam and choice is valid.
      const question = await m.findOneBy(Question, {
        id: input.question_id,
        exam_id: session.exam_id,
      });
      if (!question) throw new ConflictException('unknown_question');
      const valid = question.choices.some((c) => c.id === input.choice_id);
      if (!valid) throw new ConflictException('invalid_choice');

      const answers = { ...attempt.answers, [input.question_id]: input.choice_id };
      attempt.answers = answers;
      attempt.answered_count = Object.keys(answers).length;
      attempt.client_seq = input.client_seq;
      if (attempt.state === 'ASSIGNED') {
        attempt.state = 'IN_PROGRESS';
        attempt.started_at = attempt.started_at ?? new Date();
      }
      await m.save(attempt);
      return {
        server_seq: input.client_seq,
        answered_count: attempt.answered_count,
      };
    });
  }

  async submit(
    studentId: string,
    sessionId: string,
  ): Promise<{ score: number | null }> {
    return this.ds.transaction(async (m) => {
      const attempt = await m
        .createQueryBuilder(Attempt, 'a')
        .setLock('pessimistic_write')
        .where('a.session_id = :s AND a.student_id = :u', {
          s: sessionId,
          u: studentId,
        })
        .getOne();
      if (!attempt) throw new NotFoundException('attempt_not_found');
      // Idempotency: if already submitted, return prior result.
      if (attempt.state === 'SUBMITTED') {
        return { score: attempt.score };
      }
      const session = await m.findOneByOrFail(Session, { id: sessionId });
      if (session.state !== 'ACTIVE') {
        throw new ConflictException('session_not_active');
      }
      const questions = await m.find(Question, {
        where: { exam_id: session.exam_id },
      });
      attempt.score = this.sessionsService.scoreAnswers(
        attempt.answers,
        questions,
      );
      attempt.state = 'SUBMITTED';
      attempt.submitted_at = new Date();
      await m.save(attempt);

      await this.audit.record({
        classroom_id: session.classroom_id,
        actor_id: studentId,
        action: 'ATTEMPT_SUBMIT',
        target_type: 'attempt',
        target_id: attempt.id,
        metadata: { score: attempt.score },
      });

      return { score: attempt.score };
    });
  }

  async resync(studentId: string, sessionId: string) {
    const attempt = await this.attempts.findOne({
      where: { session_id: sessionId, student_id: studentId },
    });
    if (!attempt) throw new NotFoundException('attempt_not_found');
    const session = await this.sessions.findOneByOrFail({ id: sessionId });
    return {
      state: attempt.state,
      accepted_seq: attempt.client_seq,
      deadline_at: session.deadline_at?.toISOString() ?? null,
      answers: attempt.answers,
    };
  }
}
