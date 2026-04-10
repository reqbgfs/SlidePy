// ═══════ PYODIDE ═══════
async function initPyodide(config) {
  const ls = document.getElementById('loadingScreen');
  const lsBar = ls ? ls.querySelector('.loading-bar-fill') : null;
  const lsText = ls ? ls.querySelector('.loading-subtitle') : null;
  const pkgs = config && config.packages ? config.packages : DEFAULT_PACKAGES;
  try {
    if (lsText) lsText.textContent = 'Loading Python runtime...';
    pyodide = await loadPyodide({ indexURL:"https://cdn.jsdelivr.net/pyodide/v0.24.1/full/" });
    
    if (lsBar) { lsBar.style.animation = 'none'; lsBar.style.width = '40%'; }

    // Collect unique top-level package names for loadPackage
    const topLevelPkgs = [...new Set(pkgs.map(p => p.name.split('.')[0]).filter(n => n))];

    if (topLevelPkgs.length > 0) {
      if (lsText) lsText.textContent = `Installing packages (${topLevelPkgs.join(', ')})...`;
      // Try loading via pyodide.loadPackage first, fallback to micropip
      for (let i = 0; i < topLevelPkgs.length; i++) {
        const pName = topLevelPkgs[i];
        if (lsBar) lsBar.style.width = (40 + Math.floor(50 * (i / topLevelPkgs.length))) + '%';
        try {
          await pyodide.loadPackage(pName);
        } catch(e) {
          // Try micropip as fallback
          try {
            await pyodide.loadPackage('micropip');
            await pyodide.runPythonAsync(`import micropip; await micropip.install('${pName}')`);
          } catch(e2) {
            console.warn(`Could not install package: ${pName}`, e2);
          }
        }
      }
    }

    if (lsBar) lsBar.style.width = '90%';
    if (lsText) lsText.textContent = 'Configuring environment...';

    // Standard imports
    pyodide.runPython(`import sys, io`);

    // Import and alias each package
    for (const pkg of pkgs) {
      try {
        if (pkg.alias) {
          pyodide.runPython(`import ${pkg.name} as ${pkg.alias}`);
        } else {
          pyodide.runPython(`import ${pkg.name}`);
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

async function runCell(i) {
  if(!pyReady){toast('Python loading...');return;}
  const el=slides[currentSlideIdx].elements[i];
  const cm=codeMirrors[`cm_${currentSlideIdx}_${i}`]; if(cm) el.code=cm.getValue();
  const btn=document.getElementById(`runBtn_${i}`), out=document.getElementById(`output_${i}`);
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Running';
  out.innerHTML='<span style="color:var(--text-muted)">Executing...</span>';
  try {
    for(const[n,c] of Object.entries(uploadedPyFiles)){const mn=n.replace('.py','');pyodide.runPython(`import types,sys\nmod=types.ModuleType("${mn}")\nexec(${JSON.stringify(c)},mod.__dict__)\nsys.modules["${mn}"]=mod`);}
    pyodide.runPython(`import sys,io\n_buf=io.StringIO()\nsys.stdout=_buf\nsys.stderr=_buf\nplt.close('all')`);
    await pyodide.runPythonAsync(el.code);
    const hasPlot=pyodide.runPython(`len(plt.get_fignums())>0`);
    let html=''; const stdout=pyodide.runPython(`_buf.getvalue()`);
    if(stdout) html+=`<span class="stdout">${escHtml(stdout)}</span>`;
    if(hasPlot){const img=pyodide.runPython(`import base64\nbuf=io.BytesIO()\nplt.savefig(buf,format='png',dpi=120,bbox_inches='tight',facecolor='#1c1c26',edgecolor='none')\nbuf.seek(0)\nbase64.b64encode(buf.read()).decode('utf-8')`);html+=`<img src="data:image/png;base64,${img}">`;pyodide.runPython(`plt.close('all')`);}
    if(!html) html='<span style="color:var(--text-muted)">No output</span>';
    out.innerHTML=html; el.output=html;
    pyodide.runPython(`sys.stdout=sys.__stdout__;sys.stderr=sys.__stderr__`);
  } catch(e){ out.innerHTML=`<span class="error">${escHtml(e.message)}</span>`; el.output=out.innerHTML; try{pyodide.runPython(`sys.stdout=sys.__stdout__;sys.stderr=sys.__stderr__`);}catch(_){} }
  btn.disabled=false; btn.innerHTML='▶ Run';
}

function clearOutput(i) {
  const out=document.getElementById(`output_${i}`);
  if(out) out.innerHTML='<span style="color:var(--text-muted)">Run code to see output...</span>';
  slides[currentSlideIdx].elements[i].output='';
}

// ═══════ UPLOAD ═══════
function openUploadModal() { document.getElementById('uploadModal').classList.add('show'); }
function handlePyUpload(e) { Array.from(e.target.files).forEach(f=>{const r=new FileReader();r.onload=(re)=>{uploadedPyFiles[f.name]=re.target.result;renderUploadedFiles();toast(`Uploaded ${f.name}`);};r.readAsText(f);}); e.target.value=''; }
function renderUploadedFiles() { const l=document.getElementById('uploadedFilesList'); l.innerHTML=''; Object.keys(uploadedPyFiles).forEach(n=>{const d=document.createElement('div');d.className='uploaded-file-item';d.innerHTML=`<span>🐍 ${escHtml(n)}</span><button onclick="removePyFile('${escHtml(n)}')">✕</button>`;l.appendChild(d);}); }
function removePyFile(n) { delete uploadedPyFiles[n]; renderUploadedFiles(); toast(`Removed ${n}`); }
function setupDropZone() { const z=document.getElementById('uploadZone'); if(!z)return; z.ondragover=(e)=>{e.preventDefault();z.style.borderColor='var(--accent)';}; z.ondragleave=()=>{z.style.borderColor='';}; z.ondrop=(e)=>{e.preventDefault();z.style.borderColor='';Array.from(e.dataTransfer.files).filter(f=>f.name.endsWith('.py')).forEach(f=>{const r=new FileReader();r.onload=(re)=>{uploadedPyFiles[f.name]=re.target.result;renderUploadedFiles();toast(`Uploaded ${f.name}`);};r.readAsText(f);});}; }
