import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Product, Category, Order, Address, Review, FlashCampaign } from '../types/index.ts';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://hxibukwtqfqwzdijmftq.supabase.co').trim().replace(/\/+$/, '');
const SUPABASE_KEY =
  (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim()) ||
  (process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_PUBLISHABLE_KEY.trim()) ||
  (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.trim()) ||
  '';

let supabaseClient: SupabaseClient | null = null;

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
  console.log('[VOLTRO Supabase] No Supabase key found in environment. Running in resilient local storage mode.');
}

export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null;
}

export function getSupabase(): SupabaseClient | null {
  return supabaseClient;
}

/**
 * Test connectivity to Supabase
 */
export async function testSupabaseConnection(): Promise<{ connected: boolean; message: string }> {
  if (!supabaseClient) {
    return {
      connected: false,
      message: 'کلید احراز هویت Supabase در متغیرهای محیطی ثبت نشده است. سیستم با دیتابیس محلی به صورت پایدار فعال است.',
    };
  }

  try {
    const { error } = await supabaseClient.from('products').select('id').limit(1);
    if (error) {
      return {
        connected: false,
        message: `خطای اتصال به جداول Supabase: ${error.message}. لطفاً از اجرای مایگریشن SQL اطمینان حاصل فرمایید.`,
      };
    }
    return {
      connected: true,
      message: 'اتصال مستقیم به دیتابیس PostgreSQL و حافظه ابری Supabase با موفقیت برقرار شد.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      message: `خطای ارتباط شبکه با سرور Supabase: ${msg}`,
    };
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
  if (!supabaseClient) return null;

  try {
    const { error: uploadError } = await supabaseClient.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[VOLTRO Storage] Upload error:', uploadError.message);
      return null;
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('[VOLTRO Storage] Unexpected upload failure:', err);
    return null;
  }
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

  try {
    const { error } = await supabaseClient.from('products').select('id').limit(1);
    if (error) {
      return {
        activeDataSource: 'local_fallback',
        supabaseConnected: true,
        supabaseTablesCreated: false,
        supabaseUrl: SUPABASE_URL,
        message: 'اتصال به پروژه Supabase برقرار است، اما جداول PostgreSQL در انتظار اجرای فایل مایگریشن (scripts/migration.sql) هستند.',
      };
    }
    return {
      activeDataSource: 'supabase',
      supabaseConnected: true,
      supabaseTablesCreated: true,
      supabaseUrl: SUPABASE_URL,
      message: 'پایگاه داده ابری Supabase PostgreSQL کاملاً متصل و فعال است.',
    };
  } catch (err: unknown) {
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

