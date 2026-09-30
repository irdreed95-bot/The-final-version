# Stream Hub 2.0

إعادة بناء كاملة لتطبيق المشاهدة من الصفر.

- بيانات الأفلام والمسلسلات من TMDB.
- التشغيل منفصل عن الكتالوج عبر VITE_AUTHORIZED_PLAYBACK_CATALOG_URL.
- لا يوجد استخراج روابط من مواقع طرف ثالث ولا تجاوز DRM أو أنظمة الحماية.
- قسم الأخبار يقرأ قوائم Free-TV/IPTV العامة للأخبار فقط.
- HLS عبر hls.js مع دعم MP4.
- Supabase يمكن ربطه لاحقاً للمصادقة والملف الشخصي.

## البيئة
انسخ .env.example إلى .env.local وأضف مفاتيحك.

## تشغيل
npm install
npm run build
npm run dev

## صيغة مصدر التشغيل
يجب أن يعيد endpoint:
{"sources":[{"url":"https://example.com/video.m3u8","label":"1080p","kind":"hls","proxiedUrl":"https://example.com/video.m3u8"}]}

استخدم فقط مصادر تملك حق تشغيلها أو لديك ترخيص لاستخدامها.