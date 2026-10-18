import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { Order, Product, FlashCampaign, AuditLog } from '../types/index.ts';
import { getBrowserSupabase } from '../lib/supabaseClient.ts';

interface AdminDashboardPageProps {
  onNavigate: (path: string, id?: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const { user, token, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'analytics' | 'inventory' | 'orders' | 'limitedSale'>('analytics');
  const [metrics, setMetrics] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<FlashCampaign[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Time filter for trends chart: 'day' | 'week' | 'month'
  const [trendRange, setTrendRange] = useState<'day' | 'week' | 'month'>('day');

  // Quick edit stock modal / state
  const [editingStockProduct, setEditingStockProduct] = useState<{ id: string; stock: number } | null>(null);

  // Add Product Form State
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    nameEn: '',
    brand: 'Apple',
    category: 'smartphones',
    subtitle: '',
    description: '',
    basePrice: '',
    compareAtPrice: '',
    stockTotal: '10',
    processor: '',
    display: '',
    battery: '',
    camera: '',
    colorName: 'مشکی تیتانیوم',
    storage: '256 گیگابایت',
  });
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string>('');
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string>('');

  // Limited-Time Sale Form State
  const [isSaleEnabled, setIsSaleEnabled] = useState(true);
  const [saleTitle, setSaleTitle] = useState('جشنواره شگفت‌انگیز پاییزه');
  const [saleBannerText, setSaleBannerText] = useState('تخفیف‌های انحصاری گجت‌های پرچمدار با اعتبار محدود تا اتمام موجودی جشنواره.');
  const [saleStartDate, setSaleStartDate] = useState('');
  const [saleEndDate, setSaleEndDate] = useState('');
  const [defaultDiscount, setDefaultDiscount] = useState<number>(10);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productDiscounts, setProductDiscounts] = useState<Record<string, number>>({});
  const [isSavingSale, setIsSavingSale] = useState(false);

