import React, { useState } from 'react';
import { useCart } from '../context/CartContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { Address, Order } from '../types/index.ts';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { items, totalAmount, clearCart } = useCart();
  const { user, token, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [recipientName, setRecipientName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [province, setProvince] = useState('تهران');
  const [city, setCity] = useState('تهران');
  const [postalAddress, setPostalAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [paymentGateway, setPaymentGateway] = useState('درگاه زرین‌پال شاپرک');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'details' | 'gateway' | 'completed'>('details');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  if (!isOpen) return null;

  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="w-full max-w-md rounded-3xl p-6 sm:p-8 border shadow-2xl bg-white dark:bg-[#121215] border-slate-200 dark:border-white/[0.06] text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500 mx-auto mb-4">
            <span className="material-symbols-outlined text-2xl">lock</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            ورود به حساب کاربری الزامی است
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
            برای ثبت سفارش رسمی، اختصاص فاکتور و پیگیری آنلاین مرسوله، لطفاً ابتدا وارد حساب خود شوید.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                onClose();
                openAuthModal('login');
              }}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              ورود به حساب
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-white/[0.08] text-xs text-zinc-400 hover:text-white"
            >
              انصراف
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postalAddress || !phone || !recipientName) {
      showToast('لطفاً تمامی فیلدهای آدرس و گیرنده را تکمیل کنید.', 'error');
      return;
    }

    setIsSubmitting(true);
    const shippingAddress: Address = {
      id: `addr-${Date.now()}`,
      userId: user.id,
      title: 'آدرس تحویل سفارش',
      recipientName,
      phone,
      province,
      city,
      postalAddress,
      postalCode,
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          shippingAddress,
          paymentMethod: paymentGateway,
        }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (!res.ok) {
        showToast(data.error || 'خطا در ثبت سفارش.', 'error');
        return;
      }

      setCreatedOrder(data.order);
      setStep('completed');
      clearCart();
      showToast('سفارش شما با موفقیت ثبت شد!', 'success');
      onSuccess(data.order);
    } catch (err) {
      setIsSubmitting(false);
      showToast('خطا در ارتباط با سرور.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-3xl p-6 sm:p-8 border shadow-2xl bg-white dark:bg-[#121215] border-slate-200 dark:border-white/[0.06] text-right max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {step !== 'completed' && (
          <button
            onClick={onClose}
            className="absolute left-6 top-6 p-1.5 rounded-full text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}

        {step === 'details' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined text-xl">local_shipping</span>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  اطلاعات تحویل و پرداخت
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  مجموع فاکتور: {totalAmount.toLocaleString('en-US')} تومان (ارسال اختصاصی رایگان)
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitOrder} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    نام و نام خانوادگی تحویل‌گیرنده
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="مثال: پوریا بهرامی"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    شماره تماس همراه
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09121234567"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    استان
                  </label>
                  <input
                    type="text"
                    required
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    شهر
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  آدرس دقیق پستی
                </label>
                <textarea
                  required
                  rows={2}
                  value={postalAddress}
                  onChange={(e) => setPostalAddress(e.target.value)}
                  placeholder="خیابان، کوچه، پلاک، واحد..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  کد پستی 10 رقمی (اختیاری)
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="1987654321"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none text-left"
                  dir="ltr"
                />
              </div>

              {/* Payment Gateway Picker */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  انتخاب درگاه پرداخت الکترونیک شاپرک
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentGateway('درگاه زرین‌پال شاپرک')}
                    className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between ${
                      paymentGateway === 'درگاه زرین‌پال شاپرک'
                        ? 'border-blue-500 bg-blue-500/10 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold">زرین‌پال (شاپرک)</p>
                      <span className="text-[10px] text-zinc-500">کارت‌های عضو شتاب</span>
                    </div>
                    <span className="material-symbols-outlined text-blue-500 text-base">check_circle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentGateway('درگاه بانک سامان کیش')}
                    className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between ${
                      paymentGateway === 'درگاه بانک سامان کیش'
                        ? 'border-blue-500 bg-blue-500/10 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold">سامان کیش (SEP)</p>
                      <span className="text-[10px] text-zinc-500">پرداخت امن شاپرک</span>
                    </div>
                    <span className="material-symbols-outlined text-blue-500 text-base">account_balance</span>
                  </button>
                </div>
              </div>

              {/* Transparent Gateway Note */}
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-[11px] text-blue-400/90 leading-relaxed">
                <span className="font-semibold block mb-0.5">شناسه درگاه متصل:</span>
                تراکنش شما مستقیماً در بستر رمزنگاری‌شده SSL پردازش و سفارش با استعلام مجدد موجودی انبار ثبت قطعی می‌گردد.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-[0_0_24px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">verified</span>
                    <span>تأیید و پرداخت نهایی ({totalAmount.toLocaleString('en-US')} تومان)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {step === 'completed' && createdOrder && (
          <div className="flex flex-col items-center justify-center text-center py-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <span className="material-symbols-outlined text-3xl">check</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-1">
              سفارش شما با موفقیت ثبت شد
            </h3>
            <p className="font-mono text-sm text-blue-400 font-semibold tracking-wider mb-4">
              شماره سفارش: {createdOrder.orderNumber}
            </p>
            <div className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-[#18181c] border border-slate-200 dark:border-white/[0.06] text-right text-xs space-y-2 mb-6">
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>خریدار:</span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {createdOrder.userName}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>مبلغ پرداختی:</span>
                <span className="text-slate-900 dark:text-white font-bold font-mono">
                  {createdOrder.totalAmount.toLocaleString('en-US')} تومان
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>وضعیت:</span>
                <span className="text-emerald-400 font-semibold">پرداخت موفق • در حال آماده‌سازی مرسوله</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>کد رهگیری تراکنش:</span>
                <span className="font-mono text-blue-400">{createdOrder.transaction?.trackingCode}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            >
              مشاهده وضعیت سفارش در پیشخوان
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
