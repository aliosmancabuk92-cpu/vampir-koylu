/* =====================================================================
   REPLİK HAVUZU — Sivas/İç Anadolu şivesi, "sert mod" ile argolu
   Her satır string ya da {h:'sert', s:'yumuşak'} olabilir.
   ===================================================================== */
let hard = true;
export function setHardMode(v){ hard=!!v; }
export function isHardMode(){ return hard; }
const L = (x)=> typeof x==='string' ? x : (hard ? x.h : x.s);
export function pick(arr, rng){ const r = rng ? rng() : Math.random(); return L(arr[Math.floor(r*arr.length)]); }
export function fillT(t, m, neg=false){ const text=t.replace(/\{(\w+?)(?:_(e|i|in|de))?\}/g,(_,k,kind)=>{ const v=m[k]??''; return kind?suf(v,kind):v; }); if(text!==t) SPOKEN.set(text, fillSpoken(t,neg,m)); return text; }

/* ---- SESLENDİRME: isimler sesli okunmaz, yerine işaret zamiri gelir (önceden kaydedilmiş sesler için) ---- */
const SPOKEN=new Map();
const DEM={
  t:{ '':'bu adam', e:'bu adama', i:'bu adamı', in:'bu adamın', de:'bu adamda' },
  tn:{ '':'bu herif', e:'bu herife', i:'bu herifi', in:'bu herifin', de:'bu herifte' },
  o:{ '':'şu adam', e:'şu adama', i:'şu adamı', in:'şu adamın', de:'şu adamda' },
  v:{ '':'garibim', e:'garibe', i:'garibi', in:'garibin', de:'garipte' },
};
const ROLE_SP={ doktor:'doktorum', kahin:'kâhinim', 'kâhin':'kâhinim', koylu:'köylüyüm', 'köylü':'köylüyüm' };
const capFirst=(x)=>x.replace(/(^|[.!?…]\s+)([a-zçğıöşü])/g,(m,a,b)=>a+(b==='i'?'İ':b.toLocaleUpperCase('tr')));
/** Şablonun seslendirilecek (isimsiz) hâli */
export function fillSpoken(t, neg=false, m={}){ return capFirst(t.replace(/\{(\w+?)(?:_(e|i|in|de))?\}/g,(_,k,kind)=>{ if(k==='role') return m.role||'köylüyüm'; const tb=(k==='t'&&neg)?DEM.tn:(DEM[k]||DEM.t); return tb[kind||'']; })); }
/** Motorun kendi kurduğu cümleler için sesli hâli kaydet */
export function regSpoken(text, sp){ SPOKEN.set(text, sp); return text; }
/** Ekrandaki metnin seslendirilecek karşılığı */
export function spokenFor(text){ return SPOKEN.get(text) || text; }
export const NEG_POOLS=new Set();

/* Türkçe ek yardımcısı */
const V='aeıioöuü'; const VL=(w)=>{ const l=w.toLowerCase(); for(let i=l.length-1;i>=0;i--) if(V.includes(l[i])) return l[i]; return 'e'; };
export function suf(name, kind){
  const v=VL(name); const endsV=V.includes(name.slice(-1).toLowerCase()); const back='aıou'.includes(v), round='oöuü'.includes(v);
  const i4 = back?(round?'u':'ı'):(round?'ü':'i');
  if(kind==='e') return name+"'"+(endsV?'y':'')+(back?'a':'e');
  if(kind==='i') return name+"'"+(endsV?'y':'')+i4;
  if(kind==='in') return name+"'"+(endsV?'n':'')+i4+'n';
  if(kind==='de') return name+"'"+(back?'da':'de');
  return name;
}

/* Karakter tipleri: açılış sahnesinde ve konuşma tarzında kullanılır */
export const ARCHETYPES = [
  { key:'muhtar', title:'Muhtar', pitch:.8 },
  { key:'dayioglu', title:'Dayıoğlu', pitch:1.0 },
  { key:'emmi', title:'Emmi', pitch:.9 },
  { key:'delikanli', title:'Delikanlı', pitch:1.15 },
  { key:'memis', title:'Memiş', pitch:.95 },
  { key:'dede', title:'Dede', pitch:.78 },
  { key:'coban', title:'Çoban', pitch:1.05 },
  { key:'bakkal', title:'Bakkal', pitch:.92 },
  { key:'kahveci', title:'Kahveci', pitch:1.0 },
  { key:'bekci', title:'Bekçi', pitch:.88 },
  { key:'demirci', title:'Demirci', pitch:.75 },
  { key:'deli', title:'Deli', pitch:1.25 },
];

