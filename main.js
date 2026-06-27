(function () {
  function track(event, params) {
    if (typeof gtag === 'function') gtag('event', event, params || {});
  }

  const viewport = document.getElementById('viewport');
  const world = document.getElementById('world');
  const W = 3550, H = 2600;
  const MIN_S = 0.14, MAX_S = 1.6;

  // camera = world point at viewport center + scale
  const cam = { x: 1600, y: 400, s: 1 };

  function fitScale() {
    return Math.max(MIN_S, Math.min(
      window.innerWidth / (W + 160),
      window.innerHeight / (H + 160),
      0.85
    ));
  }

  const presets = {
    hub:      () => ({ x: 1600, y: 430,  s: zoomFor(900) }),
    overview: () => ({ x: 1740, y: 1380, s: fitScale() }),
    capture:  () => ({ x: 560,  y: 1360, s: zoomFor(1080) }),
    manage:   () => ({ x: 1660, y: 1730, s: zoomFor(1120) }),
    organize: () => ({ x: 2940, y: 1360, s: zoomFor(1120) }),
    install:  () => ({ x: 1600, y: 2650, s: zoomFor(1020) })
  };

  // scale so `span` world-px fit the viewport width (capped at 1)
  function zoomFor(span) {
    return Math.min(1, (window.innerWidth - 60) / span, (window.innerHeight - 60) / 760);
  }

  const clusterCenters = {
    hub:      { x: 1600, y: 430 },
    capture:  { x: 530,  y: 1380 },
    manage:   { x: 1640, y: 1740 },
    organize: { x: 2980, y: 1380 },
    install:  { x: 1600, y: 2500 },
  };

  let detectTimer = null;
  function detectSection() {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(() => {
      if (currentPreset === 'overview') return;
      let nearest = 'hub', minDist = Infinity;
      for (const [name, c] of Object.entries(clusterCenters)) {
        const d = Math.hypot(cam.x - c.x, cam.y - c.y);
        if (d < minDist) { minDist = d; nearest = name; }
      }
      if (nearest !== currentPreset) {
        currentPreset = nearest;
        updateBrandState(nearest);
        if (nearest !== 'hub') prevPreset = nearest;
        document.querySelectorAll('.chip').forEach(c =>
          c.classList.toggle('active', c.dataset.go === nearest));
        updateViewMapBtn(nearest);
      }
    }, 120);
  }

  function apply() {
    const tx = window.innerWidth / 2 - cam.x * cam.s;
    const ty = window.innerHeight / 2 - cam.y * cam.s;
    world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + cam.s + ')';
    detectSection();
  }

  let currentPreset = 'hub';

  const viewMapBtn = document.getElementById('viewmap');
  const viewMapLabel = document.getElementById('viewmap-label');
  const viewMapIcon = document.getElementById('viewmap-icon');
  // icon for "back to hub" — a house/return shape
  const iconHub = `<path d="M7 2L1.5 7H3v5h3V9h2v3h3V7h1.5L7 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/>`;
  const iconOverview = `<rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="1.5" width="4.5" height="4.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="1.5" y="8" width="4.5" height="4.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="4.5" height="4.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/>`;

  const presetLabels = { hub: 'Start', capture: 'Capture', manage: 'Manage', organize: 'Organize', install: 'Install' };
  let prevPreset = 'hub';

  // brand mark sits centered above the hero on hub/overview, top-left on clusters
  function updateBrandState(name) {
    document.body.classList.toggle('at-cluster', !(name === 'hub' || name === 'overview'));
  }

  function updateViewMapBtn(name) {
    const isOverview = (name === 'overview');
    viewMapLabel.textContent = isOverview ? `← Back to ${presetLabels[prevPreset] || 'hub'}` : 'View the full map';
    viewMapIcon.style.display = isOverview ? 'none' : '';
    viewMapIcon.innerHTML = iconOverview;
  }

  function goTo(name) {
    const p = presets[name];
    if (!p) return;
    if (name !== 'overview') prevPreset = name;
    currentPreset = name;
    updateBrandState(name);
    const t = p();
    world.classList.add('glide');
    cam.x = t.x; cam.y = t.y; cam.s = t.s;
    apply();
    document.querySelectorAll('.chip').forEach(c =>
      c.classList.toggle('active', c.dataset.go === name));
    updateViewMapBtn(name);
    if (name === 'overview') track('map_view');
    else if (name !== 'hub') track('cluster_visit', { cluster: name });
  }

  viewMapBtn.addEventListener('click', () => {
    goTo(currentPreset === 'overview' ? prevPreset : 'overview');
  });

  world.addEventListener('transitionend', () => world.classList.remove('glide'));

  // ── start focused on the hub; user zooms out via "View the full map" ──
  const start = presets.hub();
  cam.x = start.x; cam.y = start.y; cam.s = start.s;
  apply();
  updateViewMapBtn('hub');
  // Double-rAF: first frame commits the transform, second measures stable layout
  requestAnimationFrame(() => requestAnimationFrame(positionAllStickies));

  // ── sticky anchoring ──
  // Positions a sticky relative to a target card using measured screen coords.
  // edge: 'top' | 'bottom'  dx/dy: offset in world units  rot: rotation degrees
  function anchorSticky(id, targetId, edge, dx, dy, rot) {
    const target = document.getElementById(targetId);
    const sticky = document.getElementById(id);
    if (!target || !sticky) return;
    const r = target.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const sx = r.left + r.width / 2;
    const sy = edge === 'top' ? r.top : r.bottom;
    // screen → world
    const wx = cam.x + (sx - vw / 2) / cam.s + (dx || 0);
    const wy = cam.y + (sy - vh / 2) / cam.s + (dy || 0);
    sticky.style.left = wx + 'px';
    sticky.style.top  = wy + 'px';
    sticky.style.transform = `translateX(-50%) rotate(${rot}deg)`;
  }

  function positionAllStickies() {
    anchorSticky('s-faster',    'cap-card',   'top',    20, -55, -2.4);
    anchorSticky('s-cliptypes', 'cap-popup',  'bottom',  0,  8,  2.0);
    anchorSticky('s-hunting',   'mgr-card',   'top',    20, -55, -1.8);
    anchorSticky('s-filter',    'mgr-window', 'bottom',  0,  18, -2.8);
    anchorSticky('s-portent',   'org-card',   'top',    20, -55,  2.0);
    document.getElementById('s-portent').style.top = '1120px';
    anchorSticky('s-selfbuild', 'org-graph',  'bottom',  0,  18, -2.2);
  }

  // ── clip type switcher + auto-cycle ──
  const obWindow = document.getElementById('mgr-window');
  const clipOrder = ['highlight', 'full-page', 'tweet', 'pdf', 'video', 'image'];
  let clipIndex = 0;
  let autoCycleTimer = null;

  function switchClip(clip) {
    const oldH = obWindow.offsetHeight;
    document.querySelectorAll('.clip-type-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.clip-type-btn[data-clip="${clip}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    document.querySelectorAll('.ob-clip-view').forEach(v => v.classList.remove('active'));
    document.querySelector(`.ob-clip-view[data-clip="${clip}"]`).classList.add('active');
    clipIndex = clipOrder.indexOf(clip);

    obWindow.style.transition = 'none';
    obWindow.style.height = 'auto';
    const newH = obWindow.scrollHeight;
    obWindow.style.height = oldH + 'px';
    requestAnimationFrame(() => {
      obWindow.style.transition = '';
      obWindow.style.height = newH + 'px';
    });
  }

  document.querySelectorAll('.clip-type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(autoCycleTimer);
      autoCycleTimer = null;
      switchClip(btn.dataset.clip);
      track('clip_type_select', { clip: btn.dataset.clip });
    });
  });

  autoCycleTimer = setInterval(() => {
    clipIndex = (clipIndex + 1) % clipOrder.length;
    switchClip(clipOrder[clipIndex]);
  }, 2800);

  // ── expandable stickies ──
  document.querySelectorAll('.sticky.x').forEach((sticky) => {
    ['.sticky-head', '.plus'].forEach(sel => {
      const el = sticky.querySelector(sel);
      if (el) el.addEventListener('click', (e) => {
        e.stopPropagation();
        sticky.classList.toggle('open');
        if (sticky.classList.contains('open')) track('sticky_expand', { sticky: sticky.id });
      });
    });
  });

  // ── popup mockup interactions ──
  const pmSaveBtn      = document.getElementById('pm-save-btn');
  const pmFullPageBtn  = document.getElementById('pm-full-page-btn');
  const pmOpenObsidian = document.getElementById('pm-open-obsidian');
  const pmStatus       = document.getElementById('pm-status');
  const pmDailyToggle  = document.getElementById('pm-daily-toggle');
  const pmToggleTrack  = document.getElementById('pm-toggle-track');
  const pmFolderSec    = document.getElementById('pm-folder-section');
  const pmDestNormal   = document.getElementById('pm-dest-normal');
  const pmDestDaily    = document.getElementById('pm-dest-daily');
  let pmSaved = false;
  let pmDailyOn = false;
  let currentPopupClip = 'highlight';

  // daily-note filename reflects today's date (context-aware, like the extension)
  const pmDailyDate = document.getElementById('pm-daily-date');
  if (pmDailyDate) {
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    pmDailyDate.textContent = months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
  }

  // daily note toggle
  pmDailyToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pmSaved) return;
    if (popupCycleTimer) { clearInterval(popupCycleTimer); popupCycleTimer = null; }
    pmDailyOn = !pmDailyOn;
    pmToggleTrack.classList.toggle('on', pmDailyOn);
    pmFolderSec.classList.toggle('pm-collapsed', pmDailyOn);
    pmDestNormal.classList.toggle('pm-collapsed', pmDailyOn);
    pmDestDaily.classList.toggle('pm-collapsed', !pmDailyOn);
  });

  // save button
  pmSaveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pmSaved) return;
    pmSaved = true;

    // grey out fields
    document.querySelector('.pm-folder-val').classList.add('pm-field-saved');
    document.querySelector('.pm-dest-val').classList.add('pm-field-saved');
    document.querySelector('.pm-tags-val').classList.add('pm-field-saved');
    document.querySelector('.pm-note-val').classList.add('pm-field-saved');
    if (pmDailyOn) pmDestDaily.style.opacity = '0.5';

    // button → ✓ Saved (teal)
    pmSaveBtn.classList.add('pm-saved');
    pmSaveBtn.textContent = '✓ Saved';

    // hide status, swap full page → Open in Obsidian
    pmStatus.classList.add('pm-hidden');
    pmFullPageBtn.style.display = 'none';
    pmOpenObsidian.classList.add('pm-visible');

    // auto-reset after 3.5s
    setTimeout(() => {
      pmSaved = false;
      pmSaveBtn.classList.remove('pm-saved');
      pmSaveBtn.textContent = (popupStates[currentPopupClip] || {}).btn || 'Save Highlight';
      document.querySelector('.pm-folder-val').classList.remove('pm-field-saved');
      document.querySelector('.pm-dest-val').classList.remove('pm-field-saved');
      document.querySelector('.pm-tags-val').classList.remove('pm-field-saved');
      document.querySelector('.pm-note-val').classList.remove('pm-field-saved');
      pmDestDaily.style.opacity = '';
      pmFullPageBtn.style.display = '';
      pmOpenObsidian.classList.remove('pm-visible');
      pmStatus.classList.remove('pm-hidden');
    }, 3500);
  });

  // ── drag to pan (+ pinch) ──
  const pointers = new Map();
  let dragDist = 0, lastMid = null, lastSpread = 0;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, .plus, .popup-mockup, .sticky')) return;
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragDist = 0;
    lastMid = null;
    world.classList.remove('glide');
    viewport.classList.add('dragging');
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      dragDist += Math.abs(dx) + Math.abs(dy);
      cam.x -= dx / cam.s;
      cam.y -= dy / cam.s;
      apply();
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const spread = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastMid) {
        cam.x -= (mid.x - lastMid.x) / cam.s;
        cam.y -= (mid.y - lastMid.y) / cam.s;
        if (lastSpread > 0) zoomAt(mid.x, mid.y, spread / lastSpread);
      }
      lastMid = mid;
      lastSpread = spread;
      dragDist = 99;
      apply();
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    lastMid = null;
    if (pointers.size === 0) viewport.classList.remove('dragging');
  }
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  // click a cluster (not a drag) → travel to it
  viewport.addEventListener('click', (e) => {
    if (dragDist > 8) return;
    if (e.target.closest('a')) return;
    const go = e.target.closest('[data-go]');
    if (go) goTo(go.dataset.go);
  });

  // ── wheel: zoom (pinch-trackpad/ctrl) or pan ──
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    world.classList.remove('glide');
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
    } else {
      cam.x += e.deltaX / cam.s;
      cam.y += e.deltaY / cam.s;
    }
    apply();
  }, { passive: false });

  function zoomAt(mx, my, factor) {
    const newS = Math.min(MAX_S, Math.max(MIN_S, cam.s * factor));
    // keep the world point under the cursor fixed
    const wx = cam.x + (mx - window.innerWidth / 2) / cam.s;
    const wy = cam.y + (my - window.innerHeight / 2) / cam.s;
    cam.x = wx + (window.innerWidth / 2 - mx) / newS;
    cam.y = wy + (window.innerHeight / 2 - my) / newS;
    cam.s = newS;
  }

  // ── chrome controls ──
  document.querySelectorAll('.chip, [data-go].btn-primary, button[data-go]').forEach(el => {
    el.addEventListener('click', () => goTo(el.dataset.go));
  });

  // logo glides back to the hub instead of reloading the page
  document.querySelectorAll('.brand, .hub-brand').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); goTo('hub'); });
  });

  // CTA link clicks
  document.querySelectorAll('a.btn-primary').forEach(a => {
    a.addEventListener('click', () => track('cta_click', { label: a.textContent.trim().slice(0, 60) }));
  });


  // keyboard: arrows pan, +/- zoom, 0 overview
  window.addEventListener('keydown', (e) => {
    const step = 90 / cam.s;
    if (e.key === 'ArrowLeft')       { cam.x -= step; }
    else if (e.key === 'ArrowRight') { cam.x += step; }
    else if (e.key === 'ArrowUp')    { cam.y -= step; }
    else if (e.key === 'ArrowDown')  { cam.y += step; }
    else if (e.key === '+' || e.key === '=') { zoomAt(innerWidth / 2, innerHeight / 2, 1.25); }
    else if (e.key === '-')          { zoomAt(innerWidth / 2, innerHeight / 2, 0.8); }
    else if (e.key === '0')          { goTo('overview'); return; }
    else return;
    e.preventDefault();
    world.classList.remove('glide');
    apply();
  });

  window.addEventListener('resize', () => {
    if (currentPreset) { const t = presets[currentPreset](); cam.x = t.x; cam.y = t.y; cam.s = t.s; }
    apply();
    positionAllStickies();
  });

  // ── Organize table: clips organize themselves on a loop ──
  (function () {
    const rows = Array.from(document.querySelectorAll('.org-table-mock tbody tr'));
    if (rows.length < 2) return;
    const targets = rows.slice(1);            // row 0 is already organized
    const belongs = ['PKM Research', 'Second Brain', 'BASB', 'Note-taking'];
    let i = 0;
    function organize(row, val) {
      const bc = row.querySelector('.otm-belongs');
      if (bc) { bc.textContent = val; bc.classList.remove('dim'); }
      const chk = row.querySelector('.otm-org-cell .otm-chk');
      if (chk) { chk.classList.add('on'); chk.textContent = '✓'; }
      row.querySelectorAll('.otm-prog .pd').forEach(p => p.classList.remove('off'));
    }
    function reset(row) {
      const bc = row.querySelector('.otm-belongs');
      if (bc) { bc.textContent = 'Search notes…'; bc.classList.add('dim'); }
      const chk = row.querySelector('.otm-org-cell .otm-chk');
      if (chk) { chk.classList.remove('on'); chk.textContent = ''; }
      row.querySelectorAll('.otm-prog .pd').forEach((p, k) => p.classList.toggle('off', k > 0));
    }
    setInterval(() => {
      if (i < targets.length) { organize(targets[i], belongs[i % belongs.length]); i++; }
      else { targets.forEach(reset); i = 0; }
    }, 2200);
  })();

  // ── Manage video: timestamp chips scrub the player ──
  (function () {
    const fill = document.querySelector('.qc-vscrub-fill');
    const chips = Array.from(document.querySelectorAll('.qc-ts'));
    if (!fill || !chips.length) return;
    const pos = [15, 58, 95];
    let auto;
    function seek(idx) {
      fill.style.width = pos[idx] + '%';
      chips.forEach((c, k) => { const tr = c.closest('tr'); if (tr) tr.classList.toggle('vts-active', k === idx); });
    }
    chips.forEach((chip, idx) => {
      chip.addEventListener('click', (e) => { e.stopPropagation(); clearInterval(auto); seek(idx); });
    });
    let vi = 0;
    auto = setInterval(() => { vi = (vi + 1) % pos.length; seek(vi); }, 2600);
    seek(0);
  })();

  // ── Capture popup: reflects the selected clip type (mimics the extension) ──
  const popupStates = {
    highlight: {
      btn: 'Save Highlight', folder: true, frozen: false, daily: true, fullPage: true,
      dest: 'Building a Second Brain', tags: ['#pkm', '#ideas'],
      note: 'Connect to Zettelkasten entry on knowledge synthesis.',
      icon: '📋', label: 'Highlight ready', quote: '“the best ideas come from connecting what you already know”'
    },
    'full-page': {
      btn: 'Save Full Page', folder: true, frozen: true, daily: false, fullPage: false,
      dest: 'Building a Second Brain.md', tags: ['#pkm', '#ideas'], note: '',
      icon: '📄', label: 'Full page ready', quote: 'Building a Second Brain · fortelabs.com'
    },
    tweet: {
      btn: 'Save Tweet', folder: true, frozen: false, daily: true, fullPage: false,
      dest: 'Building a Second Brain', tags: ['#pkm', '#ideas'], note: 'connecting ideas over time',
      icon: '🐦', label: 'Tweet ready', quote: '@tiagoforte — “the best ideas don’t come from reading more”'
    },
    pdf: {
      btn: 'Save PDF Highlight', folder: true, frozen: false, daily: true, fullPage: false,
      dest: 'BASB_Notes', tags: ['#pkm', '#ideas'], note: '',
      icon: '📕', label: 'PDF highlight ready · p. 47', quote: '“the best ideas come from connecting what you already know”'
    },
    video: {
      btn: 'Save Video Clip', folder: true, frozen: true, daily: false, fullPage: false,
      dest: 'Building a Second Brain.md', tags: ['#pkm'], note: 'on capturing ideas before they fade',
      icon: '▶', label: 'Video clip ready · 8:42', quote: 'the CODE method explained'
    },
    image: {
      btn: 'Save Image', folder: true, frozen: false, daily: true, fullPage: true,
      dest: 'Building a Second Brain', tags: ['#pkm', '#ideas'], note: 'screenshot from PKM workflow',
      icon: '🖼', label: 'Image ready', quote: 'PKM workflow diagram'
    }
  };

  function setPopupClip(clip) {
    const s = popupStates[clip];
    if (!s) return;
    currentPopupClip = clip;

    // clear any "saved" state from a prior interaction
    pmSaved = false;
    pmSaveBtn.classList.remove('pm-saved');
    ['.pm-folder-val', '.pm-dest-val', '.pm-tags-val', '.pm-note-val'].forEach(sel => {
      const el = document.querySelector(sel); if (el) el.classList.remove('pm-field-saved');
    });
    pmStatus.classList.remove('pm-hidden');
    pmOpenObsidian.classList.remove('pm-visible');

    // daily-note mode resets off (full-page / video ignore save modes)
    pmDailyOn = false;
    pmToggleTrack.classList.remove('on');
    pmDestDaily.classList.add('pm-collapsed');

    // folder + destination
    pmFolderSec.classList.toggle('pm-collapsed', !s.folder);
    pmDestNormal.classList.remove('pm-collapsed');
    pmDestNormal.textContent = s.dest;
    pmDestNormal.classList.toggle('frozen', s.frozen);
    // daily toggle hidden when destination is frozen
    pmDailyToggle.style.display = s.frozen ? 'none' : '';

    // tags
    const tagsBox = document.querySelector('.pm-tags-box');
    if (tagsBox) tagsBox.innerHTML = s.tags.map(t => '<span class="pm-chip">' + t + '</span>').join('');

    // note (placeholder when empty)
    const note = document.querySelector('.pm-note-val');
    if (note) note.textContent = s.note || 'Add a note…';

    // save button + full-page pill
    pmSaveBtn.textContent = s.btn;
    pmFullPageBtn.style.display = s.fullPage ? '' : 'none';

    // status banner
    const strong = pmStatus.querySelector('strong');
    const em = pmStatus.querySelector('em');
    pmStatus.querySelector('.pm-status-icon').textContent = s.icon;
    if (strong) strong.textContent = s.label;
    if (em) em.textContent = s.quote;

    // active chip
    document.querySelectorAll('#s-cliptypes .mini-chip').forEach(c =>
      c.classList.toggle('active', c.dataset.clip === clip));
  }

  // auto-rotate through clip types; stop permanently once the user picks one
  const clipCycle = ['highlight', 'full-page', 'tweet', 'pdf', 'video', 'image'];
  let clipCycleIdx = 0;
  let popupCycleTimer = setInterval(() => {
    clipCycleIdx = (clipCycleIdx + 1) % clipCycle.length;
    setPopupClip(clipCycle[clipCycleIdx]);
  }, 3200);

  document.querySelectorAll('#s-cliptypes .mini-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(popupCycleTimer);
      popupCycleTimer = null;
      setPopupClip(chip.dataset.clip);
    });
  });
})();
