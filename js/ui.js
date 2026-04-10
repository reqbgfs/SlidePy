// ═══════ SLIDES ═══════
function addSlide(type) {
  saveUndo();
  const s = { id: genId(), type, elements: [], bg: '#1c1c26', hidden: false };
  if (type === 'title') {
    s.elements = [
      { type: 'title', content: 'Click to add title', x: 40, y: 140, w: 440, h: 90, borderColor: '', bgColor: '', borderWidth: 0, _bgHex: '#22222e', _bgAlpha: 0 },
      { type: 'subtitle', content: 'Click to add subtitle', x: 40, y: 250, w: 440, h: 50, borderColor: '', bgColor: '', borderWidth: 0, _bgHex: '#22222e', _bgAlpha: 0 }
    ];
  } else if (type === 'jupyter') {
    s.elements = [{ type: 'jupyter', code: '# Python here\nprint("Hello!")', output: '', x: 40, y: 40, w: 880, h: 460, borderColor: '', bgColor: '', borderWidth: 0, _bgHex: '#22222e', _bgAlpha: 0 }];
  }
  slides.push(s); currentSlideIdx = slides.length - 1; selectedElIdx = -1;
  renderSidebar(); renderSlide();
}
function selectSlide(i) { persistAll(); currentSlideIdx = i; selectedElIdx = -1; renderSidebar(); renderSlide(); }
function deleteSlide(i) { if (slides.length <= 1) return; saveUndo(); slides.splice(i, 1); if (currentSlideIdx >= slides.length) currentSlideIdx = slides.length - 1; selectedElIdx = -1; renderSidebar(); renderSlide(); }
function duplicateSlide(i) { saveUndo(); const c = JSON.parse(JSON.stringify(slides[i])); c.id = genId(); slides.splice(i + 1, 0, c); currentSlideIdx = i + 1; renderSidebar(); renderSlide(); }
function toggleHidden(i) { saveUndo(); slides[i].hidden = !slides[i].hidden; renderSidebar(); renderSlide(); }
function moveSlide(i, d) { const n = i + d; if (n < 0 || n >= slides.length) return; saveUndo();[slides[i], slides[n]] = [slides[n], slides[i]]; currentSlideIdx = n; renderSidebar(); renderSlide(); }

// ═══════ ELEMENTS ═══════
const elDefaults = { borderColor: '', bgColor: '', borderWidth: 0, _bgHex: '#22222e', _bgAlpha: 0 };
function addElement(type) {
  saveUndo();
  const els = slides[currentSlideIdx].elements;

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

    if (!collides(rightRect.x, rightRect.y, rightRect.w, rightRect.h)) {
      sX = rightRect.x; sY = rightRect.y; sW = rightRect.w; sH = rightRect.h;
    } else if (!collides(leftRect.x, leftRect.y, leftRect.w, leftRect.h)) {
      sX = leftRect.x; sY = leftRect.y; sW = leftRect.w; sH = leftRect.h;
    } else {
      let qH = Math.floor((IH - gap) / 2);
      let tr = { x: margin + hW + 10, y: margin, w: dW, h: qH };
      let br = { x: margin + hW + 10, y: margin + qH + gap, w: dW, h: qH };
      let tl = { x: margin, y: margin, w: dW, h: qH };
      let bl = { x: margin, y: margin + qH + gap, w: dW, h: qH };
      let qs = [tr, br, tl, bl];
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
        for (let c = 3; c >= 0; c--) {
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
    toast("Not enough space to add cell. Please resize existing cells or create a new slide.");
    return;
  }

  if (type === 'title') els.push({ type: 'title', content: 'Title', x: sX, y: sY, w: sW, h: sH, ...elDefaults });
  else if (type === 'subtitle') els.push({ type: 'subtitle', content: 'Subtitle', x: sX, y: sY, w: sW, h: sH, ...elDefaults });
  else if (type === 'body') els.push({ type: 'body', content: 'Body text', x: sX, y: sY, w: sW, h: sH, ...elDefaults });
  else if (type === 'image') els.push({ type: 'image', src: '', x: sX, y: sY, w: sW, h: sH, ...elDefaults });
  else if (type === 'jupyter') els.push({ type: 'jupyter', code: '# Python\n', output: '', x: sX, y: sY, w: sW, h: sH, ...elDefaults });

  selectedElIdx = els.length - 1;
  renderSlide();
}
function removeElement(i) { saveUndo(); slides[currentSlideIdx].elements.splice(i, 1); selectedElIdx = -1; renderSlide(); }
function duplicateElement(i) {
  saveUndo();
  const el = JSON.parse(JSON.stringify(slides[currentSlideIdx].elements[i]));
  el.x = Math.min(el.x + 20, 960 - el.w); el.y = Math.min(el.y + 20, 540 - el.h);
  slides[currentSlideIdx].elements.push(el);
  selectedElIdx = slides[currentSlideIdx].elements.length - 1;
  renderSlide();
}

function onCanvasMouseDown(e) {
  if (e.target.id === 'slideCanvas') { if (selectedElIdx !== -1) { selectedElIdx = -1; renderSlide(); } }
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
    t.innerHTML = `<span class="slide-thumb-num">${i + 1}</span><span class="slide-thumb-preview">${escHtml(preview)}</span><span class="slide-thumb-icons">${hasPy ? '<span class="badge badge-py">PY</span>' : ''}${s.hidden ? '<span class="badge badge-hidden">H</span>' : ''}</span><button class="slide-ctx-menu" onclick="event.stopPropagation();showCtxMenu(event,${i})">⋯</button>`;
    list.appendChild(t);
  });
  document.getElementById('slideCounter').textContent = `Slide ${currentSlideIdx + 1} of ${slides.length}`;
}

