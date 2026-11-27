import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db, generatePasswordHash, verifyPassword } from './db.ts';
import {
  authenticateToken,
  requireAdmin,
  optionalAuth,
  createToken,
  rateLimiter,
  type AuthenticatedRequest,
} from './auth.ts';
import { generateShoppingAdvice } from './ai.ts';
import {
  isSupabaseConfigured,
  testSupabaseConnection,
  getDataConnectionStatus,
  getProductsFromSupabase,
  getProductByIdFromSupabase,
  getCategoriesFromSupabase,
  getBrandsFromSupabase,
  getActiveCampaignFromSupabase,
  getCampaignsFromSupabase,
  saveCampaignInSupabase,
  getOrdersFromSupabase,
  createOrderInSupabase,
  updateOrderStatusInSupabase,
  updateInventoryStockInSupabase,
  getFavoritesFromSupabase,
  toggleFavoriteInSupabase,
  getAdminMetricsFromSupabase,
  getAuditLogsFromSupabase,
  authenticateOrMigrateUser,
  registerUserWithSupabase,
  addAuditLogInSupabase,
  uploadImageToSupabaseStorage,
  getCartFromSupabase,
  saveCartInSupabase,
  getAddressesFromSupabase,
  addAddressInSupabase,
  deleteAddressInSupabase,
  getReviewsFromSupabase,
  addReviewInSupabase,
  updateReviewInSupabase,
  deleteReviewInSupabase,
  toggleHelpfulReviewInSupabase,
  getAllReviewsFromSupabase,
  updateReviewStatusInSupabase,
  createProductInSupabase,
  updateProductInSupabase,
  deleteProductInSupabase,
} from './supabase.ts';

// High-performance in-memory cache for fast storefront rendering
let productsCache: { timestamp: number; data: any } | null = null;
let activeCampaignCache: { timestamp: number; data: any } | null = null;
const CACHE_TTL_MS = 25000;

export function invalidateProductsCache() {
  productsCache = null;
}
export function invalidateCampaignCache() {
  activeCampaignCache = null;
}

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & USER MANAGEMENT
// ==========================================

apiRouter.post('/auth/register', rateLimiter(15, 60000), async (req: Request, res: Response) => {
  const { name, username, email, password, phone } = req.body;
  const identifier = String(username || email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim();

  if (!name || !identifier || !password || !cleanPhone) {
    return res.status(400).json({ error: 'نام، نام کاربری، شماره موبایل و کلمه عبور الزامی هستند.' });
  }

  if (identifier.length < 3) {
    return res.status(400).json({ error: 'نام کاربری باید حداقل ۳ کاراکتر باشد.' });
  }

  if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
    return res.status(400).json({ error: 'لطفاً شماره موبایل معتبر وارد کنید.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'کلمه عبور باید حداقل 6 کاراکتر باشد.' });
  }

  const result = await registerUserWithSupabase(String(name).trim(), identifier, password, cleanPhone);
  if (!result.success || !result.user) {
    return res.status(400).json({ error: result.error || 'خطا در ثبت‌نام کاربر.' });
  }

  const token = createToken(result.user);
  return res.status(201).json({
    message: 'ثبت‌نام با موفقیت انجام شد.',
    token,
    user: {
      id: result.user.id,
      name: result.user.name,
      username: result.user.username || result.user.email,
      email: result.user.email,
      role: result.user.role,
      phone: result.user.phone,
      avatar: result.user.avatar,
    },
  });
});

apiRouter.post('/auth/login', rateLimiter(20, 60000), async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  const identifier = String(username || email || '').trim().toLowerCase();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'لطفاً نام کاربری و کلمه عبور را وارد کنید.' });
  }

  const result = await authenticateOrMigrateUser(identifier, password);
  if (!result.success || !result.user) {
    return res.status(401).json({ error: result.error || 'نام کاربری یا کلمه عبور اشتباه است.' });
  }

  const token = createToken(result.user);
  await addAuditLogInSupabase(result.user.id, result.user.name, 'LOGIN', 'User', 'ورود موفق به حساب کاربری', req.ip);

  return res.json({
    message: 'ورود موفقیت‌آمیز بود.',
    token,
    user: {
      id: result.user.id,
      name: result.user.name,
      username: result.user.username || result.user.email,
      email: result.user.email,
      role: result.user.role,
      phone: result.user.phone,
      avatar: result.user.avatar,
    },
  });
});

apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  return res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username || user.email,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
  });
});

// ==========================================
// 2. PRODUCT CATALOG & SEARCH
// ==========================================

apiRouter.get('/products', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { q, category, brand, sort, minPrice, maxPrice } = req.query;

  const isDefaultQuery = !q && !category && !brand && !sort && !minPrice && !maxPrice;
  const now = Date.now();

  if (isDefaultQuery && productsCache && now - productsCache.timestamp < CACHE_TTL_MS) {
    return res.json({ products: productsCache.data });
  }

  const products = await getProductsFromSupabase({
    q: typeof q === 'string' ? q : undefined,
    category: typeof category === 'string' ? category : undefined,
    brand: typeof brand === 'string' ? brand : undefined,
    sort: typeof sort === 'string' ? sort : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  });

  if (isDefaultQuery) {
    productsCache = { timestamp: now, data: products };
  }

  return res.json({ products });
});

apiRouter.get('/products/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const product = await getProductByIdFromSupabase(id);

  if (!product) {
    return res.status(404).json({ error: 'محصول مورد نظر یافت نشد.' });
  }

  const reviews = await getReviewsFromSupabase(product.id, { status: 'approved' });
  const allProds = await getProductsFromSupabase();
  const related = allProds
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return res.json({ product, reviews, relatedProducts: related });
});

apiRouter.get('/products/:id/reviews', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 5;
  const sortBy = (req.query.sortBy as string) || 'newest';

  const product = await getProductByIdFromSupabase(id);
  if (!product) {
    return res.status(404).json({ error: 'محصول یافت نشد.' });
  }

  const allReviews = await getReviewsFromSupabase(product.id, { status: 'approved' });
  const stats = db.getReviewStats(product.id);

  let sorted = [...allReviews];
  if (sortBy === 'highest-rating') {
    sorted.sort((a, b) => b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortBy === 'lowest-rating') {
    sorted.sort((a, b) => a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortBy === 'most-helpful') {
    sorted.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const total = sorted.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedReviews = sorted.slice(startIndex, startIndex + limit);

  const userReview = req.user ? db.getUserProductReview(req.user.id, product.id) : null;
  const isVerifiedPurchase = req.user ? db.isUserVerifiedPurchase(req.user.id, product.id) : false;

  return res.json({
    reviews: paginatedReviews,
    total,
    page,
    totalPages,
    stats,
    userReview,
    isVerifiedPurchase,
  });
});

apiRouter.get('/categories', async (_req: Request, res: Response) => {
  const categories = await getCategoriesFromSupabase();
  return res.json({ categories });
});

apiRouter.get('/brands', async (_req: Request, res: Response) => {
  const brands = await getBrandsFromSupabase();
  return res.json({ brands });
});

apiRouter.get('/campaigns/active', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const now = Date.now();
  if (activeCampaignCache && now - activeCampaignCache.timestamp < CACHE_TTL_MS) {
    const cached = activeCampaignCache.data;
    if (!cached) {
      return res.json({ campaign: null });
    }
    const start = new Date(cached.startDate).getTime();
    const end = new Date(cached.endDate).getTime();
    if (cached.isActive && !Number.isNaN(start) && !Number.isNaN(end) && start <= now && end >= now) {
      return res.json({ campaign: cached });
    }
    activeCampaignCache = null;
  }

  const activeCampaign = await getActiveCampaignFromSupabase();
  activeCampaignCache = { timestamp: now, data: activeCampaign || null };
  return res.json({ campaign: activeCampaign || null });
});

// ==========================================
// 3. PERSISTENT SHOPPING CART
// ==========================================

apiRouter.get('/cart', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user ? req.user.id : 'guest-user';
  const cart = await getCartFromSupabase(userId);
  return res.json({ cart });
});

