// ═══════ TEXT TOOLBAR ═══════
function mkTextToolbar(idx) {
  const tb=document.createElement('div'); tb.className='text-toolbar'; tb.id=`ttb_${idx}`;
  tb.innerHTML=`
    <button class="tt-btn" onmousedown="event.preventDefault();xCmd('bold')" title="Bold"><b style="font-size:13px">B</b></button>
    <button class="tt-btn" onmousedown="event.preventDefault();xCmd('italic')" title="Italic"><i style="font-size:12px">I</i></button>
    <button class="tt-btn" onmousedown="event.preventDefault();xCmd('underline')" title="Underline" style="text-decoration:underline">U</button>
    <div class="tt-sep"></div>
    <div style="display:inline-block; position:relative; z-index:1000;">
      <button class="tt-btn font-size-btn" id="fsBtn_${idx}" onmousedown="event.preventDefault(); toggleFontSizeDropdown(${idx})" title="Font size" style="width:50px; font-size:12px; font-family:'DM Sans',sans-serif">${(() => { const el = slides[currentSlideIdx] && slides[currentSlideIdx].elements[idx]; const def = el && el.type === 'title' ? 36 : el && el.type === 'subtitle' ? 20 : 16; return (el && el.fontSize) || def; })()} ▾</button>
      <div class="fs-dropdown" id="fsDropdown_${idx}">
        ${[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64].map(s=> `<div class="fs-opt" onmousedown="event.preventDefault(); applyCustomFontSize('${s}', ${idx})">${s}</div>`).join('')}
        <div class="fs-opt" onmousedown="event.preventDefault(); applyCustomFontSize('custom', ${idx})">Custom...</div>
      </div>
    </div>
    <button class="palette-trigger-btn" style="background:#e8e6f0" data-hex="#e8e6f0" onclick="openColorPalette(this, this.dataset.hex, (hex)=> { this.style.background=hex; this.dataset.hex=hex; xCmd('foreColor', hex); })" title="Text color"></button>
    <div class="tt-sep"></div>
    <button class="tt-btn" onmousedown="event.preventDefault();xCmd('insertUnorderedList')" title="Bullets">• ≡</button>
    <div class="tt-sep"></div>
    <button class="tt-btn tt-al" onmousedown="event.preventDefault();xCmd('justifyLeft')" title="Left">☰⫷</button>
    <button class="tt-btn tt-al" onmousedown="event.preventDefault();xCmd('justifyCenter')" title="Center">☰⫿</button>
    <button class="tt-btn tt-al" onmousedown="event.preventDefault();xCmd('justifyRight')" title="Right">⫸☰</button>
  `;
  
  // Initial detection
  setTimeout(() => {
    updateDynamicTextProperties(idx);
  }, 100);

  return tb;
}

function updateDynamicTextProperties(idx) {
  const s = document.getSelection();
  if (s.rangeCount > 0) {
    let node = s.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    if (node) {
      const fColor = window.getComputedStyle(node).color;
      if (fColor) {
        const tb = document.getElementById(`ttb_${idx}`);
        if (tb) {
          const cBtn = tb.querySelector('.palette-trigger-btn');
          if (cBtn) {
            const hex = rgbaToHex(fColor);
            cBtn.style.background = hex;
            cBtn.dataset.hex = hex;
          }
        }
      }
    }
  }
}

document.addEventListener('selectionchange', () => {
  if (typeof selectedElIdx !== 'undefined' && selectedElIdx !== -1) {
    const s = document.getSelection();
    if (!s.rangeCount) return;
    let node = s.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    if (node && node.closest('.text-element-content')) {
      updateDynamicTextProperties(selectedElIdx);
      updateTbState();
    }
  }
});

function xCmd(cmd,val) { document.execCommand(cmd,false,val||null); updateTbState(); }

function toggleFontSizeDropdown(idx) {
  // close others first
  document.querySelectorAll('.fs-dropdown.show').forEach(d => {
    if (d.id !== `fsDropdown_${idx}`) d.classList.remove('show');
  });
  const d = document.getElementById(`fsDropdown_${idx}`);
  if (d) d.classList.toggle('show');
}

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.fs-dropdown') && !e.target.closest('.font-size-btn')) {
    document.querySelectorAll('.fs-dropdown.show').forEach(d => d.classList.remove('show'));
  }
});

function applyCustomFontSize(size, btnIdx) {
  if (!size) return;
  if (size === 'custom') {
    size = prompt("Enter font size in px (e.g., 42):", "24");
    if (!size || isNaN(parseInt(size))) return;
  }
  size = parseInt(size);

  document.querySelectorAll('.fs-dropdown.show').forEach(d => d.classList.remove('show'));

  // Update element data and the content element's base font size
  const elIdx = (btnIdx !== undefined) ? btnIdx : selectedElIdx;
  if (typeof elIdx !== 'undefined' && elIdx !== -1 && slides[currentSlideIdx]) {
    const el = slides[currentSlideIdx].elements[elIdx];
    if (el) el.fontSize = size;
  }

  const ce = (elIdx !== undefined && elIdx !== -1)
    ? document.querySelector(`[data-el-idx="${elIdx}"] .text-element-content`)
    : null;
  if (ce) ce.style.fontSize = size + 'px';

  // Update the button label
  const btn = document.getElementById(`fsBtn_${elIdx}`);
  if (btn) btn.innerHTML = size + ' ▾';

  if (ce) ce.dispatchEvent(new Event('input', { bubbles: true }));
  updateTbState();
}

function updateTbState() {
  document.querySelectorAll('.tt-btn').forEach(b=>{
    const t=b.getAttribute('title')||'';
    if(t==='Bold') b.classList.toggle('active',document.queryCommandState('bold'));
    if(t==='Italic') b.classList.toggle('active',document.queryCommandState('italic'));
    if(t==='Underline') b.classList.toggle('active',document.queryCommandState('underline'));
  });
}
