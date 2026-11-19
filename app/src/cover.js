// Cover engine: draws a multi-panel GTA-style poster cover onto a canvas.
// Four layouts (hero+3, 4-grid, full-bleed, tilted snapshots), four gradient-map
// grades (sunset, neon, teal/pink, mono), Anton title lettering with a Pacifico
// subtitle, grain and vignette. Pure 2D canvas, no network, no library.

export const LAYOUTS = {
  hero: { id: 'hero', label: 'Hero + 3', panels: 4 },
  grid: { id: 'grid', label: '4-grid', panels: 4 },
  full: { id: 'full', label: 'Full bleed', panels: 1 },
  tilted: { id: 'tilted', label: 'Tilted snapshots', panels: 3 },
};

export const GRADES = {
  sunset: {
    id: 'sunset', label: 'Sunset',
    sky: ['#2b1055', '#7597de'],
    sun: ['#ffd166', '#ff7e5f', '#c6426e'],
    wash: ['rgba(255, 140, 66, 0.28)', 'rgba(198, 66, 110, 0.34)'],
    title: ['#ffe259', '#ffa751', '#ff5e8a'],
    scrim: 'rgba(20, 6, 32, 0.82)',
  },
  neon: {
    id: 'neon', label: 'Neon',
    sky: ['#0b0620', '#3b0764'],
    sun: ['#7df9ff', '#ff71ce', '#b967ff'],
    wash: ['rgba(125, 249, 255, 0.22)', 'rgba(255, 113, 206, 0.32)'],
    title: ['#7df9ff', '#ff71ce', '#b967ff'],
    scrim: 'rgba(8, 4, 28, 0.82)',
  },
  teal: {
    id: 'teal', label: 'Teal / pink',
    sky: ['#062a2e', '#0f766e'],
    sun: ['#99f6e4', '#f9a8d4', '#ec4899'],
    wash: ['rgba(45, 212, 191, 0.24)', 'rgba(236, 72, 153, 0.30)'],
    title: ['#99f6e4', '#f9a8d4', '#f472b6'],
    scrim: 'rgba(4, 26, 28, 0.82)',
  },
  mono: {
    id: 'mono', label: 'Mono',
    sky: ['#111111', '#3f3f46'],
    sun: ['#fafafa', '#a1a1aa', '#52525b'],
    wash: ['rgba(255, 255, 255, 0.10)', 'rgba(0, 0, 0, 0.28)'],
    title: ['#ffffff', '#d4d4d8', '#a1a1aa'],
    scrim: 'rgba(0, 0, 0, 0.82)',
  },
};

export const EXPORT_SIZES = {
  square: { id: 'square', label: '1080 x 1080', width: 1080, height: 1080 },
  portrait: { id: 'portrait', label: '1080 x 1350', width: 1080, height: 1350 },
  landscape: { id: 'landscape', label: '1920 x 1080', width: 1920, height: 1080 },
};

const GAP = 0.012; // panel gap as a fraction of the shorter side

/** Panel rectangles for a layout, as fractions of the cover size. */
export function layoutPanels(layoutId, w, h) {
  const g = Math.min(w, h) * GAP;
  const half = (w - g * 3) / 2;
  const third = (h - g * 4) / 3;
  switch (layoutId) {
    case 'hero': {
      const heroW = w * 0.62;
      const sideX = heroW + g;
      const sideW = w - sideX;
      return [
        { x: 0, y: 0, w: heroW, h, rot: 0 },
        { x: sideX, y: 0, w: sideW, h: third, rot: 0 },
        { x: sideX, y: third + g, w: sideW, h: third, rot: 0 },
        { x: sideX, y: (third + g) * 2, w: sideW, h: third, rot: 0 },
      ];
    }
    case 'grid':
      return [
        { x: 0, y: 0, w: half, h: half, rot: 0 },
        { x: half + g, y: 0, w: half, h: half, rot: 0 },
        { x: 0, y: half + g, w: half, h: half, rot: 0 },
        { x: half + g, y: half + g, w: half, h: half, rot: 0 },
      ];
    case 'full':
      return [{ x: 0, y: 0, w, h, rot: 0 }];
    case 'tilted': {
      const pw = w * 0.56;
      const ph = h * 0.30;
      return [
        { x: w * 0.05, y: h * 0.36, w: pw, h: ph, rot: -0.10 },
        { x: w * 0.39, y: h * 0.22, w: pw, h: ph, rot: 0.07 },
        { x: w * 0.08, y: h * 0.64, w: pw, h: ph, rot: -0.03 },
      ];
    }
    default:
      return layoutPanels('hero', w, h);
  }
}

