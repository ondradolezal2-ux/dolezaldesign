/* Doležal Design — interaktivita webu. Vanilla JS, bez závislostí a bez build kroku.
   Každá stránka je kompletní i bez tohohle souboru. */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const saveData = navigator.connection && navigator.connection.saveData;
  const root = document.documentElement;

  /* ---------- Mobilní menu ---------- */
  // Tmavý panel přes celou obrazovku. Escape zavře a vrátí fokus na tlačítko, zbytek
  // stránky je po dobu otevření `inert`, takže Tab zůstane v hlavičce.
  const header = document.querySelector('[data-header]');
  const menuBtn = document.querySelector('[data-menu-btn]');
  if (header && menuBtn) {
    const label = menuBtn.querySelector('[data-menu-label]');
    const nav = document.getElementById(menuBtn.getAttribute('aria-controls'));
    const outside = [...document.body.children].filter((el) => el !== header && el.tagName !== 'SCRIPT');
    const wide = matchMedia('(min-width: 768px)');
    const setMenu = (open, { focus = true } = {}) => {
      header.toggleAttribute('data-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Zavřít' : 'Menu';
      document.documentElement.style.overflow = open ? 'hidden' : '';
      outside.forEach((el) => { el.inert = open; });
      if (open && focus && nav) nav.querySelector('a')?.focus();
    };
    menuBtn.addEventListener('click', () => {
      const open = menuBtn.getAttribute('aria-expanded') !== 'true';
      setMenu(open);
      if (!open) menuBtn.focus();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.hasAttribute('data-open')) { setMenu(false); menuBtn.focus(); }
    });
    nav?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false, { focus: false })));
    wide.addEventListener('change', (e) => { if (e.matches) setMenu(false, { focus: false }); });
  }

  /* ---------- Přechod z tmavého úvodu a stohování listů: zapnutí ---------- */
  // Rozhoduje se hned na začátku (třídy na <html>). Měření a náhradní řízení je níž,
  // za lepkavou lištou.
  const intro = document.querySelector('main > .scene, main > .head');
  const afterIntro = intro && intro.nextElementSibling;
  // jen podstránky (.head); úvodní stránka od v28 nebělá, úvod stojí a první list přes něj přejede
  const dusk = !!afterIntro && !reduceMotion && intro.classList.contains('head') && (afterIntro.classList.contains('sec') || afterIntro.classList.contains('sheet'));
  const native = dusk && CSS.supports('animation-timeline: view()') && CSS.supports('timeline-scope: --a');
  // úvodní stránka (v20): listy .sheet se při posunu stohují (přilepené, další přejede přes předchozí);
  // úvod (.scene) stojí taky, aby první list „Proč web“ přejel přes něj (v28)
  const sheets = reduceMotion ? [] : [...document.querySelectorAll('main > .sheet:not(.sheet--flow)')];
  const scene = sheets.length ? document.querySelector('main > .scene') : null;
  if (dusk) {
    intro.setAttribute('data-dusk', '');
    root.classList.add('dusk', native ? 'dusk--native' : 'dusk--js');
  }
  if (sheets.length) root.classList.add('sheets');

  /* ---------- Jemné objevení při posunu ---------- */
  // Co je vidět už při načtení, se neschovává (žádné problikutí). Zbytek se objeví
  // jednou, když dojede do obrazovky. Bez JS a s omezeným pohybem je vidět všechno.
  const reveals = [...document.querySelectorAll('[data-reveal]')];
  if (reveals.length && hasIO && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in');
      else io.observe(el);
    });
    root.classList.add('reveal-on');
  }

  /* ---------- Videa data-reel: stahují se a hrají, jen když jsou vidět ---------- */
  const reels = document.querySelectorAll('[data-reel]');
  if (reels.length) {
    if (reduceMotion || !hasIO || saveData) {
      reels.forEach((v) => { v.controls = true; });
    } else {
      const rio = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(() => { v.controls = true; }); }
          else v.pause();
        });
      }, { threshold: 0.5 });
      reels.forEach((v) => rio.observe(v));
    }
  }

  /* ---------- Lepkavá lišta dole na mobilu (úvodní stránka) ---------- */
  // Pod 900 px se ukáže, až úvod (.scene) zmizí: úvod stojí a přejede ho první list, takže
  // „pryč“ je, až vršek prvního listu dojede k horní hraně okna (značka na jeho vršku). Schová se, jakmile
  // dojede závěrečná výzva (má vlastní tlačítko) nebo patička, a když je vidět cookie
  // lišta. Dokud je lišta vidět, má tělo dole odsazení na její výšku. Bez JS zůstává
  // skrytá (atribut hidden v HTML), s omezeným pohybem se jen objeví bez vyjetí (CSS).
  const dock = document.querySelector('[data-dock]');
  const hero = document.querySelector('main > .scene');
  if (dock && hero && hasIO) {
    const narrow = matchMedia('(max-width: 899.98px)');
    const stops = [document.querySelector('main > .end'), document.querySelector('.foot')].filter(Boolean);
    const next = hero.nextElementSibling;
    let mark = hero;
    if (next) {
      mark = document.createElement('span');
      mark.setAttribute('aria-hidden', 'true');
      mark.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden';
      next.prepend(mark);
    }
    let heroGone = false;
    const consent = document.querySelector('[data-cookie-bar]');
    const inView = new Set();
    let ready = false, shown = false;
    const update = () => {
      if (!ready) return;
      const show = narrow.matches && heroGone && inView.size === 0 && !consent?.classList.contains('is-visible');
      if (show === shown) return;
      shown = show;
      dock.toggleAttribute('data-shown', show);
      document.body.style.paddingBottom = show ? `${dock.offsetHeight}px` : '';
    };
    const dio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.target === mark) heroGone = mark === hero ? !e.isIntersecting : !e.isIntersecting && e.boundingClientRect.top < 0;
        else if (e.isIntersecting) inView.add(e.target);
        else inView.delete(e.target);
      });
      ready = true;
      update();
    });
    dock.hidden = false;
    [mark, ...stops].forEach((el) => dio.observe(el));
    narrow.addEventListener('change', update);
    if (consent) new MutationObserver(update).observe(consent, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- Přechod z tmavé hlavy podstránky: měření a řízení ---------- */
  // Obsah tmavé hlavy (.head) při posunu odjede nahoru a zmizí. Průběh p: 0 = hlava celá
  // vidět, 1 = pryč. Úvodní stránka od v28 nebělá (úvod stojí, viz Stohování listů).
  // Kde to prohlížeč umí, řídí animace v CSS přímo posun (animation-timeline) a JS jen
  // měří; jinde JS jednou za snímek zapíše průběh do --p a CSS animace podle něj přetočí
  // (main.css, „Přechod z tmavého úvodu“). Bez JS a s omezeným pohybem nic z toho.
  // výška okna bez lišty prohlížeče (svh): nemění se, když lišta na mobilu zajede
  let probe = null;
  const viewH = () => {
    if (!probe) {
      probe = document.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
    }
    return probe.offsetHeight || innerHeight;
  };
  const relayoutAll = [];
  let relaying = false;
  const relayout = () => {
    if (relaying) return;
    relaying = true;
    requestAnimationFrame(() => { relaying = false; relayoutAll.forEach((fn) => fn()); });
  };

  if (dusk) {
    const main = intro.parentElement;
    const clamp01 = (v) => Math.min(1, Math.max(0, v));

    let introFrom = 0, introSpan = 1, lastP = -1;
    const layout = () => {
      // stejný rozsah jako v CSS: od chvíle, kdy spodek hlavy dojede ke spodku okna
      // (nebo vršek k vršku), po její zmizení (exit)
      const top = intro.getBoundingClientRect().top + scrollY;
      const ih = intro.offsetHeight;
      introFrom = ih <= innerHeight ? top : top + ih - innerHeight;
      introSpan = Math.max(1, top + ih - introFrom);
    };

    let queued = false;
    const paint = () => {
      queued = false;
      if (native) return;
      const p = Math.round(clamp01((scrollY - introFrom) / introSpan) * 1e4) / 1e4;
      if (p !== lastP) { lastP = p; main.style.setProperty('--p', p); }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };

    layout();
    paint();
    relayoutAll.push(() => { layout(); paint(); });
    if (!native) addEventListener('scroll', queue, { passive: true });
  }

  /* ---------- Stohování listů (úvodní stránka, v20) ---------- */
  // Každý list (.sheet) je přilepený (sticky, main.css „Stohování listů“) tak, že se zastaví,
  // jakmile jeho spodek dojede ke spodku okna: --stick = výška okna − výška listu, u listů
  // nižších než okno 0. Další list (v pořadí výš) přes něj přejede. Pod 900 px se od výšky
  // okna odečte lepkavá lišta, aby spodek listu nestál pod ní. Přepočet při načtení, písmu,
  // změně velikosti okna a obsahu (odpověď v testu, jiný obor). Úvod (.scene) se zastaví
  // stejně, jen bez odečtu lišty (ta je u úvodu schovaná); první list přes něj přejede (v28).
  if (sheets.length) {
    const narrow = matchMedia('(max-width: 899.98px)');
    const place = () => {
      const V = viewH() - (dock && narrow.matches ? dock.offsetHeight : 0);
      const hs = sheets.map((el) => el.offsetHeight);
      sheets.forEach((el, i) => el.style.setProperty('--stick', `${Math.min(0, Math.round(V - hs[i]))}px`));
      if (scene) scene.style.setProperty('--stick', `${Math.min(0, Math.round(viewH() - scene.offsetHeight))}px`);
    };
    place();
    relayoutAll.push(place);
    narrow.addEventListener('change', relayout);
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(relayout);
      sheets.forEach((el) => ro.observe(el));
      if (scene) ro.observe(scene);
    }

    // klávesnice: když fokus skočí na prvek listu, přes který už přejel další list (třeba
    // Shift+Tab zpět), posunout zpátky, až je prvek vidět. Až po vlastním posunu prohlížeče
    // (další snímek); víc kol, protože přilepený list se po odlepení hýbe rychleji.
    const reveal = (t, own) => {
      for (let k = 0; k < 4; k++) {
        let edge = Infinity;
        for (let n = own.nextElementSibling; n; n = n.nextElementSibling) {
          if (n.classList.contains('sheet')) edge = Math.min(edge, n.getBoundingClientRect().top);
        }
        const r = t.getBoundingClientRect();
        if (!(r.bottom > edge - 8 && r.top < innerHeight)) return;
        scrollBy(0, -(r.bottom - edge + 32));
      }
    };
    document.addEventListener('focusin', (e) => {
      const t = e.target;
      const own = t.closest && t.closest('main > .sheet, main > .scene');
      if (own) requestAnimationFrame(() => reveal(t, own));
    });
  }

  if (dusk || sheets.length) {
    addEventListener('resize', relayout);
    addEventListener('load', relayout, { once: true });
    if (document.fonts) document.fonts.ready.then(relayout);
  }

  // přímý odkaz na kotvu (/#cena): po přeměření (podržení úvodu, písmo) dojet znovu,
  // dokud uživatel sám nezačal posouvat
  if (sheets.length && location.hash.length > 1) {
    let target = null;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
    if (target && intro && intro.parentElement.contains(target)) {
      let moved = false;
      ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, () => { moved = true; }, { once: true, passive: true }));
      const jump = () => { if (!moved) target.scrollIntoView(); };
      jump();
      addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(jump)), { once: true });
    }
  }

  /* ---------- Cookie lišta a GA4 až po souhlasu ---------- */
  // GA4 ID zatím není. Dokud není vyplněné, neběží žádné měření a lišta se nezobrazuje.
  const GA4_ID = '';
  const CONSENT_KEY = 'dd-cookie-consent';

  const loadAnalytics = () => {
    if (!GA4_ID || window.__ga4Loaded) return;
    window.__ga4Loaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, { anonymize_ip: true });
  };

  const cookieBar = document.querySelector('[data-cookie-bar]');
  if (cookieBar && GA4_ID) {
    let stored = null;
    try { stored = localStorage.getItem(CONSENT_KEY); } catch (e) {}
    const close = (value) => {
      cookieBar.classList.remove('is-visible');
      try { localStorage.setItem(CONSENT_KEY, value); } catch (e) {}
    };
    if (stored === 'accepted') loadAnalytics();
    else if (!stored) setTimeout(() => cookieBar.classList.add('is-visible'), 800);
    cookieBar.querySelector('[data-cookie-accept]')?.addEventListener('click', () => { loadAnalytics(); close('accepted'); });
    cookieBar.querySelector('[data-cookie-decline]')?.addEventListener('click', () => close('declined'));
    document.querySelectorAll('[data-cookie-settings]').forEach((el) => {
      el.addEventListener('click', (e) => { e.preventDefault(); cookieBar.classList.add('is-visible'); });
    });
  }

  /* ---------- Živé měření načtení (Performance API) ---------- */
  const fmt = (ms) => {
    const s = ms / 1000;
    const d = s < 1 ? 2 : 1;
    return s.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  // Číslo jde do všech [data-loadtime] (patička, na úvodu i malá obrazovka „Načte se hned“);
  // <html data-loadtime> a událost dd:loadtime dají vědět uvod.js (pruh rychlosti).
  const measure = () => {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const ms = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : performance.now();
    document.querySelectorAll('[data-loadtime]').forEach((el) => { el.textContent = fmt(ms); });
    root.dataset.loadtime = String(Math.round(ms));
    document.dispatchEvent(new CustomEvent('dd:loadtime', { detail: ms }));
  };
  // loadEventEnd je vyplněné až po doběhnutí handlerů load
  if (document.readyState === 'complete') setTimeout(measure, 0);
  else addEventListener('load', () => setTimeout(measure, 0), { once: true });
})();
