// ═══════ DRAG, RESIZE & SNAPPING ENGINE ═══════
const SNAP_DIST = 5;
const CANVAS_W = 960;
const CANVAS_H = 540;
const BORDER_SNAP_MARGIN = 40;
const ELEMENT_GAP = 20;
const MIN_JUPYTER_W = (CANVAS_W - 2 * BORDER_SNAP_MARGIN) / 2; // 440
const MIN_JUPYTER_H = (CANVAS_H - 2 * BORDER_SNAP_MARGIN) / 2; // 230

function selectEl(idx) { 
  if(selectedElIdx!==idx){ 
    if (typeof closeColorPalette === 'function') closeColorPalette();
    persistAll(); 
    selectedElIdx=idx; 
    renderSlide(); 
  } 
}

function clearGuides() {
  document.querySelectorAll('.snap-guide').forEach(e => e.remove());
}

function showGuide(axis, pos) {
  const canvas = document.getElementById('slideCanvas');
  const g = document.createElement('div');
  g.className = `snap-guide snap-guide-${axis}`;
  if (axis === 'v') { g.style.left = pos + 'px'; g.style.height = '100%'; }
  if (axis === 'h') { g.style.top = pos + 'px'; g.style.width = '100%'; }
  canvas.appendChild(g);
}

function getRect(el) {
  return { l: el.x, r: el.x + el.w, t: el.y, b: el.y + el.h };
}

function checkOverlap(testRect, skipIdx) {
  const els = slides[currentSlideIdx].elements;
  const skipEl = els[skipIdx];
  const skipLevel = skipEl ? (skipEl.level !== undefined ? skipEl.level : 1) : 1;
  for (let i = 0; i < els.length; i++) {
    if (i === skipIdx) continue;
    const e = els[i];
    if ((e.level !== undefined ? e.level : 1) !== skipLevel) continue;
    // Multimedia elements are allowed to overlap as backgrounds or layers
    if (e.type === 'image' || (skipEl && skipEl.type === 'image')) continue;
    // jupyter-output always overlaps its linked input by design — skip for collision
    if (e.type === 'jupyter-output') continue;
    const r = getRect(e);
    const overlap = !(testRect.r <= r.l || testRect.l >= r.r || testRect.b <= r.t || testRect.t >= r.b);
    if (overlap) return true;
  }
  return false;
}

function snapValue(val, target) {
  if (Math.abs(val - target) <= SNAP_DIST) return target;
  return null;
}

