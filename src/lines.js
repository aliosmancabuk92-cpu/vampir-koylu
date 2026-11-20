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
  y:{ '':'gardaş', e:'gardaş', i:'gardaş', in:'gardaş', de:'gardaş' },
};

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
  { key:'kufurbaz', title:'Küfürbaz', pitch:.85 },
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
  { who:0, text:'Vampirse inkâr etse bile astığımızda ÖLMEZ. O zaman da bırakmayız, kalbine kazığı çakarız!' },
  { who:0, text:'Ama köylüyse… oracıkta ölür. Allah rahmet eylesin.' },
  { who:2, text:'Aman yarabbi… ya yanlış adamı asarsak?' },
  { who:0, text:'Bulamazsak her gece o vampircik birimizin kanını emer, nüfustan birini düşürür. Bulursak kalanlar yaşar, köyde hayat eskisi gibi devam eder.' },
  { who:4, text:'Başka çaremiz galmadı gardaş… Olsun la, başlayalım.' },
  { who:3, text:'Hadi o zaman! Herkes birbirine iyi baksın, kim şüpheli?' },
  { who:0, text:'Akşam oldu. Bu gecelik herkes evine! Sabah meydanda toplanır, ilk şüpheliyi seçeriz.' },
];
/* Kısa açılış (sonraki oyunlarda) */
export const OPENING_SHORT = [
  { who:0, sfx:'bell', text:'Toplanın millet! Vampir yine aramızda. Bildiğiniz gibi: asarız, ölmezse kazığa!' },
  { who:1, text:'Hadi la herkes evine! Sabah ola hayrola.' },
];

/* ---------------- GÜNDÜZ: ŞÜPHELİ SEÇİMİ ---------------- */
export const SELECT_INTRO = [
  'Evlere iyi bakın. Kimden şüpheleniyonuz? Kapısını işaretleyin!',
  'Hadi millet, kimin evine gidecez? Parmağınızı uzatın!',
  'Dün gece kim nerdeydi? Şüphelendiğinizin evini seçin!',
];
export const DRAG = {
  crowd: ['Gel la buraya! Meydana!','Çıkar şunu evden, hadi!','Tutun kolundan, kaçmasın!','Yürü la yürü, meydana!',{ h:'Sürüyün şunu, hamuğa goduuum! Ayak diretiyo bi de!', s:'Sürüyün şunu! Ayak diretiyo bi de!' }],
  accused: ['Bırakın beni la, ne yaptım ben?!','Ne oluyo, nereye götürüyonuz?!','Vallaha ben bi şey yapmadım!','Elinizi çekin, kendim yürürüm!',{ h:'Yavaş la, hamına godumun! Pabucum çıktı pabucum!', s:'Yavaş la! Pabucum çıktı pabucum!' }],
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
  { h:'Sus la, hamuğa goduuum! Hükmün verildi!', s:'Sus la! Hükmün verildi!' },
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
  { h:'Hamuğa goduuum… ip tutmuyo bunu la!', s:'Eyvah… ip tutmuyo bunu la!' },
];
export const KICK = [
  { h:'Al sana bi tekme! Götüne götüne!', s:'Al sana bi tekme!' },
  'Bu da benden! Emdiğin kanlar burnundan gelsin!',
  'Sıra bende! Hooop!',
  { h:'Al la, hamuğa goduuum! Bi de bu taraftan!', s:'Al la! Bi de bu taraftan!' },
  'Kazık geliyo kazık! Hazırla göğsünü!',
];
export const IMPALE = [
  'Tutun kollarını, bırakmayın!',
  'Bastır la, bastır! Tam kalbine!',
  'Kıpırdama, kazık kayıyo!',
  { h:'Bastır, hamuğa goduuum! Kalbine kalbine!', s:'Bastır la! Kalbine kalbine!' },
  { h:'Bağır bağır! Götün yiyosa bi daha em kanımızı!', s:'Bağır bağır! Bi daha em bakalım kanımızı!' },
  'Gıpraşma la, fazladan delik açılmasın!',
  'Oğlum süzgeç olursun bak, dur!',
  'Bağır bağır, kimse duymaz la!',
];
export const SCREAMS = ['AAAAAAA AAAAAAAAA!','AAAAAAAAA… AAAAAAA!','AAAAAAA AAAAAAAAAAA!'];
export const AFTER_IMPALE = [
  'Oh be, bi tanesi gitti. Hadi herkes evine!',
  'Kazık göğsünde kalsın, ibret olsun!',
  { h:'Hamuğa goduuum, ne bağırdı be! Kulağımın zarı gitti!', s:'Ne bağırdı be! Kulağımın zarı gitti!' },
  'Geceyi bekleyelim, bakalım daha var mı?',
];
export const VAMPIRE_HANGED_LINES = [ /* vampir kendi */
  'Heh heh… ip mi? Beni ip mi tutacak sandınız?',
  'Öldüm mü sandınız? Daha kanınızı emmedim!',
  'Heh heh… gıdıklanıyom la! Biraz daha sıkın şu ipi!',
];

