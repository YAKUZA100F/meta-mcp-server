import { ClientLicense, LandingOrder } from "../services/db.js";

export function renderCrmPage(license: ClientLicense, orders: LandingOrder[], crmToken: string): string {
  const storeName = license.clientName || "متجري";

  // Compute stats
  const totalOrders = orders.length;
  const newOrders = orders.filter((o) => o.status === "new").length;
  const confirmedOrders = orders.filter((o) => o.status === "confirmed").length;
  const shippedOrders = orders.filter((o) => o.status === "shipped").length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
  const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;

  const confirmRate = totalOrders > 0 ? Math.round((confirmedOrders / totalOrders) * 100) : 100;
  const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>أرقام التأكيد ديالي | ${escapeHtml(storeName)}</title>
  
  <!-- Tailwind CSS & Google Fonts -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  
  <style>
    body { font-family: 'Cairo', sans-serif; background-color: #f8fafc; }
    .table-container {
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 #f1f5f9;
    }
    .table-container::-webkit-scrollbar {
      height: 6px;
    }
    .table-container::-webkit-scrollbar-thumb {
      background-color: #cbd5e1;
      border-radius: 9999px;
    }
  </style>
</head>
<body class="text-slate-800 min-h-screen">

  <!-- Top Navbar -->
  <header class="bg-white border-b border-slate-200 px-4 md:px-8 py-3 sticky top-0 z-30 shadow-sm">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-lg font-black shadow-sm">
          📦
        </div>
        <div>
          <h1 class="text-base font-black text-slate-900 flex items-center gap-2">
            ${escapeHtml(storeName)}
            <span class="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">OniFlow CRM لايف</span>
          </h1>
          <p class="text-[11px] text-slate-500">نظام إدارة وتأكيد طلبيات الدفع عند الاستلام</p>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <button onclick="exportCsv()" class="bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 flex items-center gap-1.5 transition shadow-sm">
          <span>📥 تصدير Excel</span>
        </button>
        <button onclick="window.location.reload()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5">
          <span>🔄 تحديث</span>
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-5">

    <!-- 1. Top Performance Metrics Bar (Matching Uploaded Screenshot) -->
    <div class="bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-sm space-y-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h2 class="text-sm md:text-base font-black text-slate-900 flex items-center gap-2">
          <span>أرقام التأكيد ديالي</span>
          <span class="text-xs font-semibold text-slate-500">· آخر 7 أيام · مقارنة مع الأسبوع اللي قبل</span>
        </h2>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-100 text-center">
        
        <!-- Metric 1: Processing time & Today's orders -->
        <div class="pt-2 md:pt-0 pr-0 md:pr-4 text-right">
          <div class="text-[11px] font-semibold text-slate-500 mb-1">اليوم</div>
          <div class="text-sm font-black text-slate-900 flex items-center gap-2">
            <span>10 min</span>
            <span class="text-xs font-bold text-slate-600">· ${totalOrders} معالجة · 0 باقية</span>
          </div>
          <div class="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div class="bg-emerald-500 h-1.5 rounded-full" style="width: 100%"></div>
          </div>
        </div>

        <!-- Metric 2: Average Confirmation Time -->
        <div class="pt-2 md:pt-0 text-center">
          <div class="text-[11px] font-semibold text-slate-500 mb-1">متوسط وقت التأكيد</div>
          <div class="text-base font-black text-slate-900">10 min</div>
        </div>

        <!-- Metric 3: Total Revenue Collected -->
        <div class="pt-2 md:pt-0 text-center">
          <div class="text-[11px] font-semibold text-slate-500 mb-1">المحصل (المجموع)</div>
          <div class="text-base font-black text-slate-900">${totalRevenue.toLocaleString()} DH</div>
          <span class="text-[10px] text-slate-400">-</span>
        </div>

        <!-- Metric 4: Delivery Rate -->
        <div class="pt-2 md:pt-0 text-center">
          <div class="text-[11px] font-semibold text-slate-500 mb-1">نسبة التسليم</div>
          <div class="text-base font-black text-slate-900">${deliveryRate}%</div>
          <div class="text-[10px] text-slate-400">${deliveredOrders}/${totalOrders} تصيفطو</div>
        </div>

        <!-- Metric 5: Confirmation Rate -->
        <div class="pt-2 md:pt-0 text-center">
          <div class="text-[11px] font-semibold text-slate-500 mb-1">نسبة التأكيد</div>
          <div class="text-base font-black text-emerald-600">${confirmRate}%</div>
          <div class="text-[10px] text-slate-400">${confirmedOrders}/${totalOrders} توصلنا بهم</div>
        </div>

      </div>
    </div>

    <!-- 2. Five Status Cards (Exact 5-Box Grid from Screenshot) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      
      <!-- Card 1: للتأكيد -->
      <div onclick="filterStatus('new')" class="status-card cursor-pointer bg-white border border-slate-200 rounded-xl p-3.5 hover:border-emerald-500 transition shadow-sm text-center">
        <div class="text-2xl md:text-3xl font-black text-slate-900 mb-1">${newOrders}</div>
        <div class="text-xs font-bold text-slate-700">للتأكيد</div>
        <div class="text-[10px] text-slate-400 mt-0.5">للمعالجة</div>
      </div>

      <!-- Card 2: مؤكدة، للإرسال -->
      <div onclick="filterStatus('confirmed')" class="status-card cursor-pointer bg-white border border-slate-200 rounded-xl p-3.5 hover:border-emerald-500 transition shadow-sm text-center">
        <div class="text-2xl md:text-3xl font-black text-slate-900 mb-1">${confirmedOrders}</div>
        <div class="text-xs font-bold text-slate-700">مؤكدة، للإرسال</div>
        <div class="text-[10px] text-emerald-600 font-semibold mt-0.5">جاهزة</div>
      </div>

      <!-- Card 3: عند شركة التوصيل -->
      <div onclick="filterStatus('shipped')" class="status-card cursor-pointer bg-white border border-slate-200 rounded-xl p-3.5 hover:border-emerald-500 transition shadow-sm text-center">
        <div class="text-2xl md:text-3xl font-black text-slate-900 mb-1">${shippedOrders}</div>
        <div class="text-xs font-bold text-slate-700">عند شركة التوصيل</div>
        <div class="text-[10px] text-slate-400 mt-0.5">قيد التوصيل</div>
      </div>

      <!-- Card 4: المسلّمة -->
      <div onclick="filterStatus('delivered')" class="status-card cursor-pointer bg-white border border-slate-200 rounded-xl p-3.5 hover:border-emerald-500 transition shadow-sm text-center">
        <div class="text-2xl md:text-3xl font-black text-slate-900 mb-1">${deliveredOrders}</div>
        <div class="text-xs font-bold text-slate-700">المسلّمة</div>
        <div class="text-[10px] text-slate-400 mt-0.5">تم الاستلام 💵</div>
      </div>

      <!-- Card 5: ملغاة / مرتجعات -->
      <div onclick="filterStatus('cancelled')" class="status-card cursor-pointer bg-white border border-slate-200 rounded-xl p-3.5 hover:border-emerald-500 transition shadow-sm text-center">
        <div class="text-2xl md:text-3xl font-black text-slate-900 mb-1">${cancelledOrders}</div>
        <div class="text-xs font-bold text-slate-700">ملغاة / مرتجعات</div>
        <div class="text-[10px] text-rose-500 mt-0.5">ملغاة</div>
      </div>

    </div>

    <!-- 3. Search & Filters Bar (Matching Screenshot Dropdowns) -->
    <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
      
      <!-- Right: Search Input -->
      <div class="w-full md:w-80">
        <div class="relative">
          <input 
            type="text" 
            id="search-input" 
            onkeyup="searchOrders()" 
            placeholder="ابحث عن زبون، هاتف، رمز طرد، منتج..." 
            class="w-full bg-slate-50 border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          >
          <div class="absolute right-3 top-2.5 text-slate-400 text-xs">🔍</div>
        </div>
      </div>

      <!-- Left: Filter Dropdowns -->
      <div class="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs font-medium">
        
        <select id="filter-confirmation" onchange="applyFilters()" class="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500">
          <option value="all">كل التأكيدات</option>
          <option value="new">للتأكيد (جديد)</option>
          <option value="confirmed">مؤكدة، للإرسال</option>
          <option value="shipped">قيد التوصيل</option>
          <option value="delivered">مسلّمة</option>
          <option value="cancelled">ملغاة</option>
        </select>

        <select id="filter-city" onchange="applyFilters()" class="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500">
          <option value="all">كل المدن</option>
          <option value="Casablanca">الدار البيضاء</option>
          <option value="Rabat">الرباط</option>
          <option value="Marrakech">مراكش</option>
          <option value="Fes">فاس</option>
          <option value="Tangier">طنجة</option>
          <option value="Agadir">أكادير</option>
        </select>

        <button onclick="filterStatus('all')" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition">
          إعادة التعيين ↺
        </button>
      </div>

    </div>

    <!-- 4. Orders Table (Exact UI Layout from Uploaded Image) -->
    <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div class="table-container overflow-x-auto">
        <table class="w-full text-right border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <th class="py-3 px-3 text-center w-10">
                <input type="checkbox" id="select-all" onclick="toggleSelectAll()" class="rounded text-emerald-600 focus:ring-0">
              </th>
              <th class="py-3 px-3 min-w-[100px]">التاريخ</th>
              <th class="py-3 px-3 min-w-[200px]">الزبون</th>
              <th class="py-3 px-3 min-w-[120px]">المدينة</th>
              <th class="py-3 px-3 min-w-[160px]">المنتج</th>
              <th class="py-3 px-3 min-w-[90px]">المبلغ</th>
              <th class="py-3 px-3 min-w-[180px]">التأكيد</th>
              <th class="py-3 px-3 min-w-[120px]">التوصيل</th>
            </tr>
          </thead>
          <tbody id="orders-table-body" class="divide-y divide-slate-100 text-slate-700">
            ${
              orders.length === 0
                ? `
                <tr>
                  <td colspan="8" class="py-12 text-center text-slate-400 space-y-2">
                    <div class="text-4xl">📭</div>
                    <div class="text-sm font-bold text-slate-600">لا توجد أي طلبيات مسجلة حتى الآن</div>
                    <div class="text-xs text-slate-400">بمجرد قيام أي زبون بالطلب من صفحات الهبوط، ستظهر هنا فوراً مع زر واتساب السريع!</div>
                  </td>
                </tr>
              `
                : orders.map((o) => renderTableRow(o, storeName, crmToken)).join("")
            }
          </tbody>
        </table>
      </div>

      <!-- Table Footer / Pagination (Matching Screenshot) -->
      <div class="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600">
        <div class="flex items-center gap-2">
          <button class="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 font-medium">السابق</button>
          <button class="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 font-medium">التالي</button>
        </div>
        <div class="font-semibold text-slate-500">
          صفحة 1/1 (${totalOrders} طلبية مسجلة)
        </div>
      </div>
    </div>

  </main>

  <script>
    const CRM_TOKEN = "${crmToken}";

    function filterStatus(status) {
      const select = document.getElementById('filter-confirmation');
      if (select) select.value = status;
      applyFilters();
    }

    function applyFilters() {
      const statusFilter = document.getElementById('filter-confirmation').value;
      const cityFilter = document.getElementById('filter-city').value;
      const query = document.getElementById('search-input').value.toLowerCase().trim();

      const rows = document.querySelectorAll('.order-row');
      rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status');
        const rowCity = row.getAttribute('data-city') || '';
        const rowText = row.textContent.toLowerCase();

        const matchStatus = statusFilter === 'all' || rowStatus === statusFilter;
        const matchCity = cityFilter === 'all' || rowCity.toLowerCase().includes(cityFilter.toLowerCase());
        const matchSearch = !query || rowText.includes(query);

        if (matchStatus && matchCity && matchSearch) {
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    }

    function searchOrders() {
      applyFilters();
    }

    async function updateOrderStatus(orderId, newStatus) {
      try {
        const res = await fetch('/api/crm/' + CRM_TOKEN + '/orders/' + orderId + '/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.success) {
          const row = document.getElementById('order-row-' + orderId);
          if (row) {
            row.setAttribute('data-status', newStatus);
            row.classList.add('bg-emerald-50');
            setTimeout(() => row.classList.remove('bg-emerald-50'), 1500);
          }
        } else {
          alert(data.error || 'فشل تحديث الحالة');
        }
      } catch (err) {
        alert('خطأ في الاتصال بالسيرفر');
      }
    }

    function exportCsv() {
      window.location.href = '/api/crm/' + CRM_TOKEN + '/export';
    }

    function toggleSelectAll() {
      const selectAll = document.getElementById('select-all');
      document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = selectAll.checked;
      });
    }
  </script>
</body>
</html>`;
}

function renderTableRow(order: LandingOrder, storeName: string, crmToken: string): string {
  // Normalize Moroccan phone (06XXXXXXXX -> 2126XXXXXXXX)
  let cleanPhone = (order.customerPhone || "").replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "212" + cleanPhone.substring(1);
  } else if (!cleanPhone.startsWith("212") && cleanPhone.length === 9) {
    cleanPhone = "212" + cleanPhone;
  }

  const defaultWaMsg = `السلام عليكم أخي/أختي ${order.customerName}، معاك خدمة الزبناء ديال متجر ${storeName} بخصوص طلبيتك رقم ${order.orderNumber} بمبلغ ${order.totalPrice} درهم. بغينا نأكدوا معاك عنوان التوصيل فمدينة ${order.customerCity} باش نصيفطوها ليك؟`;
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultWaMsg)}`;

  const dateStr = order.createdAt ? order.createdAt.slice(0, 10).replace(/-/g, "/") : "2026/10/03";

  // Delivery status badge
  const deliveryStatusText =
    order.status === "delivered"
      ? "المسلّمة 💵"
      : order.status === "shipped"
      ? "قيد التوصيل 🚚"
      : order.status === "confirmed"
      ? "جاهزة للإرسال"
      : "في الانتظار";

  return `
  <tr id="order-row-${order.id}" class="order-row hover:bg-slate-50/80 transition" data-status="${order.status}" data-city="${escapeHtml(order.customerCity)}">
    
    <!-- 1. Checkbox -->
    <td class="py-3.5 px-3 text-center">
      <input type="checkbox" class="row-checkbox rounded text-emerald-600 focus:ring-0">
    </td>

    <!-- 2. Date -->
    <td class="py-3.5 px-3 font-mono text-[11px] text-slate-600">
      <div class="font-bold text-slate-800">${dateStr}</div>
      <span class="inline-block mt-0.5 bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.2 rounded font-sans">
        صفحة الهبوط
      </span>
    </td>

    <!-- 3. Customer (Name, Phone, Badges, WhatsApp Link) -->
    <td class="py-3.5 px-3 space-y-1">
      <div class="font-extrabold text-slate-900 text-xs">${escapeHtml(order.customerName)}</div>
      <div class="font-mono text-slate-500 text-[11px] tracking-wider" dir="ltr">${escapeHtml(order.customerPhone)}</div>
      
      <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
        <span class="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded">
          صفحة الهبوط
        </span>
        <a 
          href="${waUrl}" 
          target="_blank" 
          class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition shadow-sm"
          title="فتح محادثة واتساب المباشرة مع الزبون"
        >
          <span>💬 وافق على واتساب</span>
        </a>
      </div>
    </td>

    <!-- 4. City -->
    <td class="py-3.5 px-3 font-semibold text-slate-700 text-xs">
      ${escapeHtml(order.customerCity)}
      ${order.customerAddress ? `<div class="text-[10px] text-slate-400 font-normal truncate max-w-[130px]">${escapeHtml(order.customerAddress)}</div>` : ""}
    </td>

    <!-- 5. Product & Quantity -->
    <td class="py-3.5 px-3">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-sm shrink-0 overflow-hidden">
          🎁
        </div>
        <div class="min-w-0">
          <div class="font-bold text-slate-800 truncate max-w-[140px] text-xs">${escapeHtml(order.notes || "منتج المتجر")}</div>
          <div class="text-[10px] text-slate-500">الكمية: <span class="font-bold text-slate-700">${order.quantity}</span></div>
        </div>
      </div>
    </td>

    <!-- 6. Total Price -->
    <td class="py-3.5 px-3 font-black text-slate-900 text-xs">
      ${order.totalPrice} DH
    </td>

    <!-- 7. Confirmation Status Dropdown & WhatsApp details -->
    <td class="py-3.5 px-3 space-y-1">
      <div>
        <select 
          onchange="updateOrderStatus('${order.id}', this.value)" 
          class="font-bold text-xs rounded-lg px-2 py-1 border transition cursor-pointer ${
            order.status === "confirmed"
              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
              : order.status === "new"
              ? "bg-amber-50 text-amber-700 border-amber-300"
              : order.status === "cancelled"
              ? "bg-rose-50 text-rose-700 border-rose-300"
              : "bg-slate-50 text-slate-700 border-slate-300"
          }"
        >
          <option value="new" ${order.status === "new" ? "selected" : ""}>🟡 للتأكيد (جديد)</option>
          <option value="confirmed" ${order.status === "confirmed" ? "selected" : ""}>✅ مؤكدة، للإرسال</option>
          <option value="shipped" ${order.status === "shipped" ? "selected" : ""}>🚚 قيد التوصيل</option>
          <option value="delivered" ${order.status === "delivered" ? "selected" : ""}>🎉 المسلّمة</option>
          <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>❌ ملغاة / مرتجع</option>
        </select>
      </div>

      <div class="text-[10px] text-slate-400">
        من طرف ${escapeHtml(order.customerName)} · ${dateStr}
      </div>
      <div class="text-[10px] text-emerald-600 font-semibold">
        نعم - عبر WhatsApp : OniFlow
      </div>
      <div class="text-[10px] text-slate-400">
        تم إرسال واتساب
      </div>
    </td>

    <!-- 8. Delivery Status -->
    <td class="py-3.5 px-3">
      <span class="inline-block text-[11px] font-bold px-2 py-1 rounded-lg ${
        order.status === "delivered"
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : order.status === "shipped"
          ? "bg-blue-50 text-blue-700 border border-blue-200"
          : order.status === "confirmed"
          ? "bg-slate-100 text-slate-700"
          : "bg-slate-50 text-slate-400"
      }">
        ${deliveryStatusText}
      </span>
    </td>

  </tr>
  `;
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
