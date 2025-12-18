/* findonpage.js - self-contained Find on page widget */
(function (global) {
  'use strict';

  // ---------- Config & tiny utils ----------
  const cfg = {
    ids: {
      bar: 'find-on-page',
      activate: 'activate-find-on-page',
      input: 'find-on-page-input',
      up: 'find-on-page-up',
      down: 'find-on-page-down',
      close: 'find-on-page-close',
      count: 'find-on-page-count',
      clear: 'find-on-page-clear',
    },
    highlightClass: 'find-on-page-highlight',
    currentClass: 'find-on-page-highlight-current',
  };

  const el = (id) => document.getElementById(id);
  const isOpen = () => {
    const bar = el(cfg.ids.bar);
    return !!bar && bar.style.display === 'flex';
  };
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const debounce = (fn, wait) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  };
  const isPWA = () =>
    global.matchMedia?.('(display-mode: standalone)')?.matches ||
    !!global.navigator.standalone;

  // If global removeHighlights (site-search) exists, we’ll use it.
  // Otherwise, fall back to locally removing mark tags only.
  const maybeRemoveSearchHighlights = () => {
    if (typeof global.removeHighlights === 'function') {
      try { global.removeHighlights(); return; } catch {}
    }
    document.querySelectorAll('mark').forEach((node) => {
      node.outerHTML = node.innerHTML;
    });
  };

  // ---------- State ----------
  let searchResults = [];
  let currentResultIndex = -1;

  // ---------- Layout helpers ----------

// ---------- Always-on-top ----------
function pinToTop() {
  const bar = el(cfg.ids.bar);
  if (!bar) return;

  bar.style.position = 'fixed';
  bar.style.top = '0px'; // keeps it below the notch if applicable
  bar.style.left = '0';
  bar.style.right = '0';
  bar.style.bottom = 'auto'; // clear any old bottom styles
  bar.style.zIndex = '2147483647';
    requestAnimationFrame(() => {
    const r = bar.getBoundingClientRect();
    if (r.bottom <= 0 || r.top < -2) bar.style.top = '0px';
  });
}


  // ---------- Highlighting ----------
  function clearHighlights() {
    document.querySelectorAll('.' + cfg.highlightClass).forEach((node) => {
      node.outerHTML = node.innerHTML;
    });
    searchResults = [];
    currentResultIndex = -1;
    updateSearchCount();
  }

  function updateSearchCount() {
    const countEl = el(cfg.ids.count);
    if (!countEl) return;
    if (searchResults.length > 0) {
      countEl.textContent = `${currentResultIndex + 1} of ${searchResults.length}`;
    } else {
      countEl.textContent = '0 of 0';
    }
  }

  function updateCurrentResultHighlight() {
    document.querySelectorAll('.' + cfg.currentClass).forEach((node) => {
      node.classList.remove(cfg.currentClass);
    });
    if (currentResultIndex >= 0 && currentResultIndex < searchResults.length) {
      searchResults[currentResultIndex].classList.add(cfg.currentClass);
    }
  }

  const toggleClear = () => {
    const b = el(cfg.ids.clear), i = el(cfg.ids.input);
    if (b && i) b.style.display = i.value && i.value.length ? 'inline-flex' : 'none';
  };

  const clearInput = () => {
    const i = el(cfg.ids.input);
    if (!i) return;
    i.value = '';
    performSearch();
    toggleClear();
    i.focus();
  };

  const isKeyboardOpen = () =>
    global.visualViewport && (global.innerHeight - global.visualViewport.height > 100);

  const isElementVisible = (node) =>
    !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);

  function scrollToCurrentResult() {
    if (currentResultIndex < 0 || currentResultIndex >= searchResults.length) return;
    const result = searchResults[currentResultIndex];
    const rect = result.getBoundingClientRect();
    const viewportH = global.visualViewport ? global.visualViewport.height : global.innerHeight;
    const scrollY = global.scrollY + rect.top - viewportH / 2 + rect.height / 2;
    global.scrollTo({ top: scrollY, behavior: 'auto' });
    updateCurrentResultHighlight();
  }

  function moveToNextResult() {
    if (!searchResults.length) return;
    currentResultIndex = (currentResultIndex + 1) % searchResults.length;
    scrollToCurrentResult();
    updateSearchCount();
    if (isKeyboardOpen()) el(cfg.ids.input)?.focus();
  }

  function moveToPreviousResult() {
    if (!searchResults.length) return;
    currentResultIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    scrollToCurrentResult();
    updateSearchCount();
    if (isKeyboardOpen()) el(cfg.ids.input)?.focus();
  }

  function performSearch() {
    clearHighlights();
    const input = el(cfg.ids.input);
    if (!input) return;
    const raw = (input.value || '').toLowerCase();
    if (!raw.length) return;

    const rx = new RegExp(escapeRegExp(raw), 'gi');
    const isInWidget = (el) => !!el && (el.closest?.('#' + cfg.ids.bar) || el.closest?.('#' + cfg.ids.activate));

    function highlightMatches(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const pe = node.parentElement;
        if (!pe || isInWidget(pe) || !isElementVisible(pe)) return;
        const text = node.textContent;
        const matches = text.match(rx);
        if (matches) {
          const frag = document.createDocumentFragment();
          let lastIndex = 0;
          for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            const index = text.indexOf(m, lastIndex);
            if (index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, index)));
            const span = document.createElement('span');
            span.className = cfg.highlightClass;
            span.textContent = m;
            frag.appendChild(span);
            searchResults.push(span);
            lastIndex = index + m.length;
          }
          if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
          node.parentNode.replaceChild(frag, node);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (isInWidget(node)) return;
        const tn = node.tagName.toLowerCase();
        if (!isElementVisible(node)) return;
        if (['script','style','iframe','canvas','svg','textarea','input','select','option','button'].includes(tn) ||
        node.hasAttribute('contenteditable') || node.inert ||
        node.getAttribute('aria-hidden') === 'true') return;
        // Clone list because we mutate the DOM
        Array.from(node.childNodes).forEach(highlightMatches);
      }
    }

    highlightMatches(document.body);

    if (searchResults.length) {
      currentResultIndex = 0;
      scrollToCurrentResult();
    }
    updateSearchCount();
  }

  // ---------- Show/Hide ----------
  function show() {
    maybeRemoveSearchHighlights(); // clear site-search highlights (if present)
    const bar = el(cfg.ids.bar);
    const activator = el(cfg.ids.activate);
    if (bar) bar.style.display = 'flex';
    if (activator) activator.style.display = 'none';
    document.body.classList.add('find-on-page-active');

    const input = el(cfg.ids.input);
    if (input) {
      input.focus();
      toggleClear();
      if (input.value.trim() !== '') performSearch();
    }
    pinToTop();
  }

  function hide() {
    const bar = el(cfg.ids.bar);
    const activator = el(cfg.ids.activate);
    if (bar) bar.style.display = 'none';
    if (activator) activator.style.display = 'flex';
    document.body.classList.remove('find-on-page-active');
    clearHighlights();
  }

  // ---------- Wiring ----------
  function attachListeners() {
    const activator = el(cfg.ids.activate);
    const input = el(cfg.ids.input);
    const up = el(cfg.ids.up);
    const down = el(cfg.ids.down);
    const closeBtn = el(cfg.ids.close);
    const clearBtn = el(cfg.ids.clear);

    if (activator) activator.addEventListener('click', show);

    if (input) {
      const run = debounce(performSearch, 300);
      input.addEventListener('input', () => { toggleClear(); run(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? moveToPreviousResult() : moveToNextResult(); }
        else if (e.key === 'Escape') { e.preventDefault(); hide(); }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', clearInput);
      clearBtn.addEventListener('dblclick', (e) => e.preventDefault(), { passive:false });
    }

    if (up) up.addEventListener('click', moveToPreviousResult);
    if (down) down.addEventListener('click', moveToNextResult);
    if (closeBtn) closeBtn.addEventListener('click', hide);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        e.preventDefault();
        hide();
      }
    });
  }

  function ensureDom() {
    if (!el(cfg.ids.activate)) {
      const btn = document.createElement('button');
      btn.id = cfg.ids.activate;
      btn.className = 'activate-find-on-page';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Open Find on Page');
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
      document.body.appendChild(btn);
    }
    if (!el(cfg.ids.bar)) {
      const wrap = document.createElement('div');
      wrap.id = cfg.ids.bar;
      wrap.className = 'find-on-page';
      wrap.style.display = 'none';
      wrap.setAttribute('role', 'search');
      wrap.innerHTML = `
        <div class="find-on-page-content">
          <button id="${cfg.ids.close}" type="button" aria-label="Close find on page">✕</button>
          <div class="find-on-page-input-wrap">
            <input id="${cfg.ids.input}" type="text" placeholder="Find on page" role="searchbox" aria-label="Find text on page" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
            <button id="${cfg.ids.clear}" class="find-on-page-clear" type="button" aria-label="Clear search">✕</button>
          </div>
          <div id="${cfg.ids.count}" aria-live="polite" aria-atomic="true">0 of 0</div>
          <div class="find-on-page-buttons">
            <button id="${cfg.ids.up}" type="button" aria-label="Previous result">▲</button>
            <button id="${cfg.ids.down}" type="button" aria-label="Next result">▼</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      pinToTop();
    }
  }

  function ensureCSS() {
    if (document.getElementById('find-on-page-css')) return;
    const link = document.createElement('link');
    link.id = 'find-on-page-css';
    link.rel = 'stylesheet';
    link.href = '/code/findonpage.css?v=2';
    document.head.appendChild(link);
  }

  function init() {
    ensureCSS();
    ensureDom();
    attachListeners();
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
})(window);
