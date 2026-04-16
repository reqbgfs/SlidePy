// ═══════ PYODIDE ═══════
async function initPyodide(config) {
  const ls = document.getElementById('loadingScreen');
  const lsBar = ls ? ls.querySelector('.loading-bar-fill') : null;
  const lsText = ls ? ls.querySelector('.loading-subtitle') : null;
  const pkgs = config && config.packages ? config.packages : DEFAULT_PACKAGES;
  try {
    if (lsText) lsText.textContent = 'Loading Python runtime...';
    pyodide = await loadPyodide({ indexURL:"https://cdn.jsdelivr.net/pyodide/v0.24.1/full/" });
    
    if (lsBar) { lsBar.style.animation = 'none'; lsBar.style.width = '10%'; }

    // Mount IDBFS and perform isolation cleanup
    const mountDir = '/IDBFS';
    try { pyodide.FS.mkdir(mountDir); } catch(e) {} // may already exist
    pyodide.FS.mount(pyodide.FS.filesystems.IDBFS, {}, mountDir);
    
    if (lsText) lsText.textContent = 'Syncing local cache...';
    if (lsBar) lsBar.style.width = '20%';
    await new Promise((resolve, reject) => {
        pyodide.FS.syncfs(true, (err) => err ? reject(err) : resolve());
    });
    
    if (lsBar) lsBar.style.width = '30%';

    // Garbage Collection: Delete orphans!
    const validIds = JSON.parse(localStorage.getItem('slidepy_presentations') || '[]').map(p => p.id).filter(id => id);
    if (typeof activePresentationId !== 'undefined' && activePresentationId && !validIds.includes(activePresentationId)) {
        validIds.push(activePresentationId);
    }

    pyodide.runPython(`
import os, shutil
valid_ids = ${JSON.stringify(validIds)}
mount_dir = '${mountDir}'
try:
    for d in os.listdir(mount_dir):
        if d not in valid_ids and d not in ['.', '..']:
            shutil.rmtree(os.path.join(mount_dir, d), ignore_errors=True)
except Exception as e:
    print(f"Cleanup error: {e}")
    `);

    // Setup active presentation's environment target
    const presId = (typeof activePresentationId !== 'undefined' && activePresentationId) ? activePresentationId : 'default';
    const envDir = `${mountDir}/${presId}`;
    const sitePackages = `${envDir}/site-packages`;
    
    pyodide.runPython(`
import os, sys
site_pkg = '${sitePackages}'
os.makedirs(site_pkg, exist_ok=True)
if site_pkg not in sys.path:
    sys.path.insert(0, site_pkg)
if os.path.dirname(site_pkg) not in sys.path:
    sys.path.insert(0, os.path.dirname(site_pkg))
    `);

    // Collect unique top-level package names for loadPackage
    const topLevelPkgs = [...new Set(pkgs.map(p => p.name.split('.')[0]).filter(n => n))];
    const stdlibs = ['math','os','sys','time','json','re','datetime','random','collections','itertools','functools'];

    if (topLevelPkgs.length > 0) {
      await pyodide.loadPackage('micropip');
      
      for (let i = 0; i < topLevelPkgs.length; i++) {
        const pName = topLevelPkgs[i];
        if (stdlibs.includes(pName)) continue;
        
        if (lsBar) lsBar.style.width = (35 + Math.floor(50 * (i / topLevelPkgs.length))) + '%';
        if (lsText) lsText.textContent = `Installing ${pName}...`;
        await new Promise(r => setTimeout(r, 10));
        
        try {
          // Try pyodide.loadPackage first (fastest, uses precompiled wheels)
          await pyodide.loadPackage(pName);
        } catch(e1) {
          // Fall back to micropip for pure-python packages
          try {
            await pyodide.runPythonAsync(`import micropip; await micropip.install('${pName}')`);
          } catch(e2) {
            console.warn(`Could not install ${pName}:`, e2.message || e2);
          }
        }
      }
      
      if (lsText) lsText.textContent = 'Saving to local cache...';
      if (lsBar) lsBar.style.width = '85%';
      await new Promise(r => setTimeout(r, 10));
      await new Promise((resolve) => pyodide.FS.syncfs(false, resolve));
    }

    if (lsBar) lsBar.style.width = '90%';
    if (lsText) lsText.textContent = 'Configuring environment...';
    await new Promise(r => setTimeout(r, 10));

    // Standard imports
    pyodide.runPython(`import sys, io`);

    // Import and alias each package
    for (let i = 0; i < pkgs.length; i++) {
      const pkg = pkgs[i];
      if (lsText) lsText.textContent = `Importing ${pkg.name}...`;
      if (lsBar) lsBar.style.width = (90 + Math.floor(10 * (i / pkgs.length))) + '%';
      await new Promise(r => setTimeout(r, 10)); // allow browser paint
      
      try {
        const importName = getImportName(pkg.name);
        if (pkg.alias) {
          pyodide.runPython(`import ${importName} as ${pkg.alias}`);
        } else {
          pyodide.runPython(`import ${importName}`);
        }
      } catch(e) {
        console.warn(`Could not import ${pkg.name}:`, e);
      }
    }

    // matplotlib backend setup if matplotlib is loaded
    if (topLevelPkgs.includes('matplotlib')) {
      try { pyodide.runPython(`import matplotlib\nmatplotlib.use('AGG')`); } catch(e) {}
    }

    pyReady = true;
    document.getElementById('pyStatus').classList.add('ready');
    document.getElementById('pyStatusText').textContent = 'Python ready';
    if (lsBar) lsBar.style.width = '100%';
    if (lsText) lsText.textContent = 'Ready!';
  } catch(e) {
    document.getElementById('pyStatus').classList.add('error');
    document.getElementById('pyStatusText').textContent = 'Python failed';
    if (lsText) lsText.textContent = 'Python failed to load — app is still usable.';
    console.error('Pyodide init error:', e);
  }
  // Dismiss loading screen
  setTimeout(() => { if (ls) ls.classList.add('hidden'); }, 400);
  setTimeout(() => { if (ls) { ls.style.display = 'none'; } }, 1100);
}

