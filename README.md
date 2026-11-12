# Vampir Köylü — Mobil (Android)

Herkes kendi telefonundan oynar; oda açan telefon **anlatıcı** olur ve sesli konuşur.
Bağlantı Supabase Realtime üzerinden (Wi-Fi veya mobil veri; internet gerekir).

## Modlar
- **Tek Oyna**: botlara karşı, 4 bölüm / 24 seviye, yıldız + XP + rütbe, serbest oyun, istatistik. İnternet gerekmez; ilerleme telefonda saklanır.
- **Arkadaşlarla Oyna**: Supabase Realtime ile odalı çok oyunculu.

## Klasörler
- `index.html`  — giriş, çok oyunculu mod, ses
- `src/solo-engine.js` — tek oyunculu motor (bot zekâsı, şüphe modeli, seviyeler)
- `src/solo-ui.js` — tek oyunculu arayüz (harita, oyun ekranları, kayıt)
- `www/`        — APK'ya giren kopya (`index.html` + `supabase.js`)
- `android/`    — Capacitor Android projesi
- `test/`       — headless Chrome ile 4 oyunculu otomatik testler

## Değişiklik sonrası APK üretme
```bash
npm install
npx esbuild src/sb-entry.js --bundle --format=esm --minify --outfile=www/supabase.js
npx esbuild src/solo-ui.js --bundle --format=esm --minify --outfile=www/solo.js
cp index.html www/index.html
npx cap sync android
cd android && ./gradlew assembleDebug      # çıktı: android/app/build/outputs/apk/debug/app-debug.apk
```
Gereksinimler: Node 18+, JDK 17/21, Android SDK (platform 35, build-tools 35).
Android Studio ile `android/` klasörünü açıp **Build > Build APK** de yapılabilir.

## Testler
```bash
node test/sim.mjs 300  # her seviye 300 oyun: denge raporu
node test/solo-e2e.mjs # tek oyunculu tam akış (headless Chrome)
node test/e2e.mjs    # çok oyunculu tam tur: köylüler kazanır
node test/e2e2.mjs   # doktor kurtarır, berabere oy, vampirler kazanır
```

## Roller
Köylü, Vampir (4-7 kişi: 1, 8-11: 2, 12+: 3), Doktor, Kâhin. En az 4 oyuncu.