/** Draws one photo into a panel rect, cover-fit, with pan (0..1 focus) and zoom. */
export function drawPhotoInto(ctx, img, rect, pan, gradeId) {
  if (!img) return;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (pan.zoom || 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const maxShiftX = Math.max(0, (pw - rect.w) / 2);
  const maxShiftY = Math.max(0, (ph - rect.h) / 2);
  const dx = rect.x + (rect.w - pw) / 2 - (pan.x - 0.5) * 2 * maxShiftX;
  const dy = rect.y + (rect.h - ph) / 2 - (pan.y - 0.5) * 2 * maxShiftY;
  ctx.save();
  if (gradeId === 'mono') ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.04)';
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.restore();
}

/** Applies a grade's colour wash over a panel rect. */
export function applyGradeWash(ctx, rect, grade) {
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

let grainTile = null;
/** A small random-noise tile, reused for the film grain. */
export function getGrainTile() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = 140;
  c.height = 140;
  const g = c.getContext('2d');
  const data = g.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  grainTile = c;
  return grainTile;
}

/** Film grain plus a dark vignette over the whole cover. */
export function drawGrainAndVignette(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** Fits Anton to the width and draws the title with a gradient fill and outline. */
export function drawTitle(ctx, text, cx, baselineY, maxWidth, size, grade) {
  const words = (text || '').trim().toUpperCase();
  if (!words) return;
  let s = size;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = `${Math.round(s * 0.04)}px`; } catch { /* older canvas */ }
  ctx.font = `${s}px Anton, 'Arial Black', sans-serif`;
  while (ctx.measureText(words).width > maxWidth && s > 16) {
    s -= 4;
    ctx.font = `${s}px Anton, 'Arial Black', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(s * 0.04)}px`; } catch { /* older canvas */ }
  }
  const grad = ctx.createLinearGradient(0, baselineY - s, 0, baselineY + s * 0.15);
  grad.addColorStop(0, grade.title[0]);
  grad.addColorStop(0.55, grade.title[1]);
  grad.addColorStop(1, grade.title[2]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.strokeStyle = 'rgba(12, 4, 24, 0.92)';
  ctx.strokeText(words, cx, baselineY);
  ctx.fillStyle = grad;
  ctx.fillText(words, cx, baselineY);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
}

/** Pacifico subtitle under the title. */
export function drawSubtitle(ctx, text, cx, y, size) {
  const words = (text || '').trim();
  if (!words) return;
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = size * 0.25;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(words, cx, y);
  ctx.shadowBlur = 0;
}

/** The title block: scrim, title, subtitle. Position depends on the layout. */
export function drawTitleBlock(ctx, w, h, state, grade) {
  const titleSize = Math.round(Math.min(w, h) * 0.115);
  const subSize = Math.round(Math.min(w, h) * 0.038);
  if (state.layout === 'tilted') {
    const scrim = ctx.createLinearGradient(0, 0, 0, h * 0.30);
    scrim.addColorStop(0, grade.scrim);
    scrim.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h * 0.30);
    drawTitle(ctx, state.title, w / 2, h * 0.115, w * 0.92, titleSize, grade);
    drawSubtitle(ctx, state.subtitle, w / 2, h * 0.115 + subSize * 1.5, subSize);
    return;
  }
  const bandH = h * 0.30;
  const scrim = ctx.createLinearGradient(0, h - bandH, 0, h);
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  scrim.addColorStop(0.55, grade.scrim);
  scrim.addColorStop(1, grade.scrim);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h - bandH, w, bandH);
  const alignLeft = state.layout === 'full';
  const cx = alignLeft ? w * 0.06 : w / 2;
  if (alignLeft) {
    ctx.save();
    ctx.textAlign = 'left';
    drawTitleLeft(ctx, state.title, cx, h - h * 0.115, w * 0.88, titleSize, grade);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = subSize * 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.fillText((state.subtitle || '').trim(), cx, h - h * 0.115 + subSize * 1.6);
    ctx.shadowBlur = 0;
    return;
  }
  drawTitle(ctx, state.title, cx, h - h * 0.115, w * 0.92, titleSize, grade);
  drawSubtitle(ctx, state.subtitle, cx, h - h * 0.115 + subSize * 1.6, subSize);
}

