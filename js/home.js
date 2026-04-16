// ═══════ HOME SCREEN ═══════
const STORAGE_KEY = 'slidepy_presentations';
const PYODIDE_PACKAGES = [
  // Standard library (always available, no download needed)
  'math','os','sys','time','json','re','datetime','random','collections','itertools','functools',
  'abc','ast','asyncio','base64','bisect','calendar','cmath','copy','csv','dataclasses',
  'decimal','enum','fractions','glob','hashlib','heapq','html','http','io','logging',
  'operator','pathlib','pickle','platform','pprint','queue','shutil','signal','sqlite3',
  'statistics','string','struct','textwrap','traceback','typing','unittest','urllib',
  'uuid','warnings','weakref','xml','zipfile','zlib','lzma','ssl',
  // Third-party packages built into Pyodide 0.24.1
  'asciitree','astropy','atomicwrites','attrs','autograd','awkward-cpp',
  'bcrypt','beautifulsoup4','biopython','bitarray','bitstring','bleach',
  'bokeh','boost-histogram','brotli','cachetools','cartopy','certifi','cffi',
  'cftime','click','cligj','cloudpickle','cmyt','colorspacious','contourpy',
  'coolprop','coverage','cramjam','cryptography','cssselect','cycler','cytoolz',
  'decorator','demes','deprecation','docutils','exceptiongroup',
  'fastparquet','fiona','fonttools','freesasa','fsspec','future',
  'galpy','gensim','geopandas','gmpy2','gsw',
  'h5py','html5lib','idna','igraph','imageio','iniconfig',
  'jedi','jinja2','joblib','jsonschema','kiwisolver',
  'lazy-object-proxy','lazy_loader','lightgbm','logbook','lxml',
  'markupsafe','matplotlib','micropip','mne','more-itertools','mpmath',
  'msgpack','msprime','multidict','munch','mypy',
  'netcdf4','networkx','newick','nlopt','nltk','nose','numcodecs','numpy',
  'opencv-python','optlang','orjson','packaging','pandas','parso','patsy','peewee',
  'pillow','pillow_heif','pluggy','protobuf',
  'pyb2d','pyclipper','pycparser','pycryptodome','pydantic','pyerfa',
  'pygments','pyheif','pyinstrument','pynacl','pyparsing','pyproj',
  'pyrsistent','pyshp','pytest','pytest-benchmark',
  'python-dateutil','python-magic','python-sat','python_solvespace',
  'pytz','pywavelets','pyxel','pyyaml',
  'rebound','reboundx','regex','retrying','robotraconteur','ruamel.yaml',
  'scikit-image','scikit-learn','scipy','screed','setuptools',
  'shapely','simplejson','six','smart_open','soupsieve','sourmash',
  'sparseqr','sqlalchemy','statsmodels','svgwrite','swiglpk','sympy',
  'termcolor','texttable','threadpoolctl','tomli','tomli-w','toolz','tqdm',
  'traits','tskit','typing-extensions',
  'uncertainties','unyt','webencodings','wordcloud','wrapt',
  'xarray','xgboost','xlrd','xyzservices','yarl','yt','zarr',
];
const DEFAULT_PACKAGES = [
  { name: 'math', alias: '' },
  { name: 'numpy', alias: 'np' },
  { name: 'matplotlib', alias: '' },
  { name: 'matplotlib.pyplot', alias: 'plt' },
];

var activePackageConfig = null; // will hold final { packages: [{name, alias}] }
var wizardSelectedPkgs = [];
var activePresentationId = null; // Universal identifier for the current session
var isPackageEditMode = false;
var lastSavedSnapshot = null; // JSON snapshot to detect unsaved changes
var _filesDirty = false; // set true when files are added/removed without saving

function getSavedPresentations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { return []; }
}

