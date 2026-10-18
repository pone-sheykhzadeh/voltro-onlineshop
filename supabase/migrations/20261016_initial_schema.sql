-- ==============================================================================
-- VOLTRO Tech Luxury E-Commerce Platform
-- Complete PostgreSQL Schema, Tables, Indexes, Constraints, and RLS Policies
-- Supabase Project: https://hxibukwtqfqwzdijmftq.supabase.co
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. USER PROFILES & ROLES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE, -- linked to auth.users if Supabase Auth is active
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'manager')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. CATEGORIES & BRANDS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  image TEXT,
  item_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. PRODUCTS & CATALOG
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL,
  base_price BIGINT NOT NULL,
  compare_at_price BIGINT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_flash_deal BOOLEAN NOT NULL DEFAULT FALSE,
  stock_total INT NOT NULL DEFAULT 0,
  sold_count INT NOT NULL DEFAULT 0,
  rating NUMERIC(3, 1) NOT NULL DEFAULT 5.0,
  review_count INT NOT NULL DEFAULT 0,
  warranty TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  storage TEXT NOT NULL,
  price BIGINT NOT NULL,
  compare_at_price BIGINT,
  stock INT NOT NULL DEFAULT 0,
  sku TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. FLASH CAMPAIGNS & SALES MANAGEMENT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.flash_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  discount_percent INT NOT NULL CHECK (discount_percent >= 1 AND discount_percent <= 99),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  eligible_product_ids TEXT[] NOT NULL DEFAULT '{}',
  banner_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. CUSTOMER ADDRESSES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.addresses (
  id TEXT PRIMARY KEY DEFAULT ('addr-' || gen_random_uuid()),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'آدرس تحویل',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT 'تهران',
  city TEXT NOT NULL DEFAULT 'تهران',
  postal_address TEXT NOT NULL,
  postal_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. ORDERS & ORDER ITEMS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_phone TEXT,
  subtotal BIGINT NOT NULL,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  shipping_fee BIGINT NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  shipping_address JSONB NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'درگاه آنلاین شاپرک',
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'failed')),
  transaction JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id TEXT PRIMARY KEY DEFAULT ('item-' || gen_random_uuid()),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  variant_title TEXT,
  price BIGINT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. REVIEWS & RATINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY DEFAULT ('rev-' || gen_random_uuid()),
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 9. USER FAVORITES / WISHLIST
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id TEXT PRIMARY KEY DEFAULT ('fav-' || gen_random_uuid()),
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id)
);

-- ==============================================================================
-- 10. AUDIT LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT ('audit-' || gen_random_uuid()),
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  target TEXT,
  details TEXT,
  ip TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. INDEXES FOR HIGH-THROUGHPUT PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_is_flash_deal ON public.products(is_flash_deal);
CREATE INDEX IF NOT EXISTS idx_products_base_price ON public.products(base_price);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON public.favorites(product_id);

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if caller is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE (auth_id = auth.uid() OR id::text = auth.uid()::text)
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PRODUCTS & CATALOG POLICIES:
-- Everyone can read products and variants
CREATE POLICY "Public products viewable by everyone" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Public variants viewable by everyone" ON public.product_variants
  FOR SELECT USING (true);

CREATE POLICY "Public categories viewable by everyone" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Public brands viewable by everyone" ON public.brands
  FOR SELECT USING (true);

CREATE POLICY "Public active campaigns viewable by everyone" ON public.flash_campaigns
  FOR SELECT USING (true);

-- Admin-only modification for products
CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

-- CUSTOMER ADDRESSES POLICIES:
CREATE POLICY "Users can view own addresses" ON public.addresses
  FOR SELECT USING (auth.uid()::text = user_id OR public.is_admin());

CREATE POLICY "Users can create own addresses" ON public.addresses
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own addresses" ON public.addresses
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own addresses" ON public.addresses
  FOR DELETE USING (auth.uid()::text = user_id);

-- ORDERS & ORDER ITEMS POLICIES:
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (auth.uid()::text = user_id OR public.is_admin());

CREATE POLICY "Users can insert own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR public.is_admin());

CREATE POLICY "Admins can update orders status" ON public.orders
  FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Users can view own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = public.order_items.order_id
        AND (o.user_id = auth.uid()::text OR public.is_admin())
    )
  );

CREATE POLICY "Users can insert order items" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = public.order_items.order_id
        AND (o.user_id = auth.uid()::text OR public.is_admin())
    )
  );

-- FAVORITES POLICIES:
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can add own favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can remove own favorites" ON public.favorites
  FOR DELETE USING (auth.uid()::text = user_id);

-- REVIEWS POLICIES:
CREATE POLICY "Public reviews viewable by everyone" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can submit review" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- AUDIT LOGS POLICIES:
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Authenticated users or system can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- USER PROFILES POLICIES:
CREATE POLICY "Users can view own profile or admins view all" ON public.user_profiles
  FOR SELECT USING (auth.uid() = auth_id OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = auth_id OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Users or system can insert profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = auth_id OR auth.role() = 'service_role');

-- PRODUCT VARIANTS ADMIN POLICIES:
CREATE POLICY "Admins can insert variants" ON public.product_variants
  FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can update variants" ON public.product_variants
  FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can delete variants" ON public.product_variants
  FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

-- CATEGORIES ADMIN POLICIES:
CREATE POLICY "Admins can insert categories" ON public.categories
  FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can update categories" ON public.categories
  FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can delete categories" ON public.categories
  FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

-- BRANDS ADMIN POLICIES:
CREATE POLICY "Admins can insert brands" ON public.brands
  FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can update brands" ON public.brands
  FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can delete brands" ON public.brands
  FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

-- FLASH CAMPAIGNS ADMIN POLICIES:
CREATE POLICY "Admins can insert campaigns" ON public.flash_campaigns
  FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can update campaigns" ON public.flash_campaigns
  FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins can delete campaigns" ON public.flash_campaigns
  FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

-- ==============================================================================
-- 13. REALTIME PUBLICATION CONFIGURATION
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'product_variants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'flash_campaigns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.flash_campaigns;
  END IF;
END $$;
