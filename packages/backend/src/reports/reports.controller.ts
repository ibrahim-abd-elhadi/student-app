import { Controller, Get, Header, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../common/roles.guard';
import { ReportsService } from './reports.service';
import type { JwtClaims } from '@classroom/shared';

@Controller('sessions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('TUTOR', 'ADMIN')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':id/report.json')
  json(@Req() req: any, @Param('id') id: string) {
    const u = req.user as JwtClaims;
    return this.reports.build(u.classroom_id, id);
  }

  /**
   * Returns the HTML report. The Tutor app loads this in a hidden BrowserWindow
   * and uses Electron's `webContents.print()` for the actual PDF / paper print.
   * Server-side PDF rendering with proper Arabic shaping is heavyweight; the
   * Electron printing pipeline already handles RTL fonts correctly.
   */
  @Get(':id/report.html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async html(@Req() req: any, @Param('id') id: string): Promise<string> {
    const u = req.user as JwtClaims;
    const data = await this.reports.build(u.classroom_id, id);
    return this.reports.buildHtml(data);
  }
}
