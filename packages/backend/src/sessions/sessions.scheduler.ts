import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionsService } from './sessions.service';
import { Inject, forwardRef } from '@nestjs/common';
import { ControlGateway } from '../realtime/control.gateway';

@Injectable()
export class SessionsScheduler {
  private readonly log = new Logger('SessionsScheduler');

  constructor(
    private readonly sessions: SessionsService,
    @Inject(forwardRef(() => ControlGateway))
    private readonly gateway: ControlGateway,
  ) {}

  /** Every 10 seconds, close ACTIVE sessions past their deadline. */
  @Cron('*/10 * * * * *')
  async tick(): Promise<void> {
    const expired = await this.sessions.findExpiredActive();
    for (const s of expired) {
      try {
        await this.sessions.stop(s.id, null, 'DEADLINE');
        this.gateway.broadcastSessionClosed(s.classroom_id, s.id, 'DEADLINE');
        this.log.log(`Closed expired session ${s.id}`);
      } catch (err) {
        this.log.error(`Failed to close session ${s.id}: ${(err as Error).message}`);
      }
    }
  }
}