/* ---------------- GECE / SABAH ---------------- */
export const NIGHT_INTRO = ['Herkes evine! Kapıları sürgüleyin, pencereleri örtün!','Gece oldu, kimse dışarı çıkmasın! Vampir dolaşıyo.','Işıkları söndürün… uyuyun bakalım, uyuyabilirseniz.'];
export const DAWN_DEAD = [
  'Sabah oldu… {v_in} kapısı açık, içerde kan var! {v} gitmiş!',
  'Ağlayın millet, {v_i} emmişler gece! Boynunda iki delik!',
  'Yine birini kaybettik: {v}. Bu vampir bizi bitirecek!',
];
export const DAWN_SAVED = ['Sabah oldu. Vampir saldırdı ama hoca okuyup üflemiş! Kimse ölmedi!','Gece kapı zorlanmış ama hocanın duası tutmuş, kimse gitmedi. Şükür!'];
export const DAWN_NONE = ['Sabah oldu. Bu gece kimse ölmedi… tuhaf.','Sessiz bi gece geçti. Vampir uyudu mu ne?'];

/* ---------------- BİTİŞ ---------------- */
export const END_VAMP_SOLO = [{ h:'Kanınızı emerin, hepinizi severin heh heh heh! Köy benim artık!', s:'Kanınızı emerim, hepinizi severim heh heh! Köy benim artık!' }];
export const END_VAMP_MULTI = [{ h:'Koyduk mu la, koyduk mu? Heh heh heh! Sonuncusu da gitti!', s:'Bitirdik mi la, bitirdik mi? Heh heh! Sonuncusu da gitti!' }];
export const END_VILLAGE = ['Hepsinin kalbine kazık çaktık! Köyde hayat eskisi gibi!','Davul çalsın, zurna ötsün! Köy kurtuldu!'];

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
export const DOCTOR_SAVED = ['Hoca benim. Dün gece {t_i} ben okuyup korudum.','Söylemek zorundayım: ben hocayım, {t_i} korudum.'];
export const QUIET = ['Bi şey bilmiyom. Herkes şüpheli.','Dikkatli olalım, yanlış kişiyi asarsak biteriz.','Ben kararsızım la.','Konuşanlara değil, susanlara bakın.','Dün gece hiç uyuyamadım…','Bi fikrim yok ama birini asmamız lazım.'];
export const AFTER_KILL = ['{v} öldü… Kim yapmış olabilir la?','Zavallı {v}. Bu gece sırada kim var?'];

/* =====================================================================
   YENİ SAHNELER (v4)
   ===================================================================== */
