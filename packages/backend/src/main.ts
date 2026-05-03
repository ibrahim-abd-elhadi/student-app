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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const httpServer = app.getHttpServer();

  // Create the Socket.IO server manually
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    transports: ['websocket'],
  });

  // Set it into the shared provider so the gateway can use it
  const ioProvider = app.get(SocketIoProvider);
  ioProvider.setIo(io);

  // Adapter that returns our pre‑made server
  class CustomIoAdapter extends IoAdapter {
    create(port: number, options?: any): Server {
      return io;
    }
  }
  app.useWebSocketAdapter(new CustomIoAdapter(app));

  // Global prefix for REST routes, EXCLUDING Socket.IO paths
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: '/socket.io/(.*)', method: RequestMethod.ALL },
      { path: '/ws', method: RequestMethod.ALL },
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