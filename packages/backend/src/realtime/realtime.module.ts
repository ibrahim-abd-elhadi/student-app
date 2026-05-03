import { Module, forwardRef } from '@nestjs/common';
import { ControlGateway } from './control.gateway';
import { PresenceService } from './presence.service';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, forwardRef(() => SessionsModule), forwardRef(() => UsersModule)],
  providers: [ControlGateway, PresenceService],
  exports: [ControlGateway, PresenceService],
})
export class RealtimeModule {}