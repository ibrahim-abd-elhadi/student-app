import { Controller, Get, Param, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtGuard } from '../auth/jwt.guard';
import { StudentDetectionService, DetectedStudent } from '../realtime/student-detection.service';
import type { JwtClaims } from '@classroom/shared';

interface AuthRequest extends Request {
  user: JwtClaims;
}

@Controller('api/v1/detection')
@UseGuards(JwtGuard)
export class DetectionController {
  constructor(private readonly detection: StudentDetectionService) {}

  /**
   * Get all detected students in tutor's classroom
   */
  @Get('classroom/students')
  async getClassroomStudents(@Request() req: AuthRequest) {
    const claims = req.user as JwtClaims;
    if (claims.role !== 'TUTOR') {
      return { error: 'Only tutors can access this' };
    }

    const stats = await this.detection.getClassroomStats(claims.classroom_id);
    return {
      classroom_id: claims.classroom_id,
      ...stats,
    };
  }

  /**
   * Get online students only
   */
  @Get('classroom/online')
  async getOnlineStudents(@Request() req: AuthRequest) {
    const claims = req.user as JwtClaims;
    if (claims.role !== 'TUTOR') {
      return { error: 'Only tutors can access this' };
    }

    const students = await this.detection.getOnlineStudentsInClassroom(claims.classroom_id);
    return {
      classroom_id: claims.classroom_id,
      count: students.length,
      students,
    };
  }

  /**
   * Get specific student details and activity
   */
  @Get('student/:studentId')
  async getStudentDetails(
    @Param('studentId') studentId: string,
    @Request() req: AuthRequest,
  ) {
    const claims = req.user as JwtClaims;

    // Only tutors or the student themselves can access
    if (claims.role !== 'TUTOR' && claims.sub !== studentId) {
      return { error: 'Forbidden' };
    }

    const student = await this.detection.getStudent(studentId);
    if (!student) {
      return { error: 'Student not found or offline' };
    }

    const activities = await this.detection.getStudentActivities(studentId, 20);
    const devices = await this.detection.getStudentDevices(studentId);

    return {
      student,
      recent_activities: activities,
      detected_devices: devices,
    };
  }

  /**
   * Get student activity history
   */
  @Get('student/:studentId/activities')
  async getStudentActivities(
    @Param('studentId') studentId: string,
    @Request() req: AuthRequest,
  ) {
    const claims = req.user as JwtClaims;

    // Only tutors or the student themselves can access
    if (claims.role !== 'TUTOR' && claims.sub !== studentId) {
      return { error: 'Forbidden' };
    }

    const activities = await this.detection.getStudentActivities(studentId, 100);
    return {
      student_id: studentId,
      activities,
    };
  }

  /**
   * Get detected devices for a student
   */
  @Get('student/:studentId/devices')
  async getStudentDevices(
    @Param('studentId') studentId: string,
    @Request() req: AuthRequest,
  ) {
    const claims = req.user as JwtClaims;

    // Only tutors or the student themselves can access
    if (claims.role !== 'TUTOR' && claims.sub !== studentId) {
      return { error: 'Forbidden' };
    }

    const devices = await this.detection.getStudentDevices(studentId);
    return {
      student_id: studentId,
      devices,
      device_count: devices.length,
    };
  }

  /**
   * Export classroom detection report (CSV)
   */
  @Get('classroom/export-csv')
  async exportClassroomCsv(
    @Request() req: AuthRequest,
    @Res() res: Response,
  ) {
    const claims = req.user as JwtClaims;
    if (claims.role !== 'TUTOR') {
      res.status(403).json({ error: 'Only tutors can export' });
      return;
    }

    const stats = await this.detection.getClassroomStats(claims.classroom_id);
    
    // Build CSV
    let csv = 'Username,Display Name,Status,Device Hostname,Platform,IP Address,Last Activity\n';
    for (const student of stats.students) {
      csv += `"${student.username}","${student.display_name}","${student.status}","${student.device.hostname}","${student.device.platform}","${student.device.ip_address || 'N/A'}","${student.last_activity}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="classroom-detection-${claims.classroom_id}.csv"`);
    res.send(csv);
  }
}
