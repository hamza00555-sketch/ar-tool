/**
 * Lightweight i18n for Holoform Studio (English + Arabic with RTL).
 *
 * The locale lives in a tiny external store backed by localStorage and is read
 * through useSyncExternalStore, so SSR always renders English and the client
 * re-renders once after hydration if Arabic was saved — no hydration errors.
 */
"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ARContentType, ViewEvent } from "./types";

export type Locale = "en" | "ar";

const STORAGE_KEY = "holoform.locale";

let locale: Locale = "en";
let initialized = false;
const listeners = new Set<() => void>();

function readStored(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "ar" || saved === "en") locale = saved;
}

const localeStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get(): Locale {
    readStored();
    return locale;
  },
  getServer(): Locale {
    return "en";
  },
  set(next: Locale) {
    locale = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing — the choice just won't persist
    }
    listeners.forEach((cb) => cb());
  },
};

/* --------------------------------- dictionary ---------------------------- */

const en = {
  dir: "ltr" as "ltr" | "rtl",
  langName: "العربية", // label of the OTHER language (what the toggle switches to)
  nav: { experiences: "Experiences", newShort: "New" },
  footer: "Holoform Studio — WebAR experiences from a QR code.",
  types: {
    model: { label: "3D Model", blurb: "GLB / glTF object anchored in space" },
    image: { label: "Image / Poster", blurb: "A floating image plane" },
    video: { label: "Video", blurb: "A floating video screen" },
    text: { label: "3D Text", blurb: "Extruded text you can style" },
    tracked: { label: "Image Tracking", blurb: "Content pinned onto a real printed image" },
  } as Record<ARContentType, { label: string; blurb: string }>,
  templates: {
    packaging: {
      name: "Product Packaging",
      tagline: "Bring a box or label to life",
      titleHint: "Product reveal",
      descriptionHint: "Scan the pack to explore the product in 3D.",
    },
    exhibition: {
      name: "Exhibition",
      tagline: "AR exhibits beside real ones",
      titleHint: "Exhibit companion",
      descriptionHint: "Point your phone at the stand to see the full story.",
    },
    "business-card": {
      name: "Business Card",
      tagline: "A card that introduces you in AR",
      titleHint: "My AR card",
      descriptionHint: "Scan to see who I am — in your space.",
    },
    poster: {
      name: "Poster",
      tagline: "Posters that step off the wall",
      titleHint: "Campaign poster",
      descriptionHint: "The key visual, floating in the room.",
    },
    training: {
      name: "Training Guide",
      tagline: "Show a procedure, not a PDF",
      titleHint: "How-to in AR",
      descriptionHint: "Watch the walkthrough right where you work.",
    },
  } as Record<
    string,
    { name: string; tagline: string; titleHint: string; descriptionHint: string }
  >,
  status: { live: "Live", draft: "Draft" },
  dashboard: {
    kicker: "Creator studio",
    headlinePre: "AR experiences that open from a",
    headlineAccent: "QR code",
    newExperience: "New experience",
    statExperiences: "Experiences",
    statLive: "Live",
    statScans: "Total scans",
    emptyTitle: "No experiences yet",
    emptyBody:
      "Create your first AR experience — pick a content type, add your asset, and you’ll get a QR code that opens it in the browser.",
    emptyCta: "Create your first experience",
    localModeTitle: "Local dev mode",
    localModeBody:
      "Data and uploads are stored on this machine only and won’t survive serverless deployment. Connect Supabase for production — see SETUP.md.",
  },
  card: {
    scans: "scans",
    viewed: (ago: string) => `viewed ${ago}`,
    never: "never",
    justNow: "just now",
    minutes: (n: number) => `${n}m ago`,
    hours: (n: number) => `${n}h ago`,
    days: (n: number) => `${n}d ago`,
  },
  wizard: {
    steps: ["Type", "Content", "Publish"],
    typeTitle: "What should appear in AR?",
    typeSub: "Pick a content type — you can add the actual content in the next step.",
    orTemplate: "Or start from a template",
    contentTitle: (type: string) => `Add your ${type.toLowerCase()}`,
    contentSub: "The live preview updates as soon as content is ready.",
    modelHint: ".glb or .gltf, up to 50 MB",
    useSample: "✦ Use the bundled sample model",
    iosLabel: "iOS Quick Look (optional)",
    usdzHint: ".usdz — enables native AR on iPhone/iPad",
    usdzAttached: "USDZ attached",
    imageHint: ".png .jpg .webp .gif, up to 50 MB",
    videoHint: ".mp4 .webm .mov, up to 50 MB",
    orLinkVideo: "…or link a hosted video",
    useLink: "Use",
    linkedVideo: "linked video",
    linkHint: "Direct .mp4/.webm links work best (the host must allow cross-origin access).",
    yourText: "Your text",
    textPlaceholder: "HELLO WORLD",
    color: "Color",
    finish: "Finish",
    finishes: { metal: "Metal", matte: "Matte", neon: "Neon" },
    back: "Back",
    continue: "Continue",
    addToContinue: "Add content to continue",
    publishTitle: "Details & publish",
    titleLabel: "Title",
    titlePlaceholder: "e.g. Spring launch — hero product",
    descLabel: "Description",
    descPlaceholder: "Shown to viewers on the AR start screen.",
    thumbLabel: "Thumbnail (optional)",
    thumbHint: "Shown on the dashboard card",
    thumbSet: "Thumbnail set",
    publishNow: "Publish immediately",
    publishNote: "— the QR code goes live right away",
    create: "Create experience",
    creating: "Creating…",
    saveFailed: "Could not save the experience.",
    livePreview: "Live preview",
    orbitHint: "Drag to orbit · pinch or scroll to zoom",
    previewEmptyText: "Type something to see it in 3D",
    previewEmpty: "Add content to see the live preview",
    targetLabel: "Target image — what the camera looks for",
    targetHint: ".png .jpg, print-quality",
    targetQualityHint:
      "Use a detailed, high-contrast picture (photos, artwork, busy packaging). Simple logos on plain backgrounds track poorly.",
    compiling: (pct: number) => `Analyzing image features… ${pct}%`,
    compileFailed: "Image analysis failed — try a more detailed picture.",
    targetReady: "Target compiled ✓",
    overlayLabel: "What appears on the image",
    overlayModel: "3D model",
    overlayVideo: "Video",
    overlayImage: "Image",
    sceneLabel: "Theme & decorations",
    themeNone: "None",
    themeBirthday: "🎂 Birthday",
    bannerTextLabel: "Banner text",
    bannerDefault: "Happy Birthday!",
    bannerColorLabel: "Banner color",
    bannerAnimLabel: "Banner animation",
    anims: { float: "Float", pulse: "Pulse", spin: "Spin", none: "Still" },
    balloonsLabel: "Balloons",
    confettiLabel: "Confetti",
    themeWebNote:
      "Decorations show in the browser viewer (preview, WebXR, image tracking) — native iOS/Android model hand-off shows the model only.",
    audioLabel: "Soundtrack (optional)",
    audioHint: ".mp3 .m4a .wav, up to 50 MB",
    audioLoopLabel: "Loop the sound",
    audioRemove: "Remove sound",
    audioNote:
      "The sound starts when the visitor taps Start AR. Themed posters embed it inside iPhone AR itself; Android's native model viewer keeps playing it from the page.",
  },
  upload: {
    drop: "Drop a file or",
    browse: "browse",
    uploading: "Uploading…",
    unsupported: (ext: string, list: string) =>
      `"${ext}" isn’t supported here. Use: ${list}`,
    failed: "Upload failed. Try again.",
  },
  detail: {
    createdBanner: "✦ Experience created — scan the QR code below with your phone to test it.",
    openViewer: "Open viewer ↗",
    publish: "Publish",
    unpublish: "Unpublish",
    details: "Details",
    save: "Save changes",
    saving: "Saving…",
    saved: "Saved ✓",
    preview: "Preview",
    analytics: "Analytics",
    deleteExp: "Delete experience",
    confirmDelete: (t: string) => `Delete “${t}”? This can’t be undone.`,
    deleteFailed: "Delete failed",
    saveFailed: "Save failed",
    testOnPhone: "Test on phone",
    scanHint: "Scan with your phone camera to open the AR viewer.",
    draftNote:
      "This experience is a draft — the link works for testing, but consider publishing before sharing the QR publicly.",
    networkNote:
      "Phones must be able to reach this address. When running locally, open the studio via your computer’s network IP (e.g.",
    networkNoteEnd: ") so the QR works on your phone.",
    localhostWarning:
      "This QR points to localhost — another phone cannot open it, and camera/AR requires HTTPS. Deploy the app (e.g. Vercel) or use a tunnel, and set NEXT_PUBLIC_APP_URL to the public domain.",
    notFound: "Experience not found",
    backToDash: "Back to dashboard",
  },
  qr: { copyLink: "Copy link", copied: "Copied ✓", copyPrompt: "Copy the AR link:" },
  analytics: {
    totalScans: "Total scans",
    lastViewed: "Last viewed",
    notScanned: "Not scanned yet",
    noScans: "No scans recorded yet — open the public link or scan the QR to see data here.",
    device: "Device",
    browser: "Browser",
    os: "OS",
    recent: "Recent scans",
    when: "When",
    referrer: "Referrer",
    devices: {
      phone: "phone",
      tablet: "tablet",
      desktop: "desktop",
      other: "other",
    } as Record<ViewEvent["device"], string>,
  },
  viewer: {
    startAR: "Start AR",
    open3D: "Open 3D preview",
    enterAR: "Enter AR",
    unsupportedMobile: "This browser can’t open full AR — you’ll get the interactive 3D preview.",
    iosNeedsUsdz:
      "iPhone/iPad AR needs a USDZ version of this model — showing the 3D preview instead.",
    desktopHint: "AR works best on a phone. Scan the QR below to open this on mobile.",
    inAppBrowser:
      "You’re inside an app’s built-in browser (WhatsApp/Instagram/etc.) — it blocks the camera and AR. Tap the ⋯ menu and choose “Open in browser” (Chrome or Safari), then try again.",
    androidNeedsArcore:
      "This Android device can’t start AR — it needs “Google Play Services for AR” (ARCore). Install it, then reopen this page:",
    androidArcoreLink: "Get ARCore from Google Play",
    noContentTitle: "This experience has no content yet",
    noContentBody: "Its creator hasn’t attached a model, image, video, or text. Check back soon.",
    notFoundTitle: "Experience not found",
    notFoundBody: "This AR link doesn’t exist anymore — it may have been deleted by its creator.",
    madeWith: "made with Holoform",
    unmute: "🔇 Unmute",
    mute: "🔊 Mute",
    loadErrorModel: "This 3D model couldn’t be loaded. Check the file is a valid .glb/.gltf.",
    loadErrorContent: "The content couldn’t be loaded. Check the file or the link.",
    viewerFailed: "The 3D viewer failed to load.",
    pointAtTarget: "Point your camera at the target image",
    cameraDenied:
      "Camera access was denied — allow the camera for this site in your browser settings, then reload.",
    trackerFailed: "The image tracker couldn’t start on this device.",
  },
};

