// ═══════ APP INIT ═══════

function init() {
  migrateAssetsToDB(); // Start one-time migration background task

  if (typeof skip_homescreen !== 'undefined' && skip_homescreen) {
    // Skip home screen — go directly to editor with default profile
    document.getElementById('homeScreen').style.display = 'none';
    activePackageConfig = { packages: DEFAULT_PACKAGES };
    addSlide('title');
    slides[0].elements = [
      { type:'title', content:'Welcome to <b>SlidePy</b>', x:40, y:120, w:430, h:64, borderColor:'', bgColor:'', borderWidth:0, _bgHex:'#22222e', _bgAlpha:0 },
      { type:'subtitle', content:'Presentations powered by Python', x:40, y:184, w:430, h:50, borderColor:'', bgColor:'', borderWidth:0, _bgHex:'#22222e', _bgAlpha:0 }
    ];
    renderSidebar(); renderSlide(); setupDropZone();
    setTimeout(centerSlide, 10);
    initPyodide(activePackageConfig);
  } else {
    // Show home screen
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('homeScreen').style.display = 'flex';
    renderHomeScreen();
  }
}

document.addEventListener('keydown',(e)=>{
  if(document.body.classList.contains('presenting'))return;
  if(e.ctrlKey||e.metaKey){
    const inCM = e.target.closest('.cm-editor');
    if((e.key==='z'||e.key==='y')&&inCM) return; // let CodeMirror handle its own undo/redo
    if(e.key==='z'&&!e.shiftKey){e.preventDefault();undo();}
    if(e.key==='z'&&e.shiftKey){e.preventDefault();redo();}
    if(e.key==='y'){e.preventDefault();redo();}
    if(e.key==='s'){e.preventDefault();saveCurrentPresentation();}
  }
  if(e.key==='Delete'||e.key==='Backspace'){
    const a=document.activeElement;
    if(a&&(a.contentEditable==='true'||a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.closest('.CodeMirror')))return;
    // Delete background image when background layer is selected
    if(parseInt(selectedLayer)===0){
      const slide=slides[currentSlideIdx];
      if(slide&&slide.bgImage){e.preventDefault();saveUndo();delete slide.bgImage;delete slide.bgImageX;delete slide.bgImageY;delete slide.bgImageW;delete slide.bgImageH;renderSlide();}
      return;
    }
    if(selectedElIdx!==-1){e.preventDefault();removeElement(selectedElIdx);}
  }
});

init();
