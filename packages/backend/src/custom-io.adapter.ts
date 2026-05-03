import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger } from '@nestjs/common';

export class CustomIoAdapter extends IoAdapter {
  private logger = new Logger('CustomIoAdapter');

  constructor(private nestApp: any) {
    super(nestApp);
    this.logger.log('CustomIoAdapter initialized');
  }

  // Override createIOServer to ensure Socket.io is created
  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: true, credentials: true },
      transports: ['websocket', 'polling'],
      pingInterval: 5000,
      pingTimeout: 10000,
    });
    
    // Store reference on app for later use
    this.nestApp.io = server;
    this.logger.log('Socket.io server created and stored on app');
    
    return server;
  }
}



