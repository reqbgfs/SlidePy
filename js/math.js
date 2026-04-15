// ═══════ MATH — KaTeX chip editor ═══════

// ── Internal helpers ────────────────────────────────────────────

function _refreshChipPreview(chip) {
  const preview = chip.querySelector('.math-chip-preview');
  if (!preview) return;
  try {
    preview.innerHTML = katex.renderToString(chip.dataset.latex.trim(), {
      displayMode: false, throwOnError: false
    });
  } catch (e) {
    preview.textContent = chip.dataset.latex.slice(0, 30);
  }
}

function _createChip(rawLatex, isDisplay) {
  const chip = document.createElement('span');
  chip.className = 'math-chip' + (isDisplay ? ' math-chip-block' : ' math-chip-inline');
  chip.contentEditable = 'false';
  chip.dataset.latex   = rawLatex;
  chip.dataset.display = isDisplay;

  const label = document.createElement('span');
  label.className   = 'math-chip-label';
  label.textContent = isDisplay ? '∑' : 'eq';

  const preview = document.createElement('span');
  preview.className = 'math-chip-preview';
  try {
    preview.innerHTML = katex.renderToString(rawLatex.trim(), {
      displayMode: false, throwOnError: false
    });
  } catch (e) {
    preview.textContent = rawLatex.trim().slice(0, 30);
  }

  const del = document.createElement('button');
  del.className   = 'math-chip-delete';
  del.textContent = '✕';
  del.title       = 'Delete equation';
  del.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    _removeChip(chip);
  });

  chip.appendChild(label);
  chip.appendChild(preview);
  chip.appendChild(del);

  chip.addEventListener('click', e => {
    if (e.target === del || del.contains(e.target)) return;
    e.preventDefault();
    openMathEditor(chip);
  });

  return chip;
}

function _removeChip(chip) {
  const ce = chip.closest('.text-element-content');
  chip.remove();
  if (ce) _persistCe(ce);
}

function _persistCe(ce) {
  const wrapper = ce.closest('[data-el-idx]');
  if (!wrapper || !slides[currentSlideIdx]) return;
  slides[currentSlideIdx].elements[parseInt(wrapper.dataset.elIdx)].content = getRawMathContent(ce);
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Scans text nodes in `container` for $...$ and $$...$$ and
 * replaces each match with a compact interactive chip.
 */
function renderMathInElement(container) {
  if (typeof katex === 'undefined') return;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: n =>
      n.parentNode.closest('.math-chip')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
  });

  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  for (const textNode of nodes) {
    const text = textNode.textContent;
    if (!text.includes('$')) continue;

    // Match $$...$$ before $...$ to avoid partial delimiter consumption.
    const re = /\$\$([\s\S]+?)\$\$|\$([^\$\n]+?)\$/g;
    let last = 0, m, hit = false;
    const frag = document.createDocumentFragment();

    while ((m = re.exec(text)) !== null) {
      if (m.index > last)
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));

      const isDisplay = m[0].startsWith('$$');
      frag.appendChild(_createChip(isDisplay ? m[1] : m[2], isDisplay));
      hit  = true;
      last = m.index + m[0].length;
    }

    if (hit) {
      if (last < text.length)
        frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }
}

/**
 * Replaces every chip in `container` with its raw $...$ / $$...$$ source text.
 * Called on focus so the user edits raw LaTeX.
 */
function unrenderMathInElement(container) {
  container.querySelectorAll('.math-chip').forEach(chip => {
    const d = chip.dataset.display === 'true';
    chip.replaceWith(d ? `$$${chip.dataset.latex}$$` : `$${chip.dataset.latex}$`);
  });
}

/**
 * Returns innerHTML with all chips converted back to raw $...$ syntax.
 * Always call this instead of .innerHTML when persisting.
 */
function getRawMathContent(container) {
  if (!container.querySelector('.math-chip')) return container.innerHTML;
  const clone = container.cloneNode(true);
  unrenderMathInElement(clone);
  return clone.innerHTML;
}

// ── Math editor popup ────────────────────────────────────────────

let _activeChip = null;
let _activeCe   = null;

function openMathEditor(chip) {
  closeMathEditor();
  _activeChip = chip;
  _activeCe   = chip.closest('.text-element-content');

  const isDisplay = chip.dataset.display === 'true';
  const latex     = chip.dataset.latex;

  const backdrop = document.createElement('div');
  backdrop.id        = 'mathEditorBackdrop';
  backdrop.className = 'math-editor-backdrop';
  backdrop.addEventListener('mousedown', () => closeMathEditor());

  const popup = document.createElement('div');
  popup.id        = 'mathEditorPopup';
  popup.className = 'math-editor-popup';
  popup.addEventListener('mousedown', e => e.stopPropagation());

  // Safely escape for textarea value (no innerHTML injection)
  const safeLatex = latex
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  popup.innerHTML = `
    <div class="math-editor-header">
      <span class="math-editor-title">${isDisplay ? 'Display' : 'Inline'} Equation</span>
      <button class="math-editor-close" onclick="closeMathEditor()">✕</button>
    </div>
    <div class="math-editor-body">
      <div class="math-editor-col">
        <span class="math-editor-label">LaTeX source</span>
        <textarea class="math-editor-textarea" id="mathEditorInput"
          spellcheck="false"
          placeholder="e.g. \\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}"
        >${safeLatex}</textarea>
        <span class="math-editor-hint">Ctrl+Enter to save · Esc to cancel</span>
      </div>
      <div class="math-editor-col">
        <span class="math-editor-label">Preview</span>
        <div class="math-editor-preview" id="mathEditorPreview"></div>
      </div>
    </div>
    <div class="math-editor-footer">
      <button class="math-editor-btn math-editor-btn-delete" onclick="deleteMathChip()">Delete</button>
      <div style="flex:1"></div>
      <button class="math-editor-btn" onclick="closeMathEditor()">Cancel</button>
      <button class="math-editor-btn math-editor-btn-save" onclick="saveMathEditor()">Save</button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(popup);

  const input   = document.getElementById('mathEditorInput');
  const preview = document.getElementById('mathEditorPreview');

  function updatePreview() {
    try {
      preview.innerHTML = katex.renderToString(input.value.trim(), {
        displayMode: isDisplay, throwOnError: false
      });
    } catch (e) {
      preview.textContent = 'Parse error: ' + e.message;
    }
  }

  input.addEventListener('input', updatePreview);
  input.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveMathEditor(); }
    if (e.key === 'Escape') { e.preventDefault(); closeMathEditor(); }
  });

  updatePreview();
  setTimeout(() => { input.focus(); input.select(); }, 40);
}

function closeMathEditor() {
  document.getElementById('mathEditorBackdrop')?.remove();
  document.getElementById('mathEditorPopup')?.remove();
  _activeChip = null;
  // Restore focus to the text cell so the user can keep editing
  if (_activeCe) { _activeCe.focus(); _activeCe = null; }
}

function saveMathEditor() {
  if (!_activeChip) return;
  const input = document.getElementById('mathEditorInput');
  if (!input) return;
  _activeChip.dataset.latex = input.value;
  _refreshChipPreview(_activeChip);
  const ce = _activeChip.closest('.text-element-content');
  if (ce) _persistCe(ce);
  closeMathEditor();
}

function deleteMathChip() {
  if (!_activeChip) return;
  _removeChip(_activeChip);
  closeMathEditor();
}