/* ---------------- KAPI BASKINI ---------------- */
export const DOOR = {
  knock: ['Aç la kapıyı! Biliyoz içerdesin!','Açmazsan kırarız ha, ona göre!',{ h:'Aç la şu kapıyı, hamuğa goduuum!', s:'Aç la şu kapıyı, bekletme!' },'Kapıyı aç, meydana gidiyoz!'],
  inside: ['Evde yokum!','Kimse yok la, sonra gelin!','Uyuyom la, uyuyom! Yarın gelin!','Yanlış kapı! Burda kimse yok!'],
  weak: ['Çekilin, ben açarım! Hooop!','Bi tekmede açarım ben bunu! Hıııh!'],
  hurt: ['Ayyy ayağım! Ayağım gırıldı la!',{ h:'Hamuğa goduuum, kapı demirden mi bu?!', s:'Vay anam, kapı demirden mi bu?!' },'Ah anam ah! Parmaklarım!'],
  tease: ['Heh heh! Çekil la çekil, sen daha çocuksun!','Oğlum sen tavuk mu tekmeliyon?','Ayağını tutup sekiyo bak, heh heh!'],
  strong: ['Çekilin! Bu iş bilek işi!','Tü tü… Bismillah! HOOOP!','Kenara çekil delikanlı, usta geldi!'],
  broken: ['Buyur bakalım, kapı mapı galmadı!','Menteşesiyle beraber gitti la!',{ h:'Al sana kapı, hamuğa goduuum!', s:'Al sana kapı!' }],
  open: ['Lan… kapı açıkmış zaten!','Ula kilitli değilmiş, boşuna tekmeledik!'],
  fell: ['Ayyy! Kim açık bıraktı la bunu?!','Yer mi bu, tavan mı? Dönüyo her yer!'],
  cling: ['Bırakmam la, bırakmam! Kapı benim kapım!','Gitmem la! Burda doğdum, burda ölürüm!',{ h:'Çekmeyin la, hamına godumun! Pervaz söküldü!', s:'Çekmeyin la! Pervaz söküldü!' }],
};
/* ---------------- DARAĞACI ---------------- */
export const GALLOWS = {
  knot: ['Düğüm sağlam, merak etme. Hiç acımaz.','İpi sabundan geçirdim, kaymaz bu.','Boynuna tam oturdu, maşallah.'],
  last: ['Bari son bi sigara verin!','Annemi çağırın, annemi!','Benim tavukları kimse yemesin, vasiyetim!','İneğimi kimseye vermeyin, vasiyetim!'],
  look: ['Ben bakamam la, gözümü kapatıyom!','Çocukları içeri sokun, görmesinler!','Ay ay ay… hadi bitsin artık!'],
};
/* ---------------- ARKADAN TEKME ---------------- */
export const KICK_BUTT = {
  go: ['Dur bakalım, ben arkasından dolanayım!','Arkasına geçiyom, görmesin!','Şimdi göreceksin sen!'],
  hit: [{ h:'Al sana, götüne goduuuum!', s:'Al sana, kıçına!' },{ h:'Götüne tekme, götüne! Emersin kanımızı ha?', s:'Kıçına tekme! Emersin kanımızı ha?' },{ h:'Götünü kaldır la, bi tane de benden!', s:'Kıçını kaldır, bi tane de benden!' }],
  back: ['Ayyy! Geri geldi la, geri geldi!','Sallanıp bana çarptı la! Allahım belim!'],
  miss: ['Iskaladım la!','Hoppala… ayağım boşa gitti!'],
  tease: ['Heh heh! Oğlum ayağın mı yok?','Vampir de güldü sana la!','Sarkaç gibi döndü geldi, heh heh!'],
  vamp: ['Ooof! Yavaş la, yavaş!','Heh… bu mu tekme? Gıdıkladın beni!','Ayyy kuyruk sokumum!'],
};
/* ---------------- YÜZÜSTÜ KAZIK (sert mod) ---------------- */
export const STAKE_BUTT = {
  start: ['İndirin şunu ipten! Yüzüstü yatırın!','Yüzü yere gelsin! Tutun, kaçmasın!'],
  hold: ['Sen sağ kolunu tut, sen sol kolunu!','Belinden bastır, gıpraşmasın!','Bacaklarına otur la, tepiniyo!'],
  ask: ['Usta, kazık nerden girecek?'],
  answer: ['Arkadan arkadan! Eski usul, dedemden gördüğüm gibi!','Arkadan girecek, Kazıklı Voyvoda usulü!'],
  push: [{ h:'Kazık götüne goduuuum! Bi daha kan emersin ha?', s:'Kazık arkadan! Bi daha kan emersin ha?' },'Bastır la bastır! Bi daha!','Hooop! Bi tane daha!',{ h:'Gir la gir, hamuğa goduuum!', s:'Gir la gir!' }],
  beg: ['Yapmayın la, oradan olmaz! Oradan olmaz!','Durun durun! Ben şakaydım la, şaka!','Konuşalım, konuşalım! Anlaşırız!'],
  roar: ['IAAAAA… HUAAAAA!','IAAAAAA! HUAAAAAAA!','HUAAAAA… IAAAAAA!'],
  after: ['Kül oldu gitti la! Kazık dimdik kaldı!',{ h:'Hamuğa goduuum, nasıl böğürdü be! Eşek gibi!', s:'Nasıl böğürdü be! Eşek gibi!' },'Kazık kaldı, vampir gitti. Hadi herkes evine!'],
};
/* ---------------- VAMPİR KAZANIR: KOVALAMACA ---------------- */
export const END_CHASE = {
  vamp1: ['Nereye kaçacan gundi?','Heh heh… nereye kaçacan gundi?'],
  run: ['Bende ölüm yoooook!','Bende ölüm yok la, yoooook!'],
  help: ['İmdaaat! Açın la kapıyı!','Açın la, açııın! Kimse yok mu?!','Kilitli la, hepsi kilitli!'],
  vamp2: ['Gel ula tırrik!','Gel ula tırrik, gel gel!'],
  caught: ['Bırak la, bırak! Kanım az benim, kansızım ben!','Yapma gurban olduğum, yapma!'],
  after: ['Ohhh… kan değil bal!','Hıh… biraz tuzluymuş ama olsun.','Ohh… doydum. Köy benim artık!'],
  others: ['Kaçın la kaçın! Herkes başının çaresine baksın!','Ben ahıra saklanıyom!'],
};
/* ---------------- KÖYLÜLER KAZANIR: ŞENLİK ---------------- */
export const END_PARTY = {
  nufus: [{ h:'Köy kurtuldu ama pezevenk nüfusun içinden geçti!', s:'Köy kurtuldu ama nüfusun içinden geçti!' }],
  artir: ['Doğru söylüyosun. Nüfusu artırmamız lazım!'],
  slap: ['Utan la utan! Daha ölüler soğumadı!','Sen önce kendine bi gelin bul, sonra nüfus artır!'],
  alone: ['Bi ben galdım la… Köyü ben mi şenlendirecem?','Herkes gitti, bi ben galdım. Olsun, oynarım ben de!'],
  small: ['Muhtar, nüfus memuruna ne diyecez?','Vampir yedi deriz, inanmayan gelsin baksın!','Ben bu gece rahat uyuyacam, ohhh!'],
  big: ['Çağırın davulcuyu, halay çekecez!','Hadi millet, halaya! Mendil nerde mendil?','Bu gece köyde düğün var!'],
  dance: ['Hele hele, oyna oyna!','Oynaaa! Omuzları titret!','Göbek at la göbek!'],
};
/* ---------------- KÜFÜRBAZ EMMİ (tartışmada patlar) ---------------- */
export const KUFURBAZ = [
  { h:'Hay senin ağzına kürekle vurayım! Vampir mi olur la bu köyden?', s:'Hay senin ağzına kürekle vurayım! Vampir mi olur bu köyden?' },
  { h:'Ulan eşşoğlu eşşek vampir, çık ortaya! Sülaleni kazığa oturturum!', s:'Ulan vampir, çık ortaya! Sülaleni kazığa oturturum!' },
  { h:'Hamuğa goduuum, gece gözüme uyku girmedi! Kim yaptıysa ağzına sıçayım!', s:'Gece gözüme uyku girmedi! Kim yaptıysa yandı!' },
  { h:'Pezevenk gibi bakma la bana! Ben vampir olsam önce senin kanını emerdim!', s:'Öyle bakma la bana! Ben vampir olsam önce senin kanını emerdim!' },
  { h:'Hay senin kanına, damarına, alyuvarına goyim!', s:'Hay senin kanına, damarına, alyuvarına!' },
  { h:'Tüüü, hepinizin ağzına tükürüyüm! Asın şunu da kurtulalım!', s:'Tüüü! Asın şunu da kurtulalım!' },
];

