/* Ses dosyası anahtarı: metnin normalleştirilmiş hâlinin FNV-1a 32 bit özeti (tarayıcı ile aynı) */
export function normVoice(t){ return String(t||'').normalize('NFC').replace(/\s+/g,' ').trim(); }
export function voiceKey(t){ const s=normVoice(t); let h=0x811c9dc5; const b=new TextEncoder().encode(s); for(const x of b){ h^=x; h=Math.imul(h,0x01000193)>>>0; } return h.toString(16).padStart(8,'0'); }
