import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@classroom/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    
    if (!user) {
      this.logger.warn('Authorization attempt without user context');
      throw new ForbiddenException('missing_user_context');
    }

    if (!required.includes(user.role)) {
      this.logger.warn(
        `Access denied for user ${user.sub} with role ${user.role}. Required: ${required.join(', ')}`,
      );
      throw new ForbiddenException('insufficient_role');
    }
    
    return true;
  }
}
