export type UserRole = 'TUTOR' | 'STUDENT' | 'ADMIN';
export type SessionState = 'PENDING' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
export type AttemptState = 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'CANCELLED';
export interface JwtClaims {
    sub: string;
    role: UserRole;
    classroom_id: string;
    username: string;
}
export interface UserDto {
    id: string;
    username: string;
    display_name: string;
    role: UserRole;
    classroom_id: string;
}
export interface QuestionChoice {
    id: string;
    text: string;
}
/** Question shape sent to students — `correct_id` is intentionally absent. */
export interface StudentQuestion {
    id: string;
    ordinal: number;
    prompt: string;
    choices: QuestionChoice[];
    points: number;
}
/** Question shape used by tutors / designer (includes `correct_id`). */
export interface AuthoredQuestion extends StudentQuestion {
    correct_id: string;
}
export interface ExamSummary {
    id: string;
    title: string;
    description?: string | null;
    default_duration: number;
    shuffle_questions: boolean;
    is_published: boolean;
    question_count: number;
    updated_at: string;
}
export interface ExamWithQuestions extends ExamSummary {
    questions: AuthoredQuestion[];
}
export interface StudentExamPayload {
    id: string;
    title: string;
    shuffle: boolean;
    questions: StudentQuestion[];
}
export interface SessionDto {
    id: string;
    classroom_id: string;
    exam_id: string;
    tutor_id: string;
    duration_minutes: number;
    state: SessionState;
    started_at: string | null;
    deadline_at: string | null;
    closed_at: string | null;
    created_at: string;
}
export interface AttemptDto {
    id: string;
    session_id: string;
    student_id: string;
    state: AttemptState;
    answered_count: number;
    score: number | null;
    started_at: string | null;
    submitted_at: string | null;
}
export interface PresenceEntry {
    user_id: string;
    online: boolean;
    last_seen_at: string | null;
}
/** Summary of one of the calling student's own attempts, for the student dashboard. */
export interface StudentAttemptSummary {
    attempt_id: string;
    session_id: string;
    exam_id: string;
    exam_title: string;
    state: AttemptState;
    session_state: SessionState;
    score: number | null;
    total_points: number | null;
    answered_count: number;
    started_at: string | null;
    submitted_at: string | null;
    deadline_at: string | null;
    created_at: string;
}
export interface SessionReport {
    session_id: string;
    exam_title: string;
    started_at: string | null;
    closed_at: string | null;
    duration_minutes: number;
    total_questions: number;
    results: Array<{
        student_id: string;
        display_name: string;
        answered_count: number;
        score: number | null;
        submitted_at: string | null;
        state: AttemptState;
    }>;
}