/* ---------------- AÇILIŞ SAHNESİ ----------------
   {a0}..{a5} = sahnedeki ilk 6 kişi (karakter sırasıyla). who: index, text */
export const OPENING = [
  { who:0, sfx:'bell', text:'Heeey millet! Herkes meydana toplansıın! Köyü vampir basmıııış!' },
  { who:1, sfx:'murmur', text:'N\'apacaz la şimdi? Bulamassak hepimizi emcükleyecek bu!' },
  { who:2, text:'Tüpü tuttuk yavrum, tüpü tuttuk… Allah\'ım sen koru.' },
  { who:3, text:'Ortalık çok garışık la! Bi fikir söyleyin, böyle durmayın!' },
  { who:4, text:'Ben diyom ki köyü terk edelim. Toplanıp gidelim, hayat yok burda.' },
  { who:1, text:'Olmaz la! Burda doğduk, burda ölürüz! Kaçmak yok!' },
  { who:5, text:{h:'Kaçsak da peşimizden gelir o, ayağına kadar yolu olan bu it.', s:'Kaçsak da peşimizden gelir o. Kurtuluş yok kaçmakla.'} },
  { who:0, text:'Herkes toplanmışken aramızda konuşalım. Her gün birini asmaya karar verelim.' },
  { who:0, text:'Vampirse inkâr etse bile astığımızda ÖLMEZ. O zaman da bırakmayız, hemen yandaki kazığa oturturuz!' },
  { who:0, text:'Ama köylüyse… oracıkta ölür. Allah rahmet eylesin.' },
  { who:2, text:'Aman yarabbi… ya yanlış adamı asarsak?' },
  { who:0, text:'Bulamazsak her gece o vampircik birimizin kanını emer, nüfustan birini düşürür. Bulursak kalanlar yaşar, köyde hayat eskisi gibi devam eder.' },
  { who:4, text:'Başka çaremiz galmadı gardaş… Olsun la, başlayalım.' },
  { who:3, text:'Hadi o zaman! Herkes birbirine iyi baksın, kim şüpheli?' },
];
/* Kısa açılış (sonraki oyunlarda) */
export const OPENING_SHORT = [
  { who:0, sfx:'bell', text:'Toplanın millet! Vampir yine aramızda. Bildiğiniz gibi: asarız, ölmezse kazığa!' },
  { who:1, text:'Hadi la, kim şüpheli? Evlere bakın!' },
];

/* ---------------- GÜNDÜZ: ŞÜPHELİ SEÇİMİ ---------------- */
export const SELECT_INTRO = [
  'Evlere iyi bakın. Kimden şüpheleniyonuz? Kapısını işaretleyin!',
  'Hadi millet, kimin evine gidecez? Parmağınızı uzatın!',
  'Dün gece kim nerdeydi? Şüphelendiğinizin evini seçin!',
];
export const DRAG = {
  crowd: ['Gel la buraya! Meydana!','Çıkar şunu evden, hadi!','Tutun kolundan, kaçmasın!','Yürü la yürü, meydana!'],
  accused: ['Bırakın beni la, ne yaptım ben?!','Ne oluyo, nereye götürüyonuz?!','Vallaha ben bi şey yapmadım!','Elinizi çekin, kendim yürürüm!'],
};

