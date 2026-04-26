import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import loader from './cdn_img_loader';

describe('cdn_img_loader', () => {
  beforeEach(() => { process.env.BUILD_ID = '42'; });
  afterEach(() => { delete process.env.BUILD_ID; });

  it('transforms cloudinary URLs with scale and quality', () => {
    const src = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    const result = loader({ src, width: 400, quality: 80 });
    expect(result).toContain('/upload/c_scale,w_400,f_webp,q_80/');
    expect(result).toContain('?id=42');
  });

  it('forces https for cloudinary http URLs', () => {
    const src = 'http://res.cloudinary.com/demo/image/upload/sample.jpg';
    expect(loader({ src, width: 200, quality: 75 })).toMatch(/^https:/);
  });

  it('defaults quality to 100 for cloudinary when omitted', () => {
    const src = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    expect(loader({ src, width: 300 })).toContain('q_100');
  });

  it('transforms framerusercontent URLs', () => {
    const src = 'https://framerusercontent.com/assets/foo.jpg';
    const result = loader({ src, width: 512, quality: 75 });
    expect(result).toContain('/images/foo.jpg');
    expect(result).toContain('scale-down-to=512');
  });

  it('returns sleeve webp for /img/SMA_sleeve paths', () => {
    expect(loader({ src: '/img/SMA_sleeve_some', width: 256, quality: 80 })).toBe('/img/SMA_sleeve_256.webp');
    expect(loader({ src: '/img/SMA_sleeve_some', width: 1024, quality: 80 })).toBe('/img/SMA_sleeve.webp');
  });

  it('appends id param to unknown URLs', () => {
    expect(loader({ src: '/img/other.png', width: 100 })).toBe('/img/other.png?id=42');
  });

  it('appends id param using & when URL already has query string', () => {
    expect(loader({ src: '/img/other.png?foo=bar', width: 100 })).toBe('/img/other.png?foo=bar&id=42');
  });
});
