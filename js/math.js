// ═══════ MATH (KaTeX) ═══════

/**
 * Scans all text nodes in `container` for $...$ (inline) and $$...$$ (display)
 * and replaces them with KaTeX-rendered spans.
 * Already-rendered spans are skipped so double-rendering never occurs.
 */
function renderMathInElement(container) {
  if (typeof katex === 'undefined') return;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: n =>
      n.parentNode.closest('.math-rendered')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
  });

  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(n);

  for (const textNode of textNodes) {
    const text = textNode.textContent;
    if (!text.includes('$')) continue;

    // Match $$...$$ before $...$ to avoid consuming delimiter pairs incorrectly.
    // Inline: $...$ must not span a newline and must not be empty.
    const re = /\$\$([\s\S]+?)\$\$|\$([^\$\n]+?)\$/g;
    let last = 0, m, hit = false;
    const frag = document.createDocumentFragment();

    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      }

      const isDisplay = m[0].startsWith('$$');
      const rawLatex  = isDisplay ? m[1] : m[2];   // preserve for round-trip
      const latex     = rawLatex.trim();

      try {
        const span = document.createElement('span');
        span.className       = 'math-rendered';
        span.contentEditable = 'false';          // treat as atomic in contenteditable
        span.dataset.latex   = rawLatex;
        span.dataset.display = isDisplay;
        span.innerHTML = katex.renderToString(latex, {
          displayMode:  isDisplay,
          throwOnError: false,
          output:       'html'
        });
        if (isDisplay) {
          span.style.cssText = 'display:block;text-align:center;margin:.35em 0;';
        }
        frag.appendChild(span);
        hit = true;
      } catch (e) {
        // Render failed — keep the raw delimiters visible
        frag.appendChild(document.createTextNode(m[0]));
      }

      last = m.index + m[0].length;
    }

    if (hit) {
      if (last < text.length) {
        frag.appendChild(document.createTextNode(text.slice(last)));
      }
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }
}

/**
 * Replaces every .math-rendered span in `container` with its raw $...$ or $$...$$ text,
 * restoring the source for editing.
 */
function unrenderMathInElement(container) {
  container.querySelectorAll('.math-rendered').forEach(span => {
    const d = span.dataset.display === 'true';
    span.replaceWith(d ? `$$${span.dataset.latex}$$` : `$${span.dataset.latex}$`);
  });
}

/**
 * Returns the innerHTML of `container` with all math spans converted back to
 * raw $...$ syntax.  Used by persistAll so saved data never contains KaTeX HTML.
 */
function getRawMathContent(container) {
  if (!container.querySelector('.math-rendered')) return container.innerHTML;
  const clone = container.cloneNode(true);
  unrenderMathInElement(clone);
  return clone.innerHTML;
}
