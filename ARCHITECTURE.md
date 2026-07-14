# 🏗️ شرح بنية التطبيق بالتفصيل — Holoform Studio

هذا الملف يشرح كيف يعمل التطبيق من الداخل: البنية، الأكواد، القرارات التقنية، وكل الفخاخ التي وقعنا فيها وحلولها — بحيث تقدر تبني تطبيقاً مشابهاً لأي غرض آخر.

> **الفكرة بجملة واحدة:** لوحة تحكم تنشئ منها «تجارب واقع معزّز»، كل تجربة لها رابط عام ورمز QR، وأي زائر يمسح الرمز بجواله يشاهد المحتوى (مجسّم/صورة/فيديو/نص/تتبع صورة) في الواقع المعزّز — بدون تطبيق، من المتصفح مباشرة.

---

## 1. المكدس التقني (Tech Stack)

| الطبقة | التقنية | لماذا |
|---|---|---|
| إطار العمل | Next.js 16 (App Router) + React 19 + TypeScript | صفحات + API في مشروع واحد، ينشر على Vercel بضغطة |
| التنسيق | Tailwind CSS v4 | سرعة + دعم RTL مدمج (`start`/`end` بدل `left`/`right`) |
| ثلاثي الأبعاد | three.js + `@google/model-viewer` | model-viewer يتكفّل بتسليم AR الأصلي للجوالات |
| تتبع الصور | MindAR (نواة `Controller` فقط) | مطابقة ملامح الصور في المتصفح عبر TensorFlow.js |
| توليد GLB | `@gltf-transform/core` (WebIO) | بناء ملفات glTF برمجياً داخل المتصفح |
| توليد USDZ | **كود يدوي خاص بنا** (`bake-theme-usdz.ts`) | لا توجد مكتبة جاهزة تبني USDZ متحركاً في المتصفح |
| قاعدة البيانات | Supabase Postgres | جداول + تخزين ملفات + مفاتيح API جاهزة |
| تخزين الملفات | Supabase Storage (bucket عام) | روابط عامة مباشرة + روابط رفع موقّعة |
| الاستضافة | Vercel (ربط GitHub تلقائي) | كل push على الفرع ينشر تلقائياً |
| QR | `qrcode` | توليد PNG/SVG في المتصفح |

---

## 2. خريطة الملفات

```
src/
├── app/
│   ├── page.tsx                    # لوحة التحكم (قائمة التجارب)
│   ├── create/page.tsx             # معالج الإنشاء (3 خطوات)
│   ├── experience/[id]/page.tsx    # تفاصيل تجربة: تعديل + QR + تحليلات
│   ├── ar/[id]/page.tsx            # ⭐ العارض العام (ما يفتحه زائر الـ QR)
│   └── api/
│       ├── experiences/            # CRUD للتجارب
│       ├── upload/sign/            # الخطوة 1 من الرفع: رابط موقّع
│       ├── upload/                 # رفع محلي (وضع التطوير فقط)
│       ├── files/[name]/           # تقديم الملفات المحلية (تطوير فقط)
│       ├── track/                  # تسجيل مشاهدة (تحليلات)
│       └── health/                 # فحص صحة + وضع التخزين
├── components/
│   ├── ARViewerShell.tsx           # ⭐ عقل العارض: يقرر أي مسار AR يستخدم
│   ├── viewers/
│   │   ├── ModelViewerClient.tsx   # غلاف <model-viewer> (مجسّمات + ملصقات مخبوزة)
│   │   ├── PlaneViewer.tsx         # عارض three.js (صور/فيديو/نص) + WebXR + كاميرا AR-lite
│   │   └── TrackedViewer.tsx       # ⭐ عارض تتبع الصور (جسر MindAR ↔ three)
│   ├── AppShell.tsx                # هيكل الاستوديو (شريط علوي + زر رجوع)
│   ├── UploadDropzone.tsx          # مكوّن الرفع (سحب/إفلات + تحقق)
│   ├── QRPanel.tsx                 # توليد وتنزيل QR
│   ├── LivePreview.tsx             # المعاينة الحية في المعالج
│   └── AnalyticsPanel.tsx          # عرض التحليلات
└── lib/
    ├── types.ts                    # ⭐ كل الأنواع + الثوابت المشتركة
    ├── store.ts                    # واجهة التخزين (interface) + اختيار المخزن
    ├── supabase-store.ts           # التخزين الإنتاجي (Postgres + Storage)
    ├── local-store.ts              # تخزين ملف JSON (تطوير محلي)
    ├── api.ts                      # دوال fetch للواجهة (client)
    ├── upload-config.ts            # الامتدادات/الأحجام/أنواع MIME المسموحة
    ├── i18n.ts                     # قاموس الترجمة en/ar + تبديل الاتجاه
    ├── bake-theme-glb.ts           # ⭐ خبز الملصق المزخرف → GLB (+ ينادي USDZ)
    ├── bake-theme-usdz.ts          # ⭐ توليد USDZ متحرك يدوياً (نص USDA + zip)
    ├── scene-decorations.ts        # زينة الثيمات في three.js (بانر/بالونات/قصاصات)
    ├── compile-target.ts           # تحويل صورة → ملف ملامح .mind (في المتصفح)
    ├── image-to-glb.ts + ar-model.ts # ملصق بسيط → GLB (على الخادم)
    ├── safe-texture.ts             # تصغير الصور الضخمة قبل WebGL
    └── env.ts                      # قراءة متغيرات البيئة والتحقق منها
supabase/migrations/                # SQL لإنشاء الجداول والصلاحيات
public/sounds/                      # الأصوات الجاهزة (مولّدة برمجياً)
```

