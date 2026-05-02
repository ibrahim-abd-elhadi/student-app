import { Module, forwardRef } from '@nestjs/common';
import { ControlGateway } from './control.gateway';
import { PresenceService } from './presence.service';
import { StudentDetectionService } from './student-detection.service';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [AuthModule, forwardRef(() => SessionsModule)],
  providers: [ControlGateway, PresenceService, StudentDetectionService],
  exports: [ControlGateway, PresenceService, StudentDetectionService],
})
export class RealtimeModule {}