function renderSlide() {
  codeMirrors = {};
  const slide = slides[currentSlideIdx];
  const canvas = document.getElementById('slideCanvas');
  canvas.style.background = slide.bg; canvas.innerHTML = '';
  if (slide.hidden && !document.body.classList.contains('presenting')) {
    const b = document.createElement('div');
    b.style.cssText = 'position:absolute;top:12px;right:12px;background:rgba(248,113,113,0.15);color:var(--red);font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;z-index:200;';
    b.textContent = 'HIDDEN SLIDE'; canvas.appendChild(b);
  }
  const isLight = isLightColor(slide.bg);
  slide.elements.forEach((el, idx) => {
    const w = document.createElement('div');
    w.className = 'slide-element-free' + (idx === selectedElIdx ? ' selected' : '');
    w.dataset.elIdx = idx;
    w.dataset.type = el.type;
    w.style.cssText = `left:${el.x || 0}px;top:${el.y || 0}px;width:${el.w || 300}px;height:${el.h || 80}px;z-index:${idx === selectedElIdx ? 50 : idx + 1};`;

    if (idx === selectedElIdx) { const sb = document.createElement('div'); sb.className = 'sel-border'; w.appendChild(sb); }

    w.innerHTML += `<div class="el-actions-free"><button onclick="event.stopPropagation();duplicateElement(${idx})" title="Duplicate" style="background:var(--bg-card)">📋</button><button onclick="event.stopPropagation();removeElement(${idx})" title="Remove">✕</button></div>`;

    // Drag header
    const dh = document.createElement('div'); dh.className = 'drag-header';
    dh.innerHTML = '<span class="dots"></span>';
    dh.addEventListener('mousedown', (e) => { e.preventDefault(); selectEl(idx); startDrag(e, idx); });
    w.appendChild(dh);

    // Resize
    const rh = document.createElement('div'); rh.className = 'resize-handle';
    rh.addEventListener('mousedown', (e) => startResize(e, idx));
    w.appendChild(rh);

    // Resize NW
    if (el.type !== 'jupyter') {
      const rhNW = document.createElement('div'); rhNW.className = 'resize-handle resize-nw';
      rhNW.addEventListener('mousedown', (e) => startResize(e, idx, 'nw'));
      w.appendChild(rhNW);
    } else {
      const rhN = document.createElement('div'); rhN.className = 'resize-handle resize-n';
      rhN.addEventListener('mousedown', (e) => startResize(e, idx, 'nw'));
      w.appendChild(rhN);
    }

    if (el.type === 'title' || el.type === 'subtitle' || el.type === 'body') renderTextEl(w, el, idx, isLight);
    else if (el.type === 'image') renderImageEl(w, el, idx);
    else if (el.type === 'jupyter') renderJupyterEl(w, el, idx);
    canvas.appendChild(w);
  });
}

