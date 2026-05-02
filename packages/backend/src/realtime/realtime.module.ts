import { Module, forwardRef } from '@nestjs/common';
import { ControlGateway } from './control.gateway';
import { PresenceService } from './presence.service';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [AuthModule, forwardRef(() => SessionsModule)],
  providers: [ControlGateway, PresenceService],
  exports: [ControlGateway, PresenceService],
})
export class RealtimeModule {}
