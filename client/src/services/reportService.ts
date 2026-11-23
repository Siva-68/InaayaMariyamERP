import { api } from './api';
import type { DashboardMetrics, PeriodType, DailyReportItem } from '../types/report';

export const reportService = {
  async getDashboard(
    period: PeriodType = 'today',
    startDate?: string,
    endDate?: string
  ): Promise<DashboardMetrics> {
    const params = new URLSearchParams();
    params.set('period', period);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const res = await api.get<{ success: boolean; data: DashboardMetrics }>(
      `/reports/dashboard?${params.toString()}`
    );
    return res.data.data;
  },

  async downloadExcel(period: PeriodType = 'today', startDate?: string, endDate?: string): Promise<void> {
    const params = new URLSearchParams();
    params.set('period', period);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const res = await api.get(`/reports/export/excel?${params.toString()}`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hinaya_mariyam_${period}_report.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async downloadPdf(period: PeriodType = 'today', startDate?: string, endDate?: string): Promise<void> {
    const params = new URLSearchParams();
    params.set('period', period);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const res = await api.get(`/reports/export/pdf?${params.toString()}`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hinaya_mariyam_${period}_summary.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async listDailyReports(): Promise<DailyReportItem[]> {
    const res = await api.get<{ success: boolean; data: { reports: DailyReportItem[] } }>(
      '/reports/daily'
    );
    return res.data.data.reports;
  },

  async triggerDailyReport(targetDate?: string, forceRetry: boolean = false): Promise<void> {
    await api.post('/reports/daily/generate', { targetDate, forceRetry });
  },

  async downloadDailyReportPdf(reportId: string, fileName: string = 'daily_report.pdf'): Promise<void> {
    const res = await api.get(`/reports/daily/${reportId}/download`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async retryDailyReportDelivery(reportId: string): Promise<void> {
    await api.post(`/reports/daily/${reportId}/retry`);
  },
};
