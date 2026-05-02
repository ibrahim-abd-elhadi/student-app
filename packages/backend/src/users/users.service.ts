import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { PresenceService } from '../realtime/presence.service';

export interface RosterEntry {
  id: string;
  username: string;
  display_name: string;
  online: boolean;
  last_seen_at: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly presence: PresenceService,
  ) {}

  async listClassroomStudents(classroomId: string): Promise<RosterEntry[]> {
    const rows = await this.users.find({
      where: { classroom_id: classroomId, role: 'STUDENT', is_active: true },
      order: { display_name: 'ASC' },
    });
    const ids = rows.map((u) => u.id);
    const presence = await this.presence.getMany(ids);
    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      online: presence[u.id]?.online ?? false,
      last_seen_at: presence[u.id]?.last_seen_at ?? null,
    }));
  }
}