function findSnapPos(elRect, skipIdx, resizeCorner = null) {
  const els = slides[currentSlideIdx].elements;
  let snappedX = null, snappedY = null;
  let guideX = null, guideY = null;

  const gridX = [CANVAS_W / 4, CANVAS_W / 2, (CANVAS_W / 4) * 3];
  const gridY = [CANVAS_H / 4, CANVAS_H / 2, (CANVAS_H / 4) * 3];

  // Center of element
  const elCx = elRect.l + (elRect.r - elRect.l) / 2;
  const elCy = elRect.t + (elRect.b - elRect.t) / 2;

  const checkGrid = (val, guides) => {
    for (let g of guides) {
      let s = snapValue(val, g);
      if (s !== null) return s;
    }
    return null;
  };

  // Grid Snaps (1/4, 1/2, 3/4)
  if (!resizeCorner) {
    // Centers
    let sx = checkGrid(elCx, gridX);
    if (sx !== null) { snappedX = sx - ((elRect.r - elRect.l) / 2); guideX = sx; }
    let sy = checkGrid(elCy, gridY);
    if (sy !== null) { snappedY = sy - ((elRect.b - elRect.t) / 2); guideY = sy; }

    // Left and Right edges
    let sxL = checkGrid(elRect.l, gridX);
    if (sxL !== null) { snappedX = sxL; guideX = sxL; }
    let sxR = checkGrid(elRect.r, gridX);
    if (sxR !== null) { snappedX = sxR - (elRect.r - elRect.l); guideX = sxR; }
    
    // Top and Bottom edges
    let syT = checkGrid(elRect.t, gridY);
    if (syT !== null) { snappedY = syT; guideY = syT; }
    let syB = checkGrid(elRect.b, gridY);
    if (syB !== null) { snappedY = syB - (elRect.b - elRect.t); guideY = syB; }
  } else if (resizeCorner === 'se') {
    let sx = checkGrid(elRect.r, gridX);
    if (sx !== null) { snappedX = sx; guideX = sx; }
    let sy = checkGrid(elRect.b, gridY);
    if (sy !== null) { snappedY = sy; guideY = sy; }
  } else if (resizeCorner === 'nw') {
    let sx = checkGrid(elRect.l, gridX);
    if (sx !== null) { snappedX = sx; guideX = sx; }
    let sy = checkGrid(elRect.t, gridY);
    if (sy !== null) { snappedY = sy; guideY = sy; }
  }

  // Distance from border (40px)
  if (!resizeCorner) {
    if (snapValue(elRect.l, BORDER_SNAP_MARGIN) !== null) { snappedX = BORDER_SNAP_MARGIN; guideX = BORDER_SNAP_MARGIN; }
    if (snapValue(elRect.r, CANVAS_W - BORDER_SNAP_MARGIN) !== null) { snappedX = CANVAS_W - BORDER_SNAP_MARGIN - (elRect.r - elRect.l); guideX = CANVAS_W - BORDER_SNAP_MARGIN; }
    if (snapValue(elRect.t, BORDER_SNAP_MARGIN) !== null) { snappedY = BORDER_SNAP_MARGIN; guideY = BORDER_SNAP_MARGIN; }
    if (snapValue(elRect.b, CANVAS_H - BORDER_SNAP_MARGIN) !== null) { snappedY = CANVAS_H - BORDER_SNAP_MARGIN - (elRect.b - elRect.t); guideY = CANVAS_H - BORDER_SNAP_MARGIN; }
  } else if (resizeCorner === 'se') {
    if (snapValue(elRect.r, CANVAS_W - BORDER_SNAP_MARGIN) !== null) { snappedX = CANVAS_W - BORDER_SNAP_MARGIN; guideX = CANVAS_W - BORDER_SNAP_MARGIN; }
    if (snapValue(elRect.b, CANVAS_H - BORDER_SNAP_MARGIN) !== null) { snappedY = CANVAS_H - BORDER_SNAP_MARGIN; guideY = CANVAS_H - BORDER_SNAP_MARGIN; }
    // Snap for Two Column
    if (snapValue(elRect.r - elRect.l, (CANVAS_W/2) - BORDER_SNAP_MARGIN) !== null) { snappedX = elRect.l + (CANVAS_W/2) - BORDER_SNAP_MARGIN; guideX = snappedX; }
  } else if (resizeCorner === 'nw') {
    if (snapValue(elRect.l, BORDER_SNAP_MARGIN) !== null) { snappedX = BORDER_SNAP_MARGIN; guideX = BORDER_SNAP_MARGIN; }
    if (snapValue(elRect.t, BORDER_SNAP_MARGIN) !== null) { snappedY = BORDER_SNAP_MARGIN; guideY = BORDER_SNAP_MARGIN; }
  }

  // Snap to other elements
  for (let i = 0; i < els.length; i++) {
    if (i === skipIdx) continue;
    const r = getRect(els[i]);
    const rCx = r.l + (r.r - r.l) / 2;
    const rCy = r.t + (r.b - r.t) / 2;
    
    if (!resizeCorner) {
      // Lefts align
      let x = snapValue(elRect.l, r.l);
      if (x !== null) { snappedX = x; guideX = x; }
      // Rights align
      x = snapValue(elRect.r, r.r);
      if (x !== null) { snappedX = x - (elRect.r - elRect.l); guideX = x; }
      // Center horizontally align
      x = snapValue(elCx, rCx);
      if (x !== null) { snappedX = x - ((elRect.r - elRect.l) / 2); guideX = x; }
      
      // Distance gaps (horizontal)
      x = snapValue(elRect.r, r.l - ELEMENT_GAP);
      if (x !== null) { snappedX = x - (elRect.r - elRect.l); guideX = x; }
      x = snapValue(elRect.l, r.r + ELEMENT_GAP);
      if (x !== null) { snappedX = x; guideX = x; }

      // Tops align
      let y = snapValue(elRect.t, r.t);
      if (y !== null) { snappedY = y; guideY = y; }
      // Bottoms align
      y = snapValue(elRect.b, r.b);
      if (y !== null) { snappedY = y - (elRect.b - elRect.t); guideY = y; }
      // Center vertically align
      y = snapValue(elCy, rCy);
      if (y !== null) { snappedY = y - ((elRect.b - elRect.t) / 2); guideY = y; }
      
      // Distance gaps (vertical)
      y = snapValue(elRect.b, r.t - ELEMENT_GAP);
      if (y !== null) { snappedY = y - (elRect.b - elRect.t); guideY = y; }
      y = snapValue(elRect.t, r.b + ELEMENT_GAP);
      if (y !== null) { snappedY = y; guideY = y; }

    } else if (resizeCorner === 'se') {
      // Rights align
      let x = snapValue(elRect.r, r.r);
      if (x !== null) { snappedX = x; guideX = x; }
      // Right to Left align
      x = snapValue(elRect.r, r.l);
      if (x !== null) { snappedX = x; guideX = x; }
      // Distance gap (right snapping to left of target)
      x = snapValue(elRect.r, r.l - ELEMENT_GAP);
      if (x !== null) { snappedX = x; guideX = x; }
      
      // Bottoms align
      let y = snapValue(elRect.b, r.b);
      if (y !== null) { snappedY = y; guideY = y; }
      // Bottom to Top align
      y = snapValue(elRect.b, r.t);
      if (y !== null) { snappedY = y; guideY = y; }
      // Distance gap (bottom snapping to top of target)
      y = snapValue(elRect.b, r.t - ELEMENT_GAP);
      if (y !== null) { snappedY = y; guideY = y; }
    } else if (resizeCorner === 'nw') {
      // Lefts align
      let x = snapValue(elRect.l, r.l);
      if (x !== null) { snappedX = x; guideX = x; }
      // Left to Right align
      x = snapValue(elRect.l, r.r);
      if (x !== null) { snappedX = x; guideX = x; }
      // Distance gap (left snapping to right of target)
      x = snapValue(elRect.l, r.r + ELEMENT_GAP);
      if (x !== null) { snappedX = x; guideX = x; }
      
      // Tops align
      let y = snapValue(elRect.t, r.t);
      if (y !== null) { snappedY = y; guideY = y; }
      // Top to Bottom align
      y = snapValue(elRect.t, r.b);
      if (y !== null) { snappedY = y; guideY = y; }
      // Distance gap (top snapping to bottom of target)
      y = snapValue(elRect.t, r.b + ELEMENT_GAP);
      if (y !== null) { snappedY = y; guideY = y; }
    }
  }

  return { snappedX, snappedY, guideX, guideY };
}

