import { Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../common/roles.guard';
import { UsersService } from './users.service';
import type { JwtClaims } from '@classroom/shared';

@Controller('classrooms')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id/students')
  @Roles('TUTOR', 'ADMIN')
  list(@Param('id') id: string, @Req() req: any) {
    const user = req.user as JwtClaims;
    if (user.classroom_id !== id && user.role !== 'ADMIN') {
      throw new ForbiddenException('cross_classroom_access');
    }
    return this.users.listClassroomStudents(id);
  }
}
