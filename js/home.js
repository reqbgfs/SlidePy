// ═══════ HOME SCREEN ═══════
const STORAGE_KEY = 'slidepy_presentations';
const PYODIDE_PACKAGES = [
  'math','os','sys','time','json','re','datetime','random','collections','itertools','functools',
  'beautifulsoup4','matplotlib','matplotlib.pyplot','micropip','networkx','numpy','pandas','Pillow',
  'scikit-learn','scipy','sympy','opencv-python'
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
    const slideCount = (p.slides || []).length;
    const pkgCount = (p.packages || []).length;
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

function deletePresentation(idx) {
  const btn = document.getElementById('btnConfirmDelete');
  btn.onclick = () => {
    const list = getSavedPresentations();
    list.splice(idx, 1);
    savePresentationsList(list);
    renderHomeScreen();
    closeModal('deleteConfirmModal');
    toast('Presentation deleted');
  };
  document.getElementById('deleteConfirmModal').classList.add('show');
}

function loadPresentation(idx) {
  const list = getSavedPresentations();
  const p = list[idx];
  if (!p) return;
  
  if (!p.id) { 
     p.id = crypto.randomUUID();
     list[idx] = p;
     savePresentationsList(list);
  }
  activePresentationId = p.id;
  
  slides = p.slides || [];
  uploadedPyFiles = p.uploadedPyFiles || {};
  document.getElementById('presTitle').value = p.name || 'Untitled';
  currentSlideIdx = 0; selectedElIdx = -1;
  activePackageConfig = { packages: p.packages || DEFAULT_PACKAGES };
  lastSavedSnapshot = JSON.stringify({ slides, title: p.name || 'Untitled' });
  document.getElementById('homeScreen').classList.add('hidden');
  setTimeout(() => document.getElementById('homeScreen').style.display = 'none', 600);
  showLoadingAndInit();
}

function saveCurrentPresentation() {
  const list = getSavedPresentations();
  persistAll();
  const name = document.getElementById('presTitle').value || 'Untitled';
  
  if (!activePresentationId) activePresentationId = crypto.randomUUID();
  
  const existing = list.findIndex(p => p.id === activePresentationId);
  const data = {
    id: activePresentationId,
    name,
    slides: JSON.parse(JSON.stringify(slides)),
    uploadedPyFiles: { ...uploadedPyFiles },
    packages: activePackageConfig ? activePackageConfig.packages : DEFAULT_PACKAGES,
    savedAt: Date.now()
  };
  if (existing >= 0) list[existing] = data;
  else list.push(data);
  savePresentationsList(list);
  lastSavedSnapshot = JSON.stringify({ slides, title: name });
  toast('Presentation saved!');
}

function hasUnsavedChanges() {
  persistAll();
  const current = JSON.stringify({ slides, title: document.getElementById('presTitle').value || 'Untitled' });
  return lastSavedSnapshot !== null && current !== lastSavedSnapshot;
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
  slides = []; uploadedPyFiles = {}; codeMirrors = {};
  selectedElIdx = -1; currentSlideIdx = 0;
  // Show home screen
  const hs = document.getElementById('homeScreen');
  hs.style.display = '';
  hs.classList.remove('hidden');
  renderHomeScreen();
}

function exportPresentation(idx) {
  const list = getSavedPresentations();
  const p = list[idx];
  if (!p) return;
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (p.name || 'presentation').replace(/\s+/g, '_') + '.pyslide';
  a.click();
  URL.revokeObjectURL(url);
}

function importPresentation(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const p = JSON.parse(e.target.result);
      p.id = crypto.randomUUID(); // force new ID to prevent IDBFS overlap
      p.savedAt = Date.now();
      const list = getSavedPresentations();
      list.push(p);
      savePresentationsList(list);
      renderHomeScreen();
      toast('Imported presentation!');
    } catch(err) {
      alert('Invalid presentation file.');
    }
  };
  reader.readAsText(file);
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
    row.innerHTML = `<span class="wizard-alias-name" style="font-family:'JetBrains Mono'">import ${name} as</span>
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
  uploadedPyFiles = {};
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
    alert('Discovery failed: ' + e.message);
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
  const modal = document.getElementById('disconnectConfirmModal');
  const titleObj = document.getElementById('disconnectTitle');
  const msgObj = document.getElementById('disconnectMsg');
  const btnsObj = document.getElementById('disconnectBtns');
  
  if (hasUnsavedChanges()) {
    titleObj.textContent = 'Unsaved Changes';
    msgObj.textContent = 'You have unsaved changes. Would you like to save and UPLOAD them before disconnecting?';
    btnsObj.innerHTML = `
      <button class="modal-btn" onclick="closeModal('disconnectConfirmModal')">Cancel</button>
      <button class="modal-btn" style="background:var(--red); border-color:var(--red)" id="btnDisconnectAnyway">Disconnect Anyway</button>
      <button class="modal-btn primary" id="btnDisconnectUpload">Upload & Disconnect</button>
    `;
    document.getElementById('btnDisconnectAnyway').onclick = () => {
      closeModal('disconnectConfirmModal');
      finalizeDisconnect();
    };
    document.getElementById('btnDisconnectUpload').onclick = async () => {
      closeModal('disconnectConfirmModal');
      try {
        await GithubSync.upload();
        finalizeDisconnect();
      } catch (e) {
        // Option to fail if upload failed
        const failedModal = document.getElementById('disconnectConfirmModal');
        document.getElementById('disconnectTitle').textContent = 'Upload Failed';
        document.getElementById('disconnectMsg').textContent = 'Cloud upload failed. Disconnect anyway?';
        document.getElementById('disconnectBtns').innerHTML = `
          <button class="modal-btn" onclick="closeModal('disconnectConfirmModal')">Cancel</button>
          <button class="modal-btn primary" style="background:var(--red); border-color:var(--red)" onclick="closeModal('disconnectConfirmModal'); finalizeDisconnect();">Disconnect</button>
        `;
        failedModal.classList.add('show');
      }
    };
  } else {
    titleObj.textContent = 'Disconnect Repository?';
    msgObj.textContent = 'Are you sure you want to disconnect from this repository?';
    btnsObj.innerHTML = `
      <button class="modal-btn" onclick="closeModal('disconnectConfirmModal')">Cancel</button>
      <button class="modal-btn primary" style="background:var(--red); border-color:var(--red)" onclick="closeModal('disconnectConfirmModal'); finalizeDisconnect();">Disconnect</button>
    `;
  }
  modal.classList.add('show');
}

function finalizeDisconnect() {
  GithubSync.clearConfig();
  updateSyncUI();
}