/* =====================================================================
   KONUŞMA / İKNA (v4) — {t}=hedef, {o}=başka biri
   ===================================================================== */
export const ACCUSE_WHY = {
  night: ['{t} dün gece dışardaydı, kendi gözümle gördüm!','Gece yarısı {t_in} kapısı açıldı, ben gördüm la!'],
  quiet: ['{t} hiç ağzını açmıyo. Susan vampirdir!','{t} sabahtan beri tek kelime etmedi, niye acaba?'],
  pushed: ['Dün masum adamı {t} astırdı! Unuttunuz mu?','{t} hep masumları gösteriyo. Bunda bi iş var!'],
  gut: ['İçimden bi ses {t} diyo. Bi tuhaf bakıyo bana.','{t_in} dişlerine bakın la, sivri sivri!'],
  lie: ['{t} yalan söyledi, yakaladım! Az önce başka diyodu!','{t_in} lafı tutmuyo, bi öyle diyo bi böyle!'],
  clue: ['{t_in} kapısına gidiyo izler, daha ne olsun!','İpuçları {t_i} gösteriyo, gözünüzü açın!'],
};
export const DEFEND_WHY = {
  alibi: ['{t} dün gece benim yanımdaydı, birlikte çay içtik!','Dün gece {t} ile sabaha kadar okey oynadık!'],
  seer: ['Kâhin {t_e} temiz dedi! Ona dokunmayın!'],
  accuser: ['{t_i} suçlayana bakın asıl! Şüpheli o!','{t_e} çamur atan, vampirin ta kendisi!'],
  vouch: ['Ben {t_e} kefilim, ne diyosanız bana deyin.','{t_i} küçüklüğünden beri tanırım, o yapmaz!'],
};
export const PRESS = {
  ask: ['{y}, dün gece nerdeydin? Söyle bakalım!','{y}, gözümün içine bak! Vampir misin?'],
  good: ['Evdeydim la, karım şahit! Horlamamdan bütün mahalle uyumadı!','Ahırdaydım, ineği sağıyodum. Sor ineğe!','Kahvedeydim, kâğıt oynuyoduk. Herkes gördü!'],
  bad: ['Ben mi? Evdeydim… yok yok, ahırdaydım! Yani… çeşmedeydim!','Nerde olacam la… şey… yani… ordaydım işte!'],
  angry: ['Sana ne la! Hesap mı vereceğim sana?','Sen kimsin de bana soru soruyon?'],
};
export const ALLY = {
  ask: ['{y}, gel seninle anlaşalım. Sen bana kefil ol, ben sana.'],
  yes: ['Tamam, anlaştık! Sırt sırta veririz.','Olur, sözüm söz. Sana kimse dokunamaz.'],
  no: ['Yok la, sana güvenmem! Bi tuhafsın.','Anlaşma manlaşma yok, herkes kendi başına!'],
};
export const CALM = ['Sakin olun millet! Aceleyle yanlış adamı asmayalım.','Durun bi dakka, kafa kafaya verelim. Telaşla iş olmaz.'];
export const OATH = ['Yemin ederim vampir değilim! Ekmek çarpsın!','Vallahi billahi değilim! Gözüm kör olsun!'];
export const AGREE = ['Doğru diyo!','Haklı la!','Ben de öyle düşünüyom.','Aynen öyle!'];
export const OBJECT = ['Hadi ordan, uydurma!','Ne alakası var la?','Yok öyle bi şey, saçmalama!'];
export const ASK_YOU = ['Peki sen nerdeydin dün gece?','Sen niye bu kadar üstüne gidiyon? Bi derdin mi var?'];
export const YOU_ANSWER = [
  { key:'home', label:'Evdeydim, uyuyordum', text:'Evdeydim la, mışıl mışıl uyuyodum.', v:1 },
  { key:'barn', label:'Ahırdaydım', text:'Ahırdaydım, ineğin doğumu vardı.', v:0 },
  { key:'angry', label:'Size ne!', text:'Size ne la! Hesap mı vereceğim?', v:-1 },
];
/* sanığın 3 adımlı savunması */
export const DEFENSE_OPEN = [
  { key:'witness', label:'Şahidim var', text:'Ben köylüyüm la! Dün gece evdeydim, {o} şahidim.' },
  { key:'blame', label:'Asıl vampir o', text:'Beni bırakın, asıl vampir {o}! Gözlerine bakın gözlerine!' },
  { key:'role', label:'Rolümü açıklıyorum', text:'Dinleyin beni: ben {role}! Beni asarsanız köy biter.' },
  { key:'oath', label:'Yemin et', text:'Yemin ederim vampir değilim! Ekmek çarpsın, gözüm kör olsun!' },
  { key:'beg', label:'Yalvar', text:'Yalvarırım asmayın! Çoluk çocuk sahibiyim, yazık bana!' },
  { key:'threat', label:'Tehdit et', text:'Beni asarsanız rüyanıza girerim! Her gece ayak ucunuzda dururum!' },
  { key:'silent', label:'Sus', text:'…' },
];
export const WITNESS_YES = ['Doğru diyo, yanımdaydı. Ben şahidim.','Evet, bütün gece benimleydi.'];
export const WITNESS_NO = ['Ne alakası var la, ben onu görmedim bile!','Beni karıştırma! Ben evdeydim, sen yoktun!'];
export const DEFENSE_Q = [
  { q:'Madem masumsun, dün gece neden ışığın yanıyodu?', a:[
    { label:'Kâbus gördüm', text:'Kâbus gördüm la, sabaha kadar uyuyamadım!', v:1 },
    { label:'Hastaydım', text:'Ateşim vardı, hasta yatıyodum. Bakın hâlâ terliyom!', v:0 },
    { label:'Size ne!', text:'Size ne la, benim evim benim ışığım!', v:-1 } ] },
  { q:'Dün gece ahırın önünde ne arıyodun?', a:[
    { label:'İnek kaçmıştı', text:'İnek kaçmıştı la, onu arıyodum!', v:1 },
    { label:'Hava alıyodum', text:'Hava alıyodum, içim sıkıldı.', v:0 },
    { label:'Ben orda değildim', text:'Ben orda değildim ki! Yanlış görmüşsünüz!', v:-1 } ] },
  { q:'Ağzındaki o kırmızılık ne?', a:[
    { label:'Pekmez yedim', text:'Pekmez yedim la pekmez! Koklayın isterseniz!', v:1 },
    { label:'Domates yedim', text:'Sabah domates yedim, ondan.', v:0 },
    { label:'Kırmızı mı?', text:'Kırmızı mı? Nerde? Yok bi şey!', v:-1 } ] },
  { q:'Sabah cenazeye niye gelmedin?', a:[
    { label:'Mezarı ben kazdım', text:'Mezarı ben kazdım la, ellerim hâlâ nasırlı!', v:1 },
    { label:'Yatıyodum', text:'Uyuya kalmışım, yemin ederim.', v:0 },
    { label:'Ölüyü sevmem', text:'Ben ölü sevmem, ne yapayım!', v:-1 } ] },
];
export const LAST_WORD = [
  { key:'regret', label:'Pişman olursunuz', text:'Son sözüm: beni asarsanız pişman olursunuz!' },
  { key:'warn', label:'Vampir aranızda', text:'Son sözüm: vampir aranızda, size gülüyo!' },
  { key:'forgive', label:'Hakkımı helal ederim', text:'Son sözüm: hakkımı helal ediyom. Allah\'a emanet olun.' },
];
export const INTERVENE = { support:['Durun! Ben {t_e} kefilim, asmayın!','Bu adamı asarsanız günaha girersiniz, durun!'], refute:['İnanmayın, yalan söylüyo! Asın gitsin!','Hepsi palavra! Asın, ölmezse belli olur!'] };