export type Dict = typeof en;

const ar: Dict = {
  dir: "rtl",
  langName: "English",
  nav: { experiences: "التجارب", newShort: "جديد" },
  footer: "هولوفورم ستوديو — تجارب واقع معزّز من رمز QR.",
  types: {
    model: { label: "مجسّم ثلاثي الأبعاد", blurb: "ملف GLB / glTF يُثبَّت في الفضاء" },
    image: { label: "صورة / ملصق", blurb: "لوحة صورة عائمة" },
    video: { label: "فيديو", blurb: "شاشة فيديو عائمة" },
    text: { label: "نص ثلاثي الأبعاد", blurb: "نص بارز يمكنك تنسيقه" },
    tracked: { label: "تتبع صورة", blurb: "محتوى يلتصق بصورة مطبوعة حقيقية" },
  },
  templates: {
    packaging: {
      name: "تغليف المنتجات",
      tagline: "أضف الحياة إلى علبة أو ملصق",
      titleHint: "استعراض المنتج",
      descriptionHint: "امسح العبوة لاستكشاف المنتج بشكل ثلاثي الأبعاد.",
    },
    exhibition: {
      name: "معرض",
      tagline: "معروضات AR بجانب الحقيقية",
      titleHint: "مرافق المعرض",
      descriptionHint: "وجّه هاتفك نحو الجناح لترى القصة كاملة.",
    },
    "business-card": {
      name: "بطاقة أعمال",
      tagline: "بطاقة تعرّف بك في الواقع المعزّز",
      titleHint: "بطاقتي في الواقع المعزّز",
      descriptionHint: "امسح لتعرف من أنا — في مساحتك.",
    },
    poster: {
      name: "ملصق إعلاني",
      tagline: "ملصقات تخرج من الجدار",
      titleHint: "ملصق الحملة",
      descriptionHint: "الصورة الرئيسية تطفو في الغرفة.",
    },
    training: {
      name: "دليل تدريب",
      tagline: "اعرض الخطوات، لا ملف PDF",
      titleHint: "شرح عملي بالواقع المعزّز",
      descriptionHint: "شاهد الشرح في مكان عملك مباشرة.",
    },
  },
  status: { live: "منشور", draft: "مسودة" },
  dashboard: {
    kicker: "استوديو الإنشاء",
    headlinePre: "تجارب واقع معزّز تُفتح من",
    headlineAccent: "رمز QR",
    newExperience: "تجربة جديدة",
    statExperiences: "التجارب",
    statLive: "منشورة",
    statScans: "إجمالي المسحات",
    emptyTitle: "لا توجد تجارب بعد",
    emptyBody:
      "أنشئ أول تجربة واقع معزّز — اختر نوع المحتوى وأضف ملفك، وستحصل على رمز QR يفتحها في المتصفح.",
    emptyCta: "أنشئ تجربتك الأولى",
    localModeTitle: "وضع التطوير المحلي",
    localModeBody:
      "البيانات والملفات تُحفظ على هذا الجهاز فقط ولن تبقى عند النشر السحابي. اربط Supabase للإنتاج — راجع SETUP.md.",
  },
  card: {
    scans: "مسحة",
    viewed: (ago: string) => `آخر مشاهدة ${ago}`,
    never: "أبداً",
    justNow: "الآن",
    minutes: (n: number) => `منذ ${n} د`,
    hours: (n: number) => `منذ ${n} س`,
    days: (n: number) => `منذ ${n} يوم`,
  },
  wizard: {
    steps: ["النوع", "المحتوى", "النشر"],
    typeTitle: "ماذا يظهر في الواقع المعزّز؟",
    typeSub: "اختر نوع المحتوى — يمكنك إضافة المحتوى نفسه في الخطوة التالية.",
    orTemplate: "أو ابدأ من قالب جاهز",
    contentTitle: (type: string) => `أضف ${type}`,
    contentSub: "تتحدّث المعاينة الحية فور جاهزية المحتوى.",
    modelHint: "ملفات .glb أو .gltf، حتى 50 م.ب",
    useSample: "✦ استخدم النموذج المرفق",
    iosLabel: "iOS Quick Look (اختياري)",
    usdzHint: "ملف .usdz — يفعّل الواقع المعزّز الأصلي على آيفون/آيباد",
    usdzAttached: "تم إرفاق USDZ",
    imageHint: "صور .png .jpg .webp .gif، حتى 50 م.ب",
    videoHint: "فيديو .mp4 .webm .mov، حتى 50 م.ب",
    orLinkVideo: "…أو ضع رابط فيديو مستضاف",
    useLink: "استخدام",
    linkedVideo: "فيديو مرتبط",
    linkHint: "الروابط المباشرة .mp4/.webm هي الأفضل (يجب أن يسمح المضيف بالوصول عبر النطاقات).",
    yourText: "النص",
    textPlaceholder: "مرحباً بالعالم",
    color: "اللون",
    finish: "التشطيب",
    finishes: { metal: "معدني", matte: "مطفي", neon: "نيون" },
    back: "رجوع",
    continue: "متابعة",
    addToContinue: "أضف محتوى للمتابعة",
    publishTitle: "التفاصيل والنشر",
    titleLabel: "العنوان",
    titlePlaceholder: "مثال: إطلاق الربيع — المنتج الرئيسي",
    descLabel: "الوصف",
    descPlaceholder: "يظهر للمشاهدين على شاشة البداية.",
    thumbLabel: "صورة مصغّرة (اختياري)",
    thumbHint: "تظهر على بطاقة لوحة التحكم",
    thumbSet: "تم تعيين الصورة",
    publishNow: "نشر فوراً",
    publishNote: "— يصبح رمز QR فعّالاً مباشرة",
    create: "إنشاء التجربة",
    creating: "جارٍ الإنشاء…",
    saveFailed: "تعذّر حفظ التجربة.",
    livePreview: "معاينة حية",
    orbitHint: "اسحب للتدوير · قرّب بإصبعين أو بعجلة الفأرة",
    previewEmptyText: "اكتب شيئاً لرؤيته بشكل ثلاثي الأبعاد",
    previewEmpty: "أضف محتوى لرؤية المعاينة الحية",
    targetLabel: "الصورة المستهدفة — ما ستبحث عنه الكاميرا",
    targetHint: "صور .png .jpg بجودة طباعة",
    targetQualityHint:
      "استخدم صورة غنية بالتفاصيل والتباين (صور فوتوغرافية، أعمال فنية، تصاميم مزدحمة). الشعارات البسيطة على خلفيات سادة يضعف تتبعها.",
    compiling: (pct: number) => `جارٍ تحليل ملامح الصورة… ${pct}%`,
    compileFailed: "فشل تحليل الصورة — جرّب صورة أكثر تفصيلاً.",
    targetReady: "تم تجهيز الصورة المستهدفة ✓",
    overlayLabel: "ما الذي يظهر فوق الصورة",
    overlayModel: "مجسّم ثلاثي الأبعاد",
    overlayVideo: "فيديو",
    overlayImage: "صورة",
    sceneLabel: "الثيم والزينة",
    themeNone: "بدون",
    themeBirthday: "🎂 عيد ميلاد",
    bannerTextLabel: "نص البانر",
    bannerDefault: "عيد ميلاد سعيد!",
    bannerColorLabel: "لون البانر",
    bannerAnimLabel: "حركة البانر",
    anims: { float: "عائم", pulse: "نابض", spin: "دوّار", none: "ثابت" },
    balloonsLabel: "بالونات",
    confettiLabel: "قصاصات ملونة",
    themeWebNote:
      "الزينة تظهر في عارض المتصفح (المعاينة، WebXR، تتبع الصور) — العارض الأصلي للمجسّمات على iOS/أندرويد يعرض المجسّم فقط.",
    audioLabel: "صوت مصاحب (اختياري)",
    audioHint: "ملفات .mp3 .m4a .wav، حتى 50 م.ب",
    audioLoopLabel: "تكرار الصوت",
    audioRemove: "إزالة الصوت",
    audioNote:
      "يبدأ الصوت عندما يضغط الزائر «ابدأ الواقع المعزّز». في الملصقات المزخرفة يُدمج الصوت داخل تجربة آيفون نفسها، وعلى أندرويد يستمر تشغيله من صفحة المتصفح.",
  },
  upload: {
    drop: "أسقط ملفاً أو",
    browse: "تصفّح",
    uploading: "جارٍ الرفع…",
    unsupported: (ext: string, list: string) => `"${ext}" غير مدعوم هنا. المسموح: ${list}`,
    failed: "فشل الرفع. حاول مجدداً.",
  },
  detail: {
    createdBanner: "✦ تم إنشاء التجربة — امسح رمز QR أدناه بكاميرا هاتفك لتجربتها.",
    openViewer: "فتح العارض ↗",
    publish: "نشر",
    unpublish: "إلغاء النشر",
    details: "التفاصيل",
    save: "حفظ التغييرات",
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ ✓",
    preview: "معاينة",
    analytics: "التحليلات",
    deleteExp: "حذف التجربة",
    confirmDelete: (t: string) => `حذف «${t}»؟ لا يمكن التراجع عن هذا.`,
    deleteFailed: "فشل الحذف",
    saveFailed: "فشل الحفظ",
    testOnPhone: "جرّب على الهاتف",
    scanHint: "امسح بكاميرا هاتفك لفتح عارض الواقع المعزّز.",
    draftNote:
      "هذه التجربة مسودة — الرابط يعمل للتجربة، لكن يُفضّل نشرها قبل مشاركة رمز QR علناً.",
    networkNote:
      "يجب أن تصل الهواتف إلى هذا العنوان. عند التشغيل محلياً، افتح الاستوديو عبر عنوان IP لجهازك على الشبكة (مثل",
    networkNoteEnd: ") ليعمل الرمز على هاتفك.",
    localhostWarning:
      "رمز QR هذا يشير إلى localhost — لا يمكن لهاتف آخر فتحه، والكاميرا/الواقع المعزّز يتطلبان HTTPS. انشر التطبيق (مثلاً على Vercel) أو استخدم نفقاً، وعيّن NEXT_PUBLIC_APP_URL على النطاق العام.",
    notFound: "التجربة غير موجودة",
    backToDash: "العودة إلى اللوحة",
  },
  qr: { copyLink: "نسخ الرابط", copied: "تم النسخ ✓", copyPrompt: "انسخ رابط الواقع المعزّز:" },
  analytics: {
    totalScans: "إجمالي المسحات",
    lastViewed: "آخر مشاهدة",
    notScanned: "لم تُمسح بعد",
    noScans: "لا توجد مسحات مسجلة بعد — افتح الرابط العام أو امسح الرمز لرؤية البيانات هنا.",
    device: "الجهاز",
    browser: "المتصفح",
    os: "النظام",
    recent: "آخر المسحات",
    when: "الوقت",
    referrer: "المصدر",
    devices: { phone: "هاتف", tablet: "جهاز لوحي", desktop: "حاسوب", other: "أخرى" },
  },
  viewer: {
    startAR: "ابدأ الواقع المعزّز",
    open3D: "افتح المعاينة ثلاثية الأبعاد",
    enterAR: "دخول الواقع المعزّز",
    unsupportedMobile:
      "هذا المتصفح لا يدعم الواقع المعزّز الكامل — ستحصل على معاينة ثلاثية الأبعاد تفاعلية.",
    iosNeedsUsdz:
      "يتطلب الواقع المعزّز على آيفون/آيباد نسخة USDZ من هذا المجسّم — سنعرض المعاينة ثلاثية الأبعاد بدلاً منه.",
    desktopHint: "يعمل الواقع المعزّز بشكل أفضل على الهاتف. امسح رمز QR أدناه لفتحه على جوالك.",
    inAppBrowser:
      "أنت داخل متصفح مدمج في تطبيق (واتساب/إنستغرام/غيره) — وهو يمنع الكاميرا والواقع المعزّز. اضغط قائمة ⋯ واختر «فتح في المتصفح» (كروم أو سفاري) ثم جرّب مجدداً.",
    androidNeedsArcore:
      "جهاز أندرويد هذا لا يستطيع بدء الواقع المعزّز — يحتاج خدمة «Google Play Services for AR» ‏(ARCore). ثبّتها ثم أعد فتح الصفحة:",
    androidArcoreLink: "تحميل ARCore من Google Play",
    noContentTitle: "لا يوجد محتوى في هذه التجربة بعد",
    noContentBody: "لم يُرفق منشئها مجسّماً أو صورة أو فيديو أو نصاً. عُد لاحقاً.",
    notFoundTitle: "التجربة غير موجودة",
    notFoundBody: "رابط الواقع المعزّز هذا لم يعد موجوداً — ربما حذفه منشئه.",
    madeWith: "صُنع بواسطة Holoform",
    unmute: "🔇 تشغيل الصوت",
    mute: "🔊 كتم",
    loadErrorModel: "تعذّر تحميل هذا المجسّم. تأكد أن الملف بصيغة .glb/.gltf صالحة.",
    loadErrorContent: "تعذّر تحميل المحتوى. تحقق من الملف أو الرابط.",
    viewerFailed: "تعذّر تحميل العارض ثلاثي الأبعاد.",
    pointAtTarget: "وجّه الكاميرا نحو الصورة المستهدفة",
    cameraDenied:
      "تم رفض إذن الكاميرا — اسمح بالكاميرا لهذا الموقع من إعدادات المتصفح ثم أعد تحميل الصفحة.",
    trackerFailed: "تعذّر تشغيل متتبع الصور على هذا الجهاز.",
  },
};

const DICTS: Record<Locale, Dict> = { en, ar };

/* ----------------------------------- hook -------------------------------- */

export function useI18n() {
  const current = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.get,
    localeStore.getServer
  );

  // Keep <html lang/dir> in sync so RTL layout & fonts apply document-wide
  useEffect(() => {
    document.documentElement.lang = current;
    document.documentElement.dir = DICTS[current].dir;
  }, [current]);

  return {
    locale: current,
    t: DICTS[current],
    dir: DICTS[current].dir,
    toggleLocale: () => localeStore.set(current === "en" ? "ar" : "en"),
  };
}

/** Relative "time ago" label in the active locale. */
export function timeAgo(t: Dict, iso: string | null): string {
  if (!iso) return t.card.never;
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return t.card.justNow;
  if (s < 3600) return t.card.minutes(Math.floor(s / 60));
  if (s < 86400) return t.card.hours(Math.floor(s / 3600));
  return t.card.days(Math.floor(s / 86400));
}