---

## 3. نموذج البيانات

### 3.1 الأنواع الأساسية (`src/lib/types.ts`)

```ts
type ARContentType = "model" | "image" | "video" | "text" | "tracked";

interface ExperienceContent {
  assetUrl?: string;        // الملف الرئيسي (GLB/صورة/فيديو)
  usdzUrl?: string;         // نسخة USDZ للآيفون (Quick Look)
  arModelUrl?: string;      // GLB مولّد تلقائياً لتجارب الصور
  targetImageUrl?: string;  // (تتبع) الصورة التي تبحث عنها الكاميرا
  mindUrl?: string;         // (تتبع) ملف الملامح المُجمَّع .mind
  scene?: SceneConfig;      // الثيم والزينة (بانر/بالونات/قصاصات)
  text?: string;            // (نص) النص المعروض
  textStyle?: TextStyle;    // لون وخامة النص
  audioUrl?: string;        // الصوت المصاحب
  audioLoop?: boolean;      // تكرار الصوت
  audioInUsdz?: boolean;    // هل الصوت مدمج داخل USDZ؟ (لمنع التكرار على iOS)
}
```

**قرار مهم:** كل الحقول «الإضافية» اختيارية داخل كائن `content` واحد، مما يجعل إضافة نوع محتوى جديد أو خاصية جديدة لا يكسر شيئاً.

### 3.2 قاعدة البيانات (`supabase/migrations/0001_init.sql`)

جدولان فقط:

```sql
experiences (
  id text primary key,          -- nanoid(10) — يظهر في الرابط العام
  title, description, type,     -- type: model3d | image | video | text3d | tracked_image
  status,                       -- draft | published
  asset_url, usdz_url, thumbnail_url,
  config jsonb,                 -- ⭐ كل الحقول المرنة هنا (نص/ثيم/صوت/تتبع)
  total_views int,              -- عدّاد مُجمَّع (denormalized) لسرعة اللوحة
  last_viewed_at, created_at, updated_at
)

scans (
  id, experience_id references experiences on delete cascade,
  device_type, os, browser, referrer, user_agent, created_at
)
```

**لماذا `config jsonb`؟** الأعمدة الثابتة للحقول التي تُفلتر/تُفهرس، و jsonb لكل ما هو مرن. أضفنا الثيمات ثم الصوت لاحقاً **بدون أي migration**.

**أمان:** RLS مفعّل على الجدولين بدون أي سياسات للـ anon — يعني مفاتيح المتصفح لا تصل للبيانات إطلاقاً؛ كل شيء يمر عبر API routes التي تستخدم المفتاح السري (خادم فقط). دالة `record_scan()` من نوع `SECURITY DEFINER` تسجّل المشاهدة وتحدّث العدادات في معاملة واحدة.

---

## 4. نظام رفع الملفات — أهم درس في المشروع