function savePresentationsList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function renderHomeScreen() {
  const list = getSavedPresentations();
  const grid = document.getElementById('homeGrid');
  grid.innerHTML = '';

  // New presentation card
  const newCard = document.createElement('div');
  newCard.className = 'home-card home-card-new';
  newCard.innerHTML = `<div class="home-card-icon">+</div><div class="home-card-label">New Presentation</div>`;
  newCard.onclick = () => openWizard();
  grid.appendChild(newCard);

  // Import presentation card
  const importCard = document.createElement('div');
  importCard.className = 'home-card home-card-new';
  importCard.innerHTML = `<div class="home-card-icon">📥</div><div class="home-card-label">Import .pyslide</div>`;
  importCard.onclick = () => document.getElementById('importHomeFile').click();
  grid.appendChild(importCard);

  // Existing presentations
  list.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'home-card';
    const date = p.savedAt ? new Date(p.savedAt).toLocaleDateString() : '';
    const slideCount = p._slideCount !== undefined ? p._slideCount : (p.slides || []).length;
    const pkgCount = p._pkgCount !== undefined ? p._pkgCount : (p.packages || []).length;
    const storageLabel = GithubSync.isConnected() ? '💾 local + ☁ cloud' : '💾 localStorage';
    card.innerHTML = `
      <div class="home-card-preview"><div class="home-card-preview-text">Sp</div></div>
      <div class="home-card-info">
        <div class="home-card-name">${escHtml(p.name || 'Untitled')}</div>
        <div class="home-card-date">${date}</div>
        <div class="home-card-meta">${slideCount} slide${slideCount !== 1 ? 's' : ''} · ${pkgCount} pkg${pkgCount !== 1 ? 's' : ''} · <span title="Saved in browser storage and synced to GitHub">${storageLabel}</span></div>
      </div>
      <button class="home-card-delete" style="right: 36px; z-index: 10;" onclick="event.stopPropagation(); exportPresentation(${i})" title="Export">📤</button>
      <button class="home-card-delete" onclick="event.stopPropagation(); deletePresentation(${i})" title="Delete">✕</button>
    `;
    card.onclick = () => loadPresentation(i);
    grid.appendChild(card);
  });
}

async function deletePresentation(idx) {
  const list = getSavedPresentations();
  const p = list[idx];
  const name = p ? (p.name || 'Untitled') : 'Untitled';
  
  if (await showConfirm("Delete Presentation", `Are you sure you want to delete "${name}"? This action cannot be undone.`, "Delete Permanently")) {
    if (p && p.id) {
      await AssetDB.deletePresentation(p.id);
    }
    list.splice(idx, 1);
    savePresentationsList(list);
    renderHomeScreen();
    toast('Presentation deleted');
  }
}

async function loadPresentation(idx) {
  const list = getSavedPresentations();
  const meta = list[idx];
  if (!meta) return;
  
  if (!meta.id) { 
     meta.id = crypto.randomUUID();
     list[idx] = meta;
     savePresentationsList(list);
  }
  activePresentationId = meta.id;
  
  // Fetch full payload from IndexedDB
  let payload = await AssetDB.getPresentation(meta.id);
  
  // Fallback for presentations that haven't been migrated yet (if any)
  if (!payload && meta.slides) {
     payload = {
       slides: meta.slides,
       uploadedFiles: meta.uploadedFiles || {},
       packages: meta.packages || DEFAULT_PACKAGES
     };
  }

  if (payload) {
    slides = payload.slides || [];
    uploadedFiles = payload.uploadedFiles || {};
    activePackageConfig = { packages: payload.packages || meta.packages || DEFAULT_PACKAGES };
    
    // Re-hydrate uploadedFiles from AssetDB if they are markers
    for (const name in uploadedFiles) {
      if (uploadedFiles[name].data === '[stored_in_idb]') {
        const asset = await AssetDB.getAsset(name);
        if (asset) uploadedFiles[name].data = asset.data;
      }
    }
  } else {
    slides = [];
    uploadedFiles = {};
    activePackageConfig = { packages: DEFAULT_PACKAGES };
  }

  document.getElementById('presTitle').value = meta.name || 'Untitled';
  currentSlideIdx = 0; selectedElIdx = -1;
  customColorHistory = payload.customColorHistory || [];
  if (typeof renderCustomHistorySwatches === 'function') renderCustomHistorySwatches();
  lastSavedSnapshot = JSON.stringify({ slides, title: meta.name || 'Untitled' });
  _filesDirty = false;
  document.getElementById('homeScreen').classList.add('hidden');
  setTimeout(() => document.getElementById('homeScreen').style.display = 'none', 600);
  showLoadingAndInit();
  renderUploadedFiles();
  setTimeout(centerSlide, 100);
}

