/* Doležal Design — žádost o ukázku webu zdarma (/ukazka/). Vanilla JS, bez závislostí
   a bez build kroku. Načítá se jen na téhle stránce (defer).
   Bez JS je to obyčejný formulář, který se odešle rovnou na Formspree (pole pro odkaz
   na profil je pak vidět vždy). S JS: zaškrtnutí „Web zatím nemám“ vypne adresu webu
   a ukáže odkaz na profil, pole se kontrolují s hláškou přímo u pole, odeslání jde přes
   fetch bez opuštění stránky a místo formuláře se ukáže poděkování. Když odeslání selže,
   vyplněné údaje zůstanou a ukáže se telefon a WhatsApp.
   Hlášky, odeslání i chybový stav jsou stejné jako u kalkulačky (poptavka.js); pár
   pomocníků je tu záměrně zopakovaných, aby se kalkulačka nemusela přestavovat. */
(() => {
  'use strict';

  const form = document.querySelector('[data-ask]');
  // prohlížeč bez fetch a FormData: zůstane obyčejný formulář, který se odešle sám
  if (!form || !window.fetch || !window.FormData) return;

  const $ = (sel) => form.querySelector(sel);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const done = document.querySelector('[data-ask-done]');
  const send = $('[data-ask-send]');
  const sendLabel = $('[data-ask-send-label]');
  const status = $('[data-ask-status]');
  const noWeb = $('[data-ask-noweb]');
  const web = $('[data-ask-web]');
  const profilField = $('[data-ask-profil]');
  const profil = profilField.querySelector('input');
  const LABEL = sendLabel.textContent;
  let sending = false;

  /* ---------- Pomocníci ---------- */
  const el = (tag, text) => {
    const e = document.createElement(tag);
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

  /* ---------- Web zatím nemám: místo adresy webu odkaz na profil ---------- */
  // Vypnuté pole se neodešle, takže do žádosti jde vždy jen to, co platí.
  const toggle = () => {
    const none = noWeb.checked;
    web.disabled = none;
    profil.disabled = !none;
    profilField.hidden = !none;
    fieldError(none ? web : profil, '');
  };
  noWeb.addEventListener('change', toggle);

  /* ---------- Kontrola polí ---------- */
  const rules = [
    [web, (v) => (noWeb.checked ? ''
      : !v.trim() ? 'Napište prosím adresu svého webu, nebo zaškrtněte, že web zatím nemáte.'
        : !looksLikeUrl(v) ? 'Adresa vypadá neúplně, zkontrolujte ji prosím. Stačí třeba mojefirma.cz.' : '')],
    [profil, (v) => (!noWeb.checked || v.trim() ? '' : 'Pošlete prosím odkaz na profil, ať mám z čeho ukázku připravit.')],
    [$('#obor'), (v) => (v.trim() ? '' : 'Napište prosím, čím se zabýváte.')],
    [$('#jmeno'), (v) => (v.trim() ? '' : 'Napište prosím své jméno.')],
    [$('#telefon'), (v) => (!v.trim() ? 'Napište prosím telefon, ať se vám můžu ozvat.'
      : v.replace(/\D/g, '').length < 9 ? 'Telefon vypadá neúplně, zkontrolujte ho prosím.' : '')],
    [$('#email'), (v, input) => (v.trim() && !input.validity.valid ? 'E-mail vypadá neúplně, zkontrolujte ho prosím.' : '')],
  ];
  const check = () => {
    let first = null;
    rules.forEach(([input, test]) => {
      const msg = test(input.value, input);
      fieldError(input, msg);
      if (msg && !first) first = input;
    });
    if (first) first.focus();
    return !first;
  };
  // opravené pole hned přestane hlásit chybu
  rules.forEach(([input, test]) => input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true' && !test(input.value, input)) fieldError(input, '');
  }));

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
    // nadpis „Pošlete odkaz.“ už neplatí: poděkování stojí samo jako v kalkulačce
    const heading = document.querySelector('[data-ask-title]');
    if (heading) heading.hidden = true;
    const title = done.querySelector('[tabindex="-1"]');
    title.focus({ preventScroll: true });
    const top = title.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.6) title.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    // měření jen se souhlasem: gtag existuje, až když ho main.js po souhlasu načte
    if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { lead_type: 'ukazka' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending || !check()) return;
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
  form.classList.add('ask--js');
  toggle();                   // i po návratu na stránku, kdy prohlížeč obnoví zaškrtnutí
})();