async function updatePyodideEnvironment(config) {
  const ls = document.getElementById('loadingScreen');
  const lsBar = ls ? ls.querySelector('.loading-bar-fill') : null;
  const lsText = ls ? ls.querySelector('.loading-subtitle') : null;
  
  if (ls) { ls.style.display = 'flex'; ls.classList.remove('hidden'); }
  if (lsBar) { lsBar.style.animation = 'none'; lsBar.style.width = '10%'; }
  if (lsText) lsText.textContent = 'Uninstalling unused packages...';
  
  const pkgs = config && config.packages ? config.packages : DEFAULT_PACKAGES;
  const presId = activePresentationId;
  if (!presId) { toast('Error: No active presentation ID'); return; }

  // Wipe cache and reconstruct
  try {
      await pyodide.runPythonAsync(`
import shutil, os
mount_dir = '/IDBFS/${presId}'
shutil.rmtree(mount_dir, ignore_errors=True)
site_pkg = f"{mount_dir}/site-packages"
if site_pkg not in sys.path:
    sys.path.insert(0, site_pkg)
if os.path.dirname(site_pkg) not in sys.path:
    sys.path.insert(0, os.path.dirname(site_pkg))
      `);
      if (lsBar) lsBar.style.width = '20%';
  } catch(e) { console.error('Uninstall failed', e); }

  const topLevelPkgs = [...new Set(pkgs.map(p => p.name.split('.')[0]).filter(n => n))];
  const stdlibs = ['math','os','sys','time','json','re','datetime','random','collections','itertools','functools'];
  
  if (topLevelPkgs.length > 0) {
      await pyodide.loadPackage('micropip');
      
      for (let i = 0; i < topLevelPkgs.length; i++) {
        const pName = topLevelPkgs[i];
        if (stdlibs.includes(pName)) continue;
        
        if (lsBar) lsBar.style.width = (35 + Math.floor(50 * (i / topLevelPkgs.length))) + '%';
        if (lsText) lsText.textContent = `Installing ${pName}...`;
        await new Promise(r => setTimeout(r, 10));
        
        try {
          await pyodide.loadPackage(pName);
        } catch(e1) {
          try {
            await pyodide.runPythonAsync(`import micropip; await micropip.install('${pName}')`);
          } catch(e2) {
            console.warn(`Could not install ${pName}:`, e2.message || e2);
          }
        }
      }
      
      if (lsText) lsText.textContent = 'Saving to local cache...';
      if (lsBar) lsBar.style.width = '85%';
      await new Promise(r => setTimeout(r, 10));
      await new Promise((resolve) => pyodide.FS.syncfs(false, resolve));
  }
  
  if (lsBar) lsBar.style.width = '90%';
  if (lsText) lsText.textContent = 'Configuring environment...';
  await new Promise(r => setTimeout(r, 10));

  pyodide.runPython(`import sys, io`);
  
  // Import aliases
  for (let i = 0; i < pkgs.length; i++) {
      const pkg = pkgs[i];
      if (lsText) lsText.textContent = `Importing ${pkg.name}...`;
      if (lsBar) lsBar.style.width = (90 + Math.floor(10 * (i / pkgs.length))) + '%';
      await new Promise(r => setTimeout(r, 10));
      
      try {
        const importName = getImportName(pkg.name);
        if (pkg.alias) pyodide.runPython(`import ${importName} as ${pkg.alias}`);
        else pyodide.runPython(`import ${importName}`);
      } catch(e) { console.warn(`Could not import ${pkg.name}:`, e); }
  }

  toast('Python Environment Updated!');
  
  setTimeout(() => { if (ls) ls.classList.add('hidden'); }, 400);
  setTimeout(() => { if (ls) { ls.style.display = 'none'; } }, 1100);
}