function renderTextEl(w, el, idx, isLight) {
  const box = document.createElement('div'); box.className = 'text-element-box';
  if (el.borderColor && el.borderWidth) box.style.border = `${el.borderWidth}px solid ${el.borderColor}`;
  if (el.bgColor) box.style.background = el.bgColor;
  box.style.borderRadius = 'var(--radius-sm)';

  const c = document.createElement('div');
  c.className = `text-element-content ${el.type}-el`;
  c.contentEditable = true; c.innerHTML = el.content;
  if (isLight && !el.bgColor) c.style.color = '#1a1a2e';
  c.addEventListener('focus', () => { selectEl(idx); });
  c.addEventListener('input', () => { slides[currentSlideIdx].elements[idx].content = c.innerHTML; renderSidebar(); });
  c.addEventListener('mouseup', () => setTimeout(updateTbState, 10));
  c.addEventListener('keyup', () => setTimeout(updateTbState, 10));
  box.appendChild(c); w.appendChild(box);

  if (idx === selectedElIdx) {
    const tb = mkTextToolbar(idx); w.appendChild(tb);
    const sp = mkStylePanel(idx, el); w.appendChild(sp);
    setTimeout(() => { tb.classList.add('visible'); sp.classList.add('visible'); }, 20);
  }
}

function renderImageEl(w, el, idx) {
  const d = document.createElement('div');
  d.className = 'image-element' + (el.src ? ' has-image' : '');
  if (el.src) d.innerHTML = `<img src="${el.src}">`; else d.innerHTML = '📷 Click to upload';
  d.onclick = () => {
    if (el.src) return; const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = (ev) => { const f = ev.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (re) => { slides[currentSlideIdx].elements[idx].src = re.target.result; renderSlide(); }; r.readAsDataURL(f); };
    inp.click();
  };
  w.appendChild(d);
}

function renderJupyterEl(w, el, idx) {
  const cmId = `cm_${currentSlideIdx}_${idx}`;
  const cell = document.createElement('div'); cell.className = 'jupyter-cell';
  cell.innerHTML = `<div class="cell-code-side"><div class="cell-code-header"><span class="cell-code-label"><span class="py-dot"></span>Python</span><button class="run-btn" id="runBtn_${idx}" onclick="event.stopPropagation();runCell(${idx})">▶ Run</button></div><div class="cell-code-editor" id="editor_${cmId}"></div></div><div class="cell-output-side"><div class="cell-output-header"><span class="cell-output-label">⬡ Output</span><button class="clear-output-btn" onclick="event.stopPropagation();clearOutput(${idx})">✕ Clear</button></div><div class="cell-output-content" id="output_${idx}">${el.output || '<span style="color:var(--text-muted)">Run code to see output...</span>'}</div></div>`;
  w.appendChild(cell);
  requestAnimationFrame(() => {
    const ee = document.getElementById(`editor_${cmId}`); if (!ee) return;
    const cm = CodeMirror(ee, {
      value: el.code || '', mode: 'python', theme: 'dracula', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, lineWrapping: true,
      extraKeys: { 'Shift-Enter': () => runCell(idx), 'Tab': (cm) => cm.replaceSelection('    ') }
    });
    codeMirrors[cmId] = cm; setTimeout(() => cm.refresh(), 50);
  });
}