apiRouter.post('/cart', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user ? req.user.id : 'guest-user';
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'اقلام سبد خرید باید آرایه باشند.' });
  }

  const updatedCart = await saveCartInSupabase(userId, items);
  return res.json({ cart: updatedCart });
});

// ==========================================
// 4. ORDERS & CHECKOUT
// ==========================================

apiRouter.get('/orders', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;
  const orders = await getOrdersFromSupabase(userId, false, userEmail);
  return res.json({ orders });
});

apiRouter.get('/orders/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const allOrders = await getOrdersFromSupabase(undefined, true);
  const order = allOrders.find((o) => o.id === id || o.orderNumber === id);

  if (!order) {
    return res.status(404).json({ error: 'سفارش یافت نشد.' });
  }

  // Ensure customer can only see their own order unless admin
  if (req.user!.role !== 'admin' && order.userId !== req.user!.id) {
    return res.status(403).json({ error: 'عدم دسترسی به اطلاعات این سفارش.' });
  }

  return res.json({ order });
});

apiRouter.post('/orders', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { items, shippingAddress, paymentMethod } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'سبد خرید خالی است.' });
  }

  if (!shippingAddress || !shippingAddress.recipientName || !shippingAddress.postalAddress || !shippingAddress.phone) {
    return res.status(400).json({ error: 'مشخصات کامل آدرس تحویل‌گیرنده الزامی است.' });
  }

  const result = await createOrderInSupabase(
    { items, shippingAddress, paymentMethod },
    req.user!.id,
    req.user!
  );

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json({
    message: 'سفارش با موفقیت ثبت شد.',
    order: result.order,
  });
});

// Payment gateway configuration helper & checkout intent
apiRouter.post('/payments/checkout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { items, shippingAddress } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'اقلام سفارش خالی است.' });
  }

  // Calculate re-validated amount on server
  let totalAmount = 0;
  for (const item of items) {
    const product = db.getProductById(item.productId);
    if (!product) return res.status(400).json({ error: `محصول ${item.productId} معتبر نیست.` });
    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant) return res.status(400).json({ error: 'تنوع محصول معتبر نیست.' });
    if (variant.stock < item.quantity) {
      return res.status(400).json({ error: `موجودی ${product.name} کافی نیست.` });
    }
    totalAmount += variant.price * item.quantity;
  }

  // Return gateway transaction prep
  return res.json({
    gatewayInfo: {
      gatewayName: 'درگاه پرداخت شاپرک / زرین‌پال اختصاصی ولترو',
      merchantId: 'ZP_MERCHANT_LIVE_VOLTRO_LUXURY_XXXX',
      mode: 'sandbox_or_live_ready',
      amount: totalAmount,
      currency: 'IRR',
      callbackUrl: `${req.protocol}://${req.get('host')}/order-confirmation`,
      note: 'درگاه به صورت ساختارمند آماده اتصال به کلید زرین‌پال یا سامان‌کیش است. در محیط دمو، تراکنش پس از تأیید شبیه‌سازی و سفارش در دیتابیس ثبت می‌گردد.',
    },
  });
});

// ==========================================
// 5. REVIEWS, FAVORITES, ADDRESSES
// ==========================================

