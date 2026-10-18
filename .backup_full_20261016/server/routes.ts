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
import { isSupabaseConfigured, testSupabaseConnection, getDataConnectionStatus } from './supabase.ts';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & USER MANAGEMENT
// ==========================================

apiRouter.post('/auth/register', rateLimiter(15, 60000), (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'نام، ایمیل و کلمه عبور الزامی هستند.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'کلمه عبور باید حداقل 6 کاراکتر باشد.' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'کاربری با این نشانی ایمیل قبلاً ثبت‌نام نموده است.' });
  }

  const { salt, hash } = generatePasswordHash(password);
  const newUser = db.createUser({
    name,
    email: email.trim().toLowerCase(),
    role: 'customer',
    phone: phone || '',
    passwordHash: hash,
    salt,
  });

  const token = createToken(newUser);
  return res.status(201).json({
    message: 'ثبت‌نام با موفقیت انجام شد.',
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
      avatar: newUser.avatar,
    },
  });
});

apiRouter.post('/auth/login', rateLimiter(20, 60000), (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'لطفاً ایمیل و کلمه عبور را وارد کنید.' });
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'ایمیل یا کلمه عبور اشتباه است.' });
  }

  const isValid = verifyPassword(password, user.salt, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'ایمیل یا کلمه عبور اشتباه است.' });
  }

  const token = createToken(user);
  db.addAuditLog(user.id, user.name, 'LOGIN', 'User', 'ورود موفق به حساب کاربری', req.ip);

  return res.json({
    message: 'ورود موفقیت‌آمیز بود.',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
    },
  });
});

apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
  });
});

apiRouter.post('/auth/forgot-password', rateLimiter(10, 60000), (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'ایمیل الزامی است.' });
  }
  const user = db.getUserByEmail(email);
  if (!user) {
    return res.json({ message: 'در صورت ثبت بودن ایمیل، دستورالعمل بازیابی رمز ارسال گردید.' });
  }
  return res.json({
    message: 'لینک بازیابی رمز عبور به ایمیل شما ارسال شد. (برای تست: رمز عبور حساب شما بدون تغییر فعال است)',
  });
});

// ==========================================
// 2. PRODUCT CATALOG & SEARCH
// ==========================================

apiRouter.get('/products', (req: Request, res: Response) => {
  let products = db.getProducts();
  const { q, category, brand, sort, minPrice, maxPrice } = req.query;

  if (q && typeof q === 'string') {
    const term = q.trim().toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.nameEn.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.tags.some((t) => t.toLowerCase().includes(term))
    );
  }

  if (category && typeof category === 'string' && category !== 'all') {
    products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }

  if (brand && typeof brand === 'string' && brand !== 'all') {
    products = products.filter((p) => p.brand.toLowerCase() === brand.toLowerCase());
  }

  if (minPrice && !isNaN(Number(minPrice))) {
    products = products.filter((p) => p.basePrice >= Number(minPrice));
  }

  if (maxPrice && !isNaN(Number(maxPrice))) {
    products = products.filter((p) => p.basePrice <= Number(maxPrice));
  }

  // Sorting
  if (sort === 'price-asc') {
    products.sort((a, b) => a.basePrice - b.basePrice);
  } else if (sort === 'price-desc') {
    products.sort((a, b) => b.basePrice - a.basePrice);
  } else if (sort === 'rating') {
    products.sort((a, b) => b.rating - a.rating);
  } else if (sort === 'popular') {
    products.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
  }

  return res.json({ products });
});

apiRouter.get('/products/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const product = db.getProductById(id);

  if (!product) {
    return res.status(404).json({ error: 'محصول مورد نظر یافت نشد.' });
  }

  const reviews = db.getReviews(product.id);
  const related = db
    .getProducts()
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return res.json({ product, reviews, relatedProducts: related });
});

apiRouter.get('/categories', (_req: Request, res: Response) => {
  return res.json({ categories: db.getCategories() });
});

apiRouter.get('/brands', (_req: Request, res: Response) => {
  return res.json({ brands: db.getBrands() });
});

apiRouter.get('/campaigns/active', (_req: Request, res: Response) => {
  const activeCampaign = db.getActiveCampaign();
  return res.json({ campaign: activeCampaign || null });
});

// ==========================================
// 3. PERSISTENT SHOPPING CART
// ==========================================

apiRouter.get('/cart', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user ? req.user.id : 'guest-user';
  const cart = db.getCart(userId);
  return res.json({ cart });
});

apiRouter.post('/cart', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user ? req.user.id : 'guest-user';
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'اقلام سبد خرید باید آرایه باشند.' });
  }

  const updatedCart = db.saveCart(userId, items);
  return res.json({ cart: updatedCart });
});

// ==========================================
// 4. ORDERS & CHECKOUT
// ==========================================

