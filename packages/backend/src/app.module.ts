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

/**
 * Root module of the application.
 * It coordinates all other modules and provides global configurations
 * for database, scheduling, and environment variables.
 */
@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({ isGlobal: true }),
    
    // Enable task scheduling (cron jobs, etc.)
    ScheduleModule.forRoot(),
    
    // Configure Database connection using TypeORM
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.databaseUrl,
      entities,
      synchronize: false,        // schema is managed by SQL files in infra/db (Manual migrations recommended for prod)
      logging: config.env === 'development' ? ['error', 'warn'] : ['error'],
    }),

    // Feature Modules
    CommonModule,   // Shared utilities and services
    AuthModule,     // Authentication and Authorization
    UsersModule,    // User management (Tutors, Students)
    ExamsModule,    // Exam creation and management
    SessionsModule, // Live classroom sessions
    RealtimeModule, // WebSockets/Socket.IO logic
    ReportsModule,  // Statistics and performance reporting
  ],
})
export class AppModule {}
