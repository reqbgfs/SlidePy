// js/cm-cell.js
// CM6 Integration for SlidePy

if (typeof CM === 'undefined') {
    console.warn("CM (CodeMirror Global) not found. CM6 features will be disabled.");
}

/**
 * Initializes a CM6 editor in the given container.
 * Each editor gets its own Compartment instances so reconfiguration
 * doesn't collide between editors.
 *
 * @param {HTMLElement} container
 * @param {Object} el  Element data from slides[i].elements[j]
 * @param {String} cmId  Key for the global codeMirrors registry
 */
function initCM6(container, el, cmId) {
    const theme = el.cmTheme === 'light' ? CM.vscodeLight : CM.vscodeDark;

    const startSize = el.fontSize || 13;

    // Per-editor compartments — each editor must own its own instances
    const myFontCompartment  = new CM.Compartment();
    const myThemeCompartment = new CM.Compartment();

    const state = CM.EditorState.create({
        doc: el.code || "",
        extensions: [
            CM.basicSetup,
            CM.python(),
            myThemeCompartment.of(theme),
            myFontCompartment.of(CM.EditorView.theme({
                "&": { fontSize: startSize + "px" },
                ".cm-scroller": { overflow: "auto", maxHeight: "100%" },
                ".cm-content": { fontFamily: "'JetBrains Mono', monospace" },
                ".cm-gutters":  { fontFamily: "'JetBrains Mono', monospace" }
            })),
            CM.EditorView.lineWrapping,
            CM.keymap.of([CM.indentWithTab]),

            // Intercept Ctrl+= / Ctrl+- at the DOM level so the browser's
            // native zoom never fires and our font-size logic always wins.
            CM.EditorView.domEventHandlers({
                keydown(event, view) {
                    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
                        if (event.key === '=' || event.key === '+') {
                            event.preventDefault();
                            _cmFontDelta(view, cmId, 1);
                            return true;
                        }
                        if (event.key === '-') {
                            event.preventDefault();
                            _cmFontDelta(view, cmId, -1);
                            return true;
                        }
                    }
                    return false;
                }
            }),

            CM.EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    el.code = update.state.doc.toString();
                }
            })
        ]
    });

    const view = new CM.EditorView({ state, parent: container });

    // Store per-editor metadata for later reconfiguration
    view._pyslide = {
        fontCompartment:  myFontCompartment,
        themeCompartment: myThemeCompartment,
        cmId
    };

    codeMirrors[cmId] = view;
    return view;
}

/* ── Font scaling ──────────────────────────────────────────────── */

function _cmFontDelta(view, cmId, delta) {
    const parts = cmId.split('_');
    const sIdx  = parseInt(parts[1]);
    const elIdx = parseInt(parts[2]);
    if (isNaN(sIdx) || isNaN(elIdx)) return;

    const el = slides[sIdx] && slides[sIdx].elements[elIdx];
    if (!el) return;

    el.fontSize = Math.max(6, Math.min(120, (el.fontSize || 13) + delta));

    const comp = view._pyslide && view._pyslide.fontCompartment;
    if (!comp) return;

    view.dispatch({
        effects: comp.reconfigure(CM.EditorView.theme({
            "&": { fontSize: el.fontSize + "px" },
            ".cm-scroller": { overflow: "auto", maxHeight: "100%" },
            ".cm-content": { fontFamily: "'JetBrains Mono', monospace" },
            ".cm-gutters":  { fontFamily: "'JetBrains Mono', monospace" }
        }))
    });

    toast(`Font Size: ${el.fontSize}px`);
}

/* ── Theme refresh ─────────────────────────────────────────────── */

function refreshCMThemes() {
    for (const cmId in codeMirrors) {
        const view = codeMirrors[cmId];
        if (!view || !view._pyslide) continue;
        const parts = cmId.split('_');
        const sIdx  = parseInt(parts[1]);
        const elIdx = parseInt(parts[2]);
        const el = slides[sIdx] && slides[sIdx].elements[elIdx];
        const themeExt = (el && el.cmTheme === 'light') ? CM.vscodeLight : CM.vscodeDark;
        const comp = view._pyslide.themeCompartment;
        view.dispatch({ effects: comp.reconfigure(themeExt) });
    }
}

function setCMTheme(idx, theme) {
    const el = slides[currentSlideIdx].elements[idx];
    if (!el) return;
    el.cmTheme = theme;
    const cmId = `cm_${currentSlideIdx}_${idx}`;
    const view = codeMirrors[cmId];
    if (view && view._pyslide) {
        const themeExt = theme === 'light' ? CM.vscodeLight : CM.vscodeDark;
        view.dispatch({ effects: view._pyslide.themeCompartment.reconfigure(themeExt) });
    }
    renderSlide();
    saveUndo();
}