async function runCell(i) {
  if(!pyReady){toast('Python loading...');return;}
  const el=slides[currentSlideIdx].elements[i];
  const view = codeMirrors[`cm_${currentSlideIdx}_${i}`];
  if (view && view.state) {
      el.code = view.state.doc.toString();
  }

  // When separated, the output lives in the linked jupyter-output element.
  let outputEl = el;
  let outputIdx = i;
  if (el.type === 'jupyter-input' && el.linkId) {
    const els = slides[currentSlideIdx].elements;
    const j = els.findIndex((e, k) => k !== i && e.linkId === el.linkId && e.type === 'jupyter-output');
    if (j !== -1) { outputEl = els[j]; outputIdx = j; }
  }

  const btn=document.getElementById(`runBtn_${i}`), out=document.getElementById(`output_${outputIdx}`);
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Running';
  if (out) out.innerHTML='<span style="color:var(--text-muted)">Executing...</span>';
  try {
    const presId = (typeof activePresentationId !== 'undefined' && activePresentationId) ? activePresentationId : 'default';
    const baseDir = `/IDBFS/${presId}`;
    
    // Sync modified/new files to Pyodide FS
    for(const[n,f] of Object.entries(uploadedFiles)){
      if (f.data === '[stored_in_idb]') continue;
      
      const fullPath = `${baseDir}/${n}`;
      if(f.type === 'binary') {
        try {
          const parts = f.data.split(',');
          if (parts.length > 1) {
            const bytes = base64ToUint8(parts[1]);
            pyodide.FS.writeFile(fullPath, bytes);
          }
        } catch(e) { console.error("Could not write binary to pyodide", n, e); }
      } else {
        pyodide.FS.writeFile(fullPath, f.data);
      }
      
      // Auto-import .py files as requested
      if(n.endsWith('.py')){
        const mn=n.replace('.py','');
        pyodide.runPython(`import types,sys\nmod=types.ModuleType("${mn}")\nexec(${JSON.stringify(f.data)},mod.__dict__)\nsys.modules["${mn}"]=mod`);
      }
    }

    pyodide.runPython(`import sys,io,os\nos.chdir('${baseDir}')\n_buf=io.StringIO()\nsys.stdout=_buf\nsys.stderr=_buf\ntry:\n  import matplotlib.pyplot as _plt_internal\n  _plt_internal.close('all')\nexcept Exception:\n  pass`);
    await pyodide.runPythonAsync(el.code);
    const hasPlot=pyodide.runPython(`_has_plot=False\ntry:\n  import matplotlib.pyplot as _plt_internal\n  _has_plot=len(_plt_internal.get_fignums())>0\nexcept Exception:\n  pass\n_has_plot`);
    let html=''; const stdout=pyodide.runPython(`_buf.getvalue()`);
    if(stdout) html+=`<span class="stdout">${escHtml(stdout)}</span>`;
    if(hasPlot){const img=pyodide.runPython(`import base64\nbuf=io.BytesIO()\n_plt_internal.savefig(buf,format='png',dpi=120,bbox_inches='tight',facecolor='#1c1c26',edgecolor='none')\nbuf.seek(0)\n_img_b64=base64.b64encode(buf.read()).decode('utf-8')\n_plt_internal.close('all')\n_img_b64`);html+=`<img src="data:image/png;base64,${img}">`;}
    if(!html) html='<span style="color:var(--text-muted)">No output</span>';
    if (out) out.innerHTML=html; outputEl.output=html; outputEl.outputVisible=true;
    pyodide.runPython(`sys.stdout=sys.__stdout__;sys.stderr=sys.__stderr__`);
  } catch(e){
    const errHtml=`<span class="error">${escHtml(e.message)}</span>`;
    if (out) out.innerHTML=errHtml;
    outputEl.output=errHtml; outputEl.outputVisible=true;
    try{pyodide.runPython(`sys.stdout=sys.__stdout__;sys.stderr=sys.__stderr__`);}catch(_){}
  }
  // Reveal separated output cell wrapper
  if (outputIdx !== i) {
    const outWrapper = document.querySelector(`[data-el-idx="${outputIdx}"]`);
    const inWrapper = document.querySelector(`[data-el-idx="${i}"]`);
    if (outWrapper) {
      outWrapper.style.visibility = 'visible';
      if (document.body.classList.contains('presenting')) {
        outWrapper.style.zIndex = String(parseInt(outWrapper.style.zIndex || '110') + 10);
      } else {
        // Editor: boost above input so Clear button is accessible
        const inputZ = inWrapper ? parseInt(inWrapper.style.zIndex || '50') : 50;
        outWrapper.style.zIndex = String(inputZ + 10);
      }
    }
  }
  btn.disabled=false; btn.innerHTML='▶ Run';
}