apiRouter.post('/reviews', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { productId, rating, comment } = req.body;

  if (!productId || rating === undefined || !comment) {
    return res.status(400).json({ error: 'شناسه کالا، امتیاز و متن نظر الزامی هستند.' });
  }

  const numericRating = Number(rating);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'امتیاز باید عددی بین ۱ تا ۵ باشد.' });
  }

  const trimmedComment = String(comment).trim();
  if (trimmedComment.length < 3) {
    return res.status(400).json({ error: 'متن نظر باید حداقل ۳ کاراکتر باشد.' });
  }

  // Prevent multiple reviews from same user on the same product
  const existing = db.getUserProductReview(req.user!.id, productId);
  if (existing) {
    return res.status(400).json({
      error: 'شما قبلاً برای این محصول دیدگاه ثبت کرده‌اید. می‌توانید دیدگاه قبلی خود را ویرایش کنید.',
      existingReviewId: existing.id,
    });
  }

  const isVerified = db.isUserVerifiedPurchase(req.user!.id, productId);

  const review = await addReviewInSupabase({
    productId,
    userId: req.user!.id,
    userName: req.user!.name,
    rating: numericRating,
    comment: trimmedComment,
    isVerifiedPurchase: isVerified,
    status: 'approved',
  });

  invalidateProductsCache();
  return res.status(201).json({ message: 'دیدگاه شما با موفقیت ثبت شد.', review });
});

apiRouter.put('/reviews/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { rating, comment } = req.body;
  const reviewId = req.params.id;

  if (rating !== undefined) {
    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'امتیاز باید عددی بین ۱ تا ۵ باشد.' });
    }
  }

  const isAdmin = req.user?.role === 'admin';
  const result = await updateReviewInSupabase(reviewId, req.user!.id, { rating, comment }, isAdmin);

  if (!result.success) {
    return res.status(400).json({ error: result.error || 'خطا در ویرایش نظر.' });
  }

  invalidateProductsCache();
  return res.json({ message: 'دیدگاه با موفقیت ویرایش شد.', review: result.review });
});

apiRouter.delete('/reviews/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const reviewId = req.params.id;
  const isAdmin = req.user?.role === 'admin';
  const result = await deleteReviewInSupabase(reviewId, req.user!.id, isAdmin);

  if (!result.success) {
    return res.status(400).json({ error: result.error || 'خطا در حذف نظر.' });
  }

  invalidateProductsCache();
  return res.json({ message: 'دیدگاه با موفقیت حذف شد.' });
});

apiRouter.post('/reviews/:id/helpful', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const reviewId = req.params.id;
  const result = await toggleHelpfulReviewInSupabase(reviewId, req.user!.id);
  return res.json(result);
});

apiRouter.get('/favorites', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const favorites = await getFavoritesFromSupabase(req.user!.id);
  return res.json({ favorites });
});

apiRouter.post('/favorites/toggle', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'شناسه محصول الزامی است.' });
  }
  const result = await toggleFavoriteInSupabase(req.user!.id, productId);
  return res.json(result);
});

apiRouter.get('/addresses', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const addresses = await getAddressesFromSupabase(req.user!.id);
  return res.json({ addresses });
});

apiRouter.post('/addresses', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { title, recipientName, phone, province, city, postalAddress, postalCode } = req.body;

  if (!recipientName || !phone || !postalAddress) {
    return res.status(400).json({ error: 'اطلاعات گیرنده و آدرس پستی الزامی است.' });
  }

  const address = await addAddressInSupabase({
    userId: req.user!.id,
    title: title || 'آدرس تحویل',
    recipientName,
    phone,
    province: province || 'تهران',
    city: city || 'تهران',
    postalAddress,
    postalCode: postalCode || '',
  });

  return res.status(201).json({ address });
});

apiRouter.delete('/addresses/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const success = await deleteAddressInSupabase(req.user!.id, req.params.id);
  return res.json({ success });
});

// ==========================================
// 6. AI SHOPPING ASSISTANT
// ==========================================

