import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { Exam, Question, Session } from '../entities';
import {
  CreateExamDto,
  QuestionDto,
  ReplaceQuestionsDto,
  UpdateExamDto,
} from './dto';
import type {
  ExamSummary,
  ExamWithQuestions,
  StudentExamPayload,
} from '@classroom/shared';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam) private readonly exams: Repository<Exam>,
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly ds: DataSource,
  ) {}

  async list(classroomId: string): Promise<ExamSummary[]> {
    const rows = await this.exams.find({
      where: { classroom_id: classroomId },
      order: { updated_at: 'DESC' },
    });
    if (rows.length === 0) return [];
    const counts = await this.questions
      .createQueryBuilder('q')
      .select('q.exam_id', 'exam_id')
      .addSelect('COUNT(*)::int', 'cnt')
      .where('q.exam_id IN (:...ids)', { ids: rows.map((r) => r.id) })
      .groupBy('q.exam_id')
      .getRawMany<{ exam_id: string; cnt: number }>();
    const cmap = new Map(counts.map((c) => [c.exam_id, c.cnt]));
    return rows.map((r) => this.toSummary(r, cmap.get(r.id) ?? 0));
  }

  async get(classroomId: string, examId: string): Promise<ExamWithQuestions> {
    const exam = await this.exams.findOne({ where: { id: examId } });
    if (!exam || exam.classroom_id !== classroomId) {
      throw new NotFoundException('exam_not_found');
    }
    const questions = await this.questions.find({
      where: { exam_id: examId },
      order: { ordinal: 'ASC' },
    });
    return {
      ...this.toSummary(exam, questions.length),
      questions: questions.map((q) => ({
        id: q.id,
        ordinal: q.ordinal,
        prompt: q.prompt,
        choices: q.choices,
        points: q.points,
        correct_id: q.correct_id,
      })),
    };
  }

  async create(
    classroomId: string,
    authorId: string,
    dto: CreateExamDto,
  ): Promise<ExamSummary> {
    const exam = this.exams.create({
      classroom_id: classroomId,
      author_id: authorId,
      title: dto.title,
      description: dto.description ?? null,
      default_duration: dto.default_duration,
      shuffle_questions: dto.shuffle_questions ?? true,
      is_published: dto.is_published ?? false,
    });
    await this.exams.save(exam);
    return this.toSummary(exam, 0);
  }

  async update(
    classroomId: string,
    examId: string,
    dto: UpdateExamDto,
  ): Promise<ExamSummary> {
    const exam = await this.exams.findOneBy({ id: examId });
    if (!exam || exam.classroom_id !== classroomId) {
      throw new NotFoundException('exam_not_found');
    }
    await this.assertNotInUse(examId);
    Object.assign(exam, {
      title: dto.title,
      description: dto.description ?? null,
      default_duration: dto.default_duration,
      shuffle_questions: dto.shuffle_questions ?? exam.shuffle_questions,
      is_published: dto.is_published ?? exam.is_published,
    });
    await this.exams.save(exam);
    const cnt = await this.questions.count({ where: { exam_id: examId } });
    return this.toSummary(exam, cnt);
  }

  async remove(classroomId: string, examId: string): Promise<void> {
    const exam = await this.exams.findOneBy({ id: examId });
    if (!exam || exam.classroom_id !== classroomId) {
      throw new NotFoundException('exam_not_found');
    }
    await this.assertNotInUse(examId);
    await this.exams.delete({ id: examId });
  }

  async replaceQuestions(
    classroomId: string,
    examId: string,
    dto: ReplaceQuestionsDto,
  ): Promise<ExamWithQuestions> {
    const exam = await this.exams.findOneBy({ id: examId });
    if (!exam || exam.classroom_id !== classroomId) {
      throw new NotFoundException('exam_not_found');
    }
    await this.assertNotInUse(examId);

    this.validateQuestions(dto.questions);

    await this.ds.transaction(async (m) => {
      await m.delete(Question, { exam_id: examId });
      const rows = dto.questions.map((q) =>
        m.create(Question, {
          exam_id: examId,
          ordinal: q.ordinal,
          prompt: q.prompt,
          choices: q.choices,
          correct_id: q.correct_id,
          points: q.points ?? 1,
        }),
      );
      await m.save(rows);
      await m.update(Exam, { id: examId }, { updated_at: new Date() });
    });
    return this.get(classroomId, examId);
  }

  /** Build the student-safe payload (omits `correct_id`). */
  async loadStudentPayload(examId: string): Promise<StudentExamPayload> {
    const exam = await this.exams.findOneByOrFail({ id: examId });
    const questions = await this.questions.find({
      where: { exam_id: examId },
      order: { ordinal: 'ASC' },
    });
    return {
      id: exam.id,
      title: exam.title,
      shuffle: exam.shuffle_questions,
      questions: questions.map((q) => ({
        id: q.id,
        ordinal: q.ordinal,
        prompt: q.prompt,
        choices: q.choices,
        points: q.points,
      })),
    };
  }

  private toSummary(exam: Exam, qcount: number): ExamSummary {
    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      default_duration: exam.default_duration,
      shuffle_questions: exam.shuffle_questions,
      is_published: exam.is_published,
      question_count: qcount,
      updated_at: exam.updated_at.toISOString(),
    };
  }

  /** Refuse mutation if any non-cancelled session references this exam. */
  private async assertNotInUse(examId: string): Promise<void> {
    const blocking = await this.sessions.count({
      where: { exam_id: examId, state: Not('CANCELLED') as any },
    });
    if (blocking > 0) {
      throw new ConflictException('exam_in_use');
    }
  }

  private validateQuestions(qs: QuestionDto[]): void {
    const ordinals = new Set<number>();
    for (const q of qs) {
      if (ordinals.has(q.ordinal)) {
        throw new ConflictException(`duplicate_ordinal:${q.ordinal}`);
      }
      ordinals.add(q.ordinal);
      const ids = new Set(q.choices.map((c) => c.id));
      if (ids.size !== q.choices.length) {
        throw new ConflictException(`duplicate_choice_id_in_q${q.ordinal}`);
      }
      if (!ids.has(q.correct_id)) {
        throw new ConflictException(`correct_id_not_in_choices_q${q.ordinal}`);
      }
    }
  }
}
