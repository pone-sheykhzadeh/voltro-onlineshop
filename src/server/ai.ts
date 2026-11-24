import { GoogleGenAI } from '@google/genai';
import { db } from './db.ts';
import type { Product } from '../types/index.ts';

let aiInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface AiChatInput {
  message: string;
  history?: { role: 'user' | 'model' | 'assistant'; text: string }[];
}

export interface RecommendedProductItem {
  id: string;
  name: string;
  price: number;
  image: string;
  reason?: string;
  pros?: string[];
  cons?: string[];
}

export interface AiChatResult {
  reply: string;
  recommendedProducts: RecommendedProductItem[];
}

// Persian and English text/number normalizer
function normalizePersian(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .toLowerCase();
}

function parseBudgetFromQuery(query: string): number | null {
  const normalized = normalizePersian(query);

  // Match expressions like "30 میلیون", "۳۰ میلیون تومانی", "تا 50 میلیون", "بودجه 70 م", "80000000 تومان"
  const millionMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:میلیون|ملیون|م)(?![\u0600-\u06FFa-zA-Z0-9_])/);
  if (millionMatch) {
    return Math.round(parseFloat(millionMatch[1]) * 1000000);
  }

  const rawNumberMatch = normalized.match(/(\d{7,10})\s*(?:تومان|تمن|ریال)?/);
  if (rawNumberMatch) {
    return parseInt(rawNumberMatch[1], 10);
  }

  return null;
}