  // Mobile sidebar toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchAllAdminData = () => {
    if (!token) return;
    setIsLoading(true);

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/admin/metrics', { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/orders', { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/products').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/campaigns', { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/audit-logs', { headers }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([metricsData, ordersData, productsData, campaignsData, logsData]) => {
        if (metricsData) setMetrics(metricsData);
        if (ordersData?.orders) setOrders(ordersData.orders);
        if (productsData?.products) setProducts(productsData.products);
        if (campaignsData?.campaigns) {
          setCampaigns(campaignsData.campaigns);
          const firstCamp = campaignsData.campaigns[0];
          if (firstCamp) {
            setIsSaleEnabled(firstCamp.isActive);
            setSaleTitle(firstCamp.title);
            setSaleBannerText(firstCamp.bannerText || '');
            setDefaultDiscount(firstCamp.discountPercent || 10);
            setSelectedProductIds(firstCamp.eligibleProductIds || []);
            setProductDiscounts(firstCamp.productDiscounts || {});
            
            // Format dates for datetime-local input
            try {
              setSaleStartDate(new Date(firstCamp.startDate).toISOString().slice(0, 16));
              setSaleEndDate(new Date(firstCamp.endDate).toISOString().slice(0, 16));
            } catch (e) {
              setSaleStartDate(new Date().toISOString().slice(0, 16));
              setSaleEndDate(new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16));
            }
          }
        }
        if (logsData?.logs) setAuditLogs(logsData.logs);
      })
      .catch((err) => {
        console.error('Failed to load admin data:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (token) {
      fetchAllAdminData();

      // Real-time synchronization for orders, products, and flash sales
      const supabase = getBrowserSupabase();
      const channel = supabase
        .channel('voltro-admin-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchAllAdminData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
          fetchAllAdminData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'flash_campaigns' }, () => {
          fetchAllAdminData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setIsLoading(false);
    }
  }, [token]);

  // Update order status (automatically recalculates delivered metrics)
  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast('وضعیت سفارش بروزرسانی شد و آمار فروش مجدداً محاسبه گردید.', 'success');
        fetchAllAdminData();
      } else {
        showToast('خطا در تغییر وضعیت سفارش.', 'error');
      }
    } catch (e) {
      showToast('خطا در برقراری ارتباط با سرور.', 'error');
    }
  };

  // Update inventory stock
  const handleSaveStock = async (productId: string, newStock: number) => {
    try {
      const res = await fetch(`/api/admin/inventory/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stock: newStock }),
      });
      if (res.ok) {
        showToast('موجودی انبار بروزرسانی گردید.', 'success');
        setEditingStockProduct(null);
        fetchAllAdminData();
      } else {
        showToast('خطا در بروزرسانی موجودی انبار.', 'error');
      }
    } catch (e) {
      showToast('خطا در ارسال اطلاعات موجودی.', 'error');
    }
  };

  // Handle Image Upload for New Product
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('فایل انتخابی باید از نوع تصویر باشد.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('حجم تصویر نباید بیشتر از 5 مگابایت باشد.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUploadedImagePreview(base64);
      setUploadedImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // Submit Add Product Form
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductForm.name || !newProductForm.basePrice) {
      showToast('نام کالا و قیمت پایه الزامی هستند.', 'error');
      return;
    }

    setIsSubmittingProduct(true);
    try {
      let finalImageUrl = '/images/products/airpods-max.png';

      // Upload image if provided
      if (uploadedImageBase64) {
        const uploadRes = await fetch('/api/admin/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            imageBase64: uploadedImageBase64,
            filename: `${newProductForm.nameEn || 'product'}.png`,
          }),
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalImageUrl = uploadData.url;
        }
      }

      const basePriceNum = Number(newProductForm.basePrice);
      const comparePriceNum = newProductForm.compareAtPrice ? Number(newProductForm.compareAtPrice) : undefined;
      const stockNum = Number(newProductForm.stockTotal) || 10;

      const productPayload = {
        name: newProductForm.name,
        nameEn: newProductForm.nameEn || newProductForm.name,
        subtitle: newProductForm.subtitle || 'محصول رسمی با ضمانت ولترو',
        slug: (newProductForm.nameEn || newProductForm.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        brand: newProductForm.brand,
        category: newProductForm.category,
        basePrice: basePriceNum,
        compareAtPrice: comparePriceNum,
        description: newProductForm.description || newProductForm.subtitle,
        images: [finalImageUrl],
        stockTotal: stockNum,
        soldCount: 0,
        rating: 5.0,
        reviewCount: 0,
        warranty: '18 ماه گارانتی رسمی تعویض ولترو',
        tags: ['جدید', 'پرچمدار'],
        variants: [
          {
            id: `var-${Date.now()}`,
            sku: `VOL-${Math.floor(10000 + Math.random() * 90000)}`,
            colorName: newProductForm.colorName || 'پیش‌فرض',
            colorEn: 'Standard',
            colorHex: '#18181b',
            storage: newProductForm.storage || 'استاندارد',
            price: basePriceNum,
            stock: stockNum,
            image: finalImageUrl,
          },
        ],
        specifications: {
          processor: newProductForm.processor || 'پردازنده نسل جدید',
          display: newProductForm.display || 'نمایشگر OLED Super Retina',
          battery: newProductForm.battery || 'شارژدهی طولانی با فست شارژ',
          camera: newProductForm.camera || 'سیستم دوربین پیشرفته',
        },
      };

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productPayload),
      });

      if (res.ok) {
        const data = await res.json();
        showToast('کالای جدید با موفقیت در دیتابیس Supabase ثبت شد و به ویترین افزوده گردید.', 'success');
        setIsAddProductModalOpen(false);
        setNewProductForm({
          name: '',
          nameEn: '',
          brand: 'Apple',
          category: 'smartphones',
          subtitle: '',
          description: '',
          basePrice: '',
          compareAtPrice: '',
          stockTotal: '10',
          processor: '',
          display: '',
          battery: '',
          camera: '',
          colorName: 'مشکی تیتانیوم',
          storage: '256 گیگابایت',
        });
        setUploadedImagePreview('');
        setUploadedImageBase64('');
        if (data.product) {
          setProducts((prev) => [data.product, ...prev.filter((p) => p.id !== data.product.id)]);
        }
        fetchAllAdminData();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'خطا در ثبت محصول در پایگاه داده.', 'error');
      }
    } catch (err) {
      showToast('خطا در برقراری ارتباط با سرور.', 'error');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`آیا از حذف محصول «${productName}» از پایگاه داده و فروشگاه مطمئن هستید؟`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        showToast('محصول با موفقیت از سیستم حذف گردید.', 'success');
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        fetchAllAdminData();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'خطا در حذف محصول.', 'error');
      }
    } catch (err) {
      showToast('خطا در برقراری ارتباط با سرور.', 'error');
    }
  };

  // Save Limited-Time Sale Settings
  const handleSaveLimitedSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleTitle) {
      showToast('عنوان جشنواره الزامی است.', 'error');
      return;
    }

    setIsSavingSale(true);
    try {
      const payload: Partial<FlashCampaign> = {
        title: saleTitle,
        bannerText: saleBannerText,
        discountPercent: Number(defaultDiscount) || 10,
        isActive: isSaleEnabled,
        eligibleProductIds: selectedProductIds,
        productDiscounts: productDiscounts,
        startDate: saleStartDate ? new Date(saleStartDate).toISOString() : new Date().toISOString(),
        endDate: saleEndDate ? new Date(saleEndDate).toISOString() : new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      };

      const existingCamp = campaigns[0];
      let res;
      if (existingCamp) {
        res = await fetch(`/api/admin/campaigns/${existingCamp.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/admin/campaigns', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        showToast('تنظیمات جشنواره فروش محدود با موفقیت ذخیره و در سایت اعمال شد.', 'success');
        fetchAllAdminData();
      } else {
        showToast('خطا در ذخیره تنظیمات جشنواره.', 'error');
      }
    } catch (err) {
      showToast('خطا در برقراری ارتباط با سرور.', 'error');
    } finally {
      setIsSavingSale(false);
    }
  };

  // Guard: if not authenticated or not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="w-full min-h-screen pt-28 flex items-center justify-center p-4 bg-[#F8FAFC] dark:bg-[#0B0B0C]">
        <div className="w-full max-w-md p-8 rounded-3xl border text-center bg-white dark:bg-[#121215] border-slate-200 dark:border-white/[0.06] shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500 mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            دسترسی به پنل مدیریت محافظت‌شده است
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6 leading-relaxed">
            تنها مدیران ارشد سیستم امکان مشاهده گزارشات مالی، ویرایش کاتالوگ و مدیریت سفارشات را دارند.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => openAuthModal('login')}
              className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md"
            >
              ورود با حساب مدیر ارشد
            </button>
            <button
              onClick={() => onNavigate('home')}
              className="py-2.5 px-4 rounded-xl border border-white/[0.08] text-xs text-zinc-400 hover:text-white"
            >
              بازگشت به فروشگاه
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Real Calculated Metrics
  const deliveredOrdersCount = metrics?.totalOrders ?? 0;
  const totalSalesRevenue = metrics?.totalRevenue ?? 0;
  const aovValue = metrics?.aov ?? 0;
  const totalStockCount = metrics?.totalInventoryStock ?? 0;

  // Active trend series based on delivered orders
  const currentTrendSeries = metrics?.deliveredSalesTrends?.[trendRange] || {
    labels: ['1', '2', '3', '4', '5', '6', '7'],
    revenue: [0, 0, 0, 0, 0, 0, 0],
    volume: [0, 0, 0, 0, 0, 0, 0],
  };

  return (
    <div className="w-full min-h-screen transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100 antialiased">
      {/* 1. ASIDE SIDEBAR (Fixed Right in RTL on desktop; Drawer on mobile) */}
      <aside
        className={`fixed top-0 right-0 h-full w-72 z-50 flex flex-col pt-6 pb-6 border-l transition-transform duration-300 bg-white dark:bg-[#08080A] border-slate-200 dark:border-white/[0.06] shadow-sm ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-6 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-500">
              <span className="material-symbols-outlined text-lg">bolt</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="font-display font-bold text-base tracking-wider text-slate-900 dark:text-white">
                VOLTRO
              </span>
              <span className="font-mono text-[9px] text-blue-500 font-semibold tracking-widest uppercase">
                پنل مدیریت
              </span>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Sidebar Nav (Search & Notifications removed) */}
        <nav className="flex-1 px-4 space-y-1.5 text-right">
          <button
            onClick={() => {
              setActiveTab('analytics');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs transition-all ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.35)]'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/40 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-lg">analytics</span>
            <span>داشبورد و تحلیل</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('inventory');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs transition-all ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.35)]'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/40 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-lg">inventory_2</span>
            <span>انبار و کالاها</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('orders');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs transition-all ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.35)]'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/40 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-lg">receipt_long</span>
            <span>سفارش‌ها</span>
          </button>

          {/* Limited-Time Sale Management (Replaced advertising campaign) */}
          <button
            onClick={() => {
              setActiveTab('limitedSale');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs transition-all ${
              activeTab === 'limitedSale'
                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.35)]'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/40 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-lg">timer</span>
            <span>مدیریت فروش محدود</span>
          </button>

          <button
            onClick={() => onNavigate('home')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/40 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-lg">storefront</span>
            <span>مشاهده فروشگاه</span>
          </button>
        </nav>

        {/* Admin user card with clean white/gray human avatar illustration */}
        <div className="px-4 pt-4 border-t border-slate-200 dark:border-white/[0.06]">
          <div className="p-3 rounded-xl border flex items-center justify-between bg-slate-50 dark:bg-[#141417] border-slate-200 dark:border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              {/* White and gray human avatar illustration */}
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 ring-1 ring-blue-500/30">
                <span className="material-symbols-outlined text-lg">person</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  مدیر ارشد
                </span>
                <span className="font-mono text-[10px] text-blue-500 font-medium">VOLTRO SuperAdmin</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-zinc-400 hover:text-blue-500 cursor-pointer text-sm">
              tune
            </span>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* 2. MAIN CONTENT AREA */}
      <div className="pr-0 lg:pr-72 transition-all">
        {/* Top Header without search & notifications */}
        <header className="fixed top-0 right-0 lg:right-72 left-0 h-16 z-40 flex items-center justify-between px-4 sm:px-8 border-b backdrop-blur-xl transition-colors bg-white/90 dark:bg-[#08080A]/90 border-slate-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-300"
            >
              <span className="material-symbols-outlined text-xl">menu</span>
            </button>
            <span className="font-headline-sm text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              مرکز کنترل عملیات فروشگاه
            </span>
          </div>

          <div className="flex items-center gap-3">
            {metrics?.connectionStatus && (
              <div
                className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border ${
                  metrics.connectionStatus.activeDataSource === 'supabase'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    metrics.connectionStatus.activeDataSource === 'supabase'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  } animate-pulse`}
                />
                <span>
                  {metrics.connectionStatus.activeDataSource === 'supabase'
                    ? 'Supabase PostgreSQL'
                    : 'Local Fallback'}
                </span>
              </div>
            )}
            {/* White & gray human avatar in header */}
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 ring-1 ring-blue-500/30">
              <span className="material-symbols-outlined text-lg">person</span>
            </div>
            <span className="hidden sm:inline font-mono text-xs text-slate-600 dark:text-zinc-400">
              مدیر ارشد ولترو
            </span>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="relative pt-20 px-4 sm:px-8 pb-16 min-h-screen text-right">
          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="flex flex-col w-full">
              {/* Top Action & Overview Bar (Excel Export completely removed) */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]" />
                    <span className="font-mono text-[10px] text-blue-500 uppercase tracking-widest font-semibold">
                      پایش زنده سفارشات تحویل‌شده
                    </span>
                  </div>
                  <h1 className="font-headline-lg text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    پیشخوان گزارشات و مدیریت
                  </h1>
                </div>

                {/* Filter buttons by Day, Week, Month */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex p-1 rounded-xl border bg-slate-100 dark:bg-[#141417] border-slate-200 dark:border-white/[0.06]">
                    <button
                      onClick={() => setTrendRange('day')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        trendRange === 'day' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-zinc-400 hover:text-white'
                      }`}
                    >
                      روزانه
                    </button>
                    <button
                      onClick={() => setTrendRange('week')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        trendRange === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-zinc-400 hover:text-white'
                      }`}
                    >
                      هفتگی
                    </button>
                    <button
                      onClick={() => setTrendRange('month')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        trendRange === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-zinc-400 hover:text-white'
                      }`}
                    >
                      ماهانه
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Data Source & Supabase State Banner */}
              <div className="mb-6 p-4 rounded-2xl border transition-all bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start md:items-center gap-3">
                    <div
                      className={`w-3.5 h-3.5 rounded-full mt-0.5 md:mt-0 ${
                        metrics?.connectionStatus?.activeDataSource === 'supabase'
                          ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                          : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
                      } animate-pulse`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          منبع داده فعال: {metrics?.connectionStatus?.activeDataSource === 'supabase' ? 'پایگاه داده ابری Supabase PostgreSQL' : 'پایگاه داده محلی (Local Fallback)'}
                        </span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                          {metrics?.connectionStatus?.supabaseConnected ? 'اتصال برقرار است' : 'درحال بررسی'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        {metrics?.connectionStatus?.message ||
                          'پروژه به آدرس https://hxibukwtqfqwzdijmftq.supabase.co متصل شده است.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                    <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-white/[0.06]">
                      پروژه: hxibukwtqfqwzdijmftq
                    </span>
                    {metrics?.connectionStatus?.activeDataSource !== 'supabase' && (
                      <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/20">
                        مایگریشن در انتظار اجرا (scripts/migration.sql)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 4 Real KPI Metric Cards (Only delivered orders counted; 0 when no data) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* KPI 1: Total Sales (Delivered orders only) */}
                <div className="relative overflow-hidden p-6 rounded-2xl border transition-all bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] hover:border-blue-500/50 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">فروش کل (سفارشات تحویل‌شده)</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                    </div>
                  </div>
                  <div className="font-display text-2xl font-bold font-mono tracking-tight mb-1 text-slate-900 dark:text-white">
                    {totalSalesRevenue.toLocaleString('en-US')}{' '}
                    <span className="font-mono text-xs text-zinc-500 font-normal">تومان</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs text-emerald-500">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>{deliveredOrdersCount} سفارش تحویل‌شده</span>
                  </div>
                </div>

                {/* KPI 2: Delivered Orders */}
                <div className="relative overflow-hidden p-6 rounded-2xl border transition-all bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] hover:border-sky-500/50 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">سفارش‌های تحویل‌شده</span>
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">local_shipping</span>
                    </div>
                  </div>
                  <div className="font-display text-2xl font-bold font-mono tracking-tight mb-1 text-slate-900 dark:text-white">
                    {deliveredOrdersCount}{' '}
                    <span className="font-mono text-xs text-zinc-500 font-normal">سفارش</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs text-sky-400">
                    <span className="material-symbols-outlined text-sm">done_all</span>
                    <span>محاسبه آنی از پایگاه داده</span>
                  </div>
                </div>

                {/* KPI 3: Average Order Value (AOV of delivered orders) */}
                <div className="relative overflow-hidden p-6 rounded-2xl border transition-all bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] hover:border-purple-500/50 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">میانگین سفارش (AOV تحویل‌شده)</span>
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">equalizer</span>
                    </div>
                  </div>
                  <div className="font-display text-2xl font-bold font-mono tracking-tight mb-1 text-slate-900 dark:text-white">
                    {aovValue.toLocaleString('en-US')}{' '}
                    <span className="font-mono text-xs text-zinc-500 font-normal">تومان</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs text-purple-400">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    <span>میانگین واقعی</span>
                  </div>
                </div>

                {/* KPI 4: Real Inventory Stock */}
                <div className="relative overflow-hidden p-6 rounded-2xl border transition-all bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] hover:border-rose-500/50 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">موجودی فیزیکی کل انبار</span>
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">inventory</span>
                    </div>
                  </div>
                  <div className="font-display text-2xl font-bold font-mono tracking-tight mb-1 text-slate-900 dark:text-white">
                    {totalStockCount}{' '}
                    <span className="font-mono text-xs text-zinc-500 font-normal">واحد کالا</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs text-rose-400">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    <span>{metrics?.lowStockCount ?? 0} مورد در آستانه اتمام</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Responsive Sales Volume & Revenue Trends Chart (Delivered orders only) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                <div className="lg:col-span-8 p-6 rounded-2xl border flex flex-col justify-between bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-sm">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        روند فروش و درآمد سفارشات تحویل‌شده
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        نمودار لحظه‌ای بر اساس دوره‌های {trendRange === 'day' ? 'روزانه' : trendRange === 'week' ? 'هفتگی' : 'ماهانه'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_6px_#2563eb]" />
                        <span className="text-zinc-400">درآمد تحویل‌شده</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
                        <span className="text-zinc-400">تعداد سفارش</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Chart Render */}
                  <div className="w-full h-64 relative flex items-end pt-4">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 240">
                      <defs>
                        <linearGradient id="electricBlueGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                          <stop offset="65%" stopColor="#3b82f6" stopOpacity="0.08" />
                          <stop offset="100%" stopColor="#1e40af" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="electricBlueStroke" x1="0" x2="1" y1="0" y2="0">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="45%" stopColor="#2563eb" />
                          <stop offset="80%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#38bdf8" />
                        </linearGradient>
                      </defs>
                      <line stroke="#27272a" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="700" y1="40" y2="40" />
                      <line stroke="#27272a" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="700" y1="100" y2="100" />
                      <line stroke="#27272a" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="700" y1="160" y2="160" />
                      <line stroke="#27272a" strokeWidth="1" x1="0" x2="700" y1="220" y2="220" />

                      {deliveredOrdersCount === 0 ? (
                        /* Flat zero state line */
                        <line stroke="#52525b" strokeWidth="2" strokeDasharray="4 4" x1="0" x2="700" y1="220" y2="220" />
                      ) : (
                        <>
                          <path d="M 0 210 Q 120 180, 240 160 T 480 80 T 700 40 L 700 220 L 0 220 Z" fill="url(#electricBlueGradient)" />
                          <path d="M 0 210 Q 120 180, 240 160 T 480 80 T 700 40" fill="none" stroke="url(#electricBlueStroke)" strokeLinecap="round" strokeWidth="3" />
                          <circle cx="700" cy="40" fill="#38bdf8" r="5" stroke="#0e0e10" strokeWidth="2" />
                          <circle cx="700" cy="40" fill="none" r="9" stroke="#38bdf8" strokeOpacity="0.6" strokeWidth="1.5" />
                        </>
                      )}
                    </svg>

                    {deliveredOrdersCount > 0 && (
                      <div className="absolute left-[80%] top-2 -translate-x-1/2 bg-[#18181c]/95 border border-blue-500/40 px-3 py-1 rounded-lg shadow-xl pointer-events-none">
                        <span className="font-mono text-xs text-sky-400 font-bold block">
                          {totalSalesRevenue.toLocaleString('en-US')} تومان
                        </span>
                        <span className="text-[11px] text-zinc-400 block text-center">
                          {deliveredOrdersCount} سفارش موفق
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 font-mono text-[11px] text-zinc-500 overflow-x-auto">
                    {currentTrendSeries.labels.map((lbl: string, i: number) => (
                      <span key={i}>{lbl}</span>
                    ))}
                  </div>
                </div>

                {/* Traffic Channels */}
                <div className="lg:col-span-4 p-6 rounded-2xl border flex flex-col justify-between bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        منابع ورودی ترافیک
                      </h2>
                      <span className="material-symbols-outlined text-blue-500 text-lg">travel_explore</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
                      سهم کانال‌های بازاریابی دیجیتال
                    </p>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-2 text-slate-800 dark:text-white">
                            <span className="w-2 h-2 rounded-full bg-blue-600" />
                            جستجوی ارگانیک گوگل
                          </span>
                          <span className="font-mono font-bold text-blue-500">42٪</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full w-[42%]" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-2 text-slate-800 dark:text-white">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            شبکه‌های اجتماعی
                          </span>
                          <span className="font-mono font-bold text-sky-400">32٪</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-sky-400 rounded-full w-[32%]" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-2 text-slate-800 dark:text-white">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            ایمیل مارکتینگ
                          </span>
                          <span className="font-mono font-bold text-purple-400">16٪</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full w-[16%]" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-2 text-slate-800 dark:text-white">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            ورودی مستقیم
                          </span>
                          <span className="font-mono font-bold text-emerald-400">10٪</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full w-[10%]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-xl border flex items-center justify-between bg-slate-50 dark:bg-[#18181c] border-slate-200 dark:border-white/[0.06]">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">نرخ تبدیل موفق</span>
                      <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        {deliveredOrdersCount > 0 ? '3.85٪' : '0٪'}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-blue-500 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                      پایش زنده
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INVENTORY & PRODUCTS TAB */}
          {activeTab === 'inventory' && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    مدیریت انبار و کاتالوگ محصولات
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    افزودن کالای جدید، ویرایش موجودی و تنوع مشخصات
                  </p>
                </div>
                <button
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>افزودن کالای جدید</span>
                </button>
              </div>

              {/* Products Table */}
              <div className="rounded-2xl border overflow-x-auto bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-sm">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                      <th className="py-3 px-4">کالا</th>
                      <th className="py-3 px-4">برند</th>
                      <th className="py-3 px-4">دسته‌بندی</th>
                      <th className="py-3 px-4">قیمت پایه</th>
                      <th className="py-3 px-4">موجودی انبار</th>
                      <th className="py-3 px-4">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.images[0]}
                              alt=""
                              className="w-10 h-10 object-contain rounded-lg bg-slate-100 dark:bg-zinc-900 p-1 border border-slate-200 dark:border-white/[0.06]"
                            />
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {p.name}
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{p.nameEn}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 dark:text-zinc-300">{p.brand}</td>
                        <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">{p.category}</td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {p.basePrice.toLocaleString('en-US')} تومان
                        </td>
                        <td className="py-3 px-4">
                          {editingStockProduct?.id === p.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={editingStockProduct.stock}
                                id={`stock-input-${p.id}`}
                                className="w-16 px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-white/[0.1] text-xs"
                              />
                              <button
                                onClick={() => {
                                  const val = (document.getElementById(`stock-input-${p.id}`) as HTMLInputElement)?.value;
                                  handleSaveStock(p.id, Number(val));
                                }}
                                className="p-1 rounded bg-blue-600 text-white"
                              >
                                ثبت
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                                p.stockTotal <= 3
                                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              }`}
                            >
                              {p.stockTotal} عدد
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setEditingStockProduct({ id: p.id, stock: p.stockTotal })
                              }
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:border-blue-500 text-slate-700 dark:text-zinc-300 hover:text-blue-600 text-[11px] cursor-pointer"
                            >
                              تغییر موجودی
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              title="حذف کالا"
                              className="p-1 rounded-lg border border-rose-200 dark:border-rose-500/20 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-[11px] cursor-pointer transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm block">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  مدیریت تمامی سفارشات
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  تغییر وضعیت ارسال، بررسی پرداخت و پیگیری مرسوله (تغییر به «تحویل شد» آمار فروش را بروز می‌کند)
                </p>
              </div>

              <div className="space-y-4">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-5 rounded-2xl border transition-all bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-blue-500">
                          {ord.orderNumber}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-zinc-400">
                          خریدار: {ord.userName} ({ord.userPhone})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {ord.totalAmount.toLocaleString('en-US')} تومان
                        </span>
                        <select
                          value={ord.status}
                          onChange={(e) =>
                            handleUpdateOrderStatus(ord.id, e.target.value as Order['status'])
                          }
                          className="px-3 py-1 rounded-xl text-xs bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                        >
                          <option value="pending">در حال بررسی</option>
                          <option value="processing">آماده ارسال</option>
                          <option value="shipped">ارسال شده به پست</option>
                          <option value="delivered">تحویل شد</option>
                          <option value="cancelled">لغو شده</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-3">
                      <div className="text-xs text-slate-600 dark:text-zinc-300 mb-2">
                        نشانی: {ord.shippingAddress?.province}، {ord.shippingAddress?.city}، {ord.shippingAddress?.postalAddress}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ord.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#1e1e24] text-[11px] text-slate-700 dark:text-zinc-300 flex items-center gap-2 border border-slate-200 dark:border-white/[0.04]"
                          >
                            <img src={item.image} alt="" className="w-5 h-5 object-contain" />
                            <span>
                              {item.productName} ({item.variantTitle}) × {item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LIMITED-TIME SALE MANAGEMENT (Item 1 Requirements) */}
          {activeTab === 'limitedSale' && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    مدیریت جشنواره و فروش زمان‌دار (Limited-Time Sale)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    فعال‌سازی، زمان‌بندی خودکار، انتخاب کالاها و تعیین درصد تخفیف اختصاصی هر محصول
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleSaveLimitedSale}
                className="p-6 rounded-3xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-md flex flex-col gap-6"
              >
                {/* 1. Global Enable/Disable Toggle */}
                <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-[#18181c] border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">
                      وضعیت نمایش بخش جشنواره فروش محدود
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      با غیرفعال‌سازی این گزینه، کل سکشن از صفحه اصلی حذف شده و تخفیف‌ها منقضی می‌گردند.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSaleEnabled}
                      onChange={(e) => setIsSaleEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* 2. Title & Banner Text */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      عنوان جشنواره
                    </label>
                    <input
                      type="text"
                      value={saleTitle}
                      onChange={(e) => setSaleTitle(e.target.value)}
                      placeholder="مثال: جشنواره ویژه پاییزه پرچمداران"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      توضیحات بنر فروش ویژه
                    </label>
                    <input
                      type="text"
                      value={saleBannerText}
                      onChange={(e) => setSaleBannerText(e.target.value)}
                      placeholder="متن کوتاه ترغیب‌کننده برای خریداران"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 3. Schedule: Start and End Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      تاریخ و ساعت شروع فروش زمان‌دار
                    </label>
                    <input
                      type="datetime-local"
                      value={saleStartDate}
                      onChange={(e) => setSaleStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      تاریخ و ساعت پایان فروش زمان‌دار (انقضای خودکار)
                    </label>
                    <input
                      type="datetime-local"
                      value={saleEndDate}
                      onChange={(e) => setSaleEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 4. Select Products & Individual Discount Percentages */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      انتخاب کالاها و تعیین درصد تخفیف اختصاصی هر محصول
                    </label>
                    <span className="text-[11px] text-blue-500 font-mono">
                      {selectedProductIds.length} محصول انتخاب شده
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2 rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-[#121215]">
                    {products.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      const currentDiscount = productDiscounts[p.id] ?? defaultDiscount;

                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500/50'
                              : 'bg-white dark:bg-[#18181c] border-slate-200 dark:border-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductIds((prev) => [...prev, p.id]);
                                  setProductDiscounts((prev) => ({ ...prev, [p.id]: defaultDiscount }));
                                } else {
                                  setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                                  const copy = { ...productDiscounts };
                                  delete copy[p.id];
                                  setProductDiscounts(copy);
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <img src={p.images[0]} alt="" className="w-9 h-9 object-contain rounded bg-slate-100 dark:bg-zinc-900 p-0.5" />
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-slate-900 dark:text-white truncate max-w-[140px]">
                                {p.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                                {p.basePrice.toLocaleString('en-US')} تومان
                              </span>
                            </div>
                          </div>

                          {/* Individual Discount Percent Input */}
                          {isSelected && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                max="99"
                                value={currentDiscount}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setProductDiscounts((prev) => ({ ...prev, [p.id]: val }));
                                }}
                                className="w-14 px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-slate-300 dark:border-white/[0.1] text-xs font-mono text-center text-slate-900 dark:text-white"
                              />
                              <span className="text-xs font-mono text-blue-500">٪</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Save button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSale}
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">save</span>
                    <span>{isSavingSale ? 'در حال ذخیره‌سازی...' : 'ذخیره و انتشار زمان‌بندی جشنواره'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* 3. ADD PRODUCT MODAL (Item 3 Requirements) */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border shadow-2xl p-6 sm:p-8 my-8 bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.08] text-right">
            <button
              onClick={() => setIsAddProductModalOpen(false)}
              className="absolute left-6 top-6 p-1.5 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">add_box</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  افزودن محصول جدید به فروشگاه
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  ثبت مشخصات فنی، بارگذاری تصویر، قیمت‌گذاری و تنوع کالا
                </p>
              </div>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    نام فارسی کالا *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    placeholder="مثال: گوشی سامسونگ گلکسی S24 Ultra"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    نام انگلیسی (لاتین)
                  </label>
                  <input
                    type="text"
                    value={newProductForm.nameEn}
                    onChange={(e) => setNewProductForm({ ...newProductForm, nameEn: e.target.value })}
                    placeholder="Samsung Galaxy S24 Ultra"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500 text-left font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    دسته‌بندی محصول
                  </label>
                  <select
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  >
                    <option value="smartphones">گوشی‌های هوشمند</option>
                    <option value="laptops">لپ‌تاپ پرو و اولترابوک</option>
                    <option value="watches">ساعت‌های هوشمند</option>
                    <option value="audio">هدفون و تجهیزات صوتی</option>
                    <option value="accessories">لوازم جانبی</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    برند کالا
                  </label>
                  <select
                    value={newProductForm.brand}
                    onChange={(e) => setNewProductForm({ ...newProductForm, brand: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  >
                    <option value="Apple">Apple</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Bang & Olufsen">Bang & Olufsen</option>
                    <option value="Sony">Sony</option>
                    <option value="Anker">Anker</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    قیمت پایه (تومان) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newProductForm.basePrice}
                    onChange={(e) => setNewProductForm({ ...newProductForm, basePrice: e.target.value })}
                    placeholder="مثال: 81000000"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    قیمت قبل از تخفیف (اختیاری)
                  </label>
                  <input
                    type="number"
                    value={newProductForm.compareAtPrice}
                    onChange={(e) => setNewProductForm({ ...newProductForm, compareAtPrice: e.target.value })}
                    placeholder="مثال: 89500000"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    تعداد موجودی انبار *
                  </label>
                  <input
                    type="number"
                    required
                    value={newProductForm.stockTotal}
                    onChange={(e) => setNewProductForm({ ...newProductForm, stockTotal: e.target.value })}
                    placeholder="10"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Image Upload Field with Preview and Validation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  تصویر باکیفیت محصول (پیش‌نمایش و بارگذاری)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.1] bg-slate-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden shrink-0">
                    {uploadedImagePreview ? (
                      <img src={uploadedImagePreview} alt="Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-400 text-2xl">image</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="text-xs text-slate-500 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                  />
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    پردازنده (Chipset)
                  </label>
                  <input
                    type="text"
                    value={newProductForm.processor}
                    onChange={(e) => setNewProductForm({ ...newProductForm, processor: e.target.value })}
                    placeholder="مثال: Snapdragon 8 Gen 3 یا Apple A17 Pro"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    صفحه نمایش (Display)
                  </label>
                  <input
                    type="text"
                    value={newProductForm.display}
                    onChange={(e) => setNewProductForm({ ...newProductForm, display: e.target.value })}
                    placeholder="مثال: Dynamic AMOLED 2X 120Hz"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  توضیحات و مشخصات کاربردی
                </label>
                <textarea
                  rows={3}
                  value={newProductForm.description}
                  onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })}
                  placeholder="توضیحات تکمیلی، مواد بدنه و امکانات ویژه محصول..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-blue-500 leading-relaxed"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/[0.08] text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProduct}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>{isSubmittingProduct ? 'در حال ثبت...' : 'ذخیره محصول در پایگاه داده'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
