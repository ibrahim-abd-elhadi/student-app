import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { PresenceService } from './presence.service';
import { SessionsService, StartedSession } from '../sessions/sessions.service';
import { AttemptsService } from '../sessions/attempts.service';
import type { JwtClaims, UserRole } from '@classroom/shared';
import { SocketIoProvider } from './socket-io.provider';
import type { Server as SocketIoServer } from 'socket.io';

interface SocketUser extends JwtClaims {}

@WebSocketGateway()
export class ControlGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger('ControlGateway');

  constructor(
    private readonly auth: AuthService,
    private readonly presence: PresenceService,
    private readonly sessionsService: SessionsService,
    private readonly attempts: AttemptsService,
    private readonly ioProvider: SocketIoProvider,
  ) {
    this.log.log('[Constructor] ControlGateway instantiated');
  }

  // Getter that retrieves the server when needed (after startup)
  private get io(): SocketIoServer {
    return this.ioProvider.getIo();
  }

  afterInit(server: SocketIoServer) {
    this.log.log('[afterInit] ControlGateway initialized with server, registering handlers');
  }

  async handleConnection(socket: Socket): Promise<void> {
    this.log.log(`[handleConnection] ✅ Socket connected: ${socket.id}`);
    try {
      // Extract token from handshake auth or headers
      const token =
        (socket.handshake.auth?.token as string) ||
        this.extractBearer(socket.handshake.headers.authorization);
      if (!token) throw new Error('missing_token');
      
      // Verify JWT and attach claims to socket data
      const claims = await this.auth.verifyAccessToken(token);
      (socket.data as { user: SocketUser }).user = claims;

      // Join rooms for targeted broadcasting
      socket.join(`classroom:${claims.classroom_id}`);
      socket.join(`${claims.role.toLowerCase()}:${claims.sub}`);
      this.log.log(`[handleConnection] Joined rooms: classroom:${claims.classroom_id}, ${claims.role.toLowerCase()}:${claims.sub}`);

      // Mark user as online in the presence service
      await this.presence.markOnline(claims.sub);
      this.log.log(`[handleConnection] Marked ${claims.username} as online in presence`);
      
      if (claims.role === 'STUDENT') {
        this.log.log(`[handleConnection] Broadcasting presence:update for student ${claims.sub} to classroom:${claims.classroom_id}`);
        this.io
          .to(`classroom:${claims.classroom_id}`)
          .emit('presence:update', {
            user_id: claims.sub,
            online: true,
            last_seen_at: new Date().toISOString(),
          });
        this.log.log(`[handleConnection] ✅ Broadcasted presence:update`);
      }
      this.log.log(`✅ Connected ${claims.role} ${claims.username} (${claims.sub})`);
    } catch (err) {
      this.log.error(`[handleConnection] ❌ Error: ${(err as Error).message}`, (err as Error).stack);
      this.log.warn(`Rejected WS connection: ${(err as Error).message}`);
      socket.disconnect(true);
    }
  }

  /**
   * Called when a client disconnects.
   * Updates presence and notifies the classroom.
   */
  async handleDisconnect(socket: Socket): Promise<void> {
    const user = (socket.data as { user?: SocketUser }).user;
    if (!user) return;
    
    await this.presence.markOffline(user.sub);
    
    if (user.role === 'STUDENT') {
      this.io.to(`classroom:${user.classroom_id}`).emit('presence:update', {
        user_id: user.sub,
        online: false,
        last_seen_at: new Date().toISOString(),
      });
    }
    this.log.log(`Disconnected ${user.username}`);
  }

  /* ---------- Tutor → Server commands ---------- */

  /**
   * Command from Tutor to lock specific student screens.
   */
  @SubscribeMessage('student:lock')
  handleLock(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { student_ids: string[]; message?: string },
  ) {
    this.requireRole(socket, 'TUTOR');
    const cls = this.userOf(socket).classroom_id;
    let dispatched = 0;
    for (const sid of body.student_ids) {
      // Security: verify each student belongs to the tutor's classroom
      const room = `student:${sid}`;
      const sockets = this.io.sockets.adapter.rooms.get(room);
      if (!sockets) continue;
      for (const sockId of sockets) {
        const s = this.io.sockets.sockets.get(sockId);
        const u = (s?.data as { user?: SocketUser }).user;
        if (u && u.classroom_id === cls) {
          s!.emit('lock:apply', { message: body.message ?? '' });
          dispatched++;
        }
      }
    }
    return { ok: true, dispatched };
  }

  /**
   * Command from Tutor to unlock specific student screens.
   */
  @SubscribeMessage('student:unlock')
  handleUnlock(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { student_ids: string[] },
  ) {
    this.requireRole(socket, 'TUTOR');
    const cls = this.userOf(socket).classroom_id;
    let dispatched = 0;
    for (const sid of body.student_ids) {
      const room = `student:${sid}`;
      const sockets = this.io.sockets.adapter.rooms.get(room);
      if (!sockets) continue;
      for (const sockId of sockets) {
        const s = this.io.sockets.sockets.get(sockId);
        const u = (s?.data as { user?: SocketUser }).user;
        if (u && u.classroom_id === cls) {
          s!.emit('lock:release', {});
          dispatched++;
        }
      }
    }
    return { ok: true, dispatched };
  }

  @SubscribeMessage('student:ready')
  handleStudentReady(@ConnectedSocket() socket: Socket) {
    this.requireRole(socket, 'STUDENT');
    const u = this.userOf(socket);
    this.io.to(`classroom:${u.classroom_id}`).emit('presence:update', {
      user_id: u.sub,
      online: true,
      ready: true,
      last_seen_at: new Date().toISOString(),
    });
    return { ok: true };
  }

  /**
   * Student reports a question answer.
   * Incremental updates are broadcasted to the classroom (Tutor).
   */
  @SubscribeMessage('answer:upsert')
  async handleAnswerUpsert(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: {
      session_id: string;
      question_id: string;
      choice_id: string;
      client_seq: number;
    },
  ) {
    this.requireRole(socket, 'STUDENT');
    const u = this.userOf(socket);
    try {
      const result = await this.attempts.upsertAnswer({
        student_id: u.sub,
        session_id: body.session_id,
        question_id: body.question_id,
        choice_id: body.choice_id,
        client_seq: body.client_seq,
      });
      
      // Notify tutor about student progress
      this.io.to(`classroom:${u.classroom_id}`).emit('attempt:progress', {
        session_id: body.session_id,
        student_id: u.sub,
        answered_count: result.answered_count,
      });
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /**
   * Student submits their exam final answers.
   */
  @SubscribeMessage('exam:submit')
  async handleSubmit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { session_id: string },
  ) {
    this.requireRole(socket, 'STUDENT');
    const u = this.userOf(socket);
    try {
      const r = await this.attempts.submit(u.sub, body.session_id);
      const submitted_at = new Date().toISOString();
      
      // Notify classroom about the submission
      this.io.to(`classroom:${u.classroom_id}`).emit('attempt:submitted', {
        session_id: body.session_id,
        student_id: u.sub,
        score: r.score,
        submitted_at,
      });
      return { ok: true, score: r.score };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /**
   * Handles resync request from student (e.g. after network drop).
   */
  @SubscribeMessage('attempt:resync')
  async handleResync(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { session_id: string; last_client_seq: number },
  ) {
    this.requireRole(socket, 'STUDENT');
    const u = this.userOf(socket);
    try {
      const r = await this.attempts.resync(u.sub, body.session_id);
      return { ok: true, ...r };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /**
   * Student reports their current state (active window, lock status, suspicious activity).
   */
  @SubscribeMessage('state:report')
  handleStateReport(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: { active_window?: string; locked: boolean; suspicious?: boolean },
  ) {
    this.requireRole(socket, 'STUDENT');
    const u = this.userOf(socket);
    this.io.to(`classroom:${u.classroom_id}`).emit('student:state', {
      student_id: u.sub,
      ...body,
    });
    return { ok: true };
  }

  /* ---------- External fan-out helpers (called from controllers/scheduler) ---------- */

  /**
   * Send the exam payload to each assigned student.
   * Called when a session is started.
   */
  broadcastSessionAssigned(started: StartedSession): void {
    for (const a of started.attempts) {
      this.io.to(`student:${a.student_id}`).emit('exam:assigned', {
        session_id: started.session.id,
        exam: started.exam,
        deadline_at: started.session.deadline_at!.toISOString(),
      });
    }
  }

  /**
   * Notify all members that a session has been closed.
   */
  broadcastSessionClosed(
    classroomId: string,
    sessionId: string,
    reason: 'TUTOR_STOP' | 'DEADLINE' | 'ALL_SUBMITTED',
  ): void {
    this.io.to(`classroom:${classroomId}`).emit('session:closed', {
      session_id: sessionId,
      reason,
      state: 'CLOSED',
    });
    this.io.to(`classroom:${classroomId}`).emit('exam:closed', {
      session_id: sessionId,
      reason,
    });
  }

  /* ---------- Helpers ---------- */

  /** Helper to get authenticated user claims from socket */
  private userOf(socket: Socket): SocketUser {
    const u = (socket.data as { user?: SocketUser }).user;
    if (!u) throw new Error('unauthenticated');
    return u;
  }

  /** Helper to enforce role-based access control on WS messages */
  private requireRole(socket: Socket, role: UserRole): void {
    const u = this.userOf(socket);
    if (u.role !== role) {
      throw new Error(`forbidden:expected_${role}`);
    }
  }

  /** Helper to extract Bearer token from Authorization header */
  private extractBearer(h?: string): string | null {
    if (!h) return null;
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m ? m[1] : null;
  }
}