function startDrag(e, idx) {
  const el = slides[currentSlideIdx].elements[idx];
  const canvas = document.getElementById('slideCanvas');
  const rect = canvas.getBoundingClientRect();
  const ox = (e.clientX - rect.left) / workspaceZoom - el.x;
  const oy = (e.clientY - rect.top) / workspaceZoom - el.y;
  const wr = document.querySelector(`[data-el-idx="${idx}"]`);
  
  if(wr) wr.classList.add('dragging-el');
  if(canvas) canvas.classList.add('resizing-mode');
  
  const originalX = el.x;
  const originalY = el.y;

  const onMove = (ev) => { 
    clearGuides();
    // Base movement with CANVAS borders limits
    let targetX = Math.round((ev.clientX - rect.left) / workspaceZoom - ox);
    let targetY = Math.round((ev.clientY - rect.top) / workspaceZoom - oy);
    
    // Only clamp if not a media box
    if (el.type !== 'image') {
      targetX = Math.max(0, Math.min(CANVAS_W - el.w, targetX));
      targetY = Math.max(0, Math.min(CANVAS_H - el.h, targetY));
    }    
    // Check Snapping
    const snap = findSnapPos({ l: targetX, r: targetX + el.w, t: targetY, b: targetY + el.h }, idx, null);
    if (snap.snappedX !== null) { targetX = snap.snappedX; showGuide('v', snap.guideX); }
    if (snap.snappedY !== null) { targetY = snap.snappedY; showGuide('h', snap.guideY); }

    // Enforce Overlap Lock
    const isOverlap = checkOverlap({ l: targetX, r: targetX + el.w, t: targetY, b: targetY + el.h }, idx);
    if (!isOverlap) {
      el.x = targetX;
      el.y = targetY;
      if (wr) { wr.style.left = el.x + 'px'; wr.style.top = el.y + 'px'; }
      // Mirror position to linked jupyter-output wrapper
      if (el.type === 'jupyter-input' && el.linkId) {
        const els = slides[currentSlideIdx].elements;
        const outIdx = els.findIndex((e, j) => j !== idx && e.linkId === el.linkId && e.type === 'jupyter-output');
        if (outIdx !== -1) {
          const outWr = document.querySelector(`[data-el-idx="${outIdx}"]`);
          if (outWr) { outWr.style.left = el.x + 'px'; outWr.style.top = el.y + 'px'; }
        }
      }
    }
  };

  const onUp = () => {
    clearGuides();
    updateWorkspaceBounds();
    if (wr) wr.classList.remove('dragging-el');
    if (canvas) canvas.classList.remove('resizing-mode');
    document.removeEventListener('mousemove', onMove); 
    document.removeEventListener('mouseup', onUp); 
  };
  
  document.addEventListener('mousemove', onMove); 
  document.addEventListener('mouseup', onUp);
}

