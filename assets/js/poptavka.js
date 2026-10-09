/* Doležal Design — kalkulačka a poptávka (/poptavka/). Vanilla JS, bez závislostí
   a bez build kroku. Načítá se jen na téhle stránce (defer).
   Varianta A „karta s průvodcem“ (v30, vybral Ondřej 9. 10. 2026): pět kroků v kartě,
   nahoře úseky průběhu a hotové odpovědi jako štítky (klepnutím se k nim dá vrátit),
   ve 3. kroku balíček a doplňky jako stavebnice s průběžným součtem. Souhrn s cenou
   je od 1024 px vedle karty, na menších obrazovkách cena v liště s tlačítkem.
   Bez JS je formulář obyčejná dlouhá stránka se všemi otázkami, která se odešle
   rovnou na Formspree. S JS krokovač, Zpět přes historii prohlížeče, kontrola výběru
   a odeslání přes fetch bez opuštění stránky. Když odeslání selže, vyplněné údaje
   zůstanou a ukáže se telefon a WhatsApp. */
(() => {
  'use strict';

  /* ---------- Ceny: jediné místo, kde se mění ---------- */
  // Částky v Kč, stejné jako na stránce Služby a ceny. Ceny v HTML (u voleb) jsou jen
  // pro stránku bez JS, tahle konfigurace je přepíše; při změně opravit i HTML.
  const PRICES = {
    start: 9900,       // Start: jedna stránka, texty nejsou v ceně, Google profil je
    firma: 19900,      // Firma: až 5 stránek, texty v ceně
    obsah: 34900,      // Firma + obsah: Firma, plán obsahu na sítě na 3 měsíce a 3 články na blog
    vic: null,         // víc než 5 stránek: číslo se záměrně neuvádí, cena podle rozsahu
    texty: 2900,       // doplněk: texty na web, od (Ondřej 2. 10. 2026)
    fotky: 990,        // doplněk: úprava vašich fotek pro web, od (Ondřej 2. 10. 2026)
    pece: [490, 990],  // Péče po spuštění, Kč měsíčně (rozpětí)
  };
  // Google profil firmy a profil na Firmy.cz jsou „po domluvě“ (bez čísla, do součtu se
  // nepočítají). Nové doplňky z briefu (napojení na Google, Seznam a AI; další stránka)
  // přidat do HTML i sem, až Ondřej schválí ceny.
  // balíčky, ve kterých je doplněk v ceně (zaškrtnutý a nejde odškrtnout)
  const INCLUDED = { texty: ['firma', 'obsah'], google: ['start'] };
  // e-shopy a webové aplikace se nedělají: když je někdo popíše, slušně to řekneme
  const SHOP = /\be[\s-]?shop|eshop|internetov\S*\s+obchod|online\s+obchod|aplikac/i;
  const SHOP_NOTE = 'E-shopy a webové aplikace na míru nedělám, ať to víte hned. Poptávku můžete poslat i tak.';

  const form = document.querySelector('[data-calc]');
  // prohlížeč bez fetch a FormData: zůstane dlouhý formulář, který se odešle sám
  if (!form || !window.fetch || !window.FormData) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const steps = [...form.querySelectorAll('[data-step]')];
  const prog = $('[data-calc-prog]');
  const progress = $('[data-calc-progress]');
  const left = $('[data-calc-left]', prog);
  const bar = $('[data-calc-bar]');
  const chips = $('[data-calc-chips]');
  const done = $('[data-calc-done]');
  const nextBtn = $('[data-calc-next]');
  const nextLabel = $('[data-calc-next-label]');
  const backBtn = $('[data-calc-back]');
  const privacy = $('[data-calc-privacy]');
  const status = $('[data-calc-status]');
  const quoteField = $('[data-calc-quote]');
  const urlField = $('[data-calc-url]');
  const describe = $('[data-calc-describe]');
  const shopNote = $('[data-calc-shop]');
  const sum = $('[data-calc-sum]');
  const lines = $('[data-calc-lines]');
  const total = $('[data-calc-total]');
  const recap = $('[data-calc-recap]');
  const mtotal = $('[data-calc-mtotal]');
  const mlabel = $('[data-calc-mlabel]');
  const mvalue = $('[data-calc-mvalue]');

  /* ---------- Pomocníci ---------- */
  const checked = (name) => $(`input[name="${name}"]:checked`, form);
  const key = (name) => (checked(name) ? checked(name).dataset.key : '');
  // 9900 → „9 900“ s nezlomitelnými mezerami
  const num = (n) => n.toLocaleString('cs-CZ').replace(/\s/g, ' ');
  const kc = (n) => `${num(n)} Kč`;
  const care = () => `${num(PRICES.pece[0])}–${num(PRICES.pece[1])} Kč/měs.`;
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const isShop = () => SHOP.test(describe.value);
  // 1 krok, 2–4 kroky, 5 a víc kroků
  const kroky = (n) => (n === 1 ? 'krok' : n < 5 ? 'kroky' : 'kroků');

  /* ---------- Ceny u balíčků podle konfigurace ---------- */
  form.querySelectorAll('[data-price]').forEach((n) => {
    const k = n.dataset.price;
    n.textContent = PRICES[k] == null ? 'cena podle rozsahu' : `od ${kc(PRICES[k])}`;
  });

  /* ---------- Doplňky ---------- */
  // u každého si pamatujeme volbu člověka (data-user), aby se po změně balíčku vrátila
  const mods = [...form.querySelectorAll('[data-mod]')].map((row) => {
    const input = $('input', row);
    const note = $('[data-mod-note]', row);
    input.dataset.user = String(input.checked);   // i stav, který po návratu obnovil prohlížeč
    return {
      k: row.dataset.mod,
      row,
      input,
      price: $('[data-mod-price]', row),
      note,
      noteText: note ? note.textContent : '',
      name: $('.mod__name', row).firstChild.textContent.trim(),
    };
  });
  const mod = (k) => mods.find((m) => m.k === k);
  const included = (k, pkg) => !!INCLUDED[k] && INCLUDED[k].includes(pkg);

  // cena a stav doplňku podle zvoleného balíčku
  const modPrice = (m, pkg) => {
    if (included(m.k, pkg)) return 'v ceně';
    if (m.k === 'texty') return pkg === 'vic' ? 'podle rozsahu' : `+ od ${kc(PRICES.texty)}`;
    if (m.k === 'fotky') return `+ od ${kc(PRICES.fotky)}`;
    if (m.k === 'pece') return care();
    return 'po domluvě';
  };
  const syncMods = () => {
    const pkg = key('rozsah');
    mods.forEach((m) => {
      const inc = included(m.k, pkg);
      m.input.disabled = inc;
      m.input.checked = inc || m.input.dataset.user === 'true';
      m.row.classList.toggle('is-included', inc);
      const price = modPrice(m, pkg);
      m.price.textContent = price;
      m.price.classList.toggle('mod__price--soft', !/\d/.test(price));
      if (m.note) {
        if (m.k === 'texty') m.note.textContent = inc ? 'píšu je já, jsou v ceně balíčku' : m.noteText;
        if (m.k === 'google') m.note.textContent = inc ? 'je v balíčku Start' : m.noteText;
      }
    });
  };

  /* ---------- Orientační cena ---------- */
  const quote = () => {
    const pkg = key('rozsah');
    const base = pkg ? PRICES[pkg] : null;
    const items = [];
    let total = base;
    let talk = 0;                                   // doplňky „po domluvě“
    if (pkg) items.push([checked('rozsah').dataset.name, base == null ? 'podle rozsahu' : `od ${kc(base)}`]);
    mods.forEach((m) => {
      if (m.k === 'pece' || !m.input.checked) return;
      const price = modPrice(m, pkg);
      items.push([m.name, price]);
      if (included(m.k, pkg)) return;
      if (m.k === 'texty' && pkg !== 'vic') total = total == null ? null : total + PRICES.texty;
      else if (m.k === 'fotky') total = total == null ? null : total + PRICES.fotky;
      else if (m.k !== 'texty') talk += 1;
    });
    return { pkg, total, items, talk, care: mod('pece').input.checked };
  };

  // „+ 2 položky po domluvě“
  const talkText = (n) => `+ ${n} ${n === 1 ? 'položka' : n < 5 ? 'položky' : 'položek'} po domluvě`;

  const listOf = (items) => {
    const dl = el('dl', 'pf__lines');
    items.forEach(([name, value]) => {
      const d = el('div');
      d.append(el('dt', null, name), el('dd', /\d/.test(value) ? null : 'is-soft', value));
      dl.append(d);
    });
    return dl;
  };

  function renderQuote() {
    const q = quote();

    // souhrn vedle karty
    if (!q.pkg) {
      lines.replaceChildren(el('p', 'pf__empty', 'Cenu uvidíte, až ve 3. kroku vyberete balíček.'));
    } else {
      lines.replaceChildren(listOf(q.items));
    }
    const row = el('p', 'pf__total-row');
    row.append(el('span', null, q.pkg && q.total != null ? 'Celkem od' : 'Celkem'),
      el('b', null, !q.pkg ? '–' : q.total == null ? 'podle rozsahu' : kc(q.total)));
    const parts = [row];
    if (q.pkg && q.total == null) parts.push(el('p', 'pf__plus', 'Víc než 5 stránek spočítám podle toho, co na nich má být.'));
    if (q.talk) parts.push(el('p', 'pf__plus', talkText(q.talk)));
    if (q.care) parts.push(el('p', 'pf__plus pf__plus--care', `a Péče ${care()}`));
    if (isShop()) parts.push(el('p', 'pf__plus', SHOP_NOTE));
    total.replaceChildren(...parts);

    // lišta s cenou (mobil a tablet): od 3. kroku, když je vybraný balíček
    mlabel.textContent = q.total != null ? 'Celkem od' : 'Celkem';
    mvalue.textContent = q.total != null ? kc(q.total) : 'podle rozsahu';

    // shrnutí v posledním kroku (mobil a tablet)
    if (q.pkg) {
      const change = el('button', 'calc__back', 'Změnit výběr');
      change.type = 'button';
      change.addEventListener('click', () => show(steps.findIndex((s) => s.dataset.step === 'rozsah')));
      const head = el('p', 'pf__recap-total');
      head.append(el('span', null, q.total != null ? 'Celkem od' : 'Celkem'), el('b', null, q.total != null ? kc(q.total) : 'podle rozsahu'));
      const extra = [];
      if (q.talk) extra.push(el('p', 'pf__plus', talkText(q.talk)));
      if (q.care) extra.push(el('p', 'pf__plus pf__plus--care', `a Péče ${care()}`));
      recap.replaceChildren(listOf(q.items), head, ...extra, change);
    }

    // totéž čitelně do poptávky (pole orientacni_cena)
    let text = !q.pkg ? 'nevybráno' : q.total == null ? 'podle rozsahu' : `od ${num(q.total)} Kč`;
    if (q.talk) text += ` ${talkText(q.talk)}`;
    if (q.care) text += `; Péče ${care()}`;
    if (isShop()) text += '; popis zmiňuje e-shop nebo aplikaci';
    quoteField.value = text.replace(/ /g, ' ');
    return q;
  }

  /* ---------- Kroky ---------- */
  // povinná je jen volba v .opts / .pks; termín v posledním kroku je nepovinný
  const group = (s) => $('.opts, .pks', s);
  const answered = (s) => !group(s) || !!$('input:checked', group(s));
  let at = 0;                                                  // index aktuálního kroku
  let depth = (history.state && history.state.calcDepth) || 0; // kolik našich záznamů historie je za námi
  let sending = false;

  const setProgress = () => {
    const n = steps.length;
    const rest = n - at - 1;
    progress.textContent = `Krok ${at + 1} z ${n}`;
    left.textContent = rest === 0 ? 'Poslední krok' : `${rest === 1 ? 'Zbývá' : rest < 5 ? 'Zbývají' : 'Zbývá'} ${rest} ${kroky(rest)}`;
    bar.replaceChildren(...steps.map((s, i) => el('i', i < at ? 'is-done' : i === at ? 'is-now' : null)));
    // hotové odpovědi z předchozích kroků: štítek s fajfkou, klepnutím zpět k otázce
    chips.replaceChildren(...steps.slice(0, at).map((s, i) => {
      const input = group(s) && $('input:checked', group(s));
      if (!input) return null;
      const li = el('li');
      const b = el('button', 'pf__chip');
      b.type = 'button';
      b.setAttribute('aria-label', `Změnit: ${input.dataset.chip}`);
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      b.append(input.dataset.chip);
      b.addEventListener('click', () => show(i));
      li.append(b);
      return li;
    }).filter(Boolean));
    chips.hidden = !chips.children.length;
  };

  const clearError = (step) => {
    const err = $('[data-calc-error]', step);
    if (err) err.hidden = true;
  };
  // chybová hláška u otázky: role="alert" ji přečte, fokus skočí na první volbu
  const showError = (step) => {
    const err = $('[data-calc-error]', step);
    const text = err.textContent;
    err.textContent = '';
    err.hidden = false;
    requestAnimationFrame(() => { err.textContent = text; });  // přečíst znovu i při opakování
    $('input[type="radio"]', group(step)).focus();
  };

  // když začátek karty není vidět (nebo je hluboko dole), dojet k němu
  const bringIntoView = (anchor) => {
    const top = anchor.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.4) anchor.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const updateBar = () => {
    // cena v liště od kroku s balíčkem, kromě posledního kroku (tam je shrnutí)
    const i = steps.findIndex((s) => s.dataset.step === 'rozsah');
    mtotal.hidden = !key('rozsah') || at < i || at === steps.length - 1;
  };

  const show = (i, { focus = true, push = true } = {}) => {
    at = Math.max(0, Math.min(i, steps.length - 1));
    const step = steps[at];
    const last = at === steps.length - 1;
    steps.forEach((s) => { s.hidden = s !== step; });
    setProgress();
    backBtn.hidden = at === 0;
    nextLabel.textContent = last ? 'Odeslat poptávku' : 'Pokračovat';
    privacy.hidden = !last;
    status.replaceChildren();
    clearError(step);
    renderQuote();
    recap.hidden = !last || !key('rozsah');
    updateBar();
    if (push) history.pushState({ calc: step.dataset.step, calcDepth: ++depth }, '');
    if (focus) {
      $('.q__title', step).focus({ preventScroll: true });
      bringIntoView(prog);
    }
  };

  const next = () => {
    const step = steps[at];
    if (!answered(step)) { showError(step); return; }
    show(at + 1);
  };

  // Zpět: přes historii prohlížeče, aby systémové „zpět“ na mobilu fungovalo stejně
  backBtn.addEventListener('click', () => {
    if (depth > 0 && history.state && history.state.calc) history.back();
    else show(at - 1, { push: false });
  });
  addEventListener('popstate', (e) => {
    const name = e.state && e.state.calc;
    if (!name || form.hidden) return;
    depth = e.state.calcDepth || 0;
    let i = steps.findIndex((s) => s.dataset.step === name);
    if (i < 0) i = 0;
    // nepustit dál než k první nezodpovězené otázce
    const gap = steps.findIndex((s) => !answered(s));
    if (gap >= 0 && i > gap) i = gap;
    show(i, { push: false });
    if (steps[i].dataset.step !== name) history.replaceState({ calc: steps[i].dataset.step, calcDepth: depth }, '');
  });

  /* ---------- Reakce na volby ---------- */
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type === 'checkbox' && t.closest('[data-mod]')) {
      t.dataset.user = String(t.checked);
      renderQuote();
      return;
    }
    if (t.type !== 'radio') return;
    clearError(t.closest('[data-step]'));
    if (t.name === 'rozsah') { syncMods(); renderQuote(); updateBar(); }
    if (t.name === 'ma_web') urlField.hidden = key('ma_web') !== 'ano';
  });
  // ovládání z klávesnice (pro kroužek fokusu kolem volby, viz main.css)
  form.addEventListener('keydown', () => form.setAttribute('data-kbd', ''));
  form.addEventListener('pointerdown', () => form.removeAttribute('data-kbd'));
  describe.addEventListener('input', () => {
    const text = isShop() ? SHOP_NOTE : '';
    if (shopNote.textContent !== text) shopNote.textContent = text;
  });

  /* ---------- Kontakt: kontrola polí ---------- */
  const fieldError = (input, msg) => {
    const err = document.getElementById(`${input.id}-chyba`);
    if (msg) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', err.id);
      err.textContent = msg;
      err.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      err.textContent = '';
      err.hidden = true;
    }
  };
  const contact = [
    [$('#jmeno'), (v) => (v.trim() ? '' : 'Napište prosím své jméno.')],
    [$('#telefon'), (v) => (!v.trim() ? 'Napište prosím telefon, ať se vám můžu ozvat.'
      : v.replace(/\D/g, '').length < 9 ? 'Telefon vypadá neúplně, zkontrolujte ho prosím.' : '')],
    [$('#email'), (v, input) => (v.trim() && !input.validity.valid ? 'E-mail vypadá neúplně, zkontrolujte ho prosím.' : '')],
  ];
  const checkContact = () => {
    let first = null;
    contact.forEach(([input, test]) => {
      const msg = test(input.value, input);
      fieldError(input, msg);
      if (msg && !first) first = input;
    });
    if (first) first.focus();
    return !first;
  };
  // opravené pole hned přestane hlásit chybu
  contact.forEach(([input, test]) => input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true' && !test(input.value, input)) fieldError(input, '');
  }));

  /* ---------- Odeslání ---------- */
  const link = (href, text) => {
    const a = el('a', null, text);
    a.href = href;
    if (href.startsWith('http')) a.rel = 'noopener';
    return a;
  };
  const failure = () => {
    const help = el('p');
    help.append('Nebo mi rovnou zavolejte na ', link('tel:+420773715894', '773 715 894'),
      ' či napište na ', link('https://wa.me/420773715894', 'WhatsApp'), '.');
    status.replaceChildren(el('p', null, 'Poptávku se nepodařilo odeslat. Vyplněné údaje zůstaly ve formuláři, zkuste to prosím znovu.'), help);
  };
  const success = () => {
    form.hidden = true;
    sum.hidden = true;
    done.hidden = false;
    $('.q__title', done).focus({ preventScroll: true });
    bringIntoView(done);
    // měření jen se souhlasem: gtag existuje, až když ho main.js po souhlasu načte
    if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead');
  };

  // Enter v textovém poli i tlačítko Pokračovat jdou přes submit: do posledního kroku jen dál
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    if (at < steps.length - 1) { next(); return; }
    const gap = steps.findIndex((s) => !answered(s));
    if (gap >= 0) { show(gap); showError(steps[gap]); return; }
    if (!checkContact()) return;

    renderQuote();
    const data = new FormData(form);
    const pkg = key('rozsah');
    // doplněk v ceně balíčku je vypnutý (disabled), takže by se neodeslal
    mods.forEach((m) => { if (included(m.k, pkg)) data.set(m.input.name, 'V ceně balíčku'); });
    if (key('ma_web') !== 'ano') data.delete('web_url');

    sending = true;
    nextBtn.disabled = true;
    nextLabel.textContent = 'Odesílám…';
    form.setAttribute('aria-busy', 'true');
    status.replaceChildren();
    let ok = false;
    try {
      const res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      ok = res.ok;
    } catch (err) {
      ok = false;
    }
    sending = false;
    nextBtn.disabled = false;
    nextLabel.textContent = 'Odeslat poptávku';
    form.removeAttribute('aria-busy');
    if (ok) success();
    else { failure(); nextBtn.focus(); }
  });

  /* ---------- Start ---------- */
  form.noValidate = true;                 // kontrolu dělá skript, s vlastními hláškami
  form.classList.add('calc--steps');
  prog.hidden = false;
  sum.hidden = false;
  urlField.hidden = key('ma_web') !== 'ano';
  steps.forEach((s) => $('.q__title', s).setAttribute('aria-describedby', 'calc-progress'));
  // předvybraný balíček z odkazu: /poptavka/?balicek=start|firma|obsah|vic
  const params = new URLSearchParams(location.search);
  const pre = params.get('balicek');
  if (['start', 'firma', 'obsah', 'vic'].includes(pre)) $(`input[name="rozsah"][data-key="${pre}"]`, form).checked = true;
  // předvybraný obor (odkaz z úvodu): /poptavka/?obor=remeslo|sluzba|reality|jine, začne se 2. krokem
  const obor = params.get('obor');
  const fromObor = ['remeslo', 'sluzba', 'reality', 'jine'].includes(obor);
  if (fromObor) $(`input[name="obor"][data-key="${obor}"]`, form).checked = true;
  syncMods();
  history.replaceState({ calc: steps[fromObor ? 1 : 0].dataset.step, calcDepth: depth }, '');
  show(fromObor ? 1 : 0, { focus: false, push: false });
})();
