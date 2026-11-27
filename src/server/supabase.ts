import dotenv from 'dotenv';
dotenv.config();

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Product,
  ProductVariant,
  Category,
  Brand,
  Order,
  OrderItem,
  FlashCampaign,
  AuditLog,
  PaymentTransaction,
  Address,
  Review,
  CartItem,
} from '../types/index.ts';
import { db, verifyPassword, generatePasswordHash } from './db.ts';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://hxibukwtqfqwzdijmftq.supabase.co').trim().replace(/\/+$/, '');
const SUPABASE_KEY =
  (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim()) ||
  (process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_PUBLISHABLE_KEY.trim()) ||
  (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.trim()) ||
  '';

let supabaseClient: SupabaseClient | null = null;
let supabaseCooldownUntil = 0;
const SUPABASE_COOLDOWN_MS = 60_000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value?: string | null): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function isNetworkError(errOrMsg: unknown): boolean {
  const msg =
    typeof errOrMsg === 'string'
      ? errOrMsg
      : errOrMsg instanceof Error
      ? `${errOrMsg.name} ${errOrMsg.message}`
      : String(errOrMsg || '');
  return /fetch failed|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network|AbortError/i.test(msg);
}

function getActiveSupabase(): SupabaseClient | null {
  if (!supabaseClient) return null;
  if (Date.now() < supabaseCooldownUntil) return null;
  return supabaseClient;
}

function noteSupabaseFailure(errOrMsg: unknown): void {
  if (isNetworkError(errOrMsg)) {
    supabaseCooldownUntil = Date.now() + SUPABASE_COOLDOWN_MS;
  }
}

function markSupabaseHealthy(): void {
  supabaseCooldownUntil = 0;
}

if (SUPABASE_KEY && SUPABASE_KEY !== 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY') {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[VOLTRO Supabase] Client successfully initialized with URL:', SUPABASE_URL);
  } catch (err) {
    console.error('[VOLTRO Supabase] Initialization error:', err);
    supabaseClient = null;
  }
} else {
  console.log('[VOLTRO Supabase] No Supabase key found in environment.');
}

export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null;
}

export function getSupabase(): SupabaseClient | null {
  return supabaseClient;
}

/**
 * Determine the active data source and Supabase health state
 */
export async function getDataConnectionStatus(): Promise<{
  activeDataSource: 'supabase' | 'local_fallback';
  supabaseConnected: boolean;
  supabaseTablesCreated: boolean;
  supabaseUrl: string;
  message: string;
}> {
  if (!supabaseClient) {
    return {
      activeDataSource: 'local_fallback',
      supabaseConnected: false,
      supabaseTablesCreated: false,
      supabaseUrl: SUPABASE_URL,
      message: 'کلید احراز هویت Supabase در محیط یافت نشد؛ سیستم روی دیتابیس محلی پایدار است.',
    };
  }

  const client = getActiveSupabase();
  if (!client) {
    return {
      activeDataSource: 'local_fallback',
      supabaseConnected: false,
      supabaseTablesCreated: false,
      supabaseUrl: SUPABASE_URL,
      message: 'اتصال به سرور Supabase موقتاً در دسترس نیست؛ سیستم روی دیتابیس محلی پایدار است.',
    };
  }

  try {
    const { error } = await client.from('products').select('id').limit(1);
    if (error) {
      noteSupabaseFailure(error.message);
      return {
        activeDataSource: 'local_fallback',
        supabaseConnected: !isNetworkError(error.message),
        supabaseTablesCreated: false,
        supabaseUrl: SUPABASE_URL,
        message: `اتصال به پروژه Supabase برقرار است، اما جداول PostgreSQL در انتظار اجرای فایل مایگریشن هستند: ${error.message}`,
      };
    }
    markSupabaseHealthy();
    return {
      activeDataSource: 'supabase',
      supabaseConnected: true,
      supabaseTablesCreated: true,
      supabaseUrl: SUPABASE_URL,
      message: 'پایگاه داده ابری Supabase PostgreSQL کاملاً متصل و فعال است.',
    };
  } catch (err: unknown) {
    noteSupabaseFailure(err);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      activeDataSource: 'local_fallback',
      supabaseConnected: false,
      supabaseTablesCreated: false,
      supabaseUrl: SUPABASE_URL,
      message: `خطای اتصال به سرور Supabase: ${msg}`,
    };
  }
}

/**
 * Test connectivity to Supabase
 */
export async function testSupabaseConnection(): Promise<{ connected: boolean; message: string }> {
  const status = await getDataConnectionStatus();
  return {
    connected: status.supabaseTablesCreated,
    message: status.message,
  };
}

// ==============================================================================
// 1. PRODUCTS & CATALOG
// ==============================================================================

function mapProductFromSupabase(p: any, variants: any[]): Product {
  const prodVariants: ProductVariant[] = variants
    .filter((v) => v.product_id === p.id)
    .map((v) => ({
      id: v.id,
      sku: v.sku || `SKU-${v.id}`,
      colorName: v.color_name,
      colorEn: v.color_en || v.color_name || 'Standard',
      colorHex: v.color_hex,
      storage: v.storage,
      price: Number(v.price),
      compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) : undefined,
      stock: Number(v.stock),
      image: v.image || undefined,
    }));

  return {
    id: p.id,
    name: p.name,
    nameEn: p.name_en || p.name,
    slug: p.slug,
    brand: p.brand,
    category: p.category,
    subtitle: p.subtitle || '',
    description: p.description,
    basePrice: Number(p.base_price),
    compareAtPrice: p.compare_at_price ? Number(p.compare_at_price) : undefined,
    images: Array.isArray(p.images) ? p.images : [],
    variants: prodVariants,
    specifications: p.specifications || {},
    rating: Number(p.rating || 5),
    reviewCount: Number(p.review_count || 0),
    isFeatured: Boolean(p.is_featured),
    isFlashDeal: Boolean(p.is_flash_deal),
    stockTotal: Number(p.stock_total || 0),
    soldCount: Number(p.sold_count || 0),
    warranty: p.warranty || '',
    tags: Array.isArray(p.tags) ? p.tags : [],
    createdAt: p.created_at || new Date().toISOString(),
  };
}

function applyProductFiltersAndSort(
  input: Product[],
  filters?: {
    q?: string;
    category?: string;
    brand?: string;
    sort?: string;
    minPrice?: number;
    maxPrice?: number;
  }
): Product[] {
  let products = [...input];
  if (filters?.category && filters.category !== 'all') {
    products = products.filter((p) => p.category === filters.category);
  }
  if (filters?.brand && filters.brand !== 'all') {
    products = products.filter((p) => p.brand === filters.brand);
  }
  if (filters?.minPrice) {
    products = products.filter((p) => p.basePrice >= filters.minPrice!);
  }
  if (filters?.maxPrice) {
    products = products.filter((p) => p.basePrice <= filters.maxPrice!);
  }
  if (filters?.q) {
    const term = filters.q.trim().toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.nameEn.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term) ||
        p.tags.some((t) => t.toLowerCase().includes(term))
    );
  }

  if (filters?.sort) {
    switch (filters.sort) {
      case 'price-asc':
        products.sort((a, b) => a.basePrice - b.basePrice);
        break;
      case 'price-desc':
        products.sort((a, b) => b.basePrice - a.basePrice);
        break;
      case 'rating':
        products.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
        products.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
        break;
      case 'newest':
        products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
  }
  return products;
}

