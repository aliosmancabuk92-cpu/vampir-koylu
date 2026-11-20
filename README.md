# Vampir Köylü — Mobil (Android)

Herkes kendi telefonundan oynar; oda açan telefon **anlatıcı** olur ve sesli konuşur.
Bağlantı Supabase Realtime üzerinden (Wi-Fi veya mobil veri; internet gerekir).

## Modlar
- **Tek Oyna**: botlara karşı, 5 bölüm / 30 seviye, yıldız + XP + rütbe, serbest oyun, istatistik. İnternet gerekmez; ilerleme telefonda saklanır.
- **Arkadaşlarla Oyna**: Supabase Realtime ile odalı çok oyunculu. Oda en fazla 16 kişi; kaç arkadaş gelirse gelsin oda sahibi istediği kadar bot ekleyebilir (cinsiyet ve kolay/orta/zor seviye seçilebilir, "8/12/16'ya tamamla"). Arkadaş katılınca oda doluysa bir botun yerine geçer.

## Oyun akışı (v5 "köy hayatı")
- **İlk gece kimse ölmez**: vampir kümese iner; sabah ilk ipuçları çıkar. Sonraki gecelerde herkes telefonundan bir seçim yapar (vampir: ısır + isteğe bağlı sahte iz; hoca: koru; kâhin: bak; bekçi: gözetle; köylü: pencereden gözetle ya da yat).
- **Sabah ipuçları**: her ipucu 2-3 evi gösterir; gerçek, boş ya da vampirin bıraktığı sahte iz olabilir. Günde bir ipucu incelenebilir (%75 doğru).
- **Köy olayları** (2. günden itibaren): sis, fırtına, dolunay, pazar, düğün.
- **Meydan → seçim → savunma → kilitli oy → infaz**; oylar eşitse söz düellosu. Tekrarlayan sahneler kısalır; her sahne hızlandırılabilir/geçilebilir.
- **Hayaletler**: ölenler domates atar, kapı tıkırdatır, bahse girer, bir kez fısıldar.
- **Odalarda** süreler kendiliğinden işler (çoğunluk sahneyi izleyince devam), tepki düğmeleri vardır, bağlantısı kopanın yerine bot oynar.
- **Oyun sonu**: ödüller, gün gün özet, paylaşılabilir sonuç kartı (PNG).
- Kurallar tek yerde: `src/rules.js` (roller, gece çözümü, ipuçları, olaylar, ödüller) — tek oyunculu motor ve oda sunucusu aynı kuralları kullanır.

## 3B sürüm (sinematik köy)
- `src/world/world.js` — three.js köy dünyası: gökyüzü ve ışık evreleri (gündüz/akşam/gece/şafak/kıyamet/bayram), Anadolu evleri, meydan, çeşme, dar ağacı, kazıklar, meşaleler, ağaçlar, parçacıklar, kamera yönetmeni, etiketler, kalite ayarı
- `src/world/houses.js` — prosedürel Anadolu evleri (taş damlı, cumbalı konak, kerpiç, iki katlı, ahırlı…)
- `src/world/people.js` — gerçek oranlı köylüler (gövde + köylü kıyafeti + bıyık/kasket/takke/kalpak), yürüme, baş çevirme, asılma/kazık pozları
- `src/world/director.js` — oyun olaylarını 3B sahnelere çeviren yönetmen (toplanma, eve dağılma, kapı kırma baskını, savunma çekimleri, darağacı, arkadan tekme, yüzüstü kazık, gece baskını, vampir kovalamacası, köy şenliği/halay)
- `src/scenes.js` — tek oyunculu ve odalı modun ortak sahne senaryoları (kapı baskını varyantları, infaz, kazık, final sahneleri)
- `src/bots.js` — odalı modda botların beyni (şüphe haritası, konuşma, savunma, oy, gece hamlesi; kolay/orta/zor)
- `src/world/animals.js` — prosedürel tavuklar (eşelenme, kaçışma, kanat çırpma)
- `src/world/hands.json` — parmak pozları (gevşek, yumruk, işaret, açık, kavrama)
- `src/stage3d.js` / `src/stage-prefs.js` — 3B katman (tembel yüklenir) ve tercihler (3B/2B, kalite)
- `src/voice.js` — önceden kaydedilmiş replikleri karakter ses rengiyle çalar; kayıt yoksa cihaz sesine düşer
- `tools/voice-collect.mjs` → (Chatterbox, `/home/claude/tts/gen_batch.py`) → `tools/voice-install.py` → `tools/voice-female.sh` — tüm replikleri topla, doğal Türkçe sesle seslendir, oyuna kur, kadın sesini türet (eski yol: `tools/voice-gen.py` Piper)
- `tools/mocap/build_clips.py` — CMU hareket verisini iskeletimize aktarıp `www/assets/3d/anim/mocap.glb` + `mocap_meta.json` üretir (57 klip)
- `tools/music-synth.py` — özgün şenlik havası ve kovalamaca müziğini tamamen kodla sentezler (`www/assets/sfx/music_*.mp3`)
- `tools/voice-fx.mjs` → `tools/voice-fx.json` — vampir/tok/tiz gibi özel ses renklerini satır bazında işaretler; `voice-install.py` bunları ffmpeg ile uygular