export async function generateShoppingAdvice(input: AiChatInput): Promise<AiChatResult> {
  const allProducts = db.getProducts();
  const activeCampaign = db.getActiveCampaign();

  // Build real product summary for ground truth
  const productCatalogText = allProducts
    .map((p) => {
      const isFlash = activeCampaign && activeCampaign.eligibleProductIds.includes(p.id);
      const discountNotice = isFlash ? `(تخفیف ویژه جشنواره: ${activeCampaign.discountPercent}٪)` : '';
      const specs = p.specifications;

      return `محصول: ${p.name} (${p.nameEn})
شناسه: ${p.id}
برند: ${p.brand} | دسته: ${p.category} | قیمت پایه: ${p.basePrice.toLocaleString('fa-IR')} تومان ${discountNotice}
پردازنده: ${specs.chipset || specs.processor || '—'}
رم و حافظه: رم: ${specs.ram || '—'} | حافظه: ${specs.storage || p.variants[0]?.storage || '—'}
نمایشگر: اندازه: ${specs.displaySize || '—'} | نوع: ${specs.displayTech || specs.display || '—'} | رفرش ریت: ${specs.refreshRate || '—'}
دوربین: اصلی: ${specs.mainCamera || specs.camera || '—'} | سلفی: ${specs.frontCamera || '—'}
باتری و شارژ: ظرفیت: ${specs.batteryCapacity || specs.battery || '—'} | سرعت شارژ: ${specs.chargingSpeed || '—'}
سیستم‌عامل: ${specs.os || '—'}
موجودی کل انبار: ${p.stockTotal} عدد`;
    })
    .join('\n---\n');

  const systemInstruction = `شما «دستیار هوشمند خرید ولترو (VOLTRO AI ASSIST)»، مشاور تخصصی و اختصاصی فروشگاه لوکس کالاهای دیجیتال و گجت‌های پرچمدار ولترو هستید.

وظایف اصلی شما:
۱. تحلیل دقیق نیازها، سقف بودجه، اولویت‌ها (عکاسی حرفه‌ای، گیمینگ، برنامه‌نویسی، کارهای اداری، شارژدهی باتری) و سلیقه برند کاربر.
۲. مقایسه تخصصی و بی‌طرفانه پرچمداران بر اساس مشخصات واقعی، نمایش مزایا (نقاط قوت) و معایب/ملاحظات (نقاط ضعف).
۳. استخراج محصولات صرفاً از کاتالوگ موجودی انبار ولترو.
۴. در صورت ناکافی بودن جزئیات کاربر (مثلاً فقط بگوید "یک گوشی خوب می‌خواهم")، سؤال شفاف‌کننده محترمانه در مورد بودجه و اولویت بپرسید.
۵. اگر کاربر بودجه‌ای مشخص کرده که در آن بازه محصولی در انبار ولترو وجود ندارد (مثلاً بودجه ۳۰ میلیون برای گوشی در حالی که گوشی‌های انبار از ۵۸ یا ۷۴ میلیون شروع می‌شوند)، صراحتاً و محترمانه به کاربر اعلام کنید که در این رنج بودجه گوشی هوشمندی در انبار موجود نیست و کف قیمت گوشی‌های پرچمدار ولترو را اعلام کنید؛ هرگز محصولی که متناسب نیست (مثلاً لپ‌تاپ یا هدفون به جای گوشی) را بدون توضیح به عنوان گوشی پیشنهاد ندهید!

قوانین تخطی‌ناپذیر:
- هرگز قیمت، مشخصات، نام محصول یا موجودی کالا را اختراع نکنید! تنها محصولاتی که در کاتالوگ زیر آمده‌اند وجود دارند.
- اعداد قیمت را به تومان و با فونت فارسی بنویسید (مثلاً «۷۴,۵۰۰,۰۰۰ تومان»).
- در پایان متن، برای هر محصول پیشنهادی تگ ساختارمند زیر را قرار دهید تا در رابط کاربری کارت محصول و نقاط قوت/ضعف رندر شود:
RECOMMENDATIONS:[{"id": "شناسه محصول", "reason": "دلیل پیشنهاد", "pros": ["نقطه قوت ۱", "نقطه قوت ۲"], "cons": ["ملاحظه یا نقطه ضعف ۱"]}]

کاتالوگ محصولات واقعی انبار ولترو:
${productCatalogText}
`;

  const ai = getGenAI();

  if (ai) {
    try {
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      if (input.history && input.history.length > 0) {
        for (const h of input.history.slice(-8)) {
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
          temperature: 0.6,
        },
      });

      const rawText = response.text || '';
      if (rawText) {
        let reply = rawText;
        let recommendedProducts: RecommendedProductItem[] = [];

        const match = rawText.match(/RECOMMENDATIONS:(\[[\s\S]*?\])/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            reply = rawText.replace(match[0], '').trim();
            recommendedProducts = parsed
              .map((rec: { id: string; reason?: string; pros?: string[]; cons?: string[] }) => {
                const p = allProducts.find((prod) => prod.id === rec.id);
                if (!p) return null;
                return {
                  id: p.id,
                  name: p.name,
                  price: p.basePrice,
                  image: p.images[0],
                  reason: rec.reason,
                  pros: rec.pros || [],
                  cons: rec.cons || [],
                };
              })
              .filter(Boolean) as RecommendedProductItem[];
          } catch (e) {
            console.warn('[VOLTRO AI] Failed to parse JSON recommendations:', e);
          }
        }

        // If no JSON block parsed but products mentioned, attach verified products
        if (recommendedProducts.length === 0) {
          for (const p of allProducts) {
            if (rawText.includes(p.name) || rawText.includes(p.nameEn)) {
              recommendedProducts.push({
                id: p.id,
                name: p.name,
                price: p.basePrice,
                image: p.images[0],
                reason: 'پیشنهاد متناسب با اولویت‌های مطرح‌شده شما',
                pros: [p.specifications.chipset || p.specifications.processor, p.specifications.displayTech || p.specifications.display].filter(Boolean) as string[],
                cons: [],
              });
              if (recommendedProducts.length >= 3) break;
            }
          }
        }

        return { reply, recommendedProducts };
      }
    } catch (err: unknown) {
      console.warn('[VOLTRO AI] Gemini API call exception, executing database-grounded advisor:', err);
    }
  }

  // Resilient intelligent database-grounded advisor
  return generateIntelligentDatabaseAdvice(input.message, input.history, allProducts);
}