function base64ToUint8(b64) {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function clearOutput(i) {
  const el = slides[currentSlideIdx].elements[i];
  const out = document.getElementById(`output_${i}`);
  const placeholder = el && el.type === 'jupyter-output' ? 'Results...' : 'Run code to see output...';
  if (out) out.innerHTML = `<span style="color:var(--text-muted)">${placeholder}</span>`;
  if (el) { el.output = ''; el.outputVisible = false; }
  if (el && el.type === 'jupyter-output') {
    const wrapper = document.querySelector(`[data-el-idx="${i}"]`);
    if (wrapper) {
      const isPresenting = document.body.classList.contains('presenting');
      if (isPresenting) {
        // Presentation: hide completely
        wrapper.style.visibility = 'hidden';
        wrapper.style.pointerEvents = 'none';
      } else {
        // Editor: hide and send back behind input
        wrapper.style.visibility = 'hidden';
        const linkedInput = slides[currentSlideIdx].elements.find(
          (e, k) => k !== i && e.linkId === el.linkId && e.type === 'jupyter-input'
        );
        if (linkedInput) {
          const linkedIdx = slides[currentSlideIdx].elements.indexOf(linkedInput);
          const inWrapper = document.querySelector(`[data-el-idx="${linkedIdx}"]`);
          const inputZ = inWrapper ? parseInt(inWrapper.style.zIndex || '50') : 50;
          wrapper.style.zIndex = String(inputZ - 10);
        } else {
          wrapper.style.zIndex = String(parseInt(wrapper.style.zIndex || '60') - 20);
        }
      }
    }
  }
}

// ═══════ UPLOAD ═══════
function openUploadModal() { document.getElementById('uploadModal').classList.add('show'); }

async function handleFileConflict(fileObj) {
  if (!uploadedFiles[fileObj.name]) return fileObj;
  
  return new Promise((resolve) => {
    const modal = document.getElementById('assetConflictModal');
    const msg = document.getElementById('conflictMsg');
    const input = document.getElementById('conflictNewName');
    
    msg.textContent = `A file named "${fileObj.name}" already exists in your assets. What would you like to do?`;
    input.value = fileObj.name;
    
    document.getElementById('btnConflictOverwrite').onclick = () => {
      closeModal('assetConflictModal');
      resolve(fileObj);
    };
    
    document.getElementById('btnConflictRename').onclick = () => {
      const newName = input.value.trim();
      if (!newName) { toast("Please provide a name."); return; }
      if (uploadedFiles[newName]) { toast("That name also exists."); return; }
      closeModal('assetConflictModal');
      fileObj.name = newName;
      resolve(fileObj);
    };
    
    document.getElementById('btnConflictCancel').onclick = () => {
      closeModal('assetConflictModal');
      resolve(null);
    };
    
    modal.classList.add('show');
  });
}

// Process a single File object: extract ZIPs, otherwise read as data/text.
// Returns an array of {name, data, type} objects (one per file, many for ZIPs).
async function _readFileObjects(f) {
  const isZip = /\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed';
  if (isZip) {
    try {
      const zip = await JSZip.loadAsync(f);
      const results = [];
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const name = path.split('/').pop(); // flatten to filename only
        if (!name) continue;
        const isB = _isBinaryFile({ name });
        let data;
        if (isB) {
          const blob = await entry.async('blob');
          data = await new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(blob); });
        } else {
          data = await entry.async('string');
        }
        results.push({ name, data, type: isB ? 'binary' : 'text' });
      }
      return results;
    } catch(e) {
      toast(`Failed to open ZIP: ${e.message}`);
      return [];
    }
  }

  const isHtml = f.type === 'text/html' || f.name.toLowerCase().endsWith('.html');
  const isBinary = _isBinaryFile(f);
  let data = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (re) => resolve(re.target.result);
    if (isBinary || isHtml) reader.readAsDataURL(f);
    else reader.readAsText(f);
  });
  if (isHtml && typeof data === 'string' && data.startsWith('data:text/html') && !data.includes('charset=utf-8')) {
    data = data.replace('data:text/html', 'data:text/html;charset=utf-8');
  }
  return [{ name: f.name, data, type: isBinary ? 'binary' : 'text' }];
}

