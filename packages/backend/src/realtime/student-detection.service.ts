import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from '../config/configuration';

export interface DetectedStudent {
  id: string;
  classroom_id: string;
  username: string;
  display_name: string;
  status: 'online' | 'idle' | 'offline';
  device: {
    hostname: string;
    platform: string;
    ip_address?: string;
    user_agent?: string;
  };
  last_activity: string;
  connected_at: string;
  last_seen_at: string;
}

export interface StudentActivity {
  type: 'login' | 'logout' | 'activity' | 'exam_start' | 'exam_end' | 'lock_applied' | 'lock_released';
  timestamp: string;
  data?: Record<string, any>;
}

const STUDENT_DETECTION_TTL = 60; // seconds before student marked as idle/offline
const ACTIVITY_LOG_EXPIRY = 86400; // 24 hours

@Injectable()
export class StudentDetectionService {
  private readonly log = new Logger('StudentDetectionService');
  private redis!: Redis;

  constructor() {
    this.redis = new Redis(config.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
    this.redis.on('error', (e) => this.log.error(`Redis error: ${e.message}`));
  }

  /* ============ Student Detection ============ */

  async recordStudentLogin(studentId: string, classroomId: string, deviceInfo: {
    hostname: string;
    platform: string;
    ip_address?: string;
    user_agent?: string;
  }, userData: {
    username: string;
    display_name: string;
  }): Promise<void> {
    const studentKey = `student:${studentId}`;
    const classroomKey = `classroom:${classroomId}:students`;
    const activityKey = `student:${studentId}:activities`;

    const detectedStudent: DetectedStudent = {
      id: studentId,
      classroom_id: classroomId,
      username: userData.username,
      display_name: userData.display_name,
      status: 'online',
      device: deviceInfo,
      last_activity: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    };

    // Store student detection data with TTL
    await this.redis.set(
      studentKey,
      JSON.stringify(detectedStudent),
      'EX',
      STUDENT_DETECTION_TTL,
    );

    // Add to classroom student set
    await this.redis.sadd(classroomKey, studentId);

    // Log activity
    await this.logActivity(studentId, 'login', {
      device: deviceInfo,
      classroom_id: classroomId,
    });

    this.log.log(`Student detected: ${userData.username} in classroom ${classroomId}`);
  }

  async recordStudentLogout(studentId: string): Promise<void> {
    const studentKey = `student:${studentId}`;
    await this.redis.del(studentKey);
    await this.logActivity(studentId, 'logout', {});
    this.log.log(`Student logged out: ${studentId}`);
  }

  async updateStudentActivity(studentId: string, activityType: string = 'activity'): Promise<void> {
    const studentKey = `student:${studentId}`;
    const student = await this.getStudent(studentId);

    if (student) {
      student.last_activity = new Date().toISOString();
      student.status = 'online';
      student.last_seen_at = new Date().toISOString();

      await this.redis.set(
        studentKey,
        JSON.stringify(student),
        'EX',
        STUDENT_DETECTION_TTL,
      );

      if (activityType !== 'activity') {
        await this.logActivity(studentId, activityType as any, {});
      }
    }
  }

  async getStudent(studentId: string): Promise<DetectedStudent | null> {
    const data = await this.redis.get(`student:${studentId}`);
    return data ? JSON.parse(data) : null;
  }

  async getStudentsInClassroom(classroomId: string): Promise<DetectedStudent[]> {
    const classroomKey = `classroom:${classroomId}:students`;
    const studentIds = await this.redis.smembers(classroomKey);

    if (studentIds.length === 0) return [];

    const students: DetectedStudent[] = [];
    for (const id of studentIds) {
      const student = await this.getStudent(id);
      if (student) {
        // Update status based on activity
        const timeSinceActivity = Date.now() - new Date(student.last_activity).getTime();
        if (timeSinceActivity > STUDENT_DETECTION_TTL * 1000) {
          student.status = 'offline';
        } else if (timeSinceActivity > 30000) { // 30 seconds
          student.status = 'idle';
        }
        students.push(student);
      } else {
        // Remove from classroom set if data expired
        await this.redis.srem(classroomKey, id);
      }
    }

    return students;
  }

  async getOnlineStudentsInClassroom(classroomId: string): Promise<DetectedStudent[]> {
    const students = await this.getStudentsInClassroom(classroomId);
    return students.filter(s => s.status === 'online');
  }

  async getClassroomStats(classroomId: string): Promise<{
    total: number;
    online: number;
    idle: number;
    offline: number;
    students: DetectedStudent[];
  }> {
    const students = await this.getStudentsInClassroom(classroomId);
    const stats = {
      total: students.length,
      online: students.filter(s => s.status === 'online').length,
      idle: students.filter(s => s.status === 'idle').length,
      offline: students.filter(s => s.status === 'offline').length,
      students,
    };
    return stats;
  }

  /* ============ Activity Logging ============ */

  async logActivity(studentId: string, type: StudentActivity['type'], data?: Record<string, any>): Promise<void> {
    const activityKey = `student:${studentId}:activities`;
    const activity: StudentActivity = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    await this.redis.lpush(
      activityKey,
      JSON.stringify(activity),
    );

    // Keep only recent activities
    await this.redis.ltrim(activityKey, 0, 99);
    await this.redis.expire(activityKey, ACTIVITY_LOG_EXPIRY);
  }

  async getStudentActivities(studentId: string, limit: number = 50): Promise<StudentActivity[]> {
    const activityKey = `student:${studentId}:activities`;
    const activities = await this.redis.lrange(activityKey, 0, limit - 1);
    return activities.map(a => JSON.parse(a));
  }

  /* ============ Classroom Detection ============ */

  async trackClassroomSession(classroomId: string, tutorId: string): Promise<void> {
    const sessionKey = `classroom:${classroomId}:session`;
    const sessionData = {
      tutor_id: tutorId,
      started_at: new Date().toISOString(),
      student_count: 0,
    };
    await this.redis.set(
      sessionKey,
      JSON.stringify(sessionData),
      'EX',
      3600, // 1 hour
    );
  }

  async getClassroomSession(classroomId: string): Promise<any> {
    const sessionKey = `classroom:${classroomId}:session`;
    const data = await this.redis.get(sessionKey);
    return data ? JSON.parse(data) : null;
  }

  async clearClassroomSession(classroomId: string): Promise<void> {
    const classroomKey = `classroom:${classroomId}:students`;
    const sessionKey = `classroom:${classroomId}:session`;
    
    // Clear all students from classroom
    const studentIds = await this.redis.smembers(classroomKey);
    for (const id of studentIds) {
      await this.redis.del(`student:${id}`);
    }
    await this.redis.del(classroomKey);
    await this.redis.del(sessionKey);
  }

  /* ============ Device Detection ============ */

  async getStudentDevices(studentId: string): Promise<DetectedStudent['device'][]> {
    const activityKey = `student:${studentId}:activities`;
    const activities = await this.redis.lrange(activityKey, 0, -1);
    
    const devices = new Map<string, DetectedStudent['device']>();
    for (const activity of activities) {
      const parsed = JSON.parse(activity);
      if (parsed.data?.device) {
        const deviceKey = `${parsed.data.device.hostname}:${parsed.data.device.platform}`;
        devices.set(deviceKey, parsed.data.device);
      }
    }

    return Array.from(devices.values());
  }
}
