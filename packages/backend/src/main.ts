import * as dotenv from 'dotenv';
dotenv.config();
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config/configuration';

/**
 * Main entry point for the NestJS backend application.
 * This function initializes the application, sets up global middleware,
 * and starts the HTTP server.
 */
async function bootstrap() {
  // Initialize the Nest application with specific logging levels
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Apply security middleware (HTTP headers)
  app.use(helmet());

  // Configure Cross-Origin Resource Sharing (CORS)
  app.enableCors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    credentials: true,
  });

  // Set global prefix for all API routes to version the API
  app.setGlobalPrefix('api/v1');

  // Set up global validation pipes for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that do not have any decorators
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to be objects typed according to their DTO classes
    }),
  );

  // Start listening for incoming requests
  await app.listen(config.httpPort, '0.0.0.0');
  Logger.log(`Backend listening on http://0.0.0.0:${config.httpPort}`, 'Bootstrap');
}

// Execute the bootstrap function
bootstrap();
