import { describe, it, expect } from 'vitest';
import {
  HELP_MODULE_VIDEOS,
  HELP_MODULE_ROUTES,
  HELP_OTHER_VIDEOS,
  helpVideoEmbedUrl,
} from '../../pages/help/helpContent';

describe('help videos', () => {
  const all = [...Object.values(HELP_MODULE_VIDEOS).flat(), ...HELP_OTHER_VIDEOS];

  it('lists all 8 guides, each once, with a valid YouTube id', () => {
    expect(all).toHaveLength(8);
    expect(new Set(all.map((v) => v.youtubeId)).size).toBe(8);
    for (const v of all) expect(v!.youtubeId).toMatch(/^[\w-]{11}$/);
  });

  it('only attaches videos to real help modules', () => {
    for (const id of Object.keys(HELP_MODULE_VIDEOS)) expect(HELP_MODULE_ROUTES).toHaveProperty(id);
  });

  it('plays in the app via the nocookie embed, not a youtube.com watch link', () => {
    const url = helpVideoEmbedUrl('lBycQlUeum0');
    expect(url).toBe('https://www.youtube-nocookie.com/embed/lBycQlUeum0?autoplay=1&rel=0&modestbranding=1');
    expect(url).not.toContain('watch');
  });
});
