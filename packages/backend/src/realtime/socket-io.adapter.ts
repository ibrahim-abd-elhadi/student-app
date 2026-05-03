import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

export class CustomIoAdapter extends IoAdapter {
  private customServer: Server | null = null;

  setCustomServer(server: Server): void {
    this.customServer = server;
    Logger.log('[CustomIoAdapter] Custom server set', 'SocketIO');
  }

  createIOServer(port: number, options?: any): Server {
    if (this.customServer) {
      Logger.log('[CustomIoAdapter] Using custom Socket.IO server', 'SocketIO');
      return this.customServer;
    }
    Logger.log('[CustomIoAdapter] Creating default Socket.IO server', 'SocketIO');
    return super.createIOServer(port, options);
  }
}