// Compute continuous propagation networks for physics logic
function getSlackGraph(els, dir, skipIdx) {
  let N = els.length;
  let adj = Array.from({length: N}, () => []);
  for (let u = 0; u < N; u++) {
    for (let v = 0; v < N; v++) {
      if (u === v || v === skipIdx) continue;
      
      const elU = els[u];
      const elV = els[v];
      // jupyter-output cells are always mirrored to their input — exclude from cascade
      if (elU.type === 'jupyter-output' || elV.type === 'jupyter-output') continue;
      if ((elU.level !== undefined ? elU.level : 1) !== (elV.level !== undefined ? elV.level : 1)) continue;
      
      if (dir === 'right') {
        if (!(elU.y >= elV.y + elV.h || elU.y + elU.h <= elV.y)) {
          if (elV.x >= elU.x) { 
            let dist = elV.x - (elU.x + elU.w);
            let gap = Math.min(ELEMENT_GAP, dist);
            let slack = Math.max(0, dist - gap);
            adj[u].push({ to: v, slack: slack });
          }
        }
      } else if (dir === 'left') {
        if (!(elU.y >= elV.y + elV.h || elU.y + elU.h <= elV.y)) {
          if (elV.x + elV.w <= elU.x + elU.w) { 
            let dist = elU.x - (elV.x + elV.w);
            let gap = Math.min(ELEMENT_GAP, dist);
            let slack = Math.max(0, dist - gap);
            adj[u].push({ to: v, slack: slack });
          }
        }
      } else if (dir === 'down') {
        if (!(elU.x >= elV.x + elV.w || elU.x + elU.w <= elV.x)) {
          if (elV.y >= elU.y) {
            let dist = elV.y - (elU.y + elU.h);
            let gap = Math.min(ELEMENT_GAP, dist);
            let slack = Math.max(0, dist - gap);
            adj[u].push({ to: v, slack: slack });
          }
        }
      } else if (dir === 'up') {
        if (!(elU.x >= elV.x + elV.w || elU.x + elU.w <= elV.x)) {
          if (elV.y + elV.h <= elU.y + elU.h) {
            let dist = elU.y - (elV.y + elV.h);
            let gap = Math.min(ELEMENT_GAP, dist);
            let slack = Math.max(0, dist - gap);
            adj[u].push({ to: v, slack: slack });
          }
        }
      }
    }
  }
  return adj;
}