### المشكلة
Vercel يرفض أي طلب جسمه أكبر من **4.5 MB**، والقرص للقراءة فقط. رفع ملف GLB بحجم 30MB عبر الخادم = خطأ 500 فوري.

### الحل: الرفع المباشر بروابط موقّعة (خطوتان)

```
المتصفح                          الخادم                        Supabase Storage
   │  POST /api/upload/sign          │                                │
   │  {name, size, kind} ──────────► │  يتحقق من الامتداد والحجم       │
   │                                 │  createSignedUploadUrl() ────► │
   │  ◄──── {uploadUrl, publicUrl} ──│                                │
   │                                                                  │
   │  PUT الملف كاملاً ─────────────────────────────────────────────► │
   │  (لا يمرّ على خادمنا إطلاقاً — لا يوجد حد 4.5MB)                   │
```

الكود: `src/app/api/upload/sign/route.ts` (الخادم) + `uploadFile()` في `src/lib/api.ts` (المتصفح).

**التحقق مركزي** في `src/lib/upload-config.ts`: قائمة امتدادات لكل «نوع رفع» (`model/usdz/image/video/mind/audio`) + خريطة MIME واحدة يستخدمها كل من التحقق والتقديم — لما كانت مكررة في مكانين نسينا `.mind` في أحدهما وصار 404.

**وضع التطوير:** إن لم توجد مفاتيح Supabase، يرجع `/api/upload/sign` وضع `local` فيتحول المتصفح لرفع multipart عادي يُحفظ في `data/uploads/`. واجهة `ExperienceStore` (في `store.ts`) لها تطبيقان: `SupabaseStore` و`LocalStore` — الواجهة كلها لا تعرف أيهما يعمل.

---

## 5. العارض العام — القرار الأهم في التطبيق

`ARViewerShell.tsx` هو العقل. المشكلة الجوهرية في WebAR: **كل منصة لها طريق مختلف للواقع المعزّز:**

| المنصة | ما تدعمه | مسارنا |
|---|---|---|
| أندرويد + Chrome | WebXR + Scene Viewer | WebXR للمحتوى المسطح، Scene Viewer للمجسّمات |
| آيفون Safari | ❌ لا WebXR إطلاقاً | Quick Look (يتطلب USDZ) أو وضع الكاميرا AR-lite |
| متصفحات داخل التطبيقات (واتساب/انستغرام) | ❌ كاميرا محجوبة | كشفها وإظهار رسالة «افتح في المتصفح» |
| كمبيوتر | لا AR | معاينة 3D تفاعلية + QR للفتح بالجوال |

### شجرة القرار (مبسطة من الكود)

```
النوع؟
├─ tracked  → TrackedViewer (يحتاج كاميرا فقط — يعمل على كل شيء)
├─ model أو image-مخبوزة → ModelViewerClient (<model-viewer>)
│     ├─ أندرويد: زر AR → Scene Viewer (تتبع أرضي حقيقي)
│     └─ آيفون: ios-src (USDZ) → Quick Look (تتبع ARKit حقيقي)
└─ image/video/text → PlaneViewer (three.js)
      ├─ WebXR مدعوم؟ → جلسة immersive-ar حقيقية
      ├─ لا، لكن جوال + كاميرا؟ → وضع الخلفية بالكاميرا (AR-lite + جيروسكوب)
      └─ لا شيء → معاينة 3D + رسالة واضحة
```

### دروس منصات حرجة

1. **كشف قدرة AR في model-viewer متأخر (lazy)** — لا تقرأ `canActivateAR` مرة واحدة؛ نعمل polling حتى 5 ثوانٍ (`ARViewerShell.tsx` سطر ~120).
2. **الفشل بعد الضغط:** حتى لو قال model-viewer «جاهز»، إطلاق AR قد يفشل (ARCore غير مثبت). نستمع لحدث `ar-status === "failed"` ونعيد فتح الشاشة برسالة محددة + رابط تثبيت ARCore.
3. **متصفحات داخل التطبيقات:** نكشفها من الـ user agent (`FBAN|Instagram|WhatsApp|; wv\)`...) ونعرض التحذير **قبل** أن يضغط الزائر ويُحبط.
4. **`ios-src` يتجاوز تحويل آبل:** إذا أعطيت model-viewer ملف USDZ جاهزاً، يستخدمه آيفون مباشرة بدل تحويل GLB على الجهاز — وهذا مفتاح الأنيميشن والصوت على iOS (§8).

