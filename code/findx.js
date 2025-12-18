(() => {
  // --- simple CSS loader
  function ensureCSS() {
    if (document.getElementById('find-on-page-css')) return;
    const link = document.createElement('link');
    link.id = 'find-on-page-css';
    link.rel = 'stylesheet';
    const s = document.currentScript || Array.from(document.scripts).slice(-1)[0];
    link.href = (s && s.getAttribute('data-findx-css')) || '/code/findonpage.css?v=1';
    document.head.appendChild(link);
  }

  const SKIP_TAGS = new Set([
    'script','style','iframe','canvas','svg','textarea','input','select','option','button',
    'noscript','picture','source','track','audio','video','map','area','object','embed'
  ]);

  const state = {
    ui: null, input: null, clearBtn: null, closeBtn: null, nextBtn: null, prevBtn: null, countEl: null,
    activateBtn: null,
    matches: [], current: -1, lastQuery: '',
    // follower
    followRaf: 0, following: false, lastScrollTs: 0, lastX: -1, lastY: -1, stillFrames: 0
  };

  const prefersReduced = () =>
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function el(tag, attrs={}, text){
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (v === '') n.setAttribute(k,'');
      else if (k in n) { try { n[k]=v; } catch { n.setAttribute(k,v); } }
      else n.setAttribute(k,v);
    }
    if (text != null) n.textContent = text;
    return n;
  }

  function isElementVisible(el){
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
      if (n.hidden || n.inert || n.getAttribute('aria-hidden') === 'true') return false;
      if (n.hasAttribute('contenteditable') || n.isContentEditable) return false;
    }
    return el.getClientRects().length !== 0;
  }

  function unwrap(el){
    const p = el.parentNode;
    if (!p) return;
    const text = el.firstChild ? el.firstChild.nodeValue : el.textContent;
    p.replaceChild(document.createTextNode(text), el);
    p.normalize();
  }

  // ---- Follower: vsync to scrolling with RAF, use transforms (no catch-up)
  function placeUI(){
    const sx = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const sy = window.pageYOffset || document.documentElement.scrollTop || 0;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;

    if (state.ui && !state.ui.hidden){
      const w = state.ui.offsetWidth || 0;
      const x = Math.max(12, sx + vw - w - 12);
      const y = sy + 12;
      state.ui.style.left = '0px';
      state.ui.style.top  = '0px';
      state.ui.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    if (state.activateBtn && state.activateBtn.style.display !== 'none'){
      const w = state.activateBtn.offsetWidth || 50;
      const h = state.activateBtn.offsetHeight || 50;
      const x = Math.max(20, sx + vw - w - 20);
      const y = Math.max(20, sy + vh - h - 20);
      state.activateBtn.style.left = '0px';
      state.activateBtn.style.top  = '0px';
      state.activateBtn.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }

  function startFollow(){
    state.lastScrollTs = performance.now();
    if (state.following) return;
    state.following = true;
    state.lastX = -1; state.lastY = -1; state.stillFrames = 0;

    const step = () => {
      placeUI();

      const sx = window.pageXOffset || 0;
      const sy = window.pageYOffset || 0;
      if (sx === state.lastX && sy === state.lastY) state.stillFrames++;
      else { state.stillFrames = 0; state.lastX = sx; state.lastY = sy; state.lastScrollTs = performance.now(); }

      if (state.stillFrames < 3 || performance.now() - state.lastScrollTs < 200) {
        state.followRaf = requestAnimationFrame(step);
      } else {
        state.following = false;
        cancelAnimationFrame(state.followRaf);
        state.followRaf = 0;
      }
    };
    state.followRaf = requestAnimationFrame(step);
  }

  // Tiny guard to reduce iOS focus nudge (kept; follower handles the rest)
  function guardFocusScroll(ms=350){
    const sx = window.pageXOffset, sy = window.pageYOffset;
    const end = performance.now() + ms;
    const loop = () => {
      if (window.pageXOffset !== sx || window.pageYOffset !== sy) window.scrollTo(sx, sy);
      if (performance.now() < end) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function buildActivate(){
    const btn = document.createElement('button');
    btn.id = 'findx-activate';
    btn.type = 'button';
    btn.className = 'activate-find-on-page';
    btn.setAttribute('aria-label','Open Find on Page');
    btn.setAttribute('data-findx-ui','');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    btn.addEventListener('click', () => { openUI(); });
    btn.addEventListener('dblclick', e => e.preventDefault(), { passive:false });
    document.body.appendChild(btn);
    state.activateBtn = btn;            // ✅ keep a reference
  }

  function buildBar(){
    const bar = document.createElement('div');
    bar.id = 'findx-bar';
    bar.setAttribute('data-findx-ui','');
    bar.setAttribute('role','dialog');
    bar.setAttribute('aria-label','Find on page');
    bar.hidden = true;

    const close = el('button',{ class: 'findx-close', type:'button', 'aria-label':'Close finder', 'data-findx-ui':'' }, '✕');

    const inputWrap = el('div',{ class:'findx-input-wrap', 'data-findx-ui':'' });
    const input = el('input',{
      class:'findx-input', type:'text', placeholder:'Find on page', 'data-findx-ui':'',
      autocomplete:'off', autocapitalize:'off', autocorrect:'off', spellcheck:'false'
    });
    const clear = el('button',{ class:'findx-clear', type:'button', 'aria-label':'Clear search', 'data-findx-ui':'' }, '✕');
    clear.hidden = true;
    inputWrap.append(input, clear);

    const count = el('span',{ class:'findx-count', 'data-findx-ui':'' }, '0 of 0');
    const prev = el('button',{ class:'findx-btn', type:'button', 'aria-label':'Previous match', 'data-findx-ui':'' }, '▲');
    const next = el('button',{ class:'findx-btn', type:'button', 'aria-label':'Next match', 'data-findx-ui':'' }, '▼');

    bar.append(close, inputWrap, count, prev, next);
    document.body.appendChild(bar);

    Object.assign(state, { ui:bar, input, clearBtn:clear, closeBtn:close, nextBtn:next, prevBtn:prev, countEl:count });

    input.addEventListener('focus', () => { guardFocusScroll(400); startFollow(); });
    input.addEventListener('input', () => { performSearch(input.value); toggleClear(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? gotoPrev() : gotoNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeUI(); }
    });

    clear.addEventListener('click', () => {
      input.value = '';
      toggleClear();
      performSearch('');
      guardFocusScroll(200);
      input.focus({ preventScroll:true });
    });

    next.addEventListener('click', gotoNext);
    prev.addEventListener('click', gotoPrev);
    close.addEventListener('click', closeUI);

    for (const ctl of [close, clear, next, prev]) ctl.addEventListener('dblclick', e => e.preventDefault(), { passive:false });
  }

  function toggleClear(){
    state.clearBtn.hidden = !(state.input.value && state.input.value.length > 0);
  }

  function openUI(){
    state.ui.hidden = false;
    if (state.activateBtn) state.activateBtn.style.display = 'none';
    placeUI();
    startFollow();
    setTimeout(() => { state.input && state.input.focus({ preventScroll:true }); }, 0);
  }

  function closeUI(){
    state.ui.hidden = true;
    if (state.activateBtn) state.activateBtn.style.display = 'flex';
    state.input.value = '';
    state.lastQuery = '';
    toggleClear();
    clearHighlights();
    updateCount();
    placeUI();
  }

  // --- search
  function performSearch(qRaw){
    const q = (qRaw || '').trim();
    if (q === state.lastQuery) return;
    state.lastQuery = q;

    clearHighlights();
    if (!q) { updateCount(); return; }

    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest('[data-findx-ui]')) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const tn = node.parentElement.tagName.toLowerCase();
        if (SKIP_TAGS.has(tn)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.hasAttribute('contenteditable') || node.parentElement.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.inert) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
        if (!isElementVisible(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    const qLower = q.toLowerCase();
    const created = [];

    for (const tn of textNodes) {
      const text = tn.nodeValue;
      const lower = text.toLowerCase();
      let idx = 0, last = 0, found = false;
      const frag = document.createDocumentFragment();

      while ((idx = lower.indexOf(qLower, last)) !== -1) {
        found = true;
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement('mark');
        mark.className = 'findx-hit';
        mark.setAttribute('data-findx-hit','1');
        mark.textContent = text.slice(idx, idx + qLower.length);
        frag.appendChild(mark);
        created.push(mark);
        last = idx + qLower.length;
      }
      if (found) {
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        tn.parentNode.replaceChild(frag, tn);
      }
    }

    state.matches = created;
    state.current = created.length ? 0 : -1;
    updateCount();
    focusCurrent(); // center on first match
  }

  function clearHighlights(){
    if (!state.matches.length) return;
    const hits = document.querySelectorAll('mark.findx-hit[data-findx-hit]');
    for (const h of hits) unwrap(h);
    state.matches = [];
    state.current = -1;
  }

  function updateCount(){
    const total = state.matches.length;
    const current = state.current >= 0 ? state.current + 1 : 0;
    state.countEl.textContent = `${current} of ${total}`;
    const disabled = total === 0;
    state.nextBtn.disabled = disabled;
    state.prevBtn.disabled = disabled;
  }

  function gotoNext(){
    if (!state.matches.length) return;
    state.current = (state.current + 1) % state.matches.length;
    updateCount();
    focusCurrent();
  }

  function gotoPrev(){
    if (!state.matches.length) return;
    state.current = (state.current - 1 + state.matches.length) % state.matches.length;
    updateCount();
    focusCurrent();
  }

  // center the current match, and follow during smooth scroll
  function focusCurrent(){
    for (const el of state.matches) el.classList.remove('findx-current');
    if (state.current < 0 || !state.matches[state.current]) return;

    const el = state.matches[state.current];
    el.classList.add('findx-current');

    const rect = el.getBoundingClientRect();
    const elemTopAbs = rect.top + window.pageYOffset;
    const newY = elemTopAbs + rect.height/2 - (window.innerHeight || document.documentElement.clientHeight)/2;

    const behavior = prefersReduced() ? 'auto' : 'smooth';
    startFollow(); // keep UI in sync during smooth scroll
    window.scrollTo({ top: Math.max(0, newY), behavior });
  }

  // boot
  function boot(){
    ensureCSS();
    buildActivate();
    buildBar();
    placeUI();
    startFollow();

    // keep pinned
    window.addEventListener('scroll', () => { state.lastScrollTs = performance.now(); startFollow(); }, { passive:true });
    window.addEventListener('resize', startFollow);
    window.addEventListener('orientationchange', () => setTimeout(() => { placeUI(); startFollow(); }, 120));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