/** Left-aligned title for the full-bleed layout. */
export function drawTitleLeft(ctx, text, x, baselineY, maxWidth, size, grade) {
  const words = (text || '').trim().toUpperCase();
  if (!words) return;
  let s = size;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = `${Math.round(s * 0.04)}px`; } catch { /* older canvas */ }
  ctx.font = `${s}px Anton, 'Arial Black', sans-serif`;
  while (ctx.measureText(words).width > maxWidth && s > 16) {
    s -= 4;
    ctx.font = `${s}px Anton, 'Arial Black', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(s * 0.04)}px`; } catch { /* older canvas */ }
  }
  const grad = ctx.createLinearGradient(0, baselineY - s, 0, baselineY + s * 0.15);
  grad.addColorStop(0, grade.title[0]);
  grad.addColorStop(0.55, grade.title[1]);
  grad.addColorStop(1, grade.title[2]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.strokeStyle = 'rgba(12, 4, 24, 0.92)';
  ctx.strokeText(words, x, baselineY);
  ctx.fillStyle = grad;
  ctx.fillText(words, x, baselineY);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
}

/** Small corner badge: the studio mark, top right. */
export function drawCornerBadge(ctx, w, h) {
  const s = Math.round(Math.min(w, h) * 0.020);
  const label = 'PALM NEON  •  EST. 2026';
  ctx.font = `bold ${s}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  const pad = s * 0.9;
  const tw = ctx.measureText(label).width;
  const bx = w - s * 1.2;
  const by = s * 1.6;
  ctx.fillStyle = 'rgba(10, 4, 20, 0.55)';
  ctx.beginPath();
  ctx.roundRect(bx - tw - pad * 2, by - s - pad * 0.7, tw + pad * 2, s + pad * 1.4, s * 0.9);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillText(label, bx - pad, by + s * 0.28);
}

/** Draws the tilted layout's sunset backdrop: sky, sun, sea band. */
export function drawTiltedBackdrop(ctx, w, h, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.62, grade.sky[1]);
  sky.addColorStop(1, grade.sun[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sunR = Math.min(w, h) * 0.17;
  const sun = ctx.createRadialGradient(w * 0.72, h * 0.20, sunR * 0.1, w * 0.72, h * 0.20, sunR);
  sun.addColorStop(0, grade.sun[0]);
  sun.addColorStop(0.6, grade.sun[1]);
  sun.addColorStop(1, grade.sun[2]);
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.20, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(0, h * (0.86 + i * 0.028), w, h * 0.008);
  }
}

/**
 * Draws the whole cover. `state` carries layout, grade, title, subtitle and
 * panels: [{ photo: HTMLImageElement|null, x, y, zoom }]. Returns the panel
 * rects in cover pixels, for hit-testing in the editor.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const panels = layoutPanels(state.layout, w, h);

  if (state.layout === 'tilted') {
    drawTiltedBackdrop(ctx, w, h, grade);
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, grade.sky[0]);
    bg.addColorStop(1, grade.sky[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  panels.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: null, x: 0.5, y: 0.5, zoom: 1 };
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
    } else {
      ctx.translate(rect.x, rect.y);
    }
    const local = { x: 0, y: 0, w: rect.w, h: rect.h, rot: 0 };
    if (state.layout === 'tilted') {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = Math.min(w, h) * 0.03;
      ctx.shadowOffsetY = Math.min(w, h) * 0.012;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-rect.w * 0.02, -rect.h * 0.05, rect.w * 1.04, rect.h * 1.12);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.beginPath();
    ctx.rect(0, 0, rect.w, rect.h);
    ctx.clip();
    if (panel.photo) {
      drawPhotoInto(ctx, panel.photo, local, panel, state.grade);
    } else {
      const ph = ctx.createLinearGradient(0, 0, rect.w, rect.h);
      ph.addColorStop(0, grade.sky[1]);
      ph.addColorStop(1, grade.sun[2]);
      ctx.fillStyle = ph;
      ctx.fillRect(0, 0, rect.w, rect.h);
    }
    applyGradeWash(ctx, local, grade);
    ctx.restore();
    if (state.layout !== 'tilted') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.004);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  });

  drawTitleBlock(ctx, w, h, state, grade);
  if (state.layout !== 'tilted') drawCornerBadge(ctx, w, h);
  drawGrainAndVignette(ctx, w, h);
  return panels;
}