export async function getProductsFromSupabase(filters?: {
  q?: string;
  category?: string;
  brand?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
}): Promise<Product[]> {
  const client = getActiveSupabase();
  if (!client) return applyProductFiltersAndSort(db.getProducts(), filters);

  try {
    let query = client.from('products').select('*');
    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters?.brand && filters.brand !== 'all') {
      query = query.eq('brand', filters.brand);
    }
    if (filters?.minPrice) {
      query = query.gte('base_price', filters.minPrice);
    }
    if (filters?.maxPrice) {
      query = query.lte('base_price', filters.maxPrice);
    }

    const { data: productsData, error: pErr } = await query;
    if (pErr || !productsData) {
      if (pErr) noteSupabaseFailure(pErr.message);
      return applyProductFiltersAndSort(db.getProducts(), filters);
    }

    markSupabaseHealthy();
    const { data: variantsData } = await client.from('product_variants').select('*');
    const variants = variantsData || [];

    const products: Product[] = productsData.map((p) => mapProductFromSupabase(p, variants));
    return applyProductFiltersAndSort(products, filters);
  } catch (err) {
    noteSupabaseFailure(err);
    return applyProductFiltersAndSort(db.getProducts(), filters);
  }
}

export async function getProductByIdFromSupabase(id: string): Promise<Product | undefined> {
  const client = getActiveSupabase();
  if (!client) return db.getProductById(id);

  try {
    const { data: p, error } = await client.from('products').select('*').eq('id', id).maybeSingle();
    if (error || !p) {
      if (error) noteSupabaseFailure(error.message);
      return db.getProductById(id);
    }

    markSupabaseHealthy();
    const { data: variants } = await client.from('product_variants').select('*').eq('product_id', id);
    return mapProductFromSupabase(p, variants || []);
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getProductById(id);
  }
}

export async function updateInventoryStockInSupabase(productId: string, stock: number, user: any): Promise<boolean> {
  const client = getActiveSupabase();
  if (!client) {
    db.updateProduct(productId, { stockTotal: stock }, user);
    await addAuditLogInSupabase(user.id, user.name, 'UPDATE_INVENTORY', productId, `تغییر موجودی کالا به ${stock}`);
    return true;
  }

  try {
    const { error: pErr } = await client.from('products').update({ stock_total: stock }).eq('id', productId);
    if (pErr) {
      noteSupabaseFailure(pErr.message);
      if (!isNetworkError(pErr.message)) {
        console.warn('[VOLTRO Supabase] Product stock update warning:', pErr.message);
      }
    } else {
      markSupabaseHealthy();
      const { data: vars } = await client.from('product_variants').select('id').eq('product_id', productId).limit(1);
      if (vars && vars.length > 0) {
        await client.from('product_variants').update({ stock }).eq('id', vars[0].id);
      }
    }

    db.updateProduct(productId, { stockTotal: stock }, user);
    await addAuditLogInSupabase(user.id, user.name, 'UPDATE_INVENTORY', productId, `تغییر موجودی کالا به ${stock}`);
    return true;
  } catch (err) {
    noteSupabaseFailure(err);
    if (!isNetworkError(err)) {
      console.error('[VOLTRO Supabase] updateInventoryStock error:', err);
    }
    db.updateProduct(productId, { stockTotal: stock }, user);
    return true;
  }
}

// ==============================================================================
// 2. CATEGORIES, BRANDS & FLASH CAMPAIGNS
// ==============================================================================

export async function getCategoriesFromSupabase(): Promise<Category[]> {
  const client = getActiveSupabase();
  if (!client) return db.getCategories();

  try {
    const { data, error } = await client.from('categories').select('*');
    if (error || !data || data.length === 0) {
      if (error) noteSupabaseFailure(error.message);
      return db.getCategories();
    }
    markSupabaseHealthy();
    return data.map((c) => ({
      id: c.id,
      name: c.name,
      nameEn: c.name_en || c.name,
      slug: c.slug,
      description: c.description || '',
      image: c.image || '',
      itemCount: c.item_count || 0,
    }));
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getCategories();
  }
}

export async function getBrandsFromSupabase(): Promise<Brand[]> {
  const client = getActiveSupabase();
  if (!client) return db.getBrands();

  try {
    const { data, error } = await client.from('brands').select('*');
    if (error || !data || data.length === 0) {
      if (error) noteSupabaseFailure(error.message);
      return db.getBrands();
    }
    markSupabaseHealthy();
    return data.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logo: b.logo || undefined,
    }));
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getBrands();
  }
}

export async function getActiveCampaignFromSupabase(): Promise<FlashCampaign | null> {
  const client = getActiveSupabase();
  if (!client) return db.getActiveCampaign() || null;

  try {
    const { data, error } = await client
      .from('flash_campaigns')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error || !data) {
      if (error) noteSupabaseFailure(error.message);
      return db.getActiveCampaign() || null;
    }

    markSupabaseHealthy();
    const now = Date.now();
    const activeRow = data.find((c) => {
      const start = new Date(c.start_date).getTime();
      const end = new Date(c.end_date).getTime();
      return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && end >= now;
    });

    if (!activeRow) {
      return null;
    }

    const localMatch = db.getCampaigns().find((c) => c.id === activeRow.id);
    return {
      id: activeRow.id,
      title: activeRow.title,
      discountPercent: Number(activeRow.discount_percent),
      productDiscounts: activeRow.product_discounts || localMatch?.productDiscounts || {},
      startDate: activeRow.start_date,
      endDate: activeRow.end_date,
      isActive: Boolean(activeRow.is_active),
      eligibleProductIds: activeRow.eligible_product_ids || [],
      bannerText: activeRow.banner_text || undefined,
    };
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getActiveCampaign() || null;
  }
}

export async function getCampaignsFromSupabase(): Promise<FlashCampaign[]> {
  const client = getActiveSupabase();
  if (!client) return db.getCampaigns();
  try {
    const { data, error } = await client
      .from('flash_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data || data.length === 0) {
      if (error) noteSupabaseFailure(error.message);
      return db.getCampaigns();
    }
    markSupabaseHealthy();
    const localCampaigns = db.getCampaigns();
    return data.map((c) => {
      const localMatch = localCampaigns.find((lc) => lc.id === c.id);
      return {
        id: c.id,
        title: c.title,
        discountPercent: Number(c.discount_percent),
        productDiscounts: c.product_discounts || localMatch?.productDiscounts || {},
        startDate: c.start_date,
        endDate: c.end_date,
        isActive: Boolean(c.is_active),
        eligibleProductIds: c.eligible_product_ids || [],
        bannerText: c.banner_text || undefined,
      };
    });
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getCampaigns();
  }
}

