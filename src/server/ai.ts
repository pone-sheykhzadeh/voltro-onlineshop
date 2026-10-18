import { GoogleGenAI } from '@google/genai';
import { db } from './db.ts';

let aiInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export interface AiChatInput {
  message: string;
  history?: { role: 'user' | 'model' | 'assistant'; text: string }[];
}

export interface AiChatResult {
  reply: string;
  recommendedProducts: {
    id: string;
    name: string;
    price: number;
    image: string;
    reason?: string;
  }[];
}

export async function generateShoppingAdvice(input: AiChatInput): Promise<AiChatResult> {
  const allProducts = db.getProducts();
  const activeCampaign = db.getActiveCampaign();

  // Create real product summary for context grounding
  const productCatalogText = allProducts
    .map((p) => {
      const variantsText = p.variants
        .map((v) => `[${v.colorName} | ${v.storage} | قیمت: ${v.price.toLocaleString('en-US')} تومان | موجودی: ${v.stock} عدد]`)
        .join('، ');

      const isFlash = activeCampaign && activeCampaign.eligibleProductIds.includes(p.id);
      const discountNotice = isFlash ? `(شامل ${activeCampaign.discountPercent}٪ تخفیف جشنواره شگفت‌انگیز)` : '';

      return `محصول: ${p.name} (${p.nameEn})
شناسه: ${p.id}
برند: ${p.brand} | دسته: ${p.category} | قیمت پایه: ${p.basePrice.toLocaleString('en-US')} تومان ${discountNotice}
مشخصات: پردازنده: ${p.specifications.processor} | نمایشگر: ${p.specifications.display} | باتری: ${p.specifications.battery} | دوربین: ${p.specifications.camera || 'استودیویی'}
کانفیگ‌ها و موجودی: ${variantsText}
توضیحات کوتاه: ${p.subtitle}`;
    })
    .join('\n---\n');

  const systemInstruction = `شما «دستیار هوشمند خرید ولترو (VOLTRO AI ASSIST)»، مشاور تخصصی و اختصاصی فروشگاه لوکس کالاهای دیجیتال و گجت‌های پرچمدار ولترو هستید.

وظایف اصلی شما:
1. درک دقیق بودجه، نیازها و اولویت‌های کاربر (عکاسی حرفه‌ای، گیمینگ، کاربری دانشگاهی/دانشجویی، برنامه‌نویسی، بیزینس و کارهای روزمره).
2. مقایسه تخصصی بین پرچمداران اپل و سامسونگ (مثل iPhone 15 Pro Max در برابر Galaxy S24 Ultra یا MacBook Pro در برابر اولترابوک‌ها).
3. توضیح تفاوت‌های کلیدی در زمینه سنسور دوربین، عمر باتری، قدرت تراشه، رم و حافظه داخلی با اعداد واقعی.
4. پیشنهاد دقیق محصولاتی که هم‌اکنون در پایگاه داده فروشگاه ولترو وجود دارند.

قوانین بسیار مهم و تخطی‌ناپذیر:
- از خودتان هیچ محصول، قیمت، تخفیف، مشخصات، یا موجودی ناموجودی اختراع نکنید! فقط و فقط بر اساس کاتالوگ ارائه‌شده در زیر پاسخ دهید.
- ارقام قیمت و اعداد را ترجیحاً به صورت فارسی و به تومان بیان کنید (مثلاً: «81,900,000 تومان»).
- لحن شما حرفه‌ای، محترمانه، لوکس، فنی و صادقانه باشد.
- در پایان پاسخ، اگر محصولی از کاتالوگ فروشگاه کاملاً متناسب با نیاز کاربر است، حتماً یک خط به شکل زیر در انتهای پاسخ درج کنید تا دکمه و کارت محصول در چت رندر شود:
RECOMMENDATIONS:[{"id": "شناسه محصول", "reason": "دلیل کوتاه تناسب با نیاز کاربر"}]
(اگر محصولی متناسب نبود این بخش را نیاورید).

کاتالوگ موجودی زنده انبار ولترو:
${productCatalogText}
`;

  const ai = getGenAI();

  if (ai) {
    try {
      // Build contents array with history
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      if (input.history && input.history.length > 0) {
        for (const h of input.history.slice(-6)) {
          contents.push({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.text }],
          });
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: input.message }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const rawText = response.text || 'متأسفانه در دریافت پاسخ خطایی رخ داد.';

      // Parse RECOMMENDATIONS tag if present
      let reply = rawText;
      let recommendedProducts: AiChatResult['recommendedProducts'] = [];

      const match = rawText.match(/RECOMMENDATIONS:(\[.*?\])/s);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          reply = rawText.replace(match[0], '').trim();
          recommendedProducts = parsed
            .map((rec: { id: string; reason?: string }) => {
              const p = allProducts.find((prod) => prod.id === rec.id);
              if (!p) return null;
              return {
                id: p.id,
                name: p.name,
                price: p.basePrice,
                image: p.images[0],
                reason: rec.reason,
              };
            })
            .filter(Boolean) as AiChatResult['recommendedProducts'];
        } catch (e) {
          console.warn('Failed to parse AI recommendations JSON:', e);
        }
      }

      // If no explicit recommendation tag was returned, heuristically find mentioned products
      if (recommendedProducts.length === 0) {
        for (const p of allProducts) {
          if (rawText.includes(p.name) || rawText.includes(p.nameEn)) {
            recommendedProducts.push({
              id: p.id,
              name: p.name,
              price: p.basePrice,
              image: p.images[0],
              reason: 'پیشنهاد متناسب با ویژگی‌های مورد نظر شما',
            });
            if (recommendedProducts.length >= 2) break;
          }
        }
      }

      return { reply, recommendedProducts };
    } catch (err: unknown) {
      console.error('Gemini API request failed, falling back to database rule-based advisor:', err);
    }
  }

  // Resilient intelligent fallback grounded in DB
  return generateRuleBasedAdvice(input.message, allProducts);
}