async function saveCurrentPresentation() {
  try {
    const list = getSavedPresentations();
    persistAll();
    const name = document.getElementById('presTitle').value || 'Untitled';
    
    if (!activePresentationId) {
      activePresentationId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : genId();
    }
    
    const existingIdx = list.findIndex(p => p.id === activePresentationId);
    
    // 1. Prepare Payload for IndexedDB
    const metadataFiles = {};
    for (const fName in uploadedFiles) {
      const f = uploadedFiles[fName];
      metadataFiles[fName] = { name: f.name, type: f.type, data: '[stored_in_idb]' };
      if (f.data && f.data.startsWith('data:')) {
        await AssetDB.saveAsset(fName, f.data, f.type);
      }
    }

    const payload = {
      slides: JSON.parse(JSON.stringify(slides)),
      uploadedFiles: metadataFiles,
      packages: activePackageConfig ? activePackageConfig.packages : DEFAULT_PACKAGES,
      customColorHistory: customColorHistory
    };

    // 2. Save heavy payload to IDB
    await AssetDB.savePresentation(activePresentationId, payload);

    // 3. Prepare Metadata for LocalStorage (Thin shell)
    const meta = {
      id: activePresentationId,
      name,
      savedAt: Date.now(),
      _slideCount: slides.length,
      _pkgCount: (activePackageConfig ? activePackageConfig.packages : []).length
    };

    if (existingIdx >= 0) list[existingIdx] = meta;
    else list.push(meta);
    savePresentationsList(list);
    lastSavedSnapshot = JSON.stringify({ slides, title: name });
    _filesDirty = false;
    toast('Saved Securely (IDB)');
  } catch (e) {
    console.error("Save Operation Failed:", e);
    toast('Save failed! See console.');
    // Check if it's a quota error on the fallback
    if (e.name === 'QuotaExceededError') {
      showAlert('Storage Full', "Local Storage is full. Please export your work to ZIP to prevent data loss!");
    }
  }
}

function hasUnsavedChanges() {
  if (_filesDirty) return true;
  if (lastSavedSnapshot === null) return false;
  persistAll();
  const current = JSON.stringify({ slides, title: document.getElementById('presTitle').value || 'Untitled' });
  return current !== lastSavedSnapshot;
}

function goHome() {
  if (hasUnsavedChanges()) {
    const modal = document.getElementById('unsavedChangesModal');
    document.getElementById('btnUnsavedCancel').onclick = () => closeModal('unsavedChangesModal');
    document.getElementById('btnUnsavedLeave').onclick = () => { closeModal('unsavedChangesModal'); finalizeGoHome(); };
    document.getElementById('btnUnsavedSave').onclick = () => {
      saveCurrentPresentation();
      closeModal('unsavedChangesModal');
      finalizeGoHome();
    };
    modal.classList.add('show');
    return;
  }
  finalizeGoHome();
}

function finalizeGoHome() {
  // Reset editor state
  activePresentationId = null;
  activePackageConfig = null;
  lastSavedSnapshot = null;
  _filesDirty = false;
  slides = []; uploadedFiles = {}; codeMirrors = {};
  selectedElIdx = -1; currentSlideIdx = 0;
  // Show home screen
  const hs = document.getElementById('homeScreen');
  hs.style.display = '';
  hs.classList.remove('hidden');
  renderHomeScreen();
}