---

## 6. وضع الكاميرا AR-lite (لآيفون بدون WebXR) — `PlaneViewer.tsx`

للمحتوى المسطح على آيفون (لا WebXR ولا Quick Look يناسبه):

1. **بث الكاميرا الخلفية** `getUserMedia({video: {facingMode: "environment"}})` كطبقة تحت canvas شفاف — الزائر يرى غرفته والمحتوى فوقها.
2. **تثبيت بالجيروسكوب:** نقرأ `deviceorientation` ونعكس دوران الجوال على كاميرا three (رياضيات DeviceOrientationControls الكلاسيكية — دالة `setCameraFromGyro`). عند أول قراءة، نضع المحتوى على بعد 1.6م باتجاه نظر المستخدم — فإذا لفّ جواله يبقى المحتوى «مثبتاً» في اتجاهه من الغرفة.

> ⚠️ **أخطر فخ في iOS:** `DeviceOrientationEvent.requestPermission()` يجب أن يُستدعى **داخل ضغطة المستخدم وقبل أي `await`** — أي سطر `await` قبله يكسر «سلسلة الإيماءة» فيرفض iOS الطلب بصمت. رتّبنا `startCameraBackdrop()` بحيث يطلب إذن الجيروسكوب أولاً ثم الكاميرا.

3. **حدود هذا الوضع:** الدوران فقط — المشي حول المحتوى غير ممكن (يحتاج ARKit/WebXR). لهذا لاحقاً خبزنا الملصقات المزخرفة إلى GLB/USDZ لتحصل على تتبع أرضي حقيقي (§8).

---

## 7. تتبع الصور (مثل AR Foundation Image Tracking) — `TrackedViewer.tsx`

الزائر يوجّه الكاميرا على صورة مطبوعة (بوستر/غلاف) فيظهر المحتوى ملتصقاً بها.

### مرحلة الإنشاء (في المتصفح)
`compile-target.ts`: صورة الهدف → `MindAR Compiler` (يستخرج نقاط الملامح المميزة بأحجام متعددة) → ملف `.mind` يُرفع مثل أي ملف. يستغرق ثوانٍ، مع شريط تقدم و«حارس تعليق» يفشل بوضوح بعد 90 ثانية بدل الانتظار الأبدي.

### مرحلة العرض
لم نستخدم غلاف `MindARThree` الرسمي لأنه يستهدف API قديماً حُذف من three (`sRGBEncoding`). بنينا **جسراً خاصاً** فوق نواة `Controller` فقط:

```ts
const { Controller } = await import("mind-ar/dist/mindar-image.prod.js");
const controller = new Controller({
  inputWidth: video.videoWidth, inputHeight: video.videoHeight, maxTrack: 1,
  onUpdate: (data) => {
    // worldMatrix ← موقع الصورة في العالم، أو null إذا فُقدت
    anchor.matrix = worldMatrix × postMatrix;   // postMatrix ينقل الأصل لمركز الصورة
  },
});
```

أهم تفصيلين منسوخين من الرياضيات الرسمية (وإلا انحرف كل شيء):
- **postMatrix**: `compose(translate(w/2, w/2+(h-w)/2), scale(w))` — يجعل «1 وحدة = عرض الصورة المطبوعة» والأصل في مركزها.
- **إسقاط الكاميرا**: fov/near/far تُشتق من `controller.getProjectionMatrix()` مع تصحيح لقص cover-fit للفيديو (دالة `resize`).

### دروس أداء التتبع (مهمة جداً لأي تطبيق مشابه)

المتتبِّع (TensorFlow.js) يشارك **نفس GPU** مع العرض. أي حمل رسومي زائد = تتبع سيئ:

1. **فيديو كمحتوى فوق الصورة:** لا تستخدم `THREE.VideoTexture` أبداً هنا — ترفع إطارات بدقة كاملة (1080p/4K) كل إطار عرض. الحل: نرسم الفيديو على canvas مصغّر (≤640px) بمعدل ≤24fps ونرفع منه، مع تعطيل mipmaps.
2. **أوقف الفيديو أثناء البحث عن الهدف:** فك الترميز المستمر يخنق مرحلة الالتقاط. الفيديو يبدأ لحظة العثور على الصورة ويتوقف عند فقدانها.
3. **pixelRatio ≤ 1.5** في عارض التتبع (بدل 2).
4. **جودة صورة الهدف حاسمة:** الصور الغنية بالتفاصيل والتباين تتتبَّع ممتازاً؛ الشعارات البسيطة على خلفية سادة سيئة — وضعنا تلميحاً في الواجهة.

---

## 8. نظام الثيمات والخبز (Baking) — أذكى جزء في التطبيق

### المشكلة على ثلاث مراحل (كما حدثت فعلاً)

1. **زينة في المتصفح فقط:** `scene-decorations.ts` يبني بانراً نصياً (canvas يدعم تشكيل العربية) + بالونات + قصاصات InstancedMesh — يعمل في كل عارض متصفح. لكن على آيفون الوضع كان AR-lite (تتبع ضعيف).
2. **«خلّه يتتبع مثل الباقين»:** الحل — **اخبز المشهد كله في ملف GLB واحد** عند الحفظ (`bake-theme-glb.ts` عبر gltf-transform في المتصفح) وارفعه كأنه مجسّم عادي → يمر عبر model-viewer → تتبع ARKit/ARCore حقيقي. القصاصات تُدمج per-color في mesh واحد (بدون امتداد instancing — Quick Look لا يدعمه).
3. **«الأنيميشن ما اشتغل على آيفون»:** تحويل آبل GLB→USDZ على الجهاز **يحذف الأنيميشن**. الحل النهائي: **توليد USDZ يدوياً** (`bake-theme-usdz.ts`).

### توليد USDZ يدوياً (لا توجد مكتبة لهذا!)

USDZ = نص **USDA** + ملفات + تغليف ZIP بشروط خاصة:

```
#usda 1.0
( defaultPrim = "Root", metersPerUnit = 1, upAxis = "Y",
  startTimeCode = 0, endTimeCode = 288, timeCodesPerSecond = 24 )

def Xform "Root" {
    def Mesh "Poster" { ... material:binding ... }     ← الملصق (مثلثان + خامة PNG)
    def Xform "Balloon0" {
        float3 xformOp:translate.timeSamples = {        ← ⭐ الأنيميشن: 48 مفتاح جيبي
            0: (x, y, z), 6: (x, y+0.02, z), ...        (البداية = النهاية → حلقة سلسة)
        }
        def Sphere "geo" { double radius = 0.07 }       ← كرة أصلية في USD
    }
    def SpatialAudio "Soundtrack" {                     ← ⭐ الصوت (المخطط القياسي!)
        uniform asset filePath = @audio/track.wav@
        uniform token auralMode = "nonSpatial"
        uniform token playbackMode = "loopFromStage"
    }
    def Scope "Materials" { ... UsdPreviewSurface + UsdUVTexture ... }
}
```

**شروط التغليف (packUsdz):**
- ZIP **بدون ضغط** (store only).
- **بداية بيانات كل ملف يجب أن تكون على حد 64 بايت** — نحقّقها بحقل zip "extra" للحشو (مع معرّف خاص 0x1986)، وكتبنا CRC32 يدوياً.

**فخاخ USD مقابل glTF:**
- إحداثيات UV (`primvars:st`) أصلها **أسفل-يسار** في USD (عكس glTF) — نعكس V عند التوليد.
- الصوت: استخدم مخطط **`SpatialAudio` القياسي** (`filePath`/`auralMode`/`playbackMode`) — المخطط القديم `Preliminary_AudioSpatialAudio` **يتجاهله Quick Look الحديث بصمت** (هذا كان سبب «الصوت ما يشتغل»).
- صيغ الصوت المقبولة داخل USDZ: M4A, MP3, WAV فقط.

### خلاصة مسار الملصق المزخرف عند الحفظ

```
صورة المستخدم + إعدادات الثيم
        │  (rasterize مرة واحدة: canvas للملصق + canvas للبانر العربي)
        ├────────► buildGlb()  ──► themed-poster.glb  ──► أندرويد (أنيميشن يعمل)
        └────────► buildThemedUsdz() ──► themed-poster.usdz ──► آيفون (أنيميشن + صوت)
   ثم يُرفع الاثنان و model-viewer يستخدم src + ios-src
```

