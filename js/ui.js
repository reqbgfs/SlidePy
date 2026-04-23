// ═══════ SLIDES ═══════
function addSlide(type) {
  saveUndo();
  const prevSlide = slides[slides.length - 1];
  const inheritedBg = prevSlide ? {
    bg: prevSlide.bg,
    bgCustomColor: prevSlide.bgCustomColor,
    bgImage: prevSlide.bgImage,
    bgImageX: prevSlide.bgImageX,
    bgImageY: prevSlide.bgImageY,
    bgImageW: prevSlide.bgImageW,
    bgImageH: prevSlide.bgImageH,
  } : { bg: '#ffffff' };
  Object.keys(inheritedBg).forEach(k => inheritedBg[k] === undefined && delete inheritedBg[k]);
  const s = { id: genId(), type, elements: [], ...inheritedBg, hidden: false, layers: [0, 1], hiddenLayers: [] };
  if (type === 'title') {
    s.elements = [
      { type: 'title', content: 'Click to add title', x: 40, y: 140, w: 440, h: 90, borderColor: '', bgColor: '', borderWidth: 0, _bgHex: '#22222e', _bgAlpha: 0, level: 1 },
      { type: 'subtitle', content: 'Click to add subtitle', x: 40, y: 250, w: 440, h: 50, borderColor: '', bgColor: '', borderWidth: 0, _bgHex: '#22222e', _bgAlpha: 0, level: 1 }
    ];
  } else if (type === 'jupyter') {
    s.elements = [{ type: 'jupyter', code: '# Python here\nprint("Hello!")', output: '', x: 40, y: 40, w: 880, h: 460, borderColor: '', bgColor: '', borderWidth: 0, _bgHex: '#22222e', _bgAlpha: 0, level: 1 }];
  }
  slides.push(s); currentSlideIdx = slides.length - 1; selectedElIdx = -1;
  renderSidebar(); renderSlide();
}
function selectSlide(i) { persistAll(); currentSlideIdx = i; selectedElIdx = -1; renderSidebar(); renderSlide(); centerSlide(); }
function deleteSlide(i) { if (slides.length <= 1) return; saveUndo(); slides.splice(i, 1); if (currentSlideIdx >= slides.length) currentSlideIdx = slides.length - 1; selectedElIdx = -1; renderSidebar(); renderSlide(); }
function duplicateSlide(i) { saveUndo(); const c = JSON.parse(JSON.stringify(slides[i])); c.id = genId(); slides.splice(i + 1, 0, c); currentSlideIdx = i + 1; renderSidebar(); renderSlide(); }
function toggleHidden(i) { saveUndo(); slides[i].hidden = !slides[i].hidden; renderSidebar(); renderSlide(); }
function moveSlide(i, d) { const n = i + d; if (n < 0 || n >= slides.length) return; saveUndo();[slides[i], slides[n]] = [slides[n], slides[i]]; currentSlideIdx = n; renderSidebar(); renderSlide(); }

// ═══════ ELEMENTS ═══════
const elDefaults = { borderColor: '', bgColor: '', borderWidth: 0, _bgHex: '#22222e', _bgAlpha: 0, level: 1 };
async function addElement(type, props = {}, initialContent = null) {
  const spawnLevel = (props.level !== undefined) ? props.level : selectedLayer;
  if (spawnLevel === 0) {
    await showAlert("Background Layer", "The background layer is reserved for the background image. Please select a different layer first.");
    return;
  }

  saveUndo();
  const els = slides[currentSlideIdx].elements;
  const finalDefaults = { ...elDefaults, level: spawnLevel, ...props };

  const IW = 880, IH = 460, margin = 40, gap = 20;
  const hW = IW / 2, hH = IH / 2;
  const dW = hW - 10;
  const innerR = margin + IW;  // 920
  const innerB = margin + IH;  // 500

  // Check if a rect at (x,y,w,h) collides with any existing element
  // respecting the gap distance between cells
  function collides(x, y, w, h, exclude) {
    for (let e of els) {
      if (exclude && e === exclude) continue;
      if ((e.level !== undefined ? e.level : 1) !== spawnLevel) continue;

      // Media elements ignore text/jupyter elements during spawn collision
      if (type === 'image' && e.type !== 'image') continue;

      const noOverlap = (x + w + gap <= e.x) || (x >= e.x + e.w + gap) ||
        (y + h + gap <= e.y) || (y >= e.y + e.h + gap);
      if (!noOverlap) return true;
    }
    return false;
  }

  let sX = -1, sY = -1, sW = -1, sH = -1;

  if (type === 'title') {
    let w = dW, h = 64;
    // Top-left
    if (!collides(margin, margin, w, h)) { sX = margin; sY = margin; }
    // Top-right
    else if (!collides(margin + hW + 10, margin, w, h)) { sX = margin + hW + 10; sY = margin; }
    // Scan left half downward
    else {
      let found = false;
      for (let y = margin; y + h <= innerB; y += 5) {
        if (!collides(margin, y, w, h)) { sX = margin; sY = y; found = true; break; }
      }
      // Scan right half downward
      if (!found) {
        for (let y = margin; y + h <= innerB; y += 5) {
          if (!collides(margin + hW + 10, y, w, h)) { sX = margin + hW + 10; sY = y; break; }
        }
      }
    }
    if (sX !== -1) { sW = w; sH = h; }
  }
  else if (type === 'subtitle') {
    let w = dW, h = 50;
    let titles = els.filter(e => e.type === 'title').sort((a, b) => {
      if (b.x !== a.x) return b.x - a.x;
      return a.y - b.y;
    });
    let found = false;
    for (let t of titles) {
      let ty = t.y + t.h; // no gap — subtitle sits flush below title
      if (ty + h <= innerB && !collides(t.x, ty, w, h, t)) {
        sX = t.x; sY = ty; sW = w; sH = h; found = true; break;
      }
    }
    if (!found) {
      if (!collides(margin, margin, w, h)) { sX = margin; sY = margin; }
      else if (!collides(margin + hW + 10, margin, w, h)) { sX = margin + hW + 10; sY = margin; }
      else {
        let f = false;
        for (let y = margin; y + h <= innerB; y += 5) {
          if (!collides(margin, y, w, h)) { sX = margin; sY = y; f = true; break; }
        }
        if (!f) {
          for (let y = margin; y + h <= innerB; y += 5) {
            if (!collides(margin + hW + 10, y, w, h)) { sX = margin + hW + 10; sY = y; f = true; break; }
          }
        }
      }
      if (sX !== -1) { sW = w; sH = h; }
    }
  }
  else if (type === 'body' || type === 'image') {
    let rightRect = { x: margin + hW + 10, y: margin, w: dW, h: IH };
    let leftRect = { x: margin, y: margin, w: dW, h: IH };

    if (!collides(leftRect.x, leftRect.y, leftRect.w, leftRect.h)) {
      sX = leftRect.x; sY = leftRect.y; sW = leftRect.w; sH = leftRect.h;
    } else if (!collides(rightRect.x, rightRect.y, rightRect.w, rightRect.h)) {
      sX = rightRect.x; sY = rightRect.y; sW = rightRect.w; sH = rightRect.h;
    } else {
      let qH = Math.floor((IH - gap) / 2);
      let tr = { x: margin + hW + 10, y: margin, w: dW, h: qH };
      let br = { x: margin + hW + 10, y: margin + qH + gap, w: dW, h: qH };
      let tl = { x: margin, y: margin, w: dW, h: qH };
      let bl = { x: margin, y: margin + qH + gap, w: dW, h: qH };
      let qs = [tl, bl, tr, br];
      let foundQ = false;
      for (let q of qs) {
        if (!collides(q.x, q.y, q.w, q.h)) {
          sX = q.x; sY = q.y; sW = q.w; sH = q.h;
          // Expand downward respecting gap
          while (sY + sH + gap <= innerB && !collides(sX, sY, sW, sH + gap)) sH += gap;
          // Expand upward respecting gap
          while (sY - gap >= margin && !collides(sX, sY - gap, sW, sH + gap)) { sY -= gap; sH += gap; }
          foundQ = true; break;
        }
      }
      if (!foundQ) {
        let cw = 205, ch = 100;
        let found = false;
        for (let c = 0; c < 4; c++) {
          for (let r = 0; r < 4; r++) {
            let x16 = margin + c * (cw + gap);
            let y16 = margin + r * (ch + gap);
            if (!collides(x16, y16, cw, ch)) {
              sX = x16; sY = y16; sW = cw; sH = ch; found = true; break;
            }
          }
          if (found) break;
        }
        if (found) {
          // Expand right
          while (sX + sW + gap + cw <= innerR && !collides(sX, sY, sW + gap + cw, sH)) sW += gap + cw;
          // Expand left
          while (sX - gap - cw >= margin && !collides(sX - gap - cw, sY, sW + gap + cw, sH)) { sX -= gap + cw; sW += gap + cw; }
          // Expand down
          while (sY + sH + gap + ch <= innerB && !collides(sX, sY, sW, sH + gap + ch)) sH += gap + ch;
        }
      }
    }
  }
  else if (type === 'jupyter') {
    let jH = Math.floor((IH - gap) / 2);
    let th = { x: margin, y: margin, w: IW, h: jH };
    let bh = { x: margin, y: margin + jH + gap, w: IW, h: jH };
    if (!collides(th.x, th.y, th.w, th.h)) {
      sX = th.x; sY = th.y; sW = th.w; sH = th.h;
      // Expand downward respecting gap
      while (sY + sH + gap <= innerB && !collides(sX, sY, sW, sH + gap)) sH += gap;
    } else if (!collides(bh.x, bh.y, bh.w, bh.h)) {
      sX = bh.x; sY = bh.y; sW = bh.w; sH = bh.h;
      // Expand upward respecting gap
      while (sY - gap >= margin && !collides(sX, sY - gap, sW, sH + gap)) { sY -= gap; sH += gap; }
    }
  }

  if (sX === -1) {
    showAlert("No Space Found", "No space found for this element on the current layer. Try selecting another layer or moving existing elements.");
    return;
  }

  if (type === 'title') els.push({ type: 'title', content: initialContent || 'Title', x: sX, y: sY, w: sW, h: sH, ...finalDefaults });
  else if (type === 'subtitle') els.push({ type: 'subtitle', content: initialContent || 'Subtitle', x: sX, y: sY, w: sW, h: sH, ...finalDefaults });
  else if (type === 'body') els.push({ type: 'body', content: initialContent || 'Body text', x: sX, y: sY, w: sW, h: sH, ...finalDefaults });
  else if (type === 'image') els.push({ type: 'image', src: '', x: sX, y: sY, w: sW, h: sH, ...finalDefaults });
  else if (type === 'jupyter') els.push({ type: 'jupyter', code: '# Python\n', output: '', codeRatio: 0.6, x: sX, y: sY, w: sW, h: sH, ...finalDefaults });

  selectedElIdx = els.length - 1;
  renderSlide();
}
function removeElement(i) { saveUndo(); slides[currentSlideIdx].elements.splice(i, 1); selectedElIdx = -1; renderSlide(); }

function toggleTextDropdown(e) {
  e.stopPropagation();
  const d = document.getElementById('textDropdown');
  if (d) d.classList.toggle('show');
}

function addAlert(variant) {
  const styles = {
    danger: { borderColor: '#b91c1c', _bgHex: '#f87171', _bgAlpha: 0.25, borderWidth: 2, icon: '❗', label: 'Danger' },
    success: { borderColor: '#15803d', _bgHex: '#4ade80', _bgAlpha: 0.25, borderWidth: 2, icon: '✅', label: 'Success' },
    warning: { borderColor: '#facc15', _bgHex: '#facc15', _bgAlpha: 0.25, borderWidth: 2, icon: '⚠️', label: 'Warning' },
    info: { borderColor: '#1e3a8a', _bgHex: '#22d3ee', _bgAlpha: 0.25, borderWidth: 2, icon: 'ℹ️', label: 'Info' }
  };
  const s = styles[variant];
  const content = `${s.icon} <b style="color:${s.borderColor}">${s.label}</b> ${s.icon}&nbsp; `;
  addElement('body', {
    borderColor: s.borderColor,
    _bgHex: s._bgHex,
    _bgAlpha: s._bgAlpha,
    borderWidth: s.borderWidth,
    bgColor: hexToRgba(s._bgHex, s._bgAlpha)
  }, content);
  const d = document.getElementById('textDropdown');
  if (d) d.classList.remove('show');
}

document.addEventListener('click', () => {
  const d = document.getElementById('textDropdown');
  if (d) d.classList.remove('show');
});
const _elHelpContent = {
  text: `<h4>Text / Title / Subtitle</h4><ul>
    <li><b>Move:</b> Drag the top edge (drag handle).</li>
    <li><b>Resize:</b> Drag the top-left or bottom-right corner.</li>
    <li><b>Levels:</b> Non-image boxes on the same level collide. Change level via ▲▼ in the lower action menu.</li>
    <li><b>Formatting &amp; justification:</b> Shown in the top action menu while editing text.</li>
    <li><b>LaTeX inline:</b> <code>$code$</code></li>
    <li><b>LaTeX block:</b> <code>$$code$$</code></li>
  </ul>`,
  image: `<h4>Image</h4><ul>
    <li><b>Move:</b> Drag the top edge (drag handle).</li>
    <li><b>Resize:</b> Drag the top-left or bottom-right corner — aspect ratio is preserved.</li>
    <li><b>Levels:</b> Image boxes only collide with other images. Change level via ▲▼ in the lower action menu.</li>
    <li><b>Source:</b> Choose from already-uploaded files or pick directly from your file explorer.</li>
    <li>The box resizes automatically to fit the image.</li>
  </ul>`,
  jupyter: `<h4>Code Box</h4><ul>
    <li><b>Move:</b> Drag the top edge (drag handle).</li>
    <li><b>Resize:</b> Drag the top-left or bottom-right corner.</li>
    <li><b>Levels:</b> Non-image boxes on the same level collide. Change level via ▲▼ in the lower action menu.</li>
    <li><b>Editor:</b> Write code on the left; output appears on the right automatically.</li>
    <li><b>Undo / Redo:</b> Ctrl+Z / Ctrl+Y inside the editor.</li>
    <li><b>Font size:</b> Ctrl+Plus / Ctrl+Minus.</li>
    <li><b>Presentation mode:</b> Both panels remain available; you can still run code.</li>
    <li><b>Split ratio:</b> Drag the divider between code and output.</li>
    <li><b>Split mode:</b> Hides output until code is run.</li>
    <li><b>Color mode:</b> Toggle in the lower action bar.</li>
  </ul>`,
};
_elHelpContent.title = _elHelpContent.text;
_elHelpContent.subtitle = _elHelpContent.text;
_elHelpContent['jupyter-input'] = _elHelpContent.jupyter;

