import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  SlidersHorizontal,
  History,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
  Layers,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { productService } from '../services/productService';
import { inventoryService } from '../services/inventoryService';
import type { Product, PriceHistoryItem, StockMovementItem } from '../types/product';

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canViewCost = user?.role === 'admin' || user?.role === 'accountant';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [movementsProduct, setMovementsProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await productService.listProducts({
        search: searchTerm || undefined,
        category: selectedCategory || undefined,
        lowStock: lowStockOnly || undefined,
      });
      setProducts(data.products);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Failed to load products';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, lowStockOnly]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Open Price History Modal
  const handleOpenPriceHistory = async (product: Product) => {
    setHistoryProduct(product);
    try {
      const history = await productService.getPriceHistory(product._id);
      setPriceHistory(history);
    } catch {
      setPriceHistory([]);
    }
  };

  // Open Movements Modal
  const handleOpenMovements = async (product: Product) => {
    setMovementsProduct(product);
    try {
      const list = await inventoryService.getMovements(product._id);
      setMovements(list);
    } catch {
      setMovements([]);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteProductTarget) return;
    try {
      await productService.deleteProduct(deleteProductTarget._id);
      setDeleteProductTarget(null);
      fetchProducts();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to remove product');
    }
  };

  // Extract unique categories
  const categories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="text-primary" size={24} />
            Products &amp; Inventory
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage catalogue, edit items, adjust quantities, and inspect stock history
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl shadow-sm transition-colors min-h-touch"
          >
            <Plus size={18} />
            <span>Add Product</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-primary-light shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, category, barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700">
            <Filter size={16} className="text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent focus:outline-none text-sm cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <span className="text-xs font-medium">Low Stock Alerts</span>
          </label>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchProducts} className="underline text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-primary-light p-12 text-center">
          <Package className="mx-auto text-gray-300 mb-3" size={48} />
          <h3 className="text-base font-semibold text-gray-700">No Products Found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedCategory || lowStockOnly
              ? 'Try adjusting your filters or search term'
              : 'Add your first product to get started!'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-primary-light shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-primary-light/40 border-b border-primary-light text-xs font-semibold text-gray-700 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Pack / Unit</th>
                  <th className="py-3 px-4 text-center">Stock</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  {canViewCost && <th className="py-3 px-4 text-right">Cost Price</th>}
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const isLow = product.stock <= product.lowStockThreshold && product.stock > 0;
                  const isOut = product.stock <= 0;

                  return (
                    <tr key={product._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        <div className="font-semibold text-sm flex items-center gap-1.5">
                          <span>{product.name}</span>
                          {!product.isActive && (
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-normal">
                              Inactive
                            </span>
                          )}
                        </div>
                        {product.sapCode && (
                          <div className="text-xs text-gray-400 font-mono">Code: {product.sapCode}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 text-xs">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-medium">
                          {product.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 text-xs">
                        {product.netWeight || product.packType}
                        {product.unitsPerCarton && product.unitsPerCarton > 1 && (
                          <div className="text-gray-400 text-[11px]">({product.unitsPerCarton} / carton)</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isOut
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isOut ? (
                            <XCircle size={13} />
                          ) : isLow ? (
                            <AlertTriangle size={13} />
                          ) : (
                            <CheckCircle size={13} />
                          )}
                          {product.stock} units
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-gray-800">
                        ₹{parseFloat(product.sellingPrice).toFixed(2)}
                      </td>
                      {canViewCost && (
                        <td className="py-3.5 px-4 text-right text-xs text-gray-500">
                          {product.purchasePrice ? `₹${parseFloat(product.purchasePrice).toFixed(2)}` : '—'}
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => setStockInProduct(product)}
                                title="Stock In (Add Quantity)"
                                className="p-1.5 text-primary hover:bg-primary-light rounded-lg transition"
                              >
                                <ArrowUpRight size={17} />
                              </button>
                              <button
                                onClick={() => setAdjustProduct(product)}
                                title="Adjust Stock (Increase / Decrease Quantity)"
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              >
                                <SlidersHorizontal size={17} />
                              </button>
                              <button
                                onClick={() => setEditProduct(product)}
                                title="Edit Product Details"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteProductTarget(product)}
                                title="Remove Product"
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleOpenMovements(product)}
                            title="Stock Movements History"
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                          >
                            <Layers size={17} />
                          </button>
                          {canViewCost && (
                            <button
                              onClick={() => handleOpenPriceHistory(product)}
                              title="Price Change History"
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                            >
                              <History size={17} />
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

          {/* Mobile Cards View */}
          <div className="lg:hidden divide-y divide-gray-100">
            {products.map((product) => {
              const isLow = product.stock <= product.lowStockThreshold && product.stock > 0;
              const isOut = product.stock <= 0;

              return (
                <div key={product._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-900">{product.name}</h4>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {product.category} · {product.netWeight || product.packType}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isOut
                          ? 'bg-red-50 text-red-700'
                          : isLow
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {product.stock} left
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-xs text-gray-400">Selling Price: </span>
                      <span className="font-bold text-gray-800">
                        ₹{parseFloat(product.sellingPrice).toFixed(2)}
                      </span>
                    </div>

                    {canViewCost && product.purchasePrice && (
                      <div className="text-xs text-gray-500">
                        <span>Cost: </span>
                        <span>₹{parseFloat(product.purchasePrice).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-gray-50 flex-wrap">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setStockInProduct(product)}
                          className="flex-1 py-1.5 bg-primary-light text-primary text-xs font-medium rounded-lg flex items-center justify-center gap-1 min-h-touch"
                        >
                          <ArrowUpRight size={14} />
                          Stock In
                        </button>
                        <button
                          onClick={() => setAdjustProduct(product)}
                          className="flex-1 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg flex items-center justify-center gap-1 min-h-touch"
                        >
                          <SlidersHorizontal size={14} />
                          Adjust Qty
                        </button>
                        <button
                          onClick={() => setEditProduct(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg min-h-touch"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteProductTarget(product)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg min-h-touch"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleOpenMovements(product)}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg min-h-touch"
                      title="Movements"
                    >
                      <Layers size={18} />
                    </button>
                    {canViewCost && (
                      <button
                        onClick={() => handleOpenPriceHistory(product)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg min-h-touch"
                        title="Price History"
                      >
                        <History size={18} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Add Product Modal ────────────────────────────────────── */}
      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchProducts();
          }}
        />
      )}

      {/* ── Edit Product Modal ───────────────────────────────────── */}
      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSuccess={() => {
            setEditProduct(null);
            fetchProducts();
          }}
        />
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────── */}
      {deleteProductTarget && (
        <DeleteConfirmModal
          product={deleteProductTarget}
          onClose={() => setDeleteProductTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* ── Stock-In Modal ──────────────────────────────────────── */}
      {stockInProduct && (
        <StockInModal
          product={stockInProduct}
          onClose={() => setStockInProduct(null)}
          onSuccess={() => {
            setStockInProduct(null);
            fetchProducts();
          }}
        />
      )}

      {/* ── Adjust Stock Modal (Decrease / Increase Quantity) ────── */}
      {adjustProduct && (
        <AdjustStockModal
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSuccess={() => {
            setAdjustProduct(null);
            fetchProducts();
          }}
        />
      )}

      {/* ── Price History Modal ─────────────────────────────────── */}
      {historyProduct && (
        <PriceHistoryModal
          product={historyProduct}
          history={priceHistory}
          onClose={() => setHistoryProduct(null)}
        />
      )}

      {/* ── Movements History Modal ─────────────────────────────── */}
      {movementsProduct && (
        <MovementsModal
          product={movementsProduct}
          movements={movements}
          onClose={() => setMovementsProduct(null)}
        />
      )}
    </div>
  );
}

// ── Modals ──────────────────────────────────────────────────

function AddProductModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Packaged Snacks',
    packType: 'packet',
    netWeight: '250g',
    unitsPerCarton: 1,
    purchasePrice: '0.00',
    sellingPrice: '0.00',
    mrp: '',
    lowStockThreshold: 10,
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await productService.createProduct({
        ...formData,
        mrp: formData.mrp || null,
        gstRate: null, // As per invariants: never invent GST rates
      });
      onSuccess();
    } catch (error: unknown) {
      setErr((error as Error).message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="font-bold text-base text-gray-800">Add New Product</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {err && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              placeholder="e.g. Kaju Burfi 250g"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Category *</label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Net Weight</label>
              <input
                type="text"
                value={formData.netWeight}
                onChange={(e) => setFormData({ ...formData, netWeight: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
                placeholder="250g, 1kg..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Selling Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Purchase Cost (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Carton Conversion</label>
              <input
                type="number"
                min="1"
                value={formData.unitsPerCarton}
                onChange={(e) => setFormData({ ...formData, unitsPerCarton: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
                placeholder="Packets per carton"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Low Stock Alert Level</label>
              <input
                type="number"
                min="0"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl text-amber-800 text-xs leading-relaxed">
            <strong>GST Rate Notice:</strong> Tax rate will remain unassigned until confirmed by the business accountant.
          </div>

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
              {submitting ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditProductModal({
  product,
  onClose,
  onSuccess,
}: {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: product.name,
    category: product.category,
    packType: product.packType,
    netWeight: product.netWeight || '',
    unitsPerCarton: product.unitsPerCarton || 1,
    sellingPrice: product.sellingPrice,
    purchasePrice: product.purchasePrice || '0.00',
    lowStockThreshold: product.lowStockThreshold,
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await productService.updateProduct(product._id, {
        ...formData,
        reason: formData.reason || 'Product updated via admin panel',
      });
      onSuccess();
    } catch (error: unknown) {
      setErr((error as Error).message || 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-base text-gray-800">Edit Product Details</h3>
            <p className="text-xs text-primary font-medium">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {err && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Category *</label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Net Weight</label>
              <input
                type="text"
                value={formData.netWeight}
                onChange={(e) => setFormData({ ...formData, netWeight: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Selling Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary font-semibold text-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Purchase Cost (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Carton Conversion</label>
              <input
                type="number"
                min="1"
                value={formData.unitsPerCarton}
                onChange={(e) => setFormData({ ...formData, unitsPerCarton: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Low Stock Alert Level</label>
              <input
                type="number"
                min="0"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason for modification</label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary text-xs"
              placeholder="e.g. Corrected spelling, updated supplier rates"
            />
          </div>

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
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  product,
  onClose,
  onConfirm,
}: {
  product: Product;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <Trash2 size={24} />
        </div>

        <div>
          <h3 className="font-bold text-base text-gray-900">Remove Product?</h3>
          <p className="text-xs text-gray-500 mt-1">
            Are you sure you want to remove <strong>{product.name}</strong>?
          </p>
          <p className="text-[11px] text-gray-400 mt-2 bg-gray-50 p-2 rounded-lg">
            Note: If this product has historical billing or stock movements, it will be safely deactivated to protect audit records.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 min-h-touch"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold min-h-touch"
          >
            Confirm Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function StockInModal({ product, onClose, onSuccess }: { product: Product; onClose: () => void; onSuccess: () => void }) {
  const [purchaseUnit, setPurchaseUnit] = useState('carton');
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [conversionFactor, setConversionFactor] = useState(product.unitsPerCarton || 1);
  const [purchaseCost, setPurchaseCost] = useState(product.purchasePrice || '0.00');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const unitsToAdd = purchaseQty * conversionFactor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await inventoryService.recordStockIn({
        productId: product._id,
        purchaseUnit,
        purchaseQty,
        conversionFactor,
        purchaseCost,
        notes,
      });
      onSuccess();
    } catch (error: unknown) {
      setErr((error as Error).message || 'Failed to record stock-in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-base text-gray-800">Record Incoming Stock (Stock In)</h3>
            <p className="text-xs text-primary font-medium">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {err && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Purchase Unit</label>
              <input
                type="text"
                required
                value={purchaseUnit}
                onChange={(e) => setPurchaseUnit(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
                placeholder="carton, box, pack..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity Received</label>
              <input
                type="number"
                min="1"
                required
                value={purchaseQty}
                onChange={(e) => setPurchaseQty(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Conversion (Units/Carton)</label>
              <input
                type="number"
                min="1"
                required
                value={conversionFactor}
                onChange={(e) => setConversionFactor(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cost per Unit (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="p-3 bg-primary-light/60 rounded-xl text-primary text-xs flex items-center justify-between font-semibold">
            <span>Sellable packets added to stock:</span>
            <span className="text-sm font-bold">+{unitsToAdd}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes / Invoice Ref</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary text-xs"
              placeholder="e.g. Batch #204, morning delivery"
            />
          </div>

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
              {submitting ? 'Recording...' : 'Confirm Stock In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdjustStockModal({
  product,
  onClose,
  onSuccess,
}: {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<'decrease' | 'increase'>('decrease');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('Damaged packaging / Spoilage');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const delta = mode === 'decrease' ? -Math.abs(quantity) : Math.abs(quantity);
  const resultingStock = product.stock + delta;

  const COMMON_REASONS = [
    'Damaged packaging / Spoilage',
    'Physical inventory audit count correction',
    'Customer return inspection',
    'Tasting sample / Quality check',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delta === 0) {
      setErr('Quantity must be greater than 0');
      return;
    }
    if (resultingStock < 0) {
      setErr(`Cannot decrease by ${quantity}: current stock is only ${product.stock}`);
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await inventoryService.adjustStock({
        productId: product._id,
        delta,
        reason,
      });
      onSuccess();
    } catch (error: unknown) {
      setErr((error as Error).message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-base text-gray-800">Adjust Stock Quantity</h3>
            <p className="text-xs text-primary font-medium">
              {product.name} (Current: <strong>{product.stock}</strong> units)
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {err && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl">{err}</div>}

        {/* Direction Mode Selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('decrease')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mode === 'decrease'
                ? 'bg-red-50 border-red-500 text-red-700 shadow-sm'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <TrendingDown size={16} />
            <span>Decrease Stock (−)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('increase')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mode === 'increase'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <TrendingUp size={16} />
            <span>Increase Stock (+)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Quantity to {mode === 'decrease' ? 'Subtract' : 'Add'} *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(Math.abs(parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary text-base font-bold"
            />

            {/* Quick action buttons */}
            <div className="flex gap-2 mt-2">
              {[1, 2, 5, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuantity(num)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    quantity === num
                      ? 'bg-primary text-white border-primary'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {mode === 'decrease' ? `-${num}` : `+${num}`}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between font-semibold ${
              resultingStock < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-800'
            }`}
          >
            <span>Resulting Stock:</span>
            <span className="text-sm font-extrabold">{resultingStock} units</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mandatory Reason *</label>
            <input
              type="text"
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:border-primary text-xs"
            />

            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[11px] px-2 py-0.5 rounded-md border text-left ${
                    reason === r
                      ? 'bg-primary-light border-primary text-primary font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

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
              disabled={submitting || resultingStock < 0}
              className={`px-4 py-2 text-white rounded-xl text-xs font-semibold disabled:opacity-50 min-h-touch ${
                mode === 'decrease' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'
              }`}
            >
              {submitting
                ? 'Applying...'
                : mode === 'decrease'
                ? `Confirm Deduct (-${quantity})`
                : `Confirm Add (+${quantity})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PriceHistoryModal({ product, history, onClose }: { product: Product; history: PriceHistoryItem[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-base text-gray-800">Price Change History</h3>
            <p className="text-xs text-primary font-medium">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {history.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-xs">No price modifications recorded yet.</p>
          ) : (
            history.map((item) => (
              <div key={item._id} className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                <div className="flex justify-between items-center font-semibold text-gray-800">
                  <span className="capitalize">{item.field.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-gray-500">
                    ₹{item.previousValue} → <strong className="text-primary">₹{item.newValue}</strong>
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 flex justify-between">
                  <span>By: {item.changedBy?.name || 'Administrator'}</span>
                  <span>{new Date(item.changedAt).toLocaleString()}</span>
                </div>
                {item.reason && <div className="text-[11px] text-gray-600 italic">“{item.reason}”</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MovementsModal({ product, movements, onClose }: { product: Product; movements: StockMovementItem[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-base text-gray-800">Stock Movements Ledger</h3>
            <p className="text-xs text-primary font-medium">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {movements.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-xs">No stock movements recorded yet.</p>
          ) : (
            movements.map((m) => (
              <div key={m._id} className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span
                    className={`uppercase text-[10px] px-2 py-0.5 rounded font-bold ${
                      m.delta > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {m.movementType.replace('_', ' ')}: {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                  <span className="text-gray-600">
                    {m.stockBefore} → <strong>{m.stockAfter}</strong> units
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 flex justify-between">
                  <span>By: {m.performedBy?.name || 'Staff'}</span>
                  <span>{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                {m.reason && <div className="text-[11px] text-gray-600 italic">“{m.reason}”</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
