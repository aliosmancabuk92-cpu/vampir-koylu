# Gerçek hareket (mocap) hattı
1. CMU kayıtlarını indir: `amc/<denek>.asf` ve `amc/<hareket>.amc` (http://mocap.cs.cmu.edu), `list.txt` (hareket listesi).
2. `python3 build_clips.py` → `www/assets/3d/anim/mocap.glb` (iskeletimize aktarılmış klipler, 16-bit dönüşler) + `mocap_meta.json` (kök yörüngesi, vuruş zamanları/konumları).
3. Kontrol sayfası: `python3 inspect_sheet.py 18_03,19_03 cikti.png` (iki kişilik klipte ikisi birlikte).
Veri: "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." (ticari kullanım serbest, verinin kendisi satılamaz)