export async function saveCampaignInSupabase(campaign: FlashCampaign, adminUser: any): Promise<void> {
  const client = getActiveSupabase();
  if (client) {
    try {
      const baseRow = {
        id: campaign.id,
        title: campaign.title,
        discount_percent: campaign.discountPercent,
        start_date: campaign.startDate,
        end_date: campaign.endDate,
        is_active: campaign.isActive,
        eligible_product_ids: campaign.eligibleProductIds,
        banner_text: campaign.bannerText || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await client.from('flash_campaigns').upsert({
        ...baseRow,
        product_discounts: campaign.productDiscounts || {},
      });
      if (error) {
        if (/product_discounts/i.test(error.message)) {
          const { error: retryErr } = await client.from('flash_campaigns').upsert(baseRow);
          if (retryErr) noteSupabaseFailure(retryErr.message);
          else markSupabaseHealthy();
        } else {
          noteSupabaseFailure(error.message);
        }
      } else {
        markSupabaseHealthy();
      }
    } catch (err) {
      noteSupabaseFailure(err);
      if (!isNetworkError(err)) {
        console.warn('[VOLTRO Supabase] saveCampaign warning:', err);
      }
    }
  }
  const existing = db.getCampaigns().find((c) => c.id === campaign.id);
  if (existing) {
    db.updateCampaign(campaign.id, campaign, adminUser);
  } else {
    db.createCampaign(campaign, adminUser);
  }
}

// ==============================================================================
// 3. ORDERS & ORDER ITEMS
// ==============================================================================

function mapOrderFromSupabase(o: any, items: any[]): Order {
  const orderItems: OrderItem[] = items
    .filter((it) => it.order_id === o.id)
    .map((it) => ({
      id: it.id,
      productId: it.product_id,
      productName: it.product_name,
      variantId: it.variant_id,
      variantTitle: it.variant_title || '',
      price: Number(it.price),
      quantity: Number(it.quantity),
      image: it.image || '',
    }));

  return {
    id: o.id,
    orderNumber: o.order_number,
    userId: o.user_id,
    userName: o.user_name,
    userEmail: o.user_email,
    userPhone: o.user_phone || '',
    items: orderItems,
    subtotal: Number(o.subtotal),
    discountAmount: Number(o.discount_amount || 0),
    shippingFee: Number(o.shipping_fee || 0),
    totalAmount: Number(o.total_amount),
    status: o.status,
    shippingAddress: o.shipping_address,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status || (o.status === 'pending' ? 'unpaid' : 'paid'),
    transaction: o.transaction || undefined,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

export async function getOrdersFromSupabase(userId?: string, isAdmin?: boolean, userEmail?: string): Promise<Order[]> {
  const client = getActiveSupabase();
  if (!client) return db.getOrders(isAdmin ? undefined : userId);

  try {
    let query = client.from('orders').select('*').order('created_at', { ascending: false });
    if (!isAdmin && userId) {
      if (userEmail) {
        query = query.or(`user_id.eq.${userId},user_email.eq.${userEmail}`);
      } else {
        query = query.eq('user_id', userId);
      }
    }

    const { data: ordersData, error: oErr } = await query;
    if (oErr || !ordersData) {
      if (oErr) noteSupabaseFailure(oErr.message);
      return db.getOrders(isAdmin ? undefined : userId);
    }

    markSupabaseHealthy();
    if (ordersData.length === 0) return [];
    const orderIds = ordersData.map((o) => o.id);
    const { data: itemsData } = await client.from('order_items').select('*').in('order_id', orderIds);
    const items = itemsData || [];

    return ordersData.map((o) => mapOrderFromSupabase(o, items));
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getOrders(isAdmin ? undefined : userId);
  }
}

export async function createOrderInSupabase(
  orderData: {
    items: Array<{ productId: string; variantId: string; quantity: number }>;
    shippingAddress: any;
    paymentMethod?: string;
  },
  userId: string,
  user: { name: string; email: string; phone?: string }
): Promise<{ success: boolean; order?: Order; error?: string }> {
  if (!orderData.items || orderData.items.length === 0) {
    return { success: false, error: 'سبد خرید خالی است.' };
  }

  const verifiedItems: OrderItem[] = [];
  let subtotal = 0;

  for (const item of orderData.items) {
    const prod = await getProductByIdFromSupabase(item.productId);
    if (!prod) {
      return { success: false, error: `کالای مورد نظر یافت نشد.` };
    }
    const variant = prod.variants.find((v) => v.id === item.variantId);
    if (!variant) {
      return { success: false, error: `تنوع کالا برای ${prod.name} معتبر نیست.` };
    }
    if (variant.stock < item.quantity) {
      return { success: false, error: `موجودی ناکافی برای ${prod.name}. تنها ${variant.stock} عدد موجود است.` };
    }

    const itemPrice = variant.price;
    subtotal += itemPrice * item.quantity;

    verifiedItems.push({
      id: `item-${Math.random().toString(36).substring(2, 9)}`,
      productId: prod.id,
      productName: prod.name,
      variantId: variant.id,
      variantTitle: `${variant.colorName} ${variant.storage}`,
      price: itemPrice,
      quantity: item.quantity,
      image: prod.images[0] || '',
    });
  }

  const campaign = await getActiveCampaignFromSupabase();
  let discountAmount = 0;
  if (campaign && campaign.isActive) {
    discountAmount = Math.round(subtotal * (campaign.discountPercent / 100));
  }
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const orderId = `ord-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
  const orderNumber = `#VOL-${Math.floor(1000 + Math.random() * 9000)}`;

  const transactionObj: PaymentTransaction = {
    id: `trx-${Math.random().toString(36).substring(2, 9)}`,
    orderId,
    amount: totalAmount,
    status: 'successful',
    gateway: 'شاپرک الکترونیک',
    trackingCode: `TRX-${Math.floor(10000000 + Math.random() * 90000000)}`,
    createdAt: new Date().toISOString(),
  };

  const newOrder: Order = {
    id: orderId,
    orderNumber,
    userId,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone || orderData.shippingAddress.phone || '',
    items: verifiedItems,
    subtotal,
    discountAmount,
    shippingFee: 0,
    totalAmount,
    status: 'processing',
    shippingAddress: orderData.shippingAddress,
    paymentMethod: orderData.paymentMethod || 'درگاه آنلاین شاپرک',
    paymentStatus: 'paid',
    transaction: transactionObj,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const client = getActiveSupabase();
  if (client) {
    try {
      const { error: oErr } = await client.from('orders').insert({
        id: newOrder.id,
        order_number: newOrder.orderNumber,
        user_id: newOrder.userId,
        user_name: newOrder.userName,
        user_email: newOrder.userEmail,
        user_phone: newOrder.userPhone || null,
        subtotal: newOrder.subtotal,
        discount_amount: newOrder.discountAmount,
        shipping_fee: newOrder.shippingFee,
        total_amount: newOrder.totalAmount,
        status: newOrder.status,
        shipping_address: newOrder.shippingAddress,
        payment_method: newOrder.paymentMethod,
        payment_status: newOrder.paymentStatus,
        transaction: newOrder.transaction,
        created_at: newOrder.createdAt,
        updated_at: newOrder.updatedAt,
      });

      if (oErr) {
        noteSupabaseFailure(oErr.message);
        if (!isNetworkError(oErr.message)) {
          console.error('[VOLTRO Supabase] Order insert error:', oErr.message);
        }
      } else {
        markSupabaseHealthy();
        for (const it of verifiedItems) {
          await client.from('order_items').insert({
            id: it.id,
            order_id: newOrder.id,
            product_id: it.productId,
            product_name: it.productName,
            variant_id: it.variantId,
            variant_title: it.variantTitle,
            price: it.price,
            quantity: it.quantity,
            image: it.image || null,
          });

          const { data: vRow } = await client.from('product_variants').select('stock').eq('id', it.variantId).single();
          if (vRow) {
            await client.from('product_variants').update({ stock: Math.max(0, vRow.stock - it.quantity) }).eq('id', it.variantId);
          }
          const { data: pRow } = await client.from('products').select('stock_total, sold_count').eq('id', it.productId).single();
          if (pRow) {
            await client.from('products').update({
              stock_total: Math.max(0, pRow.stock_total - it.quantity),
              sold_count: (pRow.sold_count || 0) + it.quantity,
            }).eq('id', it.productId);
          }
        }
      }
    } catch (err) {
      noteSupabaseFailure(err);
      if (!isNetworkError(err)) {
        console.error('[VOLTRO Supabase] createOrder error:', err);
      }
    }
  }

  db.createOrder({
    items: verifiedItems.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    })),
    shippingAddress: orderData.shippingAddress,
    paymentMethod: orderData.paymentMethod || 'درگاه آنلاین شاپرک',
    userId,
  });

  await addAuditLogInSupabase(userId, user.name, 'CREATE_ORDER', newOrder.id, `ثبت سفارش جدید ${orderNumber} به ارزش ${totalAmount} تومان`);
  return { success: true, order: newOrder };
}

export async function updateOrderStatusInSupabase(orderId: string, status: Order['status'], adminUser: any): Promise<boolean> {
  const client = getActiveSupabase();
  if (client) {
    try {
      const { error } = await client.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
      if (error) noteSupabaseFailure(error.message);
      else markSupabaseHealthy();
    } catch (err) {
      noteSupabaseFailure(err);
      if (!isNetworkError(err)) {
        console.warn('[VOLTRO Supabase] Order status update warning:', err);
      }
    }
  }
  db.updateOrderStatus(orderId, status, adminUser);
  await addAuditLogInSupabase(adminUser.id, adminUser.name, 'UPDATE_ORDER_STATUS', orderId, `تغییر وضعیت سفارش ${orderId} به: ${status}`);
  return true;
}

// ==============================================================================
// 4. FAVORITES
// ==============================================================================

export async function getFavoritesFromSupabase(userId: string): Promise<Product[]> {
  const client = getActiveSupabase();
  if (!client) return db.getFavorites(userId);

  try {
    const { data: favs, error } = await client.from('favorites').select('product_id').eq('user_id', userId);
    if (error || !favs) {
      if (error) noteSupabaseFailure(error.message);
      return db.getFavorites(userId);
    }

    markSupabaseHealthy();
    const productIds = favs.map((f) => f.product_id);
    if (productIds.length === 0) return [];

    const products = await getProductsFromSupabase();
    return products.filter((p) => productIds.includes(p.id));
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getFavorites(userId);
  }
}

export async function toggleFavoriteInSupabase(userId: string, productId: string): Promise<{ isFavorite: boolean }> {
  const client = getActiveSupabase();
  if (!client) return db.toggleFavorite(userId, productId);

  try {
    const { data: existing, error } = await client
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();

    if (error) {
      noteSupabaseFailure(error.message);
      return db.toggleFavorite(userId, productId);
    }

    markSupabaseHealthy();
    if (existing) {
      await client.from('favorites').delete().eq('id', existing.id);
      db.toggleFavorite(userId, productId);
      return { isFavorite: false };
    } else {
      await client.from('favorites').insert({
        user_id: userId,
        product_id: productId,
        added_at: new Date().toISOString(),
      });
      db.toggleFavorite(userId, productId);
      return { isFavorite: true };
    }
  } catch (err) {
    noteSupabaseFailure(err);
    return db.toggleFavorite(userId, productId);
  }
}

// ==============================================================================
// 5. ADMIN METRICS
// ==============================================================================

export async function getAdminMetricsFromSupabase(): Promise<any> {
  const client = getActiveSupabase();
  if (!client) {
    const local = db.getAdminMetrics();
    return {
      ...local,
      connectionStatus: {
        activeDataSource: 'local_fallback',
        supabaseConnected: false,
        supabaseTablesCreated: false,
        supabaseUrl: SUPABASE_URL,
        message: 'سیستم روی پایگاه داده محلی پایدار فعال است.',
      },
    };
  }

  try {
    const { data: deliveredOrders, error: dErr } = await client.from('orders').select('*').eq('status', 'delivered');
    if (dErr) {
      noteSupabaseFailure(dErr.message);
      const local = db.getAdminMetrics();
      return { ...local, connectionStatus: await getDataConnectionStatus() };
    }
    markSupabaseHealthy();
    const delivered = deliveredOrders || [];

    const totalDeliveredCount = delivered.length;
    const totalRevenue = delivered.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const aov = totalDeliveredCount > 0 ? Math.round(totalRevenue / totalDeliveredCount) : 0;

    const { data: prods } = await client.from('products').select('*');
    const allProducts = prods || [];
    const totalInventoryStock = allProducts.reduce((sum, p) => sum + Number(p.stock_total || 0), 0);
    const activeProducts = allProducts.length;
    const lowStockCount = allProducts.filter((p) => Number(p.stock_total || 0) <= 3).length;

    const { data: allOrders } = await client.from('orders').select('*').order('created_at', { ascending: false }).limit(5);

    const connectionStatus = await getDataConnectionStatus();

    return {
      totalRevenue,
      totalOrders: totalDeliveredCount,
      aov,
      totalInventoryStock,
      activeProducts,
      lowStockCount,
      revenueGrowthPercent: totalDeliveredCount > 0 ? 18.4 : 0,
      ordersGrowthPercent: totalDeliveredCount > 0 ? 12.1 : 0,
      aovGrowthPercent: totalDeliveredCount > 0 ? 4.5 : 0,
      conversionRate: totalDeliveredCount > 0 ? 3.85 : 0,
      trafficSources: [
        { label: 'جستجوی ارگانیک گوگل', percent: 42, color: '#2563eb' },
        { label: 'شبکه‌های اجتماعی', percent: 32, color: '#38bdf8' },
        { label: 'ایمیل مارکتینگ', percent: 16, color: '#a855f7' },
        { label: 'ورودی مستقیم', percent: 10, color: '#34d399' },
      ],
      recentOrders: (allOrders || []).map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        userName: o.user_name,
        totalAmount: Number(o.total_amount),
        status: o.status,
        createdAt: o.created_at,
      })),
      inventoryAlerts: allProducts
        .filter((p) => Number(p.stock_total || 0) <= 5)
        .map((p) => ({
          productId: p.id,
          name: p.name,
          stock: Number(p.stock_total || 0),
          status: Number(p.stock_total || 0) === 0 ? 'ناموجود' : `${p.stock_total} عدد باقی‌مانده`,
        })),
      connectionStatus,
    };
  } catch (err) {
    noteSupabaseFailure(err);
    const local = db.getAdminMetrics();
    const connectionStatus = await getDataConnectionStatus();
    return { ...local, connectionStatus };
  }
}

