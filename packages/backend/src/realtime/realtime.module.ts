import { Module, forwardRef } from '@nestjs/common';
import { ControlGateway } from './control.gateway';
import { PresenceService } from './presence.service';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SocketIoProvider } from './socket-io.provider';

@Module({
  imports: [AuthModule, forwardRef(() => SessionsModule)],
  providers: [ControlGateway, PresenceService, SocketIoProvider],
  exports: [ControlGateway, PresenceService, SocketIoProvider],
})
export class RealtimeModule {}