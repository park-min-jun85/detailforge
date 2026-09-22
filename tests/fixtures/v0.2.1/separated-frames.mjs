import sharp from 'sharp';
import { EDGES, boundaryCases, zeroInsets } from './image-boundaries.mjs';
import { renderBoundaryFixture } from '../../helpers/image-boundary-contracts.mjs';

// Original 22 semantic labels/bytes and v1 observations stay frozen in TASK-046.
// This is the revised, pixel-only application expectation, not an input to production.
export const currentBoundaryInsets = f => f.caseId === 'M1-C' ? f.referenceInsets : zeroInsets;
export const separatedFrames = ['M1-A', 'M1-B', 'M1-D', 'M4-A', 'M4-B', 'M4-C', 'M4-D', 'M4-E'].map(id => {
  const original = boundaryCases.find(f => f.caseId === id);
  const border = id === 'M4-C' ? 16 : original.border;
  const edges = original.expectedAllowedEdges;
  const referenceInsets = Object.fromEntries(EDGES.map(edge => [edge, edges.includes(edge) ? border : 0]));
  return { ...original, caseId: `${id}2`, description: `${original.description}; retained 2px contrasting separator`,
    border, separatorWidth: 2, referenceInsets, currentInsets: referenceInsets,
    knownContentBounds: { x: referenceInsets.left, y: referenceInsets.top,
      width: original.width - referenceInsets.left - referenceInsets.right,
      height: original.height - referenceInsets.top - referenceInsets.bottom } };
});

export async function renderSeparatedFrame(f) {
  const { raw } = await renderBoundaryFixture({ ...f, format: 'png' });
  const i = f.referenceInsets, right = f.width - i.right, bottom = f.height - i.bottom;
  // The separator is meaningful retained content, never part of the removable border.
  for (let y = i.top; y < bottom; y++) for (let x = i.left; x < right; x++) {
    if ((i.left && x < i.left + f.separatorWidth) || (i.right && x >= right - f.separatorWidth)
      || (i.top && y < i.top + f.separatorWidth) || (i.bottom && y >= bottom - f.separatorWidth)) {
      raw.set([20, 20, 20, 255], (y * f.width + x) * 4);
    }
  }
  const encoder = sharp(raw, { raw: { width: f.width, height: f.height, channels: 4 } });
  const bytes = await (f.format === 'jpeg' ? encoder.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }) : encoder.png()).toBuffer();
  return { bytes, raw: await sharp(bytes).ensureAlpha().raw().toBuffer(), mime: `image/${f.format}` };
}
