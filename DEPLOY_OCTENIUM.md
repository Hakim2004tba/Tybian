# نشر تِبيان على Octenium (استضافة مشتركة + Node.js)

هذا الدليل يستبدل النشر على Vercel. الفكرة الأساسية: **نبني المشروع على
جهازك، ونرفع الناتج فقط.** الاستضافة المشتركة تحدّ الذاكرة لكل عملية
(عادةً ~1GB عبر CloudLinux LVE) و `next build` يحتاج غالباً أكثر من ذلك،
فالبناء على الخادم قد يفشل. البناء محلياً يتجاوز هذا الحد تماماً — الخادم
يُشغّل فقط، لا يبني.

---

## 0. حالة التوافق — مُتحقَّق منها

لوحة Octenium تعرض إصدارات Node.js حتى **24.17.0**، والمطلوب هو 20 أو
أحدث — إذن الشرط الحاسم متحقق والمشروع سيعمل.

**اختر 22.23.0** وليس 24.17.0 رغم أن الأخيرة موسومة "recommandée":
22.x هو إصدار LTS المستقر الذي تُختبر عليه Next.js على نطاق واسع.

---

## 1. البناء على جهازك

```bash
cd tibyan-app
bash scripts/build-deploy.sh
```

يُنتج مجلد `deploy/` (حوالي 70MB) يحتوي:

```
deploy/
├── app.js            ← نقطة الدخول التي يطلبها cPanel
├── server.js         ← خادم Next المُولَّد
├── package.json
├── node_modules/     ← الحزم الضرورية فقط (وليس كلها)
├── .next/static/     ← ملفات CSS و JS
└── public/           ← الصور والملفات الثابتة
```

> **مجلد `.next` مخفي.** عند الرفع عبر FTP فعّل إظهار الملفات المخفية،
> وإلا سيُرفع الموقع بلا تنسيقات ولا JavaScript.

---

## 2. إنشاء التطبيق في cPanel

**cPanel → Setup Node.js App → Create Application**

| الحقل (كما يظهر بالفرنسية) | القيمة |
|---|---|
| Version de Node.js | **22.23.0** |
| Mode d'application | `Production` |
| Racine de l'application | `tibyan` (أي اسم مجلد تختاره) |
| URL de l'application | نطاقك |
| Fichier de démarrage de l'application | `app.js` |
| Fichier journal Passenger | `/home/<اسم المستخدم>/logs/passenger.log` |

> املأ **Fichier journal Passenger**. إن فشل الإقلاع فهذا الملف هو المكان
> الوحيد الذي يخبرك بالسبب.

اضغط **Create**. سيُنشئ cPanel المجلد ويعرض أمر تفعيل البيئة — احتفظ به.

---

## 3. رفع الملفات

ارفع **محتويات** `deploy/` (وليس المجلد نفسه) إلى Application root.

**لا ترفع `.env.local`** — متغيرات البيئة تُضبط في الخطوة التالية.

---

## 4. متغيرات البيئة

في نفس صفحة Node.js App، أضف تحت **Environment variables**:

| المتغير | ملاحظة |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | من Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | من Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **سرّي** — لا يُشارك أبداً |
| `NEXT_PUBLIC_SITE_URL` | نطاقك الجديد، مثل `https://tibyan.dz` |
| `BUNNY_STREAM_LIBRARY_ID` | `731741` |
| `BUNNY_STREAM_API_KEY` | ⚠️ **المفتاح الحالي غير صالح — راجع القسم 7** |
| `BUNNY_STREAM_TOKEN_AUTH_KEY` | من لوحة Bunny |
| `BUNNY_STREAM_PULL_ZONE_HOSTNAME` | `vz-c2fbf3c4-e5d.b-cdn.net` |
| `BUNNY_STREAM_WEBHOOK_SECRET` | نص عشوائي طويل |
| `ANALYTICS_CRON_SECRET` | نص عشوائي طويل |

> `NEXT_PUBLIC_*` تُدمج وقت **البناء** لا وقت التشغيل. إن غيّرت أياً منها
> لاحقاً يجب إعادة تنفيذ `build-deploy.sh` وإعادة الرفع — لا يكفي تعديلها
> في cPanel.

ثم **Restart** التطبيق.

---

## 5. تحديث الروابط الخارجية بعد تغيير النطاق

هذه كانت تشير إلى `tybianacademy.vercel.app` ويجب تحديثها يدوياً:

1. **Supabase → Authentication → URL Configuration**
   - `Site URL` → نطاقك الجديد
   - `Redirect URLs` → أضف `https://نطاقك/auth/callback`
   - بدون هذا لن يعمل تسجيل الدخول ولا تأكيد البريد.

2. **لوحة Bunny Stream → Webhook URL**
   - `https://نطاقك/api/webhooks/bunny?secret=<BUNNY_STREAM_WEBHOOK_SECRET>`

---

## 6. Cron — بديل Vercel Cron

**cPanel → Cron Jobs**. كل 6 ساعات (`0 */6 * * *`):

```bash
curl -s -X POST -H "x-cron-secret: ضع_قيمة_ANALYTICS_CRON_SECRET_هنا" https://نطاقك/api/cron/refresh-analytics
```

لاحظ `-X POST` — المسار يرفض GET.

---

## 7. ⚠️ مفتاح Bunny الحالي غير صالح

الاختبار المباشر على `https://video.bunnycdn.com/library/731741/videos`
أعاد:

```
HTTP 401 {"Success":false,"Message":"Authentication has been denied for this request."}
```

المفتاح الحالي **41 حرفاً** بينما مفتاح Bunny هو GUID من **36 حرفاً**،
وترتيب الشرطات فيه خاطئ (`8-4-4-12-4-4` بدل `8-4-4-4-12`) — أي أنه نُسخ
بشكل خاطئ.

**الحل:** Bunny Dashboard → Stream → المكتبة `731741` → API → انسخ
**Library API Key** (وليس مفتاح الحساب العام، ولا Token Authentication Key).

نقل المفتاح الخاطئ إلى الخادم الجديد سينقل المشكلة معه.

---

## 8. التحديثات اللاحقة

لا يوجد نشر تلقائي عند `git push` كما في Vercel. كل تحديث يعني:

```bash
bash scripts/build-deploy.sh
```

ثم رفع `deploy/` مجدداً و **Restart** من cPanel.

---

## 9. معالجة الصور — معطّلة عمداً

`images.unoptimized: true` مضبوط في `next.config.js`، لسببين:

1. `next/image` يحتاج مكتبة `sharp`، وهي **مبنيّة لنظام التشغيل**. البناء
   يتم على macOS، فكانت الحزمة تحمل نسخة macOS التي لا تعمل على خادم
   Linux — كل الصور كانت ستُرجع خطأ 500.
2. معالجة الصور هي أثقل ما يفعله Next لكل طلب، وهو حمل لا يناسب خطة
   مشتركة.

**النتيجة العملية:** الصور تُخدَّم بحجمها الأصلي بلا تصغير، لذا **يجب
تجهيز الصور بالحجم المناسب قبل رفعها**. صورة الهيرو مثلاً حُوّلت من
PNG بحجم 2MB إلى `anatomy.webp` بحجم 240KB (840px عرضاً).

انتبه لهذا عند إضافة أغلفة دورات جديدة — ارفع صوراً معقولة الحجم
(< 300KB)، فلن يصغّرها Next نيابةً عنك.

سكربت البناء يحذف `sharp` من الحزمة تلقائياً (توفير ~20MB).