/* ---------------- SAVUNMA ---------------- */
export const DEFENSE_BOT = [
  'Ben köylüyüm la, kırk yıldır bu köydeyim! Kime inanıyonuz siz?',
  'Dün gece evdeydim, horozlar şahidim. Vampir mampir değilim!',
  'Asıl siz bana bakın: {o} dün gece dışardaydı, ben gördüm!',
  'Ben vampir olsam önce {o_i} yerdim, ne diye duruyom burda!',
  'Yemin ederim masumum! Ninemin mezarı üstüne yemin!',
  'Beni asarsanız vampir güler size, aklınızı başınıza toplayın!',
];
export const DEFENSE_HUMAN = [
  { key:'innocent', label:'Masumum, kefilim var!', text:'Ben köylüyüm la! Dün gece evdeydim, {o} şahidim.' },
  { key:'blame', label:'Asıl şüpheli başkası', text:'Beni bırakın, asıl vampir {o}! Gözlerine bakın gözlerine!' },
  { key:'role', label:'Rolümü açıklıyorum', text:'Dinleyin beni: ben {role}! Beni asarsanız köy biter.' },
  { key:'silent', label:'Sus, kaderine razı ol', text:'…' },
];
export const RESPONSE_BELIEVE = [
  'Hmm… doğru diyo olabilir. {t} fena çocuk değildir aslında.',
  'Ben inandım la. Bırakın gitsin, başkasına bakalım.',
  'Gözleri masum bakıyo. Bence o değil.',
];
export const RESPONSE_DOUBT = [
  'İnanmam la! Gözleri gaçıyo bak!',
  'Vampir de aynı böyle söylerdi. Asalım, ölmezse belli olur!',
  'Yalan! Dün gece {t_in} bacası tütmüyodu, evde değildi!',
  'Boş konuşuyo. Oyumu kitledim ben: AS!',
];

/* ---------------- OY / KİLİT ---------------- */
export const LOCK = ['Oyumu kitledim!','Ben kararımı verdim, kitliyom!','Kitledim la, değişmem!','Kitlendi, hadi bakalım.'];
export const RELEASE = ['Tamam la, bırakın gitsin. Bugünlük şanslısın.','Çoğunluk "bırak" dedi. Yürü git evine, ama gözümüz üstünde!','Bugün asmıyoz. Ama yarın yine toplanacaz!'];

/* ---------------- İNFAZ ---------------- */
export const PLEAD = [
  'Ben köylüyüm la, köylüyüm! Yapma gurban olduuum!',
  'Yapmayın, etmeyin! Anam babam var benim!',
  'Vallaha ben değilim! Hıçkırık tuttu beni, bırakın!',
  'Son sözüm: beni asan vampire hizmet ediyo!',
];
export const EXECUTIONER = [
  { h:'Sus la, hamuha goduuum! Hükmün verildi!', s:'Sus la! Hükmün verildi!' },
  { h:'Kes sesini, tabureyi tekmeliyom!', s:'Kes sesini, tabureyi tekmeliyom!' },
  { h:'Gurban olma, göbeğini kaşı! Hadi!', s:'Gurban olma, hadi!' },
];
export const HANG_VILLAGER = [
  { h:'Hamına mamına… yanlış adamı astık la!', s:'Eyvah… yanlış adamı astık la!' },
  'Öldü… köylüymüş. Allah rahmet eylesin.',
  'Yazık oldu gardaşa. Vampir şimdi gülüyodur bize.',
  'Tüh! Bu gece yine biri gidecek…',
];
export const HANG_VAMPIRE_SURPRISE = [
  'Lan… ölmedi! ÖLMEDİ LA! Bakın dişlerine!',
  'Vay keklüüük! Nasıl yakaladık ama seni!',
  'Vampir çıktı! Tutun, kaçmasın!',
];
export const KICK = [
  { h:'Al sana bi tekme! Götüne götüne!', s:'Al sana bi tekme!' },
  'Bu da benden! Emdiğin kanlar burnundan gelsin!',
  'Sıra bende! Hooop!',
  'Kazığa oturtacağız seni, ama YAĞSIZ!',
];
export const IMPALE = [
  'Gıpraşma la, fazladan delik açılmasın!',
  'Oğlum süzgeç olursun bak, dur!',
  'Tutun ayaklarından! Bırakmayın!',
  'Bağır bağır, kimse duymaz la!',
  'Rahat otur, bu senin son tahtın!',
];
export const SCREAMS = ['AAAAH!','HUAAAAA!','ANAAAAM!','GIIIIIH!','AYYYYY!','UAAAH… OFF!','YAPMAYIIIN!','HIIIIIK!'];
export const AFTER_IMPALE = [
  'Oh be, bi tanesi gitti. Hadi herkes evine!',
  'Kazıkta kalsın, ibret olsun!',
  'Geceyi bekleyelim, bakalım daha var mı?',
];
export const VAMPIRE_HANGED_LINES = [ /* vampir kendi */
  'Heh heh… ip mi? Beni ip mi tutacak sandınız?',
  'Öldüm mü sandınız? Daha kanınızı emmedim!',
];