// ==============================================================================
// 6. AUDIT LOGS
// ==============================================================================

export async function addAuditLogInSupabase(
  userId: string,
  userName: string,
  action: string,
  target?: string,
  details?: string,
  ip?: string
): Promise<void> {
  const client = getActiveSupabase();
  if (client) {
    try {
      await client.from('audit_logs').insert({
        user_id: userId,
        user_name: userName,
        action,
        target: target || null,
        details: details || null,
        ip: ip || null,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      noteSupabaseFailure(e);
    }
  }
  db.addAuditLog(userId, userName, action, target || 'General', details || '', ip);
}

export async function getAuditLogsFromSupabase(): Promise<AuditLog[]> {
  const client = getActiveSupabase();
  if (!client) return db.getAuditLogs();

  try {
    const { data, error } = await client.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(50);
    if (error || !data || data.length === 0) {
      if (error) noteSupabaseFailure(error.message);
      return db.getAuditLogs();
    }
    markSupabaseHealthy();
    return data.map((l) => ({
      id: l.id,
      userId: l.user_id,
      userName: l.user_name,
      action: l.action,
      target: l.target || '',
      details: l.details || '',
      ip: l.ip || '',
      timestamp: l.timestamp,
    }));
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getAuditLogs();
  }
}

// ==============================================================================
// 7. USER AUTHENTICATION & PROFILES
// ==============================================================================

export async function authenticateOrMigrateUser(
  identifier: string,
  password: string
): Promise<{
  success: boolean;
  user?: any;
  error?: string;
}> {
  const cleanIdentifier = identifier.trim().toLowerCase();
  const internalEmail = cleanIdentifier.includes('@') ? cleanIdentifier : `${cleanIdentifier}@voltro.local`;

  const client = getActiveSupabase();
  if (!client) {
    const user = db.getUserByUsernameOrEmail(cleanIdentifier);
    if (!user) return { success: false, error: 'نام کاربری یا کلمه عبور اشتباه است.' };
    const valid = verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) return { success: false, error: 'نام کاربری یا کلمه عبور اشتباه است.' };
    return {
      success: true,
      user: {
        ...user,
        username: user.username || user.email,
        role: cleanIdentifier === 'admin@voltro.ir' ? 'admin' : user.role,
      },
    };
  }

  try {
    // 1. Try native Supabase Auth sign-in
    const { data: authData, error: authErr } = await client.auth.signInWithPassword({
      email: internalEmail,
      password,
    });
    if (authErr) noteSupabaseFailure(authErr.message);

    if (authData && authData.user) {
      markSupabaseHealthy();
      const { data: profile } = await client
        .from('user_profiles')
        .select('*')
        .eq('email', internalEmail)
        .maybeSingle();

      const localMatch = db.getUserByUsernameOrEmail(cleanIdentifier);
      const resolvedRole =
        cleanIdentifier === 'admin@voltro.ir'
          ? 'admin'
          : profile?.role || authData.user.user_metadata?.role || localMatch?.role || 'customer';

      return {
        success: true,
        user: {
          id: authData.user.id,
          name: profile?.name || authData.user.user_metadata?.name || localMatch?.name || 'کاربر ولترو',
          username: localMatch?.username || cleanIdentifier,
          email: authData.user.email!,
          role: resolvedRole,
          phone: profile?.phone || authData.user.user_metadata?.phone || localMatch?.phone || '',
          avatar: profile?.avatar_url || localMatch?.avatar || '',
        },
      };
    }

    // 2. Local account verification & JIT Supabase migration
    const localUser = db.getUserByUsernameOrEmail(cleanIdentifier);
    if (localUser) {
      const valid = verifyPassword(password, localUser.salt, localUser.passwordHash);
      if (valid) {
        const userRole = cleanIdentifier === 'admin@voltro.ir' ? 'admin' : localUser.role;
        const activeAfterSignIn = getActiveSupabase();
        if (activeAfterSignIn) {
          const { data: created, error: cErr } = await activeAfterSignIn.auth.admin.createUser({
            email: localUser.email,
            password,
            email_confirm: true,
            user_metadata: {
              name: localUser.name,
              username: localUser.username || localUser.email,
              role: userRole,
              phone: localUser.phone || '',
            },
          });
          if (cErr) noteSupabaseFailure(cErr.message);

          if (created && created.user) {
            await activeAfterSignIn.from('user_profiles').upsert(
              {
                auth_id: created.user.id,
                name: localUser.name,
                email: localUser.email,
                role: userRole,
                phone: localUser.phone || '',
              },
              { onConflict: 'email' }
            );

            return {
              success: true,
              user: {
                id: created.user.id,
                name: localUser.name,
                username: localUser.username || localUser.email,
                email: localUser.email,
                role: userRole,
                phone: localUser.phone || '',
                avatar: localUser.avatar || '',
              },
            };
          }
        }

        return {
          success: true,
          user: {
            ...localUser,
            username: localUser.username || localUser.email,
            role: userRole,
          },
        };
      }
    }

    return { success: false, error: 'نام کاربری یا کلمه عبور اشتباه است.' };
  } catch (err: unknown) {
    noteSupabaseFailure(err);
    const user = db.getUserByUsernameOrEmail(cleanIdentifier);
    if (!user) return { success: false, error: 'نام کاربری یا کلمه عبور اشتباه است.' };
    const valid = verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) return { success: false, error: 'نام کاربری یا کلمه عبور اشتباه است.' };
    return {
      success: true,
      user: {
        ...user,
        username: user.username || user.email,
        role: cleanIdentifier === 'admin@voltro.ir' ? 'admin' : user.role,
      },
    };
  }
}

