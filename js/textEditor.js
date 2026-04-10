// ═══════ TEXT TOOLBAR ═══════
function mkTextToolbar(idx) {
  const tb=document.createElement('div'); tb.className='text-toolbar'; tb.id=`ttb_${idx}`;
  tb.innerHTML=`
    <button class="tt-btn" onmousedown="event.preventDefault();xCmd('bold')" title="Bold"><b style="font-size:13px">B</b></button>
    <button class="tt-btn" onmousedown="event.preventDefault();xCmd('italic')" title="Italic"><i style="font-size:12px">I</i></button>
    <button class="tt-btn" onmousedown="event.preventDefault();xCmd('underline')" title="Underline" style="text-decoration:underline">U</button>
    <div class="tt-sep"></div>
    <div style="display:inline-block; position:relative; z-index:1000;">
      <button class="tt-btn font-size-btn" id="fsBtn_${idx}" onmousedown="event.preventDefault(); toggleFontSizeDropdown(${idx})" title="Font size" style="width:50px; font-size:12px; font-family:'DM Sans',sans-serif">24 ▾</button>
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
      const computedStyle = window.getComputedStyle(node);
      const fSize = computedStyle.fontSize;
      if (fSize) {
        const btn = document.getElementById(`fsBtn_${idx}`);
        if (btn) btn.innerHTML = parseInt(fSize) + " ▾";
      }
      const fColor = computedStyle.color;
      if (fColor) {
        const tb = document.getElementById(`ttb_${idx}`);
        if(tb) {
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
  if (btnIdx !== undefined) {
    const btn = document.getElementById(`fsBtn_${btnIdx}`);
    if (btn) btn.innerHTML = parseInt(size) + " ▾";
  }
  document.querySelectorAll('.fs-dropdown.show').forEach(d => d.classList.remove('show'));
  
  restoreTextSelection();
  const s = document.getSelection();
  let ce = null;
  if(typeof selectedElIdx !== 'undefined' && selectedElIdx !== -1) {
      ce = document.querySelector(`[data-el-idx="${selectedElIdx}"] .text-element-content`);
  }

  if (s.rangeCount > 0 && !s.isCollapsed) {
    document.execCommand("fontSize", false, "7");
    if (ce) {
      const fonts = ce.getElementsByTagName("font");
      for (let i = 0; i < fonts.length; i++) {
        if (fonts[i].getAttribute("size") == "7" || fonts[i].size == "7") {
          fonts[i].removeAttribute("size");
          fonts[i].style.fontSize = size + "px";
          fonts[i].style.lineHeight = "normal";
        }
      }
    }
  } else {
    // If nothing selected, just insert a span and place caret inside
    const span = document.createElement("span");
    span.style.fontSize = size + "px";
    span.style.lineHeight = "normal";
    span.innerHTML = "&#8203;"; // zero-width space
    const range = s.getRangeAt(0);
    range.insertNode(span);
    range.selectNodeContents(span);
    range.collapse(false);
    s.removeAllRanges();
    s.addRange(range);
  }
  
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
