// Wires the Palm Neon Cover Studio editor: pick photos, choose a layout and a
// grade, edit the caption, drag and zoom each panel, export a PNG in one of
// the three post sizes. A `?shot=` query sets up a fixed scene for a
// screenshot instead (./shots.js).

import { drawCover, LAYOUTS, GRADES, EXPORT_SIZES } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { id: 'convertible', file: 'samples/convertible.jpg', label: 'Convertible' },
  { id: 'neon', file: 'samples/neon.jpg', label: 'Neon street' },
  { id: 'pier', file: 'samples/pier.jpg', label: 'Pier' },
  { id: 'boulevard', file: 'samples/boulevard.jpg', label: 'Boulevard' },
];

const canvas = document.getElementById('cover');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const status = document.getElementById('status');
const zoomSlider = document.getElementById('zoom');
const panelStrip = document.getElementById('panelStrip');

export const state = {
  layout: 'hero',
  grade: 'sunset',
  size: 'square',
  title: 'NEON COAST',
  subtitle: 'Vice nights, your story',
  panels: [
    { photo: null, sample: 'convertible', x: 0.5, y: 0.42, zoom: 1 },
    { photo: null, sample: 'neon', x: 0.5, y: 0.5, zoom: 1 },
    { photo: null, sample: 'pier', x: 0.5, y: 0.5, zoom: 1 },
    { photo: null, sample: 'boulevard', x: 0.5, y: 0.5, zoom: 1 },
  ],
  selectedPanel: 0,
};

let lastPanels = [];
let drag = null;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Loads every sample photo once, then assigns them to the panels. */
export async function loadSamples() {
  const loaded = await Promise.all(
    SAMPLES.map(async (s) => [s.id, await loadImage(s.file)]),
  );
  const byId = Object.fromEntries(loaded);
  state.panels.forEach((p) => { p.photo = byId[p.sample] || null; });
  return byId;
}

function applySize() {
  const size = EXPORT_SIZES[state.size];
  canvas.width = size.width;
  canvas.height = size.height;
}

/** Redraws the live preview and refreshes the panel strip. */
export function redraw() {
  lastPanels = drawCover(canvas, state);
  renderPanelStrip();
}

function renderPanelStrip() {
  const count = (LAYOUTS[state.layout] || LAYOUTS.hero).panels;
  panelStrip.querySelectorAll('.panel-slot').forEach((slot, i) => {
    slot.classList.toggle('hidden', i >= count);
    slot.classList.toggle('selected', i === state.selectedPanel && i < count);
    const label = slot.querySelector('.slot-label');
    if (label) label.textContent = `Panel ${i + 1}`;
  });
  const panel = state.panels[state.selectedPanel];
  if (panel) zoomSlider.value = String(Math.round(panel.zoom * 100));
}

function selectPanel(i) {
  const count = (LAYOUTS[state.layout] || LAYOUTS.hero).panels;
  if (i < 0 || i >= count) return;
  state.selectedPanel = i;
  redraw();
}

/** Assigns a photo to the selected panel. */
export function assignPhotoToSelectedPanel(img, sampleId) {
  const panel = state.panels[state.selectedPanel];
  panel.photo = img;
  panel.sample = sampleId || 'upload';
  panel.x = 0.5;
  panel.y = 0.5;
  panel.zoom = 1;
  redraw();
}

function buildControlGroups() {
  const layoutGroup = document.getElementById('layoutGroup');
  Object.values(LAYOUTS).forEach((layout) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = layout.label;
    b.dataset.layout = layout.id;
    b.addEventListener('click', () => {
      state.layout = layout.id;
      state.selectedPanel = 0;
      layoutGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b));
      redraw();
    });
    if (layout.id === state.layout) b.classList.add('active');
    layoutGroup.appendChild(b);
  });

  const gradeGroup = document.getElementById('gradeGroup');
  Object.values(GRADES).forEach((grade) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.grade = grade.id;
    b.title = grade.label;
    b.style.background = `linear-gradient(135deg, ${grade.sun[0]}, ${grade.sun[1]} 55%, ${grade.sun[2]})`;
    const label = document.createElement('span');
    label.textContent = grade.label;
    b.appendChild(label);
    b.addEventListener('click', () => {
      state.grade = grade.id;
      gradeGroup.querySelectorAll('.swatch').forEach((c) => c.classList.toggle('active', c === b));
      redraw();
    });
    if (grade.id === state.grade) b.classList.add('active');
    gradeGroup.appendChild(b);
  });

  const sizeGroup = document.getElementById('sizeGroup');
  Object.values(EXPORT_SIZES).forEach((size) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = size.label;
    b.dataset.size = size.id;
    b.addEventListener('click', () => {
      state.size = size.id;
      sizeGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b));
      applySize();
      redraw();
    });
    if (size.id === state.size) b.classList.add('active');
    sizeGroup.appendChild(b);
  });

  const sampleRow = document.getElementById('sampleRow');
  SAMPLES.forEach((sample) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sample-thumb';
    b.title = `Use ${sample.label} in the selected panel`;
    const img = document.createElement('img');
    img.src = sample.file;
    img.alt = sample.label;
    b.appendChild(img);
    const label = document.createElement('span');
    label.textContent = sample.label;
    b.appendChild(label);
    b.addEventListener('click', async () => {
      assignPhotoToSelectedPanel(await loadImage(sample.file), sample.id);
      status.textContent = `${sample.label} in panel ${state.selectedPanel + 1}`;
    });
    sampleRow.appendChild(b);
  });

  for (let i = 0; i < 4; i += 1) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'panel-slot';
    const label = document.createElement('span');
    label.className = 'slot-label';
    label.textContent = `Panel ${i + 1}`;
    slot.appendChild(label);
    slot.addEventListener('click', () => selectPanel(i));
    panelStrip.appendChild(slot);
  }
}

