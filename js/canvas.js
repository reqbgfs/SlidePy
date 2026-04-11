// ═══════ DRAG, RESIZE & SNAPPING ENGINE ═══════
const SNAP_DIST = 5;
const CANVAS_W = 960;
const CANVAS_H = 540;
const BORDER_SNAP_MARGIN = 40;
const ELEMENT_GAP = 20;

function selectEl(idx) { 
  if(selectedElIdx!==idx){ 
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
  for (let i = 0; i < els.length; i++) {
    if (i === skipIdx) continue;
    const r = getRect(els[i]);
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
  const ox = e.clientX - rect.left - el.x;
  const oy = e.clientY - rect.top - el.y;
  const wr = document.querySelector(`[data-el-idx="${idx}"]`);
  
  if(wr) wr.classList.add('dragging-el');
  if(canvas) canvas.classList.add('resizing-mode');
  
  const originalX = el.x;
  const originalY = el.y;

  const onMove = (ev) => { 
    clearGuides();
    // Base movement with CANVAS borders limits
    let targetX = Math.round(Math.max(0, Math.min(CANVAS_W - el.w, ev.clientX - rect.left - ox))); 
    let targetY = Math.round(Math.max(0, Math.min(CANVAS_H - el.h, ev.clientY - rect.top - oy)));
    
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
    }
  };
  
  const onUp = () => { 
    clearGuides();
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
      
      let elU = els[u];
      let elV = els[v];
      
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
      let rawW = sW + (ev.clientX - sX);
      let rawH = sH + (ev.clientY - sY);
      
      let minH = 40;
      if (el.type === 'title') minH = 64;
      if (el.type === 'subtitle') minH = 50;
      if (el.type === 'body') minH = 44;

      let targetW = Math.max(80, Math.min(CANVAS_W - el.x, rawW)); 
      let targetH = Math.max(minH, Math.min(CANVAS_H - el.y, rawH)); 
      
      // Code cells ONLY resized vertically
      if (el.type === 'jupyter') {
        targetW = sW; // lock width
        targetH = Math.max((CANVAS_H - 2 * BORDER_SNAP_MARGIN) / 2, targetH);
      }

      let targetR = el.x + targetW;
      let targetB = el.y + targetH;

      let orig_h = originalEls[idx].h;
      originalEls[idx].h = targetH; // A's height expands, hitting vertically spanning elements
      let pushAmountX = 0;
      if (el.type !== 'jupyter' && targetW > sW) pushAmountX = targetW - sW;
      applyCascade(originalEls, slides[currentSlideIdx].elements, idx, 'right', pushAmountX);
      originalEls[idx].h = orig_h;
      
      let orig_w = originalEls[idx].w;
      originalEls[idx].w = targetW; // A's width expands, hitting horizontally spanning elements
      let pushAmountY = 0;
      if (el.type !== 'jupyter' && targetH > sH) pushAmountY = targetH - sH;
      applyCascade(originalEls, slides[currentSlideIdx].elements, idx, 'down', pushAmountY);
      originalEls[idx].w = orig_w;
      
      slides[currentSlideIdx].elements.forEach((other, j) => {
        if (j === idx) return;
        if (other.x !== originalEls[j].x || other.y !== originalEls[j].y) {
           const wrOther = document.querySelector(`[data-el-idx="${j}"]`);
           if (wrOther) { wrOther.style.left = other.x + 'px'; wrOther.style.top = other.y + 'px'; }
        }
      });

      // Check Snapping
      const snap = findSnapPos({ l: el.x, r: el.x + targetW, t: el.y, b: el.y + targetH }, idx, 'se');
      if (snap.snappedX !== null && el.type !== 'jupyter') { targetW = snap.snappedX - el.x; showGuide('v', snap.guideX); }
      if (snap.snappedY !== null) { targetH = snap.snappedY - el.y; showGuide('h', snap.guideY); }

      const isOverlap = checkOverlap({ l: el.x, r: el.x + targetW, t: el.y, b: el.y + targetH }, idx);
      
      if (!isOverlap) {
        el.w = targetW;
        el.h = targetH;
        if (wr) { wr.style.width = el.w + 'px'; wr.style.height = el.h + 'px'; }
      }
    } else if (corner === 'nw') {
      // Free scale moving backwards out (Top-Left scale)
      let dx = ev.clientX - sX;
      let dy = ev.clientY - sY;
      
      if (el.type === 'jupyter') {
        dx = 0; // lock width logic
      }

      let minH = 40;
      if (el.type === 'title') minH = 64;
      if (el.type === 'subtitle') minH = 50;
      if (el.type === 'body') minH = 44;
      let targetW = Math.max(80, sW - dx);
      let targetH = Math.max(minH, sH - dy);
      
      // Clamp bounds so X and Y don't drift past < 0 logic layout frame limits
      if (originalX + dx < 0) { dx = -originalX; targetW = sW - dx; }
      if (originalY + dy < 0) { dy = -originalY; targetH = sH - dy; }
      
      // If width/height collapse to minimum defaults, block axis shifting scaling further
      if (targetW === 80) dx = sW - 80;
      if (targetH === minH) dy = sH - minH;
      
      let targetX = originalX + dx;
      let targetY = originalY + dy;
      
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
      
      slides[currentSlideIdx].elements.forEach((other, j) => {
        if (j === idx) return;
        if (other.x !== originalEls[j].x || other.y !== originalEls[j].y) {
           const wrOther = document.querySelector(`[data-el-idx="${j}"]`);
           if (wrOther) { wrOther.style.left = other.x + 'px'; wrOther.style.top = other.y + 'px'; }
        }
      });
      
      // Check Snapping
      const snap = findSnapPos({ l: targetX, r: targetX + targetW, t: targetY, b: targetY + targetH }, idx, 'nw');
      
      if (snap.snappedX !== null && el.type !== 'jupyter') { 
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
      
      const isOverlap = checkOverlap({ l: targetX, r: targetX + targetW, t: targetY, b: targetY + targetH }, idx);
      if (!isOverlap) {
        el.x = targetX;
        el.y = targetY;
        el.w = targetW;
        el.h = targetH;
        if (wr) { 
          wr.style.left = el.x + 'px'; wr.style.top = el.y + 'px'; 
          wr.style.width = el.w + 'px'; wr.style.height = el.h + 'px'; 
        }
      }
    }

    const cmId = `cm_${currentSlideIdx}_${idx}`; 
    if (codeMirrors[cmId]) codeMirrors[cmId].refresh();
  };
  
  const onUp = () => { 
    clearGuides();
    if (canvas) canvas.classList.remove('resizing-mode');
    document.removeEventListener('mousemove', onMove); 
    document.removeEventListener('mouseup', onUp); 
  };
  
  document.addEventListener('mousemove', onMove); 
  document.addEventListener('mouseup', onUp);
}
