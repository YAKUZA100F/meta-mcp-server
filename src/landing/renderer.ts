import { LandingPage } from "../services/db.js";

export function renderLandingPage(page: LandingPage, storeName: string): string {
  const primaryColor = page.themeColor || "#10b981"; // emerald-500
  const compareAt = page.compareAtPrice || Math.round(page.price * 1.6);
  const savings = Math.max(0, compareAt - page.price);
  const discountPercent = Math.round((savings / compareAt) * 100);

  const mainImage = page.images && page.images.length > 0
    ? page.images[0]
    : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&q=85";
  const galleryImages = page.images && page.images.length > 0 ? page.images : [mainImage];

  // Dynamic pricing for bundles (High-converting Moroccan COD standard)
  const pack1Price = page.price;
  const pack2Price = Math.round(page.price * 1.65);
  const pack3Price = Math.round(page.price * 2.3);

  const pack2Savings = (page.price * 2) - pack2Price;
  const pack3Savings = (page.price * 3) - pack3Price;

  const isRed = Boolean(
    page.themeColor &&
      (page.themeColor.includes("red") ||
        page.themeColor.includes("#dc") ||
        page.themeColor.includes("#e1") ||
        page.themeColor.includes("#f4") ||
        page.themeColor.includes("#b9") ||
        page.themeColor.includes("حمر") ||
        page.themeColor.includes("أحمر"))
  );

  const t = {
    topBar: isRed ? "from-red-700 via-rose-700 to-red-800" : "from-emerald-600 via-teal-700 to-emerald-800",
    primaryGrad: isRed ? "from-red-600 via-rose-600 to-red-700" : "from-emerald-600 via-teal-600 to-emerald-700",
    primaryHover: isRed ? "hover:from-red-700 hover:to-rose-800" : "hover:from-emerald-700 hover:to-teal-800",
    btnSolid: isRed ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700",
    textPrimary: isRed ? "text-red-600" : "text-emerald-700",
    borderPrimary: isRed ? "border-red-500" : "border-emerald-500",
    borderActive: isRed ? "border-red-600" : "border-emerald-600",
    ringActive: isRed ? "ring-red-500/20" : "ring-emerald-500/20",
    bgLight: isRed ? "bg-red-50" : "bg-emerald-50",
    bgLight60: isRed ? "bg-red-50/60" : "bg-emerald-50/60",
    borderLight: isRed ? "border-red-200" : "border-emerald-200",
    textLight: isRed ? "text-red-700" : "text-emerald-800",
    badgeBg: isRed ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800",
    shadow: isRed ? "shadow-red-600/30" : "shadow-emerald-600/30",
    cardRing: isRed ? "border-red-500 ring-2 ring-red-500/20" : "border-emerald-600 ring-2 ring-emerald-500/20",
    pulseColor: isRed ? "rgba(220, 38, 38, 0.7)" : "rgba(16, 185, 129, 0.7)",
  };

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(page.title)} | ${escapeHtml(storeName)}</title>
  <meta name="description" content="${escapeHtml(page.description?.slice(0, 160) || page.title)}">
  
  <!-- Tailwind CSS & Google Fonts (Cairo) -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900;1000&display=swap" rel="stylesheet">
  
  <style>
    * { font-family: 'Cairo', sans-serif; }
    
    @keyframes pulse-ring {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 ${t.pulseColor}; }
      70% { transform: scale(1.02); box-shadow: 0 0 0 14px rgba(0, 0, 0, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 ${t.pulseColor}; }
    }
    
    .pulse-cta {
      animation: pulse-ring 2.2s infinite cubic-bezier(0.45, 0, 0.55, 1);
    }

    .shimmer-badge {
      background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
      background-size: 200% 100%;
      animation: shimmer 2.5s infinite;
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  </style>

  ${page.pixelId ? `
  <!-- Meta Pixel Code -->
  <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${page.pixelId}');
    fbq('track', 'PageView');
    fbq('track', 'ViewContent', { content_name: '${escapeHtml(page.title)}', value: ${page.price}, currency: 'MAD' });
  </script>
  <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${page.pixelId}&ev=PageView&noscript=1"
  /></noscript>
  ` : ""}
</head>
<body class="bg-[#f8fafc] text-slate-800 antialiased pb-24 md:pb-12">

  <!-- 1. Top Urgency Announcement Bar -->
  <div class="bg-gradient-to-r ${t.topBar} text-white text-xs md:text-sm font-extrabold py-2.5 px-4 text-center shadow-sm flex items-center justify-center gap-2">
    <span>🚚 التوصيل مجاني وسريع لجميع مدن المغرب 🇲🇦 | الدفع نقدًا عند الاستلام بعد المعاينة 💵</span>
  </div>

  <!-- 2. Brand Sticky Header -->
  <header class="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-sm py-3 px-4 md:px-8">
    <div class="max-w-5xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br ${t.primaryGrad} text-white flex items-center justify-center font-black text-lg shadow-sm">
          🛍️
        </div>
        <div>
          <span class="text-base md:text-xl font-black text-slate-900 tracking-tight block">${escapeHtml(storeName)}</span>
          <span class="text-[10px] ${t.textPrimary} font-bold block -mt-1">متجر إلكتروني مغربي موثوق ⭐⭐⭐⭐⭐</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        ${page.whatsappNumber ? `
        <a href="https://wa.me/${page.whatsappNumber.replace(/\D/g, '')}" target="_blank" class="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:${t.textPrimary} bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 transition">
          <span>💬 استفسار عبر واتساب</span>
        </a>
        ` : ""}
        <a href="#order-form" class="${t.btnSolid} text-white font-extrabold text-xs md:text-sm px-4 md:px-5 py-2 md:py-2.5 rounded-xl shadow-md transition flex items-center gap-1.5">
          <span>أطلب الآن 🚚</span>
        </a>
      </div>
    </div>
  </header>

  <!-- 3. Main Container -->
  <main class="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8 md:space-y-12">

    <!-- HERO SECTION (Split on desktop, stacked on mobile) -->
    <div class="bg-white rounded-3xl p-5 md:p-8 border border-slate-200/80 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      <!-- Left Column: Interactive Product Gallery (5 cols) -->
      <div class="lg:col-span-6 space-y-4 lg:sticky lg:top-24">
        
        <!-- Main Hero Image Frame -->
        <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-square group shadow-inner">
          <img 
            id="main-image" 
            src="${mainImage}" 
            alt="${escapeHtml(page.title)}" 
            class="w-full h-full object-cover transition duration-300 group-hover:scale-105"
          >
          
          <!-- Discount Overlay Badge -->
          ${discountPercent > 0 ? `
          <div class="absolute top-3 right-3 bg-rose-600 text-white font-black text-xs md:text-sm px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1">
            <span>تخفيض -${discountPercent}%</span>
          </div>
          ` : ""}

          <div class="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
            🔍 انقر لتكبير الصورة
          </div>
        </div>

        <!-- Thumbnails row -->
        ${galleryImages.length > 1 ? `
        <div class="flex gap-2.5 overflow-x-auto pb-1 hide-scrollbar">
          ${galleryImages.map((img, idx) => `
            <button 
              type="button"
              onclick="switchMainImage('${img}', this)" 
              class="thumb-btn w-16 h-16 md:w-20 md:h-20 rounded-xl border-2 ${idx === 0 ? t.cardRing : 'border-slate-200'} overflow-hidden flex-shrink-0 transition hover:border-slate-400 bg-slate-50"
            >
              <img src="${img}" alt="Thumbnail ${idx}" class="w-full h-full object-cover">
            </button>
          `).join("")}
        </div>
        ` : ""}

        <!-- Trust Badges Strip Under Images -->
        <div class="grid grid-cols-3 gap-2 pt-2 text-center text-[11px] text-slate-600 font-bold">
          <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <div class="text-base mb-0.5">🚚</div>
            <div>توصيل فابور</div>
          </div>
          <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <div class="text-base mb-0.5">💵</div>
            <div>دفع عند الاستلام</div>
          </div>
          <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <div class="text-base mb-0.5">🔄</div>
            <div>ضمان استبدال</div>
          </div>
        </div>

      </div>

      <!-- Right Column: Product Presentation & Pricing (6 cols) -->
      <div class="lg:col-span-6 space-y-5">
        
        <!-- Social Proof Pill -->
        <div class="inline-flex items-center gap-2 ${t.bgLight} ${t.textLight} text-xs font-black px-3.5 py-1.5 rounded-full border ${t.borderLight}">
          <span class="flex text-amber-400">★★★★★</span>
          <span>4.9/5 · الأكثر مبيعاً في المغرب 🇲🇦</span>
        </div>

        <!-- Main Title -->
        <h1 class="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 leading-tight">
          ${escapeHtml(page.title)}
        </h1>

        <!-- Rating & Sales counter -->
        <div class="flex items-center gap-3 text-xs md:text-sm text-slate-600 font-semibold border-b border-slate-100 pb-3">
          <span class="${t.textPrimary} font-extrabold ${t.bgLight} px-2 py-0.5 rounded">✔ تم تأكيد 1,480+ طلبية</span>
          <span>· تم فحص الجودة</span>
        </div>

        <!-- Pricing Card Box with Countdown -->
        <div class="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 md:p-5 border-2 ${t.borderPrimary}/30 space-y-3 shadow-sm">
          <div class="flex items-baseline justify-between flex-wrap gap-2">
            <div class="flex items-baseline gap-2.5">
              <span class="text-3xl md:text-4xl font-black ${t.textPrimary}">${page.price} <span class="text-xl">${page.currency || "درهم"}</span></span>
              ${compareAt ? `<span class="text-base md:text-lg text-slate-400 line-through font-bold">${compareAt} ${page.currency || "درهم"}</span>` : ""}
            </div>
            ${savings > 0 ? `
            <span class="bg-rose-500 text-white font-black text-xs px-2.5 py-1 rounded-lg shadow-sm">
              وفرت ${savings} درهم 💥
            </span>
            ` : ""}
          </div>

          <!-- Urgency Countdown & Stock Bar -->
          <div class="bg-white rounded-xl p-3 border border-slate-200/80 space-y-2">
            <div class="flex items-center justify-between text-xs font-black text-slate-800">
              <span class="flex items-center gap-1.5 text-rose-600">
                <span class="animate-ping inline-flex h-2 w-2 rounded-full bg-rose-500 opacity-75"></span>
                سارع! ينتهي العرض المخفض خلال:
              </span>
              <span id="countdown-timer" class="font-mono bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded font-black">04:25:18</span>
            </div>
            
            <div class="space-y-1">
              <div class="flex justify-between text-[11px] font-bold text-slate-500">
                <span>القطع المتبقية بسعر التخفيض:</span>
                <span class="text-rose-600 font-extrabold">باقي 7 قطع فقط! ⚠️</span>
              </div>
              <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div class="bg-gradient-to-r from-amber-500 to-rose-600 h-2 rounded-full" style="width: 86%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bullets Points / Why buy -->
        <div class="space-y-2.5 text-xs md:text-sm text-slate-700 font-bold">
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">✓</div>
            <span>التوصيل فابور بالمجان لجميع مدن وقرى المغرب.</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">✓</div>
            <span>ما تخلص حتى توصلك الكولية وتقلبها وتتأكد منها بنفسك.</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">✓</div>
            <span>ضمان استبدال واسترجاع لمدة 30 يوم كاملة.</span>
          </div>
        </div>

        <!-- Jump to Form CTA button -->
        <a 
          href="#order-form" 
          class="pulse-cta block w-full text-center bg-gradient-to-r ${t.primaryGrad} ${t.primaryHover} text-white font-black text-base md:text-lg py-4 px-6 rounded-2xl shadow-xl ${t.shadow} transition transform hover:-translate-y-0.5"
        >
          <span>اضغط هنا للطلب والدفع عند الاستلام 🚚</span>
        </a>

      </div>

    </div>

    <!-- 4. Features & Problem-Solution Section -->
    ${page.features && page.features.length > 0 ? `
    <section class="bg-white rounded-3xl p-6 md:p-10 border border-slate-200/80 shadow-sm space-y-6">
      <div class="text-center max-w-xl mx-auto space-y-2">
        <span class="text-emerald-700 text-xs font-black bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase">لماذا يختاره آلاف المغاربة؟</span>
        <h2 class="text-2xl md:text-3xl font-black text-slate-900">مميزات استثنائية تجعله خيارك الأفضل:</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${page.features.map((feat, i) => `
          <div class="bg-slate-50 hover:bg-emerald-50/50 p-4 md:p-5 rounded-2xl border border-slate-200/80 transition flex items-start gap-3.5">
            <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
              0${i + 1}
            </div>
            <div>
              <h3 class="text-sm md:text-base font-extrabold text-slate-900 leading-snug">${escapeHtml(feat)}</h3>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
    ` : ""}

    <!-- 5. Description Block (if present) -->
    ${page.description ? `
    <section class="bg-white rounded-3xl p-6 md:p-10 border border-slate-200/80 shadow-sm space-y-4">
      <h2 class="text-xl md:text-2xl font-black text-slate-900 border-b border-slate-100 pb-3">تفاصيل ووصف المنتج:</h2>
      <div class="prose text-slate-700 text-sm md:text-base leading-relaxed whitespace-pre-line">
        ${escapeHtml(page.description)}
      </div>
    </section>
    ` : ""}

    <!-- 6. 3-Step Process (How COD works in Morocco) -->
    <section class="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 md:p-10 space-y-6 shadow-xl">
      <div class="text-center space-y-1">
        <h2 class="text-xl md:text-2xl font-black">كيف تتم عملية الشراء والتوصيل؟</h2>
        <p class="text-xs md:text-sm text-slate-300">3 خطوات سهلة وبسيطة بدون أي تعقيد:</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div class="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-2">
          <div class="w-12 h-12 mx-auto bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-2xl font-bold border border-emerald-500/30">1</div>
          <h3 class="font-extrabold text-sm md:text-base text-white">سجّل طلبك الآن</h3>
          <p class="text-xs text-slate-300">أدخل اسمك ورقم هاتفك والمدينة في الاستمارة أسفله.</p>
        </div>

        <div class="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-2">
          <div class="w-12 h-12 mx-auto bg-teal-500/20 text-teal-400 rounded-2xl flex items-center justify-center text-2xl font-bold border border-teal-500/30">2</div>
          <h3 class="font-extrabold text-sm md:text-base text-white">نؤكد معك الطلب</h3>
          <p class="text-xs text-slate-300">يتصل بك فريق العمل هاتفياً أو عبر واتساب لتأكيد موعد التسليم.</p>
        </div>

        <div class="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-2">
          <div class="w-12 h-12 mx-auto bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-2xl font-bold border border-emerald-500/30">3</div>
          <h3 class="font-extrabold text-sm md:text-base text-white">افحص ثم ادفع 💵</h3>
          <p class="text-xs text-slate-300">تصلك الكولية حتى لباب الدار، تفحص المنتج وتتأكد منه عاد كتخلص.</p>
        </div>
      </div>
    </section>

    <!-- 7. THE HIGH-CONVERTING COD CHECKOUT FORM (The Engine) -->
    <section id="order-form" class="bg-white rounded-3xl p-6 md:p-10 border-2 ${t.borderPrimary} shadow-2xl space-y-6 scroll-mt-24">
      
      <div class="text-center space-y-2">
        <span class="${t.badgeBg} text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider">
          🚚 استمارة الشراء المباشر (الدفع عند الاستلام)
        </span>
        <h2 class="text-2xl md:text-3xl font-black text-slate-900">أدخل معلوماتك للاستفادة من العرض المجاني:</h2>
        <p class="text-xs md:text-sm text-slate-500 font-bold">لن تدفع أي شيء الآن، الدفع نقدًا عند استلام وفحص طلبيتك 🔒</p>
      </div>

      <form id="cod-order-form" onsubmit="handleOrderSubmit(event)" class="space-y-5">

        <!-- Bundle Packages Selector Cards (Key Moroccan COD conversion booster) -->
        <div class="space-y-2.5">
          <label class="block text-xs md:text-sm font-black text-slate-800">1. اختر العرض المناسب لك:</label>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            <!-- Pack 1 -->
            <label class="pack-option relative flex items-center p-4 border-2 border-slate-200 rounded-2xl cursor-pointer hover:border-slate-400 transition bg-slate-50/50">
              <input type="radio" name="pack_qty" value="1" data-price="${pack1Price}" checked onchange="updateTotalOrderPrice()" class="w-4 h-4 text-slate-800 focus:ring-0">
              <div class="mr-3 flex-1">
                <div class="text-sm font-black text-slate-900">قطعة واحدة (1 حبة)</div>
                <div class="text-xs text-slate-500">العرض الفردي الأساسي</div>
                <div class="text-sm font-black ${t.textPrimary} mt-1">${pack1Price} ${page.currency || "درهم"}</div>
              </div>
            </label>

            <!-- Pack 2 (Recommended / Most Popular) -->
            <label class="pack-option relative flex items-center p-4 border-2 ${t.borderPrimary} ${t.bgLight60} rounded-2xl cursor-pointer transition shadow-sm">
              <div class="absolute -top-3 left-4 bg-gradient-to-r ${t.primaryGrad} text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
                الأكثر طلباً ⭐
              </div>
              <input type="radio" name="pack_qty" value="2" data-price="${pack2Price}" onchange="updateTotalOrderPrice()" class="w-4 h-4 text-slate-800 focus:ring-0">
              <div class="mr-3 flex-1">
                <div class="text-sm font-black text-slate-900">قطعتين (2 حبات)</div>
                <div class="text-xs ${t.textLight} font-bold">وفّر ${pack2Savings} درهم إضافية!</div>
                <div class="text-sm font-black ${t.textPrimary} mt-1">${pack2Price} ${page.currency || "درهم"}</div>
              </div>
            </label>

            <!-- Pack 3 (Max savings) -->
            <label class="pack-option relative flex items-center p-4 border-2 border-slate-200 rounded-2xl cursor-pointer hover:border-slate-400 transition bg-slate-50/50">
              <div class="absolute -top-3 left-4 bg-rose-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
                عرض التوفير 🔥
              </div>
              <input type="radio" name="pack_qty" value="3" data-price="${pack3Price}" onchange="updateTotalOrderPrice()" class="w-4 h-4 text-slate-800 focus:ring-0">
              <div class="mr-3 flex-1">
                <div class="text-sm font-black text-slate-900">3 قطع (باقة التوفير)</div>
                <div class="text-xs text-rose-600 font-bold">وفّر ${pack3Savings} درهم!</div>
                <div class="text-sm font-black ${t.textPrimary} mt-1">${pack3Price} ${page.currency || "درهم"}</div>
              </div>
            </label>

          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <!-- Full Name -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">الاسم والنسب (الكامل) *</label>
            <div class="relative">
              <input 
                type="text" 
                id="form_name" 
                required 
                placeholder="مثال: يوسف الإدريسي" 
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-slate-500 focus:bg-white transition"
              >
              <div class="absolute left-3 top-3 text-slate-400">👤</div>
            </div>
          </div>

          <!-- WhatsApp Phone Number -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">رقم الهاتف (الواتساب) *</label>
            <div class="relative">
              <input 
                type="tel" 
                id="form_phone" 
                required 
                dir="ltr"
                placeholder="06XXXXXXXX أو 07XXXXXXXX" 
                class="w-full text-right bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-slate-500 focus:bg-white font-mono transition"
              >
              <div class="absolute left-3 top-3 text-slate-400">📱 🇲🇦</div>
            </div>
            <span class="text-[11px] text-slate-500 mt-1 block">سنتصل بك على هذا الرقم لتأكيد موعد التوصيل.</span>
          </div>

        </div>

        <!-- City Dropdown (Comprehensive Moroccan Cities) -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">المدينة أو الإقليم *</label>
          <div class="relative">
            <select 
              id="form_city" 
              required 
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-slate-500 focus:bg-white transition cursor-pointer appearance-none"
            >
              <option value="" disabled selected>اختر مدينتك من القائمة 📍</option>
              <option value="الدار البيضاء">الدار البيضاء (Casablanca)</option>
              <option value="الرباط">الرباط (Rabat)</option>
              <option value="سلا">سلا (Salé)</option>
              <option value="مراكش">مراكش (Marrakech)</option>
              <option value="طنجة">طنجة (Tanger)</option>
              <option value="فاس">فاس (Fès)</option>
              <option value="أكادير">أكادير (Agadir)</option>
              <option value="مكناس">مكناس (Meknès)</option>
              <option value="وجدة">وجدة (Oujda)</option>
              <option value="القنيطرة">القنيطرة (Kénitra)</option>
              <option value="تطوان">تطوان (Tétouan)</option>
              <option value="تمارة">تمارة (Témara)</option>
              <option value="المحمدية">المحمدية (Mohammedia)</option>
              <option value="الجديدة">الجديدة (El Jadida)</option>
              <option value="خريبكة">خريبكة (Khouribga)</option>
              <option value="بني ملال">بني ملال (Béni Mellal)</option>
              <option value="الناظور">الناظور (Nador)</option>
              <option value="آسفي">آسفي (Safi)</option>
              <option value="العيون">العيون (Laâyoune)</option>
              <option value="الداخلة">الداخلة (Dakhla)</option>
              <option value="ورزازات">ورزازات (Ouarzazate)</option>
              <option value="العرائش">العرائش (Larache)</option>
              <option value="برشيد">برشيد (Berrechid)</option>
              <option value="مدينة أخرى">مدينة أخرى (سنتواصل معك لتحديدها)</option>
            </select>
            <div class="absolute left-3 top-3.5 text-slate-400 pointer-events-none">▼</div>
          </div>
        </div>

        <!-- Detailed Address (Optional) -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">العنوان أو الحي (اختياري)</label>
          <input 
            type="text" 
            id="form_address" 
            placeholder="الحي، رقم الشارع أو المنزل (لضمان سرعة الوصول)" 
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-slate-500 focus:bg-white transition"
          >
        </div>

        <!-- Summary & Big CTA -->
        <div class="pt-4 border-t border-slate-200 space-y-3">
          
          <div class="${t.bgLight} border ${t.borderLight} rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span class="text-xs text-slate-600 block font-bold">المجموع الكلي للدفع:</span>
              <span class="text-[11px] ${t.textLight} font-extrabold">شامل التوصيل المجاني 🚚</span>
            </div>
            <div id="form-total-display" class="text-2xl md:text-3xl font-black ${t.textPrimary}">
              ${pack1Price} ${page.currency || "درهم"}
            </div>
          </div>

          <button 
            type="submit" 
            id="order-submit-btn" 
            class="pulse-cta w-full bg-gradient-to-r ${t.primaryGrad} ${t.primaryHover} text-white font-black text-lg md:text-xl py-4 md:py-5 px-6 rounded-2xl shadow-xl ${t.shadow} transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>أكّد طلبك الآن 🚚 (الدفع عند الاستلام)</span>
          </button>

          <div class="flex items-center justify-center gap-4 text-xs text-slate-500 font-bold pt-1">
            <span>🔒 تسوق آمن 100%</span>
            <span>·</span>
            <span>معاينة قبل الدفع</span>
            <span>·</span>
            <span>ضمان 30 يوم</span>
          </div>

        </div>

      </form>

    </section>

    <!-- 8. Real Customer Testimonials (Moroccan Social Proof) -->
    <section class="bg-white rounded-3xl p-6 md:p-10 border border-slate-200/80 shadow-sm space-y-6">
      <div class="text-center space-y-1">
        <span class="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">آراء زبنائنا بالمغرب</span>
        <h2 class="text-2xl font-black text-slate-900">شهادات وتجارب حقيقية:</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-slate-900 text-sm">عمر العباسي</span>
            <span class="text-amber-400 text-xs">★★★★★</span>
          </div>
          <span class="text-[10px] text-slate-400 block">📍 الدار البيضاء · شراء مؤكد ✔</span>
          <p class="text-xs text-slate-600 leading-relaxed">"وصلاتني السلعة فـ 24 ساعة، كاليتي ممتازة بحال التصاور تماماً. الموزع تعامل معاي مزيان وخلاّني حليت الكولية وفحصتها عاد خلصتو. شكراً بزاف!"</p>
        </div>

        <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-slate-900 text-sm">سارة التازي</span>
            <span class="text-amber-400 text-xs">★★★★★</span>
          </div>
          <span class="text-[10px] text-slate-400 block">📍 الرباط · شراء مؤكد ✔</span>
          <p class="text-xs text-slate-600 leading-relaxed">"صراحة كنت مترددة ولكن خدمة العملاء فالواتساب جاوبوني بسرعة وأكدوا معايا. المنتج جودة عالية وكيستاهل الثمن ديالو."</p>
        </div>

        <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-slate-900 text-sm">رشيد العمراني</span>
            <span class="text-amber-400 text-xs">★★★★★</span>
          </div>
          <span class="text-[10px] text-slate-400 block">📍 طنجة · شراء مؤكد ✔</span>
          <p class="text-xs text-slate-600 leading-relaxed">"خديت العرض ديال 2 حبات ليا وللأخ ديالي. التوصيل كان سريع والمنتج ناضي خدام 10/10. أنصح به بشدة."</p>
        </div>

      </div>
    </section>

    <!-- 9. FAQ Section (أسئلة شائعة) -->
    <section class="bg-white rounded-3xl p-6 md:p-10 border border-slate-200/80 shadow-sm space-y-4">
      <h2 class="text-xl md:text-2xl font-black text-slate-900 border-b border-slate-100 pb-3">أسئلة شائعة يتكرر طرحها:</h2>
      
      <div class="space-y-3">
        <details class="group bg-slate-50 p-4 rounded-2xl border border-slate-200/80 cursor-pointer">
          <summary class="font-black text-slate-900 text-sm flex items-center justify-between">
            <span>واش نقدر نحل الكولية ونقلبها قبل ما نخلص؟</span>
            <span class="text-emerald-600 font-bold group-open:rotate-180 transition">▼</span>
          </summary>
          <p class="text-xs md:text-sm text-slate-600 mt-2.5 leading-relaxed font-medium">نعم بطبيعة الحال! كتفتح الكولية وتفحص المنتج وتتأكد من الجودة ديالو عاد كتسلم المبلغ للموزع (الدفع عند الاستلام بعد المعاينة الكاملة).</p>
        </details>

        <details class="group bg-slate-50 p-4 rounded-2xl border border-slate-200/80 cursor-pointer">
          <summary class="font-black text-slate-900 text-sm flex items-center justify-between">
            <span>شحال كياخد التوصيل من وقت؟</span>
            <span class="text-emerald-600 font-bold group-open:rotate-180 transition">▼</span>
          </summary>
          <p class="text-xs md:text-sm text-slate-600 mt-2.5 leading-relaxed font-medium">التوصيل سريع كياخد ما بين 24 إلى 48 ساعة فقط على حساب المدينة ديالك، ومجاني بدون أي مصاريف إضافية حتى لباب الدار.</p>
        </details>

        <details class="group bg-slate-50 p-4 rounded-2xl border border-slate-200/80 cursor-pointer">
          <summary class="font-black text-slate-900 text-sm flex items-center justify-between">
            <span>إلا لقيت فيه شي عيب أو ما عجبنيش كيفاش ندير؟</span>
            <span class="text-emerald-600 font-bold group-open:rotate-180 transition">▼</span>
          </summary>
          <p class="text-xs md:text-sm text-slate-600 mt-2.5 leading-relaxed font-medium">عندك ضمان استبدال مجاني لمدة 30 يوم. غير كتتواصل معانا فالواتساب كيتصل بيك الفريق وكنبدلو ليك المنتج أو كنرجعو ليك فلوسك بكل احترام وبلا تعقيدات.</p>
        </details>
      </div>
    </section>

  </main>

  <!-- 10. Sticky Mobile Floating Buy Bar -->
  <div class="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 px-4 flex items-center justify-between md:hidden z-40 shadow-2xl">
    <div>
      <span class="text-[11px] text-slate-500 font-bold block">السعر المخفض:</span>
      <span class="text-lg font-black text-emerald-700" id="sticky-price-display">${page.price} ${page.currency || "درهم"}</span>
    </div>
    <a href="#order-form" class="pulse-cta bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-2.5 px-6 rounded-xl shadow-md">
      أطلب الآن 🚚
    </a>
  </div>

  <!-- 11. Live Floating Social Proof Toast (FOMO) -->
  <div id="fomo-popup" class="fixed bottom-20 md:bottom-6 left-4 bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-3.5 max-w-xs z-40 hidden transition-all duration-500 transform translate-y-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold shrink-0">
        📦
      </div>
      <div>
        <p class="text-xs font-black text-slate-900" id="fomo-text">طلب زبون من الدار البيضاء 2 حبات للتو!</p>
        <span class="text-[10px] text-slate-400 font-bold" id="fomo-time">منذ دقيقتين · تم التأكيد عبر واتساب</span>
      </div>
    </div>
  </div>

  <!-- 12. Thank You Success Modal Popup -->
  <div id="success-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 text-center space-y-5 shadow-2xl border border-slate-100">
      <div class="w-16 h-16 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl font-black">✓</div>
      
      <div class="space-y-1">
        <h3 class="text-2xl font-black text-slate-900">تم تسجيل طلبك بنجاح! 🎉</h3>
        <p class="text-xs text-slate-500">شكراً على ثقتك بمتجرنا.</p>
      </div>

      <div class="bg-slate-50 p-4 rounded-2xl text-xs text-slate-700 border border-slate-200 text-right space-y-2">
        <p>👤 <strong>الاسم:</strong> <span id="modal-cust-name" class="font-bold"></span></p>
        <p>📦 <strong>رقم الطلبية:</strong> <span id="modal-order-number" class="font-mono font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded"></span></p>
        <p>🚚 <strong>الخطوة القادمة:</strong> سيتصل بك فريق العمل هاتفياً أو عبر واتساب لتأكيد موعد التسليم.</p>
      </div>

      <button onclick="window.location.reload()" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition">
        العودة للصفحة
      </button>
    </div>
  </div>

  <!-- JavaScript Interaction Logic -->
  <script>
    // Image Switcher
    function switchMainImage(src, btn) {
      document.getElementById('main-image').src = src;
      document.querySelectorAll('.thumb-btn').forEach(b => {
        b.classList.remove('border-emerald-600', 'ring-2', 'ring-emerald-500/20');
        b.classList.add('border-slate-200');
      });
      btn.classList.add('border-emerald-600', 'ring-2', 'ring-emerald-500/20');
      btn.classList.remove('border-slate-200');
    }

    // Countdown Timer
    function startTimer(duration) {
      let timer = duration;
      const display = document.getElementById('countdown-timer');
      setInterval(() => {
        const hours = String(Math.floor(timer / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((timer % 3600) / 60)).padStart(2, '0');
        const seconds = String(timer % 60).padStart(2, '0');
        display.textContent = hours + ':' + minutes + ':' + seconds;
        if (--timer < 0) timer = duration;
      }, 1000);
    }
    startTimer(4 * 3600 + 25 * 60 + 18);

    // Bundle Price Synchronizer
    function updateTotalOrderPrice() {
      const selected = document.querySelector('input[name="pack_qty"]:checked');
      if (selected) {
        const price = selected.getAttribute('data-price');
        const formatted = price + " ${page.currency || "درهم"}";
        document.getElementById('form-total-display').textContent = formatted;
        const stickyPrice = document.getElementById('sticky-price-display');
        if (stickyPrice) stickyPrice.textContent = formatted;

        // Visual selection card border
        document.querySelectorAll('.pack-option').forEach(card => {
          card.classList.remove('border-emerald-500', 'bg-emerald-50/60', 'shadow-sm');
          card.classList.add('border-slate-200', 'bg-slate-50/50');
        });
        const activeCard = selected.closest('.pack-option');
        if (activeCard) {
          activeCard.classList.remove('border-slate-200', 'bg-slate-50/50');
          activeCard.classList.add('border-emerald-500', 'bg-emerald-50/60', 'shadow-sm');
        }

        if (window.fbq) {
          fbq('track', 'InitiateCheckout', { value: parseFloat(price), currency: 'MAD' });
        }
      }
    }

    // Order Submission via API
    async function handleOrderSubmit(e) {
      e.preventDefault();
      const submitBtn = document.getElementById('order-submit-btn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>جاري تسجيل طلبك... ⏳</span>';

      const selectedPack = document.querySelector('input[name="pack_qty"]:checked');
      const qty = parseInt(selectedPack.value, 10);
      const totalPrice = parseFloat(selectedPack.getAttribute('data-price'));

      const payload = {
        pageId: "${page.id}",
        storeSlug: "${page.storeSlug}",
        productSlug: "${page.productSlug}",
        customerName: document.getElementById('form_name').value.trim(),
        customerPhone: document.getElementById('form_phone').value.trim(),
        customerCity: document.getElementById('form_city').value,
        customerAddress: document.getElementById('form_address').value.trim(),
        quantity: qty,
        totalPrice: totalPrice,
      };

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          if (window.fbq) {
            fbq('track', 'Purchase', { 
              value: totalPrice, 
              currency: 'MAD', 
              content_name: "${escapeHtml(page.title)}" 
            });
          }
          document.getElementById('modal-cust-name').textContent = payload.customerName;
          document.getElementById('modal-order-number').textContent = data.orderNumber || "#ONF-OK";
          document.getElementById('success-modal').classList.remove('hidden');
        } else {
          alert(data.error || 'وقع خطأ، يرجى المحاولة مرة أخرى.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>أكّد طلبك الآن 🚚 (الدفع عند الاستلام)</span>';
        }
      } catch (err) {
        alert('خطأ في الاتصال، يرجى التحقق من الإنترنت.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>أكّد طلبك الآن 🚚 (الدفع عند الاستلام)</span>';
      }
    }

    // Social Proof Toast Notification
    const moroccanBuyers = [
      { name: "سفيان", city: "الدار البيضاء", pack: "2 حبات (الأكثر طلباً)" },
      { name: "مريم", city: "الرباط", pack: "قطعة واحدة" },
      { name: "كريم", city: "مراكش", pack: "3 قطع (عرض التوفير)" },
      { name: "ياسين", city: "طنجة", pack: "2 حبات" },
      { name: "فاطمة", city: "أكادير", pack: "قطعة واحدة" },
      { name: "حمزة", city: "فاس", pack: "2 حبات" },
    ];
    let buyerIndex = 0;
    function showBuyerToast() {
      const toast = document.getElementById('fomo-popup');
      if (!toast) return;
      const b = moroccanBuyers[buyerIndex % moroccanBuyers.length];
      document.getElementById('fomo-text').textContent = 'طلب ' + b.name + ' من ' + b.city + ' (' + b.pack + ') للتو!';
      document.getElementById('fomo-time').textContent = 'منذ ' + (Math.floor(Math.random() * 3) + 1) + ' دقائق · تم التأكيد';
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.remove('translate-y-4'), 20);
      setTimeout(() => {
        toast.classList.add('translate-y-4');
        setTimeout(() => toast.classList.add('hidden'), 500);
      }, 4500);
      buyerIndex++;
    }
    setInterval(showBuyerToast, 11000);
    setTimeout(showBuyerToast, 3500);
  </script>
</body>
</html>`;
}

function escapeHtml(text?: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
