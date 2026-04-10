// ═══════ HOME SCREEN ═══════
const STORAGE_KEY = 'slidepy_presentations';
const PYODIDE_PACKAGES = [
  'beautifulsoup4','biopython','bleach','cycler','cssselect','decorator',
  'docutils','html5lib','imageio','jedi','Jinja2','jsonschema','kiwisolver',
  'lxml','MarkupSafe','matplotlib','micropip','mne','mpmath','networkx',
  'nltk','numpy','openpyxl','packaging','pandas','Pillow','pluggy',
  'pycparser','pyparsing','pyrsistent','python-dateutil','pytz','pyyaml',
  'regex','scikit-learn','scipy','setuptools','six','sqlalchemy','statsmodels',
  'sympy','tomli','uncertainties','xlrd'
];
const DEFAULT_PACKAGES = [
  { name: 'numpy', alias: 'np' },
  { name: 'matplotlib', alias: '' },
  { name: 'matplotlib.pyplot', alias: 'plt' },
];

var activePackageConfig = null; // will hold final { packages: [{name, alias}] }
var wizardSelectedPkgs = [];

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

  // Existing presentations
  list.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'home-card';
    const date = p.savedAt ? new Date(p.savedAt).toLocaleDateString() : '';
    card.innerHTML = `
      <div class="home-card-preview"><div class="home-card-preview-text">Sp</div></div>
      <div class="home-card-info">
        <div class="home-card-name">${escHtml(p.name || 'Untitled')}</div>
        <div class="home-card-date">${date}</div>
      </div>
      <button class="home-card-delete" onclick="event.stopPropagation(); deletePresentation(${i})" title="Delete">✕</button>
    `;
    card.onclick = () => loadPresentation(i);
    grid.appendChild(card);
  });
}

function deletePresentation(idx) {
  if (!confirm('Delete this presentation?')) return;
  const list = getSavedPresentations();
  list.splice(idx, 1);
  savePresentationsList(list);
  renderHomeScreen();
}

function loadPresentation(idx) {
  const list = getSavedPresentations();
  const p = list[idx];
  if (!p) return;
  slides = p.slides || [];
  uploadedPyFiles = p.uploadedPyFiles || {};
  document.getElementById('presTitle').value = p.name || 'Untitled';
  currentSlideIdx = 0; selectedElIdx = -1;
  activePackageConfig = { packages: p.packages || DEFAULT_PACKAGES };
  document.getElementById('homeScreen').classList.add('hidden');
  setTimeout(() => document.getElementById('homeScreen').style.display = 'none', 600);
  showLoadingAndInit();
}

function saveCurrentPresentation() {
  const list = getSavedPresentations();
  persistAll();
  const name = document.getElementById('presTitle').value || 'Untitled';
  const existing = list.findIndex(p => p.name === name);
  const data = {
    name,
    slides: JSON.parse(JSON.stringify(slides)),
    uploadedPyFiles: { ...uploadedPyFiles },
    packages: activePackageConfig ? activePackageConfig.packages : DEFAULT_PACKAGES,
    savedAt: Date.now()
  };
  if (existing >= 0) list[existing] = data;
  else list.push(data);
  savePresentationsList(list);
  toast('Presentation saved!');
}

// ═══════ WIZARD ═══════
function openWizard() {
  document.getElementById('wizardModal').style.display = 'flex';
  showWizardStep(1);
  document.getElementById('wizardName').value = '';
  document.getElementById('wizardName').focus();
  wizardSelectedPkgs = [];
}

function closeWizard() {
  document.getElementById('wizardModal').style.display = 'none';
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
  PYODIDE_PACKAGES.filter(p => p.toLowerCase().includes(filter)).forEach(name => {
    const checked = wizardSelectedPkgs.includes(name);
    const item = document.createElement('label');
    item.className = 'wizard-pkg-item' + (checked ? ' checked' : '');
    item.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleWizardPkg('${name}', this.checked)"><span>${name}</span>`;
    list.appendChild(item);
  });
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
  wizardSelectedPkgs.forEach(name => {
    const row = document.createElement('div');
    row.className = 'wizard-alias-row';
    row.innerHTML = `<span class="wizard-alias-name">${name}</span>
      <span class="wizard-alias-arrow">→</span>
      <input class="wizard-alias-input" data-pkg="${name}" placeholder="alias (optional)" value="">`;
    list.appendChild(row);
  });
  showWizardStep(4);
}

function wizardFinish() {
  if (!activePackageConfig) {
    // Build from custom selection + aliases
    const inputs = document.querySelectorAll('.wizard-alias-input');
    const packages = [];
    inputs.forEach(inp => {
      packages.push({ name: inp.dataset.pkg, alias: inp.value.trim() });
    });
    if (packages.length === 0) {
      wizardSelectedPkgs.forEach(name => packages.push({ name, alias: '' }));
    }
    activePackageConfig = { packages };
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
