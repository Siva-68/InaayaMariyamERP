import { Request, Response, NextFunction } from 'express';
import { getDashboardMetrics } from '../services/reportService';
import { exportExcelReport, exportPdfSummary } from '../services/reportExportService';
import { logger } from '../utils/logger';

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const period = (req.query.period as 'today' | 'yesterday' | 'week' | 'month' | 'custom') || 'today';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const metrics = await getDashboardMetrics(
      period,
      startDate,
      endDate,
      req.session.role
    );

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    logger.error('Error fetching dashboard metrics', { error: err });
    next(err);
  }
}

export async function exportExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const period = (req.query.period as 'today' | 'yesterday' | 'week' | 'month' | 'custom') || 'today';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const metrics = await getDashboardMetrics(
      period,
      startDate,
      endDate,
      req.session.role
    );

    const buffer = await exportExcelReport(metrics);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="hinaya_mariyam_${period}_report.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    logger.error('Error exporting Excel report', { error: err });
    next(err);
  }
}

export async function exportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const period = (req.query.period as 'today' | 'yesterday' | 'week' | 'month' | 'custom') || 'today';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const metrics = await getDashboardMetrics(
      period,
      startDate,
      endDate,
      req.session.role
    );

    const doc = exportPdfSummary(metrics);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="hinaya_mariyam_${period}_summary.pdf"`
    );

    doc.pipe(res);
    doc.end();
  } catch (err) {
    logger.error('Error exporting PDF report', { error: err });
    next(err);
  }
}

export async function listDailyReports(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { DailyReport } = await import('../models/DailyReport');
    const reports = await DailyReport.find().sort({ reportDate: -1 }).limit(30).lean();

    res.status(200).json({
      success: true,
      data: { reports },
    });
  } catch (err) {
    logger.error('Error listing daily reports', { error: err });
    next(err);
  }
}

export async function triggerDailyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { generateAndDispatchDailyReport } = await import('../services/reportDeliveryService');
    const { targetDate, forceRetry } = req.body || {};

    const result = await generateAndDispatchDailyReport(
      targetDate,
      'manual',
      req.session.userId,
      Boolean(forceRetry)
    );

    res.status(201).json({
      success: true,
      data: result,
      message: `Daily report for ${result.report.reportDate} generated and processed successfully`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Report generation failed';
    logger.error('Manual daily report generation failed', { error: msg });
    res.status(400).json({
      success: false,
      error: { message: msg },
    });
  }
}

export async function downloadDailyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const fs = await import('fs');
    const { DailyReport } = await import('../models/DailyReport');
    const report = await DailyReport.findById(req.params.id);

    if (!report || !report.filePath || !fs.existsSync(report.filePath)) {
      res.status(404).json({
        success: false,
        error: { message: 'Report PDF file not found on server' },
      });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName || 'daily_report.pdf'}"`);
    fs.createReadStream(report.filePath).pipe(res);
  } catch (err) {
    logger.error('Error downloading daily report PDF', { error: err });
    next(err);
  }
}

export async function retryDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const fs = await import('fs');
    const { DailyReport } = await import('../models/DailyReport');
    const { sendReportViaWhatsApp, sendReportViaEmail } = await import('../services/reportDeliveryService');

    const report = await DailyReport.findById(req.params.id);
    if (!report || !report.filePath || !fs.existsSync(report.filePath)) {
      res.status(404).json({
        success: false,
        error: { message: 'Report file not found to retry delivery' },
      });
      return;
    }

    const pdfBuffer = fs.readFileSync(report.filePath);
    const fileName = report.fileName || `hinaya_mariyam_daily_report_${report.reportDate}.pdf`;

    const [whatsappLog, emailLog] = await Promise.all([
      sendReportViaWhatsApp(pdfBuffer, fileName),
      sendReportViaEmail(pdfBuffer, fileName),
    ]);

    report.whatsappDelivery = whatsappLog;
    report.emailDelivery = emailLog;
    report.retries += 1;
    await report.save();

    res.status(200).json({
      success: true,
      data: {
        report,
        whatsappDelivery: whatsappLog,
        emailDelivery: emailLog,
      },
    });
  } catch (err) {
    logger.error('Error retrying report delivery', { error: err });
    next(err);
  }
}
