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
- `src/multi.js` — odalı mod: host mantığı + köy sahneli ekranlar
- `src/village.js` — köy sahnesi (evler, meydan, dar ağacı, kazık, figürler)
- `src/scene.js` — sahne oynatıcı (olay sırası, baloncuk, sesli okuma)
- `src/sfx.js` — sentezlenmiş ses efektleri (telifsiz)
- `src/lines.js` — şiveli replik havuzu (sert mod / yumuşak mod)
- `www/`        — APK'ya giren kopya (`index.html` + `supabase.js`)
- `android/`    — Capacitor Android projesi
- `test/`       — headless Chrome ile 4 oyunculu otomatik testler

## Değişiklik sonrası APK üretme
```bash
npm install
npx esbuild src/sb-entry.js --bundle --format=esm --minify --outfile=www/supabase.js
npx esbuild src/solo-ui.js --bundle --format=esm --minify --outfile=www/solo.js
npx esbuild src/multi.js --bundle --format=esm --minify --outfile=www/multi.js
cp index.html www/index.html
npx cap sync android
cd android && ./gradlew assembleDebug      # çıktı: android/app/build/outputs/apk/debug/app-debug.apk
```
Gereksinimler: Node 18+, JDK 17/21, Android SDK (platform 35, build-tools 35).
Android Studio ile `android/` klasörünü açıp **Build > Build APK** de yapılabilir.

## Testler
```bash
node test/sim.mjs 300  # her seviye 300 oyun: denge raporu
node test/village-shots.mjs  # tek oyunculu tam akış + ekran görüntüleri
node test/mp-e2e.mjs        # odalı mod, 4 oyuncu: bırakma, gece, kazık, yeni oyun
```

## Roller
Köylü, Vampir (4-7 kişi: 1, 8-11: 2, 12+: 3), Doktor, Kâhin. En az 4 oyuncu.
