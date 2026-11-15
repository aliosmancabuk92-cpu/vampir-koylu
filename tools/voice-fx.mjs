// Özel ses rengi gereken replikler → tools/voice-fx.json { anahtar: 'vamp'|'tok'|'tiz' }
import fs from 'fs';
import * as LN from '../src/lines.js';
import { voiceKey, normVoice } from '../src/voice-key.js';
const texts=(v,out=[])=>{ if(typeof v==='string') out.push(v); else if(Array.isArray(v)) v.forEach(x=>texts(x,out)); else if(v&&typeof v==='object'){ if('h' in v&&'s' in v) out.push(v.h,v.s); else Object.values(v).forEach(x=>texts(x,out)); } return out; };
const map={};
const set=(pools,fx)=>{ for(const t of texts(pools)) map[voiceKey(normVoice(t))]=fx; };
set([LN.END_CHASE.vamp1,LN.END_CHASE.vamp2,LN.END_CHASE.after,LN.STAKE_BUTT.beg,LN.KICK_BUTT.vamp,LN.VAMPIRE_HANGED_LINES,LN.END_VAMP_SOLO,LN.END_VAMP_MULTI],'vamp');
set([LN.END_PARTY.nufus],'tok'); set([LN.END_PARTY.artir],'tiz');
fs.writeFileSync(new URL('./voice-fx.json',import.meta.url),JSON.stringify(map));
console.log('özel ses rengi:',Object.keys(map).length);
