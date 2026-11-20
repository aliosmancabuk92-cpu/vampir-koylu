#!/bin/bash
# Claude önizleme kopyası: GLB → base64 JSON, servis çalışanı/manifest yok, Supabase sahte modül
set -e
SRC=/home/claude/vampir-koylu/www; OUT=${1:-/home/claude/art3d-v3}
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r "$SRC/assets" "$SRC/chunks" "$SRC/icons" "$SRC/solo.js" "$SRC/multi.js" "$OUT/"
cp /home/claude/vampir-koylu/artifact/supabase.js "$OUT/supabase.js"
find "$OUT/assets" -name "*.glb" | while read f; do python3 -c "
import base64,json,sys; d=open(sys.argv[1],'rb').read(); json.dump({'b':base64.b64encode(d).decode()},open(sys.argv[1][:-4]+'.json','w'))" "$f"; rm "$f"; done
rm -f "$OUT/assets/voice/.cb.json"; rm -rf "$OUT/assets/voice/f"  # önizlemede kadın sesi erkek kaydından türetilir (dosya sınırı)
# Önizleme en çok 512 dosya tutar: simgeler ve yalnızca odalarda duyulan/az geçen birkaç replik çıkarılır
# (çıkarılan replikler önizlemede cihazın kendi sesiyle okunur; APK ve web sürümünde hepsi kayıtlıdır)
rm -rf "$OUT/icons"
python3 - "$OUT/assets/voice" <<'PY'
import json,os,sys
d=sys.argv[1]; drop=['00fd80c2','bc47a70b','67eab164','aa63905c','608ab18e','d14ff146','df71fb09','97dd5bd3']
m=json.load(open(d+'/index.json'))
for k in drop:
    m.pop(k,None)
    try: os.remove(f'{d}/{k}.mp3')
    except FileNotFoundError: pass
json.dump(m,open(d+'/index.json','w'),separators=(',',':'))
PY
python3 - "$SRC/index.html" "$OUT/index.html" <<'PY'
import sys
s=open(sys.argv[1]).read()
s=s.replace('<link rel="manifest" href="manifest.webmanifest">','')
shim='''<script>
window.VK_GLB_EXT='.json'; window.VK_NO_FEM=1;
/* Önizleme ortamı: tarayıcı depolaması kapalıysa bellek içi yedek */
(function(){ try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); }catch(e){ var m={}; var mem={getItem:function(k){return k in m?m[k]:null;},setItem:function(k,v){m[k]=String(v);},removeItem:function(k){delete m[k];},clear:function(){m={};},key:function(i){return Object.keys(m)[i]||null;},get length(){return Object.keys(m).length;}}; try{ Object.defineProperty(window,'localStorage',{value:mem,configurable:true}); }catch(_){ } } })();
</script>'''
s=s.replace('</head>',shim+'\n</head>',1)
open(sys.argv[2],'w').write(s)
PY
echo "dosya: $(find "$OUT" -type f | wc -l)  boyut: $(du -sh "$OUT" | cut -f1)"
