// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

describe('pwa configuration', () => {
  it('precaches the lookup table, not just code', () => {
    const cfg = readFileSync('vite.config.ts', 'utf8');
    expect(cfg).toMatch(/globPatterns/);
    expect(cfg).toMatch(/bin/);
  });

  it('declares a manifest that can be installed to a home screen', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBeDefined();
    expect(m.name).toBeTruthy();
  });

  it('ships a table large enough to be the real one', () => {
    expect(existsSync('public/ddb96.bin')).toBe(true);
    expect(readFileSync('public/ddb96.bin').length).toBe(315_588 * 3);
  });
});