// ═══════ STYLE PANEL ═══════
function mkStylePanel(idx, el) {
  const p = document.createElement('div'); p.className = 'style-panel'; p.id = `sp_${idx}`;
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
    <div class="tt-sep"></div>
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
    </select>
  `;
  return p;
}
function setBorderColor(i, c) { const el = slides[currentSlideIdx].elements[i]; el.borderColor = c; if (!el.borderWidth) el.borderWidth = 2; applyBoxStyle(i); }
function setBorderWidth(i, v) { const el = slides[currentSlideIdx].elements[i]; el.borderWidth = parseInt(v); if (!parseInt(v)) el.borderColor = ''; applyBoxStyle(i); }
function setBgColor(i, hex) { const el = slides[currentSlideIdx].elements[i]; el._bgHex = hex; const a = el._bgAlpha || 0.15; if (!el._bgAlpha) el._bgAlpha = 0.15; el.bgColor = hexToRgba(hex, el._bgAlpha); applyBoxStyle(i); }
function setBgAlpha(i, a) { const el = slides[currentSlideIdx].elements[i]; el._bgAlpha = parseFloat(a); const hex = el._bgHex || '#22222e'; el.bgColor = parseFloat(a) === 0 ? '' : hexToRgba(hex, parseFloat(a)); applyBoxStyle(i); }
function applyBoxStyle(i) {
  const el = slides[currentSlideIdx].elements[i];
  const box = document.querySelector(`[data-el-idx="${i}"] .text-element-box`);
  if (!box) return;
  box.style.border = (el.borderColor && el.borderWidth) ? `${el.borderWidth}px solid ${el.borderColor}` : 'none';
  box.style.background = el.bgColor || 'transparent';
}

// ═══════ COLOR PALETTE LOGIC ═══════
let colorPaletteCb = null;
let savedTextSelection = null;
let customColorHistory = [];

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

  // Ignore native default swatches
  const defaults = ['#7c6cf0', '#9d8fff', '#1e3a8a', '#4ade80', '#15803d', '#f87171', '#b91c1c', '#fb923c', '#facc15', '#a16207', '#22d3ee', '#0f766e', '#c026d3', '#e8e6f0', '#16161d'];
  if (defaults.includes(hex)) return;

  if (!customColorHistory.includes(hex)) {
    customColorHistory.unshift(hex);
    if (customColorHistory.length > 8) customColorHistory.pop();
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
  container.style.display = 'flex';
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
  let hex = document.getElementById('paletteHexInput').value;
  if (!hex.startsWith('#') && hex !== 'transparent') hex = '#' + hex;
  if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];

  // Set native picker so its advanced UI shows the Hex internally
  if (hex !== 'transparent') document.getElementById('paletteNativeInput').value = hex.slice(0, 7);

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
function changeBg(v) { saveUndo(); slides[currentSlideIdx].bg = v; renderSlide(); }

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
  canvas.style.zoom = scale;
  // Refresh all CodeMirror instances so cursor metrics recalculate after zoom
  setTimeout(() => {
    Object.values(codeMirrors).forEach(cm => cm.refresh());
  }, 50);
}
window.addEventListener('resize', scalePresentationSlide);

function startPresentation() { persistAll(); presentIdx = 0; while (presentIdx < slides.length && slides[presentIdx].hidden) presentIdx++; if (presentIdx >= slides.length) { toast('No visible slides!'); return; } document.body.classList.add('presenting'); document.getElementById('presentNav').style.display = 'flex'; currentSlideIdx = presentIdx; selectedElIdx = -1; renderSlide(); updatePC(); scalePresentationSlide(); document.addEventListener('keydown', pkh); }
function stopPresentation() { const canvas = document.getElementById('slideCanvas'); if (canvas) { canvas.style.zoom = ''; canvas.style.transform = ''; } document.body.classList.remove('presenting'); document.getElementById('presentNav').style.display = 'none'; document.removeEventListener('keydown', pkh); renderSlide(); }
function presentNext() { let n = presentIdx + 1; while (n < slides.length && slides[n].hidden) n++; if (n >= slides.length) return; presentIdx = n; currentSlideIdx = presentIdx; renderSlide(); updatePC(); }
function presentPrev() { let p = presentIdx - 1; while (p >= 0 && slides[p].hidden) p--; if (p < 0) return; presentIdx = p; currentSlideIdx = presentIdx; renderSlide(); updatePC(); }
function pkh(e) { if (e.key === 'ArrowRight' || e.key === ' ') presentNext(); else if (e.key === 'ArrowLeft') presentPrev(); else if (e.key === 'Escape') stopPresentation(); }
function updatePC() { const v = slides.filter(s => !s.hidden); document.getElementById('presentCounter').textContent = `${v.indexOf(slides[presentIdx]) + 1} / ${v.length}`; }

// ═══════ SAVE/LOAD ═══════
function exportJSON() { persistAll(); const d = { title: document.getElementById('presTitle').value, slides, uploadedPyFiles }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = (d.title || 'pres') + '.slidepy.json'; a.click(); URL.revokeObjectURL(u); toast('Saved!'); }
function triggerLoad() { document.getElementById('loadInput').click(); }
function importJSON(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (re) => { try { const d = JSON.parse(re.target.result); slides = d.slides || []; uploadedPyFiles = d.uploadedPyFiles || {}; document.getElementById('presTitle').value = d.title || 'Untitled'; currentSlideIdx = 0; selectedElIdx = -1; renderSidebar(); renderSlide(); renderUploadedFiles(); toast('Loaded!'); } catch (err) { toast('Failed to load'); } }; r.readAsText(f); e.target.value = ''; }
