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
    modelHint: ".glb or .gltf, up to 60 MB",
    useSample: "✦ Use the bundled sample model",
    iosLabel: "iOS Quick Look (optional)",
    usdzHint: ".usdz — enables native AR on iPhone/iPad",
    usdzAttached: "USDZ attached",
    imageHint: ".png .jpg .webp .gif, up to 60 MB",
    videoHint: ".mp4 .webm .mov, up to 60 MB",
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
    modelHint: "ملفات .glb أو .gltf، حتى 60 م.ب",
    useSample: "✦ استخدم النموذج المرفق",
    iosLabel: "iOS Quick Look (اختياري)",
    usdzHint: "ملف .usdz — يفعّل الواقع المعزّز الأصلي على آيفون/آيباد",
    usdzAttached: "تم إرفاق USDZ",
    imageHint: "صور .png .jpg .webp .gif، حتى 60 م.ب",
    videoHint: "فيديو .mp4 .webm .mov، حتى 60 م.ب",
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
