import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { PresenceService } from './presence.service';
import { SessionsService, StartedSession } from '../sessions/sessions.service';
import { AttemptsService } from '../sessions/attempts.service';
import { UsersService } from '../users/users.service';
import type { JwtClaims, UserRole } from '@classroom/shared';

interface SocketUser extends JwtClaims {}

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: true, credentials: true },
  transports: ['websocket'],
  pingInterval: 5_000,
  pingTimeout: 10_000,
})
export class ControlGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger('ControlGateway');
  private readonly activeSockets = new Map<string, number>();

  @WebSocketServer()
  io!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly presence: PresenceService,
    private readonly sessionsService: SessionsService,
    private readonly attempts: AttemptsService,
    private readonly usersService: UsersService,
  ) {}

  /* ---------- Connection lifecycle ---------- */

  private static readonly PRESENCE_REFRESH_INTERVAL = 10_000;

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        this.extractBearer(socket.handshake.headers.authorization);
      if (!token) throw new Error('missing_token');
      const claims = await this.auth.verifyAccessToken(token);
      (socket.data as { user: SocketUser; presenceRefresh?: NodeJS.Timeout }).user = claims;

      socket.join(`classroom:${claims.classroom_id}`);
      socket.join(`${claims.role.toLowerCase()}:${claims.sub}`);

      const active = (this.activeSockets.get(claims.sub) ?? 0) + 1;
      this.activeSockets.set(claims.sub, active);
      await this.presence.markOnline(claims.sub);
      (socket.data as { user: SocketUser; presenceRefresh?: NodeJS.Timeout }).presenceRefresh = setInterval(
        () => this.presence.refresh(claims.sub).catch((err) =>
          this.log.error(`Failed to refresh presence for ${claims.sub}: ${(err as Error).message}`),
        ),
        ControlGateway.PRESENCE_REFRESH_INTERVAL,
      );

      if (claims.role === 'TUTOR' || claims.role === 'ADMIN') {
        const roster = await this.usersService.listClassroomStudents(claims.classroom_id);
        socket.emit(
          'presence:sync',
          roster.map((student) => ({
            user_id: student.id,
            online: student.online,
            last_seen_at: student.last_seen_at,
          })),
        );
      }

      if (claims.role === 'STUDENT' && active === 1) {
        this.io
          .to(`classroom:${claims.classroom_id}`)
          .emit('presence:update', {
            user_id: claims.sub,
            online: true,
            last_seen_at: new Date().toISOString(),
          });
      }
      this.log.log(`Connected ${claims.role} ${claims.username} (${claims.sub})`);
    } catch (err) {
      this.log.warn(`Rejected WS connection: ${(err as Error).message}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const data = socket.data as { user?: SocketUser; presenceRefresh?: NodeJS.Timeout };
    if (data.presenceRefresh) {
      clearInterval(data.presenceRefresh);
    }
    const user = data.user;
    if (!user) return;

    const active = (this.activeSockets.get(user.sub) ?? 1) - 1;
    if (active > 0) {
      this.activeSockets.set(user.sub, active);
      this.log.log(`Disconnected socket for ${user.username}, still ${active} active`);
      return;
    }

    this.activeSockets.delete(user.sub);
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

  @SubscribeMessage('student:lock')
  handleLock(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { student_ids: string[]; message?: string },
  ) {
    this.requireRole(socket, 'TUTOR');
    const cls = this.userOf(socket).classroom_id;
    let dispatched = 0;
    for (const sid of body.student_ids) {
      // Defense in depth: we trust the tutor's classroom_id, not the client-provided ids.
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

  /* ---------- Student → Server events ---------- */

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

  /** Send the exam payload to each assigned student. */
  broadcastSessionAssigned(started: StartedSession): void {
    for (const a of started.attempts) {
      this.io.to(`student:${a.student_id}`).emit('exam:assigned', {
        session_id: started.session.id,
        exam: started.exam,
        deadline_at: started.session.deadline_at!.toISOString(),
      });
    }
  }

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
    // Tell students this session is over (so they tear down the exam window).
    this.io.to(`classroom:${classroomId}`).emit('exam:closed', {
      session_id: sessionId,
      reason,
    });
  }

  /* ---------- Helpers ---------- */

  private userOf(socket: Socket): SocketUser {
    const u = (socket.data as { user?: SocketUser }).user;
    if (!u) throw new Error('unauthenticated');
    return u;
  }

  private requireRole(socket: Socket, role: UserRole): void {
    const u = this.userOf(socket);
    if (u.role !== role) {
      throw new Error(`forbidden:expected_${role}`);
    }
  }

  private extractBearer(h?: string): string | null {
    if (!h) return null;
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m ? m[1] : null;
  }
}
