import { describe, expect, it } from 'vitest';
import { applyLevels, fitWithin, stretchLevels, toGray } from './pixels';

describe('pixels', () => {
  it('converts to grey and builds a histogram', () => {
    const d = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]);
    const hist = toGray(d);
    expect([d[0], d[4], d[8]]).toEqual([255, 0, 76]);
    expect(hist[255] + hist[0] + hist[76]).toBe(3);
  });

  it('stretches a low-contrast image to full range', () => {
    const d = new Uint8ClampedArray(400 * 4);
    for (let i = 0; i < 400; i++) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 100 + (i % 61);
    const hist = toGray(d);
    const [lo, hi] = stretchLevels(hist, 0);
    expect([lo, hi]).toEqual([100, 160]);
    applyLevels(d, lo, hi);
    expect(d[0]).toBe(0);
    expect(d[60 * 4]).toBe(255);
  });

  it('leaves flat images alone', () => {
    const hist = new Uint32Array(256);
    hist[128] = 100;
    expect(stretchLevels(hist)).toEqual([0, 255]);
  });

  it('fits images without upscaling', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ w: 2000, h: 1500 });
    expect(fitWithin(800, 600, 2000)).toEqual({ w: 800, h: 600 });
  });
});
