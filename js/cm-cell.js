// js/cm-cell.js
// CM6 Integration for SlidePy

if (typeof CM === 'undefined') {
    console.warn("CM (CodeMirror Global) not found. CM6 features will be disabled.");
}

const fontSizeCompartment = new CM.Compartment();
const themeCompartment = new CM.Compartment();

/**
 * Initializes a CM6 editor in the given container
 * @param {HTMLElement} container 
 * @param {Object} el Element data from slides[i].elements[j]
 * @param {String} cmId Key for codeMirrors object
 */
function initCM6(container, el, cmId) {
    const isLight = isLightColor(slides[currentSlideIdx].bg);
    const theme = isLight ? CM.atomone : CM.oneDark;
    
    const startSize = el.fontSize || 13;

    const state = CM.EditorState.create({
        doc: el.code || "",
        extensions: [
            CM.basicSetup,
            CM.python(),
            themeCompartment.of(theme),
            fontSizeCompartment.of(CM.EditorView.theme({
                "&": { fontSize: startSize + "px" },
                ".cm-scroller": { overflow: "auto", maxHeight: "100%" },
                ".cm-content": { fontFamily: "'JetBrains Mono', monospace" }
            })),
            CM.EditorView.lineWrapping,
            CM.keymap.of([
                CM.indentWithTab,
                {
                    key: "Mod-=",
                    run: (view) => {
                        updateElementFontSize(view, cmId, 1);
                        return true;
                    }
                },
                {
                    key: "Mod--",
                    run: (view) => {
                        updateElementFontSize(view, cmId, -1);
                        return true;
                    }
                }
            ]),
            CM.EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    el.code = update.state.doc.toString();
                }
            })
        ]
    });

    const view = new CM.EditorView({
        state,
        parent: container
    });
    
    codeMirrors[cmId] = view;
    return view;
}

/**
 * Updates the font size of a specific editor and persists it to element data
 */
function updateElementFontSize(view, cmId, delta) {
    const parts = cmId.split('_');
    const sIdx = parseInt(parts[1]);
    const elIdx = parseInt(parts[2]);
    
    if (isNaN(sIdx) || isNaN(elIdx)) return;
    
    const el = slides[sIdx].elements[elIdx];
    if (!el) return;

    el.fontSize = (el.fontSize || 13) + delta;
    el.fontSize = Math.max(6, Math.min(120, el.fontSize));

    view.dispatch({
        effects: fontSizeCompartment.reconfigure(CM.EditorView.theme({
            "&": { fontSize: el.fontSize + "px" }
        }))
    });
    
    toast(`Font Size: ${el.fontSize}px`);
}

/**
 * Refreshes the theme of all active editors based on current background
 */
function refreshCMThemes() {
    const isLight = isLightColor(slides[currentSlideIdx].bg);
    const theme = isLight ? CM.atomone : CM.oneDark;
    
    for (const cmId in codeMirrors) {
        const view = codeMirrors[cmId];
        if (view && view.dispatch) {
            view.dispatch({
                effects: themeCompartment.reconfigure(theme)
            });
        }
    }
}
