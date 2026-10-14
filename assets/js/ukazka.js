/* Doležal Design — žádost o ukázku webu zdarma (/ukazka/). Vanilla JS, bez závislostí
   a bez build kroku. Načítá se jen na téhle stránce (defer).
   Od 14. 10. 2026 (v31, varianta B) ve vzhledu poptávky: dva kroky v kartě, nahoře
   „Krok 1 ze 2“, úseky průběhu a hotové odpovědi jako štítky (klepnutím zpět).
   1. Máte teď web? (Mám web → adresa, Web zatím nemám → profil na Googlu či Facebooku) a obor.
   2. Kam vám ukázku poslat? (jméno, telefon, nepovinně e-mail a poznámka).
   Bez JS je to obyčejný formulář se vším pod sebou, který se odešle rovnou na Formspree.
   S JS: kontrola polí s hláškou přímo u pole, odeslání přes fetch bez opuštění stránky
   a místo formuláře poděkování. Když odeslání selže, údaje zůstanou a ukáže se telefon
   a WhatsApp. Hlášky a odeslání stejné jako u kalkulačky (poptavka.js). */
(() => {
  'use strict';

  const form = document.querySelector('[data-ask]');
  // prohlížeč bez fetch a FormData: zůstane obyčejný formulář, který se odešle sám
  if (!form || !window.fetch || !window.FormData) return;

  const $ = (sel, root = form) => root.querySelector(sel);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const steps = [...form.querySelectorAll('[data-krok]')];
  const prog = $('[data-ask-prog]');
  const krokText = $('[data-ask-krok]');
  const zbyva = $('[data-ask-zbyva]');
  const bar = $('[data-ask-bar]');
  const chips = $('[data-ask-chips]');
  const done = document.querySelector('[data-ask-done]');
  const send = $('[data-ask-send]');
  const sendLabel = $('[data-ask-send-label]');
  const back = $('[data-ask-back]');
  const privacy = $('[data-ask-privacy]');
  const status = $('[data-ask-status]');
  const web = $('#web-url');
  const profil = $('#profil-url');
  const obor = $('#obor');
  const LABEL = sendLabel.textContent;
  let at = 0;
  let sending = false;

  /* ---------- Pomocníci ---------- */
  const el = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const link = (href, text) => {
    const a = el('a', text);
    a.href = href;
    if (href.startsWith('http')) a.rel = 'noopener';
    return a;
  };
  // hláška u pole: přečte ji čtečka (aria-describedby), pole má aria-invalid
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
  // adresa webu: aspoň „neco.cz“, bez mezer (stačí bez https:// i bez www)
  const looksLikeUrl = (v) => /^\S+\.\S+$/.test(v.trim());
  const maWeb = () => $('[data-ask-volba]:checked').dataset.askVolba === 'ano';

  /* ---------- Mám web / Web zatím nemám ---------- */
  // Skryté pole je vypnuté, takže se neodešle: do žádosti jde vždy jen to, co platí.
  const toggle = () => {
    const ano = maWeb();
    form.querySelectorAll('[data-ask-pole]').forEach((f) => {
      const vidim = (f.dataset.askPole === 'ano') === ano;
      f.hidden = !vidim;
      $('input', f).disabled = !vidim;
    });
    fieldError(ano ? profil : web, '');
  };
  form.addEventListener('change', (e) => { if (e.target.matches('[data-ask-volba]')) toggle(); });
  // bez JS je u profilu „když web nemáte“, s JS se pole ukáže jen tehdy, takže je povinné
  $('[data-ask-profil-pozn]').textContent = 'povinné';

  /* ---------- Kontrola polí po krocích ---------- */
  const rules = [
    [[web, (v) => (!maWeb() ? ''
      : !v.trim() ? 'Napište prosím adresu svého webu, nebo vyberte, že web zatím nemáte.'
        : !looksLikeUrl(v) ? 'Adresa vypadá neúplně, zkontrolujte ji prosím. Stačí třeba mojefirma.cz.' : '')],
     [profil, (v) => (maWeb() || v.trim() ? '' : 'Pošlete prosím odkaz na profil, ať mám z čeho ukázku připravit.')],
     [obor, (v) => (v.trim() ? '' : 'Napište prosím, čím se zabýváte.')]],
    [[$('#jmeno'), (v) => (v.trim() ? '' : 'Napište prosím své jméno.')],
     [$('#telefon'), (v) => (!v.trim() ? 'Napište prosím telefon, ať se vám můžu ozvat.'
       : v.replace(/\D/g, '').length < 9 ? 'Telefon vypadá neúplně, zkontrolujte ho prosím.' : '')],
     [$('#email'), (v, input) => (v.trim() && !input.validity.valid ? 'E-mail vypadá neúplně, zkontrolujte ho prosím.' : '')]],
  ];
  const check = (krok) => {
    let first = null;
    rules[krok].forEach(([input, test]) => {
      const msg = test(input.value, input);
      fieldError(input, msg);
      if (msg && !first) first = input;
    });
    if (first) first.focus();
    return !first;
  };
  // opravené pole hned přestane hlásit chybu
  rules.flat().forEach(([input, test]) => input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true' && !test(input.value, input)) fieldError(input, '');
  }));

  /* ---------- Kroky ---------- */
  // když začátek karty není vidět (nebo je hluboko dole), dojet k němu
  const bringIntoView = (anchor) => {
    const top = anchor.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.4) anchor.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  const chip = (text) => {
    const li = el('li');
    const b = el('button', null, 'pf__chip');
    b.type = 'button';
    b.setAttribute('aria-label', `Změnit: ${text}`);
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    b.append(text);
    b.addEventListener('click', () => show(0));
    li.append(b);
    return li;
  };

  function show(i, { focus = true, push = true } = {}) {
    at = i;
    const last = at === steps.length - 1;
    steps.forEach((s, j) => { s.hidden = j !== at; });
    krokText.textContent = `Krok ${at + 1} ze ${steps.length}`;
    zbyva.textContent = last ? 'Poslední krok' : 'Zbývá 1 krok';
    [...bar.children].forEach((seg, j) => { seg.className = j < at ? 'is-done' : j === at ? 'is-now' : ''; });
    // hotové odpovědi z prvního kroku jako štítky (klepnutím zpět)
    if (last) {
      const w = maWeb() ? web.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Web zatím nemám';
      chips.replaceChildren(chip(w), chip(obor.value.trim()));
    } else {
      chips.replaceChildren();
    }
    chips.hidden = !last;
    back.hidden = !at;
    sendLabel.textContent = last ? LABEL : 'Pokračovat';
    privacy.hidden = !last;
    status.replaceChildren();
    if (push && last) history.pushState({ ask: 2 }, '');
    if (focus) {
      $('.q__title', steps[at]).focus({ preventScroll: true });
      bringIntoView(prog);
    }
  }

  // Zpět: přes historii prohlížeče, aby systémové „zpět“ na mobilu fungovalo stejně
  back.addEventListener('click', () => {
    if (history.state && history.state.ask === 2) history.back();
    else show(0, { push: false });
  });
  addEventListener('popstate', () => { if (!form.hidden && at) show(0, { push: false }); });

  /* ---------- Odeslání ---------- */
  const failure = () => {
    const help = el('p');
    help.append('Nebo mi rovnou zavolejte na ', link('tel:+420773715894', '773 715 894'),
      ' či napište na ', link('https://wa.me/420773715894', 'WhatsApp'), '.');
    status.replaceChildren(el('p', 'Žádost se nepodařilo odeslat. Vyplněné údaje zůstaly ve formuláři, zkuste to prosím znovu.'), help);
  };
  const success = () => {
    form.hidden = true;
    done.hidden = false;
    const title = $('[tabindex="-1"]', done);
    title.focus({ preventScroll: true });
    bringIntoView(done);
    // měření jen se souhlasem: gtag existuje, až když ho main.js po souhlasu načte
    if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { lead_type: 'ukazka' });
  };

  // Enter v poli i tlačítko jdou přes submit: v prvním kroku jen dál
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    if (at === 0) {
      if (check(0)) show(1);
      return;
    }
    if (!check(0)) { show(0, { push: false }); check(0); return; }
    if (!check(1)) return;
    const data = new FormData(form);

    sending = true;
    send.disabled = true;
    sendLabel.textContent = 'Odesílám…';
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
    send.disabled = false;
    sendLabel.textContent = LABEL;
    form.removeAttribute('aria-busy');
    if (ok) success();
    else { failure(); send.focus(); }
  });

  /* ---------- Start ---------- */
  form.noValidate = true;     // kontrolu dělá skript, s vlastními hláškami
  form.classList.add('calc--steps');
  prog.hidden = false;
  steps.forEach((s) => $('.q__title', s).setAttribute('aria-describedby', 'ask-progress'));
  toggle();                   // i po návratu na stránku, kdy prohlížeč obnoví volbu
  show(0, { focus: false, push: false });
})();