function wireEditor() {
  buildControlGroups();

  titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
  subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });

  document.getElementById('upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    assignPhotoToSelectedPanel(await loadImage(URL.createObjectURL(file)), 'upload');
    status.textContent = `${file.name} in panel ${state.selectedPanel + 1}`;
    e.target.value = '';
  });

  zoomSlider.addEventListener('input', () => {
    state.panels[state.selectedPanel].zoom = Number(zoomSlider.value) / 100;
    redraw();
  });

  document.getElementById('export').addEventListener('click', () => {
    const size = EXPORT_SIZES[state.size];
    const off = document.createElement('canvas');
    off.width = size.width;
    off.height = size.height;
    drawCover(off, state);
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cover-${size.width}x${size.height}.png`;
      a.click();
      status.textContent = `Saved cover-${size.width}x${size.height}.png`;
    }, 'image/png');
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const hit = lastPanels.findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
    if (hit >= 0) {
      selectPanel(hit);
      drag = { x: e.clientX, y: e.clientY, panel: state.panels[hit] };
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const dx = (e.clientX - drag.x) * scaleX;
    const dy = (e.clientY - drag.y) * scaleY;
    const panel = drag.panel;
    const panelRect = lastPanels[state.selectedPanel];
    if (panelRect) {
      panel.x = Math.min(1, Math.max(0, panel.x - dx / Math.max(1, panelRect.w)));
      panel.y = Math.min(1, Math.max(0, panel.y - dy / Math.max(1, panelRect.h)));
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
    redraw();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[state.selectedPanel];
    panel.zoom = Math.min(3, Math.max(1, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    redraw();
  }, { passive: false });
}

/** The shot API: fixed scenes for screenshots, driven by ?shot=. */
export const shotApi = {
  async setShotCover(query) {
    const sizeId = query.get('size') || 'landscape';
    const layoutId = query.get('layout') || 'hero';
    const photoId = query.get('photo') || 'convertible';
    state.size = EXPORT_SIZES[sizeId] ? sizeId : 'landscape';
    state.layout = LAYOUTS[layoutId] ? layoutId : 'hero';
    state.grade = GRADES[query.get('grade')] ? query.get('grade') : 'sunset';
    state.title = query.get('caption') || 'NEON COAST';
    state.subtitle = query.get('subtitle') || 'Vice nights, your story';
    await loadSamples();
    const byId = {};
    SAMPLES.forEach((s) => { byId[s.id] = state.panels[SAMPLES.indexOf(s)].photo; });
    const order = [photoId, ...SAMPLES.map((s) => s.id).filter((id) => id !== photoId)];
    state.panels.forEach((p, i) => {
      const img = byId[order[i % order.length]];
      p.photo = img || p.photo;
      p.x = 0.5;
      p.y = 0.45;
      p.zoom = 1;
    });
    document.body.classList.add('shot-cover');
    applySize();
    redraw();
  },
  async setShotEditor(query) {
    state.layout = query.get('layout') || 'hero';
    state.grade = query.get('grade') || 'sunset';
    state.title = query.get('caption') || 'NEON COAST';
    state.subtitle = query.get('subtitle') || 'Vice nights, your story';
    titleInput.value = state.title;
    subtitleInput.value = state.subtitle;
    await loadSamples();
    applySize();
    redraw();
  },
};

async function init() {
  await document.fonts.load('80px Anton');
  await document.fonts.load('40px Pacifico');
  await document.fonts.ready;
  wireEditor();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    await runShot(shot, params, shotApi);
  } else {
    await loadSamples();
    applySize();
    redraw();
  }
}

init();
