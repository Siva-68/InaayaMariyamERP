import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  Download,
  Share2,
  Eye,
  IndianRupee,
  CheckCircle2,
  Clock,
  X,
  CreditCard,
  Banknote,
  Split,
  Calendar,
  Printer,
  Send,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { invoiceService } from '../services/invoiceService';
import { api } from '../services/api';
import type { Invoice } from '../types/invoice';

export default function PastInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'outstanding'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<Invoice | null>(null);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter === 'outstanding') params.hasOutstanding = 'true';
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const data = await invoiceService.listInvoices(params);
      setInvoices(data.invoices);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load past invoices');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, fromDate, toDate]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Financial summary metrics
  const summaryMetrics = useMemo(() => {
    let totalSales = new Decimal(0);
    let totalOutstanding = new Decimal(0);

    invoices.forEach((inv) => {
      totalSales = totalSales.plus(inv.grandTotal);
      totalOutstanding = totalOutstanding.plus(inv.outstandingAmount);
    });

    return {
      count: invoices.length,
      totalSales: totalSales.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
    };
  }, [invoices]);

// Quick Action: Download PDF
  const handleDownloadPdf = (invoiceId: string, invoiceNumber: string, font: string = 'times') => {
    const url = `/api/invoices/${invoiceId}/pdf?font=${font}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = `Invoice_${invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Action: Share on WhatsApp
  const handleShareWhatsApp = (invoice: Invoice, recipient: 'customer' | 'admin' = 'customer') => {
    const pdfUrl = `${window.location.origin}/api/invoices/${invoice._id}/pdf`;
    const text = `*INAAYA ENTERPRISES - TAX INVOICE*\n` +
      `38/185, Pattali Street East , Adivaram , Sivagiripatti , Dindigul , Tamil Nadu - 624601\n` +
      `Mobile: +91 9597038755 , 7010760392 | GSTIN: 33BEWPA6233E1ZO\n\n` +
      `Invoice: ${invoice.invoiceNumber}\n` +
      `Date: ${new Date(invoice.invoicedAt).toLocaleDateString('en-IN')}\n` +
      `Customer: ${invoice.customerName} (+91 ${invoice.customerMobile})\n` +
      `Items:\n${invoice.lines.map((l) => `• ${l.productName} (${l.gstRate}%) x ${l.quantity} = ₹${l.lineTotal}`).join('\n')}\n\n` +
      `Taxable Subtotal: ₹${invoice.subtotalTaxable}\n` +
      `CGST: ₹${invoice.totalCgst} | SGST: ₹${invoice.totalSgst}\n` +
      `*Total: ₹${invoice.grandTotal}*\n` +
      `Paid: ₹${invoice.amountPaid} | Balance Due: ₹${invoice.outstandingAmount}\n\n` +
      `📥 *Download Official A4 Tax PDF:* ${pdfUrl}\n\n` +
      `Thank you for choosing INAAYA ENTERPRISES! Your support means a lot to us.`;

    const targetPhone = recipient === 'admin' ? '919597038755' : (invoice.customerMobile ? `91${invoice.customerMobile}` : '');
    const waUrl = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="text-primary" size={24} />
            Past Invoices &amp; Receipts
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Immutable invoice archive, A4 PDF generation, print and WhatsApp sharing
          </p>
        </div>
      </div>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-primary-light shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Invoices
            </span>
            <div className="text-2xl font-extrabold text-gray-900 mt-1">{summaryMetrics.count}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center font-bold">
            <ClipboardList size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-primary-light shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="text-2xl font-extrabold text-primary mt-1">₹{summaryMetrics.totalSales}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <IndianRupee size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-primary-light shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Outstanding Balance
            </span>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              ₹{summaryMetrics.totalOutstanding}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-primary-light shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by invoice #, customer name, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'outstanding')}
              className="bg-transparent focus:outline-none text-sm cursor-pointer"
            >
              <option value="all">All Invoices</option>
              <option value="paid">Fully Paid</option>
              <option value="outstanding">Outstanding Due</option>
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1 text-xs text-gray-700">
            <Calendar size={14} className="text-gray-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent focus:outline-none text-xs"
              placeholder="From"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent focus:outline-none text-xs"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchInvoices} className="underline text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* Invoices List / Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading invoices...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-primary-light p-12 text-center">
          <ClipboardList className="mx-auto text-gray-300 mb-3" size={48} />
          <h3 className="text-base font-semibold text-gray-700">No Invoices Found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'all' || fromDate || toDate
              ? 'Try clearing your search or date filters'
              : 'Create your first bill from the New Bill screen!'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-primary-light shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-primary-light/40 border-b border-primary-light text-xs font-semibold text-gray-700 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => {
                  const outstanding = parseFloat(inv.outstandingAmount);
                  const isPaid = outstanding <= 0;

                  return (
                    <tr key={inv._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-900 font-mono text-xs">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-xs">
                        {new Date(inv.invoicedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-sm text-gray-900">{inv.customerName}</div>
                        {inv.customerMobile && (
                          <div className="text-xs text-gray-400 font-mono">+91 {inv.customerMobile}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-600 font-medium">
                        {inv.lines.length} items
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-gray-900">
                        ₹{parseFloat(inv.grandTotal).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isPaid ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                          {isPaid ? 'Paid' : `Due: ₹${outstanding.toFixed(2)}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            title="View Invoice Details"
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          >
                            <Eye size={17} />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(inv._id, inv.invoiceNumber)}
                            title="Download A4 PDF"
                            className="p-1.5 text-primary hover:bg-primary-light rounded-lg transition"
                          >
                            <Download size={17} />
                          </button>
                          <button
                            onClick={() => handleShareWhatsApp(inv)}
                            title="Share on WhatsApp"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          >
                            <Share2 size={17} />
                          </button>
                          {!isPaid && (
                            <button
                              onClick={() => setPaymentTargetInvoice(inv)}
                              title="Collect Outstanding Payment"
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition"
                            >
                              Collect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-gray-100">
            {invoices.map((inv) => {
              const outstanding = parseFloat(inv.outstandingAmount);
              const isPaid = outstanding <= 0;

              return (
                <div key={inv._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs font-bold text-primary">{inv.invoiceNumber}</div>
                      <div className="font-semibold text-sm text-gray-900 mt-0.5">{inv.customerName}</div>
                      <div className="text-[11px] text-gray-400">
                        {new Date(inv.invoicedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-extrabold text-base text-gray-900">
                        ₹{parseFloat(inv.grandTotal).toFixed(2)}
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold mt-1 ${
                          isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {isPaid ? 'Paid' : `Due ₹${outstanding.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="flex-1 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg flex items-center justify-center gap-1 min-h-touch"
                    >
                      <Eye size={14} />
                      View
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(inv._id, inv.invoiceNumber)}
                      className="flex-1 py-1.5 bg-primary-light text-primary text-xs font-medium rounded-lg flex items-center justify-center gap-1 min-h-touch"
                    >
                      <Download size={14} />
                      PDF
                    </button>
                    <button
                      onClick={() => handleShareWhatsApp(inv)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg min-h-touch"
                      title="WhatsApp"
                    >
                      <Share2 size={16} />
                    </button>
                    {!isPaid && (
                      <button
                        onClick={() => setPaymentTargetInvoice(inv)}
                        className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold min-h-touch"
                      >
                        Collect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Invoice Detail Modal (Read-Only) ───────────────────────── */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onDownloadPdf={(font?: string) => handleDownloadPdf(selectedInvoice._id, selectedInvoice.invoiceNumber, font)}
          onShareAdmin={() => handleShareWhatsApp(selectedInvoice, 'admin')}
          onShareCustomer={() => handleShareWhatsApp(selectedInvoice, 'customer')}
        />
      )}

      {/* ── Collect Payment Modal ─────────────────────────────────── */}
      {paymentTargetInvoice && (
        <CollectPaymentModal
          invoice={paymentTargetInvoice}
          onClose={() => setPaymentTargetInvoice(null)}
          onSuccess={() => {
            setPaymentTargetInvoice(null);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}

// ── Modals ──────────────────────────────────────────────────

function InvoiceDetailModal({
  invoice,
  onClose,
  onDownloadPdf,
  onShareAdmin,
  onShareCustomer,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDownloadPdf: (font?: string) => void;
  onShareAdmin: () => void;
  onShareCustomer: () => void;
}) {
  const [modalFont, setModalFont] = useState<'times' | 'sans' | 'georgia' | 'courier'>('times');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header (No-print) */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-primary-light/30 no-print">
          <div>
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
              Bill / Invoice Details
            </span>
            <h3 className="text-lg font-extrabold text-gray-900 mt-0.5">{invoice.invoiceNumber}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Font Style Selection Toolbar */}
        <div className="px-5 pt-3 pb-0 no-print">
          <div className="bg-gray-50 border border-gray-200 p-2 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <span className="text-sm">🔤</span>
              <span>Invoice Font Style:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setModalFont('times')}
                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all ${
                  modalFont === 'times'
                    ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30 font-bold'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
                title="Times New Roman (Formal Tax Invoice Serif)"
              >
                <span className="font-serif font-bold">Times New Roman</span>
              </button>
              <button
                type="button"
                onClick={() => setModalFont('sans')}
                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all ${
                  modalFont === 'sans'
                    ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30 font-bold'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
                title="Modern Clean Sans (Inter / Arial)"
              >
                <span className="font-sans font-semibold">Modern Sans</span>
              </button>
              <button
                type="button"
                onClick={() => setModalFont('georgia')}
                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all ${
                  modalFont === 'georgia'
                    ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30 font-bold'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
                title="Georgia Editorial Serif"
              >
                <span className="font-georgia font-semibold">Georgia</span>
              </button>
              <button
                type="button"
                onClick={() => setModalFont('courier')}
                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all ${
                  modalFont === 'courier'
                    ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30 font-bold'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
                title="Courier New (Thermal POS Monospace)"
              >
                <span className="font-mono font-semibold">Courier POS</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body / Printable Receipt (Exact Handwritten Diagram Layout) */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
          <div
            className={`printable-receipt p-6 border-2 border-dashed border-gray-300 rounded-2xl bg-white text-gray-900 ${
              modalFont === 'times'
                ? 'font-times'
                : modalFont === 'sans'
                ? 'font-modern-sans'
                : modalFont === 'georgia'
                ? 'font-georgia'
                : 'font-courier'
            } text-xs space-y-4`}
          >
            {/* Header: Shop Name & Address */}
            <div className="text-center space-y-1 pb-2 border-b border-gray-200">
              <div className="text-xl font-bold tracking-tight text-primary">INAAYA ENTERPRISES</div>
              <div className="text-[11px] text-gray-600">
                38/185, Pattali Street East , Adivaram , Sivagiripatti , Dindigul , Tamil Nadu - 624601
              </div>
            </div>

            {/* Line 1: Mobile No (Left) | GSTIN (Right) */}
            <div className="flex justify-between items-center text-[11px] font-semibold">
              <span>Mobile No : 9597038755 , 7010760392</span>
              <span>GSTIN : 33BEWPA6233E1ZO</span>
            </div>

            {/* Line 2: Customer Name (Left) | Customer MobileNum (Right) */}
            <div className="flex justify-between items-center text-[11px] font-bold text-emerald-800">
              <span>Customer Name : {invoice.customerName}</span>
              <span>Customer MobileNum : +91 {invoice.customerMobile}</span>
            </div>

            {/* Line 3: Invoice Number (Left) | Date (Right) */}
            <div className="flex justify-between items-center text-[10px] text-gray-500 pb-2 border-b border-gray-200">
              <span>Invoice No : {invoice.invoiceNumber}</span>
              <span>
                Date :{' '}
                {new Date(invoice.invoicedAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {/* Table: S.No | Description | GST % | Quantity | Price */}
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b-2 border-gray-300 text-gray-600 uppercase">
                  <th className="py-1.5 w-10">S.No</th>
                  <th className="py-1.5">Description</th>
                  <th className="py-1.5 text-center w-16">GST %</th>
                  <th className="py-1.5 text-center w-20">Quantity</th>
                  <th className="py-1.5 text-right w-20">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.lines.map((l, idx) => (
                  <tr key={idx}>
                    <td className="py-2 text-gray-500">{idx + 1}</td>
                    <td className="py-2 font-semibold text-gray-900">{l.productName}</td>
                    <td className="py-2 text-center text-xs font-semibold text-primary">{l.gstRate}%</td>
                    <td className="py-2 text-center">
                      {l.quantity} {l.unit}
                    </td>
                    <td className="py-2 text-right font-semibold">₹{Number(l.lineTotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary Under Table on Right: CGST | SGST | Total */}
            <div className="pt-2 border-t border-gray-200 flex justify-end">
              <div className="w-64 space-y-1.5 text-right text-[11px]">
                <div className="flex justify-between text-gray-600">
                  <span>Taxable Subtotal:</span>
                  <span>₹{invoice.subtotalTaxable}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total CGST:</span>
                  <span>₹{invoice.totalCgst}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total SGST:</span>
                  <span>₹{invoice.totalSgst}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-gray-900 pt-1 border-t border-gray-300">
                  <span>Total:</span>
                  <span className="text-primary font-extrabold text-base">₹{invoice.grandTotal}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-[10px]">
                  <span>Amount Paid:</span>
                  <span className="text-emerald-700 font-semibold">₹{invoice.amountPaid}</span>
                </div>
                {parseFloat(invoice.outstandingAmount) > 0 && (
                  <div className="flex justify-between text-red-600 font-semibold text-[10px]">
                    <span>Balance Due:</span>
                    <span>₹{invoice.outstandingAmount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Appreciation Message */}
            <div className="pt-3 border-t border-gray-200 text-center">
              <div className="text-[10px] text-gray-600 italic">
                “Thank you for choosing INAAYA ENTERPRISES! Your support means a lot to us. We look forward to serving you again.”
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions (No-print) */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 no-print">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl min-h-touch"
            >
              Close
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm min-h-touch"
            >
              <Printer size={15} />
              <span>Print Receipt</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onShareAdmin}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm min-h-touch"
              title="Send to Admin (+91 9597038755)"
            >
              <Send size={14} />
              <span>Admin WA</span>
            </button>
            <button
              onClick={onShareCustomer}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-touch"
              title="Send to Customer"
            >
              <Share2 size={14} />
              <span>Customer WA</span>
            </button>
            <button
              onClick={() => {
                const pdfFont = modalFont === 'courier' ? 'courier' : modalFont === 'sans' ? 'helvetica' : 'times';
                onDownloadPdf(pdfFont);
              }}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm min-h-touch"
            >
              <Download size={14} />
              <span>A4 PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollectPaymentModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState<'cash' | 'upi' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState(invoice.outstandingAmount);
  const [upiAmount, setUpiAmount] = useState('0.00');
  const [upiReference, setUpiReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await api.post(`/invoices/${invoice._id}/payments`, {
        method,
        cashAmount: method === 'upi' ? '0.00' : cashAmount,
        upiAmount: method === 'cash' ? '0.00' : upiAmount,
        upiReference: upiReference || null,
      });
      onSuccess();
    } catch (error: unknown) {
      setErr((error as Error).message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-base text-gray-800">Collect Outstanding Payment</h3>
            <p className="text-xs text-primary font-medium">Invoice: {invoice.invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {err && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl">{err}</div>}

        <div className="p-3 bg-amber-50 rounded-xl text-amber-800 text-xs flex justify-between font-semibold">
          <span>Current Balance Due:</span>
          <span className="font-bold text-sm">₹{invoice.outstandingAmount}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
          {/* Method Selector */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setMethod('cash');
                setCashAmount(invoice.outstandingAmount);
                setUpiAmount('0.00');
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                method === 'cash'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <Banknote size={15} />
              Cash
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('upi');
                setUpiAmount(invoice.outstandingAmount);
                setCashAmount('0.00');
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                method === 'upi'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <CreditCard size={15} />
              UPI
            </button>
            <button
              type="button"
              onClick={() => setMethod('split')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                method === 'split'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <Split size={15} />
              Split
            </button>
          </div>

          {method === 'split' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cash Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">UPI Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={upiAmount}
                  onChange={(e) => setUpiAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={method === 'cash' ? cashAmount : upiAmount}
                onChange={(e) =>
                  method === 'cash' ? setCashAmount(e.target.value) : setUpiAmount(e.target.value)
                }
                className="w-full px-3 py-2 border rounded-xl text-base font-bold text-gray-900"
              />
            </div>
          )}

          {method !== 'cash' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">UPI Reference / UTR</label>
              <input
                type="text"
                value={upiReference}
                onChange={(e) => setUpiReference(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs"
                placeholder="e.g. 439019283"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 min-h-touch"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold min-h-touch"
            >
              {submitting ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