function generateRuleBasedAdvice(query: string, allProducts: ReturnType<typeof db.getProducts>): AiChatResult {
  const q = query.toLowerCase();

  if (q.includes('آیفون') && (q.includes('سامسونگ') || q.includes('اس 24') || q.includes('s24'))) {
    const iphone = allProducts.find((p) => p.id === 'prod-iphone-15-pro-max');
    const s24 = allProducts.find((p) => p.id === 'prod-samsung-s24-ultra');

    return {
      reply: `در مقایسه آیفون 15 پرو مکس و سامسونگ اس 24 اولترا:

1. **دوربین و تصویربرداری:**
- **سامسونگ S24 Ultra**: سنسور اصلی 200 مگاپیکسلی با جزئیات خیره‌کننده در نور روز، زوم 5 برابر اپتیکال و زوم تا 100 برابری دیجیتال. عالی برای زوم از فاصله دور و ثبت تصاویر با جزئیات بالا.
- **آیفون 15 Pro Max**: سنسور 48 مگاپیکسل با رنگ‌های طبیعی‌تر، پردازش بی‌رقیب ویدیو با استاندارد Apple ProRes و زوم پریسکوپ 5 برابری 120 میلی‌متری. اگر تولید محتوا یا فیلمبرداری اولویت شماست، آیفون دست بالا را دارد.

2. **سخت‌افزار و گیمینگ:**
- آیفون با تراشه 3 نانومتری A17 Pro و قابلیت اجرای بازی‌های کنسولی نظیر Death Stranding و Resident Evil.
- سامسونگ با Snapdragon 8 Gen 3 for Galaxy و سیستم خنک‌کننده اتاقک بخار بزرگ‌تر و نمایشگر تخت کاملاً ضدبازتاب با روشنایی 2600 نیت.

3. **امکانات ویژه:**
- سامسونگ دارای قلم دیجیتال S-Pen داخلی و قابلیت‌های هوش مصنوعی Galaxy AI است.
- آیفون مجهز به بدنه فوق‌العاده سبک تیتانیومی، دکمه Action Button و هماهنگی کامل با اکوسیستم اپل (مک‌بوک و اپل واچ) می‌باشد.

هر دو محصول در انبار ولترو موجود و دارای گارانتی رسمی 18 ماهه هستند.`,
      recommendedProducts: [
        {
          id: iphone?.id || 'prod-iphone-15-pro-max',
          name: iphone?.name || 'آیفون 15 پرو مکس',
          price: iphone?.basePrice || 81900000,
          image: iphone?.images[0] || '',
          reason: 'بهترین انتخاب برای فیلمبرداری فوق‌حرفه‌ای و اکوسیستم اپل',
        },
        {
          id: s24?.id || 'prod-samsung-s24-ultra',
          name: s24?.name || 'سامسونگ اس 24 اولترا',
          price: s24?.basePrice || 74500000,
          image: s24?.images[0] || '',
          reason: 'بهترین انتخاب برای عکاسی با زوم بالا، نمایشگر ضدبازتاب و قلم S-Pen',
        },
      ],
    };
  }

  if (q.includes('لپ‌تاپ') || q.includes('برنامه‌نویسی') || q.includes('مک‌بوک') || q.includes('مک بوک')) {
    const mbp = allProducts.find((p) => p.id === 'prod-macbook-pro-16');
    return {
      reply: `برای کاربری برنامه‌نویسی سنگین، هوش مصنوعی و کارهای مهندسی:

**مک‌بوک پرو 16 اینچ M3 Max** قدرتمندترین و استانداردترین لپ‌تاپ حال حاضر بازار است:
- **پردازنده:** 16 هسته CPU همراه با 40 هسته پردازش گرافیکی و 36 گیگابایت حافظه رم یکپارچه که بدون هیچ افتی سنگین‌ترین کانتینرهای Docker و مدل‌های محلی LLM را اجرا می‌کند.
- **باتری:** شارژدهی تا 22 ساعت که بی‌نیاز از شارژر در تمام طول روز کاری می‌توانید کدنویسی کنید.
- **نمایشگر:** پنل Liquid Retina XDR مینی‌ال‌ای‌دی با رفرش‌ریت 120 هرتز که کمترین خستگی چشم را به همراه دارد.`,
      recommendedProducts: [
        {
          id: mbp?.id || 'prod-macbook-pro-16',
          name: mbp?.name || 'مک‌بوک پرو 16 اینچ M3 Max',
          price: mbp?.basePrice || 137900000,
          image: mbp?.images[0] || '',
          reason: 'ایده‌آل‌ترین ورک‌استیشن همراه برای برنامه‌نویسان و توسعه‌دهندگان حرفه‌ای',
        },
      ],
    };
  }

  if (q.includes('هدفون') || q.includes('موسیقی') || q.includes('صدا') || q.includes('ایرپاد') || q.includes('نویز کنسلینگ')) {
    const max = allProducts.find((p) => p.id === 'prod-airpods-max');
    const pro = allProducts.find((p) => p.id === 'prod-airpods-pro-2');
    return {
      reply: `در میان تجهیزات صوتی های‌فای ولترو:

1. **ایرپاد مکس (Apple AirPods Max):**
اگر هدفون روگوشی (Over-Ear) با حداکثر تفکیک استودیویی، درایور اختصاصی 40 میلی‌متری و بیس عمیق بدون اعوجاج می‌خواهید، ایرپاد مکس نهایت شکوه صداست.

2. **ایرپاد پرو 2 (AirPods Pro 2 Type-C):**
اگر هدفون توگوشی و همراه برای رفت‌وآمد، ورزش و کاربری مداوم می‌خواهید، ایرپاد پرو 2 با حذف نویز نسل جدید H2 و ابعاد کوچک بهترین گزینه است.`,
      recommendedProducts: [
        {
          id: max?.id || 'prod-airpods-max',
          name: max?.name || 'هدفون اپل ایرپاد مکس',
          price: max?.basePrice || 42850000,
          image: max?.images[0] || '',
          reason: 'کیفیت صدای مانیتورینگ استودیویی با حذف نویز اکتیو قدرتمند',
        },
        {
          id: pro?.id || 'prod-airpods-pro-2',
          name: pro?.name || 'ایرپاد پرو 2 تایپ‌سی',
          price: pro?.basePrice || 14800000,
          image: pro?.images[0] || '',
          reason: 'سبک، روزمره با نویز کنسلینگ دوبرابری و شارژدهی عالی',
        },
      ],
    };
  }

  if (q.includes('ساعت') || q.includes('اولترا') || q.includes('واچ')) {
    const watch = allProducts.find((p) => p.id === 'prod-apple-watch-ultra-2');
    return {
      reply: `برای ساعت هوشمند پرچمدار:

**اپل واچ اولترا 2 تیتانیوم:**
- بدنه تیتانیومی 49 میلی‌متری ضدضربه و ضدخراش با کریستال یاقوت کبود (Sapphire).
- روشنایی 3000 نیت که حتی زیر نور مستقیم خورشید ظهر کویر یا دریا کاملاً خواناست.
- حسگرهای تخصصی: نوار قلب (ECG)، اکسیژن خون، عمق‌سنج تا 40 متر و باتری بادوام تا 72 ساعت در حالت Low Power.`,
      recommendedProducts: [
        {
          id: watch?.id || 'prod-apple-watch-ultra-2',
          name: watch?.name || 'اپل واچ اولترا 2 تیتانیوم',
          price: watch?.basePrice || 49400000,
          image: watch?.images[0] || '',
          reason: 'مقاوم‌ترین ساعت هوشمند جهان با باتری طولانی‌مدت و روشنایی 3000 نیت',
        },
      ],
    };
  }

  // General recommendation
  const featured = allProducts.filter((p) => p.isFeatured).slice(0, 3);
  return {
    reply: `سلام! من مشاور هوشمند خرید ولترو هستم.

بر اساس محصولات فعال و موجودی انبار فروشگاه ولترو، می‌توانید موارد زیر را بپرسید:
- **بودجه شما:** سقف هزینه مورد نظرتان را بفرمایید تا بهترین دستگاه‌ها را فیلتر کنم.
- **مقایسه:** مقایسه دوربین یا عملکرد آیفون 15 پرو مکس و سامسونگ اس 24 اولترا.
- **کاربری:** مناسب‌ترین گوشی یا لپ‌تاپ برای کاربری‌های گیمینگ، عکاسی، برنامه‌نویسی یا اداری.

تمامی محصولات دارای گارانتی رسمی 18 ماهه و ضمانت تعویض اصالت فیزیکی ولترو هستند. مایلید کدام دسته را بررسی کنیم؟`,
    recommendedProducts: featured.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.basePrice,
      image: p.images[0],
      reason: 'محصول برگزیده و پرفروش ولترو',
    })),
  };
}
