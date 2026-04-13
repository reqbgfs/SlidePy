// ═══════ STATE ═══════
var slides = [], currentSlideIdx = 0, pyodide = null, pyReady = false;
var uploadedFiles = {}, codeMirrors = {}, ctxSlideIdx = -1;
var undoStack = [], redoStack = [], selectedElIdx = -1;
var workspaceZoom = 1.0;

function genId() { return 's'+Date.now()+Math.random().toString(36).substr(2,5); }

// ═══════ UNDO ═══════
function saveUndo() { 
  persistAll(); 
  undoStack.push(JSON.stringify(slides)); 
  if(undoStack.length>50) undoStack.shift(); 
  redoStack=[]; 
}

function undo() { 
  if(!undoStack.length) return; 
  redoStack.push(JSON.stringify(slides)); 
  slides=JSON.parse(undoStack.pop()); 
  if(currentSlideIdx>=slides.length) currentSlideIdx=slides.length-1; 
  selectedElIdx=-1; 
  renderSidebar(); 
  renderSlide(); 
}

function redo() { 
  if(!redoStack.length) return; 
  undoStack.push(JSON.stringify(slides)); 
  slides=JSON.parse(redoStack.pop()); 
  selectedElIdx=-1; 
  renderSidebar(); 
  renderSlide(); 
}

function persistAll() {
  const slide = slides[currentSlideIdx]; if(!slide) return;
  slide.elements.forEach((el, i) => {
    if (el.type==='jupyter') { const cm=codeMirrors[`cm_${currentSlideIdx}_${i}`]; if(cm) el.code=cm.getValue(); }
    const ce = document.querySelector(`[data-el-idx="${i}"] .text-element-content`);
    if (ce && (el.type==='title'||el.type==='subtitle'||el.type==='body')) el.content = ce.innerHTML;
  });
}

function escHtml(s) { 
  const d=document.createElement('div'); d.textContent=s; return d.innerHTML; 
}

function isLightColor(hex) { 
  const c=hex.replace('#',''); 
  return(parseInt(c.substr(0,2),16)*299+parseInt(c.substr(2,2),16)*587+parseInt(c.substr(4,2),16)*114)/1000>180; 
}

function toast(m) { 
  const t=document.getElementById('toast'); 
  t.textContent=m; t.classList.add('show'); 
  setTimeout(()=>t.classList.remove('show'),2500); 
}

function hexToRgba(h,a) { 
  const c=h.replace('#',''); 
  return`rgba(${parseInt(c.substr(0,2),16)},${parseInt(c.substr(2,2),16)},${parseInt(c.substr(4,2),16)},${a})`; 
}

function rgbaToHex(r) { 
  if(!r)return''; 
  const m=r.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); 
  if(!m)return r; 
  return'#'+[m[1],m[2],m[3]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join(''); 
}