apiRouter.post('/ai/chat', rateLimiter(30, 60000), optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'متن پیام الزامی است.' });
  }

  try {
    const advice = await generateShoppingAdvice({
      message: message.trim(),
      history,
    });

    // If authenticated, persist to conversation history
    if (req.user) {
      const convos = db.getConversations(req.user.id);
      let activeConvo = convos[0];
      if (!activeConvo) {
        activeConvo = {
          id: `convo-${Date.now()}`,
          userId: req.user.id,
          title: message.slice(0, 30),
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      activeConvo.messages.push({
        id: `msg-${Date.now()}-u`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });

      activeConvo.messages.push({
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: advice.reply,
        timestamp: new Date().toISOString(),
        recommendedProducts: advice.recommendedProducts,
      });

      activeConvo.updatedAt = new Date().toISOString();
      db.saveConversation(activeConvo);
    }

    return res.json(advice);
  } catch (err: unknown) {
    console.error('Error in AI shopping chat endpoint:', err);
    return res.status(500).json({
      error: 'خطا در ارتباط با دستیار هوشمند. لطفاً مجدداً امتحان کنید.',
    });
  }
});

apiRouter.get('/ai/history', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const convos = db.getConversations(req.user!.id);
  return res.json({ conversations: convos });
});

// ==========================================
// 7. ADMIN DASHBOARD & MANAGEMENT
// ==========================================

apiRouter.get('/admin/metrics', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const metrics = await getAdminMetricsFromSupabase();
  return res.json(metrics);
});

apiRouter.post('/admin/products', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const productData = req.body;
  if (!productData.name || !productData.basePrice) {
    return res.status(400).json({ error: 'نام و قیمت پایه کالا الزامی است.' });
  }
  const result = await createProductInSupabase(productData, req.user!);
  if (!result.success || !result.product) {
    return res.status(400).json({ error: result.error || 'خطا در ثبت محصول در پایگاه داده.' });
  }
  invalidateProductsCache();
  return res.status(201).json({ product: result.product });
});

apiRouter.put('/admin/products/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const result = await updateProductInSupabase(req.params.id, req.body, req.user!);
  if (!result.success || !result.product) {
    return res.status(400).json({ error: result.error || 'محصول یافت نشد یا بروزرسانی ناموفق بود.' });
  }
  invalidateProductsCache();
  return res.json({ product: result.product });
});

apiRouter.delete('/admin/products/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const result = await deleteProductInSupabase(req.params.id, req.user!);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'خطا در حذف محصول از دیتابیس.' });
  }
  invalidateProductsCache();
  return res.json({ success: true });
});

apiRouter.put('/admin/inventory/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { stock } = req.body;
  const ok = await updateInventoryStockInSupabase(req.params.id, Number(stock), req.user!);
  const product = await getProductByIdFromSupabase(req.params.id);
  if (!product) return res.status(404).json({ error: 'محصول یافت نشد.' });
  invalidateProductsCache();
  return res.json({ product, success: ok });
});

apiRouter.get('/admin/orders', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const orders = await getOrdersFromSupabase(undefined, true);
  return res.json({ orders });
});

apiRouter.put('/admin/orders/:id/status', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  const ok = await updateOrderStatusInSupabase(req.params.id, status, req.user!);
  const allOrders = await getOrdersFromSupabase(undefined, true);
  const updated = allOrders.find((o) => o.id === req.params.id);
  if (!updated) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  return res.json({ order: updated, success: ok });
});

apiRouter.get('/admin/campaigns', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const campaigns = await getCampaignsFromSupabase();
  return res.json({ campaigns });
});

apiRouter.post('/admin/campaigns', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const campData = {
    ...req.body,
    id: req.body.id || `camp-${Date.now()}`,
  };
  await saveCampaignInSupabase(campData, req.user!);
  invalidateCampaignCache();
  return res.status(201).json({ campaign: campData });
});

apiRouter.put('/admin/campaigns/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const campData = {
    ...req.body,
    id: req.params.id,
  };
  await saveCampaignInSupabase(campData, req.user!);
  invalidateCampaignCache();
  return res.json({ campaign: campData });
});

apiRouter.get('/admin/reviews', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const reviews = await getAllReviewsFromSupabase();
  const products = await getProductsFromSupabase();
  const enriched = reviews.map((r) => {
    const p = products.find((prod) => prod.id === r.productId);
    return {
      ...r,
      productName: p?.name || 'محصول نامشخص',
      productImage: p?.images?.[0] || '',
    };
  });
  return res.json({ reviews: enriched });
});

