import cron from 'node-cron';
import { generateAndDispatchDailyReport } from './reportDeliveryService';
import { logger } from '../utils/logger';

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Initializes the automated daily report scheduler (Default: 9:00 PM Asia/Kolkata).
 * Per Project Brief Section 11:
 * "Automated daily PDF report: default 9:00 PM Asia/Kolkata, configurable."
 */
export function initReportScheduler(): void {
  // Cron expression: At minute 0 past hour 21 (9:00 PM) every day
  const cronExpression = process.env.DAILY_REPORT_CRON || '0 21 * * *';
  const timezone = process.env.DAILY_REPORT_TIMEZONE || 'Asia/Kolkata';

  if (scheduledTask) {
    scheduledTask.stop();
  }

  logger.info(
    `Initializing automated daily report scheduler [Expression: "${cronExpression}", Timezone: ${timezone}]`
  );
  logger.info(
    `Daily report destination recipients: WhatsApp: +91 9698603288, Email: ${process.env.ADMIN_REPORT_EMAIL || 'sivaprakashs127@gmail.com'}`
  );

  scheduledTask = cron.schedule(
    cronExpression,
    async () => {
      logger.info('Triggering scheduled daily business report generation (9:00 PM IST)...');
      try {
        const result = await generateAndDispatchDailyReport(undefined, 'scheduler');
        logger.info('Scheduled daily report successfully compiled and processed', {
          reportDate: result.report.reportDate,
          whatsappStatus: result.whatsappDelivery.status,
          emailStatus: result.emailDelivery.status,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Scheduled daily report execution failed', { error: msg });
      }
    },
    {
      timezone,
    }
  );
}

export function stopReportScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Daily report scheduler stopped');
  }
}