let _elHelpPanelEl = null;
function showElHelp(type, event) {
  event.stopPropagation();
  if (_elHelpPanelEl) { _elHelpPanelEl.remove(); _elHelpPanelEl = null; }
  const content = _elHelpContent[type] || _elHelpContent.text;
  const panel = document.createElement('div');
  panel.className = 'el-help-panel';
  panel.innerHTML = content;
  document.body.appendChild(panel);
  _elHelpPanelEl = panel;
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  const pw = 320;
  let left = rect.left - pw - 4;
  if (left < 4) left = rect.right + 4;
  let top = rect.bottom + 4;
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
  setTimeout(() => {
    document.addEventListener('click', function _dismiss() {
      if (_elHelpPanelEl) { _elHelpPanelEl.remove(); _elHelpPanelEl = null; }
      document.removeEventListener('click', _dismiss);
    });
  }, 0);
}

function duplicateElement(i) {
  saveUndo();
  const el = JSON.parse(JSON.stringify(slides[currentSlideIdx].elements[i]));
  el.x = Math.min(el.x + 20, 960 - el.w); el.y = Math.min(el.y + 20, 540 - el.h);
  slides[currentSlideIdx].elements.push(el);
  selectedElIdx = slides[currentSlideIdx].elements.length - 1;
  renderSlide();
}

function onCanvasMouseDown(e) {
  if (e.target.id === 'slideCanvas' || e.target.id === 'canvasWrapper' || e.target.id === 'workspace') {
    if (selectedElIdx !== -1) {
      if (typeof closeColorPalette === 'function') closeColorPalette();
      selectedElIdx = -1;
      renderSlide();
    }
  }
}

// ═══════ RENDER ═══════
function renderSidebar() {
  const list = document.getElementById('slideList'); list.innerHTML = '';
  slides.forEach((s, i) => {
    const hasPy = s.elements.some(e => e.type === 'jupyter');
    const t = document.createElement('div');
    t.className = 'slide-thumb' + (i === currentSlideIdx ? ' active' : '') + (s.hidden ? ' hidden-slide' : '');
    t.draggable = true;
    t.onclick = () => selectSlide(i);
    t.oncontextmenu = (e) => { e.preventDefault(); showCtxMenu(e, i); };
    t.ondragstart = (e) => { e.dataTransfer.setData('text/plain', i); t.classList.add('dragging'); };
    t.ondragend = () => t.classList.remove('dragging');
    t.ondragover = (e) => { e.preventDefault(); t.classList.add('drag-over'); };
    t.ondragleave = () => t.classList.remove('drag-over');
    t.ondrop = (e) => { e.preventDefault(); t.classList.remove('drag-over'); const from = parseInt(e.dataTransfer.getData('text/plain')), to = i; if (from === to) return; saveUndo(); const [m] = slides.splice(from, 1); slides.splice(to, 0, m); currentSlideIdx = to; renderSidebar(); renderSlide(); };
    let preview = '';
    const te = s.elements.find(e => e.type === 'title');
    if (te) preview = te.content.replace(/<[^>]+>/g, ''); else if (hasPy) preview = '🐍 Python Slide'; else preview = 'Blank Slide';
    const slideAnimIcons = { snap: '◌', fade: '●', blur: '◉', slideL: '←', slideR: '→', slideU: '↑', slideD: '↓' };
    const slideAnimNames = { snap: 'None', fade: 'Fade', blur: 'Blur', slideL: 'Slide ←', slideR: 'Slide →', slideU: 'Slide ↑', slideD: 'Slide ↓' };
    const curSlideAnim = s.anim || 'snap';
    t.innerHTML = `
      <span class="slide-thumb-num">${i + 1}</span>
      <div class="slide-thumb-preview">${escHtml(preview)}</div>
      <div class="slide-thumb-icons">
        ${hasPy ? '<span class="badge badge-py">PY</span>' : ''}
        ${s.hidden ? '<span class="badge badge-hidden">H</span>' : ''}
      </div>
      <div class="slide-thumb-actions">
        <button class="layer-anim-toggle" onclick="event.stopPropagation();updateSlideAnim(${i})" title="Slide transition: ${slideAnimNames[curSlideAnim] || 'None'}">${slideAnimIcons[curSlideAnim] || '◌'}</button>
        <button class="slide-action-btn" title="Move Up" onclick="event.stopPropagation();moveSlide(${i},-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="slide-action-btn" title="Move Down" onclick="event.stopPropagation();moveSlide(${i},1)" ${i === slides.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="slide-ctx-menu-btn" title="Options" onclick="event.stopPropagation();showCtxMenu(event,${i})">⋯</button>
      </div>
    `;
    list.appendChild(t);
  });
  document.getElementById('slideCounter').textContent = `Slide ${currentSlideIdx + 1} of ${slides.length}`;
  renderLayerList();
}

function renderSlide() {
  updateWorkspaceBounds();
  const slide = slides[currentSlideIdx];
  const canvas = document.getElementById('slideCanvas');
  const isPresenting = document.body.classList.contains('presenting');
  const wasPresenting = canvas.dataset.wasPresenting === 'true';

  // Apply background and sync UI
  const bgCss = slide.bg === 'custom' ? (slide.bgCustomColor || '#ffffff') : (slide.bg || '#ffffff');
  canvas.style.background = bgCss;
  const bgSelect = document.getElementById('bgSelect');
  if (bgSelect) {
    const _opts = Array.from(bgSelect.options).map(o => o.value);
    bgSelect.value = _opts.includes(slide.bg) ? slide.bg : 'custom';
  }

  let canvasCleared = false;
  if (canvas.dataset.activeSlideId !== slide.id) {
    canvas.innerHTML = '';
    canvas.dataset.activeSlideId = slide.id;
    codeMirrors = {};
    canvasCleared = true;
  }

  if (isPresenting) updatePC();
  canvas.dataset.wasPresenting = isPresenting;

  const layerSeq = slide.layers || [0, 1];
  const hiddenLevels = slide.hiddenLayers || [];

  if (slide.hidden && !isPresenting) {
    const b = document.createElement('div');
    b.style.cssText = 'position:absolute;top:12px;right:12px;background:rgba(248,113,113,0.15);color:var(--red);font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;z-index:200;';
    b.textContent = 'HIDDEN SLIDE'; canvas.appendChild(b);
  }
  const isLight = bgIsLight(slide.bg === 'custom' ? (slide.bgCustomColor || '#ffffff') : (slide.bg || '#ffffff'));

  const isEnteringPresent = isPresenting && !wasPresenting;
  const isSlideSwitchPresent = isPresenting && canvasCleared;
  if (isEnteringPresent || isSlideSwitchPresent) canvas.classList.add('no-anim');

  slide.elements.forEach((el, idx) => {
    const lvl = el.level !== undefined ? parseInt(el.level) : 1;
    if (hiddenLevels.some(h => parseInt(h) === lvl)) return;

    // Reconciliation: Check if element already exists
    let w = canvas.querySelector(`.slide-element-free[data-el-idx="${idx}"]`);
    const isNew = !w;
    if (isNew) {
      w = document.createElement('div');
      w.dataset.elIdx = idx;
      w.dataset.type = el.type;
    }

    w.className = 'slide-element-free' + (idx === selectedElIdx ? ' selected' : '');

    const layerPriority = layerSeq.indexOf(lvl);
    let isAbove = true;
    let animZ = 50 + (layerPriority === -1 ? 0 : layerPriority);
    let transform = 'translate(0,0)';

    if (isPresenting) {
      if (lvl === 0) {
        isAbove = true;
        w.classList.remove('anim-snap');
        w.style.filter = '';
      } else {
        const timingStr = (slide.layerTiming && slide.layerTiming[lvl]) || '0-';
        const range = parseTiming(timingStr);
        isAbove = (presentStep >= range.start && presentStep <= range.end);
        const isEntryPhase = presentStep < range.start;

        // Resolve entry and exit anims
        let entryAnim = 'snap', exitAnim = 'snap';
        if (slide.layerAnim && slide.layerAnim[lvl]) {
          const animData = slide.layerAnim[lvl];
          if (typeof animData === 'string') {
            entryAnim = exitAnim = animData;
          } else {
            entryAnim = animData.entry || 'snap';
            exitAnim = animData.exit || 'snap';
          }
        }
        // Phase-specific anim: entry phase uses entryAnim, exit phase uses exitAnim.
        // When the element is visible (isAbove) the entry anim governs how it arrived.
        const phaseAnim = isEntryPhase ? entryAnim : exitAnim;
        const relevantAnim = isAbove ? entryAnim : phaseAnim;

        if (!isAbove) {
          const offset = 600;
          // Invert the off-screen start position for entry so it slides TOWARDS the specified direction
          const dirMod = isEntryPhase ? -1 : 1;
          if (phaseAnim === 'slideL') transform = `translateX(${dirMod * -offset}px)`;
          else if (phaseAnim === 'slideR') transform = `translateX(${dirMod * offset}px)`;
          else if (phaseAnim === 'slideU') transform = `translateY(${dirMod * -offset}px)`;
          else if (phaseAnim === 'slideD') transform = `translateY(${dirMod * offset}px)`;
        }

        // Snap: instant cut — suppress CSS transition entirely
        if (relevantAnim === 'snap') w.classList.add('anim-snap');
        else w.classList.remove('anim-snap');

        // Blur: apply blur filter when hidden, clear when visible
        if (relevantAnim === 'blur') w.style.filter = isAbove ? 'blur(0px)' : 'blur(12px)';
        else w.style.filter = '';
      }
      animZ = isAbove ? (110 + layerPriority) : (50 + layerPriority);
    }

    // jupyter-output gets boosted z when visible (both modes), lowered when behind
    if (isPresenting && el.type === 'jupyter-output' && el.outputVisible) animZ += 10;
    const outputEditorZ = el.type === 'jupyter-output' ? (el.outputVisible ? 15 : -5) : 0;
    const z = isPresenting ? animZ : ((50 + (layerPriority === -1 ? 0 : layerPriority) * 20) +
      (parseInt(selectedLayer) === lvl ? 200 : 0) +
      (idx === selectedElIdx ? 500 : 0) + outputEditorZ);

    // Update wrapper position and basic layer styles
    w.style.left = `${el.x || 0}px`;
    w.style.top = `${el.y || 0}px`;
    w.style.width = `${el.w || 300}px`;
    w.style.height = `${el.h || 80}px`;
    w.style.zIndex = z;

    // jupyter-output always mirrors its linked input's bounds exactly
    if (el.type === 'jupyter-output' && el.linkId) {
      const linkedInput = slide.elements.find(e => e.type === 'jupyter-input' && e.linkId === el.linkId);
      if (linkedInput) {
        el.x = linkedInput.x; el.y = linkedInput.y;
        el.w = linkedInput.w; el.h = linkedInput.h;
        w.style.left = `${linkedInput.x}px`;
        w.style.top = `${linkedInput.y}px`;
        w.style.width = `${linkedInput.w}px`;
        w.style.height = `${linkedInput.h}px`;
      }
    }

    if (isPresenting) {
      if (isAbove) w.classList.remove('exiting');
      else w.classList.add('exiting');

      w.style.opacity = isAbove ? 1 : 0;
      w.style.transform = transform;
      w.style.visibility = isAbove ? 'visible' : 'hidden';
      w.style.pointerEvents = isAbove ? 'auto' : 'none';
      // jupyter-output: hidden until code runs, shown when outputVisible
      if (el.type === 'jupyter-output') {
        const show = isAbove && !!el.outputVisible;
        w.style.visibility = show ? 'visible' : 'hidden';
        w.style.pointerEvents = show ? 'auto' : 'none';
      }
    } else {
      w.style.opacity = 1;
      w.style.transform = '';
      w.style.filter = '';
      w.classList.remove('anim-snap');
      // jupyter-output wrapper is always pointer-events:none in editor mode so it
      // never blocks the input's drag/resize handles. The Clear button inside sets
      // its own pointer-events:auto so it stays clickable when in the foreground.
      w.style.pointerEvents = el.type === 'jupyter-output' ? 'none' : 'auto';
      w.style.transition = '';
      // Hide output cell in editor when behind input; only show when in foreground (outputVisible)
      w.style.visibility = (el.type === 'jupyter-output' && !el.outputVisible) ? 'hidden' : 'visible';
    }

    if (isPresenting && el.type === 'jupyter') {
      w.style.pointerEvents = isAbove ? 'auto' : 'none';
    }

    // Append new wrappers before building contents so applyBoxStyle can find them via querySelector
    if (isNew) canvas.appendChild(w);

    // Only rebuild inner contents if NEW or in Editor Mode
    if (isNew || !isPresenting) {
      w.innerHTML = '';

      if (el.type === 'jupyter-output') {
        // Output cell: content only, no drag/resize/action controls
        renderJupyterOutputEl(w, el, idx);
      } else {
        if (idx === selectedElIdx) { const sb = document.createElement('div'); sb.className = 'sel-border'; w.appendChild(sb); }

        w.innerHTML += `<div class="el-actions-free"><button class="el-help-btn" onclick="showElHelp('${el.type}',event)" title="Help">?</button><button onclick="event.stopPropagation();duplicateElement(${idx})" title="Duplicate" style="background:var(--bg-card)">📋</button><button onclick="event.stopPropagation();removeElement(${idx})" title="Remove">✕</button></div>`;

        // Drag header
        const dh = document.createElement('div'); dh.className = 'drag-header';
        dh.innerHTML = '<span class="dots"></span>';
        dh.addEventListener('mousedown', (e) => { e.preventDefault(); selectEl(idx); startDrag(e, idx); });
        w.appendChild(dh);

        // Universal selection click
        w.addEventListener('mousedown', (e) => {
          if (e.target.closest('.el-actions-free') || e.target.closest('.resize-handle') || e.target.closest('.drag-header')) return;
          selectEl(idx);
        });

        // Resize
        const rh = document.createElement('div'); rh.className = 'resize-handle';
        rh.addEventListener('mousedown', (e) => startResize(e, idx));
        w.appendChild(rh);

        // Resize NW
        const rhNW = document.createElement('div'); rhNW.className = 'resize-handle resize-nw';
        rhNW.addEventListener('mousedown', (e) => startResize(e, idx, 'nw'));
        w.appendChild(rhNW);

        if (el.type === 'title' || el.type === 'subtitle' || el.type === 'body') renderTextEl(w, el, idx, isLight);
        else if (el.type === 'image') renderImageEl(w, el, idx);
        else if (el.type === 'jupyter') renderJupyterEl(w, el, idx);
        else if (el.type === 'jupyter-input') renderJupyterInputEl(w, el, idx);
      }
    }
  });

  if (isEnteringPresent || isSlideSwitchPresent) {
    canvas.offsetHeight; // Force reflow
    canvas.classList.remove('no-anim');
  }

  // Cleanup: Remove DOM elements that no longer exist or belong to a hidden layer
  const currentEls = canvas.querySelectorAll('.slide-element-free');
  currentEls.forEach(existingW => {
    const eIdx = parseInt(existingW.dataset.elIdx);
    if (eIdx >= slide.elements.length) { existingW.remove(); return; }
    const elData = slide.elements[eIdx];
    if (elData) {
      const lvl = elData.level !== undefined ? parseInt(elData.level) : 1;
      if (hiddenLevels.some(h => parseInt(h) === lvl)) existingW.remove();
    }
  });

  // Bg image overlay: create/remove as needed
  const bgClip = canvas.querySelector('#bgImgClip');
  if (slide.bg === 'custom' && slide.bgImage) {
    if (!bgClip) renderBgImageOverlay(canvas, slide);
    refreshBgImageOverlay();
  } else if (bgClip) {
    bgClip.remove();
  }
}

