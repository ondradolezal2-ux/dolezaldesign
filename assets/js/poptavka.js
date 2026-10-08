/* Doležal Design — kalkulačka a poptávka (/poptavka/). Vanilla JS, bez závislostí
   a bez build kroku. Načítá se jen na téhle stránce (defer).
   Bez JS je formulář obyčejná dlouhá stránka se všemi otázkami, která se odešle
   rovnou na Formspree. S JS z něj je krokovač: jedna otázka na obrazovku, Zpět,
   kontrola výběru, na konci orientační cena a odeslání přes fetch bez opuštění
   stránky. Když odeslání selže, vyplněné údaje zůstanou a ukáže se telefon a WhatsApp. */
(() => {
  'use strict';

  /* ---------- Ceny: jediné místo, kde se mění ---------- */
  // Částky v Kč. null = cena zatím není: na stránce se místo ní ukáže [doplnit]
  // a celková cena „od 9 900 Kč + doplněk [doplnit]“. Až bude cena známá, stačí
  // null přepsat na číslo. Ceny v HTML (u voleb) jsou jen pro stránku bez JS,
  // tahle konfigurace je přepíše; při změně opravit i HTML v poptavka/index.html.
  const PRICES = {
    start: 9900,       // Start: jedna stránka, texty nejsou v ceně
    firma: 19900,      // Firma: až 5 stránek, texty v ceně
    obsah: 34900,      // Firma + obsah: Firma, plán obsahu na sítě na 3 měsíce a 3 články na blog
    vic: null,         // víc než 5 stránek: číslo se záměrně neuvádí, cena podle rozsahu
    texty: 2900,       // doplněk k balíčku Start: texty na web, od (Ondřej 2. 10. 2026)
    fotky: 990,        // doplněk: úprava vašich fotek pro web, od (Ondřej 2. 10. 2026)
    firmyCz: null,     // doplněk: profil na Firmy.cz [doplnit]; kalkulačka se na něj zatím neptá
    pece: [490, 990],  // Péče po spuštění, Kč měsíčně (rozpětí)
  };
  // balíčky, u kterých jsou texty v ceně: otázka „Kdo napíše texty?“ se přeskočí
  const TEXTS_INCLUDED = ['firma', 'obsah'];
  // e-shopy a webové aplikace se nedělají: když je někdo popíše, slušně to řekneme
  const SHOP = /\be[\s-]?shop|eshop|internetov\S*\s+obchod|online\s+obchod|aplikac/i;
  const SHOP_NOTE = 'E-shopy a webové aplikace na míru nedělám, ať to víte hned. Poptávku můžete poslat i tak.';

  const form = document.querySelector('[data-calc]');
  // prohlížeč bez fetch a FormData: zůstane dlouhý formulář, který se odešle sám
  if (!form || !window.fetch || !window.FormData) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel) => form.querySelector(sel);
  const steps = [...form.querySelectorAll('[data-step]')];
  const progress = document.querySelector('[data-calc-progress]');
  const done = document.querySelector('[data-calc-done]');
  const bar = $('[data-calc-bar]');
  const nextBtn = $('[data-calc-next]');
  const nextLabel = $('[data-calc-next-label]');
  const backBtn = $('[data-calc-back]');
  const privacy = $('[data-calc-privacy]');
  const status = $('[data-calc-status]');
  const total = $('[data-calc-total]');
  const list = $('[data-calc-list]');
  const quoteField = $('[data-calc-quote]');
  const urlField = $('[data-calc-url]');
  const textsHint = $('[data-calc-texts-hint]');
  const describe = $('[data-calc-describe]');
  const shopNote = $('[data-calc-shop]');

  /* ---------- Pomocníci ---------- */
  const checked = (name) => $(`input[name="${name}"]:checked`);
  const key = (name) => (checked(name) ? checked(name).dataset.key : '');
  // 9900 → „9 900“ s nezlomitelnými mezerami
  const num = (n) => n.toLocaleString('cs-CZ').replace(/\s/g, '\u00a0');
  const kc = (n) => `${num(n)}\u00a0Kč`;
  const care = () => `${num(PRICES.pece[0])}–${num(PRICES.pece[1])}\u00a0Kč/měs.`;
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const blank = () => el('span', 'blank', '[doplnit]');
  // cena doplňku: „+ od 2 900 Kč“ (ceny doplňků jsou „od“), bez ceny „+ [doplnit]“
  const addon = (price) => {
    const f = document.createDocumentFragment();
    f.append(price == null ? '+\u00a0' : '+\u00a0od\u00a0', price == null ? blank() : kc(price));
    return f;
  };
  const isShop = () => SHOP.test(describe.value);

  /* ---------- Ceny u voleb podle konfigurace ---------- */
  const fillPrice = (node, k) => {
    node.replaceChildren();
    node.classList.toggle('opt__price--soft', k === 'vic');
    if (k === 'vic') node.textContent = 'podle rozsahu';
    else if (k === 'pece') node.textContent = care();
    else if (k === 'texty' || k === 'fotky') node.append(addon(PRICES[k]));
    else if (PRICES[k] == null) node.append(blank());
    else node.textContent = `od\u00a0${kc(PRICES[k])}`;
  };
  form.querySelectorAll('[data-price]').forEach((n) => fillPrice(n, n.dataset.price));

  /* ---------- Kroky ---------- */
  // aktivní kroky: u balíčků s texty v ceně se otázka na texty vynechá
  const active = () => steps.filter((s) => !(s.dataset.step === 'texty' && TEXTS_INCLUDED.includes(key('rozsah'))));
  const answered = (s) => !s.querySelector('input[type="radio"]') || !!s.querySelector('input[type="radio"]:checked');
  let at = 0;                                                  // index kroku v active()
  let depth = (history.state && history.state.calcDepth) || 0; // kolik našich záznamů historie je za námi
  let sending = false;

  const setProgress = () => {
    const n = active().length;
    progress.textContent = `Krok ${at + 1} z ${n}`;
    bar.style.setProperty('--done', ((at + 1) / n).toFixed(4));
  };

  const clearError = (step) => {
    const err = step.querySelector('[data-calc-error]');
    if (err) err.hidden = true;
  };
  // chybová hláška u otázky: role="alert" ji přečte, fokus skočí na první volbu
  const showError = (step) => {
    const err = step.querySelector('[data-calc-error]');
    const text = err.textContent;
    err.textContent = '';
    err.hidden = false;
    requestAnimationFrame(() => { err.textContent = text; });  // přečíst znovu i při opakování
    step.querySelector('input[type="radio"]').focus();
  };

  // otázka na texty: nápověda a cena podle zvoleného balíčku
  const updateTexts = () => {
    const vic = key('rozsah') === 'vic';
    textsHint.textContent = vic
      ? 'U většího webu započítám texty do ceny podle rozsahu.'
      : 'U balíčku Start nejsou texty v ceně. Můžu je napsat jako doplněk.';
    const tag = $('[data-price="texty"]');
    if (vic) { tag.replaceChildren('podle rozsahu'); tag.classList.add('opt__price--soft'); }
    else fillPrice(tag, 'texty');
  };

  // když začátek kalkulačky není vidět (nebo je hluboko dole), dojet k němu
  const bringIntoView = (anchor) => {
    const top = anchor.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.4) anchor.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const show = (i, { focus = true, push = true } = {}) => {
    const all = active();
    at = Math.max(0, Math.min(i, all.length - 1));
    const step = all[at];
    const last = at === all.length - 1;
    steps.forEach((s) => { s.hidden = s !== step; });
    setProgress();
    backBtn.hidden = at === 0;
    nextLabel.textContent = last ? 'Odeslat poptávku' : 'Další';
    privacy.hidden = !last;
    status.replaceChildren();
    clearError(step);
    if (step.dataset.step === 'texty') updateTexts();
    if (last) renderQuote();
    if (push) history.pushState({ calc: step.dataset.step, calcDepth: ++depth }, '');
    if (focus) {
      step.querySelector('.q__title').focus({ preventScroll: true });
      bringIntoView(progress);
    }
  };

  const next = () => {
    const step = active()[at];
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
    const all = active();
    // vynechaný krok (texty u Firmy): nejbližší další aktivní
    const order = steps.findIndex((s) => s.dataset.step === name);
    let i = all.findIndex((s) => steps.indexOf(s) >= order);
    if (i < 0) i = all.length - 1;
    // nepustit dál než k první nezodpovězené otázce
    const gap = all.findIndex((s) => !answered(s));
    if (gap >= 0 && i > gap) i = gap;
    show(i, { push: false });
    if (all[i].dataset.step !== name) history.replaceState({ calc: all[i].dataset.step, calcDepth: depth }, '');
  });

  /* ---------- Reakce na volby ---------- */
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type !== 'radio') return;
    clearError(t.closest('[data-step]'));
    if (t.name === 'rozsah') setProgress();               // u Firmy je o krok méně
    if (t.name === 'ma_web') urlField.hidden = key('ma_web') !== 'ano';
  });
  // ovládání z klávesnice (pro kroužek fokusu kolem řádku volby, viz main.css)
  form.addEventListener('keydown', () => form.setAttribute('data-kbd', ''));
  form.addEventListener('pointerdown', () => form.removeAttribute('data-kbd'));
  describe.addEventListener('input', () => {
    const text = isShop() ? SHOP_NOTE : '';
    if (shopNote.textContent !== text) shopNote.textContent = text;
  });

  /* ---------- Orientační cena ---------- */
  const quote = () => {
    const pkg = key('rozsah');
    const extras = [];
    if (pkg === 'start' && key('texty') === 'napsat') extras.push(PRICES.texty);
    if (key('fotky') === 'upravit') extras.push(PRICES.fotky);
    const base = pkg === 'vic' ? null : PRICES[pkg];
    return {
      pkg,
      base,
      sum: base == null ? null : extras.reduce((s, p) => s + (p || 0), base),
      unknown: extras.filter((p) => p == null).length,   // doplňky bez ceny ([doplnit])
      care: key('pece') === 'ano',
    };
  };

  const row = (title, sub, value) => {
    const d = el('div');
    const dt = el('dt', null, title);
    if (sub) dt.append(el('span', null, sub));
    const dd = el('dd');
    if (value) dd.append(value);
    d.append(dt, dd);
    return d;
  };

  function renderQuote() {
    const q = quote();
    const extra = q.unknown > 1 ? 'doplňky' : 'doplněk';

    // velká cena: „od 9 900 Kč“, u víc než 5 stránek bez čísla
    const sum = el('p', 'calc__sum');
    if (q.sum == null) sum.textContent = 'Podle rozsahu';
    else sum.append(el('small', null, 'od'), `\u00a0${num(q.sum)}\u00a0`, el('small', null, 'Kč'));
    const parts = [sum];
    if (q.sum == null) parts.push(el('p', 'calc__plus', 'Víc než 5 stránek spočítám podle toho, co na nich má být.'));
    else if (q.unknown) { const p = el('p', 'calc__plus', `+ ${extra} `); p.append(blank()); parts.push(p); }
    if (q.care) parts.push(el('p', 'calc__care', `a Péče ${care()}`));
    if (isShop()) parts.push(el('p', 'calc__plus', SHOP_NOTE));
    total.replaceChildren(...parts);

    // co jste vybrali a za kolik
    const included = TEXTS_INCLUDED.includes(q.pkg);
    const texts = included
      ? row('Texty', 'píšu je já', 'v\u00a0ceně')
      : row('Texty', checked('texty') ? checked('texty').value : '',
        key('texty') === 'napsat' ? (q.pkg === 'vic' ? 'podle rozsahu' : addon(PRICES.texty)) : '');
    list.replaceChildren(
      row('Web', checked('rozsah') ? checked('rozsah').value : '', q.base == null ? 'podle rozsahu' : `od\u00a0${kc(q.base)}`),
      texts,
      row('Fotky', checked('fotky') ? checked('fotky').value : '', key('fotky') === 'upravit' ? addon(PRICES.fotky) : ''),
      q.care ? row('Péče po spuštění', 'ano', care()) : row('Péče po spuštění', 'zatím ne, prvních 30 dní úprav je v ceně', ''),
    );

    // totéž čitelně do poptávky (pole orientacni_cena)
    let text = q.sum == null ? 'podle rozsahu' : `od ${num(q.sum)} Kč`;
    if (q.sum != null && q.unknown) text += ` + ${extra} [doplnit]`;
    if (q.care) text += `; Péče ${care()}`;
    if (isShop()) text += '; popis zmiňuje e-shop nebo aplikaci';
    quoteField.value = text.replace(/\u00a0/g, ' ');
  }

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
    help.append('Nebo mi rovnou zavolejte na ', link('tel:+420773715894', '773\u00a0715\u00a0894'),
      ' či napište na ', link('https://wa.me/420773715894', 'WhatsApp'), '.');
    status.replaceChildren(el('p', null, 'Poptávku se nepodařilo odeslat. Vyplněné údaje zůstaly ve formuláři, zkuste to prosím znovu.'), help);
  };
  const success = () => {
    form.hidden = true;
    done.hidden = false;
    progress.textContent = 'Odesláno';
    done.querySelector('.q__title').focus({ preventScroll: true });
    bringIntoView(progress);
    // měření jen se souhlasem: gtag existuje, až když ho main.js po souhlasu načte
    if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead');
  };

  // Enter v textovém poli i tlačítko Další jdou přes submit: do posledního kroku jen dál
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const all = active();
    if (at < all.length - 1) { next(); return; }
    const gap = all.findIndex((s) => !answered(s));
    if (gap >= 0) { show(gap); showError(all[gap]); return; }
    if (!checkContact()) return;

    renderQuote();
    const data = new FormData(form);
    if (TEXTS_INCLUDED.includes(key('rozsah'))) data.set('texty', 'V ceně balíčku');
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
  bar.hidden = false;
  $('[data-calc-result]').hidden = false;
  urlField.hidden = key('ma_web') !== 'ano';
  form.querySelectorAll('.q__title').forEach((h) => h.setAttribute('aria-describedby', 'calc-progress'));
  // předvybraný balíček z odkazu: /poptavka/?balicek=start|firma|obsah|vic
  const pre = new URLSearchParams(location.search).get('balicek');
  if (['start', 'firma', 'obsah', 'vic'].includes(pre)) $(`input[name="rozsah"][data-key="${pre}"]`).checked = true;
  history.replaceState({ calc: 'obor', calcDepth: depth }, '');
  show(0, { focus: false, push: false });
})();
