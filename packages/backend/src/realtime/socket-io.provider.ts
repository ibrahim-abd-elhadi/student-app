import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class SocketIoProvider {
  private io: Server | null = null;
  private readonly logger = new Logger('SocketIoProvider');

  setIo(server: Server) {
    this.logger.log('[setIo] Socket.IO server set');
    this.io = server;
  }

  getIo(): Server {
    if (!this.io) {
      this.logger.error('[getIo] Socket.IO server not initialized!');
      throw new Error('Socket.IO server has not been initialized yet');
    }
    this.logger.debug('[getIo] Returning Socket.IO server');
    return this.io;
  }
}