---

## 9. نظام الصوت

- **مصدران:** رفع ملف (mp3/m4a/wav) أو **قائمة جاهزة** (`SOUND_PRESETS` في types.ts + ملفات `public/sounds/*.wav` مولّدة برمجياً — لحن عيد ميلاد/تصفيق/بوق/أجراس — بدون حقوق نشر).
- **التشغيل في الويب:** عنصر `Audio` يملكه `ARViewerShell` (وليس العارضات) ويُشغَّل **داخل ضغطة «ابدأ AR»** — هذا يرضي سياسة autoplay في كل المتصفحات.
- **تجارب التتبع:** الضغطة «تفتح» الصوت فقط (play ثم pause فوراً — مع حارس ضد سباق العثور السريع على الهدف)، ثم يتبع ظهور/اختفاء الصورة المستهدفة.
- **آيفون + ملصق مخبوز:** الصوت مدمج داخل USDZ (يشغّله Quick Look أصلياً). العلم `audioInUsdz` يمنع تشغيل صوت الصفحة بالتوازي (وإلا يتكرر الصوت مرتين). التجارب الأقدم بدون العلم تحصل على صوت الصفحة كخطة بديلة.
- **زر كتم واحد** يتحكم في الفيديو والصوت معاً.

---

## 10. QR والتحليلات

- **QR:** مكتبة `qrcode` تولّد PNG (canvas) وSVG في المتصفح مباشرة من الرابط العام. الرابط الكنسي من `NEXT_PUBLIC_APP_URL` كي لا تشير الرموز لـ localhost.
- **التحليلات:** العارض ينادي `POST /api/track` عند الفتح (مع `keepalive: true` كي لا يضيع الطلب). الخادم يحلل الـ user agent (`ua.ts`) → جهاز/نظام/متصفح، وينادي `record_scan()` التي تسجّل وتحدّث العدادات معاً. الفشل هنا **لا يكسر العارض أبداً** (try/catch صامت).

---

## 11. الترجمة والاتجاه (i18n/RTL)

- قاموسان كاملان en/ar في `i18n.ts` + React Context يبدّل `document.dir` تلقائياً.
- **قواعد RTL في الكود:** استخدم دائماً `start`/`end` في Tailwind (`ps-4`, `end-4`) بدل `left`/`right`، والأسهم تنعكس بـ `rtl:rotate-180`.
- **العربية في 3D:** خطوط typeface ثلاثية الأبعاد لا تدعم تشكيل العربية — أي نص عربي يُرسم على **canvas** (المتصفح يشكّله صح) ثم يصبح خامة على سطح. (نفس الحيلة للبانر المخبوز في GLB/USDZ).

---

## 12. معالجة الأخطاء — فلسفة «أخطاء مرئية قابلة للتنفيذ»

- كل API route ملفوف بـ `serverError(context, e)` (في `api-errors.ts`) يرجع **رسالة حقيقية** (مثلاً: «Storage error… تأكد أن bucket ar-assets موجود — راجع SETUP.md») بدل «Internal Server Error».
- الواجهة تعرض رسالة الخطأ القادمة من الخادم نصاً، لكل عملية (رفع/حفظ/تجميع ملامح).
- فشل الخطوات «الكمالية» (خبز الثيم، توليد GLB للملصق، التحليلات) **غير قاتل** — التجربة تُحفظ ويكمل التطبيق بالمسار الأساسي.

---

## 13. النشر والتشغيل

1. **Supabase:** أنشئ مشروعاً → نفّذ `supabase/migrations/*.sql` بالترتيب → أنشئ bucket عام `ar-assets` (الـ SQL يفعلها).
2. **متغيرات البيئة (على Vercel):**
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (المفتاح السري — **خادم فقط، لا يوضع في الشات أو الكود أبداً**)
   - `NEXT_PUBLIC_APP_URL` (الدومين النهائي — لروابط QR)
3. **Vercel:** اربط مستودع GitHub — كل push ينشر تلقائياً. (لو تأخر النشر عن دقائق: الـ webhook أحياناً يفوّت push — ادفع commit فارغاً.)
4. محلياً بدون أي إعداد: يعمل بوضع التخزين المحلي تلقائياً (`data/` + `/api/files`).

