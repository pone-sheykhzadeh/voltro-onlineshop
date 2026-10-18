import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { Order, Address, Product } from '../types/index.ts';
import { getBrowserSupabase } from '../lib/supabaseClient.ts';

interface UserAccountPageProps {
  onNavigate: (path: string, id?: string) => void;
}

export const UserAccountPage: React.FC<UserAccountPageProps> = ({ onNavigate }) => {
  const { user, token, logout, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'favorites'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Address form modal/inline
  const [newTitle, setNewTitle] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newProvince, setNewProvince] = useState('تهران');
  const [newCity, setNewCity] = useState('تهران');
  const [newAddress, setNewAddress] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    const loadUserData = () => {
      Promise.all([
        fetch('/api/orders', { headers }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/addresses', { headers }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/favorites', { headers }).then((r) => (r.ok ? r.json() : null)),
      ])
        .then(([ordersData, addrsData, favsData]) => {
          if (ordersData?.orders) setOrders(ordersData.orders);
          if (addrsData?.addresses) setAddresses(addrsData.addresses);
          if (favsData?.favorites) setFavorites(favsData.favorites);
        })
        .catch((err) => console.error(err))
        .finally(() => setIsLoading(false));
    };

    loadUserData();

    // Subscribe to realtime order updates
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel('user-account-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetch('/api/orders', { headers })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.orders) setOrders(data.orders);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient || !newPhone || !newAddress) {
      showToast('لطفاً فیلدهای الزامی را پر کنید.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle || 'آدرس تحویل',
          recipientName: newRecipient,
          phone: newPhone,
          province: newProvince,
          city: newCity,
          postalAddress: newAddress,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddresses([...addresses, data.address]);
        setShowAddressForm(false);
        showToast('آدرس جدید ذخیره شد.', 'success');
      } else {
        showToast(data.error || 'خطا در ثبت آدرس.', 'error');
      }
    } catch (e) {
      showToast('خطا در برقراری ارتباط با سرور.', 'error');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAddresses(addresses.filter((a) => a.id !== id));
        showToast('آدرس با موفقیت حذف شد.', 'info');
      }
    } catch (e) {
      showToast('خطا در حذف آدرس.', 'error');
    }
  };

  if (!user) {
    return (
      <div className="w-full min-h-screen pt-28 flex items-center justify-center p-4 bg-[#F8FAFC] dark:bg-[#0B0B0C]">
        <div className="w-full max-w-md p-8 rounded-3xl border text-center bg-white dark:bg-[#121215] border-slate-200 dark:border-white/[0.06] shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500 mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">account_circle</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            ورود به حساب کاربری
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6 leading-relaxed">
            برای مشاهده تاریخچه سفارش‌ها، آدرس‌های ثبت‌شده و موارد دلخواه وارد حساب شوید.
          </p>
          <button
            onClick={() => openAuthModal('login')}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md"
          >
            ورود یا ثبت‌نام
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen pt-20 transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-10 text-right">
        {/* User Profile Banner - Hidden on Favorites view as requested */}
        {activeTab !== 'favorites' && (
          <div className="p-6 sm:p-8 rounded-3xl border mb-8 flex flex-col sm:flex-row items-center justify-between gap-6 bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-md">
            <div className="flex items-center gap-4">
              <img
                src={user.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDDFf26GXqr-2c3bJ3L1A3MwQX5syyjKNU29_8haSa6wY-ehOAyVT9h0KPPuqZyBeNW-3ZtlnhTQBGbWqAJunHAjm8IELD3Oij-0TKsEVXjgxxSMai0bjZ-a5vjlTaCyC0etuntG4xCLek869jGnUh_zAsTDnZvcGknpApu4InT2qhAaD6_L9EuZXj58x38FBEJTE--zSBsugndzEPNdZBaU1y84sO1B3O1_AoHFWVNCpzx1F7Rflc'}
                alt={user.name}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-blue-500/30"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    {user.name}
                  </h1>
                  {user.role === 'admin' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                      مدیر ارشد
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-1">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user.role === 'admin' && (
                <button
                  onClick={() => onNavigate('admin-dashboard')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">analytics</span>
                  <span>پنل مدیریت</span>
                </button>
              )}
              <button
                onClick={logout}
                className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                <span>خروج از حساب</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 dark:bg-[#141417] p-1 rounded-2xl border border-slate-200 dark:border-white/[0.06] mb-8 max-w-md">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            سفارشات من ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('addresses')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'addresses'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            آدرس‌های تحویل ({addresses.length})
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'favorites'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            علاقه‌مندی‌ها ({favorites.length})
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500 rounded-2xl border border-dashed border-white/[0.08]">
                هنوز سفارشی ثبت نکرده‌اید.
              </div>
            ) : (
              orders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-6 rounded-2xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-bold text-blue-400">
                        {ord.orderNumber}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          ord.status === 'delivered'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {ord.status === 'delivered' ? 'تحویل شد' : 'در حال آماده‌سازی و ارسال'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-zinc-400">
                        مبلغ کل: <strong className="text-slate-900 dark:text-white font-mono">{ord.totalAmount.toLocaleString('en-US')} تومان</strong>
                      </span>
                      <span className="text-zinc-500 font-mono text-[11px]">
                        {new Date(ord.createdAt).toLocaleDateString('en-CA')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    {ord.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image}
                            alt=""
                            className="w-10 h-10 object-contain rounded-lg bg-zinc-900 p-1"
                          />
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {item.productName}
                            </span>
                            <span className="text-[11px] text-zinc-500 block">{item.variantTitle}</span>
                          </div>
                        </div>
                        <span className="font-mono text-zinc-300">
                          {item.quantity} عدد × {item.price.toLocaleString('en-US')} ت
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: ADDRESSES */}
        {activeTab === 'addresses' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                دفترچه نشانی‌ها
              </h3>
              <button
                onClick={() => setShowAddressForm(!showAddressForm)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>افزودن آدرس جدید</span>
              </button>
            </div>

            {showAddressForm && (
              <form onSubmit={handleAddAddress} className="p-6 rounded-2xl border bg-slate-50 dark:bg-[#161619] border-slate-200 dark:border-white/[0.06] mb-6 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">تحویل‌گیرنده:</label>
                    <input
                      type="text"
                      required
                      value={newRecipient}
                      onChange={(e) => setNewRecipient(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-[#121214] border border-white/[0.08] text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">شماره تماس:</label>
                    <input
                      type="tel"
                      required
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-[#121214] border border-white/[0.08] text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">آدرس کامل:</label>
                  <textarea
                    rows={2}
                    required
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[#121214] border border-white/[0.08] text-white outline-none resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold self-start"
                >
                  ذخیره آدرس
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((a) => (
                <div
                  key={a.id}
                  className="p-5 rounded-2xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {a.title}
                      </span>
                      <button
                        onClick={() => handleDeleteAddress(a.id)}
                        className="text-zinc-500 hover:text-rose-400 text-xs"
                      >
                        حذف
                      </button>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                      {a.province}، {a.city}، {a.postalAddress}
                    </p>
                    <div className="mt-3 text-[11px] text-zinc-500 font-mono">
                      گیرنده: {a.recipientName} ({a.phone})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: FAVORITES */}
        {activeTab === 'favorites' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {favorites.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-zinc-500 rounded-2xl border border-dashed border-white/[0.08]">
                کالایی در لیست علاقه‌مندی‌ها موجود نیست.
              </div>
            ) : (
              favorites.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onNavigate('product-details', p.id)}
                  className="cursor-pointer p-4 rounded-2xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06]"
                >
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    className="product-cutout w-full h-32 object-contain mb-3"
                  />
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {p.name}
                  </h4>
                  <span className="text-xs font-mono text-blue-400 font-bold block mt-1">
                    {p.basePrice.toLocaleString('en-US')} تومان
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
