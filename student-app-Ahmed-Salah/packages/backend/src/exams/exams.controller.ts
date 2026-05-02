import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../common/roles.guard';
import { ExamsService } from './exams.service';
import { CreateExamDto, ReplaceQuestionsDto, UpdateExamDto } from './dto';
import type { JwtClaims } from '@classroom/shared';

@Controller('exams')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('TUTOR', 'ADMIN')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list(@Req() req: any) {
    const u = req.user as JwtClaims;
    return this.exams.list(u.classroom_id);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    const u = req.user as JwtClaims;
    return this.exams.get(u.classroom_id, id);
  }

  @Post()
  @HttpCode(201)
  create(@Req() req: any, @Body() dto: CreateExamDto) {
    const u = req.user as JwtClaims;
    return this.exams.create(u.classroom_id, u.sub, dto);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateExamDto) {
    const u = req.user as JwtClaims;
    return this.exams.update(u.classroom_id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: any, @Param('id') id: string) {
    const u = req.user as JwtClaims;
    await this.exams.remove(u.classroom_id, id);
    return null;
  }

  @Put(':id/questions')
  replaceQuestions(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ReplaceQuestionsDto,
  ) {
    const u = req.user as JwtClaims;
    return this.exams.replaceQuestions(u.classroom_id, id, dto);
  }
}
