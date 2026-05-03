import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../common/roles.guard';
import { AttemptsService } from './attempts.service';
import { SessionsService } from './sessions.service';
import { PresenceService } from '../realtime/presence.service';
import type { JwtClaims } from '@classroom/shared';

@Controller('me')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('STUDENT')
export class MeController {
  constructor(
    private readonly attempts: AttemptsService,
    private readonly sessions: SessionsService,
    private readonly presence: PresenceService,
  ) {}

  @Get('attempts')
  listMyAttempts(@Req() req: any) {
    const u = req.user as JwtClaims;
    return this.attempts.listForStudent(u.sub);
  }

  @Post('online')
  async markOnline(@Req() req: any) {
    const u = req.user as JwtClaims;
    await this.presence.markOnline(u.sub);
    return {
      ok: true,
      user_id: u.sub,
      online: true,
      last_seen_at: new Date().toISOString(),
    };
  }

  @Get('active-exam')
  activeExam(@Req() req: any) {
    const u = req.user as JwtClaims;
    return this.sessions.getActiveExamForStudent(u.sub);
  }

  @Post('attempts/:sessionId/submit')
  submitAttempt(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { answers?: Record<string, string> },
  ) {
    const u = req.user as JwtClaims;
    return this.attempts.submitSnapshot(u.sub, sessionId, body.answers ?? {});
  }
}