apiRouter.patch('/admin/reviews/:id/status', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (!['approved', 'pending', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'وضعیت نامعتبر است.' });
  }
  const result = await updateReviewStatusInSupabase(req.params.id, status as any);
  if (!result.success) {
    return res.status(404).json({ error: result.error || 'دیدگاه یافت نشد.' });
  }
  invalidateProductsCache();
  return res.json({ message: 'وضعیت دیدگاه تغییر یافت.', review: result.review });
});

apiRouter.delete('/admin/reviews/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const result = await deleteReviewInSupabase(req.params.id, req.user!.id, true);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'خطا در حذف دیدگاه.' });
  }
  invalidateProductsCache();
  return res.json({ message: 'دیدگاه با موفقیت حذف شد.' });
});

apiRouter.get('/admin/audit-logs', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const logs = await getAuditLogsFromSupabase();
  return res.json({ logs });
});

apiRouter.post('/admin/upload-image', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { imageBase64, filename } = req.body;
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'داده‌های تصویر الزامی است.' });
  }

  try {
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let extension = 'png';

    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
      else if (mime.includes('png')) extension = 'png';
      else if (mime.includes('webp')) extension = 'webp';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(imageBase64, 'base64');
    }

    const safeName = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;
    try {
      const outDir = path.resolve(process.cwd(), 'public/images/products');
      if (fs.existsSync(outDir)) {
        fs.writeFileSync(path.join(outDir, safeName), buffer);
      }
    } catch {
      // In serverless / read-only filesystems (Vercel/Lambda), local writes are safely ignored as Supabase Storage is the source of truth
    }

    const publicUrl = await uploadImageToSupabaseStorage(
      'product-images',
      safeName,
      buffer,
      extension === 'png' ? 'image/png' : 'image/jpeg'
    );

    return res.json({
      url: publicUrl || `/images/products/${safeName}`,
      filename: safeName,
    });
  } catch (err) {
    console.error('Error saving uploaded product image:', err);
    return res.status(500).json({ error: 'خطا در ذخیره تصویر محصول.' });
  }
});


// ==========================================
// 8. SEO: SITEMAP & ROBOTS.TXT
// ==========================================

apiRouter.get('/seo/sitemap.xml', (_req: Request, res: Response) => {
  const products = db.getProducts();
  const categories = db.getCategories();
  const baseUrl = process.env.APP_URL || 'https://voltro.ir';

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/products</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/special-offers</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/ai-assist</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
${categories
  .map(
    (c) => `  <url>
    <loc>${baseUrl}/category/${c.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  )
  .join('\n')}
${products
  .map(
    (p) => `  <url>
    <loc>${baseUrl}/product/${p.slug}</loc>
    <lastmod>${p.createdAt.split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  return res.send(sitemapXml);
});

apiRouter.get('/seo/robots.txt', (_req: Request, res: Response) => {
  const baseUrl = process.env.APP_URL || 'https://voltro.ir';
  const robotsTxt = `User-agent: *
Disallow: /admin
Disallow: /admin/*
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /api/*

Allow: /
Allow: /products
Allow: /product/*
Allow: /categories
Allow: /special-offers
Allow: /ai-assist

Sitemap: ${baseUrl}/api/seo/sitemap.xml
`;
  res.header('Content-Type', 'text/plain');
  return res.send(robotsTxt);
});

// ==========================================
// 9. SUPABASE HEALTH & CONNECTIVITY
// ==========================================

apiRouter.get('/supabase/status', async (_req: Request, res: Response) => {
  const status = await testSupabaseConnection();
  return res.json({
    configured: isSupabaseConfigured(),
    url: process.env.SUPABASE_URL || 'https://hxibukwtqfqwzdijmftq.supabase.co',
    ...status,
  });
});

