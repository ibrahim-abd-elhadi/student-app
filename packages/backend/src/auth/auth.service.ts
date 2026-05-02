import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import type { JwtClaims } from '@classroom/shared';
import { User, RefreshToken } from '../entities';
import { config } from '../config/configuration';
import { AuditService } from '../common/audit.service';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    username: string;
    display_name: string;
    role: string;
    classroom_id: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(username: string, password: string): Promise<TokenPair> {
    const user = await this.users.findOne({ where: { username, is_active: true } });
    if (!user) throw new UnauthorizedException('invalid_credentials');

    let ok = false;
    try {
      ok = await argon2.verify(user.password_hash, password);
    } catch {
      ok = false;
    }
    if (!ok) throw new UnauthorizedException('invalid_credentials');

    const tokens = await this.issueTokens(user);
    await this.audit.record({
      classroom_id: user.classroom_id,
      actor_id: user.id,
      action: 'AUTH_LOGIN',
      target_type: 'user',
      target_id: user.id,
    });
    return tokens;
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.sha256(refreshToken);
    const record = await this.refreshTokens.findOne({
      where: {
        token_hash: tokenHash,
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
      relations: { user: true },
    });
    if (!record || !record.user) {
      // Possible reuse: revoke ALL refresh tokens for whichever user this hash
      // ever belonged to. This is the standard refresh-rotation theft response.
      const seen = await this.refreshTokens.findOne({ where: { token_hash: tokenHash } });
      if (seen) {
        await this.refreshTokens.update({ user_id: seen.user_id }, { revoked_at: new Date() });
      }
      throw new UnauthorizedException('invalid_refresh');
    }

    // Rotate: revoke old, issue new pair.
    await this.refreshTokens.update({ id: record.id }, { revoked_at: new Date() });
    return this.issueTokens(record.user);
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.sha256(refreshToken);
    await this.refreshTokens.update({ token_hash: hash }, { revoked_at: new Date() });
  }

  /** Verify an access token (used by WS handshake). */
  async verifyAccessToken(token: string): Promise<JwtClaims> {
    return this.jwt.verifyAsync<JwtClaims>(token);
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const claims: JwtClaims = {
      sub: user.id,
      role: user.role,
      classroom_id: user.classroom_id,
      username: user.username,
    };
    const access_token = await this.jwt.signAsync(claims, {
      expiresIn: config.jwtAccessTtl,
    });
    const refresh = crypto.randomBytes(48).toString('base64url');
    const refresh_hash = this.sha256(refresh);
    const expires_at = new Date(Date.now() + config.jwtRefreshTtl * 1000);
    await this.refreshTokens.insert({
      user_id: user.id,
      token_hash: refresh_hash,
      expires_at,
    });
    return {
      access_token,
      refresh_token: refresh,
      expires_in: config.jwtAccessTtl,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        classroom_id: user.classroom_id,
      },
    };
  }

  private sha256(s: string): string {
    return crypto.createHash('sha256').update(s).digest('hex');
  }
}
