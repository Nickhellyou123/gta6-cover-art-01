// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover hides the editor and draws one exported cover full frame
// at the requested post size (?size=square|portrait|landscape, ?layout=,
// ?grade=, ?photo=, ?caption=, ?subtitle=). window.__shotReady is set once
// the scene is painted.
export async function runShot(shot, query, api) {
  if (shot === 'cover') {
    await api.setShotCover(query);
  } else if (shot === 'editor') {
    await api.setShotEditor(query);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
