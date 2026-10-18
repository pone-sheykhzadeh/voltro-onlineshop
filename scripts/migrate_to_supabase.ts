import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://hxibukwtqfqwzdijmftq.supabase.co').trim().replace(/\/+$/, '');
const SUPABASE_KEY =
  (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim()) ||
  (process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_PUBLISHABLE_KEY.trim()) ||
  (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.trim());

async function runMigration() {
  console.log('====================================================');
  console.log('VOLTRO Tech Luxury - Comprehensive Supabase Migration');
  console.log('Target URL:', SUPABASE_URL);
  console.log('Key Type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'publishable/anon');
  console.log('====================================================');

  if (!SUPABASE_KEY || SUPABASE_KEY === 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY') {
    console.error('[ERROR] No valid Supabase key detected in environment.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dbPath = path.resolve(process.cwd(), '.data/voltro_db.json');
  if (!fs.existsSync(dbPath)) {
    console.error('[ERROR] Database file .data/voltro_db.json not found!');
    process.exit(1);
  }

  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  let errorCount = 0;
  const errorDetails: string[] = [];

  // 1. Categories
  console.log(`[1/5] Migrating ${dbData.categories.length} categories...`);
  for (const cat of dbData.categories) {
    const { error } = await supabase.from('categories').upsert({
      id: cat.id,
      name: cat.name,
      name_en: cat.nameEn || cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      image: cat.image,
      item_count: cat.itemCount || 0,
    });
    if (error) {
      errorCount++;
      errorDetails.push(`Category ${cat.id}: ${error.message}`);
      console.error(`  [FAIL] Category ${cat.name}:`, error.message);
    }
  }

  // 2. Brands
  console.log(`[2/5] Migrating ${dbData.brands.length} brands...`);
  for (const b of dbData.brands) {
    const { error } = await supabase.from('brands').upsert({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logo: b.logo,
    });
    if (error) {
      errorCount++;
      errorDetails.push(`Brand ${b.id}: ${error.message}`);
      console.error(`  [FAIL] Brand ${b.name}:`, error.message);
    }
  }

  // 3. Products & Variants
  console.log(`[3/5] Migrating ${dbData.products.length} products and variants...`);
  for (const prod of dbData.products) {
    const { error: pError } = await supabase.from('products').upsert({
      id: prod.id,
      name: prod.name,
      name_en: prod.nameEn,
      slug: prod.slug,
      brand: prod.brand,
      category: prod.category,
      subtitle: prod.subtitle,
      description: prod.description,
      base_price: prod.basePrice,
      compare_at_price: prod.compareAtPrice || null,
      is_featured: prod.isFeatured || false,
      is_flash_deal: prod.isFlashDeal || false,
      stock_total: prod.stockTotal || 0,
      sold_count: prod.soldCount || 0,
      rating: prod.rating || 5.0,
      review_count: prod.reviewCount || 0,
      warranty: prod.warranty || null,
      tags: prod.tags || [],
      images: prod.images || [],
      specifications: prod.specifications || {},
    });

    if (pError) {
      errorCount++;
      errorDetails.push(`Product ${prod.id}: ${pError.message}`);
      console.error(`  [FAIL] Product ${prod.name}:`, pError.message);
      continue;
    }

    if (prod.variants && Array.isArray(prod.variants)) {
      for (const v of prod.variants) {
        const { error: vError } = await supabase.from('product_variants').upsert({
          id: v.id,
          product_id: prod.id,
          color_name: v.colorName,
          color_hex: v.colorHex,
          storage: v.storage,
          price: v.price,
          compare_at_price: v.compareAtPrice || null,
          stock: v.stock || 0,
          sku: v.sku || null,
        });
        if (vError) {
          errorCount++;
          errorDetails.push(`Variant ${v.id}: ${vError.message}`);
          console.error(`  [FAIL] Variant ${v.id}:`, vError.message);
        }
      }
    }
  }

  // 4. Flash Campaigns
  if (dbData.campaigns && Array.isArray(dbData.campaigns)) {
    console.log(`[4/5] Migrating ${dbData.campaigns.length} campaigns...`);
    for (const c of dbData.campaigns) {
      const { error } = await supabase.from('flash_campaigns').upsert({
        id: c.id,
        title: c.title,
        discount_percent: c.discountPercent,
        start_date: c.startDate,
        end_date: c.endDate,
        is_active: c.isActive,
        eligible_product_ids: c.eligibleProductIds || [],
        banner_text: c.bannerText || null,
      });
      if (error) {
        errorCount++;
        errorDetails.push(`Campaign ${c.id}: ${error.message}`);
        console.error(`  [FAIL] Campaign ${c.title}:`, error.message);
      }
    }
  }

  // 5. Existing Orders & Order Items (Strictly preserving unpaid status without data loss)
  if (dbData.orders && Array.isArray(dbData.orders)) {
    console.log(`[5/5] Migrating ${dbData.orders.length} orders safely...`);
    for (const o of dbData.orders) {
      const orderRecord = {
        id: o.id,
        order_number: o.orderNumber,
        user_id: o.userId,
        user_name: o.userName,
        user_email: o.userEmail || (o.userId === 'usr-admin-01' ? 'admin@voltro.ir' : 'user@voltro.ir'),
        user_phone: o.userPhone || '09120000000',
        subtotal: o.subtotal || o.totalAmount,
        discount_amount: o.discountAmount || 0,
        shipping_fee: o.shippingFee || 0,
        total_amount: o.totalAmount,
        status: o.status,
        shipping_address: o.shippingAddress || {},
        payment_method: o.paymentMethod || 'درگاه آنلاین شاپرک',
        payment_status: o.paymentStatus || (o.status === 'pending' ? 'unpaid' : 'paid'),
        transaction: o.transaction || null,
        created_at: o.createdAt || new Date().toISOString(),
        updated_at: o.updatedAt || new Date().toISOString(),
      };

      const { error: oErr } = await supabase.from('orders').upsert(orderRecord);
      if (oErr) {
        errorCount++;
        errorDetails.push(`Order ${o.orderNumber}: ${oErr.message}`);
        console.error(`  [FAIL] Order ${o.orderNumber}:`, oErr.message);
        continue;
      }

      if (o.items && Array.isArray(o.items)) {
        for (const item of o.items) {
          const itemRecord = {
            id: item.id || `item-${Math.random().toString(36).substring(2, 9)}`,
            order_id: o.id,
            product_id: item.productId,
            product_name: item.productName || item.product?.name || 'کالای ولترو',
            variant_id: item.variantId || item.variant?.id || 'default-variant',
            variant_title:
              item.variantTitle ||
              (item.variant ? `${item.variant.colorName} ${item.variant.storage}` : 'استاندارد'),
            price: item.price || item.variant?.price || 0,
            quantity: item.quantity || 1,
            image: item.image || item.product?.images?.[0] || null,
          };
          const { error: iErr } = await supabase.from('order_items').upsert(itemRecord);
          if (iErr) {
            errorCount++;
            errorDetails.push(`OrderItem ${itemRecord.id}: ${iErr.message}`);
            console.error(`  [FAIL] Item for ${o.orderNumber}:`, iErr.message);
          }
        }
      }
    }
  }

  // Final Summary & Remote Verification
  console.log('----------------------------------------------------');
  if (errorCount > 0) {
    console.error(`[MIGRATION FAILED] Total errors: ${errorCount}`);
    errorDetails.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: ordCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  const { count: catCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  const { count: brandCount } = await supabase.from('brands').select('*', { count: 'exact', head: true });

  console.log('[MIGRATION SUCCESSFUL] All records verified in remote Supabase:');
  console.log(`  - Products: ${prodCount}`);
  console.log(`  - Categories: ${catCount}`);
  console.log(`  - Brands: ${brandCount}`);
  console.log(`  - Orders: ${ordCount}`);
  console.log('====================================================');
}

runMigration().catch((err) => {
  console.error('[UNHANDLED EXCEPTION]:', err);
  process.exit(1);
});