async function exportPresentation(idx) {
  const list = getSavedPresentations();
  const meta = list[idx];
  if (!meta) return;

  const zip  = new JSZip();
  const name = meta.name || 'Untitled';

  // Fetch full payload from IDB (thin meta in localStorage has no slides/packages)
  let payload = await AssetDB.getPresentation(meta.id);
  if (!payload) {
    // Fallback for very old format where slides were stored directly on meta
    payload = {
      slides:             meta.slides             || [],
      uploadedFiles:      meta.uploadedFiles      || {},
      packages:           meta.packages           || DEFAULT_PACKAGES,
      customColorHistory: meta.customColorHistory || []
    };
  }

  const metadata = {
    name,
    slides:             payload.slides,
    packages:           payload.packages,
    customColorHistory: payload.customColorHistory || [],
    uploadedFiles:      {}
  };

  const assetsFolder = zip.folder("assets");
  const files = payload.uploadedFiles || {};

  for (const fName in files) {
    metadata.uploadedFiles[fName] = { name: fName, type: files[fName].type };
    const asset = await AssetDB.getAsset(fName);
    if (asset && asset.data && asset.data.startsWith('data:')) {
      const b64 = asset.data.split(',')[1];
      assetsFolder.file(fName, b64, { base64: true });
    }
  }

  zip.file("slides.json", JSON.stringify(metadata, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = name.replace(/\s+/g, '_') + '.pyslide.zip';
  a.click();
  URL.revokeObjectURL(url);
}

async function importPresentation(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const fName = file.name.toLowerCase();
  
  try {
    let p;
    if (fName.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(file);
      const slidesData = await zip.file("slides.json").async("string");
      p = JSON.parse(slidesData);
      
      const files = p.uploadedFiles || {};
      for (const name in files) {
        const assetFile = zip.file(`assets/${name}`);
        if (assetFile) {
          const b64 = await assetFile.async("base64");
          const ext = name.split('.').pop().toLowerCase();
          let mime = 'image/png';
          if (ext === 'mp4' || ext === 'webm') mime = `video/${ext}`;
          else if (ext === 'html') mime = 'text/html';
          else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
          
          const dataUrl = `data:${mime};base64,${b64}`;
          await AssetDB.saveAsset(name, dataUrl, files[name].type || 'binary');
          files[name].data = '[stored_in_idb]';
        }
      }
      p.uploadedFiles = files;
    } else {
      const text = await file.text();
      p = JSON.parse(text);
      // Migration for old JSON imports
      if (p.uploadedFiles) {
        for (const name in p.uploadedFiles) {
          const f = p.uploadedFiles[name];
          if (f.data && f.data.startsWith('data:')) {
            await AssetDB.saveAsset(name, f.data, f.type || 'binary');
            f.data = '[stored_in_idb]';
          }
        }
      }
    }

    const id       = crypto.randomUUID();
    const presName = p.name || p.title || 'Imported';

    // Save full payload to IDB (mirrors what saveCurrentPresentation does)
    const payload = {
      slides:             p.slides             || [],
      uploadedFiles:      p.uploadedFiles      || {},
      packages:           p.packages           || DEFAULT_PACKAGES,
      customColorHistory: p.customColorHistory || []
    };
    await AssetDB.savePresentation(id, payload);

    // Save thin meta to localStorage
    const meta = {
      id,
      name:        presName,
      savedAt:     Date.now(),
      _slideCount: payload.slides.length,
      _pkgCount:   (payload.packages || []).length
    };
    const list = getSavedPresentations();
    list.push(meta);
    savePresentationsList(list);
    renderHomeScreen();
    toast('Imported presentation!');
  } catch(err) {
    console.error(err);
    showAlert('Import Error', 'Invalid presentation file: ' + err.message);
  }
  event.target.value = '';
}

// ═══════ WIZARD ═══════
function openWizard() {
  isPackageEditMode = false;
  document.getElementById('wizardModal').style.display = 'flex';
  showWizardStep(1);
  document.getElementById('wizardName').value = '';
  document.getElementById('wizardName').focus();
  wizardSelectedPkgs = [];
}

function openPackageEditor() {
  isPackageEditMode = true;
  document.getElementById('wizardModal').style.display = 'flex';
  wizardSelectedPkgs = activePackageConfig ? activePackageConfig.packages.map(p => p.name) : [];
  
  document.querySelectorAll('.wizard-profile-btn').forEach(b => b.classList.remove('selected'));
  const profileC = document.getElementById('profileCustom');
  if (profileC) profileC.classList.add('selected');
  activeProfile = 'custom';
  
  renderPackageList();
  showWizardStep(3);
}

function closeWizard() {
  document.getElementById('wizardModal').style.display = 'none';
}

// Back button — closes wizard instead of going to earlier steps when editing
function wizardBack(fromStep) {
  if (isPackageEditMode) {
    closeWizard();
    return;
  }
  // Normal mode: go to the previous step
  showWizardStep(fromStep - 1);
}

function showWizardStep(n) {
  document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
  const step = document.getElementById('wizardStep' + n);
  if (step) step.classList.add('active');
}

function wizardNext1() {
  const name = document.getElementById('wizardName').value.trim();
  if (!name) { document.getElementById('wizardName').style.outline = '2px solid var(--red)'; return; }
  document.getElementById('wizardName').style.outline = '';
  showWizardStep(2);
}

function wizardSelectProfile(profile) {
  document.querySelectorAll('.wizard-profile-btn').forEach(b => b.classList.remove('selected'));
  event.target.closest('.wizard-profile-btn').classList.add('selected');

  if (profile === 'none') {
    activePackageConfig = { packages: [] };
  } else if (profile === 'default') {
    activePackageConfig = { packages: [...DEFAULT_PACKAGES] };
  } else {
    activePackageConfig = null; // custom, will be set in step 3
  }
}

function wizardNext2() {
  const sel = document.querySelector('.wizard-profile-btn.selected');
  if (!sel) return;
  const profile = sel.dataset.profile;
  
  if (profile === 'none') {
    activePackageConfig = { packages: [] };
  } else if (profile === 'default') {
    activePackageConfig = { packages: [...DEFAULT_PACKAGES] };
  } else if (profile === 'custom') {
    activePackageConfig = null;
  }

  if (profile === 'custom') {
    renderPackageList();
    showWizardStep(3);
  } else {
    wizardFinish();
  }
}

function renderPackageList() {
  const filter = (document.getElementById('wizardPkgSearch')?.value || '').toLowerCase();
  const list = document.getElementById('wizardPkgList');
  list.innerHTML = '';
  const sortedPkgs = [...PYODIDE_PACKAGES].sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  sortedPkgs.filter(p => p.toLowerCase().includes(filter)).forEach(name => {
    const checked = wizardSelectedPkgs.includes(name);
    const item = document.createElement('label');
    item.className = 'wizard-pkg-item' + (checked ? ' checked' : '');
    item.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleWizardPkg('${name}', this.checked)"><span>${name}</span>`;
    list.appendChild(item);
  });
}

async function fetchPyodidePackages() {
  const btn = document.getElementById('btnFetchPkgs');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

  const REPODATA_URL = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide-lock.json';

  try {
    let pkgs = null;

    // Primary: fetch via Pyodide's own HTTP module (bypasses file:// CORS restrictions)
    if (typeof pyodide !== 'undefined' && pyodide && pyReady) {
      try {
        const result = await pyodide.runPythonAsync(`
from pyodide.http import pyfetch
response = await pyfetch('${REPODATA_URL}')
data = await response.json()
list(data.get('packages', {}).keys())
        `);
        pkgs = result.toJs ? result.toJs() : Array.from(result);
      } catch(pyErr) {
        console.warn('Pyodide fetch failed, trying browser fetch:', pyErr);
      }
    }

    // Fallback: standard browser fetch (works when served over http/https)
    if (!pkgs) {
      const res = await fetch(REPODATA_URL);
      const data = await res.json();
      pkgs = Object.keys(data.packages || {});
    }

    if (pkgs && pkgs.length > 0) {
      pkgs.forEach(p => {
        if (!PYODIDE_PACKAGES.includes(p)) PYODIDE_PACKAGES.push(p);
      });
      renderPackageList();
      if (btn) { btn.textContent = `Loaded (${pkgs.length} packages)`; }
    } else {
      throw new Error('Empty package list');
    }
  } catch(e) {
    console.error('fetchPyodidePackages failed:', e);
    if (btn) { btn.textContent = 'Failed — check console'; btn.disabled = false; }
  }
}

function addManualPackage() {
  const inp = document.getElementById('wizardManualPkg');
  const val = inp.value.trim().toLowerCase();
  if (val) {
     if (!PYODIDE_PACKAGES.includes(val)) PYODIDE_PACKAGES.push(val);
     if (!wizardSelectedPkgs.includes(val)) wizardSelectedPkgs.push(val);
     inp.value = '';
     renderPackageList();
  }
}

function toggleWizardPkg(name, checked) {
  if (checked && !wizardSelectedPkgs.includes(name)) wizardSelectedPkgs.push(name);
  if (!checked) wizardSelectedPkgs = wizardSelectedPkgs.filter(n => n !== name);
  renderPackageList();
}

function wizardNext3() {
  if (wizardSelectedPkgs.length === 0) {
    activePackageConfig = { packages: [] };
    wizardFinish();
    return;
  }
  // Render alias step
  const list = document.getElementById('wizardAliasList');
  list.innerHTML = '';
  
  const finishBtn = document.getElementById('wizardFinishBtn');
  if (finishBtn) finishBtn.textContent = isPackageEditMode ? 'Update Environment' : 'Create Presentation →';
  
  wizardSelectedPkgs.forEach(name => {
    const row = document.createElement('div');
    row.className = 'wizard-alias-row';
    const existingAlias = (activePackageConfig && activePackageConfig.packages.find(p => p.name === name))?.alias || '';
    const importName = getImportName(name);
    row.innerHTML = `<span class="wizard-alias-name" style="font-family:'JetBrains Mono'">import ${importName} as</span>
      <input class="wizard-alias-input" data-pkg="${name}" placeholder="alias (optional)" value="${existingAlias}">`;
    list.appendChild(row);
  });
  showWizardStep(4);
}

function wizardFinish() {
  if (!activePackageConfig || isPackageEditMode) {
    // Build from custom selection + aliases
    const inputs = document.querySelectorAll('.wizard-alias-input');
    const packages = [];
    inputs.forEach(inp => {
      packages.push({ name: inp.dataset.pkg, alias: inp.value.trim() });
    });
    if (packages.length === 0 && wizardSelectedPkgs.length > 0) {
      wizardSelectedPkgs.forEach(name => packages.push({ name, alias: '' }));
    }
    activePackageConfig = { packages };
  }

  if (isPackageEditMode) {
      saveCurrentPresentation();
      closeWizard();
      if (typeof updatePyodideEnvironment === 'function') {
         updatePyodideEnvironment(activePackageConfig);
      }
      return;
  }

  closeWizard();
  // Setup new presentation
  const name = document.getElementById('wizardName').value.trim() || 'Untitled';
  slides = [];
  customColorHistory = [];
  if (typeof renderCustomHistorySwatches === 'function') renderCustomHistorySwatches();
  uploadedFiles = {};
  document.getElementById('presTitle').value = name;
  addSlide('title');
  slides[0].elements = [
    { type:'title', content:`<b>${escHtml(name)}</b>`, x:40, y:120, w:430, h:64, borderColor:'', bgColor:'', borderWidth:0, _bgHex:'#22222e', _bgAlpha:0 },
    { type:'subtitle', content:'Created with SlidePy', x:40, y:184, w:430, h:50, borderColor:'', bgColor:'', borderWidth:0, _bgHex:'#22222e', _bgAlpha:0 }
  ];
  currentSlideIdx = 0; selectedElIdx = -1;
  activePresentationId = crypto.randomUUID();
  saveCurrentPresentation(); // Register instantly for Python target caching

  document.getElementById('homeScreen').classList.add('hidden');
  setTimeout(() => document.getElementById('homeScreen').style.display = 'none', 600);
  showLoadingAndInit();
}

function showLoadingAndInit() {
  const ls = document.getElementById('loadingScreen');
  if (ls) { ls.classList.remove('hidden'); ls.style.display = ''; }
  renderSidebar(); renderSlide(); setupDropZone();
  initPyodide(activePackageConfig);
}

// ═══════ CLOUD SYNC UI ═══════
function openSyncModal() {
  document.getElementById('syncModal').classList.add('show');
  updateSyncUI();
}

function updateSyncUI() {
  const setup = document.getElementById('syncSetupView');
  const dash = document.getElementById('syncDashView');
  
  if (GithubSync.isConnected()) {
    setup.style.display = 'none';
    dash.style.display = 'block';
    document.getElementById('syncConnectedRepo').textContent = GithubSync.config.repo;
  } else {
    setup.style.display = 'block';
    dash.style.display = 'none';
    // Fill current inputs if they exist
    document.getElementById('syncRepo').value = GithubSync.config.repo;
    document.getElementById('syncToken').value = GithubSync.config.token;
  }
}

function toggleSyncHelp() {
  const panel = document.getElementById('syncHelp');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function connectGithub() {
  const token = document.getElementById('syncToken').value.trim();
  const repoInput = document.getElementById('syncRepo');
  const repoDropdown = document.getElementById('syncRepoDropdown');
  const repoSelectContainer = document.getElementById('syncRepoSelect');

  if (!token) { toast('Please enter your token'); return; }

  const btn = document.querySelector('#syncSetupView .primary');
  btn.disabled = true; btn.textContent = 'Verifying...';

  try {
    // 1. Temporarily save token to test discovery
    GithubSync.config.token = token;

    // 2. Discover repos if no repo is selected yet
    if (repoSelectContainer.style.display === 'none' && repoInput.style.display === 'none') {
      const repos = await GithubSync.fetchAccessibleRepos();
      
      if (repos.length === 0) {
        throw new Error('No repositories found. Ensure your token has "Metadata" (read) and "Contents" permissions.');
      }

      if (repos.length === 1) {
        // Magical auto-selection!
        GithubSync.saveConfig(token, repos[0].full_name);
        await finishConnection();
      } else {
        // Multi-repo: show dropdown
        repoSelectContainer.style.display = 'block';
        repoDropdown.innerHTML = repos.map(r => `<option value="${r.full_name}">${r.full_name}</option>`).join('');
        repoInput.style.display = 'block'; // Also show manual just in case
        btn.textContent = 'Connect Selected';
        toast('Multiple repositories found. Please choose one.');
      }
    } else {
      // 3. User has selected or typed a repo
      const selectedRepo = repoDropdown.style.display !== 'none' && repoDropdown.value 
        ? repoDropdown.value 
        : repoInput.value.trim();
        
      if (!selectedRepo) throw new Error('Please select or enter a repository name.');
      
      GithubSync.saveConfig(token, selectedRepo);
      await finishConnection();
    }
  } catch (e) {
    GithubSync.clearConfig();
    showAlert('Discovery Error', 'Discovery failed: ' + e.message);
  } finally {
    btn.disabled = false; 
    if (btn.textContent === 'Verifying...') btn.textContent = 'Connect';
  }

  async function finishConnection() {
    await GithubSync.apiCall(); // Final verification of access to the file/repo
    updateSyncUI();
    toast('Connected to GitHub!');
  }
}
async function disconnectGithub() {
  if (await showConfirm("Disconnect GitHub", "Are you sure you want to disconnect from this repository? Your local data will remain, but cloud sync will be disabled.", "Disconnect")) {
    finalizeDisconnect();
    toast('Disconnected from GitHub');
  }
}

function finalizeDisconnect() {
  GithubSync.clearConfig();
  updateSyncUI();
}
