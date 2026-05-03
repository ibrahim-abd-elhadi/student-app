import { existsSync } from 'node:fs';
import { config as dotenvConfig } from 'dotenv';
const envPath = existsSync('.env') ? '.env' : '.env.example';
dotenvConfig({ path: envPath });
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server } from 'socket.io';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config/configuration';
import { SocketIoProvider } from './realtime/socket-io.provider';

// Simple adapter that wraps a pre-created Socket.IO server
class CustomIoAdapter extends IoAdapter {
  constructor(private app: any, private io: Server, private logger = new Logger('CustomIoAdapter')) {
    super(app);
  }

  createIOServer(port: number, options?: any): Server {
    this.logger.log('[createIOServer] Returning pre-created Socket.IO server', 'SocketIO');
    return this.io;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Get the HTTP server created by NestFactory
  const httpServer = app.getHttpServer();
  Logger.log('[Bootstrap] Got HTTP server from NestFactory', 'Bootstrap');

  // Create Socket.IO server on the HTTP server
  const io = new Server(httpServer, {
    path: '/ws',
    cors: { origin: true, credentials: true },
    transports: ['websocket'],
    pingInterval: 5_000,
    pingTimeout: 10_000,
  });
  Logger.log('[Bootstrap] Socket.IO server created with path=/ws', 'Bootstrap');

  // Log all raw connections
  io.on('connection', (socket) => {
    Logger.log(`[Bootstrap] [RawConnection] ${socket.id}`, 'Bootstrap');
  });

  // Set it in the provider so gateway can access it
  const ioProvider = app.get(SocketIoProvider);
  ioProvider.setIo(io);
  Logger.log('[Bootstrap] Socket.IO provider updated', 'Bootstrap');

  // Register the adapter (it will return our pre-created server)
  app.useWebSocketAdapter(new CustomIoAdapter(app, io));
  Logger.log('[Bootstrap] Custom Socket.IO adapter registered', 'Bootstrap');

  // Global prefix for REST routes, EXCLUDING Socket.IO paths
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: '/socket.io/(.*)', method: RequestMethod.ALL },
      { path: '/ws', method: RequestMethod.ALL },
      { path: '/ws/(.*)', method: RequestMethod.ALL },
    ],
  });

  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(config.httpPort, '0.0.0.0');
  Logger.log(`Backend listening on http://0.0.0.0:${config.httpPort}`, 'Bootstrap');
}

bootstrap();