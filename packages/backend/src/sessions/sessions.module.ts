import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attempt, Exam, Question, Session, User } from '../entities';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { AttemptsService } from './attempts.service';
import { SessionsScheduler } from './sessions.scheduler';
import { ExamsModule } from '../exams/exams.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Attempt, Exam, Question, User]),
    ExamsModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [SessionsController],
  providers: [SessionsService, AttemptsService, SessionsScheduler],
  exports: [SessionsService, AttemptsService],
})
export class SessionsModule {}