// Sophisticated Rule-Based & Semantic Search Engine Grounded in Database
function generateIntelligentDatabaseAdvice(
  userQuery: string,
  history: AiChatInput['history'] | undefined,
  allProducts: Product[]
): AiChatResult {
  const q = normalizePersian(userQuery).replace(/\s+/g, ' ').trim();

  // Combine query with recent history for conversational memory
  const previousTurns = (history || [])
    .slice(-4)
    .map((h) => normalizePersian(h.text))
    .join(' ');
  const fullContext = `${previousTurns} ${q}`;

  const budget = parseBudgetFromQuery(q) || parseBudgetFromQuery(previousTurns);

  // Intent classification
  const isSmartphoneQuery = /گوشی|موبایل|تلفن|smartphone|آیفون|سامسونگ|s24|اس 24|iphone|گلکسی/.test(fullContext);
  const isLaptopQuery = /لپ تاپ|لپتاپ|مک بوک|مکبوک|laptop|macbook/.test(fullContext);
  const isTabletQuery = /تبلت|آیپد|ipad|tablet/.test(fullContext);
  const isWatchQuery = /ساعت|واچ|watch|اپل واچ/.test(fullContext);
  const isAudioQuery = /هدفون|ایرپاد|اسپیکر|موسیقی|صدا|headphone|airpod|sound|نویز کنسلینگ/.test(fullContext);

  const isPhotography = /عکاس|فیلمبردار|دوربین|camera|photo|zoom|زوم|سلفی/.test(fullContext);
  const isGaming = /گیم|بازی|fps|گیمینگ|فریم|ری تریسینگ/.test(fullContext);
  const isProgramming = /برنامه نویسی|کدنویسی|داکر|رندر|پایتون|توسعه|مهندسی/.test(fullContext);
  const isBattery = /باتری|شارژ|دوام|نگهداری شارژ|آمپر/.test(fullContext);
  const hasSpecificUseCase = isPhotography || isGaming || isProgramming || isBattery;

  // 1. Check budget constraints on Smartphones
  if (isSmartphoneQuery && budget !== null) {
    const smartphones = allProducts.filter((p) => p.category === 'smartphones');
    const affordableSmartphones = smartphones
      .filter((p) => p.basePrice <= budget)
      .sort((a, b) => b.basePrice - a.basePrice);

    if (affordableSmartphones.length === 0) {
      const minPhonePrice = Math.min(...smartphones.map((p) => p.basePrice));
      const cheapestPhone = smartphones.reduce((prev, curr) => (curr.basePrice < prev.basePrice ? curr : prev), smartphones[0]);
      const formattedBudget = budget.toLocaleString('fa-IR');
      const formattedMinPrice = minPhonePrice.toLocaleString('fa-IR');

      return {
        reply: `با احترام، در حال حاضر در فروشگاه ولترو، گوشی‌های هوشمند موجود مربوط به پرچمداران شاخص بازار با گارانتی رسمی و رجیستری شرکتی هستند:

- **کف قیمت گوشی‌های هوشمند موجود:** از **${formattedMinPrice} تومان** (${cheapestPhone?.name || 'پرچمدار پایه'}) آغاز می‌شود.
- متأسفانه با بودجه اعلامی شما (**${formattedBudget} تومان**)، تلفن همراه هوشمندی در موجودی لحظه‌ای انبار ما موجود نیست.

**پیشنهادات جایگزین:**
۱. در صورتی که امکان افزایش بودجه تا رده ۵۸ الی ۷۴ میلیون تومان را داشته باشید، می‌توانید به سراغ **آیفون ۱۴** یا **سامسونگ اس ۲۴ اولترا** بروید.
۲. در بازه بودجه ${formattedBudget} تومان، در صورت تمایل به تهیه سایر گجت‌های اکوسیستم دیجیتال، **ایرپاد پرو ۲ تایپ‌سی (۱۴,۸۰۰,۰۰۰ تومان)** یا **اسپیکر لوکس B&O Beosound A1 (۱۹,۸۰۰,۰۰۰ تومان)** به عنوان برترین گزینه‌های صوتی در دسترس هستند.`,
        recommendedProducts: [],
      };
    } else {
      const topChoice = isPhotography
        ? affordableSmartphones.find((p) => p.id === 'prod-samsung-s24-ultra') || affordableSmartphones[0]
        : affordableSmartphones[0];

      return {
        reply: `بر اساس بودجه ${budget.toLocaleString('fa-IR')} تومان شما، این پرچمدار در دسترس و موجود است:

**${topChoice.name}**
- **قیمت:** ${topChoice.basePrice.toLocaleString('fa-IR')} تومان
- **ویژگی‌های کلیدی:** ${topChoice.specifications.chipset || topChoice.specifications.processor}، نمایشگر ${topChoice.specifications.displayTech || topChoice.specifications.display}.`,
        recommendedProducts: [
          {
            id: topChoice.id,
            name: topChoice.name,
            price: topChoice.basePrice,
            image: topChoice.images[0],
            reason: 'مطابق با سقف بودجه تعیین‌شده شما',
            pros: [topChoice.specifications.chipset || 'پردازشگر پرچمدار', topChoice.specifications.mainCamera || 'دوربین باکیفیت'],
            cons: ['موجودی محدود انبار'],
          },
        ],
      };
    }
  }

  // 2. Ambiguous query asking for general recommendation without budget or use-case
  const isVagueQuery =
    /^(?:سلام|درود|یک گوشی خوب می خوام|یک گوشی خوب میخوام|گوشی خوب می خوام|گوشی خوب میخوام|گوشی خوب|پیشنهاد بدید|چی بخرم|کمک|راهنمایی)$/.test(q) ||
    (isSmartphoneQuery && budget === null && !hasSpecificUseCase && !/مقایسه|بین|vs|یا|آیفون|سامسونگ|s24|اس 24/.test(q));

  if (isVagueQuery) {
    return {
      reply: `درود و احترام! برای اینکه بهترین انتخاب را متناسب با نیاز و سلیقه شما پیشنهاد دهم، لطفاً ۳ مورد زیر را بفرمایید:

۱. **سقف بودجه تقریبی** شما چقدر است؟
۲. **اولویت اصلی شما چیست؟** (عکاسی و تولید محتوا، گیمینگ و پردازش سنگین، یا عمر باتری بالا؟)
۳. به اکوسیستم **iOS (اپل)** تمایل دارید یا **Android (سامسونگ)**؟

به محض اعلام این موارد، بهترین مدل‌های انبار ولترو را با هم مقایسه و بررسی خواهیم کرد.`,
      recommendedProducts: [],
    };
  }

  // 3. Comparison query between iPhone 15 Pro Max and Galaxy S24 Ultra
  if (
    (q.includes('آیفون') || q.includes('iphone')) &&
    (q.includes('سامسونگ') || q.includes('s24') || q.includes('اس 24') || q.includes('samsung'))
  ) {
    const iphone = allProducts.find((p) => p.id === 'prod-iphone-15-pro-max');
    const s24 = allProducts.find((p) => p.id === 'prod-samsung-s24-ultra');

    return {
      reply: `در مقایسه دو پرچمدار بی‌رقیب حال حاضر جهان در انبار ولترو:

### ۱. عکاسی، فیلمبرداری و زوم:
- **سامسونگ Galaxy S24 Ultra:** سنسور اصلی ۲۰۰ مگاپیکسلی با جزئیات شگفت‌انگیز در نور روز، دو دوربین تله‌فوتو با زوم اپتیکال ۳ برابری و ۵ برابری و زوم هوش مصنوعی تا ۱۰۰ برابر. اگر عکاسی از فاصله دور یا سوژه‌های متحرک در فضای باز اولویت شماست، سامسونگ دست بالا را دارد.
- **آیفون 15 Pro Max:** سنسور ۴۸ مگاپیکسل با رنگ‌های طبیعی‌تر، پردازش بی‌رقیب ویدیو با فرمت‌های استودیویی ProRes و Log، انتقال سریع با USB-C 3 و لنز تتراپریزم ۵ برابری ۱۲۰ میلی‌متری. اگر تولید محتوای اینستاگرام و یوتیوب اولویت شماست، آیفون استاندارد طلایی بازار است.

### ۲. قدرت سخت‌افزار و گیمینگ:
- **آیفون:** تراشه ۳ نانومتری A17 Pro با ری‌تریسینگ سخت‌افزاری و اجرای بازی‌های سطح کنسولی (Resident Evil, Death Stranding).
- **سامسونگ:** تراشه Snapdragon 8 Gen 3 for Galaxy با سیستم خنک‌کننده اتاقک بخار بزرگ‌تر و پایداری فوق‌العاده در جلسات طولانی بازی.

### ۳. نمایشگر و بدنه:
- آیفون با فریم تیتانیوم گرید ۵، وزن سبک ۲۲۱ گرم و داینامیک آیلند.
- سامسونگ با نمایشگر کاملاً تخت ضدبازتاب Gorilla Armor، روشنایی ۲۶۰۰ نیت و قلم هوشمند S-Pen داخلی.`,
      recommendedProducts: [
        {
          id: iphone?.id || 'prod-iphone-15-pro-max',
          name: iphone?.name || 'آیفون 15 پرو مکس',
          price: iphone?.basePrice || 81900000,
          image: iphone?.images[0] || '/images/products/iphone-15-pro-max.png',
          reason: 'بهترین انتخاب برای فیلمبرداری فوق‌حرفه‌ای و اکوسیستم اپل',
          pros: ['کیفیت فیلمبرداری بی‌رقیب 4K ProRes', 'بدنه تیتانیومی فوق‌العاده سبک', 'پردازنده ۳ نانومتری A17 Pro'],
          cons: ['سرعت شارژ محدودتر (۲۷ وات)', 'عدم پشتیبانی از قابلیت‌های چندوظیفگی مثل DeX'],
        },
        {
          id: s24?.id || 'prod-samsung-s24-ultra',
          name: s24?.name || 'سامسونگ گلکسی اس 24 اولترا',
          price: s24?.basePrice || 74500000,
          image: s24?.images[0] || '/images/products/samsung-s24-ultra.png',
          reason: 'بهترین برای عکاسی با زوم دوربرد، قلم لمسی S-Pen و نمایشگر ضدبازتاب',
          pros: ['سنسور اصلی ۲۰۰ مگاپیکسلی با زوم ۱۰۰ برابری', 'نمایشگر ضدبازتاب با روشنایی ۲۶۰۰ نیت', 'قلم دیجیتال S-Pen و هوش مصنوعی Galaxy AI'],
          cons: ['ابعاد بزرگ و زاویه‌دار فریم', 'فیلمبرداری شبانه اندکی پایین‌تر از آیفون'],
        },
      ],
    };
  }

  // 4. Laptop / Programming / Workstation query
  if (isLaptopQuery || isProgramming) {
    const laptops = allProducts.filter((p) => p.category === 'laptops');
    const affordableLaptops = budget !== null ? laptops.filter((p) => p.basePrice <= budget) : laptops;
    if (budget !== null && affordableLaptops.length === 0 && laptops.length > 0) {
      const minLaptopPrice = Math.min(...laptops.map((p) => p.basePrice));
      const cheapestLaptop = laptops.reduce((prev, curr) => (curr.basePrice < prev.basePrice ? curr : prev), laptops[0]);
      return {
        reply: `با احترام، در حال حاضر لپ‌تاپ موجود در انبار ولترو **${cheapestLaptop.name}** با قیمت **${minLaptopPrice.toLocaleString('fa-IR')} تومان** است و متأسفانه با سقف بودجه **${budget.toLocaleString('fa-IR')} تومان** لپ‌تاپ برنامه‌نویسی در انبار موجود نیست.`,
        recommendedProducts: [],
      };
    }

    const mbp = affordableLaptops[0] || allProducts.find((p) => p.id === 'prod-macbook-pro-16');
    if (mbp) {
      return {
        reply: `برای کارهای مهندسی، برنامه‌نویسی پیشرفته و تولید محتوای گرافیکی سنگین:

**${mbp.name}:**
- **قیمت:** ${mbp.basePrice.toLocaleString('fa-IR')} تومان
- **پردازنده و معماری:** ${mbp.specifications.chipset || mbp.specifications.processor} همراه با ${mbp.specifications.ram || 'رم یکپارچه'} و ${mbp.specifications.storage || 'حافظه پرسرعت SSD'}.
- **باتری:** ${mbp.specifications.batteryCapacity || mbp.specifications.battery}.
- **نمایشگر:** ${mbp.specifications.displayTech || mbp.specifications.display}.`,
        recommendedProducts: [
          {
            id: mbp.id,
            name: mbp.name,
            price: mbp.basePrice,
            image: mbp.images[0],
            reason: 'قدرتمندترین ورک‌استیشن همراه برای برنامه‌نویسان و تحلیل‌گران داده',
            pros: [mbp.specifications.ram || 'رم یکپارچه پرسرعت', mbp.specifications.batteryCapacity || 'عمر باتری طولانی'],
            cons: ['قیمت رده لوکس'],
          },
        ],
      };
    }
  }

  // 5. Tablet query
  if (isTabletQuery) {
    const ipad = allProducts.find((p) => p.category === 'tablets') || allProducts[0];
    return {
      reply: `برای طراحی دیجیتال، یادداشت‌برداری، مطالعه و ویرایش ویدیو در ابعاد قابل حمل:

**آیپد پرو ۱۳ اینچ با تراشه M4:**
- مجهز به نمایشگر انقلابی Tandem OLED دولایه با کنتراست بی‌نهایت و روشنایی خیره‌کننده ۱۶۰۰ نیت.
- ضخامت فوق‌باریک ۵.۱ میلی‌متری و وزن بسیار سبک که حمل آن را فوق‌العاده آسان می‌کند.
- پشتیبانی کامل از قلم Apple Pencil Pro و قابلیت‌های لمسی بازخوردی.`,
      recommendedProducts: [
        {
          id: ipad.id,
          name: ipad.name,
          price: ipad.basePrice,
          image: ipad.images[0],
          reason: 'برترین تبلت جهان با فناوری نمایشگر Tandem OLED و تراشه M4',
          pros: ['تراشه M4 با توان پردازش هوش مصنوعی پیشرفته', 'نمایشگر Ultra Retina XDR با کنتراست خیره‌کننده', 'ضخامت باورنکردنی ۵.۱ میلی‌متری'],
          cons: ['سیستم‌عامل iPadOS محدودتر از macOS در مقایسه با لپ‌تاپ'],
        },
      ],
    };
  }

  // 6. Watch / Smartwatch query
  if (isWatchQuery) {
    const watch = allProducts.find((p) => p.id === 'prod-apple-watch-ultra-2');
    return {
      reply: `برای ساعت هوشمند پرچمدار، ورزش‌های حرفه‌ای و پایش سلامت:

**اپل واچ اولترا ۲ تیتانیوم:**
- **بدنه تیتانیومی ۴۹ میلی‌متری:** مقاوم در برابر ضربه و نفوذ آب تا عمق ۱۰۰ متر با کریستال یاقوت کبود تخت.
- **نمایشگر با روشنایی ۳۰۰۰ نیت:** کاملاً خوانا در زیر درخشان‌ترین تابش نور خورشید در کویر یا کوهستان.
- **باتری:** شارژدهی تا ۷۲ ساعت در حالت ذخیره انرژی (Low Power) و سنسورهای پایش غواصی، نوار قلب (ECG) و اکسیژن خون.`,
      recommendedProducts: [
        {
          id: watch?.id || 'prod-apple-watch-ultra-2',
          name: watch?.name || 'اپل واچ اولترا 2 تیتانیوم',
          price: watch?.basePrice || 49400000,
          image: watch?.images[0] || '/images/products/apple-watch-ultra-2.png',
          reason: 'مقاوم‌ترین ساعت هوشمند با روشنایی ۳۰۰۰ نیت و بدنه تیتانیومی',
          pros: ['روشنایی خیره‌کننده ۳۰۰۰ نیت', 'بدنه تیتانیومی نظامی با شیشه سافایر', 'باتری با دوام تا ۷۲ ساعت'],
          cons: ['ابعاد بزرگ ۴۹ میلی‌متری برای مچ‌های بسیار ظریف'],
        },
      ],
    };
  }

  // 7. Headphones / Audio query
  if (isAudioQuery) {
    const max = allProducts.find((p) => p.id === 'prod-airpods-max');
    const pro = allProducts.find((p) => p.id === 'prod-airpods-pro-2');
    return {
      reply: `در میان تجهیزات صوتی های‌فای انبار ولترو:

۱. **اپل ایرپاد مکس (AirPods Max):** اگر هدفون روگوشی (Over-Ear) استودیویی با عایق نویز حداکثری، بدنه آلومینیومی بادوام و تفکیک کریستالی سازها می‌خواهید.
۲. **ایرپاد پرو ۲ تایپ‌سی (AirPods Pro 2):** اگر هدفون توگوشی و همراه برای رفت‌وآمد، ورزش، مکالمه و حذف نویز هوشمند می‌خواهید.`,
      recommendedProducts: [
        {
          id: max?.id || 'prod-airpods-max',
          name: max?.name || 'هدفون اپل ایرپاد مکس',
          price: max?.basePrice || 42850000,
          image: max?.images[0] || '/images/products/airpods-max.png',
          reason: 'کیفیت صدای مانیتورینگ استودیویی و حذف نویز اکتیو قدرتمند',
          pros: ['تفکیک صدای استودیویی با ساب‌بیس عمیق', 'حذف نویز فعال (ANC) ۸ میکروفونی', 'بدنه تمام آلومینیومی لوکس'],
          cons: ['وزن نسبتاً سنگین ۳۸۴ گرمی'],
        },
        {
          id: pro?.id || 'prod-airpods-pro-2',
          name: pro?.name || 'ایرپاد پرو 2 تایپ‌سی',
          price: pro?.basePrice || 14800000,
          image: pro?.images[0] || '/images/products/airpods-pro-2.png',
          reason: 'سبک، روزمره با نویز کنسلینگ دوبرابری و شارژدهی عالی',
          pros: ['حذف نویز قوی با تراشه صوتی Apple H2', 'کیس شارژ مجهز به USB-C و اسپیکر داخلی', 'طراحی ارگونومیک با وزن سبک ۵.۳ گرم'],
          cons: ['طول عمر باتری ۶ ساعته هر گوشی قبل از قرارگیری در کیس'],
        },
      ],
    };
  }

  // 7.5 Smartphone use-case recommendation (Photography, Gaming, Battery)
  if (isSmartphoneQuery || isPhotography || isGaming || isBattery) {
    const smartphones = allProducts.filter((p) => p.category === 'smartphones');
    const s24 = smartphones.find((p) => p.id === 'prod-samsung-s24-ultra') || smartphones[0];
    const iphone = smartphones.find((p) => p.id === 'prod-iphone-15-pro-max') || smartphones[1] || smartphones[0];
    const focusTitle = isPhotography
      ? 'عکاسی و فیلمبرداری حرفه‌ای'
      : isGaming
        ? 'گیمینگ سنگین و نرخ فریم بالا'
        : isBattery
          ? 'شارژدهی طولانی‌مدت باتری'
          : 'عملکرد پرچمدار';

    const picks = [s24, iphone].filter((p, idx, arr): p is Product => Boolean(p) && arr.findIndex((x) => x?.id === p.id) === idx);
    return {
      reply: `برای اولویت **${focusTitle}**، برترین پرچمداران موجود در انبار ولترو عبارتند از:\n\n${picks
        .map(
          (p) =>
            `- **${p.name}** (${p.basePrice.toLocaleString('fa-IR')} تومان): تراشه ${p.specifications.chipset || p.specifications.processor}، دوربین ${p.specifications.mainCamera || p.specifications.camera || 'حرفه‌ای'} و باتری ${p.specifications.batteryCapacity || p.specifications.battery || 'قدرتمند'}.`
        )
        .join('\n')}`,
      recommendedProducts: picks.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.basePrice,
        image: p.images[0],
        reason: `مناسب برای ${focusTitle}`,
        pros: [p.specifications.mainCamera || p.specifications.chipset || 'سخت‌افزار پرچمدار', p.specifications.displayTech || 'نمایشگر پرچمدار'].filter(Boolean) as string[],
        cons: ['قیمت رده پرچمدار'],
      })),
    };
  }

  // 8. General fallback query
  const featured = allProducts.filter((p) => p.isFeatured).slice(0, 3);
  return {
    reply: `درود بر شما! من دستیار هوشمند ولترو هستم.

بر اساس محصولات فعال انبار اختصاصی ولترو، می‌توانید هر یک از موارد زیر را بپرسید:
- **بررسی بودجه:** سقف هزینه مورد نظرتان را اعلام فرمایید تا گزینه‌های موجود را پیشنهاد کنم.
- **مقایسه تخصصی:** مقایسه سخت‌افزاری و دوربینی میان آیفون ۱۵ پرو مکس و سامسونگ اس ۲۴ اولترا.
- **انتخاب بر اساس کاربری:** بهترین لپ‌تاپ یا گوشی برای عکاسی، گیمینگ، برنامه‌نویسی یا تولید محتوا.

تمامی محصولات دارای ضمانت اصالت فیزیکی، ۱۸ ماه گارانتی رسمی و مهلت تست ۷ روزه هستند. مایلید کدام دسته را با هم بررسی کنیم؟`,
    recommendedProducts: featured.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.basePrice,
      image: p.images[0],
      reason: 'محصول برگزیده و پرچمدار انبار ولترو',
      pros: [p.specifications.chipset || p.specifications.processor, 'گارانتی ۱۸ ماهه رسمی'],
      cons: [],
    })),
  };
}
