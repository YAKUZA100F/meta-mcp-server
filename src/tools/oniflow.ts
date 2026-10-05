import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ClientLicense,
  createLandingPageAsync,
  listLandingPagesByClientAsync,
  listOrdersByClientAsync,
  slugify,
} from "../services/db.js";

function getBaseUrl(): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return "https://mcp.oniflow.space";
  const port = process.env.PORT || "2222";
  return `http://localhost:${port}`;
}

export function registerOniflowTools(server: McpServer, license: ClientLicense): void {
  const baseUrl = getBaseUrl();
  const crmUrl = `${baseUrl}/crm/${license.crmToken || "secret"}`;
  const storeSlug = slugify(license.storeSlug || license.clientName || "store");

  // ─── 1. ONIFLOW INTERACTIVE 5-IN-1 MENU ──────────────────────────────────
  server.registerTool(
    "oniflow_menu",
    {
      title: "Oniflow E-Com Suite 5-in-1 Menu",
      description: `يعرض القائمة الرئيسية التفاعلية لمنصة Oniflow للتجارة الإلكترونية والدفع عند الاستلام بالمغرب.
استخدم هذه الأداة عندما يطلب العميل القائمة أو يكتب /oniflow أو يسأل عن الخدمات المتوفرة.`,
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const menuMarkdown = `
# 🚀 مرحباً بك في **Oniflow E-Commerce AI Suite** 🇲🇦

منصتك الشاملة المتكاملة لتطوير وتوسيع مشروع التجارة الإلكترونية (COD) في المغرب:

---

### 🌟 اختر الخدمة التي تريد البدء بها:

1. **📄 مولد صفحات الهبوط السريعة (5-Minute Landing Page):**
   * صفحة احترافية سريعة بنظام الدفع عند الاستلام (COD) بالدارجة/العربية.
   * استمارة طلب فورية بدون تشتيت، عروض الباقات (Packs)، وربط مباشر مع Meta Pixel.
   * *للطلب قل لي:* **"صاوب ليا صفحة هبوط لمنتج [اسم المنتج] بثمن [الثمن]"**.

2. **📦 إدارة وتأكيد الطلبيات (Mobile CRM & WhatsApp):**
   * لوحة تحكم فورية وسرية لمتابعة الطلبات، الإحصائيات، ومداخيل البيع.
   * زر سحري لتأكيد الطلبيات عبر واتساب بنقرة واحدة برسالة دارجة مجهزة.
   * **رابط الـ CRM السري الخاص بك:**
     👉 [فتح لوحة الـ CRM المباشرة](${crmUrl})
   * *أو اسألني هنا في الشات:* **"شنو هوما الطلبيات الجداد لي جاو اليوم؟"**.

3. **🎨 استوديو الإعلانات الذكي (Anti-AI-Slop Creative Studio):**
   * توليد برومبتات صور منتجات فائقة الواقعية بدون مظهر الذكاء الاصطناعي البلاستيكي.
   * كتابة 3 هوكات إعلانية قوية بالدارجة المغربية مجربة لزيادة نسبة النقر (CTR).
   * *للطلب قل لي:* **"عطيني تصاميم وهوكات إعلانية لمنتج [اسم المنتج]"**.

4. **🕵️‍♂️ التجسس على المنافسين والمنتجات الرابحة (Ad Spy & Winning Products):**
   * روابط مباشرة للتجسس على إعلانات المنافسين النشطة بالمغرب في Facebook Ad Library وTikTok.
   * معايير فحص المنتجات الرابحة لمعرفة الحملات الرابحة التي تصرف ميزانيات ضخمة.
   * *للطلب قل لي:* **"تجسس ليا على إعلانات [اسم المنتج/النيتش]"**.

5. **📊 إدارة حملات فيسبوك وإنستغرام (Meta Ads Manager):**
   * تحليل الحساب الإعلاني، إطلاق حملات جديدة، وتعديل الميزانيات بأمان تام.
   * *للطلب قل لي:* **"حلل ليا أداء الحملات هاد السيمانة"**.

---
💡 *بإمكانك كتابة رقم الخدمة (1 أو 2 أو 3 أو 4 أو 5) أو طلب ما تريده مباشرة بالدارجة أو الفرنسية أو العربية!*
`;
      return {
        content: [{ type: "text", text: menuMarkdown.trim() }],
      };
    }
  );

  // ─── 2. CREATE LANDING PAGE ──────────────────────────────────────────────
  server.registerTool(
    "landing_create_page",
    {
      title: "Create COD Landing Page",
      description: `ينشئ صفحة هبوط احترافية ومخصصة للدفع عند الاستلام (COD) بالمغرب في ثوانٍ معدودة.
تتضمن الصفحة: صور المنتج، المميزات، عداد العرض التنازلي، عروض الباقات، استمارة الطلب السريعة، وMeta Pixel.`,
      inputSchema: z
        .object({
          productSlug: z.string().describe("معرّف المنتج في الرابط بالإنجليزية (مثال: smartwatch-ultra أو pack-argan)"),
          title: z.string().describe("عنوان المنتج الجذاب بالعربية أو الدارجة"),
          price: z.number().positive().describe("سعر البيع بالدرهم المغربي (MAD)"),
          compareAtPrice: z.number().positive().optional().describe("السعر القديم المشطوب لإظهار نسبة التخفيض"),
          description: z.string().optional().describe("وصف تفصيلي للمنتج ونقاط القوة والفوائد للزبون"),
          features: z.array(z.string()).optional().describe("قائمة بأهم مميزات المنتج (مثال: ['توصيل فابور فـ 24 ساعة', 'ضمانة 12 شهر'])"),
          images: z.array(z.string()).optional().describe("روابط صور المنتج (URLs). إذا لم تتوفر سيتم استخدام صور تجريبية عالية الجودة"),
          pixelId: z.string().optional().describe("معرف بيكسل فيسبوك (Meta Pixel ID) لتتبع الأحداث تلقائياً (PageView, InitiateCheckout, Purchase)"),
          whatsappNumber: z.string().optional().describe("رقم واتساب المتجر للطلب السريع والدعم (مثال: 0612345678)"),
          themeColor: z.string().optional().describe("اللون الأساسي للصفحة بهيكس كود (افتراضي: #16a34a أخضر الزمرد)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      productSlug,
      title,
      price,
      compareAtPrice,
      description,
      features,
      images,
      pixelId,
      whatsappNumber,
      themeColor,
    }) => {
      try {
        const normProductSlug = slugify(productSlug);
        const page = await createLandingPageAsync({
          clientId: license.id,
          storeSlug,
          productSlug: normProductSlug,
          title,
          price,
          compareAtPrice: compareAtPrice || Math.round(price * 1.5),
          currency: "MAD",
          description: description || "",
          features: features && features.length > 0 ? features : [
            "🚚 توصيل سريع بالمجان حتى لباب الدار في جميع مدن المغرب",
            "💵 الدفع نقدًا عند الاستلام بعد معاينة المنتج والتأكد منه",
            "🛡️ ضمانة استبدال لمدة 30 يومًا في حالة أي عيب مصنعي",
            "⭐ جودة أصلية ممتازة مع خدمة زبناء متوفرة على مدار الساعة"
          ],
          images: images && images.length > 0 ? images : [
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80"
          ],
          pixelId: pixelId || (license.adAccountId ? "" : undefined),
          whatsappNumber: whatsappNumber || "",
          themeColor: themeColor || "#16a34a",
        });

        const liveUrl = `${baseUrl}/${page.storeSlug}/${page.productSlug}`;

        const responseText = `
🎉 **تم إنشاء صفحة الهبوط بنجاح في أقل من دقيقة!**

---

### 🔗 روابط المعاينة والعمل:
* **رابط صفحة الهبوط لايف:**
  👉 **[${liveUrl}](${liveUrl})**
* **رابط لوحة تتبع الطلبات (CRM):**
  👉 **[${crmUrl}](${crmUrl})**

---

### 📋 تفاصيل الصفحة:
* **المنتج:** ${page.title}
* **السعر:** ${page.price} درهم *(السعر المشطوب: ${page.compareAtPrice} درهم)*
* **الرابط:** \`/${page.storeSlug}/${page.productSlug}\`
* **Meta Pixel:** ${page.pixelId ? `مفعّل برقم (\`${page.pixelId}\`)` : "غير محدد (يمكنك إضافته لاحقاً لتتبع المبيعات)"}
* **الدفع:** الدفع عند الاستلام (COD) مع استمارة سريعة بنقرة واحدة.

💡 *تقدر تفتح الرابط دابا باش تشوف الصفحة وتجرب دوز كوموند تجريبية، وغادي تشوفها فوراً فـ لوحة الـ CRM!*
`;
        return {
          content: [{ type: "text", text: responseText.trim() }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `❌ فشل إنشاء صفحة الهبوط: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ─── 3. LIST CLIENT LANDING PAGES ─────────────────────────────────────────
  server.registerTool(
    "landing_list_pages",
    {
      title: "List Client Landing Pages",
      description: "يعرض جميع صفحات الهبوط التي تم إنشاؤها لهذا المتجر مع روابطها وأسعارها.",
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const pages = await listLandingPagesByClientAsync(license.id);
        if (!pages.length) {
          return {
            content: [
              {
                type: "text",
                text: `ما زال ما صاوبتي حتى صفحة هبوط لحد الآن. يمكنك إنشاء أول صفحة دابا بكتابة: "صاوب ليا صفحة هبوط لـ [اسم المنتج]".`,
              },
            ],
          };
        }

        const lines = [
          `# 📄 صفحات الهبوط الخاصة بمتجرك (${pages.length})`,
          "",
          `🔗 **لوحة إدارة الطلبيات (CRM):** [فتح لوحة الـ CRM](${crmUrl})`,
          "",
          "| المنتج | السعر | الرابط لايف | تاريخ الإنشاء |",
          "| :--- | :--- | :--- | :--- |",
        ];

        for (const p of pages) {
          const url = `${baseUrl}/${p.storeSlug}/${p.productSlug}`;
          lines.push(`| **${p.title}** | ${p.price} MAD | [فتح الصفحة](${url}) | ${p.createdAt.slice(0, 10)} |`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `❌ فشل جلب صفحات الهبوط: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ─── 4. ORDERS & CRM IN CHAT ──────────────────────────────────────────────
  server.registerTool(
    "orders_list",
    {
      title: "List Recent Orders (Chat CRM)",
      description: `يعرض آخر الطلبيات الواردة من صفحات الهبوط مع حالة كل طلب، معلومات الزبون، ورابط مباشر لتأكيد الطلب عبر واتساب.`,
      inputSchema: z
        .object({
          status: z
            .enum(["all", "new", "confirmed", "shipped", "delivered", "cancelled"])
            .optional()
            .describe("فلترة الطلبيات حسب الحالة (افتراضي: الكل)"),
          limit: z.number().int().positive().optional().describe("عدد الطلبيات المراد إظهارها (افتراضي: 15)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ status = "all", limit = 15 }) => {
      try {
        const allOrders = await listOrdersByClientAsync(license.id);
        const filtered = status === "all" ? allOrders : allOrders.filter((o) => o.status === status);
        const displayed = filtered.slice(0, limit);

        const totalRevenue = allOrders
          .filter((o) => o.status !== "cancelled")
          .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
        const newCount = allOrders.filter((o) => o.status === "new").length;
        const confirmedCount = allOrders.filter((o) => o.status === "confirmed").length;

        const header = `
# 📦 إدارة الطلبيات الواردة (${allOrders.length} طلبية إجمالاً)

* **💰 إجمالي المبيعات المؤكدة/النشطة:** \`${totalRevenue} MAD\`
* **🆕 طلبات جديدة تنتظر التأكيد:** \`${newCount}\`
* **✅ طلبات مؤكدة:** \`${confirmedCount}\`
* **📱 رابط لوحة الـ CRM الكاملة:** [فتح الـ CRM المباشر](${crmUrl})

---
`;

        if (!displayed.length) {
          return {
            content: [
              {
                type: "text",
                text: `${header}\nلا توجد أي طلبيات مطابقة للفلتر (\`${status}\`).`,
              },
            ],
          };
        }

        const lines = [header, "### 📋 قائمة آخر الطلبات:"];

        for (const ord of displayed) {
          const rawPhone = ord.customerPhone.replace(/\D/g, "");
          const waPhone = rawPhone.startsWith("0") ? `212${rawPhone.slice(1)}` : rawPhone;
          const waMsg = encodeURIComponent(
            `السلام عليكم أخي/أختي ${ord.customerName}، معاك خدمة الزبناء بخصوص طلبيتك رقم ${ord.orderNumber} بمبلغ ${ord.totalPrice} درهم. بغينا نأكدوا معاك عنوان التوصيل فمدينة ${ord.customerCity} باش نصيفطوها ليك؟`
          );
          const waLink = `https://wa.me/${waPhone}?text=${waMsg}`;

          const statusBadge =
            ord.status === "new"
              ? "🆕 جديد"
              : ord.status === "confirmed"
              ? "✅ مؤكد"
              : ord.status === "shipped"
              ? "🚚 قيد الشحن"
              : ord.status === "delivered"
              ? "🎉 تم التوصيل"
              : "❌ ملغى";

          lines.push(`
* **الطلبية: \`${ord.orderNumber}\`** | الحالة: **${statusBadge}**
  * **الزبون:** ${ord.customerName} | **المدينة:** ${ord.customerCity}
  * **الهاتف:** \`${ord.customerPhone}\`
  * **المبلغ:** \`${ord.totalPrice} MAD\` (الكمية: ${ord.quantity})
  * **التاريخ:** ${ord.createdAt.slice(0, 16).replace("T", " ")}
  * 👉 **[💬 تأكيد الطلب فـ WhatsApp بنقرة واحدة](${waLink})**
`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `❌ فشل جلب الطلبيات: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ─── 5. ANTI-AI-SLOP CREATIVE STUDIO ─────────────────────────────────────
  server.registerTool(
    "creative_studio_prompt",
    {
      title: "Anti-AI-Slop Creative Studio",
      description: `يولد برومبتات صور احترافية واقعية للغاية مخصصة لأداة generate_image بدون المظهر البلاستيكي الرديء (Anti-AI-Slop)،
بالإضافة إلى 3 هوكات إعلانية جذابة ومجربة بالدارجة المغربية لزيادة المبيعات.`,
      inputSchema: z
        .object({
          productName: z.string().describe("اسم المنتج (مثال: سيروم زيت الأركان للشعر، أو ماكينة حلاقة احترافية)"),
          productDescription: z.string().describe("وصف للمنتج، فوائده، ومميزاته الرئيسية"),
          style: z
            .enum(["commercial_studio", "moroccan_lifestyle", "problem_solution", "luxury_minimalist"])
            .optional()
            .describe("الستايل المطلوب للصورة (افتراضي: commercial_studio)"),
          targetAudience: z.string().optional().describe("الجمهور المستهدف بالمغرب (مثال: رجال 20-45 سنة، نساء مهتمات بالتجميل)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ productName, productDescription, style = "commercial_studio", targetAudience }) => {
      const audienceStr = targetAudience || "Moroccan consumers, cash on delivery buyers";

      const prompt1 = `Commercial high-end studio product photograph of ${productName}. ${productDescription}. Single hero shot centered on an organic matte concrete pedestal. Crisp natural directional window lighting from the left, subtle soft fill light on the right, realistic surface textures, micro-droplets or fine dust particles where appropriate, shallow depth of field (f/2.8, 85mm lens), neutral contemporary aesthetic, authentic commercial advertising quality. Strictly no plastic shine, no exaggerated glow, no oversaturated neon, photorealistic Hasselblad commercial capture.`;

      const prompt2 = `Authentic authentic lifestyle scene in a contemporary Moroccan home setting featuring ${productName}. Natural warm daylight entering through a modern arched window with subtle Moroccan zellij mosaic accents in the soft-focus background. A Moroccan person's hands holding or using the product naturally. Authentic skin texture with natural pores and realistic reflections, documentary candid style, clean high-converting e-commerce lifestyle photography, 35mm lens, 8k resolution.`;

      const prompt3 = `Dynamic visual problem-solving comparison product visual for ${productName}. Split composition: on one side the common frustrating problem, on the other side the crisp premium ${productName} delivering an effortless flawless result. Clean modern minimal background, editorial lighting, commercial banner layout, sharp focus on product details, professional advertising finish.`;

      const hook1 = `عيتي ما تجرب فالمنتجات العادية وبدون نتيجة؟ 🤦‍♂️ هاد ${productName} هو الحل لي كيهدر عليه كاع الناس فالمغرب!`;
      const hook2 = `أكثر من 2,500 زبون فالمغرب جربوه وشكروا النتيجة ⭐⭐⭐⭐⭐! ${productName} بجودة أصلية وتوصيل حتى لباب الدار.`;
      const hook3 = `⚠️ عرض خاص لفترة محدودة: تخفيض استثنائي + توصيل فابور فجميع مدن المغرب 🚚! وخلي حتى تقلب عاد تخلص 💵.`;

      const output = `
# 🎨 استوديو التصاميم الذكي لمنتج: **${productName}**

---

### 📸 برومبتات توليد الصور الواقعية (Anti-AI-Slop):
*هذه البرومبتات مصممة هندسياً لتعطيك صور إعلانية واقعية 100% بدون المظهر البلاستيكي أو أخطاء الذكاء الاصطناعي:*

#### 1️⃣ برومبت ستوديو تجاري فخم (Commercial Hero Studio):
\`\`\`text
${prompt1}
\`\`\`

#### 2️⃣ برومبت واقعي مغربي لايف ستايل (Authentic Moroccan Lifestyle):
\`\`\`text
${prompt2}
\`\`\`

#### 3️⃣ برومبت المشكلة والحل (Problem & Solution Visual):
\`\`\`text
${prompt3}
\`\`\`

> 💡 **كيفية التوليد المباشر:**
> يمكنك الآن أن تقول لي في الشات مباشرة:
> **"ولد ليا صورة بالبرومبت رقم 1"** وسأقوم باستدعاء أداة \`generate_image\` لتوليدها فوراً وحفظها في مجلد الإعلانات!

---

### ✍️ هوكات ونصوص إعلانية بالدارجة المغربية (High-Converting Copy):

* **هوك المشكلة والألم (Problem Agitation):**
  > "${hook1}"

* **هوك الدليل الاجتماعي والمصداقية (Social Proof):**
  > "${hook2}"

* **هوك العرض والندرة (Urgency & COD Offer):**
  > "${hook3}"

🎯 **نداء اتخاذ إجراء (CTA):**
> "دوز الطلب ديالك دابا قبل ما يسالي الستوك، والتوصيل راه فابور والدفع عند الاستلام بعد المعاينة!"
`;

      return {
        content: [{ type: "text", text: output.trim() }],
      };
    }
  );

  // ─── 6. COMPETITOR AD SPY & WINNING PRODUCTS ──────────────────────────────
  server.registerTool(
    "competitor_spy_search",
    {
      title: "Competitor Ad Spy & Winning Products Search",
      description: `يقوم بالبحث عن إعلانات المنافسين النشطة بالمغرب في Facebook Ad Library وTikTok Creative Center،
ويكشف معايير المنتجات الرابحة وحجم الإنفاق الإعلاني عليها.`,
      inputSchema: z
        .object({
          keyword: z.string().describe("الكلمة المفتاحية للبحث (مثال: 'ساعة', 'زيت', 'smartwatch', 'مشد')"),
          country: z.string().optional().describe("رمز الدولة (افتراضي: MA للمغرب)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ keyword, country = "MA" }) => {
      const fbSearchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${encodeURIComponent(
        keyword
      )}&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped`;

      const tiktokSearchUrl = `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?countryCode=${country}`;

      const report = `
# 🕵️‍♂️ التجسس على إعلانات المنافسين لكلمة: **"${keyword}"** 🇲🇦

---

### 🔗 روابط التجسس المباشرة:
1. **🔍 مكتبة إعلانات فيسبوك (Facebook Ad Library - Morocco):**
   👉 **[تصفح الإعلانات النشطة بالمغرب حالياً](${fbSearchUrl})**
   *اضغط على الرابط أعلاه لرؤية جميع إعلانات المنافسين التي تصرف ميزانيات الآن في المغرب.*

2. **📱 منصة تيك توك للملهمات الإعلانية (TikTok Creative Center - Morocco):**
   👉 **[تصفح إعلانات تيك توك الرابحة بالمغرب](${tiktokSearchUrl})**

---

### 🏆 معايير تمييز المنتج الرابح (Winning Product Checklist):
1. **⏳ مدة بقاء الإعلان شغال (Ad Longevity):**
   * إذا لقيتي إعلان شغال لأكثر من **14 إلى 20 يوم** متواصلة، فهذا تأكيد بنسبة 95% أن المنتج رابح ويحقق أرباحاً للمعلن (ما كاينش لي كيخسر فلوسو فالفايسبوك فابور).
2. **📈 تكرار الإعلانات (Creative Scaling):**
   * إذا شفتي نفس الصفحة مخرجة 5 إلى 10 نسخ مختلفة من نفس المنتج (زوائد مختلفة، فيديوهات وصور متعددة)، فهاد المعلن كيدير Scaling (تضخيم الحملة).
3. **💬 تعليقات الزبائن (Buyer Intent):**
   * شوف التعليقات: واش الناس كيسولو على "بشحال" و"كيفاش نطلب" و"واش كاين فكازا/مراكش"؟ هذا مؤشر قوي على وجود طلب مرتفع (High Demand).
4. **💰 هامش الربح في الدفع عند الاستلام (COD Margin Formula):**
   * تأكد أن سعر البيع لا يقل عن:
     $$\\text{سعر البيع} \\ge (\\text{سعر الجملة} \\times 3) + 40 \\text{ DH التوصيل} + 35 \\text{ DH تكلفة الإعلان}$$
   * مثال: شريتيه بـ 50 درهم ➔ بيعو بـ 220 درهم على الأقل باش تشيط ليك أرباح نقية بعد مصاريف التوصيل والإعلانات ونسبة الـ Confirmation.
`;

      return {
        content: [{ type: "text", text: report.trim() }],
      };
    }
  );
}
