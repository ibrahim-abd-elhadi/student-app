import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../common/roles.guard';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto';
import { ControlGateway } from '../realtime/control.gateway';
import type { JwtClaims } from '@classroom/shared';

@Controller('sessions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('TUTOR', 'ADMIN')
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly gateway: ControlGateway,
  ) {}

  @Post()
  @HttpCode(201)
  create(@Req() req: any, @Body() dto: CreateSessionDto) {
    const u = req.user as JwtClaims;
    return this.sessions.create(u.sub, u.classroom_id, dto);
  }

  @Get(':id')
  detail(@Req() req: any, @Param('id') id: string) {
    const u = req.user as JwtClaims;
    return this.sessions.getDetail(u.classroom_id, id);
  }

  @Post(':id/start')
  async start(@Req() req: any, @Param('id') id: string) {
    const u = req.user as JwtClaims;
    const started = await this.sessions.start(id, u.sub);
    // Fan out to students; gateway exposes a helper that does the per-student emit.
    this.gateway.broadcastSessionAssigned(started);
    return {
      session_id: started.session.id,
      started_at: started.session.started_at,
      deadline_at: started.session.deadline_at,
    };
  }

  @Post(':id/stop')
  async stop(@Req() req: any, @Param('id') id: string) {
    const u = req.user as JwtClaims;
    const session = await this.sessions.stop(id, u.sub, 'TUTOR_STOP');
    this.gateway.broadcastSessionClosed(
      session.classroom_id,
      session.id,
      'TUTOR_STOP',
    );
    return { ok: true };
  }
}
