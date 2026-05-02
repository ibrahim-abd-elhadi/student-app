import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attempt, Exam, Question, Session, User } from '../entities';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Attempt, Exam, Question, User])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
