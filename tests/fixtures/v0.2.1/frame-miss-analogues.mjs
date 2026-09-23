// Generalized mechanisms, not copies of product identities or a production classifier.
const zero = { top: 0, right: 0, bottom: 0, left: 0 };
const base = { width: 320, height: 320, band: 8, desiredInsets: zero, currentInsets: zero,
  knownContentBounds: { x: 0, y: 0, width: 320, height: 320 } };
const positive = (id, edge, color, pairedWith) => ({ ...base, id, edge, color, recipe: 'separated', pairedWith,
  expectedClass: 'decorative_frame', safety: 'safe_to_trim', currentReason: 'confirmed_frame',
  desiredInsets: { ...zero, [edge]: 8 }, currentInsets: { ...zero, [edge]: 8 },
  knownContentBounds: edge === 'top' ? { x: 0, y: 8, width: 320, height: 312 }
    : edge === 'left' ? { x: 8, y: 0, width: 312, height: 320 } : { x: 0, y: 0, width: 320, height: 312 } });
export const frameMissAnalogues = [
  positive('RF-A-P', 'top', [224, 224, 224], 'RF-A-N'),
  { ...base, id: 'RF-A-N', edge: 'top', color: [224, 224, 224], recipe: 'unseparated', expectedClass: 'photo_background', safety: 'ambiguous', futureAction: 'preserve', currentReason: 'no_separator' },
  { ...base, id: 'RF-A-R', edge: 'top', recipe: 'layered', expectedClass: 'ambiguous', safety: 'ambiguous', futureAction: 'manual_review', currentReason: 'no_separator', semanticInterpretation: 'possible decorative surround' },
  { ...base, id: 'RF-A-H', edge: 'top', recipe: 'layered', expectedClass: 'ambiguous', safety: 'ambiguous', futureAction: 'manual_review', currentReason: 'no_separator', semanticInterpretation: 'possible meaningful product rim' },
  positive('RF-B-P', 'left', [235, 218, 196], 'RF-B-N'),
  { ...base, id: 'RF-B-N', edge: 'left', recipe: 'partial-light', expectedClass: 'panel_background', safety: 'unsafe_to_trim', futureAction: 'preserve', currentReason: 'band_detail' },
  { ...base, id: 'RF-B-R', edge: 'bottom', recipe: 'partial-dark', expectedClass: 'panel_background', safety: 'unsafe_to_trim', futureAction: 'manual_crop_candidate', currentReason: 'band_detail' },
  positive('RF-C-P', 'bottom', [236, 219, 198], 'RF-C-N'),
  { ...base, id: 'RF-C-N', edge: 'bottom', color: [236, 219, 198], recipe: 'bridge', expectedClass: 'content_touching_edge', safety: 'unsafe_to_trim', futureAction: 'preserve', currentReason: 'band_detail' },
  { ...base, id: 'RF-C-R', edge: 'bottom', recipe: 'inset-card', expectedClass: 'content_touching_edge', safety: 'unsafe_to_trim', futureAction: 'manual_review', currentReason: 'band_detail' },
];
export function renderFrameMiss(f) {
  const { width: w, height: h, band } = f, raw = Buffer.alloc(w * h * 4);
  const paint = (x, y, color) => raw.set([...color, 255], (y * w + x) * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const noise = (x * 17 + y * 31 + (x ^ y) * 3) % 27;
    paint(x, y, [130 + noise, 118 + noise, 101 + noise]);
  }
  if (['separated', 'unseparated', 'bridge'].includes(f.recipe)) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const depth = f.edge === 'top' ? y : f.edge === 'bottom' ? h - 1 - y : x;
      if (depth < band) paint(x, y, f.color);
      else if (depth < band + 2 && f.recipe !== 'unseparated') paint(x, y, [20, 20, 20]);
    }
    if (f.recipe === 'bridge') for (let y = h - band - 8; y < h; y++) for (let x = 70; x < 73; x++) paint(x, y, [90, 50, 30]);
  } else if (f.recipe === 'layered') {
    for (let y = 0; y < 12; y++) for (let x = 0; x < w; x++) {
      paint(x, y, y < 6 ? [224, 224, 224] : y === 6 ? [228, 221, 229] : y < 8 ? [224, 224, 224] : y < 10 ? [130, 182, 122] : [144, 141, 134]);
    }
  } else if (f.recipe === 'partial-dark' || f.recipe === 'partial-light') {
    const color = f.recipe === 'partial-dark' ? [88, 76, 64] : [235, 218, 196];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x < 8 && y >= 128 || y >= h - 16 && x < 168) paint(x, y, color);
      else if (x < 8 || y >= h - 16) paint(x, y, [255, 255, 255]);
    }
  } else if (f.recipe === 'inset-card') {
    for (let y = h - 24; y < h; y++) for (let x = 40; x < w - 40; x++) paint(x, y,
      y < h - 21 || x < 43 || x >= w - 43 ? [250, 250, 250] : [180 + (x * 7 + y * 11) % 30, 172 + (x + y) % 20, 161 + (x * 3 + y) % 25]);
  } else throw new Error('Unknown recipe');
  return raw;
}
