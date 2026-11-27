# بوت تحميل فيديوهات - ديسكورد (Node.js)

يدعم: تيك توك، إنستغرام، تويتر/X، بنترست، يوتيوب (فيديو أو صوت MP3)

## الملفات
- index.js      : تشغيل البوت وأمر /download
- downloader.js : منطق التحميل (yt-dlp)
- config.js     : الإعدادات
- package.json, Dockerfile, .env.example

## المتطلبات
- Node.js 18 أو أحدث
- yt-dlp  (https://github.com/yt-dlp/yt-dlp/releases)  لازم يكون بالـ PATH
- ffmpeg

## الإعداد
1. discord.com/developers/applications -> New Application -> Bot -> Reset Token (انسخ التوكن).
2. OAuth2 -> URL Generator: scopes `bot` و `applications.commands`،
   صلاحيات: Send Messages + Attach Files. ضيف البوت لسيرفرك.
3. انسخ `.env.example` إلى `.env` وحط التوكن.
4. شغّل:
   npm install
   npm start

## الاستضافة
- Docker (Railway / Render / VPS): الـ Dockerfile جاهز وفيه yt-dlp و ffmpeg.
  حط DISCORD_TOKEN في Environment Variables.
- VPS عادي: ثبّت node و ffmpeg و yt-dlp ثم شغّله بـ pm2:
  pm2 start index.js --name dl-bot
- استضافات بانل (Pterodactyl): ارفع الملفات، أمر التشغيل `node index.js`،
  وتأكد ان yt-dlp و ffmpeg متوفرين (أو حط مسار yt-dlp في YTDLP_PATH).

## ملاحظات
- حد رفع ديسكورد 10MB للسيرفرات العادية (50MB بوست مستوى 2، 100MB مستوى 3). عدّل MAX_UPLOAD_MB.
- البوت يقلل الجودة تلقائياً لين يدخل تحت الحد.
- إنستغرام/يوتيوب أحياناً يطلبون تسجيل دخول: صدّر كوكيز بصيغة Netscape وحط COOKIES_FILE.
- حدّث yt-dlp دورياً (yt-dlp -U) لأن المواقع تغيّر نظامها.
- تيك توك يتحمّل بدون علامة مائية افتراضياً عبر yt-dlp.
- حمّل فقط محتوى مسموح لك تحمّله والتزم بشروط المنصات وحقوق الملكية.
