import { describe, it, expect } from 'vitest';
import { getGeneratedYoutubeFrameUrl, getYoutubeVideoId, getYoutubeFrameUrl } from './youtubeLink';

describe('getYoutubeVideoId', () => {
  it('extracts the id from a standard watch URL', () => {
    expect(getYoutubeVideoId('https://www.youtube.com/watch?v=qNzGPn4wHnQ')).toBe('qNzGPn4wHnQ');
  });

  it('accepts youtube.com without www', () => {
    expect(getYoutubeVideoId('https://youtube.com/watch?v=qNzGPn4wHnQ')).toBe('qNzGPn4wHnQ');
  });

  it('accepts youtu.be short links', () => {
    expect(getYoutubeVideoId('https://youtu.be/qNzGPn4wHnQ')).toBe('qNzGPn4wHnQ');
  });

  it('returns null for undefined and empty string', () => {
    expect(getYoutubeVideoId(undefined)).toBeNull();
    expect(getYoutubeVideoId('')).toBeNull();
  });

  it('returns null for non-YouTube URLs', () => {
    expect(getYoutubeVideoId('https://vimeo.com/watch?v=qNzGPn4wHnQ')).toBeNull();
    expect(getYoutubeVideoId('https://www.youtube.com.evil.com/watch?v=qNzGPn4wHnQ')).toBeNull();
  });

  it('returns null for non-https links', () => {
    expect(getYoutubeVideoId('http://www.youtube.com/watch?v=qNzGPn4wHnQ')).toBeNull();
  });

  it('returns null for a watch URL without v=', () => {
    expect(getYoutubeVideoId('https://www.youtube.com/watch')).toBeNull();
  });

  it('returns null for non-watch YouTube paths', () => {
    expect(getYoutubeVideoId('https://www.youtube.com/channel/UCappPdmOklYArLb8217VO8w')).toBeNull();
  });

  it('returns null for a malformed video id', () => {
    expect(getYoutubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(getYoutubeVideoId('https://www.youtube.com/watch?v=way_too_long_id_123')).toBeNull();
  });

  it('returns null for a string that is not a URL at all', () => {
    expect(getYoutubeVideoId('qNzGPn4wHnQ')).toBeNull();
  });
});

describe('getYoutubeFrameUrl', () => {
  it('builds the stable local URL generated from M13 during yarn build', () => {
    expect(getGeneratedYoutubeFrameUrl('qNzGPn4wHnQ')).toBe('/generated/video-frames/qNzGPn4wHnQ.webp');
  });

  it('builds a max-resolution JPEG frame URL by default', () => {
    expect(getYoutubeFrameUrl('qNzGPn4wHnQ')).toBe('https://i.ytimg.com/vi/qNzGPn4wHnQ/maxres2.jpg');
  });

  it('builds the WebP variant served from YouTube\'s WebP path', () => {
    expect(getYoutubeFrameUrl('qNzGPn4wHnQ', 0, 'webp')).toBe('https://i.ytimg.com/vi_webp/qNzGPn4wHnQ/maxres2.webp');
  });

  it('adds a cache-busting retry token without changing the selected frame', () => {
    expect(getYoutubeFrameUrl('qNzGPn4wHnQ', 2)).toBe('https://i.ytimg.com/vi/qNzGPn4wHnQ/maxres2.jpg?retry=2');
  });
});