function getShortestSlacks(adj, startNode, N) {
  let slacks = Array(N).fill(Infinity);
  slacks[startNode] = 0;
  let pq = [{node: startNode, d: 0}];
  while(pq.length > 0) {
    pq.sort((a,b) => a.d - b.d);
    let curr = pq.shift();
    if (curr.d > slacks[curr.node]) continue;
    for (let edge of adj[curr.node]) {
      let nextD = curr.d + edge.slack;
      if (nextD < slacks[edge.to]) {
        slacks[edge.to] = nextD;
        pq.push({node: edge.to, d: nextD});
      }
    }
  }
  return slacks;
}

function applyCascade(originalEls, currentEls, idx, dir, pushAmount) {
  if (pushAmount <= 0) return;
  const N = originalEls.length;
  const adj = getSlackGraph(originalEls, dir, idx);
  const slacks = getShortestSlacks(adj, idx, N);
  
  let maxAmount = Infinity;
  for (let k = 0; k < N; k++) {
    if (k === idx || slacks[k] === Infinity) continue;
    let marginSlack = 0;
    if (dir === 'right') marginSlack = (CANVAS_W - BORDER_SNAP_MARGIN - originalEls[k].w) - originalEls[k].x;
    else if (dir === 'left') marginSlack = originalEls[k].x - BORDER_SNAP_MARGIN;
    else if (dir === 'down') marginSlack = (CANVAS_H - BORDER_SNAP_MARGIN - originalEls[k].h) - originalEls[k].y;
    else if (dir === 'up') marginSlack = originalEls[k].y - BORDER_SNAP_MARGIN;
    
    maxAmount = Math.min(maxAmount, marginSlack + slacks[k]);
  }
  
  let actualPushNetwork = Math.min(pushAmount, maxAmount);
  if (actualPushNetwork < 0) actualPushNetwork = 0;
  
  for (let k = 0; k < N; k++) {
    if (k === idx || slacks[k] === Infinity) continue;
    let pushK = Math.max(0, actualPushNetwork - slacks[k]);
    if (pushK > 0) {
      if (dir === 'right') currentEls[k].x = Math.max(currentEls[k].x, originalEls[k].x + pushK);
      else if (dir === 'left') currentEls[k].x = Math.min(currentEls[k].x, originalEls[k].x - pushK);
      else if (dir === 'down') currentEls[k].y = Math.max(currentEls[k].y, originalEls[k].y + pushK);
      else if (dir === 'up') currentEls[k].y = Math.min(currentEls[k].y, originalEls[k].y - pushK);
    }
  }
}