function renderTextEl(w, el, idx, isLight) {
  const box = document.createElement('div'); box.className = 'text-element-box';

  const c = document.createElement('div');
  c.className = `text-element-content ${el.type}-el`;
  c.contentEditable = true; c.innerHTML = el.content;
  if (el.fontSize) c.style.fontSize = el.fontSize + 'px';
  if (isLight && !el.bgColor) c.style.color = '#1a1a2e';

  // Render any $...$ / $$...$$ in the initial content
  renderMathInElement(c);

  c.addEventListener('focus', () => {
    c.classList.add('chip-editing'); // show compact chip boxes while editing
    selectEl(idx);
  });
  c.addEventListener('input', () => {
    slides[currentSlideIdx].elements[idx].content = getRawMathContent(c);
    renderSidebar();
  });
  c.addEventListener('mouseup', () => setTimeout(updateTbState, 10));
  c.addEventListener('keyup',   () => setTimeout(updateTbState, 10));
  c.addEventListener('blur', (e) => {
    const toToolbar = e.relatedTarget && e.relatedTarget.closest('.text-toolbar');
    const toPopup   = e.relatedTarget && e.relatedTarget.closest('#mathEditorPopup');
    if (toPopup) return; // popup is taking over; keep chip-editing state
    if (!toToolbar) {
      c.classList.remove('chip-editing'); // back to rendered mode
      slides[currentSlideIdx].elements[idx].content = getRawMathContent(c);
    }
  });

  box.appendChild(c); w.appendChild(box);
  applyBoxStyle(idx);

  if (idx === selectedElIdx) {
    const tb = mkTextToolbar(idx); w.appendChild(tb);
    const sp = mkStylePanel(idx, el); w.appendChild(sp);
    // Style panel shows immediately on selection; toolbar only while text is focused
    setTimeout(() => sp.classList.add('visible'), 20);
    c.addEventListener('focus', () => tb.classList.add('visible'));
    c.addEventListener('blur', (e) => {
      // Keep toolbar open when clicking toolbar buttons (they use onmousedown + preventDefault)
      if (!e.relatedTarget || !e.relatedTarget.closest('.text-toolbar')) {
        tb.classList.remove('visible');
      }
    });
  }
}

function ensureUtf8(d) {
  if (typeof d === 'string' && d.startsWith('data:text/html') && !d.includes('charset=utf-8')) {
    return d.replace('data:text/html', 'data:text/html;charset=utf-8');
  }
  return d;
}

function getMediaType(dataUrl) {
  if (!dataUrl) return 'image';
  if (dataUrl.startsWith('data:video/')) return 'video';
  if (dataUrl.startsWith('data:text/html')) return 'html';
  return 'image';
}

function renderImageEl(w, el, idx) {
  const d = document.createElement('div');
  d.className = 'image-element' + (el.src ? ' has-image' : '');

  if (el.src) {
    const type = getMediaType(el.src);
    if (type === 'video') {
      const mode = el.videoMode || 'bg';
      const v = document.createElement('video');
      v.src = el.src;
      v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'contain';
      if (mode === 'bg') {
        v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
      } else {
        v.controls = true; v.muted = false;
      }
      d.appendChild(v);
    } else if (type === 'html') {
      const f = document.createElement('iframe');

      // Inject a margin reset and overflow hidden to prevent internal scrollbars
      let htmlSrc = ensureUtf8(el.src);
      const resetStyle = '<style>body{margin:0;padding:0;overflow:hidden;}::-webkit-scrollbar{display:none;}</style>';
      if (htmlSrc.includes('</head>')) {
        htmlSrc = htmlSrc.replace('</head>', resetStyle + '</head>');
      } else if (htmlSrc.includes('<body>')) {
        htmlSrc = htmlSrc.replace('<body>', '<body>' + resetStyle);
      } else {
        htmlSrc = htmlSrc.replace('data:text/html;charset=utf-8,', 'data:text/html;charset=utf-8,' + resetStyle);
      }

      f.src = htmlSrc;
      f.scrolling = "no";
      f.style.border = 'none';
      f.sandbox = "allow-scripts allow-popups allow-forms allow-same-origin";

      // Calculate scale based on box size vs. natural size
      const naturalW = el.naturalW || 960;
      const naturalH = el.naturalH || 540;
      const scale = el.w / naturalW;

      f.style.width = naturalW + 'px';
      f.style.height = naturalH + 'px';
      f.style.transform = `scale(${scale})`;
      f.style.transformOrigin = '0 0';
      f.style.position = 'absolute';
      f.style.top = '0';
      f.style.left = '0';

      d.appendChild(f);
      d.style.position = 'relative';
      d.style.overflow = 'hidden';
    } else {
      const img = document.createElement('img');
      img.src = el.src; d.appendChild(img);
    }
  } else {
    d.innerHTML = '📷 Click to upload';
  }

  w.appendChild(d);
  applyBoxStyle(idx);

  if (idx === selectedElIdx) {
    const sp = mkStylePanel(idx, el); w.appendChild(sp);
    setTimeout(() => sp.classList.add('visible'), 20);
  }

  d.onclick = () => {
    if (el.src) return;
    openMediaPicker(idx);
  };
}

let activePickerElIdx = -1;
function openMediaPicker(idx) {
  activePickerElIdx = idx;
  const filter = document.getElementById('pickerFilter');
  if (filter) filter.value = 'all';
  renderPickerGrid('all');
  document.getElementById('mediaPickerModal').classList.add('show');
}

function renderPickerGrid(filter) {
  const container = document.getElementById('pickerGrid');
  if (!container) return;
  container.innerHTML = '';

  const files = Object.values(uploadedFiles).filter(f => {
    if (!f) return false;
    const name = f.name.toLowerCase();
    if (name.endsWith('.py')) return false;

    const isImg = /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(name);
    const isVid = /\.(mp4|webm|ogg)$/i.test(name);
    const isHtml = name.endsWith('.html');

    if (filter === 'image') return isImg;
    if (filter === 'video') return isVid;
    if (filter === 'html') return isHtml;
    return isImg || isVid || isHtml;
  });

  if (files.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted); font-size:13px;">No fitting assets found in library.</div>';
    return;
  }

  files.forEach(f => {
    const isImg = /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i.test(f.name);
    const isVid = /\.(mp4|webm|ogg)$/i.test(f.name);

    const item = document.createElement('div');
    item.className = 'picker-item';
    item.onclick = () => selectPickerAsset(f.name);

    let preview;
    if (isImg && f.data) {
      preview = `<img class="picker-item-thumb" src="${escHtml(f.data)}" alt="${escHtml(f.name)}">`;
    } else {
      const icon = isVid ? '🎬' : '🌐';
      preview = `<div class="picker-item-icon">${icon}</div>`;
    }

    item.innerHTML = `
      ${preview}
      <div class="picker-item-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
    `;
    container.appendChild(item);
  });
}

async function selectPickerAsset(name) {
  const f = uploadedFiles[name];
  if (!f) return;
  const el = slides[currentSlideIdx].elements[activePickerElIdx];
  el.src = f.data;

  // Auto-fit dimensions
  try {
    const dim = await getMediaDimensions(f.data);
    const aspect = dim.w / dim.h;
    let targetW = dim.w;
    let targetH = dim.h;
    const maxW = 880, maxH = 460;

    if (targetW > maxW) { targetW = maxW; targetH = targetW / aspect; }
    if (targetH > maxH) { targetH = maxH; targetW = targetH * aspect; }

    el.w = Math.round(targetW);
    el.h = Math.round(targetH);
    el.naturalW = dim.w;
    el.naturalH = dim.h;
  } catch (e) { console.error("Dim fetch failed", e); }

  const nameL = name.toLowerCase();
  if (nameL.endsWith('.mp4') || nameL.endsWith('.webm') || nameL.endsWith('.ogg')) {
    el.videoMode = 'bg';
  }
  closeModal('mediaPickerModal');
  renderSlide();
}

function getMediaDimensions(src) {
  return new Promise((resolve, reject) => {
    const type = getMediaType(src);
    if (type === 'video') {
      const v = document.createElement('video'); v.src = src;
      v.onloadedmetadata = () => resolve({ w: v.videoWidth, h: v.videoHeight });
      v.onerror = reject;
    } else if (type === 'html') {
      try {
        const decoded = atob(src.split(',')[1]);
        const parser = new DOMParser();
        const doc = parser.parseFromString(decoded, 'text/html');
        let w = null, h = null;

        // 1. Attributes on body/html
        w = parseInt(doc.body.getAttribute('width')) || parseInt(doc.documentElement.getAttribute('width'));
        h = parseInt(doc.body.getAttribute('height')) || parseInt(doc.documentElement.getAttribute('height'));

        // 2. Standard Viewport OR custom "dimensions" meta
        const metaTags = doc.querySelectorAll('meta');
        metaTags.forEach(m => {
          const name = m.getAttribute('name') || '';
          const prop = m.getAttribute('property') || '';
          const cont = m.getAttribute('content') || '';

          if (name === 'viewport' || name === 'dimensions' || name === 'viewport-width' || name === 'viewport-height') {
            const mw = cont.match(/width=(\d+)/) || (name.includes('width') ? [0, cont] : null);
            const mh = cont.match(/height=(\d+)/) || (name.includes('height') ? [0, cont] : null);
            if (mw && !w) w = parseInt(mw[1]);
            if (mh && !h) h = parseInt(mh[1]);
          }
          // 3. OpenGraph Tags
          if (prop === 'og:image:width' && !w) w = parseInt(cont);
          if (prop === 'og:image:height' && !h) h = parseInt(cont);
        });

        // 4. Data attributes on the first significant div or body
        const firstDiv = doc.querySelector('div[data-width]');
        if (firstDiv && !w) {
          w = parseInt(firstDiv.getAttribute('data-width'));
          h = parseInt(firstDiv.getAttribute('data-height'));
        }

        // 5. JSON-LD
        const jsonLd = doc.querySelector('script[type="application/ld+json"]');
        if (jsonLd && (!w || !h)) {
          try {
            const data = JSON.parse(jsonLd.textContent);
            if (data.width && !w) w = parseInt(data.width);
            if (data.height && !h) h = parseInt(data.height);
          } catch (e) { }
        }

        resolve({ w: w || 960, h: h || 540 });
      } catch (e) {
        resolve({ w: 960, h: 540 });
      }
    } else {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = src;
    }
  });
}

