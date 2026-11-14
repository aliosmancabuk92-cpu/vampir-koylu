#!/bin/bash
# Claude önizleme kopyası: GLB → base64 JSON, servis çalışanı/manifest yok, Supabase sahte modül
set -e
SRC=/home/claude/vampir-koylu/www; OUT=${1:-/home/claude/art3d-v3}
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r "$SRC/assets" "$SRC/chunks" "$SRC/icons" "$SRC/solo.js" "$SRC/multi.js" "$OUT/"
cp /home/claude/vampir-koylu/artifact/supabase.js "$OUT/supabase.js"
find "$OUT/assets" -name "*.glb" | while read f; do python3 -c "
import base64,json,sys; d=open(sys.argv[1],'rb').read(); json.dump({'b':base64.b64encode(d).decode()},open(sys.argv[1][:-4]+'.json','w'))" "$f"; rm "$f"; done
rm -f "$OUT/assets/voice/.cb.json"
python3 - "$SRC/index.html" "$OUT/index.html" <<'PY'
import sys
s=open(sys.argv[1]).read()
s=s.replace('<link rel="manifest" href="manifest.webmanifest">','')
shim='''<script>
window.VK_GLB_EXT='.json';
/* Önizleme ortamı: tarayıcı depolaması kapalıysa bellek içi yedek */
(function(){ try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); }catch(e){ var m={}; var mem={getItem:function(k){return k in m?m[k]:null;},setItem:function(k,v){m[k]=String(v);},removeItem:function(k){delete m[k];},clear:function(){m={};},key:function(i){return Object.keys(m)[i]||null;},get length(){return Object.keys(m).length;}}; try{ Object.defineProperty(window,'localStorage',{value:mem,configurable:true}); }catch(_){ } } })();
</script>'''
s=s.replace('</head>',shim+'\n</head>',1)
open(sys.argv[2],'w').write(s)
PY
echo "dosya: $(find "$OUT" -type f | wc -l)  boyut: $(du -sh "$OUT" | cut -f1)"