apiRouter.get('/orders', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const orders = db.getOrders(userId);
  return res.json({ orders });
});

apiRouter.get('/orders/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const order = db.getOrderById(id);

  if (!order) {
    return res.status(404).json({ error: 'سفارش یافت نشد.' });
  }

  // Ensure customer can only see their own order unless admin
  if (req.user!.role !== 'admin' && order.userId !== req.user!.id) {
    return res.status(403).json({ error: 'عدم دسترسی به اطلاعات این سفارش.' });
  }

  return res.json({ order });
});

apiRouter.post('/orders', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { items, shippingAddress, paymentMethod } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'سبد خرید خالی است.' });
  }

  if (!shippingAddress || !shippingAddress.recipientName || !shippingAddress.postalAddress || !shippingAddress.phone) {
    return res.status(400).json({ error: 'مشخصات کامل آدرس تحویل‌گیرنده الزامی است.' });
  }

  const result = db.createOrder({
    userId: req.user!.id,
    items,
    shippingAddress,
    paymentMethod: paymentMethod || 'درگاه آنلاین شاپرک',
  });

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

apiRouter.post('/reviews', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { productId, rating, comment } = req.body;

  if (!productId || !rating || !comment) {
    return res.status(400).json({ error: 'شناسه کالا، امتیاز و متن نظر الزامی هستند.' });
  }

  const review = db.addReview({
    productId,
    userId: req.user!.id,
    userName: req.user!.name,
    rating: Number(rating),
    comment: comment.trim(),
    isVerifiedPurchase: true,
  });

  return res.status(201).json({ message: 'دیدگاه شما با موفقیت ثبت شد.', review });
});

apiRouter.get('/favorites', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const favorites = db.getFavorites(req.user!.id);
  return res.json({ favorites });
});

apiRouter.post('/favorites/toggle', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'شناسه محصول الزامی است.' });
  }
  const result = db.toggleFavorite(req.user!.id, productId);
  return res.json(result);
});

apiRouter.get('/addresses', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const addresses = db.getAddresses(req.user!.id);
  return res.json({ addresses });
});

apiRouter.post('/addresses', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { title, recipientName, phone, province, city, postalAddress, postalCode } = req.body;

  if (!recipientName || !phone || !postalAddress) {
    return res.status(400).json({ error: 'اطلاعات گیرنده و آدرس پستی الزامی است.' });
  }

  const address = db.addAddress({
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

apiRouter.delete('/addresses/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteAddress(req.user!.id, req.params.id);
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
  const metrics = db.getAdminMetrics();
  const connectionStatus = await getDataConnectionStatus();
  return res.json({
    ...metrics,
    connectionStatus,
  });
});

apiRouter.post('/admin/products', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const productData = req.body;
  if (!productData.name || !productData.basePrice) {
    return res.status(400).json({ error: 'نام و قیمت پایه کالا الزامی است.' });
  }
  const newProduct = db.createProduct(productData, req.user!);
  return res.status(201).json({ product: newProduct });
});

apiRouter.put('/admin/products/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updateProduct(req.params.id, req.body, req.user!);
  if (!updated) return res.status(404).json({ error: 'محصول یافت نشد.' });
  return res.json({ product: updated });
});

apiRouter.delete('/admin/products/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const ok = db.deleteProduct(req.params.id, req.user!);
  return res.json({ success: ok });
});

apiRouter.put('/admin/inventory/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { stock } = req.body;
  const product = db.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'محصول یافت نشد.' });

  const updated = db.updateProduct(product.id, { stockTotal: Number(stock) }, req.user!);
  return res.json({ product: updated });
});

apiRouter.get('/admin/orders', authenticateToken, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ orders: db.getOrders() });
});

apiRouter.put('/admin/orders/:id/status', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  const updated = db.updateOrderStatus(req.params.id, status, req.user!);
  if (!updated) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  return res.json({ order: updated });
});

apiRouter.get('/admin/campaigns', authenticateToken, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ campaigns: db.getCampaigns() });
});

apiRouter.post('/admin/campaigns', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const camp = db.createCampaign(req.body, req.user!);
  return res.status(201).json({ campaign: camp });
});

apiRouter.put('/admin/campaigns/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const camp = db.updateCampaign(req.params.id, req.body, req.user!);
  if (!camp) return res.status(404).json({ error: 'کمپین یافت نشد.' });
  return res.json({ campaign: camp });
});

apiRouter.get('/admin/audit-logs', authenticateToken, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ logs: db.getAuditLogs() });
});

apiRouter.post('/admin/upload-image', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
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
    const outPath = path.resolve(process.cwd(), 'public/images/products', safeName);
    fs.writeFileSync(outPath, buffer);

    return res.json({
      url: `/images/products/${safeName}`,
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