function startResize(e, idx, corner = 'se') {
  e.preventDefault(); e.stopPropagation();
  const el = slides[currentSlideIdx].elements[idx];
  const sW = el.w, sH = el.h, sX = e.clientX, sY = e.clientY;
  const originalX = el.x, originalY = el.y; // For NW resize bounds limits
  const wr = document.querySelector(`[data-el-idx="${idx}"]`);
  const originalEls = JSON.parse(JSON.stringify(slides[currentSlideIdx].elements));
  
  const canvas = document.getElementById('slideCanvas');
  if (canvas) canvas.classList.add('resizing-mode');
  
  const onMove = (ev) => { 
    clearGuides();
    
    // Restore all other elements to original positions before push calculating
    slides[currentSlideIdx].elements.forEach((o, i) => {
       if (i !== idx) {
           o.x = originalEls[i].x; o.y = originalEls[i].y;
           const wrOther = document.querySelector(`[data-el-idx="${i}"]`);
           if (wrOther) { wrOther.style.left = o.x + 'px'; wrOther.style.top = o.y + 'px'; }
       }
    });

    if (corner === 'se') {
      let rawW = sW + (ev.clientX - sX) / workspaceZoom;
      let rawH = sH + (ev.clientY - sY) / workspaceZoom;
      
      let minH = 40;
      if (el.type === 'title') minH = 64;
      if (el.type === 'subtitle') minH = 50;
      if (el.type === 'body') minH = 44;

      let targetW = Math.max(el.type.startsWith('jupyter') ? MIN_JUPYTER_W / 2 : 80, rawW);
      let targetH = Math.max(el.type.startsWith('jupyter') ? MIN_JUPYTER_H / 2 : minH, rawH);

      if (el.type !== 'image') {
        targetW = Math.min(CANVAS_W - el.x, targetW);
        targetH = Math.min(CANVAS_H - el.y, targetH);
      }
      const isMedia = el.type === 'image' && el.src;
      if (isMedia) {
        const ratio = sW / sH;
        if (Math.abs(rawW - sW) > Math.abs(rawH - sH)) {
          targetH = targetW / ratio;
          if (targetH > CANVAS_H - el.y) { targetH = CANVAS_H - el.y; targetW = targetH * ratio; }
        } else {
          targetW = targetH * ratio;
          if (targetW > CANVAS_W - el.x) { targetW = CANVAS_W - el.x; targetH = targetW / ratio; }
        }
      }      
      let targetR = el.x + targetW;
      let targetB = el.y + targetH;

      if (el.type !== 'image') {
        let orig_h = originalEls[idx].h;
        originalEls[idx].h = targetH; 
        let pushAmountX = targetW > sW ? targetW - sW : 0;
        applyCascade(originalEls, slides[currentSlideIdx].elements, idx, 'right', pushAmountX);
        originalEls[idx].h = orig_h;
        
        let orig_w = originalEls[idx].w;
        originalEls[idx].w = targetW; 
        let pushAmountY = targetH > sH ? targetH - sH : 0;
        applyCascade(originalEls, slides[currentSlideIdx].elements, idx, 'down', pushAmountY);
        originalEls[idx].w = orig_w;
      }
      
      slides[currentSlideIdx].elements.forEach((other, j) => {
        if (j === idx) return;
        if (other.x !== originalEls[j].x || other.y !== originalEls[j].y) {
           const wrOther = document.querySelector(`[data-el-idx="${j}"]`);
           if (wrOther) { wrOther.style.left = other.x + 'px'; wrOther.style.top = other.y + 'px'; }
        }
      });

      // Check Snapping
      const snap = findSnapPos({ l: el.x, r: el.x + targetW, t: el.y, b: el.y + targetH }, idx, 'se');
      if (isMedia) {
        const ratio = sW / sH;
        if (snap.snappedX !== null) {
          targetW = snap.snappedX - el.x;
          targetH = targetW / ratio;
          showGuide('v', snap.guideX);
        }
        if (snap.snappedY !== null) {
          targetH = snap.snappedY - el.y;
          targetW = targetH * ratio;
          showGuide('h', snap.guideY);
        }
        // If snap pushes it out of slide bounds, clamp and readjust
        // NO-OP: Clamping removed to allow off-slide media sizing
      } else {
        if (snap.snappedX !== null) { targetW = snap.snappedX - el.x; showGuide('v', snap.guideX); }
        if (snap.snappedY !== null) { targetH = snap.snappedY - el.y; showGuide('h', snap.guideY); }
      }
      const isOverlap = checkOverlap({ l: el.x, r: el.x + targetW, t: el.y, b: el.y + targetH }, idx);

      if (!isOverlap) {
        el.w = targetW;
        el.h = targetH;
        if (wr) {
          wr.style.width = el.w + 'px'; wr.style.height = el.h + 'px';
          // Live scale for HTML widgets
          const iframe = wr.querySelector('iframe');
          if (iframe) {
            const scale = el.w / (el.naturalW || 960);
            iframe.style.transform = `scale(${scale})`;
          }
        }
        // Mirror size to linked jupyter-output wrapper
        if (el.type === 'jupyter-input' && el.linkId) {
          const outIdx = slides[currentSlideIdx].elements.findIndex((e, j) => j !== idx && e.linkId === el.linkId && e.type === 'jupyter-output');
          if (outIdx !== -1) {
            const outWr = document.querySelector(`[data-el-idx="${outIdx}"]`);
            if (outWr) { outWr.style.width = el.w + 'px'; outWr.style.height = el.h + 'px'; }
          }
        }
      }
    } else if (corner === 'nw') {
      // Free scale moving backwards out (Top-Left scale)
      let dx = (ev.clientX - sX) / workspaceZoom;
      let dy = (ev.clientY - sY) / workspaceZoom;
      let minH = 40;
      if (el.type === 'title') minH = 64;
      if (el.type === 'subtitle') minH = 50;
      if (el.type === 'body') minH = 44;
      if (el.type === 'jupyter') minH = MIN_JUPYTER_H;

      let minW = el.type === 'jupyter' ? MIN_JUPYTER_W : 80;
      let targetW = Math.max(minW, sW - dx);
      let targetH = Math.max(minH, sH - dy);
      
      // Optional: Clamp bounds for non-media so X and Y don't drift past < 0 logic layout frame limits
      if (el.type !== 'image') {
        if (originalX + dx < 0) { dx = -originalX; targetW = sW - dx; }
        if (originalY + dy < 0) { dy = -originalY; targetH = sH - dy; }
      }      
      // If width/height collapse to minimum defaults, block axis shifting scaling further
      if (targetW === minW) dx = sW - minW;
      if (targetH === minH) dy = sH - minH;
      
      let targetX = originalX + dx;
      let targetY = originalY + dy;

      const isMedia = el.type === 'image' && el.src;
      if (isMedia) {
        const ratio = sW / sH;
        if (Math.abs(targetW - sW) > Math.abs(targetH - sH)) {
          targetH = targetW / ratio;
          // Maintain the bottom-right corner anchor
          targetY = (originalY + sH) - targetH;
        } else {
          targetW = targetH * ratio;
          targetX = (originalX + sW) - targetW;
        }
        // NO-OP: Clamping removed to allow off-slide media placement/sizing
      }      
      if (el.type !== 'image') {
        let orig_y = originalEls[idx].y;
        let orig_h = originalEls[idx].h;
        originalEls[idx].y = targetY;
        originalEls[idx].h = targetH;
        let pushAmountLeft = 0;
        if (el.type !== 'jupyter' && targetX < originalX) pushAmountLeft = originalX - targetX;
        applyCascade(originalEls, slides[currentSlideIdx].elements, idx, 'left', pushAmountLeft);
        originalEls[idx].y = orig_y;
        originalEls[idx].h = orig_h;
        
        let orig_x = originalEls[idx].x;
        let orig_w = originalEls[idx].w;
        originalEls[idx].x = targetX;
        originalEls[idx].w = targetW;
        let pushAmountUp = 0;
        if (el.type !== 'jupyter' && targetY < originalY) pushAmountUp = originalY - targetY;
        applyCascade(originalEls, slides[currentSlideIdx].elements, idx, 'up', pushAmountUp);
        originalEls[idx].x = orig_x;
        originalEls[idx].w = orig_w;
      }
      
      slides[currentSlideIdx].elements.forEach((other, j) => {
        if (j === idx) return;
        if (other.x !== originalEls[j].x || other.y !== originalEls[j].y) {
           const wrOther = document.querySelector(`[data-el-idx="${j}"]`);
           if (wrOther) { wrOther.style.left = other.x + 'px'; wrOther.style.top = other.y + 'px'; }
        }
      });
      
      // Check Snapping
      const snap = findSnapPos({ l: targetX, r: targetX + targetW, t: targetY, b: targetY + targetH }, idx, 'nw');
      if (isMedia) {
        const ratio = sW / sH;
        if (snap.snappedX !== null) {
          let newTargetW = targetW + (targetX - snap.snappedX);
          if (newTargetW >= 80) {
            targetW = newTargetW;
            targetX = snap.snappedX;
            targetH = targetW / ratio;
            targetY = (originalY + sH) - targetH;
            showGuide('v', snap.guideX);
          }
        }
        if (snap.snappedY !== null) {
          let newTargetH = targetH + (targetY - snap.snappedY);
          if (newTargetH >= 40) {
            targetH = newTargetH;
            targetY = snap.snappedY;
            targetW = targetH * ratio;
            targetX = (originalX + sW) - targetW;
            showGuide('h', snap.guideY);
          }
        }
        // NO-OP: Clamping removed to allow off-slide media placement/sizing

      } else {
        if (snap.snappedX !== null) { 
          let newTargetW = targetW + (targetX - snap.snappedX);
          if (newTargetW >= 80) {
            targetW = newTargetW; 
            targetX = snap.snappedX; 
            showGuide('v', snap.guideX); 
          }
        }
        if (snap.snappedY !== null) { 
          let newTargetH = targetH + (targetY - snap.snappedY);
          if (newTargetH >= 40) {
            targetH = newTargetH; 
            targetY = snap.snappedY; 
            showGuide('h', snap.guideY); 
          }
        }
      }      
      const isOverlap = checkOverlap({ l: targetX, r: targetX + targetW, t: targetY, b: targetY + targetH }, idx);
      if (!isOverlap) {
        el.x = targetX;
        el.y = targetY;
        el.w = targetW;
        el.h = targetH;
        if (wr) {
          wr.style.left = el.x + 'px'; wr.style.top = el.y + 'px';
          wr.style.width = el.w + 'px'; wr.style.height = el.h + 'px';
          // Live scale for HTML widgets
          const iframe = wr.querySelector('iframe');
          if (iframe) {
            const scale = el.w / (el.naturalW || 960);
            iframe.style.transform = `scale(${scale})`;
          }
        }
        // Mirror position+size to linked jupyter-output wrapper
        if (el.type === 'jupyter-input' && el.linkId) {
          const outIdx = slides[currentSlideIdx].elements.findIndex((e, j) => j !== idx && e.linkId === el.linkId && e.type === 'jupyter-output');
          if (outIdx !== -1) {
            const outWr = document.querySelector(`[data-el-idx="${outIdx}"]`);
            if (outWr) { outWr.style.left = el.x + 'px'; outWr.style.top = el.y + 'px'; outWr.style.width = el.w + 'px'; outWr.style.height = el.h + 'px'; }
          }
        }
      }
    }

    const cmId = `cm_${currentSlideIdx}_${idx}`; 
    if (codeMirrors[cmId]) {
        // CM6 doesn't need refresh() like CM5, but its container might need checking
        // if we were using a custom layout.
    }
  };
  
  const onUp = () => { 
    clearGuides();
    updateWorkspaceBounds();
    renderSlide(); // Ensure final sync and CM refreshes
    if (canvas) canvas.classList.remove('resizing-mode');
    document.removeEventListener('mousemove', onMove); 
    document.removeEventListener('mouseup', onUp); 
  };
  
  document.addEventListener('mousemove', onMove); 
  document.addEventListener('mouseup', onUp);
}