Sesleri yeniden üretmek (replik eklenince):
```bash
node tools/voice-collect.mjs && node tools/voice-fx.mjs
# Chatterbox ile eksik satırları üret (/home/claude/tts/tts_loop.sh tools/voice-lines.json out ref_villager.wav)
python3 tools/voice-install.py && tools/voice-female.sh
```

## Klasörler
- `index.html`  — giriş, çok oyunculu mod, ses
- `src/rules.js` — ortak kurallar (roller, gece çözümü, ipuçları, köy olayları, ödüller)
- `src/solo-engine.js` — tek oyunculu motor (bot zekâsı, şüphe modeli, seviyeler)
- `src/solo-ui.js` — tek oyunculu arayüz (harita, oyun ekranları, kayıt)
- `src/multi.js` — odalı mod: host mantığı + köy sahneli ekranlar
- `src/bots.js` — odalardaki botların zekâsı (hafıza, husumet/ahbaplık, ipucu okuma)
- `src/ui-bits.js` — iki modun ortak arayüz parçaları (ipucu kartları, hayalet paneli, ödüller, paylaşım kartı)
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
node test/sim.mjs 300     # her seviye 300 oyun: denge raporu (motor)
node test/mp-sim.mjs 400  # oda sunucusu stres testi (botlar, kopan oyuncu, hayaletler, tepkiler)
node test/app3d.mjs 1 low # tek oyunculu tam akış, 3B + ekran görüntüleri (GHOST=1: hayalet modu)
node test/mp3d.mjs        # odalı mod, 4 tarayıcı: ilk gece, ipucu, asma, hayalet, rövanş
```

## Roller
Köylü, Vampir (4-7 kişi: 1, 8-10: 2, 11+: 3), Hoca (koruyucu), Kâhin. 8 kişiden itibaren Bekçi ve Deli; 11 kişiden itibaren Ağa, Dedikoducu ve iki Âşık. En az 4 oyuncu. Yeni roller ve köy olayları lobiden kapatılabilir.

## Lisanslar (3B ve ses)
- Karakterler ve animasyonlar: Quaternius (CC0) — Universal Animation Library, Superhero gövdeleri, köylü kıyafetleri
- Dokular ve sahne objeleri: Poly Haven (CC0)
- Seslendirme: Chatterbox Multilingual (MIT). Referans tını Piper `tr_TR-dfki-medium` (**CC BY-NC-SA**) çıktısından alındı; mağaza yayınından önce kendi kaydımızla yeniden üretilmeli.
- Gerçek insan hareketleri: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu, NSF EIA-0196217) — ticari kullanıma açık, veri ayrıca satılamaz.