async function uploadFromPicker() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,video/*,text/html';
  inp.onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    let data = await new Promise((resolve) => {
      const r = new FileReader(); r.onload = (re) => resolve(re.target.result); r.readAsDataURL(f);
    });
    const nameL = f.name.toLowerCase();
    const isHtmlFile = nameL.endsWith('.html');
    const isVideoFile = nameL.endsWith('.mp4') || nameL.endsWith('.webm') || nameL.endsWith('.ogg');

    if (isHtmlFile) {
      if (data.startsWith('data:application/octet-stream')) {
        data = data.replace('data:application/octet-stream', 'data:text/html');
      }
      data = ensureUtf8(data);
    } else if (isVideoFile) {
      if (data.startsWith('data:application/octet-stream')) {
        data = data.replace('data:application/octet-stream', 'data:video/mp4');
      }
    }

    let fileObj = {
      name: f.name,
      data,
      type: (isHtmlFile) ? 'text' : 'binary'
    };
    fileObj = await handleFileConflict(fileObj);
    if (fileObj) {
      uploadedFiles[fileObj.name] = fileObj;
      await selectPickerAsset(fileObj.name);
      renderUploadedFiles();
      toast(`Asset uploaded and linked: ${fileObj.name}`);
    }
  };
  inp.click();
}

function renderJupyterEl(w, el, idx) {
  const cmId = `cm_${currentSlideIdx}_${idx}`;
  const cell = document.createElement('div'); cell.className = `jupyter-cell cm6-bundled${el.cmTheme === 'light' ? ' cm-light' : ''}`;
  const ratio = el.codeRatio || 0.6;
  const outputSuppressed = ratio >= 0.98;

  if (outputSuppressed) {
    cell.innerHTML = `
      <div class="cell-code-side" style="flex:1">
        <div class="cell-code-header">
          <span class="cell-code-label"><span class="py-dot"></span>Python</span>
          <div class="cell-controls">
            <button class="run-btn" id="runBtn_${idx}" onclick="event.stopPropagation();runCell(${idx})">▶ Run</button>
          </div>
        </div>
        <div class="cell-code-editor" id="editor_${cmId}"></div>
      </div>
      <div class="cell-divider" onclick="event.stopPropagation()" title="Drag to restore output"></div>
      <div class="cell-output-side" style="flex:0;min-width:0;overflow:hidden;width:0">
        <div class="cell-output-header">
          <span class="cell-output-label">⬡ Output</span>
          <button class="clear-output-btn" onclick="event.stopPropagation();clearOutput(${idx})">✕ Clear</button>
        </div>
        <div class="cell-output-content" id="output_${idx}">
          ${el.output || '<span style="color:var(--text-muted)">Run code to see output...</span>'}
        </div>
      </div>
    `;
  } else {
    cell.innerHTML = `
      <div class="cell-code-side" style="flex: ${ratio}">
        <div class="cell-code-header">
          <span class="cell-code-label"><span class="py-dot"></span>Python</span>
          <div class="cell-controls">
            <button class="run-btn" id="runBtn_${idx}" onclick="event.stopPropagation();runCell(${idx})">▶ Run</button>
            <button class="cell-action-btn" onclick="event.stopPropagation();separateCell(${idx})" title="Split Input/Output">◩ Split</button>
          </div>
        </div>
        <div class="cell-code-editor" id="editor_${cmId}"></div>
      </div>
      <div class="cell-divider" onclick="event.stopPropagation()"></div>
      <div class="cell-output-side" style="flex: ${1 - ratio}">
        <div class="cell-output-header">
          <span class="cell-output-label">⬡ Output</span>
          <button class="clear-output-btn" onclick="event.stopPropagation();clearOutput(${idx})">✕ Clear</button>
        </div>
        <div class="cell-output-content" id="output_${idx}">
          ${el.output || '<span style="color:var(--text-muted)">Run code to see output...</span>'}
        </div>
      </div>
    `;
  }
  w.appendChild(cell);
  applyBoxStyle(idx);

  if (!document.body.classList.contains('presenting')) {
    const divider = cell.querySelector('.cell-divider');
    if (divider) divider.addEventListener('mousedown', (e) => { e.stopPropagation(); startCellRatioResize(e, idx); });
  }

  if (idx === selectedElIdx && !document.body.classList.contains('presenting')) {
    const sp = mkStylePanel(idx, el); w.appendChild(sp);
    setTimeout(() => sp.classList.add('visible'), 20);
  }

  requestAnimationFrame(() => {
    const ee = document.getElementById(`editor_${cmId}`);
    if (!ee) return;
    initCM6(ee, el, cmId);
  });
}

function renderJupyterInputEl(w, el, idx) {
  const cmId = `cm_${currentSlideIdx}_${idx}`;
  const cell = document.createElement('div'); cell.className = `jupyter-cell jupyter-sep-input${el.cmTheme === 'light' ? ' cm-light' : ''}`;
  cell.innerHTML = `
    <div class="cell-code-side" style="flex:1">
      <div class="cell-code-header">
        <span class="cell-code-label"><span class="py-dot"></span>Python</span>
        <div class="cell-controls">
          <button class="run-btn" id="runBtn_${idx}" onclick="event.stopPropagation();runCell(${idx})">▶ Run</button>
          <button class="cell-action-btn" onclick="event.stopPropagation();mergeCell(${idx})" title="Merge with Output">◪ Merge</button>
        </div>
      </div>
      <div class="cell-code-editor" id="editor_${cmId}"></div>
    </div>
  `;
  w.appendChild(cell);
  applyBoxStyle(idx);

  if (idx === selectedElIdx && !document.body.classList.contains('presenting')) {
    const sp = mkStylePanel(idx, el); w.appendChild(sp);
    setTimeout(() => sp.classList.add('visible'), 20);
  }

  requestAnimationFrame(() => {
    const ee = document.getElementById(`editor_${cmId}`);
    if (ee) initCM6(ee, el, cmId);
  });
}

function renderJupyterOutputEl(w, el, idx) {
  const cell = document.createElement('div'); cell.className = `jupyter-cell jupyter-sep-output${el.cmTheme === 'light' ? ' cm-light' : ''}`;
  cell.innerHTML = `
    <div class="cell-output-side" style="flex:1">
      <div class="cell-output-header">
        <span class="cell-output-label">⬡ Output</span>
        <div class="cell-controls">
          <button class="clear-output-btn" onclick="event.stopPropagation();clearOutput(${idx})" title="Clear Output" style="pointer-events:auto">✕</button>
        </div>
      </div>
      <div class="cell-output-content" id="output_${idx}">
        ${el.output || '<span style="color:var(--text-muted)">Results...</span>'}
      </div>
    </div>
  `;
  w.appendChild(cell);
  applyBoxStyle(idx);
}

function separateCell(i) {
  saveUndo();
  const els = slides[currentSlideIdx].elements;
  const el = els[i];
  const linkId = genId();

  const inputEl = {
    ...JSON.parse(JSON.stringify(el)),
    type: 'jupyter-input',
    linkId
  };

  const outputEl = {
    ...JSON.parse(JSON.stringify(el)),
    type: 'jupyter-output',
    output: el.output || '',
    outputVisible: !!(el.output && el.output.trim() && !el.output.includes('Run code to see output')),
    linkId
  };

  els.splice(i, 1, inputEl, outputEl);
  selectedElIdx = i;
  renderSlide();
}

function mergeCell(i) {
  saveUndo();
  const els = slides[currentSlideIdx].elements;
  const el = els[i];
  const linkId = el.linkId;
  if (!linkId) return;

  const partnerIdx = els.findIndex((e, idx) => idx !== i && e.linkId === linkId);
  if (partnerIdx === -1) {
    // Just convert back to jupyter
    el.type = 'jupyter';
    delete el.linkId;
  } else {
    const p = els[partnerIdx];
    const input = el.type === 'jupyter-input' ? el : p;
    const output = el.type === 'jupyter-output' ? el : p;

    const newEl = {
      ...input,
      type: 'jupyter',
      codeRatio: input.codeRatio || 0.6,
      output: output.output
    };
    delete newEl.linkId;

    if (i < partnerIdx) {
      els.splice(partnerIdx, 1);
      els.splice(i, 1, newEl);
    } else {
      els.splice(i, 1);
      els.splice(partnerIdx, 1, newEl);
    }
  }

  selectedElIdx = -1;
  renderSlide();
}

function startCellRatioResize(e, idx) {
  const el = slides[currentSlideIdx].elements[idx];
  const wrapper = document.querySelector(`[data-el-idx="${idx}"]`);
  if (!wrapper) return;

  const startX = e.clientX;
  const startRatio = el.codeRatio || 0.6;
  const rect = wrapper.getBoundingClientRect();
  const width = rect.width;

  document.body.classList.add('resizing-ratio');

  const onMove = (ev) => {
    const deltaX = (ev.clientX - startX) / workspaceZoom;
    let newRatio = startRatio + (deltaX / (width / workspaceZoom));

    // Snapping points — including 1.0 to fully suppress output
    const snaps = [0.25, 0.4, 0.5, 0.6, 0.75, 1.0];
    for (const snap of snaps) {
      if (Math.abs(newRatio - snap) < (snap >= 0.98 ? 0.04 : 0.03)) {
        newRatio = snap;
        break;
      }
    }

    // Clamp: allow full suppression of output at 1.0
    newRatio = Math.max(0.25, Math.min(1.0, newRatio));

    el.codeRatio = newRatio;
    const outputSuppressed = newRatio >= 0.98;

    // Live update flex without full re-render for performance
    const codeSide = wrapper.querySelector('.cell-code-side');
    const outSide = wrapper.querySelector('.cell-output-side');
    const divider = wrapper.querySelector('.cell-divider');
    if (outputSuppressed) {
      if (codeSide) { codeSide.style.flex = '1'; }
      if (outSide) { outSide.style.flex = '0'; outSide.style.minWidth = '0'; outSide.style.width = '0'; outSide.style.overflow = 'hidden'; }
      // Keep divider visible so user can drag it back
    } else {
      if (codeSide) { codeSide.style.flex = String(newRatio); }
      if (outSide) { outSide.style.flex = String(1 - newRatio); outSide.style.width = ''; outSide.style.minWidth = ''; outSide.style.overflow = ''; }
      if (divider) { divider.style.display = ''; }
    }

    // Refresh CodeMirror to fit new width
    const cmId = `cm_${currentSlideIdx}_${idx}`;
    // CM6 automatically handles layout changes
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.classList.remove('resizing-ratio');
    renderSlide(); // Re-render to show/hide buttons after suppression change
    saveUndo();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function clearLinkedOutput(inputIdx) {
  const el = slides[currentSlideIdx].elements[inputIdx];
  if (!el || !el.linkId) return;
  const outputIdx = slides[currentSlideIdx].elements.findIndex(
    (e, k) => k !== inputIdx && e.linkId === el.linkId && e.type === 'jupyter-output'
  );
  if (outputIdx !== -1) clearOutput(outputIdx);
}

// ═══════ STYLE PANEL ═══════
function mkStylePanel(idx, el) {
  const p = document.createElement('div'); p.className = 'style-panel'; p.id = `sp_${idx}`;
  const isJupyter = el.type === 'jupyter' || el.type === 'jupyter-input';
  const layerIndicator = (() => {
    const slide = slides[currentSlideIdx];
    const layers = slide.layers || [0, 1];
    const lIdx = layers.indexOf(el.level !== undefined ? el.level : 1);
    return lIdx === 0 ? 'BG' : 'L' + lIdx;
  })();
  p.innerHTML = `
    <span class="sp-label">Border</span>
    <button class="palette-trigger-btn" style="background:${el.borderColor || '#7c6cf0'}" onclick="openColorPalette(this, '${el.borderColor || '#7c6cf0'}', (hex)=> { this.style.background=hex; setBorderColor(${idx}, hex); })"></button>
    <select class="sp-select" onchange="setBorderWidth(${idx},this.value)">
      <option value="0" ${(!el.borderWidth) ? 'selected' : ''}>0</option>
      <option value="1" ${el.borderWidth === 1 ? 'selected' : ''}>1</option>
      <option value="2" ${el.borderWidth === 2 ? 'selected' : ''}>2</option>
      <option value="3" ${el.borderWidth === 3 ? 'selected' : ''}>3</option>
      <option value="4" ${el.borderWidth === 4 ? 'selected' : ''}>4</option>
    </select>
    <button class="layer-btn" onclick="toggleCorners(${idx})" title="Toggle Rounded/Sharp Corners">${el.sharpCorners ? '⬛' : '⚪'}</button>
    <div class="tt-sep"></div>
    ${!isJupyter ? `
      <span class="sp-label">Fill</span>
      <button class="palette-trigger-btn" style="background:${rgbaToHex(el.bgColor) || '#22222e'}" onclick="openColorPalette(this, '${rgbaToHex(el.bgColor) || '#22222e'}', (hex)=> { this.style.background=hex; setBgColor(${idx}, hex); })"></button>
      <select class="sp-select" onchange="setBgAlpha(${idx},this.value)">
        <option value="0" ${(el._bgAlpha || 0) === 0 ? 'selected' : ''}>0%</option>
        <option value="0.08" ${el._bgAlpha === 0.08 ? 'selected' : ''}>8%</option>
        <option value="0.15" ${el._bgAlpha === 0.15 ? 'selected' : ''}>15%</option>
        <option value="0.25" ${el._bgAlpha === 0.25 ? 'selected' : ''}>25%</option>
        <option value="0.4" ${el._bgAlpha === 0.4 ? 'selected' : ''}>40%</option>
        <option value="0.6" ${el._bgAlpha === 0.6 ? 'selected' : ''}>60%</option>
        <option value="0.85" ${el._bgAlpha === 0.85 ? 'selected' : ''}>85%</option>
        <option value="1" ${el._bgAlpha === 1 ? 'selected' : ''}>100%</option>
      </select>
      <div class="tt-sep"></div>
    ` : ''}
    ${isJupyter ? `
      <span class="sp-label">Theme</span>
      <select class="sp-select" onchange="setCMTheme(${idx}, this.value)">
        <option value="dark" ${(el.cmTheme || 'dark') !== 'light' ? 'selected' : ''}>Dark</option>
        <option value="light" ${el.cmTheme === 'light' ? 'selected' : ''}>Light</option>
      </select>
      <div class="tt-sep"></div>
    ` : ''}
    <span class="sp-label">Layer</span>
    <button class="layer-btn" onclick="changeLevel(${idx}, -1)" ${el.level === 0 ? 'disabled' : ''} title="Move Down">▼</button>
    <button class="layer-btn" onclick="changeLevel(${idx}, 1)" title="Move Up">▲</button>
    <span class="sp-layer-indicator">${layerIndicator}</span>
  `;

  const mType = el.src ? getMediaType(el.src) : '';
  if (mType === 'video' || el.videoMode) {
    p.innerHTML += `
      <div class="tt-sep"></div>
      <span class="sp-label">Playback</span>
      <select class="sp-select" onchange="setVideoMode(${idx},this.value)">
        <option value="bg" ${el.videoMode === 'bg' || !el.videoMode ? 'selected' : ''}>Cinematic</option>
        <option value="player" ${el.videoMode === 'player' ? 'selected' : ''}>Player</option>
      </select>
    `;
  }

  return p;
}
// ═══════ LAYER DIALOGS ═══════
let confirmResolve = null;
function showConfirm(title, message, okText = 'Confirm', cancelText = 'Cancel') {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmOkBtn').textContent = okText;
    const cb = document.getElementById('confirmCancelBtn');
    if (cb) { cb.textContent = cancelText; cb.style.display = 'block'; }
    document.getElementById('confirmOverlay').classList.add('show');
  });
}
function showAlert(title, message, okText = 'OK') {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmOkBtn').textContent = okText;
    const cb = document.getElementById('confirmCancelBtn');
    if (cb) cb.style.display = 'none';
    document.getElementById('confirmOverlay').classList.add('show');
  });
}
function closeConfirm(val) {
  document.getElementById('confirmOverlay').classList.remove('show');
  if (confirmResolve) { confirmResolve(val); confirmResolve = null; }
}

// Returns true if moving `el` onto `targetLvl` would create a collision.
// Images only collide with other images; all other types collide with each other.
function hasLayerCollision(el, targetLvl, slide) {
  const isImage = el.type === 'image';
  return slide.elements.some(e => {
    if (e === el) return false;
    if ((e.level !== undefined ? parseInt(e.level) : 1) !== targetLvl) return false;
    const eIsImage = e.type === 'image';
    return isImage ? eIsImage : !eIsImage;
  });
}

async function changeLevel(idx, dir) {
  saveUndo();
  const slide = slides[currentSlideIdx];
  const el = slide.elements[idx];
  if (!slide.layers) slide.layers = [0, 1];

  let curLvl = el.level !== undefined ? el.level : 1;
  const layers = slide.layers;
  const curIdx = layers.indexOf(curLvl);
  const targetIdx = curIdx + dir;

  // Move DOWN
  if (dir === -1) {
    if (curLvl === 0) return; // Already at bottom
    if (targetIdx === 0) {
      if (el.type === 'image') {
        el.level = 0;
      } else {
        if (await showConfirm("New Layer", "Create a new layer between this element and the Background?", "Create Layer")) {
          const newLvl = Math.max(...layers) + 1;
          layers.splice(1, 0, newLvl);
          el.level = newLvl;
        } else {
          return; // Cancelled
        }
      }
    } else {
      const targetLvl = layers[targetIdx];
      if (hasLayerCollision(el, targetLvl, slide)) {
        if (await showConfirm("Layer Occupied", "Moving here would overlap with an existing element. Create a new layer in between?", "Create Layer")) {
          const newLvl = Math.max(...layers) + 1;
          layers.splice(curIdx, 0, newLvl); // insert between targetIdx and curIdx
          el.level = newLvl;
        } else {
          return; // Cancelled
        }
      } else {
        el.level = targetLvl;
      }
    }
  }
  // Move UP
  else {
    if (targetIdx >= layers.length) {
      if (layers.length >= 20) {
        await showAlert("Layer Limit", "Maximum of 20 layers reached per slide.");
        return;
      }
      if (await showConfirm("New Layer", "Create a new layer on top of the current stack?", "Create Layer")) {
        const newLvl = Math.max(...layers) + 1;
        layers.push(newLvl);
        el.level = newLvl;
      } else {
        return; // Cancelled
      }
    } else {
      const targetLvl = layers[targetIdx];
      if (hasLayerCollision(el, targetLvl, slide)) {
        if (await showConfirm("Layer Occupied", "Moving here would overlap with an existing element. Create a new layer in between?", "Create Layer")) {
          const newLvl = Math.max(...layers) + 1;
          layers.splice(targetIdx, 0, newLvl); // insert between curIdx and targetIdx
          el.level = newLvl;
        } else {
          return; // Cancelled
        }
      } else {
        el.level = targetLvl;
      }
    }
  }

  renderSlide();
  renderLayerList();
}

function renderLayerList() {
  const slide = slides[currentSlideIdx];
  if (!slide) return;
  const list = document.getElementById('layerList');
  if (!list) return;
  list.innerHTML = '';

  const layers = slide.layers || [0, 1];
  const hidden = slide.hiddenLayers || [];

  const justSelected = selectedLayer !== _prevActiveLayer;
  _prevActiveLayer = selectedLayer;

  layers.forEach((lvl, i) => {
    const item = document.createElement('div');
    const isActive = parseInt(selectedLayer) === lvl;
    item.className = 'layer-item' + (isActive ? ' active' : '') + (isActive && justSelected ? ' just-selected' : '');
    item.onclick = (e) => {
      if (e.target.closest('.layer-controls')) return;
      selectLayer(lvl);
    };

    const name = lvl === 0 ? 'Background' : `L${i}`;
    const isChecked = !hidden.some(h => parseInt(h) === lvl);
    const isBg = lvl === 0;
    const upDisabled = i <= 1;
    const downDisabled = i === layers.length - 1;
    const timing = (slide.layerTiming && slide.layerTiming[lvl]) || '0-';
    const animObj = (slide.layerAnim && slide.layerAnim[lvl]) || { entry: 'snap', exit: 'snap' };
    const entryAnim = (typeof animObj === 'string') ? animObj : (animObj.entry || 'snap');
    const exitAnim = (typeof animObj === 'string') ? animObj : (animObj.exit || 'snap');
    const animIcons = { snap: '◌', fade: '●', blur: '◉', slideL: '←', slideR: '→', slideU: '↑', slideD: '↓' };
    const animNames = { snap: 'None', fade: 'Fade', blur: 'Blur', slideL: 'Slide ←', slideR: 'Slide →', slideU: 'Slide ↑', slideD: 'Slide ↓' };

    item.innerHTML = `
      <div class="layer-controls">
        <input type="checkbox" class="layer-checkbox" ${isChecked ? 'checked' : ''} onchange="toggleLayerVisibility(${lvl})" title="Toggle Visibility">
        <div class="layer-anim-group" style="display:flex; gap:2px; width:88px; align-items:center">
          ${!isBg ? `
            <button class="layer-anim-toggle" onclick="updateLayerAnim(${lvl}, 'entry')" title="Entry: ${animNames[entryAnim] || 'None'}">${animIcons[entryAnim]}</button>
            <input type="text" class="layer-timing-input" value="${timing}" onchange="updateLayerTiming(${lvl}, this.value)" title="Timestep">
            <button class="layer-anim-toggle" onclick="updateLayerAnim(${lvl}, 'exit')" title="Exit: ${animNames[exitAnim] || 'None'}">${animIcons[exitAnim]}</button>
          ` : ''}
        </div>
      </div>
      <div class="layer-item-divider">|</div>
      <span class="layer-name" style="flex:1">${name}</span>
      <div class="layer-item-actions" style="display:flex; gap:2px;">
        ${!isBg ? `
          <button class="layer-btn" onclick="event.stopPropagation();moveLayer(${lvl}, -1)" ${upDisabled ? 'disabled' : ''} title="Move Up">▲</button>
          <button class="layer-btn" onclick="event.stopPropagation();moveLayer(${lvl}, 1)" ${downDisabled ? 'disabled' : ''} title="Move Down">▼</button>
          <button class="layer-btn" onclick="event.stopPropagation();deleteLayer(${lvl})" title="Delete">🗑️</button>
        ` : ''}
      </div>
    `;
    list.appendChild(item);
  });

  // Update Toggle All checkbox
  const toggleAll = document.getElementById('layerToggleAll');
  if (toggleAll) {
    const total = (slide.layers || [0, 1]).length;
    const hidCount = (slide.hiddenLayers || []).length;
    toggleAll.checked = (hidCount === 0);
    toggleAll.indeterminate = (hidCount > 0 && hidCount < total);
  }
}

function updateLayerAnim(lvl, phase) {
  const slide = slides[currentSlideIdx];
  if (!slide.layerAnim) slide.layerAnim = {};
  if (!slide.layerAnim[lvl]) slide.layerAnim[lvl] = { entry: 'snap', exit: 'snap' };

  // Migration for legacy data
  if (typeof slide.layerAnim[lvl] === 'string') {
    const prev = slide.layerAnim[lvl];
    slide.layerAnim[lvl] = { entry: prev, exit: prev };
  }

  const current = slide.layerAnim[lvl][phase] || 'snap';
  const order = ['snap', 'fade', 'blur', 'slideL', 'slideR', 'slideU', 'slideD'];
  const next = order[(order.indexOf(current) + 1) % order.length];
  slide.layerAnim[lvl][phase] = next;
  renderLayerList();
}

function updateLayerTiming(lvl, val) {
  const slide = slides[currentSlideIdx];
  if (!slide.layerTiming) slide.layerTiming = {};
  slide.layerTiming[lvl] = val;
}


function toggleAllLayers(visible) {
  const slide = slides[currentSlideIdx];
  if (!slide) return;
  saveUndo();
  if (visible) {
    slide.hiddenLayers = [];
    if (selectedLayer === -1 || selectedLayer === null) {
      const layers = slide.layers || [0, 1];
      selectedLayer = Math.max(...layers);
    }
  } else {
    slide.hiddenLayers = [...(slide.layers || [0, 1])];
    selectedLayer = -1; // None selected
  }
  selectedElIdx = -1;
  renderLayerList();
  renderSlide();
}

function selectLayer(lvl) {
  const slide = slides[currentSlideIdx];
  const hidden = slide.hiddenLayers || [];
  if (hidden.some(h => parseInt(h) === lvl)) return;
  selectedElIdx = -1;
  selectedLayer = parseInt(lvl);
  renderLayerList();
  renderSlide();
  refreshBgImageOverlay();
}

async function deleteLayer(lvl) {
  if (lvl === 0) return; // Cannot delete background
  const slide = slides[currentSlideIdx];
  const hasContent = slide.elements.some(el => (el.level !== undefined ? el.level : 1) === lvl);

  if (hasContent) {
    if (!await showConfirm("Delete Layer", `Warning: This layer contains elements. Deleting the layer will also delete all content on it. Proceed?`, "Delete All")) return;
  }

  saveUndo();
  // Remove elements on this layer
  slide.elements = slide.elements.filter(el => (el.level !== undefined ? el.level : 1) !== lvl);
  // Remove from layers list
  slide.layers = slide.layers.filter(l => l !== lvl);
  // Remove from hidden layers
  if (slide.hiddenLayers) slide.hiddenLayers = slide.hiddenLayers.filter(l => l !== lvl);

  renderSlide();
  renderLayerList();
}

function addLayer() {
  saveUndo();
  const slide = slides[currentSlideIdx];
  if (!slide.layers) slide.layers = [0, 1];
  if (slide.layers.length >= 20) {
    showAlert("Layer Limit", "Maximum of 20 layers reached per slide.");
    return;
  }
  const nextLvl = Math.max(...slide.layers) + 1;
  slide.layers.push(nextLvl);
  renderLayerList();
}

function toggleLayerVisibility(lvl) {
  saveUndo();
  const slide = slides[currentSlideIdx];
  if (!slide.hiddenLayers) slide.hiddenLayers = [];
  const lvlNum = parseInt(lvl);
  const layers = slide.layers || [0, 1];

  if (slide.hiddenLayers.some(h => parseInt(h) === lvlNum)) {
    // Unhiding
    slide.hiddenLayers = slide.hiddenLayers.filter(h => parseInt(h) !== lvlNum);
    if (selectedLayer === -1 || selectedLayer === null) {
      selectedLayer = lvlNum;
    }
  } else {
    // Hiding
    slide.hiddenLayers.push(lvlNum);
    if (selectedLayer === lvlNum) {
      // Find next visible
      const idx = layers.indexOf(lvlNum);
      let next = -1;
      // Look Below (reverse order of list)
      for (let i = idx - 1; i >= 0; i--) {
        if (!slide.hiddenLayers.includes(layers[i])) { next = layers[i]; break; }
      }
      // Look from top descending
      if (next === -1) {
        for (let i = layers.length - 1; i > idx; i--) {
          if (!slide.hiddenLayers.includes(layers[i])) { next = layers[i]; break; }
        }
      }
      selectedLayer = next;
    }

    // Deselect if active element is on this layer
    if (selectedElIdx !== -1) {
      const selEl = slide.elements[selectedElIdx];
      const selLvl = selEl.level !== undefined ? parseInt(selEl.level) : 1;
      if (selLvl === lvlNum) {
        selectedElIdx = -1;
      }
    }
  }
  renderSlide();
  renderLayerList();
}

function moveLayer(lvl, dir) {
  if (lvl === 0) return; // Background locked
  saveUndo();
  const slide = slides[currentSlideIdx];
  const layers = slide.layers;
  const idx = layers.indexOf(lvl);
  const nextIdx = idx + dir;
  if (nextIdx < 1 || nextIdx >= layers.length) return;

  [layers[idx], layers[nextIdx]] = [layers[nextIdx], layers[idx]];
  renderSlide();
  renderLayerList();
}

function bringToFront(i) {
  saveUndo();
  const els = slides[currentSlideIdx].elements;
  const [el] = els.splice(i, 1);
  els.push(el);
  selectedElIdx = els.length - 1;
  renderSlide();
}
function sendToBack(i) {
  saveUndo();
  const els = slides[currentSlideIdx].elements;
  const [el] = els.splice(i, 1);
  els.unshift(el);
  selectedElIdx = 0;
  renderSlide();
}

function setVideoMode(i, m) { saveUndo(); slides[currentSlideIdx].elements[i].videoMode = m; renderSlide(); }
function setBorderColor(i, c) { const el = slides[currentSlideIdx].elements[i]; el.borderColor = c; if (!el.borderWidth) el.borderWidth = 2; applyBoxStyle(i); }
function setBorderWidth(i, v) { const el = slides[currentSlideIdx].elements[i]; el.borderWidth = parseInt(v); if (!parseInt(v)) el.borderColor = ''; applyBoxStyle(i); }
function setBgColor(i, hex) { const el = slides[currentSlideIdx].elements[i]; el._bgHex = hex; const a = el._bgAlpha || 0.15; if (!el._bgAlpha) el._bgAlpha = 0.15; el.bgColor = hexToRgba(hex, el._bgAlpha); applyBoxStyle(i); }
function setBgAlpha(i, a) { const el = slides[currentSlideIdx].elements[i]; el._bgAlpha = parseFloat(a); const hex = el._bgHex || '#22222e'; el.bgColor = parseFloat(a) === 0 ? '' : hexToRgba(hex, parseFloat(a)); applyBoxStyle(i); }
function toggleCorners(i) {
  const el = slides[currentSlideIdx].elements[i];
  el.sharpCorners = !el.sharpCorners;
  applyBoxStyle(i);
  renderSlide();
}
function applyBoxStyle(i) {
  const el = slides[currentSlideIdx].elements[i];
  const box = document.querySelector(`[data-el-idx="${i}"] .text-element-box, [data-el-idx="${i}"] .image-element, [data-el-idx="${i}"] .jupyter-cell`);
  if (!box) return;
  box.style.boxSizing = 'border-box';
  box.style.border = (el.borderColor && el.borderWidth) ? `${el.borderWidth}px solid ${el.borderColor}` : 'none';
  box.style.background = el.bgColor || 'transparent';

  if (el.sharpCorners) {
    box.style.borderRadius = '0px';
  } else {
    // Falls back to CSS default (var(--radius) or var(--radius-sm))
    box.style.borderRadius = '';
  }

  // Also update selection border if present
  const sel = document.querySelector(`[data-el-idx="${i}"] .sel-border`);
  if (sel) {
    sel.style.borderRadius = el.sharpCorners ? '0px' : '';
  }
}

// ═══════ COLOR PALETTE LOGIC ═══════
let colorPaletteCb = null;
let savedTextSelection = null;

function saveTextSelection() {
  const sel = window.getSelection();
  if (sel.getRangeAt && sel.rangeCount) savedTextSelection = sel.getRangeAt(0);
}
function restoreTextSelection() {
  if (savedTextSelection) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedTextSelection);
  }
}

function addCustomColorToHistory(hex) {
  if (!hex || hex === 'transparent') return;
  hex = hex.toLowerCase();

  // Robust validation
  const hexRegex = /^#([0-9a-f]{3}){1,2}$/i;
  if (!hexRegex.test(hex)) return;

  // Ignore native default swatches
  const defaults = ['#7c6cf0', '#9d8fff', '#1e3a8a', '#4ade80', '#15803d', '#f87171', '#b91c1c', '#fb923c', '#facc15', '#a16207', '#22d3ee', '#0f766e', '#c026d3', '#e8e6f0', '#16161d'];
  if (defaults.includes(hex)) return;

  if (!customColorHistory.includes(hex)) {
    customColorHistory.unshift(hex);
    if (customColorHistory.length > 10) customColorHistory.pop();
    renderCustomHistorySwatches();
  }
}

function renderCustomHistorySwatches() {
  const container = document.getElementById('customSwatches');
  if (!container) return;
  if (customColorHistory.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(5, 1fr)';
  container.style.gap = '6px';
  container.innerHTML = '';
  customColorHistory.forEach(hex => {
    const d = document.createElement('div');
    d.className = 'cp-swatch';
    d.style.background = hex;
    d.onmousedown = (e) => e.preventDefault(); // Stop focus steal
    d.onclick = () => applyPaletteColor(hex);
    container.appendChild(d);
  });
}

function openColorPalette(btn, initialHex, callback) {
  saveTextSelection(); // Preserve active text editor boundaries
  // Convert just in case an rgb() format sneaks in
  if (initialHex && initialHex.startsWith('rgb')) initialHex = rgbaToHex(initialHex);

  const p = document.getElementById('globalPalette');
  const rect = btn.getBoundingClientRect();
  p.style.top = (rect.bottom + 8) + 'px';
  p.style.left = rect.left + 'px';

  if (parseInt(p.style.top) > window.innerHeight - 200) {
    p.style.top = (rect.top - 160) + 'px';
  }

  document.getElementById('paletteHexInput').value = initialHex || '#000000';
  document.getElementById('paletteNativeInput').value = (initialHex === 'transparent' ? '#000000' : initialHex);
  colorPaletteCb = callback;
  p.classList.add('show');

  setTimeout(() => document.addEventListener('click', closePaletteIfOutside), 10);
}

function closePaletteIfOutside(e) {
  const p = document.getElementById('globalPalette');
  if (!p.contains(e.target) && !e.target.closest('.palette-trigger-btn')) {
    closeColorPalette();
  }
}

function closeColorPalette() {
  const p = document.getElementById('globalPalette');
  if (p) p.classList.remove('show');
  document.removeEventListener('click', closePaletteIfOutside);
}

function applyPaletteHex() {
  let v = document.getElementById('paletteHexInput').value.trim();
  if (v === 'transparent') {
    if (colorPaletteCb) colorPaletteCb('transparent');
    closeColorPalette();
    return;
  }

  // Cleanup
  let hex = v.replace(/^#+/, '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  hex = '#' + hex;

  const hexRegex = /^#([0-9a-f]{6})$/i;
  if (!hexRegex.test(hex)) {
    toast('Invalid Hex Format');
    return;
  }

  // Set native picker
  document.getElementById('paletteNativeInput').value = hex;

  addCustomColorToHistory(hex);
  restoreTextSelection();
  if (colorPaletteCb) colorPaletteCb(hex);
  closeColorPalette();
}

function applyPaletteColor(hex) {
  // Convert OS-level rgb hooks to hex just in case
  if (hex && hex.startsWith('rgb')) hex = rgbaToHex(hex);
  document.getElementById('paletteHexInput').value = hex;

  addCustomColorToHistory(hex);
  restoreTextSelection();
  if (colorPaletteCb) colorPaletteCb(hex);
  closeColorPalette();
}

// ═══════ CONTEXT MENU ═══════
function showCtxMenu(e, i) { ctxSlideIdx = i; const m = document.getElementById('ctxMenu'); m.style.top = e.clientY + 'px'; m.style.left = e.clientX + 'px'; m.classList.add('show'); setTimeout(() => document.addEventListener('click', hideCtx, { once: true }), 10); }
function hideCtx() { document.getElementById('ctxMenu').classList.remove('show'); }
function ctxAction(a) { hideCtx(); if (a === 'duplicate') duplicateSlide(ctxSlideIdx); else if (a === 'hide') toggleHidden(ctxSlideIdx); else if (a === 'delete') deleteSlide(ctxSlideIdx); else if (a === 'moveUp') moveSlide(ctxSlideIdx, -1); else if (a === 'moveDown') moveSlide(ctxSlideIdx, 1); }
function changeBg(v) {
  if (v === 'custom') { openBgCustomModal(); return; }
  saveUndo();
  slides[currentSlideIdx].bg = v;
  renderSlide();
}

// ═══════ SHARE ═══════
function openShareModal() { const id = btoa(JSON.stringify({ t: document.getElementById('presTitle').value, ts: Date.now() })).slice(0, 16); document.getElementById('shareLink').value = `https://slidepy.app/collab/${id}?mode=view`; document.getElementById('shareModal').classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function copyShareLink() { const i = document.getElementById('shareLink'); i.select(); navigator.clipboard.writeText(i.value).then(() => toast('Link copied!')); }

// ═══════ PRESENT ═══════
let presentIdx = 0;
function scalePresentationSlide() {
  const canvas = document.getElementById('slideCanvas');
  if (!canvas || !document.body.classList.contains('presenting')) return;
  const scaleX = window.innerWidth / 960;
  const scaleY = window.innerHeight / 540;
  const scale = Math.min(scaleX, scaleY);

  canvas.style.transformOrigin = 'center center';
  canvas.style.transform = `scale(${scale})`;

  // Counter-scale each CodeMirror wrapper so CM operates at 1:1 pixel ratio.
  // This fixes cursors, selections, AND scrolling all at once.
  // Enlarge dimensions + font-size by S so the visual result matches the slide.
  setTimeout(() => {
    Object.values(codeMirrors).forEach(cm => {
      const wrapper = cm.getWrapperElement();
      const parent = wrapper.parentElement; // .cell-code-editor
      const pw = parent.offsetWidth;
      const ph = parent.offsetHeight;

      wrapper.style.transform = `scale(${1 / scale})`;
      wrapper.style.transformOrigin = '0 0';
      wrapper.style.fontSize = (11 * scale) + 'px';

      // Enlarge CM so visually it fills the same space after counter-scale
      cm.setSize(pw * scale, ph * scale);
      cm.scrollTo(0, 0);
      cm.refresh();

      // Second refresh after reflow to ensure scrollbar recalculation
      setTimeout(() => cm.refresh(), 150);
    });
  }, 100);
}
window.addEventListener('resize', scalePresentationSlide);

function startPresentation() {
  persistAll();
  presentIdx = currentSlideIdx;
  presentStep = 0;
  while (presentIdx < slides.length && slides[presentIdx].hidden) presentIdx++;
  if (presentIdx >= slides.length) { toast('No visible slides!'); return; }
  document.body.classList.add('presenting');
  currentSlideIdx = presentIdx;
  selectedElIdx = -1;
  renderSlide();
  scalePresentationSlide();
  updatePC();
  document.addEventListener('keydown', pkh);
  document.addEventListener('contextmenu', blockContextMenu);
  document.addEventListener('click', handlePresentClick);

  const trigger = document.getElementById('presentTrigger');
  if (trigger) trigger.addEventListener('click', togglePresentNav);
}

function handlePresentClick(e) {
  const controls = document.getElementById('presentControls');
  const nav = document.getElementById('presentNav');
  const trigger = document.getElementById('presentTrigger');
  if (controls && controls.classList.contains('show')) {
    // If click is outside BOTH nav and trigger, hide it
    if (!nav.contains(e.target) && !trigger.contains(e.target)) {
      hidePresentNav();
    }
  }
}

function togglePresentNav(e) {
  if (e) e.stopPropagation();
  const controls = document.getElementById('presentControls');
  if (controls) controls.classList.toggle('show');
}

function hidePresentNav() {
  const controls = document.getElementById('presentControls');
  if (controls) controls.classList.remove('show');
}

function blockContextMenu(e) { e.preventDefault(); }

function getMaxSteps(slide) {
  let max = 0;
  if (!slide.layerTiming) return 0;
  for (const lvl in slide.layerTiming) {
    const range = parseTiming(slide.layerTiming[lvl]);
    if (range.start !== Infinity) max = Math.max(max, range.start);
    if (range.end !== Infinity) max = Math.max(max, range.end);
  }
  return max;
}

const SLIDE_ANIM_ORDER = ['snap', 'fade', 'blur', 'slideL', 'slideR', 'slideU', 'slideD'];

function updateSlideAnim(i) {
  saveUndo();
  const s = slides[i];
  const cur = s.anim || 'snap';
  s.anim = SLIDE_ANIM_ORDER[(SLIDE_ANIM_ORDER.indexOf(cur) + 1) % SLIDE_ANIM_ORDER.length];
  renderSidebar();
}

function applySlideTransition(anim) {
  if (!anim || anim === 'snap') return;
  const canvas = document.getElementById('slideCanvas');
  SLIDE_ANIM_ORDER.filter(a => a !== 'snap').forEach(a => canvas.classList.remove('st-' + a));
  void canvas.offsetWidth; // force reflow so animation restarts
  canvas.classList.add('st-' + anim);
  canvas.addEventListener('animationend', () => {
    SLIDE_ANIM_ORDER.filter(a => a !== 'snap').forEach(a => canvas.classList.remove('st-' + a));
  }, { once: true });
}

function presentNext() {
  const slide = slides[presentIdx];
  const max = getMaxSteps(slide);
  if (presentStep < max) {
    presentStep++;
    renderSlide();
    return;
  }

  let n = presentIdx + 1;
  while (n < slides.length && slides[n].hidden) n++;
  if (n >= slides.length) return;
  applySlideTransition(slides[n].anim || 'snap');
  presentIdx = n;
  currentSlideIdx = presentIdx;
  presentStep = 0;
  renderSlide();
  scalePresentationSlide();
}

function presentPrev() {
  if (presentStep > 0) {
    presentStep--;
    renderSlide();
    return;
  }

  let p = presentIdx - 1;
  while (p >= 0 && slides[p].hidden) p--;
  if (p < 0) return;
  applySlideTransition(slides[p].anim || 'snap');
  presentIdx = p;
  currentSlideIdx = presentIdx;
  presentStep = getMaxSteps(slides[presentIdx]);
  renderSlide();
  scalePresentationSlide();
}

function pkh(e) {
  const cmFocused = document.activeElement &&
    (document.activeElement.closest('.cm-editor') || document.activeElement.closest('.CodeMirror'));
  if (cmFocused && e.key !== 'Escape') return;
  if (e.key === 'ArrowRight' || e.key === ' ') presentNext();
  else if (e.key === 'ArrowLeft') presentPrev();
  else if (e.key === 'Escape') stopPresentation();
}

function stopPresentation() {
  document.body.classList.remove('presenting');
  document.removeEventListener('keydown', pkh);
  document.removeEventListener('contextmenu', blockContextMenu);
  document.removeEventListener('click', handlePresentClick);
  const trigger = document.getElementById('presentTrigger');
  if (trigger) trigger.removeEventListener('click', togglePresentNav);
  hidePresentNav();

  // Restore editor view zoom
  const canvas = document.getElementById('slideCanvas');
  if (canvas) {
    canvas.style.transform = `scale(${workspaceZoom})`;
    canvas.style.transformOrigin = '';
  }

  updateWorkspaceBounds();
  renderSlide();
  centerSlide();
}

function updatePC() {
  const v = slides.filter(s => !s.hidden);
  const currentSlide = slides[presentIdx];
  const sIdx = v.indexOf(currentSlide) + 1;
  const max = getMaxSteps(currentSlide);
  const stepInfo = max > 0 ? ` [Step ${presentStep}/${max}]` : '';

  const text = `${sIdx} / ${v.length}${stepInfo}`;
  const counterEl = document.getElementById('presentCounter');
  if (counterEl) counterEl.textContent = text;

  const indicatorEl = document.getElementById('presentIndicator');
  if (indicatorEl) indicatorEl.textContent = text;
}

// ═══════ PDF EXPORT ═══════
async function buildPDFBlob(slidesData) {
  const { jsPDF } = window.jspdf;
  const W = 960, H = 540;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H], hotfixes: ['px_scaling'] });
  const canvas = document.getElementById('slideCanvas');

  // Save editor state
  const savedSlideIdx = currentSlideIdx;
  const savedStep = presentStep;
  const savedPresenting = document.body.classList.contains('presenting');
  const savedSelectedEl = selectedElIdx;

  // Enter a clean rendering state without scale transform
  document.body.classList.add('presenting', 'pdf-exporting');
  canvas.style.transform = 'none';
  canvas.style.transformOrigin = 'top left';
  selectedElIdx = -1;

  let firstPage = true;

  for (let sIdx = 0; sIdx < slidesData.length; sIdx++) {
    const slide = slidesData[sIdx];
    if (slide.hidden) continue;

    currentSlideIdx = sIdx;
    const maxSteps = getMaxSteps(slide);

    // Detect split code cells (jupyter-input elements)
    const hasSplitCell = slide.elements && slide.elements.some(e => e.type === 'jupyter-input');

    for (let step = 0; step <= maxSteps; step++) {
      presentStep = step;
      renderSlide();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const imgCanvas = await html2canvas(canvas, {
        scale: 1, useCORS: true, allowTaint: true,
        width: W, height: H, x: 0, y: 0,
        backgroundColor: null, logging: false
      });

      if (!firstPage) pdf.addPage([W, H], 'landscape');
      pdf.addImage(imgCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
      firstPage = false;

      // For the last step of a slide with split cells: add input-only and output-visible pages
      if (step === maxSteps && hasSplitCell) {
        // Page: input in foreground (output z behind — already the default render)
        // Page: output brought to foreground
        const outputEls = canvas.querySelectorAll('[data-el-idx]');
        const inputIdxSet = new Set();
        const outputIdxSet = new Set();
        slide.elements.forEach((el, i) => {
          if (el.type === 'jupyter-input') inputIdxSet.add(i);
          if (el.type === 'jupyter-output') outputIdxSet.add(i);
        });

        // Temporarily boost output z-index above input
        outputIdxSet.forEach(i => {
          const el = canvas.querySelector(`[data-el-idx="${i}"]`);
          if (el) { el.dataset._savedZ = el.style.zIndex; el.style.zIndex = '9999'; el.style.visibility = 'visible'; }
        });
        inputIdxSet.forEach(i => {
          const el = canvas.querySelector(`[data-el-idx="${i}"]`);
          if (el) { el.dataset._savedZ2 = el.style.zIndex; el.style.zIndex = '50'; }
        });

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const imgOutput = await html2canvas(canvas, {
          scale: 1, useCORS: true, allowTaint: true,
          width: W, height: H, backgroundColor: null, logging: false
        });
        pdf.addPage([W, H], 'landscape');
        pdf.addImage(imgOutput.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);

        // Restore z-indices
        outputIdxSet.forEach(i => {
          const el = canvas.querySelector(`[data-el-idx="${i}"]`);
          if (el) el.style.zIndex = el.dataset._savedZ || '';
        });
        inputIdxSet.forEach(i => {
          const el = canvas.querySelector(`[data-el-idx="${i}"]`);
          if (el) el.style.zIndex = el.dataset._savedZ2 || '';
        });
      }
    }
  }

  // Restore state
  document.body.classList.remove('pdf-exporting');
  if (!savedPresenting) document.body.classList.remove('presenting');
  canvas.style.transform = '';
  canvas.style.transformOrigin = '';
  currentSlideIdx = savedSlideIdx;
  presentStep = savedStep;
  selectedElIdx = savedSelectedEl;
  renderSlide();
  if (savedPresenting) scalePresentationSlide();

  return pdf.output('blob');
}

async function exportPDF() {
  persistAll();
  const btn = document.getElementById('exportPdfBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Rendering…'; }
  try {
    const blob = await buildPDFBlob(slides);
    const name = (document.getElementById('presTitle').value || 'Untitled').replace(/\s+/g, '_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.pdf';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('PDF exported!');
  } catch(e) {
    console.error('PDF export failed:', e);
    toast('PDF export failed — see console.');
  }
  if (btn) { btn.disabled = false; btn.textContent = '🖨 PDF'; }
}

// ═══════ SAVE/LOAD ═══════
async function exportJSON() {
  persistAll();
  const zip = new JSZip();
  const name = document.getElementById('presTitle').value || 'Untitled';

  const metadata = {
    title: name,
    slides,
    packages: activePackageConfig ? activePackageConfig.packages : DEFAULT_PACKAGES,
    uploadedFiles: {},
    customColorHistory: customColorHistory
  };

  const assetsFolder = zip.folder("assets");

  for (const fileName in uploadedFiles) {
    const f = uploadedFiles[fileName];
    metadata.uploadedFiles[fileName] = { name: f.name, type: f.type };
    if (f.data && f.data.startsWith('data:')) {
      const parts = f.data.split(',');
      const b64 = parts[1];
      assetsFolder.file(fileName, b64, { base64: true });
    }
  }

  zip.file("slides.json", JSON.stringify(metadata, null, 2));

  try {
    const pdfBlob = await buildPDFBlob(slides);
    zip.file(name.replace(/\s+/g, '_') + '.pdf', pdfBlob);
  } catch(e) { console.warn('PDF generation failed:', e); }

  const blob = await zip.generateAsync({ type: "blob" });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = name.replace(/\s+/g, '_') + '.pyslide.zip';
  a.click();
  URL.revokeObjectURL(u);
  toast('Exported as ZIP!');
}
function triggerLoad() { document.getElementById('loadInput').click(); }
async function importJSON(e) {
  const f = e.target.files[0]; if (!f) return;
  const fName = f.name.toLowerCase();

  try {
    let d;
    if (fName.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(f);
      const slidesData = await zip.file("slides.json").async("string");
      d = JSON.parse(slidesData);

      const files = d.uploadedFiles || {};
      for (const name in files) {
        const assetFile = zip.file(`assets/${name}`);
        if (assetFile) {
          const b64 = await assetFile.async("base64");
          // Re-encode to DataURL
          const ext = name.split('.').pop().toLowerCase();
          let mime = 'image/png';
          if (ext === 'mp4' || ext === 'webm') mime = `video/${ext}`;
          else if (ext === 'html') mime = 'text/html';
          else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';

          files[name].data = `data:${mime};base64,${b64}`;
          if (mime === 'text/html') files[name].data = ensureUtf8(files[name].data);
        }
      }
      uploadedFiles = files;
    } else {
      const text = await f.text();
      d = JSON.parse(text);
      uploadedFiles = d.uploadedFiles || d.uploadedPyFiles || {};
    }

    slides = d.slides || [];
    customColorHistory = d.customColorHistory || [];
    document.getElementById('presTitle').value = d.title || 'Untitled';
    if (d.packages) activePackageConfig = { packages: d.packages };
    currentSlideIdx = 0; selectedElIdx = -1;
    activePresentationId = crypto.randomUUID();
    saveCurrentPresentation();
    renderSidebar(); renderSlide(); renderUploadedFiles();
    renderCustomHistorySwatches();
    toast('Loaded!');
  } catch (err) {
    console.error(err);
    toast('Failed to load: ' + err.message);
  }
  e.target.value = '';
}
function centerSlide() {
  updateWorkspaceBounds();
  const wrapper = document.getElementById('canvasWrapper');
  const workspace = document.getElementById('workspace');
  if (!wrapper || !workspace) return;

  // Ensure we get absolute pixel values
  const rect = workspace.getBoundingClientRect();
  const wW = rect.width;
  const wH = rect.height;
  const cW = wrapper.clientWidth;
  const cH = wrapper.clientHeight;

  wrapper.scrollLeft = (wW - cW) / 2;
  wrapper.scrollTop = (wH - cH) / 2;
}

function setZoom(level) {
  if (document.body.classList.contains('presenting')) return;
  workspaceZoom = Math.max(0.5, Math.min(2.0, level));
  const canvas = document.getElementById('slideCanvas');
  if (canvas) {
    canvas.style.transform = `scale(${workspaceZoom})`;
  }
  const display = document.getElementById('zoomPercent');
  if (display) {
    const txt = Math.round(workspaceZoom * 100) + '%';
    if (display.tagName === 'INPUT') display.value = txt;
    else display.textContent = txt;
  }
  updateWorkspaceBounds();
}

function handleZoomInput(val) {
  let num = parseFloat(val.replace('%', ''));
  if (isNaN(num)) {
    setZoom(workspaceZoom); // reset
    return;
  }
  setZoom(num / 100);
}

function zoomIn() { setZoom(workspaceZoom + 0.1); }
function zoomOut() { setZoom(workspaceZoom - 0.1); }
function resetZoom() { setZoom(1.0); centerSlide(); }

// Initialization for zoom listeners
document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('canvasWrapper');
  if (wrapper) {
    wrapper.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        if (document.body.classList.contains('presenting')) return;
        e.preventDefault();
        // Reduced sensitivity by scaling the delta
        const delta = -e.deltaY * 0.001;
        setZoom(workspaceZoom + delta);
        updateWorkspaceBounds();
      }
    }, { passive: false });
  }
});

function updateWorkspaceBounds() {
  const slide = (slides && slides[currentSlideIdx]) ? slides[currentSlideIdx] : null;
  if (!slide || document.body.classList.contains('presenting')) return;

  // Slide standard bounds
  let minX = 0, maxX = 960, minY = 0, maxY = 540;

  // Account for all elements
  if (slide.elements) {
    slide.elements.forEach(el => {
      minX = Math.min(minX, el.x || 0);
      maxX = Math.max(maxX, (el.x || 0) + (el.w || 0));
      minY = Math.min(minY, el.y || 0);
      maxY = Math.max(maxY, (el.y || 0) + (el.h || 0));
    });
  }

  const ws = document.getElementById('workspace');
  if (ws) {
    // Safety buffer - reduced for a tighter, more professional feel
    const margin = 40;

    // Scale the layout container size along with the zoom
    // This prevents runaway scrollbars when zooming out
    const contentW = ((maxX - minX) + margin * 2) * workspaceZoom;
    const contentH = ((maxY - minY) + margin * 2) * workspaceZoom;

    ws.style.minWidth = contentW + 'px';
    ws.style.minHeight = contentH + 'px';
  }
}

// Ensure centering on resize
window.addEventListener('resize', centerSlide);

// ═══════ BACKGROUND HELPERS ═══════
function bgIsLight(bg) {
  if (!bg) return false;
  if (/^#[0-9a-fA-F]{6}$/.test(bg)) return isLightColor(bg);
  const hexes = [...bg.matchAll(/#[0-9a-fA-F]{6}/g)].map(m => m[0]);
  return hexes.length > 0 && hexes.every(h => isLightColor(h));
}

// ═══════ BG IMAGE OVERLAY ═══════
function renderBgImageOverlay(canvas, slide) {
  // Clip wrapper matches slide bounds; overflow toggled by refreshBgImageOverlay
  const clip = document.createElement('div');
  clip.id = 'bgImgClip';
  clip.style.cssText = 'position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;';

  const ov = document.createElement('div');
  ov.id = 'bgImgOverlay';
  ov.className = 'bg-img-overlay';
  ov.style.left   = (slide.bgImageX ?? 0) + 'px';
  ov.style.top    = (slide.bgImageY ?? 0) + 'px';
  ov.style.width  = (slide.bgImageW || 960) + 'px';
  ov.style.height = (slide.bgImageH || 540) + 'px';

  const img = document.createElement('img');
  img.src = slide.bgImage; img.draggable = false;
  ov.appendChild(img);

  // Always create handles; visibility/pointer-events controlled by refreshBgImageOverlay
  for (const dir of ['nw', 'ne', 'sw', 'se']) {
    const h = document.createElement('div');
    h.className = `bg-img-handle ${dir}`;
    h.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); _startBgResize(e, dir, slide); });
    ov.appendChild(h);
  }
  ov.addEventListener('mousedown', e => {
    if (e.target.classList.contains('bg-img-handle')) return;
    e.stopPropagation(); _startBgDrag(e, slide);
  });

  clip.appendChild(ov);
  canvas.insertBefore(clip, canvas.firstChild);
}

function refreshBgImageOverlay() {
  const clip = document.getElementById('bgImgClip'); if (!clip) return;
  const isEditing = !document.body.classList.contains('presenting') && parseInt(selectedLayer) === 0;
  clip.style.overflow      = isEditing ? 'visible' : 'hidden';
  clip.style.pointerEvents = isEditing ? 'auto'    : 'none';
  const ov = document.getElementById('bgImgOverlay');
  if (ov) ov.style.cursor = isEditing ? 'move' : 'default';
  clip.querySelectorAll('.bg-img-handle').forEach(h => h.style.display = isEditing ? '' : 'none');
}

function _startBgDrag(e, slide) {
  if (parseInt(selectedLayer) !== 0) return;
  saveUndo();
  const ov = document.getElementById('bgImgOverlay'); if (!ov) return;
  const sx = e.clientX, sy = e.clientY;
  const ox = slide.bgImageX ?? 0, oy = slide.bgImageY ?? 0;
  ov.style.cursor = 'grabbing';
  const onMove = ev => {
    const z = workspaceZoom || 1;
    slide.bgImageX = ox + (ev.clientX - sx) / z;
    slide.bgImageY = oy + (ev.clientY - sy) / z;
    ov.style.left = slide.bgImageX + 'px';
    ov.style.top  = slide.bgImageY + 'px';
  };
  const onUp = () => { ov.style.cursor = 'move'; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _startBgResize(e, dir, slide) {
  if (parseInt(selectedLayer) !== 0) return;
  saveUndo();
  const ov = document.getElementById('bgImgOverlay'); if (!ov) return;
  const sx = e.clientX, sy = e.clientY;
  const ox = slide.bgImageX ?? 0, oy = slide.bgImageY ?? 0;
  const ow = slide.bgImageW || 960, oh = slide.bgImageH || 540;
  const onMove = ev => {
    const z = workspaceZoom || 1;
    const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
    if (dir.includes('e')) slide.bgImageW = Math.max(80, ow + dx);
    if (dir.includes('s')) slide.bgImageH = Math.max(60, oh + dy);
    if (dir.includes('w')) { slide.bgImageX = ox + dx; slide.bgImageW = Math.max(80, ow - dx); }
    if (dir.includes('n')) { slide.bgImageY = oy + dy; slide.bgImageH = Math.max(60, oh - dy); }
    ov.style.left = slide.bgImageX + 'px'; ov.style.top  = slide.bgImageY + 'px';
    ov.style.width = slide.bgImageW + 'px'; ov.style.height = slide.bgImageH + 'px';
  };
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ═══════ CUSTOM BG MODAL ═══════
let _bgPickerH = 0, _bgPickerS = 0, _bgPickerV = 1, _bgPickerReady = false;
let _bgTempImg = null, _bgTempImgX = 0, _bgTempImgY = 0, _bgTempImgW = 960, _bgTempImgH = 540;

function _hsvToHex(h, s, v) {
  const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  let r,g,b;
  if(h<60){r=c;g=x;b=0;}else if(h<120){r=x;g=c;b=0;}else if(h<180){r=0;g=c;b=x;}
  else if(h<240){r=0;g=x;b=c;}else if(h<300){r=x;g=0;b=c;}else{r=c;g=0;b=x;}
  const t=n=>Math.round((n+m)*255).toString(16).padStart(2,'0');
  return '#'+t(r)+t(g)+t(b);
}
function _hexToHsv(hex) {
  if(!hex||hex.length<7)return[0,0,1];
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  const v=max,s=max?d/max:0;
  let h=0;
  if(d){if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}
  return[h<0?h+360:h,s,v];
}
function _drawBgSv() {
  const c=document.getElementById('bgSvCanvas');if(!c)return;
  const ctx=c.getContext('2d'),w=c.width,h=c.height;
  const gH=ctx.createLinearGradient(0,0,w,0);
  gH.addColorStop(0,'#fff');gH.addColorStop(1,`hsl(${_bgPickerH},100%,50%)`);
  ctx.fillStyle=gH;ctx.fillRect(0,0,w,h);
  const gV=ctx.createLinearGradient(0,0,0,h);
  gV.addColorStop(0,'rgba(0,0,0,0)');gV.addColorStop(1,'#000');
  ctx.fillStyle=gV;ctx.fillRect(0,0,w,h);
  const cx=_bgPickerS*w,cy=(1-_bgPickerV)*h;
  ctx.beginPath();ctx.arc(cx,cy,7,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,7,0,Math.PI*2);ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;ctx.stroke();
}
function _drawBgHue() {
  const c=document.getElementById('bgHueCanvas');if(!c)return;
  const ctx=c.getContext('2d'),w=c.width,h=c.height;
  const g=ctx.createLinearGradient(0,0,w,0);
  for(let i=0;i<=6;i++)g.addColorStop(i/6,`hsl(${i*60},100%,50%)`);
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  const cx=(_bgPickerH/360)*w;
  ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fillRect(cx-2,0,4,h);
  ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=1;ctx.strokeRect(cx-2,0,4,h);
}
function _syncBgSwatch() {
  const hex=_hsvToHex(_bgPickerH,_bgPickerS,_bgPickerV);
  const sw=document.getElementById('bgColorSwatch'),inp=document.getElementById('bgHexInput');
  if(sw)sw.style.background=hex;
  if(inp&&document.activeElement!==inp)inp.value=hex;
}

// Outer box represents ±MARGIN slide-units beyond the slide in every direction.
// The inner rectangle (the actual slide) is centred inside it.
const _BG_MARGIN = 180; // slide-units of extra space around the slide in the preview

// Builds the interactive mini-slide preview with draggable/resizable image
function _syncBgImgBox() {
  const box=document.getElementById('bgImgPreviewBox');if(!box)return;
  const bgHex=_hsvToHex(_bgPickerH,_bgPickerS,_bgPickerV);

  const outerWSU = 960 + 2*_BG_MARGIN;
  const outerHSU = 540 + 2*_BG_MARGIN;
  const outerW   = box.offsetWidth || 300;
  const scale    = outerW / outerWSU;
  const outerH   = outerHSU * scale;

  box.style.cssText = `position:relative;width:100%;height:${outerH}px;overflow:hidden;background:#0e0e12;border:1.5px dashed rgba(124,108,240,0.35);border-radius:6px;box-sizing:border-box;`;
  box.innerHTML = '';

  // Inner slide rectangle (represents the actual slide bounds)
  const inner = document.createElement('div');
  inner.style.cssText = `position:absolute;left:${_BG_MARGIN*scale}px;top:${_BG_MARGIN*scale}px;width:${960*scale}px;height:${540*scale}px;background:${bgHex};border:1.5px solid rgba(124,108,240,0.55);box-sizing:border-box;pointer-events:none;z-index:0;`;
  box.appendChild(inner);

  if(!_bgTempImg){
    const lbl=document.createElement('span');
    lbl.textContent='No image';
    lbl.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:1;color:rgba(255,255,255,0.28);font-size:0.8em;';
    box.appendChild(lbl);
    return;
  }

  const miniOv=document.createElement('div');
  miniOv.id='bgMiniOverlay';
  miniOv.style.cssText=`position:absolute;left:${(_bgTempImgX+_BG_MARGIN)*scale}px;top:${(_bgTempImgY+_BG_MARGIN)*scale}px;width:${_bgTempImgW*scale}px;height:${_bgTempImgH*scale}px;cursor:move;z-index:2;box-sizing:border-box;`;

  const img=document.createElement('img');
  img.src=_bgTempImg;img.draggable=false;
  img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;user-select:none;';
  miniOv.appendChild(img);

  const hPos={nw:'top:-5px;left:-5px;cursor:nw-resize',ne:'top:-5px;right:-5px;cursor:ne-resize',sw:'bottom:-5px;left:-5px;cursor:sw-resize',se:'bottom:-5px;right:-5px;cursor:se-resize'};
  for(const dir of['nw','ne','sw','se']){
    const h=document.createElement('div');
    h.style.cssText=`position:absolute;width:10px;height:10px;background:#fff;border:2px solid #7c6cf0;border-radius:2px;z-index:3;${hPos[dir]}`;
    h.addEventListener('mousedown',e=>{e.stopPropagation();e.preventDefault();_startMiniResize(e,dir,scale);});
    miniOv.appendChild(h);
  }
  miniOv.addEventListener('mousedown',e=>{if(e.target!==miniOv&&e.target!==img)return;_startMiniDrag(e,scale);});

  box.appendChild(miniOv);
}

function _startMiniDrag(e,scale) {
  e.stopPropagation();
  const miniOv=document.getElementById('bgMiniOverlay');if(!miniOv)return;
  const sx=e.clientX,sy=e.clientY,ox=_bgTempImgX,oy=_bgTempImgY;
  miniOv.style.cursor='grabbing';
  const onMove=ev=>{
    _bgTempImgX=ox+(ev.clientX-sx)/scale;
    _bgTempImgY=oy+(ev.clientY-sy)/scale;
    miniOv.style.left=(_bgTempImgX+_BG_MARGIN)*scale+'px';
    miniOv.style.top =(_bgTempImgY+_BG_MARGIN)*scale+'px';
  };
  const onUp=()=>{miniOv.style.cursor='move';document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);};
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}
function _startMiniResize(e,dir,scale) {
  e.stopPropagation();
  const miniOv=document.getElementById('bgMiniOverlay');if(!miniOv)return;
  const sx=e.clientX,sy=e.clientY,ox=_bgTempImgX,oy=_bgTempImgY,ow=_bgTempImgW,oh=_bgTempImgH;
  const onMove=ev=>{
    const dx=(ev.clientX-sx)/scale,dy=(ev.clientY-sy)/scale;
    if(dir.includes('e'))_bgTempImgW=Math.max(80,ow+dx);
    if(dir.includes('s'))_bgTempImgH=Math.max(60,oh+dy);
    if(dir.includes('w')){_bgTempImgX=ox+dx;_bgTempImgW=Math.max(80,ow-dx);}
    if(dir.includes('n')){_bgTempImgY=oy+dy;_bgTempImgH=Math.max(60,oh-dy);}
    miniOv.style.left  =(_bgTempImgX+_BG_MARGIN)*scale+'px';
    miniOv.style.top   =(_bgTempImgY+_BG_MARGIN)*scale+'px';
    miniOv.style.width =_bgTempImgW*scale+'px';
    miniOv.style.height=_bgTempImgH*scale+'px';
  };
  const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);};
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}

function openBgCustomModal() {
  const slide=slides[currentSlideIdx];
  [_bgPickerH,_bgPickerS,_bgPickerV]=_hexToHsv(slide.bgCustomColor||'#ffffff');
  _bgTempImg=slide.bgImage||null;
  _bgTempImgX=slide.bgImageX??0; _bgTempImgY=slide.bgImageY??0;
  _bgTempImgW=slide.bgImageW||960; _bgTempImgH=slide.bgImageH||540;
  document.getElementById('bgCustomModal').classList.add('show');
  requestAnimationFrame(()=>{_drawBgSv();_drawBgHue();_syncBgSwatch();_syncBgImgBox();_initBgPicker();});
}
function closeBgCustomModal(){document.getElementById('bgCustomModal').classList.remove('show');}
function applyBgCustom() {
  saveUndo();
  const slide=slides[currentSlideIdx];
  slide.bg='custom';
  slide.bgCustomColor=_hsvToHex(_bgPickerH,_bgPickerS,_bgPickerV);
  slide.bgImage=_bgTempImg;
  if(_bgTempImg){slide.bgImageX=_bgTempImgX;slide.bgImageY=_bgTempImgY;slide.bgImageW=_bgTempImgW;slide.bgImageH=_bgTempImgH;}
  else{delete slide.bgImageX;delete slide.bgImageY;delete slide.bgImageW;delete slide.bgImageH;}
  closeBgCustomModal();renderSlide();
}
function onBgImgUpload(inp) {
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    _bgTempImg=e.target.result;
    // Default: cover the full slide
    _bgTempImgX=0;_bgTempImgY=0;_bgTempImgW=960;_bgTempImgH=540;
    _syncBgImgBox();
  };
  r.readAsDataURL(f);
}
function clearBgImage(){_bgTempImg=null;_syncBgImgBox();const fi=document.getElementById('bgImgFileInput');if(fi)fi.value='';}

function _initBgPicker() {
  if(_bgPickerReady)return;_bgPickerReady=true;
  const svC=document.getElementById('bgSvCanvas'),hC=document.getElementById('bgHueCanvas'),hexI=document.getElementById('bgHexInput');
  let dSv=false,dHue=false;
  const pickSv=e=>{const r=svC.getBoundingClientRect();_bgPickerS=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));_bgPickerV=Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height));_drawBgSv();_syncBgSwatch();};
  const pickHue=e=>{const r=hC.getBoundingClientRect();_bgPickerH=Math.max(0,Math.min(359.9,((e.clientX-r.left)/r.width)*360));_drawBgSv();_drawBgHue();_syncBgSwatch();};
  svC.addEventListener('mousedown',e=>{dSv=true;pickSv(e);});
  hC.addEventListener('mousedown',e=>{dHue=true;pickHue(e);});
  document.addEventListener('mousemove',e=>{if(dSv)pickSv(e);if(dHue)pickHue(e);});
  document.addEventListener('mouseup',()=>{dSv=false;dHue=false;});
  hexI.addEventListener('input',e=>{const v=e.target.value;if(/^#[0-9a-fA-F]{6}$/.test(v)){[_bgPickerH,_bgPickerS,_bgPickerV]=_hexToHsv(v);_drawBgSv();_drawBgHue();const sw=document.getElementById('bgColorSwatch');if(sw)sw.style.background=v;}});
  document.getElementById('bgImgFileInput').addEventListener('change',function(){onBgImgUpload(this);});
}