---

## 14. جدول الفخاخ الكامل (اختصار تجربتنا كلها)

| الفخ | العرَض | الحل |
|---|---|---|
| حد 4.5MB في Vercel | 500 عند رفع ملفات كبيرة | روابط رفع موقّعة، PUT مباشر للتخزين |
| قرص Vercel للقراءة فقط | فشل أي كتابة ملفات | كل شيء في Supabase Storage |
| iOS بلا WebXR | «الكاميرا ما تفتح» على آيفون | Quick Look عبر USDZ، أو AR-lite بالكاميرا |
| تحويل آبل GLB→USDZ يحذف الأنيميشن | مشهد متجمد على آيفون | توليد USDZ يدوياً + `ios-src` |
| مخطط الصوت التجريبي القديم | صمت في Quick Look | `SpatialAudio` القياسي (filePath/playbackMode) |
| إذن الجيروسكوب بعد `await` | iOS يرفض بصمت | اطلب الإذن أول شيء داخل الضغطة |
| صور الجوال > 4096px | خامة سوداء على WebGL الجوال | تصغير لأقصى 2048 قبل الرفع للخامة (`safe-texture.ts`) |
| VideoTexture بدقة كاملة مع تتبع | تتبع سيئ مع الفيديو | canvas مصغّر ≤640px بمعدل ≤24fps + إيقاف أثناء البحث |
| MindARThree يستخدم three API محذوف | انهيار عند التحميل | جسر خاص فوق نواة Controller |
| autoplay policy | فيديو/صوت لا يعمل | كل تشغيل يبدأ من ضغطة المستخدم؛ الفيديو يبدأ مكتوماً + زر |
| دوران 360° للمعاينة | ظهر الملصق الداكن/نص معكوس | تمايل ±17° بدلاً من دوران كامل |
| متصفحات داخل التطبيقات | فشل صامت للكاميرا/AR | كشف UA + رسالة «افتح في Safari/Chrome» |
| st في USD أصله أسفل-يسار | خامات مقلوبة في USDZ | عكس محور V عند التوليد |
| خطوط 3D لا تشكّل العربية | حروف مقطعة | ارسم النص على canvas واستخدمه كخامة |

---

## 15. كيف تعيد استخدام هذا لتطبيق آخر؟

**الأجزاء القابلة للنقل كما هي (نسخ/لصق مع تعديل بسيط):**
- نظام الرفع الموقّع كاملاً (`upload-config.ts`, `api/upload/sign`, `uploadFile`, `UploadDropzone`) — يصلح لأي تطبيق ملفات على Vercel+Supabase.
- واجهة `ExperienceStore` بنمط المخزنين (محلي/سحابي) — استبدل الحقول فقط.
- `ARViewerShell` وشجرة قرارات المنصات — هذه هي الخلاصة الأصعب في WebAR.
- `bake-theme-usdz.ts` — مولّد USDZ اليدوي (packUsdz + quadMesh + timeSamples + SpatialAudio) يصلح لأي محتوى USDZ متحرك بصوت.
- جسر MindAR (`TrackedViewer`) + المُجمِّع (`compile-target.ts`) — لأي تتبع صور.
- نمط i18n/RTL كاملاً.

**ما الذي تغيّره لغرض جديد؟**
1. `types.ts`: عدّل `ARContentType` و`ExperienceContent` لمحتواك.
2. `scene-decorations.ts` + دوال البناء في `bake-theme-glb/usdz`: ثيماتك الجديدة (البنية جاهزة — الثيم = دالة تبني عناصر + أنيميشن).
3. القاموس في `i18n.ts` ونصوص الواجهة.
4. جدول `experiences`: غالباً يكفي إضافة مفاتيح داخل `config jsonb` بدون migrations.

**نصيحة أخيرة:** ابدأ بالعارض العام (`/ar/[id]`) واختبره على جوال حقيقي من أول يوم — كل صعوبة WebAR في المنصات، وكلها لا تظهر إلا على الأجهزة الحقيقية (المحاكيات وheadless لا تشغّل Quick Look ولا مطابقة الملامح).
