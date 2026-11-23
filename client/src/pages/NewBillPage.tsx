import { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Phone,
  CheckCircle2,
  Printer,
  RotateCcw,
  AlertCircle,
  CreditCard,
  Banknote,
  Split,
  Share2,
  Download,
  Send,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { productService } from '../services/productService';
import { invoiceService } from '../services/invoiceService';
import { api } from '../services/api';
import type { Product } from '../types/product';
import type { CartItem, Invoice } from '../types/invoice';

export default function NewBillPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Cart & Customer state
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerHistory, setCustomerHistory] = useState<{
    totalPurchaseAmount: string;
    totalInvoicesCount: number;
  } | null>(null);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [upiAmount, setUpiAmount] = useState<string>('');
  const [upiReference, setUpiReference] = useState<string>('');

  // Submission & Success state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [whatsappAdminUrl, setWhatsappAdminUrl] = useState<string>('');
  const [whatsappCustomerUrl, setWhatsappCustomerUrl] = useState<string>('');
  const [billFontStyle, setBillFontStyle] = useState<'times' | 'sans' | 'georgia' | 'courier'>('times');

  // Load products catalogue
  useEffect(() => {
    productService
      .listProducts({ limit: 100 })
      .then((data) => setProducts(data.products.filter((p) => p.isActive)))
      .catch((err) => console.error('Failed to load products', err));
  }, []);

  // Filtered catalogue for quick add
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sapCode && p.sapCode.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category)));
  }, [products]);

  // Handle Mobile input & Auto-lookup customer profile in separate DB
  const handleMobileChange = async (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setCustomerMobile(digits);

    if (digits.length === 10) {
      setLookingUpCustomer(true);
      try {
        const res = await api.get<{
          success: boolean;
          data: {
            customer: {
              name: string;
              totalPurchaseAmount: string;
              totalInvoicesCount: number;
            } | null;
          };
        }>(`/customers/lookup?mobile=${digits}`);

        if (res.data.data?.customer) {
          setCustomerName(res.data.data.customer.name);
          setCustomerHistory({
            totalPurchaseAmount: res.data.data.customer.totalPurchaseAmount,
            totalInvoicesCount: res.data.data.customer.totalInvoicesCount,
          });
        } else {
          setCustomerHistory(null);
        }
      } catch (err) {
        console.error('Customer lookup error', err);
      } finally {
        setLookingUpCustomer(false);
      }
    } else {
      setCustomerHistory(null);
    }
  };

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product._id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setErrorMessage(`Cannot add more: only ${product.stock} units available in stock.`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      if (product.stock < 1) {
        setErrorMessage(`"${product.name}" is out of stock.`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          unit: product.packType || 'packet',
          sellingPrice: product.sellingPrice,
          gstRate: product.gstRate ?? null,
          quantity: 1,
          availableStock: product.stock,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.availableStock) {
              setErrorMessage(`Cannot exceed available stock of ${item.availableStock} units.`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Safe Financial Calculations (decimal.js)
  const calculations = useMemo(() => {
    let subtotalTaxable = new Decimal(0);
    let totalCgst = new Decimal(0);
    let totalSgst = new Decimal(0);
    let grandTotal = new Decimal(0);
    let hasUnconfirmedGst = false;

    cart.forEach((item) => {
      const unitPrice = new Decimal(item.sellingPrice);
      const qty = new Decimal(item.quantity);
      const lineGross = unitPrice.times(qty);
      grandTotal = grandTotal.plus(lineGross);

      if (item.gstRate === null || item.gstRate === undefined) {
        hasUnconfirmedGst = true;
      } else {
        const gstRateDec = new Decimal(item.gstRate);
        const taxable = lineGross.dividedBy(new Decimal(1).plus(gstRateDec.dividedBy(100)));
        const totalTax = lineGross.minus(taxable);
        const halfTax = totalTax.dividedBy(2);

        subtotalTaxable = subtotalTaxable.plus(taxable);
        totalCgst = totalCgst.plus(halfTax);
        totalSgst = totalSgst.plus(halfTax);
      }
    });

    return {
      subtotalTaxable: subtotalTaxable.toFixed(2),
      totalCgst: totalCgst.toFixed(2),
      totalSgst: totalSgst.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      hasUnconfirmedGst,
    };
  }, [cart]);

  // Sync default cash/upi amount with grand total when cart changes
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setCashAmount(calculations.grandTotal);
      setUpiAmount('0.00');
    } else if (paymentMethod === 'upi') {
      setUpiAmount(calculations.grandTotal);
      setCashAmount('0.00');
    }
  }, [calculations.grandTotal, paymentMethod]);

  const outstandingBalance = useMemo(() => {
    const total = new Decimal(calculations.grandTotal || '0');
    const cash = new Decimal(cashAmount || '0');
    const upi = new Decimal(upiAmount || '0');
    let paid: Decimal;
    if (paymentMethod === 'cash') paid = cash;
    else if (paymentMethod === 'upi') paid = upi;
    else paid = cash.plus(upi);

    const diff = total.minus(paid);
    return diff.greaterThan(0) ? diff.toFixed(2) : '0.00';
  }, [calculations.grandTotal, cashAmount, upiAmount, paymentMethod]);

  // Handle final checkout
  const handleFinalizeBill = async () => {
    setErrorMessage(null);

    if (cart.length === 0) {
      setErrorMessage('Please add at least one product to the cart.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Customer name is mandatory.');
      return;
    }

    // MANDATORY Mobile Number Validation (Strict user requirement)
    const cleanedMobile = customerMobile.trim();
    if (!cleanedMobile || !/^[6-9]\d{9}$/.test(cleanedMobile)) {
      setErrorMessage(
        'Customer mobile number is MANDATORY. Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
      );
      return;
    }

    if (calculations.hasUnconfirmedGst) {
      setErrorMessage(
        'One or more items in the cart do not have a confirmed GST rate. Live billing is blocked until an accountant confirms the tax rate.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();

      const result = await invoiceService.createInvoice({
        idempotencyKey,
        customerName: customerName.trim(),
        customerMobile: cleanedMobile,
        lines: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
        })),
        payment: {
          method: paymentMethod,
          cashAmount: paymentMethod === 'upi' ? '0.00' : cashAmount || '0.00',
          upiAmount: paymentMethod === 'cash' ? '0.00' : upiAmount || '0.00',
          upiReference: upiReference || null,
        },
      });

      setCompletedInvoice(result.invoice);
      setWhatsappAdminUrl(
        result.whatsappAdminUrl ||
          `https://wa.me/919597038755?text=${encodeURIComponent(
            `INAAYA ENTERPRISES Invoice ${result.invoice.invoiceNumber} - Total: ₹${result.invoice.grandTotal}`
          )}`
      );
      setWhatsappCustomerUrl(
        result.whatsappCustomerUrl ||
          `https://wa.me/91${cleanedMobile}?text=${encodeURIComponent(
            `Dear ${customerName}, Thank you for shopping with INAAYA ENTERPRISES! Your invoice ${result.invoice.invoiceNumber} for ₹${result.invoice.grandTotal} has been generated.`
          )}`
      );
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to finalize bill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewBill = () => {
    setCart([]);
    setCustomerName('');
    setCustomerMobile('');
    setCustomerHistory(null);
    setCashAmount('');
    setUpiAmount('');
    setUpiReference('');
    setCompletedInvoice(null);
    setWhatsappAdminUrl('');
    setWhatsappCustomerUrl('');
    setErrorMessage(null);
  };

  const handleDownloadPdf = () => {
    if (!completedInvoice) return;
    const pdfFont = billFontStyle === 'courier' ? 'courier' : billFontStyle === 'sans' ? 'helvetica' : 'times';
    window.open(`/api/invoices/${completedInvoice._id}/pdf?font=${pdfFont}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Receipt className="text-primary" size={28} />
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Point of Sale &amp; New Bill</h2>
            <p className="text-xs text-gray-500">Fast barcode/touch billing with mandatory customer mobile tracking</p>
          </div>
        </div>

        {cart.length > 0 && (
          <button
            onClick={handleStartNewBill}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition min-h-touch"
          >
            <RotateCcw size={15} />
            <span>Reset Cart</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 no-print">
          <AlertCircle size={20} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main 2-column layout: Left (Cart & Customer), Right (Product Catalogue) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">
        {/* Left Column: Customer & Cart (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Customer Details Card (Mandatory Mobile per requirement) */}
          <div className="bg-white p-4 rounded-2xl border border-primary-light shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Customer Details (Mandatory)
              </h3>
              {lookingUpCustomer && (
                <span className="text-[11px] text-primary animate-pulse font-medium">
                  Checking customer database...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mandatory Mobile */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Customer Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={customerMobile}
                    onChange={(e) => handleMobileChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white"
                    placeholder="10-digit Mobile (Mandatory)"
                  />
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:bg-white"
                    placeholder="Name : hinaya"
                  />
                </div>
              </div>
            </div>

            {/* Customer Status Banner */}
            {customerHistory ? (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                <span>
                  ✓ <strong>Returning Customer</strong> • Lifetime Purchases: <strong>₹{customerHistory.totalPurchaseAmount}</strong> ({customerHistory.totalInvoicesCount} past bills)
                </span>
                <span className="text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded-full font-bold">In DB</span>
              </div>
            ) : customerMobile.length === 10 ? (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center justify-between">
                <span>
                  ℹ️ <strong>New Customer</strong>: Will be automatically added to the customer database upon finalizing bill.
                </span>
              </div>
            ) : null}
          </div>

          {/* Active Cart Items */}
          <div className="bg-white p-4 rounded-2xl border border-primary-light shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Cart Items ({cart.length})
              </h3>
              {cart.length > 0 && (
                <span className="text-xs font-bold text-primary">Total: ₹{calculations.grandTotal}</span>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <Receipt className="mx-auto text-gray-300" size={40} />
                <p className="text-sm">Cart is empty. Select items from the catalogue on the right.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
                {cart.map((item) => {
                  const unitPrice = new Decimal(item.sellingPrice);
                  const lineTotal = unitPrice.times(item.quantity).toFixed(2);
                  return (
                    <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-gray-900 truncate">{item.name}</div>
                        <div className="text-xs text-gray-500">
                          ₹{item.sellingPrice} / {item.unit} · GST: {item.gstRate !== null ? `${item.gstRate}%` : 'Unconfirmed'}
                        </div>
                      </div>

                      {/* Touch Quantity Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.productId, -1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center min-h-touch min-w-touch"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="w-8 text-center font-bold text-sm text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, 1)}
                          className="w-8 h-8 rounded-lg bg-primary-light hover:bg-primary/20 text-primary flex items-center justify-center min-h-touch min-w-touch"
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="text-right shrink-0 w-20">
                        <div className="font-bold text-sm text-gray-900">₹{lineTotal}</div>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* GST & Totals Summary Panel */}
          {cart.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-primary-light shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Tax &amp; Bill Breakdown
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Taxable Subtotal:</span>
                  <span className="font-medium">₹{calculations.subtotalTaxable}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-xs">
                  <span>Central GST (CGST):</span>
                  <span>₹{calculations.totalCgst}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-xs">
                  <span>State GST (SGST):</span>
                  <span>₹{calculations.totalSgst}</span>
                </div>

                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                  <span className="font-bold text-base text-gray-900">Grand Total:</span>
                  <span className="font-extrabold text-2xl text-primary">
                    ₹{calculations.grandTotal}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <label className="block text-xs font-semibold text-gray-600">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition min-h-touch ${
                      paymentMethod === 'cash'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Banknote size={16} />
                    Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition min-h-touch ${
                      paymentMethod === 'upi'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <CreditCard size={16} />
                    UPI QR
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('split')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition min-h-touch ${
                      paymentMethod === 'split'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Split size={16} />
                    Split Pay
                  </button>
                </div>

                {/* Split Payment Fields */}
                {paymentMethod === 'split' && (
                  <div className="grid grid-cols-2 gap-3 pt-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <div>
                      <label className="block text-xs text-gray-600 font-semibold mb-1">Cash Tender</label>
                      <input
                        type="number"
                        step="0.01"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 font-semibold mb-1">UPI Tender</label>
                      <input
                        type="number"
                        step="0.01"
                        value={upiAmount}
                        onChange={(e) => setUpiAmount(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                {/* Outstanding Due Preview */}
                {parseFloat(outstandingBalance) > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
                    <span>Remaining Balance Due (Credit):</span>
                    <span className="font-bold text-sm text-red-600">₹{outstandingBalance}</span>
                  </div>
                )}
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalizeBill}
                className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 min-h-touch"
              >
                <CheckCircle2 size={20} />
                <span>{submitting ? 'Finalizing Invoice...' : `Finalize & Bill ₹${calculations.grandTotal}`}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Product Catalogue (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-primary-light shadow-sm space-y-3">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Quick search product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {categories.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
                      !selectedCategory
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedCategory(c)}
                      className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
                        selectedCategory === c
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Grid / List */}
            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                return (
                  <button
                    key={p._id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition min-h-touch ${
                      isOutOfStock
                        ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                        : 'bg-white border-gray-200 hover:border-primary hover:bg-primary-light/20'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-gray-900 truncate">{p.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {p.netWeight || p.packType} · Stock: {p.stock}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm text-primary">
                        ₹{parseFloat(p.sellingPrice).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-gray-400 block">+ Add</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bill Finalized Success Modal (Exact Match to User Sketch Layout) ── */}
      {completedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl p-5 sm:p-7 space-y-5 shadow-2xl my-auto">
            {/* Success Heading (No Print) */}
            <div className="text-center no-print space-y-1">
              <div className="w-12 h-12 bg-primary-light text-primary rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Bill Finalized &amp; Stored</h3>
              <p className="text-xs text-gray-500">
                Customer record updated in database. Review exact thermal bill format below:
              </p>
            </div>

            {/* Font Style Selection Toolbar */}
            <div className="no-print bg-gray-50 border border-gray-200 p-2.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                <span className="text-sm">🔤</span>
                <span>Invoice Font Style:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setBillFontStyle('times')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all ${
                    billFontStyle === 'times'
                      ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30 font-bold'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="Times New Roman (Formal Tax Invoice Serif)"
                >
                  <span className="font-serif font-bold">Times New Roman</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillFontStyle('sans')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all ${
                    billFontStyle === 'sans'
                      ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30 font-bold'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="Modern Clean Sans (Inter / Arial)"
                >
                  <span className="font-sans font-semibold">Modern Sans</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillFontStyle('georgia')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all ${
                    billFontStyle === 'georgia'
                      ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30 font-bold'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="Georgia Editorial Serif"
                >
                  <span className="font-georgia font-semibold">Georgia</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillFontStyle('courier')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all ${
                    billFontStyle === 'courier'
                      ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30 font-bold'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="Courier New (Thermal POS Monospace)"
                >
                  <span className="font-mono font-semibold">Courier POS</span>
                </button>
              </div>
            </div>

            {/* ── Exact Receipt Box (Matching User Handwritten Diagram & GST Specs) ── */}
            <div
              className={`printable-receipt p-6 border-2 border-dashed border-gray-300 rounded-2xl bg-white text-gray-900 ${
                billFontStyle === 'times'
                  ? 'font-times'
                  : billFontStyle === 'sans'
                  ? 'font-modern-sans'
                  : billFontStyle === 'georgia'
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

              {/* Line 1: Mobile No (Left) | GST No (Right) */}
              <div className="flex justify-between items-center text-[11px] font-semibold">
                <span>Mobile No : 9597038755 , 7010760392</span>
                <span>GSTIN : 33BEWPA6233E1ZO</span>
              </div>

              {/* Line 2: Customer Name (Left) | Customer MobileNum (Right) */}
              <div className="flex justify-between items-center text-[11px] font-bold text-emerald-800">
                <span>Customer Name : {completedInvoice.customerName}</span>
                <span>Customer MobileNum : +91 {completedInvoice.customerMobile}</span>
              </div>

              {/* Line 3: Invoice Number (Left) | Date (Right) */}
              <div className="flex justify-between items-center text-[10px] text-gray-500 pb-2 border-b border-gray-200">
                <span>Invoice No : {completedInvoice.invoiceNumber}</span>
                <span>Date : {new Date(completedInvoice.invoicedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Table: S.No | Description | Quantity | Price | GST % | Total */}
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b-2 border-gray-300 text-gray-600 uppercase">
                    <th className="py-1.5 w-10">S.No</th>
                    <th className="py-1.5">Description</th>
                    <th className="py-1.5 text-center w-16">Quantity</th>
                    <th className="py-1.5 text-right w-16">Price</th>
                    <th className="py-1.5 text-center w-16">GST %</th>
                    <th className="py-1.5 text-right w-20">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {completedInvoice.lines.map((l, idx) => (
                    <tr key={idx}>
                      <td className="py-2 text-gray-500">{idx + 1}</td>
                      <td className="py-2 font-semibold text-gray-900">{l.productName}</td>
                      <td className="py-2 text-center">{l.quantity} {l.unit}</td>
                      <td className="py-2 text-right">₹{Number(l.sellingPrice).toFixed(2)}</td>
                      <td className="py-2 text-center font-bold text-primary">{l.gstRate ?? 5}%</td>
                      <td className="py-2 text-right font-semibold">₹{Number(l.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary Under Table on Right: GST Rates & Percentages before Total */}
              <div className="pt-2 border-t border-gray-200 flex justify-end">
                <div className="w-64 space-y-1.5 text-right text-[11px]">
                  <div className="flex justify-between text-gray-600">
                    <span>Taxable Subtotal:</span>
                    <span>₹{completedInvoice.subtotalTaxable}</span>
                  </div>

                  {/* Explicit GST rate breakdown applied before Total */}
                  {Array.from(new Set(completedInvoice.lines.map((l) => l.gstRate ?? 5))).map((rate) => {
                    const linesAtRate = completedInvoice.lines.filter((l) => (l.gstRate ?? 5) === rate);
                    const cgstAtRate = linesAtRate
                      .reduce((acc, cur) => acc.plus(cur.cgst || '0'), new Decimal(0))
                      .toFixed(2);
                    const sgstAtRate = linesAtRate
                      .reduce((acc, cur) => acc.plus(cur.sgst || '0'), new Decimal(0))
                      .toFixed(2);
                    const totalTaxAtRate = new Decimal(cgstAtRate).plus(sgstAtRate).toFixed(2);

                    return (
                      <div key={rate} className="py-1 border-t border-dashed border-gray-200 text-gray-600">
                        <div className="flex justify-between text-[10px]">
                          <span>CGST ({(rate / 2).toFixed(1)}%):</span>
                          <span>₹{cgstAtRate}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span>SGST ({(rate / 2).toFixed(1)}%):</span>
                          <span>₹{sgstAtRate}</span>
                        </div>
                        <div className="flex justify-between font-bold text-primary text-[11px] pt-0.5">
                          <span>GST {rate}% Applied:</span>
                          <span>₹{totalTaxAtRate}</span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex justify-between font-bold text-sm text-gray-900 pt-1.5 border-t-2 border-gray-400">
                    <span>Net Total:</span>
                    <span className="text-primary font-extrabold text-base">₹{completedInvoice.grandTotal}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 text-[10px]">
                    <span>Amount Paid:</span>
                    <span className="text-emerald-700 font-semibold">₹{completedInvoice.amountPaid}</span>
                  </div>
                  {parseFloat(completedInvoice.outstandingAmount) > 0 && (
                    <div className="flex justify-between text-red-600 font-semibold text-[10px]">
                      <span>Balance Due:</span>
                      <span>₹{completedInvoice.outstandingAmount}</span>
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

            {/* ── Direct PDF & WhatsApp Instant Dispatch Actions (No Print) ── */}
            <div className="space-y-2 no-print pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={whatsappAdminUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <Send size={15} />
                  <span>Send PDF &amp; Bill to Admin WA</span>
                </a>

                <a
                  href={whatsappCustomerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Share2 size={15} />
                  <span>Send PDF &amp; Bill to Customer WA</span>
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => window.print()}
                  className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <Printer size={15} />
                  <span>Print Thermal Receipt</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  className="py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                >
                  <Download size={15} />
                  <span>Download A4 PDF</span>
                </button>

                <button
                  onClick={handleStartNewBill}
                  className="py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-xs transition"
                >
                  Start New Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
