import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../common/roles.guard';
import { AttemptsService } from './attempts.service';
import type { JwtClaims } from '@classroom/shared';

@Controller('me')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('STUDENT')
export class MeController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('attempts')
  listMyAttempts(@Req() req: any) {
    const u = req.user as JwtClaims;
    return this.attempts.listForStudent(u.sub);
  }
}
