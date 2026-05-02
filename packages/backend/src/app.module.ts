import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { config } from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { ExamsModule } from './exams/exams.module';
import { SessionsModule } from './sessions/sessions.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { entities } from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.databaseUrl,
      entities,
      synchronize: false,        // schema is managed by SQL files in infra/db
      logging: config.env === 'development' ? ['error', 'warn'] : ['error'],
    }),
    CommonModule,
    AuthModule,
    UsersModule,
    ExamsModule,
    SessionsModule,
    RealtimeModule,
    ReportsModule,
  ],
})
export class AppModule {}
