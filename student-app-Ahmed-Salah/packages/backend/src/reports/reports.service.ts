import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Attempt, Exam, Question, Session, User } from '../entities';
import type { SessionReport } from '@classroom/shared';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(Attempt) private readonly attempts: Repository<Attempt>,
    @InjectRepository(Exam) private readonly exams: Repository<Exam>,
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async build(classroomId: string, sessionId: string): Promise<SessionReport> {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.classroom_id !== classroomId) {
      throw new NotFoundException('session_not_found');
    }
    const exam = await this.exams.findOneByOrFail({ id: session.exam_id });
    const total = await this.questions.count({ where: { exam_id: exam.id } });
    const attempts = await this.attempts.find({ where: { session_id: sessionId } });
    const studentIds = attempts.map((a) => a.student_id);
    const students = studentIds.length
      ? await this.users.findBy({ id: In(studentIds) })
      : [];
    const nameById = new Map(students.map((s) => [s.id, s.display_name]));

    return {
      session_id: session.id,
      exam_title: exam.title,
      started_at: session.started_at?.toISOString() ?? null,
      closed_at: session.closed_at?.toISOString() ?? null,
      duration_minutes: session.duration_minutes,
      total_questions: total,
      results: attempts
        .map((a) => ({
          student_id: a.student_id,
          display_name: nameById.get(a.student_id) ?? '—',
          answered_count: a.answered_count,
          score: a.score,
          submitted_at: a.submitted_at?.toISOString() ?? null,
          state: a.state,
        }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name, 'ar')),
    };
  }

  /** Renders an HTML report. Electron's silent printing converts this to PDF. */
  buildHtml(report: SessionReport): string {
    const rows = report.results
      .map(
        (r) => `
        <tr>
          <td>${escape(r.display_name)}</td>
          <td>${r.answered_count} / ${report.total_questions}</td>
          <td>${r.score ?? '—'}</td>
          <td>${stateLabel(r.state)}</td>
          <td>${r.submitted_at ? new Date(r.submitted_at).toLocaleString('ar') : '—'}</td>
        </tr>`,
      )
      .join('');
    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escape(report.exam_title)}</title>
<style>
  body { font-family: "Segoe UI", "Tahoma", "Arial", sans-serif; padding: 24px; }
  h1 { font-size: 22px; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
  th { background: #f4f4f4; }
  .meta { color: #555; margin-bottom: 8px; }
</style>
</head>
<body>
  <h1>تقرير الاختبار: ${escape(report.exam_title)}</h1>
  <div class="meta">المدة: ${report.duration_minutes} دقيقة</div>
  <div class="meta">بدأ: ${report.started_at ?? '—'}</div>
  <div class="meta">انتهى: ${report.closed_at ?? '—'}</div>
  <table>
    <thead>
      <tr>
        <th>اسم الطالب</th><th>عدد الإجابات</th><th>الدرجة</th>
        <th>الحالة</th><th>وقت التسليم</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stateLabel(s: string): string {
  switch (s) {
    case 'SUBMITTED': return 'مُسلَّم';
    case 'EXPIRED':   return 'منتهي';
    case 'IN_PROGRESS': return 'قيد التنفيذ';
    case 'ASSIGNED':  return 'مُعيَّن';
    case 'CANCELLED': return 'ملغى';
    default: return s;
  }
}
