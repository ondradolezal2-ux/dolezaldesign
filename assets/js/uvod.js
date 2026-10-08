/* Doležal Design — úvodní stránka (v20, 8. 10. 2026): chování prvků z prototypu
   _navrhy/v19-vizualy/. Oznámení v telefonu úvodu (A), test „Jak je na tom váš web?“ (C),
   každý obor jinak (D), klepnutí a skutečná rychlost v malých obrazovkách (E), poptávky
   jako obálky (G), pravítko 14 dní (H), kolik vám vydělá jedna zakázka (I).
   Vanilla JS, bez závislostí. Bez JS je všechno vidět v klidovém stavu (oznámení stojí
   v telefonu, telefon v testu je celý, obor Pokrývač, obálky a pruhy vidět).
   Společné věci (menu, přechod z úvodu, stohování listů, lepkavá lišta, měření načtení,
   cookie lišta) jsou v main.js. */
(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NBSP = ' ';
  const num = (n) => n.toLocaleString('cs-CZ').replace(/\s/g, NBSP);
  const afterLoad = (fn) => {
    if (document.readyState === 'complete') setTimeout(fn, 0);
    else addEventListener('load', () => setTimeout(fn, 0), { once: true });
  };
  // zavolá fn jednou, až prvek dojede do obrazovky (bez IntersectionObserveru hned)
  const whenSeen = (el, fn, threshold = 0.35) => {
    if (!hasIO) { fn(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { threshold });
    io.observe(el);
  };

  /* ---------- A · Poptávka přijde do telefonu úvodu ---------- */
  // Jednou, asi 0,9 s po načtení. S omezeným pohybem stojí (main.css).
  const notif = $('[data-notif]');
  if (notif) {
    if (reduce) notif.classList.add('is-in');
    else afterLoad(() => setTimeout(() => notif.classList.add('is-in'), 900));
  }

  /* ---------- C · Test „Jak je na tom váš web?“ ---------- */
  const quiz = $('[data-quiz]');
  if (quiz) {
    const parts = ['call', 'what', 'photos', 'form'];
    const missLabel = { call: 'zavolat jedním klepnutím', what: 'co děláte a kde', photos: 'fotky práce', form: 'poptávka s fotkou' };
    const scoreEl = $('[data-score]');
    const textEl = $('[data-verdict-text]');
    const cta = $('[data-verdict-cta]');
    const partEl = (k) => $(`.crowd [data-show="${k}"]`);
    const crowdScore = $('[data-crowd-score]');
    // tlačítko se ukáže po poslední odpovědi (bez JS je vidět pořád)
    cta.toggleAttribute('data-off', true);
    parts.forEach((k) => { partEl(k).dataset.state = 'unknown'; });
    const update = () => {
      let answered = 0;
      let yes = 0;
      const missing = [];
      parts.forEach((k) => {
        const v = quiz.elements[k].value;
        const el = partEl(k);
        if (v === '') { el.dataset.state = 'unknown'; return; }
        answered++;
        if (v === '1') { yes++; el.dataset.state = 'yes'; } else { el.dataset.state = 'no'; missing.push(missLabel[k]); }
      });
      scoreEl.textContent = String(yes);
      if (crowdScore) crowdScore.textContent = answered === 4 ? String(yes) : '?';
      if (answered < 4) {
        textEl.textContent = `Zodpovězeno ${answered} ze 4. Postavy vedle se mění podle vašich odpovědí.`;
        cta.toggleAttribute('data-off', true);
      } else if (yes === 4) {
        textEl.textContent = 'Základ máte. Chcete vidět, co dalšího by váš web mohl dělat? Ukázku vám připravím zdarma.';
        cta.toggleAttribute('data-off', false);
      } else {
        textEl.textContent = `Na vašem webu chybí: ${missing.join(', ')}. Tady vám odcházejí zákazníci. Ukážu vám, jak by vypadal se všemi čtyřmi.`;
        cta.toggleAttribute('data-off', false);
      }
    };
    quiz.addEventListener('change', update);
    quiz.addEventListener('submit', (e) => e.preventDefault());
  }

  /* ---------- D · Každý obor jinak (z oborových profilů ukázkovače, _ukazkovac/obory.yaml) ---------- */
  // Výchozí obor (Pokrývač) je přímo v HTML; tady přepínač a ostatní obory.
  const TRADES = [
    { id: 'strechy', name: 'Pokrývač',
      hero: 'Střechy a klempířské práce v Hradci Králové', cta: 'Poslat fotky střechy',
      fields: ['Co potřebujete', 'Obec', 'Přibližná plocha střechy (m²)', 'Fotky střechy'], dock: ['Poslat fotky', 'Zavolat'],
      need: 'Práce má dost. Chce méně zbytečných telefonátů a lepší zakázky.',
      promise: 'Poptávky přijdou rovnou s fotkami střechy a plochou.',
      asks: ['Udělají i můj typ práce (nová střecha, oprava, havárie)?', 'Kdy mají volný termín?', 'Kolik to zhruba bude stát?'] },
    { id: 'stavby', name: 'Rekonstrukce',
      hero: 'Rekonstrukce bytů a domů v Hradci Králové', cta: 'Popsat zakázku',
      fields: ['Typ zakázky', 'Obec', 'Přibližná plocha (m²)', 'Orientační rozpočet'], dock: ['Popsat zakázku', 'Zavolat'],
      need: 'Fronta zákazníků. Chce zakázky, které chce, ne každý telefonát.',
      promise: 'Poptávky přijdou s rozsahem, termínem a rozpočtem.',
      asks: ['Dělají zakázky mé velikosti?', 'Kdy můžou začít a jak dlouho to potrvá?', 'Uvidím hotové práce podobné té mojí?'] },
    { id: 'truhlari', name: 'Truhlář',
      hero: 'Kuchyně a nábytek na míru z Hradce Králové', cta: 'Poslat rozměry a představu',
      fields: ['Co chcete vyrobit', 'Rozměry nebo půdorys', 'Představa o materiálu', 'Orientační rozpočet'], dock: ['Poslat rozměry', 'Zavolat'],
      need: 'Nechce zvědavce. Chce zákazníky s představou a rozpočtem.',
      promise: 'Zákazníci přijdou s představou, rozměry a rozpočtem, ne jen ze zvědavosti.',
      asks: ['Líbí se mi, co dělají?', 'Jak dlouho se čeká?', 'Kolik zhruba stojí kuchyň nebo skříň na míru?'] },
    { id: 'auto', name: 'Autoservis',
      hero: 'Autoservis a pneuservis v Hradci Králové', cta: 'Objednat termín',
      fields: ['Značka a model', 'Co potřebujete', 'Preferovaný den'], dock: ['Objednat termín', 'Zavolat'],
      need: 'Soupeří o zákazníky. Chce, aby se objednali sami, i večer.',
      promise: 'Víc zákazníků, kteří se objednají sami, i mimo otevírací dobu.',
      asks: ['Můžu se objednat na konkrétní den?', 'Kolik stojí přezutí nebo servis?', 'Opravují moji značku?'] },
    { id: 'domacnost', name: 'Úklid',
      hero: 'Úklid v Hradci Králové a okolí', cta: 'Chci cenu',
      fields: ['Služba', 'Obec', 'Rozsah (m²)', 'Termín'], dock: ['Zavolat', 'Chci cenu'],
      need: 'Soupeří o zákazníky. Rozhoduje cena a důvěra.',
      promise: 'Víc poptávek, protože zákazník hned vidí cenu, oblast a jestli se jim dá věřit.',
      asks: ['Kolik to bude stát?', 'Přijedou ke mně a kdy?', 'Dá se jim věřit? Pouštím cizí lidi do bytu.'] },
    { id: 'makler', name: 'Makléř',
      hero: 'Vaše jméno, realitní makléř pro Hradec Králové', cta: 'Chci odhad ceny',
      fields: ['Typ nemovitosti', 'Lokalita', 'Dispozice a plocha', 'Stav'], dock: ['Odhad ceny', 'Zavolat'],
      need: 'Prodává sebe. Musí vyhrát nad anonymním portálem.',
      promise: 'Osobní web, kvůli kterému si vás prodávající vyberou místo anonymního portálu.',
      asks: ['Proč prodávat přes tohohle makléře?', 'Co pro prodej udělá (fotky, video, inzerce)?', 'Zná moji lokalitu?'] },
  ];
  // jednopísmenné předložky a spojky drží s dalším slovem (jako v HTML)
  const tie = (t) => t.replace(/(^|\s)([aikosuvzAIKOSUVZ])\s/g, `$1$2${NBSP}`);
  const pick = $('[data-trades]');
  const phone = $('[data-tphone]');
  if (pick && phone) {
    const T = (k) => $(`[data-t="${k}"]`);
    const items = (tag, list) => list.map((t) => { const el = document.createElement(tag); el.textContent = tie(t); return el; });
    const fill = (t) => {
      const art = T('art'); if (art) art.querySelector('use').setAttribute('href', `#art-${t.id}`);
      T('hero').textContent = tie(t.hero);
      T('cta').textContent = t.cta;
      T('fields').replaceChildren(...items('li', t.fields));
      T('dock').replaceChildren(...items('span', t.dock));
      T('need').textContent = tie(t.need);
      T('promise').textContent = tie(t.promise);
      T('asks').replaceChildren(...items('li', t.asks));
    };
    TRADES.forEach((t, i) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'trade';
      input.value = t.id;
      input.checked = i === 0;
      const span = document.createElement('span');
      span.textContent = t.name;
      label.append(input, span);
      pick.append(label);
    });
    let swap = 0;
    pick.addEventListener('change', (e) => {
      const t = TRADES.find((x) => x.id === e.target.value);
      if (!t) return;
      if (reduce) { fill(t); return; }
      phone.classList.add('is-swap');
      clearTimeout(swap);
      swap = setTimeout(() => { fill(t); phone.classList.remove('is-swap'); }, 180);
    });
  }

  /* ---------- E · Klepnutí na Zavolat a skutečná rychlost načtení ---------- */
  const tap = $('[data-tap]');
  if (tap && !reduce) {
    const ring = () => { tap.classList.remove('is-tapped'); void tap.offsetWidth; tap.classList.add('is-tapped'); };
    whenSeen(tap, () => setTimeout(ring, 300), 0.8);              // jednou, když obrazovka dojede
    tap.closest('[data-tap-item]').addEventListener('pointerdown', ring);
  }
  // číslo zapisuje main.js (stejné měření jako v patičce); tady jen pruh, stupnice do 3 s
  const loadbar = $('[data-loadbar]');
  if (loadbar) {
    let ms = 0;
    let seen = false;
    const fillBar = () => { if (ms && seen) loadbar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, ms / 3000))})`; };
    const take = (v) => { ms = +v || 0; fillBar(); };
    if (root.dataset.loadtime) take(root.dataset.loadtime);
    else document.addEventListener('dd:loadtime', (e) => take(e.detail), { once: true });
    whenSeen(loadbar, () => { seen = true; fillBar(); }, 1);
  }

  /* ---------- G · Přes 30 poptávek: obálky naskáčou postupně, když dojedou ---------- */
  const inbox = $('[data-inbox]');
  if (inbox) {
    const grid = $('.inbox__grid', inbox);
    $$('li', grid).forEach((li, i) => li.style.setProperty('--i', i));
    if (!reduce && hasIO) {
      inbox.classList.add('is-ready');
      whenSeen(grid, () => inbox.classList.add('is-in'));
    }
  }

  /* ---------- H · Pravítko 14 dní: pruhy se jednou natáhnou ---------- */
  const ruler = $('[data-ruler]');
  if (ruler && !reduce && hasIO) {
    ruler.classList.add('is-ready');
    whenSeen(ruler, () => ruler.classList.add('is-in'), 0.5);
  }

  /* ---------- I · Kolik vám vydělá jedna zakázka ---------- */
  // Počítá s cenou „od“ vybraného balíčku a s příkladem průměrné zakázky (20 000 Kč).
  // Kolik zakázek web přinese, se neslibuje (věta pod výsledkem).
  const job = $('#roi-job');
  if (job) {
    const out = $('[data-job-out]');
    const answer = $('[data-roi]');
    const bar = $('[data-roi-bar]');
    const pkgs = $$('input[name="pkg"]');
    const plural = (n) => (n === 1 ? 'jedna zakázka' : n < 5 ? `${n} zakázky` : `${n} zakázek`);
    const calc = () => {
      const pkg = pkgs.find((r) => r.checked) || pkgs[1];
      const price = +pkg.value;
      const value = +job.value;
      const n = Math.max(1, Math.ceil(price / value));
      out.textContent = `${num(value)}${NBSP}Kč`;
      job.style.setProperty('--fill', `${((value - job.min) / (job.max - job.min)) * 100}%`);
      const b = document.createElement('b');
      b.textContent = plural(n).replace(' ', NBSP);
      answer.replaceChildren(`Web ${pkg.dataset.name} se vám zaplatí, když přes něj přijde `, b, '.');
      // pruh: n bloků (jeden blok = jedna zakázka) a čárkovaná čára ceny webu
      const shown = Math.min(n, 24);
      const total = Math.max(price, shown * value);
      const blocks = [];
      for (let i = 0; i < shown; i++) {
        const blk = document.createElement('span');
        blk.className = 'blk';
        blk.style.width = `calc(${(value / total) * 100}% - 4px)`;
        blocks.push(blk);
      }
      const line = document.createElement('span');
      line.className = 'price';
      const pos = (price / total) * 100;
      line.style.left = `${pos}%`;
      line.classList.toggle('flip', pos > 60);
      const lab = document.createElement('span');
      lab.textContent = `cena webu od ${num(price)}${NBSP}Kč`;
      line.append(lab);
      bar.replaceChildren(...blocks, line);
    };
    job.addEventListener('input', calc);
    pkgs.forEach((r) => r.addEventListener('change', calc));
    calc();
  }
})();