function _isBinaryFile(f) {
  // Pure text formats that Python/JS can use directly as strings
  if (/\.(py|js|jsx|ts|tsx|css|csv|txt|json|xml|md|yaml|yml)$/i.test(f.name)) return false;
  // HTML is read as DataURL for iframe embedding but flagged as text for Python FS writes
  return true;
}

function _fileCategory(name) {
  if (/\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i.test(name)) return 'image';
  if (/\.(mp4|webm|ogg|mov|avi)$/i.test(name))            return 'video';
  if (/\.(py|js|jsx|ts|tsx|html|css)$/i.test(name))       return 'script';
  return 'data';
}

async function handleFileUpload(e) {
  for (const f of Array.from(e.target.files)) {
    for (let fileObj of await _readFileObjects(f)) {
      fileObj = await handleFileConflict(fileObj);
      if (fileObj) {
        uploadedFiles[fileObj.name] = fileObj;
        _filesDirty = true;
        renderUploadedFiles();
        toast(`Saved ${fileObj.name}`);
      }
    }
  }
  e.target.value = '';
}

function renderUploadedFiles() {
  const l = document.getElementById('uploadedFilesList');
  if (!l) return;
  l.innerHTML = '';

  const files = Object.values(uploadedFiles).filter(Boolean);
  if (files.length === 0) {
    l.innerHTML = '<div class="file-list-empty">No files uploaded yet.</div>';
    return;
  }

  const catMeta = {
    image:  { label: 'Images',  icon: '🖼️' },
    video:  { label: 'Videos',  icon: '🎬' },
    script: { label: 'Scripts', icon: '📜' },
    data:   { label: 'Data',    icon: '📄' },
  };
  const groups = { image: [], video: [], script: [], data: [] };
  files.forEach(f => groups[_fileCategory(f.name || '')]?.push(f));

  for (const [cat, catFiles] of Object.entries(groups)) {
    if (!catFiles.length) continue;

    const hdr = document.createElement('div');
    hdr.className = 'file-category-header';
    hdr.textContent = `${catMeta[cat].icon} ${catMeta[cat].label}`;
    l.appendChild(hdr);

    catFiles.forEach(f => {
      const name = f.name;
      const safeN = escHtml(name);
      const isStoredIdb = f.data === '[stored_in_idb]';

      const d = document.createElement('div');
      d.className = 'uploaded-file-item';

      // Thumbnail for images (only when data is available)
      let thumbHtml;
      if (cat === 'image' && f.data && !isStoredIdb) {
        thumbHtml = `<img class="file-thumb" src="${f.data}" alt="">`;
      } else {
        thumbHtml = `<span class="file-icon-badge">${catMeta[cat].icon}</span>`;
      }

      d.innerHTML = `
        ${thumbHtml}
        <span class="file-item-name" title="${safeN}">${safeN}</span>
        <div class="file-item-actions">
          <button title="Rename" onclick="initiateRename('${safeN}')">✏️</button>
          <button title="Delete" onclick="removePyFile('${safeN}')">✕</button>
        </div>`;
      l.appendChild(d);
    });
  }
}

