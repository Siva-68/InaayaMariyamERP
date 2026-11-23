import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  IndianRupee,
  Receipt,
  Banknote,
  Smartphone,
  AlertTriangle,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Calendar,
  Layers,
  Info,
  Clock,
  ArrowUpRight,
  Send,
  Mail,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { reportService } from '../services/reportService';
import type { DashboardMetrics, PeriodType, DailyReportItem } from '../types/report';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [period, setPeriod] = useState<PeriodType>('today');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [showProfitModal, setShowProfitModal] = useState<boolean>(false);

  // Daily Automated Report State (Admin)
  const [dailyReports, setDailyReports] = useState<DailyReportItem[]>([]);
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchDailyReports = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const list = await reportService.listDailyReports();
      setDailyReports(list);
    } catch (err) {
      console.error('Failed to load daily reports', err);
    }
  }, [isAdmin]);

  const handleGenerateDailyReport = async () => {
    if (!confirm("Generate and compile today's official 3-page daily business & inventory report now?")) return;
    setGeneratingReport(true);
    try {
      await reportService.triggerDailyReport(undefined, true);
      await fetchDailyReports();
      alert("Today's 3-page daily executive report compiled successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Report generation failed';
      alert(msg);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleDownloadDailyPdf = async (report: DailyReportItem) => {
    try {
      await reportService.downloadDailyReportPdf(report._id, report.fileName || `daily_report_${report.reportDate}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to download daily report PDF.');
    }
  };

  const handleRetryDelivery = async (reportId: string) => {
    setRetryingId(reportId);
    try {
      await reportService.retryDailyReportDelivery(reportId);
      await fetchDailyReports();
      alert('Report delivery retry processed.');
    } catch (err) {
      console.error(err);
      alert('Failed to retry report delivery.');
    } finally {
      setRetryingId(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchDailyReports();
    }
  }, [isAdmin, fetchDailyReports]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportService.getDashboard(
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined
      );
      setMetrics(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard metrics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      await reportService.downloadExcel(
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined
      );
    } catch (err) {
      console.error(err);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      await reportService.downloadPdf(
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined
      );
    } catch (err) {
      console.error(err);
      alert('Failed to export PDF summary. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const formatCurrency = (val: number | string | null | undefined) => {
    if (val === null || val === undefined) return '₹0.00';
    const num = Number(val || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header & Actions ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-primary-light shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="text-primary" size={26} />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Business Intelligence Dashboard
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time financial performance, collections, stock health, and sales analytics (Asia/Kolkata).
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchMetrics()}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-medium rounded-xl flex items-center gap-1.5 transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting !== null || loading}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs sm:text-sm font-medium rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={16} className="text-emerald-700" />
            <span>{exporting === 'excel' ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={exporting !== null || loading}
            className="px-3 py-2 bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-medium rounded-xl flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            <FileText size={16} />
            <span>{exporting === 'pdf' ? 'Generating...' : 'Summary PDF'}</span>
          </button>
        </div>
      </div>

      {/* ── Period Selector Controls ───────────────────────────── */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Period tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-gray-100 rounded-xl">
          {(
            [
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'custom', label: 'Custom Range' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key)}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                period === t.key
                  ? 'bg-white text-primary shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Custom date range picker */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent border-0 text-xs focus:ring-0 text-gray-700"
              />
              <span className="text-gray-400 font-semibold">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent border-0 text-xs focus:ring-0 text-gray-700"
              />
            </div>
            <button
              onClick={() => fetchMetrics()}
              className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors"
            >
              Apply
            </button>
          </div>
        )}

        {/* Active period label */}
        {metrics && (
          <div className="text-xs text-gray-500 font-medium self-end lg:self-center">
            Reporting: <span className="text-gray-800 font-semibold">{metrics.period}</span> ({metrics.startDate} to {metrics.endDate})
          </div>
        )}
      </div>

      {/* ── Error Banner ───────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchMetrics()}
            className="text-xs font-bold underline hover:text-red-900 ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading Skeleton ───────────────────────────────────── */}
      {loading && !metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-2xl"></div>
          ))}
        </div>
      )}

      {/* ── Metrics Content ────────────────────────────────────── */}
      {metrics && (
        <>
          {/* 1. Main KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Sales (Invoiced) */}
            <div className="bg-white p-5 rounded-2xl border border-primary-light shadow-sm relative overflow-hidden group hover:border-primary transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Total Invoiced Sales
                </span>
                <div className="w-8 h-8 rounded-xl bg-primary-light flex items-center justify-center text-primary">
                  <Receipt size={18} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {formatCurrency(metrics.summary.totalSales)}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                  <span>{metrics.summary.invoiceCount} invoices generated</span>
                  <span className="font-medium text-emerald-600">Gross (Inc. GST)</span>
                </div>
              </div>
            </div>

            {/* Card 2: Actual Collections (Physical Cash + UPI) */}
            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Total Collections
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <IndianRupee size={18} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {formatCurrency(metrics.summary.totalCollected)}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                  <span>Cash: {formatCurrency(metrics.summary.cashCollected)}</span>
                  <span>UPI: {formatCurrency(metrics.summary.upiCollected)}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Outstanding Receivables */}
            <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Outstanding Receivables
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock size={18} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-800 tracking-tight">
                  {formatCurrency(metrics.summary.outstandingAmount)}
                </div>
                <div className="text-xs text-amber-600 mt-1 font-medium">
                  {Number(metrics.summary.outstandingAmount) > 0
                    ? 'Pending collection from customers'
                    : 'All period bills fully paid'}
                </div>
              </div>
            </div>

            {/* Card 4: Estimated Gross Profit (Admin) or GST (Non-admin) */}
            {metrics.summary.canViewProfit ? (
              <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                      Estimated Gross Profit
                    </span>
                    <button
                      onClick={() => setShowProfitModal(true)}
                      className="text-gray-400 hover:text-emerald-700"
                      title="Accounting Formula"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">
                    {formatCurrency(metrics.summary.estimatedGrossProfit)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <span>Margin: {metrics.summary.profitMarginPercent}%</span>
                    <span className="text-emerald-600 font-medium">Taxable - COGS</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    GST Remittance
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
                    <Receipt size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                    {formatCurrency(
                      Number(metrics.summary.totalCgst) + Number(metrics.summary.totalSgst)
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <span>CGST: {formatCurrency(metrics.summary.totalCgst)}</span>
                    <span>SGST: {formatCurrency(metrics.summary.totalSgst)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Secondary Mini KPI Row: Cash In Drawer vs UPI vs Taxable */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Banknote size={20} />
              </div>
              <div>
                <div className="text-xs text-emerald-800 font-semibold uppercase">Physical Cash In Drawer</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(metrics.summary.cashCollected)}</div>
              </div>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Smartphone size={20} />
              </div>
              <div>
                <div className="text-xs text-blue-800 font-semibold uppercase">Digital UPI QR / Bank</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(metrics.summary.upiCollected)}</div>
              </div>
            </div>

            <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <div className="text-xs text-purple-800 font-semibold uppercase">Taxable Sales (Net)</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(metrics.summary.taxableSales)}</div>
              </div>
            </div>
          </div>

          {/* 3. Recharts Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales & Collections Trend Chart (2 columns wide) */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Sales & Collections Trend</h3>
                  <p className="text-xs text-gray-500">
                    Invoiced Sales vs Cash/UPI Collected over {metrics.period.toLowerCase()}
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                {metrics.charts.trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={metrics.charts.trend}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2E8B57" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#2E8B57" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorColl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="label" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                      <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} />
                      <Tooltip
                        formatter={(val: unknown) => [formatCurrency(val as number), '']}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #E5E7EB',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        name="Invoiced Sales"
                        stroke="#2E8B57"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorSales)"
                      />
                      <Area
                        type="monotone"
                        dataKey="collections"
                        name="Collections"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorColl)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">
                    No trend records available for this range.
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method Breakdown Donut Chart */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Payment Breakdown</h3>
                <p className="text-xs text-gray-500">Tender mix: Cash vs UPI vs Outstanding</p>
              </div>

              <div className="h-56 w-full my-auto">
                {metrics.charts.paymentBreakdown.some((p) => p.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.charts.paymentBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {metrics.charts.paymentBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: unknown) => [formatCurrency(val as number), '']}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #E5E7EB',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">
                    No payment tender data recorded yet.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 grid grid-cols-3 text-center text-xs">
                <div>
                  <span className="text-gray-400 block">Cash</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(metrics.summary.cashCollected)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">UPI</span>
                  <span className="font-bold text-blue-700">
                    {formatCurrency(metrics.summary.upiCollected)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">Pending</span>
                  <span className="font-bold text-amber-700">
                    {formatCurrency(metrics.summary.outstandingAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Top Selling Products & Inventory Alerts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products Table & Bar Chart */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Top Selling Products</h3>
                    <p className="text-xs text-gray-500">Highest volume items sold in selected period</p>
                  </div>
                  <Link
                    to="/products"
                    className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1"
                  >
                    All Products <ArrowUpRight size={14} />
                  </Link>
                </div>

                {metrics.topProducts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider">
                          <th className="pb-2 font-semibold">#</th>
                          <th className="pb-2 font-semibold">Product Name</th>
                          <th className="pb-2 font-semibold text-center">Qty Sold</th>
                          <th className="pb-2 font-semibold text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {metrics.topProducts.slice(0, 5).map((p, idx) => (
                          <tr key={p.productId} className="hover:bg-gray-50/80">
                            <td className="py-2.5 font-bold text-gray-400">{idx + 1}</td>
                            <td className="py-2.5 font-medium text-gray-900">
                              {p.name}
                              <span className="text-gray-400 text-[10px] block font-normal">
                                {p.unit}
                              </span>
                            </td>
                            <td className="py-2.5 text-center font-bold text-primary">
                              {p.quantitySold}
                            </td>
                            <td className="py-2.5 text-right font-bold text-gray-900">
                              {formatCurrency(p.totalRevenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-gray-400">
                    No product sales recorded in this period.
                  </div>
                )}
              </div>

              {/* Category Sales Bar Chart */}
              {metrics.charts.categorySales.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-600 block mb-2">
                    Category Distribution
                  </span>
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.charts.categorySales} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F9FAFB" />
                        <XAxis dataKey="category" fontSize={10} tickLine={false} stroke="#9CA3AF" />
                        <YAxis fontSize={10} tickLine={false} stroke="#9CA3AF" />
                        <Tooltip
                          formatter={(val: unknown) => [formatCurrency(val as number), 'Sales']}
                          contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                        />
                        <Bar dataKey="sales" fill="#2E8B57" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Inventory Alerts & Stock Health */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Inventory Health Alerts</h3>
                      <p className="text-xs text-gray-500">Items at or below restocking alert levels</p>
                    </div>
                  </div>
                  <Link
                    to="/products"
                    className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1"
                  >
                    Restock <ArrowUpRight size={14} />
                  </Link>
                </div>

                {metrics.inventoryAlerts.lowStockProducts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider">
                          <th className="pb-2 font-semibold">Product</th>
                          <th className="pb-2 font-semibold">Category</th>
                          <th className="pb-2 font-semibold text-center">Remaining</th>
                          <th className="pb-2 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {metrics.inventoryAlerts.lowStockProducts.slice(0, 6).map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/80">
                            <td className="py-2.5 font-medium text-gray-900">{item.name}</td>
                            <td className="py-2.5 text-gray-500">{item.category}</td>
                            <td className="py-2.5 text-center font-bold">
                              <span
                                className={
                                  item.stock <= 0
                                    ? 'text-red-600'
                                    : 'text-amber-600'
                                }
                              >
                                {item.stock} {item.unit}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-bold">
                              {item.stock <= 0 ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">
                                  Out of Stock
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                                  Low Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-emerald-600 bg-emerald-50/50 rounded-xl">
                    ✓ All inventory items are adequately stocked above alert thresholds.
                  </div>
                )}
              </div>

              {/* Stock Value Summary Bar */}
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-400 block">Active Products</span>
                  <span className="font-bold text-gray-800">
                    {metrics.inventoryAlerts.totalActiveProducts} items
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">Retail Valuation</span>
                  <span className="font-bold text-emerald-800">
                    {formatCurrency(metrics.inventoryAlerts.totalStockRetailValue)}
                  </span>
                </div>
                {isAdmin && metrics.inventoryAlerts.totalStockCostValue && (
                  <div>
                    <span className="text-gray-400 block">Cost Valuation (Admin)</span>
                    <span className="font-bold text-gray-700">
                      {formatCurrency(metrics.inventoryAlerts.totalStockCostValue)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Phase 6: Automated Daily 9:00 PM Reports & Delivery Section (Admin) */}
          {isAdmin && (
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary-light text-primary flex items-center justify-center">
                      <Clock size={18} />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">
                      Automated Daily 9:00 PM IST Reports &amp; Delivery
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Official 3-page comprehensive report (Page 1: Sales &amp; Charts, Page 2: Full Inventory Directory, Page 3: Stock-In &amp; Alerts).
                  </p>
                </div>

                <button
                  onClick={handleGenerateDailyReport}
                  disabled={generatingReport}
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 shrink-0"
                >
                  <Send size={15} />
                  <span>{generatingReport ? 'Compiling 3-Page PDF...' : "Generate Today's Report Now"}</span>
                </button>
              </div>

              {/* Delivery Destination Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    WA
                  </div>
                  <div>
                    <span className="font-semibold text-gray-800 block">WhatsApp Cloud API Recipient</span>
                    <span className="text-gray-500 font-mono">+91 9698603288</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Mail size={14} />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-800 block">Admin Email Recipient</span>
                    <span className="text-gray-500 font-mono">9698603288@gmail.com</span>
                  </div>
                </div>
              </div>

              {/* Daily Reports History Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider">
                      <th className="pb-2 font-semibold">Report Date</th>
                      <th className="pb-2 font-semibold">Invoiced Sales</th>
                      <th className="pb-2 font-semibold">Collections</th>
                      <th className="pb-2 font-semibold text-center">WhatsApp</th>
                      <th className="pb-2 font-semibold text-center">Email</th>
                      <th className="pb-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dailyReports.length > 0 ? (
                      dailyReports.map((rep) => (
                        <tr key={rep._id} className="hover:bg-gray-50/80">
                          <td className="py-2.5 font-bold text-gray-900">
                            {rep.reportDate}
                            <span className="text-gray-400 text-[10px] block font-normal">
                              {rep.triggeredBy === 'scheduler' ? 'Automated 9:00 PM' : 'Manual Trigger'}
                            </span>
                          </td>
                          <td className="py-2.5 font-semibold text-gray-800">
                            {formatCurrency(rep.summarySnapshot?.totalSales)}
                          </td>
                          <td className="py-2.5 font-semibold text-emerald-700">
                            {formatCurrency(rep.summarySnapshot?.totalCollected)}
                          </td>
                          <td className="py-2.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                rep.whatsappDelivery?.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rep.whatsappDelivery?.status === 'disabled'
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {rep.whatsappDelivery?.status || 'disabled'}
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                rep.emailDelivery?.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rep.emailDelivery?.status === 'disabled'
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {rep.emailDelivery?.status || 'disabled'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right space-x-1.5">
                            <button
                              onClick={() => handleDownloadDailyPdf(rep)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1"
                              title="Download 3-Page A4 PDF"
                            >
                              <Download size={13} />
                              <span>PDF</span>
                            </button>
                            <button
                              onClick={() => handleRetryDelivery(rep._id)}
                              disabled={retryingId === rep._id}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                              title="Retry WhatsApp / Email Dispatch"
                            >
                              <RefreshCw size={12} className={retryingId === rep._id ? 'animate-spin' : ''} />
                              <span>Retry</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                          No daily reports generated yet. Click "Generate Today's Report Now" or wait for scheduled 9:00 PM IST delivery.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Profit Accounting Formula Modal ────────────────────── */}
      {showProfitModal && metrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-6 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Info size={20} />
                <span>Gross Profit Accounting Method</span>
              </div>
              <button
                onClick={() => setShowProfitModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              {metrics.summary.profitMethodDocumentation}
            </p>

            <div className="bg-gray-50 p-3 rounded-xl text-xs space-y-1.5 font-mono text-gray-700">
              <div className="flex justify-between">
                <span>Taxable Sales (Net):</span>
                <span className="font-bold">{formatCurrency(metrics.summary.taxableSales)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>- Cost of Goods Sold (COGS):</span>
                <span className="font-bold">{formatCurrency(metrics.summary.totalCostOfGoodsSold)}</span>
              </div>
              <div className="border-t border-gray-200 pt-1 flex justify-between text-emerald-700 font-bold">
                <span>= Estimated Gross Profit:</span>
                <span>{formatCurrency(metrics.summary.estimatedGrossProfit)}</span>
              </div>
            </div>

            <div className="text-[11px] text-gray-400 italic">
              Strictly confidential: Only administrators have permission to view purchase costs and profit metrics.
            </div>

            <button
              onClick={() => setShowProfitModal(false)}
              className="w-full py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
