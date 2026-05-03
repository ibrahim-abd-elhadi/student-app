import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class SocketIoProvider {
  private io: Server | null = null;

  setIo(server: Server) {
    this.io = server;
  }

  getIo(): Server {
    if (!this.io) {
      throw new Error('Socket.IO server has not been initialized yet');
    }
    return this.io;
  }
}