/* ---------------- GECE / SABAH ---------------- */
export const NIGHT_INTRO = ['Herkes evine! Kapıları sürgüleyin, pencereleri örtün!','Gece oldu, kimse dışarı çıkmasın! Vampir dolaşıyo.','Işıkları söndürün… uyuyun bakalım, uyuyabilirseniz.'];
export const DAWN_DEAD = [
  'Sabah oldu… {v_in} kapısı açık, içerde kan var! {v} gitmiş!',
  'Ağlayın millet, {v_i} emmişler gece! Boynunda iki delik!',
  'Yine birini kaybettik: {v}. Bu vampir bizi bitirecek!',
];
export const DAWN_SAVED = ['Sabah oldu. Vampir saldırdı ama doktor yetişmiş! Kimse ölmedi!','Gece kapı zorlanmış ama doktor sayesinde kimse gitmedi. Şükür!'];
export const DAWN_NONE = ['Sabah oldu. Bu gece kimse ölmedi… tuhaf.','Sessiz bi gece geçti. Vampir uyudu mu ne?'];

/* ---------------- BİTİŞ ---------------- */
export const END_VAMP_SOLO = [{ h:'Kanınızı emerin, hepinizi severin heh heh heh! Köy benim artık!', s:'Kanınızı emerim, hepinizi severim heh heh! Köy benim artık!' }];
export const END_VAMP_MULTI = [{ h:'Koyduk mu la, koyduk mu? Heh heh heh! Sonuncusu da gitti!', s:'Bitirdik mi la, bitirdik mi? Heh heh! Sonuncusu da gitti!' }];
export const END_VILLAGE = ['Hepsini kazığa oturttuk! Köyde hayat eskisi gibi!','Davul çalsın, zurna ötsün! Köy kurtuldu!'];

/* ---------------- GÜNDÜZ TARTIŞMA (şiveli) ---------------- */
export const ACCUSE = [
  '{t} bana hiç güven vermiyo. Dün geceden beri bi tuhaf.',
  'Bence {t}. Konuşmasına dikkat edin, sürekli lafı gaçırıyo.',
  '{t} çok sessiz la. Vampirler hep böyle sessiz olur.',
  '{t} neden hep başkasını gösteriyo? Şüpheli bu!',
  'Ben oyumu {t_e} veriyom, açık söylüyom.',
  '{t_in} gözlerine bakın. Bi şey saklıyo bu.',
  '{t_in} bacası dün gece tütmedi, nerdeydi acaba?',
];
export const ACCUSE_HERD = ['Ben de {t} diyom. Herkes aynı şeyi düşünüyo zaten.','Haklısınız gardaş, {t} olabilir. Riske giremeyiz.'];
export const DEFEND = ['{t} masum la, eminim. Dün bütün gün yanımdaydı.','Yok ya, {t} olamaz. Vampir olsa çoktan beni yerdi.','{t_i} boşuna suçluyonuz. Asıl vampir sessiz sessiz bekliyo.','Ben {t_e} kefilim, ne diyosanız bana deyin.'];
export const SEER_VAMP = ['Ben kâhinim la! Dün gece {t_e} baktım: VAMPİR!','Dinleyin, kâhin benim. {t} vampir, bugün asılmalı!'];
export const SEER_CLEAN = ['Ben kâhinim. {t} temiz, ona oy vermeyin.','Kâhin benim ve {t_in} vampir olmadığını biliyom.'];
export const COUNTER_SEER = ['Yalan söylüyo! Asıl kâhin benim ve dün gece {t_e} baktım: vampir!','Ben kâhinim. {t} kâhin değil, vampirin ta kendisi!'];
export const DOCTOR_SAVED = ['Doktor benim. Dün gece {t_i} ben kurtardım.','Söylemek zorundayım: ben doktorum, {t_i} korudum.'];
export const QUIET = ['Bi şey bilmiyom. Herkes şüpheli.','Dikkatli olalım, yanlış kişiyi asarsak biteriz.','Ben kararsızım la.','Konuşanlara değil, susanlara bakın.','Dün gece hiç uyuyamadım…','Bi fikrim yok ama birini asmamız lazım.'];
export const AFTER_KILL = ['{v} öldü… Kim yapmış olabilir la?','Zavallı {v}. Bu gece sırada kim var?'];