/* =====================================================================
   v5 — ipuçları, köy olayları, yeni roller, hayaletler
   ===================================================================== */
/* ilk sabah: kimse ölmez, tavuk gider */
export const DAWN_CHICKEN = [
  'Sabah oldu… Kümesteki tavuğu emmişler la! Vampir aramızda, şaka değil!',
  'Millet! Tavuğun boynunda iki delik var! Bu gece tavuk, yarın gece biz!',
  { h:'Hamuğa goduuum, en yağlı tavuğumu emmiş! Bunu yapanı bulacam!', s:'Vay anam, en yağlı tavuğumu emmiş! Bunu yapanı bulacam!' },
];
/* ipuçları: metinde evler sayılır, seste sayılmaz ({n} = isimler) */
export const CLUE = {
  iz: 'Çamurlu ayak izleri var! Şu evlerden birine gidiyo.',
  kopek: 'Gece köpek şu evlerin önünde havlamış.',
  tuy: 'Tavuk tüyleri şu kapıların önüne dökülmüş.',
  kan: 'Eşikte kan damlası bulduk! Şu evlerden birinin önünde.',
  baca: 'Gece şu evlerin bacası tütmüyodu.',
  ay: 'Dolunayda her şey görünür! Bu iz kesin vampirin.',
  dugun: 'Halay çekilirken biri ortadan kayboldu! Şunlardan biri.',
  hayalet: 'Rüyamda bi hayalet fısıldadı la! Şu evlerden biri vampirmiş.',
};
export const CLUE_NONE = ['Bu sabah ne iz var ne işaret. Vampir temiz çalışmış.'];
export const CLUE_TALK = ['İzler yalan söylemez la!','Bu iz bana sonradan konmuş gibi geldi…','Ayak izine bakın, kimin pabucuna uyuyo?'];
/* köy olayları */
export const EVENT = {
  sis: ['Köyü sis bastı la! Göz gözü görmüyo, iz miz arama bu sabah.'],
  firtina: ['Hava dönüyo. Bu gece fırtına var, bekçi bile burnunun ucunu göremez!'],
  dolunay: ['Bu gece dolunay var! Vampir azar, iki kapı birden çalabilir. Ama ay ışığında izi de belli olur!'],
  pazar: ['Bugün pazar günü! Herkes meydanda, uzun uzun konuşalım.'],
  dugun: ['Bugün köyde düğün var! Düğün günü adam asılmaz, günah!'],
};
export const WEDDING = ['Çalsın davullar! Bugün asmak yok, oynamak var!','Hadi halaya! Dertleri yarın düşünürüz!'];
/* yeni roller */
export const BEKCI_SAW = ['Bekçi benim! Dün gece {t} evinden çıktı, fenerimle gördüm!','Ben bekçiyim la! {t_i} gece sokakta gördüm, yemin ederim!'];
export const BEKCI_HOME = ['Bekçi benim. {t} dün gece evindeydi, kapısı hiç açılmadı.'];
export const GOSSIP = ['Kulağıma geldi: ya {t} ya {o}… İkisinden biri gece dışardaymış!','Çeşme başında duydum: {t} ile {o}, birinin gece evde olmadığı kesin!'];
export const DELI_TALK = ['Ben vampirim la! Yok yok, şaka şaka… Yoksa değil mi?','Asın beni! Bi denesenize, noolcak?','Dün gece aya karşı uludum ben, heh heh!'];
export const DELI_PLEAD = ['Asın la asın! Benim de istediğim buydu, heh heh heeey!','Oh be, sonunda! İpi sıkı bağlayın!'];
export const DELI_WIN = ['Eyvah! Deliyi astık la! Oyuna geldik!','Deliymiş bu! Bile bile astırdı kendini, tüh!'];
export const DELI_NARR = 'Köy deliyi astı! Oyunu deli kazandı!';
export const LOVER_DEATH = ['{v} sevdiğinin acısına dayanamadı… O da gitti.'];
export const LOVER_DEFEND = ['{t} benim canım, ciğerim! Ona dokunan beni çiğner!','{t_e} laf eden karşısında beni bulur!'];
export const AGA_CLAIM = ['Ben bu köyün ağasıyım! Oyum iki sayılır, beni asarsanız vampir sevinir!'];
/* beraberlik: söz düellosu */
export const DUEL_INTRO = 'Oylar eşit çıktı! İki şüpheli söz düellosu yapsın, köy yeniden seçsin!';
export const DUEL = ['Bana değil ona bakın! Benim alnım ak!','Ben bu köyün ekmeğini yedim, ihanet etmem!','O benden şüpheli, yüzü kızardı bak!','Ya o ya ben diyosanız: o!'];
/* hafıza + ilişkiler */
export const MEMORY = {
  again: ['Dün de beni suçlamıştın {y}, bugün yine mi? Bi derdin var senin!','{y}, kaç gündür bana takmışsın! Asıl sen şüphelisin!'],
  friend: ['Dün vampiri savunan {t} değil miydi? Hadi bakalım!'],
};
export const FEUD = ['{t} bana on yıldır küs, tarla sınırı yüzünden. Ama vampirlik de yapar bu!','{t_in} gözü hep benim tarlamdaydı zaten!'];
export const BUDDY = ['{t} benim kirvem, o yapmaz!','{t} ile asker arkadaşıyız, kefilim!'];
/* odada tepki düğmeleri */
export const REACT = { yuh:'Yuuuh!', hah:'Hah hah haaa!', vallahi:'Vallahi o, billahi o!', hadi:'Hadi ordan!', helal:'Helal olsun la!' };
/* hayaletler */
export const TOMATO_HIT = ['Ayy! Kim attı la bu domatesi?','Domates mi yağıyo gökten?!','Hayaletler azdı yine!'];
export const RATTLE = ['Kim o? Kapıyı kim tıkırdatıyo?!'];
/* rol açıklama (savunmada) */
export const ROLE_CLAIM = 'Dinleyin beni: ben {role}! Beni asarsanız köy biter.';
export const HOCA_CLAIM = ['Ben hocayım! Beni asarsanız geceleri kimse korunmaz!'];
export const HOCA_SAVED = ['Hoca benim, dün gece kurtaran bendim.'];
export const HOCA_PLAIN = ['Ben hocayım, bana dokunmayın.'];
/** ipucu cümlesi: ekranda evler sayılır, seste sayılmaz */
export function clueLine(kind,names){ const base=CLUE[kind]||CLUE.iz; return regSpoken(`${base.slice(0,-1)}: ${names.join(', ')}.`, base); }
/** "Meğer hocaymış!" — rol ortaya çıkınca */
export function revealLine(name,reveal){ return regSpoken(`${name} ${reveal}.`, `Meğer ${reveal}!`); }
