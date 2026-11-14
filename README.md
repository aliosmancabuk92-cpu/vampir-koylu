# Vampir Köylü — Mobil (Android)

Herkes kendi telefonundan oynar; oda açan telefon **anlatıcı** olur ve sesli konuşur.
Bağlantı Supabase Realtime üzerinden (Wi-Fi veya mobil veri; internet gerekir).

## Modlar
- **Tek Oyna**: botlara karşı, 4 bölüm / 24 seviye, yıldız + XP + rütbe, serbest oyun, istatistik. İnternet gerekmez; ilerleme telefonda saklanır.
- **Arkadaşlarla Oyna**: Supabase Realtime ile odalı çok oyunculu.

## 3B sürüm (sinematik köy)
- `src/world/world.js` — three.js köy dünyası: gökyüzü ve ışık evreleri (gündüz/akşam/gece/şafak/kıyamet/bayram), Anadolu evleri, meydan, çeşme, dar ağacı, kazıklar, meşaleler, ağaçlar, parçacıklar, kamera yönetmeni, etiketler, kalite ayarı
- `src/world/houses.js` — prosedürel Anadolu evleri (taş damlı, cumbalı konak, kerpiç, iki katlı, ahırlı…)
- `src/world/people.js` — gerçek oranlı köylüler (gövde + köylü kıyafeti + bıyık/kasket/takke/kalpak), yürüme, baş çevirme, asılma/kazık pozları
- `src/world/director.js` — oyun olaylarını 3B sahnelere çeviren yönetmen (toplanma, eve dağılma, evden sürükleme, savunma çekimleri, asma, tekme, kazık, gece baskını, köy hafızası)
- `src/stage3d.js` / `src/stage-prefs.js` — 3B katman (tembel yüklenir) ve tercihler (3B/2B, kalite)
- `src/voice.js` — önceden kaydedilmiş replikleri karakter ses rengiyle çalar; kayıt yoksa cihaz sesine düşer
- `tools/voice-collect.mjs` → (Chatterbox, `/home/claude/tts/gen_batch.py`) → `tools/voice-install.py` → `tools/voice-female.sh` — tüm replikleri topla, doğal Türkçe sesle seslendir, oyuna kur, kadın sesini türet (eski yol: `tools/voice-gen.py` Piper)
- `/home/claude/mocap/build_clips.py` — CMU hareket verisini iskeletimize aktarıp `www/assets/3d/anim/mocap.glb` + `mocap_meta.json` üretir

Sesleri yeniden üretmek (replik eklenince):
```bash
node tools/voice-collect.mjs && python3 tools/voice-gen.py && tools/voice-female.sh
```

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
./build.sh                                   # solo.js + multi.js + chunks/ (three.js ayrı parçada)
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

## Lisanslar (3B ve ses)
- Karakterler ve animasyonlar: Quaternius (CC0) — Universal Animation Library, Superhero gövdeleri, köylü kıyafetleri
- Dokular ve sahne objeleri: Poly Haven (CC0)
- Seslendirme: Chatterbox Multilingual (MIT). Referans tını Piper `tr_TR-dfki-medium` (**CC BY-NC-SA**) çıktısından alındı; mağaza yayınından önce kendi kaydımızla yeniden üretilmeli.
- Gerçek insan hareketleri: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu, NSF EIA-0196217) — ticari kullanıma açık, veri ayrıca satılamaz.