function initiateRename(oldName) {
  const modal = document.getElementById('assetRenameModal');
  const input = document.getElementById('renameAssetInput');
  const btn = document.getElementById('btnConfirmRename');
  
  input.value = oldName;
  btn.onclick = () => {
    const userInput = input.value.trim();
    if (!userInput) { toast("Name cannot be empty"); return; }
    
    // Extension preservation logic
    const dotIdx = oldName.lastIndexOf('.');
    const origExt = dotIdx !== -1 ? oldName.substring(dotIdx) : '';
    
    let baseName = userInput;
    const userDotIdx = userInput.lastIndexOf('.');
    if (userDotIdx !== -1) {
      baseName = userInput.substring(0, userDotIdx);
    }
    
    const newName = baseName + origExt;
    
    if (newName === oldName) { closeModal('assetRenameModal'); return; }
    if (uploadedFiles[newName]) { toast("A file with that name already exists"); return; }
    
    // Update state
    const fileObj = uploadedFiles[oldName];
    fileObj.name = newName;
    uploadedFiles[newName] = fileObj;
    delete uploadedFiles[oldName];
    
    // Update FS
    const presId = (typeof activePresentationId !== 'undefined' && activePresentationId) ? activePresentationId : 'default';
    try {
      if (pyReady && pyodide) {
        pyodide.FS.rename(`/IDBFS/${presId}/${oldName}`, `/IDBFS/${presId}/${newName}`);
      }
    } catch(e) {}
    
    closeModal('assetRenameModal');
    renderUploadedFiles();
    toast(`Renamed to ${newName}`);
  };
  
  modal.classList.add('show');
}

function removePyFile(n) {
  const presId = (typeof activePresentationId !== 'undefined' && activePresentationId) ? activePresentationId : 'default';
  const fullPath = `/IDBFS/${presId}/${n}`;
  try {
    if (pyReady && pyodide) pyodide.FS.unlink(fullPath);
  } catch(e) {}
  
  delete uploadedFiles[n];
  _filesDirty = true;
  renderUploadedFiles();
  toast(`Removed ${n}`);
}

function setupDropZone() {
  const z = document.getElementById('uploadZone');
  if (!z) return;
  z.ondragover = (e) => { e.preventDefault(); z.style.borderColor = 'var(--accent)'; };
  z.ondragleave = () => { z.style.borderColor = ''; };
  z.ondrop = async (e) => {
    e.preventDefault();
    z.style.borderColor = '';
    for (const f of Array.from(e.dataTransfer.files)) {
      for (let fileObj of await _readFileObjects(f)) {
        fileObj = await handleFileConflict(fileObj);
        if (fileObj) {
          uploadedFiles[fileObj.name] = fileObj;
          _filesDirty = true;
          renderUploadedFiles();
          toast(`Saved ${fileObj.name}`);
        }
      }
    }
  };
}
// ═══════ LINTER ═══════
window.pythonLinter = function (text, updateLinting, options, cm) {
  if (!pyReady || !window.pyodide) { updateLinting([]); return; }
  
  // Expose text to Pyodide
  window._lint_text_temp = text;
  
  try {
    const errorsStr = pyodide.runPython(`
def _get_lint_errors(text):
    import ast, json
    try:
        ast.parse(text)
        return '[]'
    except SyntaxError as e:
        msg = e.msg
        lineno = e.lineno - 1 if getattr(e, 'lineno', None) is not None else 0
        offset = e.offset - 1 if getattr(e, 'offset', None) is not None else 0
        # CM from/to expect line & ch
        res = [{
            "message": msg,
            "severity": "error",
            "from": {"line": lineno, "ch": offset},
            "to": {"line": lineno, "ch": offset + 1}
        }]
        return json.dumps(res)
    except Exception:
        return '[]'

_get_lint_errors(js._lint_text_temp)
    `);
    
    // updateLinting expects the array of annotations
    updateLinting(JSON.parse(errorsStr));
  } catch (e) {
    // Could fail if pyodide is busy executing a cell. Ignore.
    console.error("Linter error:", e);
    updateLinting([]);
  }
};
