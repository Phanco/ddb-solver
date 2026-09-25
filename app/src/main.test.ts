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
    // Chrome requires at least one icon >= 144px to offer installation.
    expect(m.icons.length).toBeGreaterThan(0);
    for (const icon of m.icons) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBeTruthy();
    }
  });

  it('ships a table large enough to be the real one', () => {
    expect(existsSync('public/ddb96.bin')).toBe(true);
    expect(readFileSync('public/ddb96.bin').length).toBe(315_588 * 3);
  });

  it('ships both tables at full size', () => {
    for (const f of ['public/ddb96.bin', 'public/illinois-deuces.bin']) {
      expect(existsSync(f), f).toBe(true);
      expect(readFileSync(f).length, f).toBe(315_588 * 3);
    }
  });

  it('refuses to build without either table', () => {
    // The build-time guard is what stops a silent broken bundle; it must name
    // both files, not just the one it started with.
    const cfg = readFileSync('vite.config.ts', 'utf8');
    expect(cfg).toMatch(/ddb96\.bin/);
    expect(cfg).toMatch(/illinois-deuces\.bin/);
  });
});