export async function registerUserWithSupabase(
  name: string,
  username: string,
  password: string,
  phone: string
): Promise<{ success: boolean; user?: any; error?: string }> {
  const cleanUsername = username.trim().toLowerCase();
  const internalEmail = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@voltro.local`;
  const cleanPhone = phone.trim();

  const existingLocal = db.getUserByUsernameOrEmail(cleanUsername);
  if (existingLocal) {
    return { success: false, error: 'این نام کاربری قبلاً در سیستم ثبت شده است.' };
  }

  const client = getActiveSupabase();
  if (!client) {
    const { salt, hash } = generatePasswordHash(password);
    const user = db.createUser({
      name,
      username: cleanUsername,
      email: internalEmail,
      role: 'customer',
      phone: cleanPhone,
      salt,
      passwordHash: hash,
    });
    return { success: true, user };
  }

  try {
    const { data: created, error } = await client.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { name, username: cleanUsername, role: 'customer', phone: cleanPhone },
    });

    if (error || !created?.user) {
      if (error) noteSupabaseFailure(error.message);
      if (error?.message?.includes('already registered')) {
        return { success: false, error: 'این نام کاربری قبلاً در سیستم ثبت شده است.' };
      }
      const { salt, hash } = generatePasswordHash(password);
      const user = db.createUser({
        name,
        username: cleanUsername,
        email: internalEmail,
        role: 'customer',
        phone: cleanPhone,
        salt,
        passwordHash: hash,
      });
      return { success: true, user };
    }

    markSupabaseHealthy();
    await client.from('user_profiles').upsert(
      {
        auth_id: created.user.id,
        name,
        email: internalEmail,
        role: 'customer',
        phone: cleanPhone,
      },
      { onConflict: 'email' }
    );

    const { salt, hash } = generatePasswordHash(password);
    db.createUser({
      name,
      username: cleanUsername,
      email: internalEmail,
      role: 'customer',
      phone: cleanPhone,
      salt,
      passwordHash: hash,
    });

    return {
      success: true,
      user: {
        id: created.user.id,
        name,
        username: cleanUsername,
        email: internalEmail,
        role: 'customer',
        phone: cleanPhone,
      },
    };
  } catch (err: unknown) {
    noteSupabaseFailure(err);
    const { salt, hash } = generatePasswordHash(password);
    const user = db.createUser({
      name,
      username: cleanUsername,
      email: internalEmail,
      role: 'customer',
      phone: cleanPhone,
      salt,
      passwordHash: hash,
    });
    return { success: true, user };
  }
}

/**
 * Upload an image buffer to Supabase Storage bucket
 */
export async function uploadImageToSupabaseStorage(
  bucket: string,
  storagePath: string,
  buffer: Buffer,
  contentType: string = 'image/png'
): Promise<string | null> {
  const client = getActiveSupabase();
  if (!client) return null;

  try {
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      noteSupabaseFailure(uploadError.message);
      if (!isNetworkError(uploadError.message)) {
        console.error('[VOLTRO Storage] Upload error:', uploadError.message);
      }
      return null;
    }

    markSupabaseHealthy();
    const { data: publicUrlData } = client.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    noteSupabaseFailure(err);
    if (!isNetworkError(err)) {
      console.error('[VOLTRO Storage] Unexpected upload failure:', err);
    }
    return null;
  }
}

// ==============================================================================
// 8. PERSISTENT SHOPPING CART
// ==============================================================================

export async function getCartFromSupabase(userId: string): Promise<CartItem[]> {
  const client = getActiveSupabase();
  if (!client || !userId || userId === 'guest-user' || !isValidUuid(userId)) {
    return db.getCart(userId || 'guest-user');
  }

  try {
    let rawItems: Array<{ id: string; productId: string; variantId: string; quantity: number }> = [];
    const { data: userData, error } = await client.auth.admin.getUserById(userId);
    if (error) {
      noteSupabaseFailure(error.message);
      return db.getCart(userId);
    }
    if (userData?.user?.user_metadata?.cart) {
      rawItems = userData.user.user_metadata.cart;
    } else {
      return db.getCart(userId);
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return [];
    }

    const allProducts = await getProductsFromSupabase();
    const resolvedItems: CartItem[] = [];

    for (const item of rawItems) {
      const product = allProducts.find((p) => p.id === item.productId);
      if (!product) continue;
      const variant = product.variants.find((v) => v.id === item.variantId) || product.variants[0];
      if (!variant) continue;
      resolvedItems.push({
        id: item.id || `cart-${item.productId}-${item.variantId}`,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        product,
        variant,
      });
    }

    return resolvedItems;
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getCart(userId);
  }
}

export async function saveCartInSupabase(
  userId: string,
  items: Array<{ id?: string; productId: string; variantId: string; quantity: number }>
): Promise<CartItem[]> {
  db.saveCart(userId, items);
  const client = getActiveSupabase();
  if (!client || !userId || userId === 'guest-user' || !isValidUuid(userId)) {
    return db.getCart(userId || 'guest-user');
  }

  try {
    const { data: userData, error } = await client.auth.admin.getUserById(userId);
    if (error) {
      noteSupabaseFailure(error.message);
      return db.getCart(userId);
    }
    if (userData?.user) {
      const meta = userData.user.user_metadata || {};
      const cleanItems = items.map((i) => ({
        id: i.id || `cart-${Math.random().toString(36).substring(2, 9)}`,
        productId: i.productId,
        variantId: i.variantId,
        quantity: Math.max(1, i.quantity),
        addedAt: new Date().toISOString(),
      }));
      await client.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...meta,
          cart: cleanItems,
        },
      });
    }
  } catch (err) {
    noteSupabaseFailure(err);
  }

  return getCartFromSupabase(userId);
}

// ==============================================================================
// 9. ADDRESSES
// ==============================================================================

export async function getAddressesFromSupabase(userId: string): Promise<Address[]> {
  const client = getActiveSupabase();
  if (!client) return db.getAddresses(userId);
  try {
    const { data, error } = await client
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !data) {
      if (error) noteSupabaseFailure(error.message);
      return db.getAddresses(userId);
    }
    markSupabaseHealthy();
    return data.map((a) => ({
      id: a.id,
      userId: a.user_id,
      title: a.title,
      recipientName: a.recipient_name,
      phone: a.phone,
      province: a.province,
      city: a.city,
      postalAddress: a.postal_address,
      postalCode: a.postal_code || '',
    }));
  } catch (err) {
    noteSupabaseFailure(err);
    return db.getAddresses(userId);
  }
}

export async function addAddressInSupabase(addressData: Omit<Address, 'id'>): Promise<Address> {
  const localAddr = db.addAddress(addressData);
  const client = getActiveSupabase();
  if (!client) return localAddr;
  try {
    const { data, error } = await client
      .from('addresses')
      .insert({
        id: localAddr.id,
        user_id: addressData.userId,
        title: addressData.title,
        recipient_name: addressData.recipientName,
        phone: addressData.phone,
        province: addressData.province,
        city: addressData.city,
        postal_address: addressData.postalAddress,
        postal_code: addressData.postalCode,
      })
      .select()
      .maybeSingle();
    if (error) {
      noteSupabaseFailure(error.message);
    } else if (data) {
      markSupabaseHealthy();
      return {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        recipientName: data.recipient_name,
        phone: data.phone,
        province: data.province,
        city: data.city,
        postalAddress: data.postal_address,
        postalCode: data.postal_code || '',
      };
    }
  } catch (err) {
    noteSupabaseFailure(err);
    if (!isNetworkError(err)) {
      console.warn('[VOLTRO Supabase] addAddress warning:', err);
    }
  }
  return localAddr;
}

export async function deleteAddressInSupabase(userId: string, addressId: string): Promise<boolean> {
  const localOk = db.deleteAddress(userId, addressId);
  const client = getActiveSupabase();
  if (!client) return localOk;
  try {
    const { error } = await client
      .from('addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', userId);
    if (error) {
      noteSupabaseFailure(error.message);
      return isNetworkError(error.message) ? localOk : false;
    }
    markSupabaseHealthy();
    return true;
  } catch (err) {
    noteSupabaseFailure(err);
    return localOk;
  }
}

// ==============================================================================
// 10. REVIEWS
// ==============================================================================

export async function getReviewsFromSupabase(
  productId: string,
  options?: { page?: number; limit?: number; status?: 'approved' | 'all'; sortBy?: string }
): Promise<Review[]> {
  const localList = db.getReviews(productId, options);
  const client = getActiveSupabase();
  if (!client) return localList;
  try {
    let query = client
      .from('reviews')
      .select('*')
      .eq('product_id', productId);

    if (options?.status !== 'all') {
      // filter out hidden reviews if status column exists
      query = query.or('status.eq.approved,status.is.null');
    }

    if (options?.sortBy === 'highest-rating') {
      query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (options?.limit && options.limit > 0) {
      const page = Math.max(1, options.page || 1);
      const from = (page - 1) * options.limit;
      query = query.range(from, from + options.limit - 1);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      if (error) noteSupabaseFailure(error.message);
      return localList;
    }
    markSupabaseHealthy();
    return data.map((r) => ({
      id: r.id,
      productId: r.product_id,
      userId: r.user_id,
      userName: r.user_name,
      rating: Number(r.rating),
      comment: r.comment,
      isVerifiedPurchase: Boolean(r.is_verified_purchase),
      createdAt: r.created_at,
      updatedAt: r.updated_at || r.created_at,
      status: r.status || 'approved',
      helpfulCount: Number(r.helpful_count || 0),
      helpfulUserIds: r.helpful_user_ids || [],
    }));
  } catch (err) {
    noteSupabaseFailure(err);
    return localList;
  }
}

export async function addReviewInSupabase(reviewData: Omit<Review, 'id' | 'createdAt'>): Promise<Review> {
  const localRev = db.addReview(reviewData);
  const client = getActiveSupabase();
  if (!client) return localRev;
  try {
    const { error } = await client.from('reviews').upsert({
      id: localRev.id,
      product_id: reviewData.productId,
      user_id: reviewData.userId,
      user_name: reviewData.userName,
      rating: reviewData.rating,
      comment: reviewData.comment,
      is_verified_purchase: localRev.isVerifiedPurchase ?? true,
      status: localRev.status || 'approved',
      helpful_count: localRev.helpfulCount || 0,
      updated_at: new Date().toISOString(),
    });
    if (error) noteSupabaseFailure(error.message);
    else markSupabaseHealthy();
  } catch (err) {
    noteSupabaseFailure(err);
    if (!isNetworkError(err)) {
      console.warn('[VOLTRO Supabase] addReview warning:', err);
    }
  }
  return localRev;
}

export async function updateReviewInSupabase(
  reviewId: string,
  userId: string,
  updateData: { rating?: number; comment?: string },
  isAdmin = false
): Promise<{ success: boolean; review?: Review; error?: string }> {
  const localResult = db.updateReview(reviewId, userId, updateData, isAdmin);
  if (!localResult.success) return localResult;

  const client = getActiveSupabase();
  if (client) {
    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updateData.rating !== undefined) payload.rating = Number(updateData.rating);
      if (updateData.comment !== undefined) payload.comment = updateData.comment.trim();

      let query = client.from('reviews').update(payload).eq('id', reviewId);
      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }
      const { error } = await query;
      if (error) noteSupabaseFailure(error.message);
      else markSupabaseHealthy();
    } catch (err) {
      noteSupabaseFailure(err);
      if (!isNetworkError(err)) {
        console.warn('[VOLTRO Supabase] updateReview warning:', err);
      }
    }
  }

  return localResult;
}

export async function deleteReviewInSupabase(
  reviewId: string,
  userId: string,
  isAdmin = false
): Promise<{ success: boolean; error?: string }> {
  const localResult = db.deleteReview(reviewId, userId, isAdmin);
  if (!localResult.success) return localResult;

  const client = getActiveSupabase();
  if (client) {
    try {
      let query = client.from('reviews').delete().eq('id', reviewId);
      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }
      const { error } = await query;
      if (error) noteSupabaseFailure(error.message);
      else markSupabaseHealthy();
    } catch (err) {
      noteSupabaseFailure(err);
      if (!isNetworkError(err)) {
        console.warn('[VOLTRO Supabase] deleteReview warning:', err);
      }
    }
  }

  return localResult;
}

export async function toggleHelpfulReviewInSupabase(
  reviewId: string,
  userId: string
): Promise<{ success: boolean; helpfulCount: number; hasVoted: boolean }> {
  const localResult = db.toggleHelpfulReview(reviewId, userId);
  if (!localResult.success) return localResult;

  const client = getActiveSupabase();
  if (client) {
    try {
      const { error } = await client
        .from('reviews')
        .update({
          helpful_count: localResult.helpfulCount,
        })
        .eq('id', reviewId);
      if (error) noteSupabaseFailure(error.message);
      else markSupabaseHealthy();
    } catch (err) {
      noteSupabaseFailure(err);
      if (!isNetworkError(err)) {
        console.warn('[VOLTRO Supabase] toggleHelpful warning:', err);
      }
    }
  }

  return localResult;
}

export async function getAllReviewsFromSupabase(): Promise<Review[]> {
  const localList = db.getAllReviews();
  const client = getActiveSupabase();
  if (!client) return localList;
  try {
    const { data, error } = await client
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data || data.length === 0) {
      if (error) noteSupabaseFailure(error.message);
      return localList;
    }
    markSupabaseHealthy();
    return data.map((r) => ({
      id: r.id,
      productId: r.product_id,
      userId: r.user_id,
      userName: r.user_name,
      rating: Number(r.rating),
      comment: r.comment,
      isVerifiedPurchase: Boolean(r.is_verified_purchase),
      createdAt: r.created_at,
      updatedAt: r.updated_at || r.created_at,
      status: r.status || 'approved',
      helpfulCount: Number(r.helpful_count || 0),
      helpfulUserIds: r.helpful_user_ids || [],
    }));
  } catch (err) {
    noteSupabaseFailure(err);
    return localList;
  }
}

export async function updateReviewStatusInSupabase(
  reviewId: string,
  status: 'approved' | 'hidden' | 'rejected' | 'pending'
): Promise<{ success: boolean; review?: Review; error?: string }> {
  const localResult = db.updateReviewStatus(reviewId, status);
  if (!localResult.success) return localResult;

  const client = getActiveSupabase();
  if (client) {
    try {
      const { error } = await client
        .from('reviews')
        .update({ status })
        .eq('id', reviewId);
      if (error) noteSupabaseFailure(error.message);
      else markSupabaseHealthy();
    } catch (err) {
      noteSupabaseFailure(err);
      if (!isNetworkError(err)) {
        console.warn('[VOLTRO Supabase] updateReviewStatus warning:', err);
      }
    }
  }

  return localResult;
}


// ==============================================================================
// 11. PRODUCT CRUD FOR ADMIN
// ==============================================================================

export async function createProductInSupabase(
  productData: any,
  adminUser: any
): Promise<{ success: boolean; product?: Product; error?: string }> {
  if (!productData.name || !productData.basePrice) {
    return { success: false, error: 'نام و قیمت پایه کالا الزامی است.' };
  }

  const basePrice = Number(productData.basePrice);
  const compareAtPrice = productData.compareAtPrice ? Number(productData.compareAtPrice) : null;
  const stockTotal = Number(productData.stockTotal || 0);

  // Generate ID and clean slug
  const id = productData.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanBaseSlug = (productData.nameEn || productData.name || 'product')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `product-${Date.now()}`;
  let slug = productData.slug || cleanBaseSlug;

  const client = getActiveSupabase();
  if (client) {
    try {
      // Check slug uniqueness in Supabase
      const { data: existingSlug, error: slugErr } = await client
        .from('products')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (slugErr && isNetworkError(slugErr.message)) {
        noteSupabaseFailure(slugErr.message);
        const localProd = db.createProduct({ ...productData, id, slug, basePrice, compareAtPrice, stockTotal }, adminUser);
        return { success: true, product: localProd };
      }

      if (existingSlug && existingSlug.id !== id) {
        slug = `${cleanBaseSlug}-${Date.now().toString().slice(-4)}`;
      }

      const images = Array.isArray(productData.images) && productData.images.length > 0
        ? productData.images
        : ['/images/products/airpods-max.png'];

      const tags = Array.isArray(productData.tags) ? productData.tags : ['جدید', 'پرچمدار'];

      const specifications = productData.specifications || {
        processor: productData.processor || 'پردازنده نسل جدید',
        display: productData.display || 'نمایشگر OLED Super Retina',
        battery: productData.battery || 'شارژدهی طولانی با فست شارژ',
        camera: productData.camera || 'سیستم دوربین پیشرفته',
      };

      const { error: pError } = await client.from('products').insert({
        id,
        name: productData.name,
        name_en: productData.nameEn || productData.name,
        slug,
        brand: productData.brand || 'Apple',
        category: productData.category || 'smartphones',
        subtitle: productData.subtitle || 'محصول رسمی با ضمانت ولترو',
        description: productData.description || productData.subtitle || productData.name,
        base_price: basePrice,
        compare_at_price: compareAtPrice,
        is_featured: Boolean(productData.isFeatured),
        is_flash_deal: Boolean(productData.isFlashDeal),
        stock_total: stockTotal,
        sold_count: Number(productData.soldCount || 0),
        rating: Number(productData.rating || 5.0),
        review_count: Number(productData.reviewCount || 0),
        warranty: productData.warranty || '18 ماه گارانتی رسمی تعویض ولترو',
        tags,
        images,
        specifications,
      });

      if (pError) {
        noteSupabaseFailure(pError.message);
        if (isNetworkError(pError.message)) {
          const localProd = db.createProduct({
            ...productData,
            id,
            slug,
            basePrice,
            compareAtPrice,
            stockTotal,
            images,
            tags,
            specifications,
          }, adminUser);
          return { success: true, product: localProd };
        }
        console.error('[VOLTRO Supabase] createProduct failed:', pError.message);
        return { success: false, error: `خطا در ذخیره کالا در دیتابیس Supabase: ${pError.message}` };
      }

      markSupabaseHealthy();

      // Prepare and insert variants
      const variants = Array.isArray(productData.variants) && productData.variants.length > 0
        ? productData.variants
        : [
            {
              id: `var-${id}-def`,
              sku: `VOL-${Math.floor(10000 + Math.random() * 90000)}`,
              colorName: productData.colorName || 'استاندارد',
              colorEn: 'Standard',
              colorHex: '#18181b',
              storage: productData.storage || 'استاندارد',
              price: basePrice,
              compareAtPrice,
              stock: stockTotal,
              image: images[0],
            },
          ];

      for (const v of variants) {
        const { error: vError } = await client.from('product_variants').insert({
          id: v.id || `var-${Math.random().toString(36).substring(2, 9)}`,
          product_id: id,
          color_name: v.colorName || 'استاندارد',
          color_hex: v.colorHex || '#18181b',
          storage: v.storage || 'استاندارد',
          price: Number(v.price || basePrice),
          compare_at_price: v.compareAtPrice ? Number(v.compareAtPrice) : null,
          stock: Number(v.stock ?? stockTotal),
          sku: v.sku || null,
        });

        if (vError) {
          console.warn('[VOLTRO Supabase] insert variant warning:', vError.message);
        }
      }

      await addAuditLogInSupabase(
        adminUser.id,
        adminUser.name,
        'CREATE_PRODUCT',
        id,
        `افزودن محصول جدید: ${productData.name}`
      );

      // Sync into local DB cache
      const localProd = db.createProduct({
        ...productData,
        id,
        slug,
        basePrice,
        compareAtPrice,
        stockTotal,
        images,
        tags,
        specifications,
        variants,
      }, adminUser);

      const created = await getProductByIdFromSupabase(id);
      return { success: true, product: created || localProd };
    } catch (err: unknown) {
      noteSupabaseFailure(err);
      if (isNetworkError(err)) {
        const localProd = db.createProduct({ ...productData, id, slug, basePrice, compareAtPrice, stockTotal }, adminUser);
        return { success: true, product: localProd };
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[VOLTRO Supabase] Unexpected createProduct error:', msg);
      return { success: false, error: `خطای غیرمنتظره در ثبت کالا: ${msg}` };
    }
  }

  // Fallback if Supabase client not present or in cooldown
  const localProd = db.createProduct({ ...productData, id, slug, basePrice, compareAtPrice, stockTotal }, adminUser);
  return { success: true, product: localProd };
}

export async function updateProductInSupabase(
  id: string,
  updates: any,
  adminUser: any
): Promise<{ success: boolean; product?: Product; error?: string }> {
  const localUpdated = db.updateProduct(id, updates, adminUser);

  const client = getActiveSupabase();
  if (client) {
    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.nameEn !== undefined) payload.name_en = updates.nameEn;
      if (updates.slug !== undefined) payload.slug = updates.slug;
      if (updates.brand !== undefined) payload.brand = updates.brand;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.basePrice !== undefined) payload.base_price = Number(updates.basePrice);
      if (updates.compareAtPrice !== undefined) payload.compare_at_price = updates.compareAtPrice ? Number(updates.compareAtPrice) : null;
      if (updates.isFeatured !== undefined) payload.is_featured = Boolean(updates.isFeatured);
      if (updates.isFlashDeal !== undefined) payload.is_flash_deal = Boolean(updates.isFlashDeal);
      if (updates.stockTotal !== undefined) payload.stock_total = Number(updates.stockTotal);
      if (updates.warranty !== undefined) payload.warranty = updates.warranty;
      if (updates.tags !== undefined) payload.tags = updates.tags;
      if (updates.images !== undefined) payload.images = updates.images;
      if (updates.specifications !== undefined) payload.specifications = updates.specifications;

      const { error: pError } = await client.from('products').update(payload).eq('id', id);
      if (pError) {
        noteSupabaseFailure(pError.message);
        if (isNetworkError(pError.message)) {
          return { success: !!localUpdated, product: localUpdated };
        }
        console.error('[VOLTRO Supabase] updateProduct error:', pError.message);
        return { success: false, error: pError.message };
      }

      markSupabaseHealthy();
      if (updates.variants && Array.isArray(updates.variants)) {
        for (const v of updates.variants) {
          await client.from('product_variants').upsert({
            id: v.id,
            product_id: id,
            color_name: v.colorName || 'استاندارد',
            color_hex: v.colorHex || '#18181b',
            storage: v.storage || 'استاندارد',
            price: Number(v.price || payload.base_price),
            compare_at_price: v.compareAtPrice ? Number(v.compareAtPrice) : null,
            stock: Number(v.stock ?? payload.stock_total ?? 0),
            sku: v.sku || null,
          });
        }
      }

      const freshProduct = await getProductByIdFromSupabase(id);
      return { success: true, product: freshProduct || localUpdated };
    } catch (err: unknown) {
      noteSupabaseFailure(err);
      if (isNetworkError(err)) {
        return { success: !!localUpdated, product: localUpdated };
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[VOLTRO Supabase] Unexpected updateProduct error:', msg);
      return { success: false, error: msg };
    }
  }

  return { success: !!localUpdated, product: localUpdated };
}

export async function deleteProductInSupabase(id: string, adminUser: any): Promise<{ success: boolean; error?: string }> {
  const localOk = db.deleteProduct(id, adminUser);
  const client = getActiveSupabase();
  if (client) {
    try {
      const { error } = await client.from('products').delete().eq('id', id);
      if (error) {
        noteSupabaseFailure(error.message);
        if (isNetworkError(error.message)) {
          return { success: localOk };
        }
        console.error('[VOLTRO Supabase] deleteProduct failed:', error.message);
        return { success: false, error: error.message };
      }
      markSupabaseHealthy();
    } catch (err: unknown) {
      noteSupabaseFailure(err);
      if (isNetworkError(err)) {
        return { success: localOk };
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[VOLTRO Supabase] deleteProduct exception:', msg);
      return { success: false, error: msg };
    }
  }
  return { success: localOk };
}

export function getSupabaseClient(): SupabaseClient | null {
  return getActiveSupabase();
}

export async function syncOAuthUserWithSupabase(
  authId: string,
  email: string,
  name?: string,
  avatar?: string
): Promise<{ success: boolean; user?: any; error?: string }> {
  const client = getActiveSupabase();
  if (!client) {
    let localUser = db.getUserByEmail(email);
    if (!localUser) {
      localUser = db.createUser({
        name: name || email.split('@')[0],
        email,
        role: email === 'admin@voltro.ir' ? 'admin' : 'customer',
        salt: '',
        passwordHash: '',
        avatar: avatar || undefined,
      });
    }
    return { success: true, user: localUser };
  }

  try {
    const { data: existingProfile, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      noteSupabaseFailure(error.message);
    } else {
      markSupabaseHealthy();
    }

    const role = existingProfile?.role || (email === 'admin@voltro.ir' ? 'admin' : 'customer');
    const fullName = existingProfile?.name || name || email.split('@')[0];

    await client.from('user_profiles').upsert(
      {
        auth_id: authId,
        email,
        name: fullName,
        role,
        avatar_url: avatar || existingProfile?.avatar_url || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    let localUser = db.getUserByEmail(email);
    if (!localUser) {
      localUser = db.createUser({
        name: fullName,
        email,
        role,
        salt: '',
        passwordHash: '',
        avatar: avatar || undefined,
      });
    } else {
      localUser.name = fullName;
      if (avatar) localUser.avatar = avatar;
    }

    return {
      success: true,
      user: {
        id: authId,
        name: fullName,
        email,
        role,
        phone: existingProfile?.phone || '',
        avatar: avatar || existingProfile?.avatar_url,
        salt: '',
        passwordHash: '',
        createdAt: existingProfile?.created_at || new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    noteSupabaseFailure(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (!isNetworkError(err)) {
      console.error('[VOLTRO Supabase] Error syncing OAuth user:', msg);
    }
    return { success: false, error: msg };
  }
}

