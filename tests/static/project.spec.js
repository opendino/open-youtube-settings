/**
 * Checks that need no browser: locale files, manifest wiring, the settings
 * defaults duplicated between the popup and the content script, and the
 * packaged builds.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { ROOT_DIR } from '../helpers/extension.js';
import { prepareDirectory } from '../../scripts/package.js';

const read = (file) => fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const locales = fs.readdirSync(path.join(ROOT_DIR, '_locales'));
const messages = Object.fromEntries(
  locales.map((lang) => [lang, JSON.parse(read(`_locales/${lang}/messages.json`))])
);

/** Evaluates the `const NAME = {...}` literal found in a source file. */
function constLiteral(file, name) {
  const source = read(file);
  const start = source.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(`${name} not found in ${file}`);
  let depth = 0;
  let i = source.indexOf('{', start);
  const from = i;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) break;
  }
  return vm.runInNewContext(`(${source.slice(from, i + 1)})`);
}

test.describe('locales', () => {
  test('every language has exactly the English keys, none empty', () => {
    const keys = Object.keys(messages.en).sort();
    for (const lang of locales) {
      expect(Object.keys(messages[lang]).sort(), lang).toEqual(keys);
      for (const [key, entry] of Object.entries(messages[lang])) {
        expect(entry.message, `${lang}.${key}`).toBeTruthy();
      }
    }
  });

  test('every data-i18n key in the popup exists', () => {
    const used = [...read('popup.html').matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
    for (const key of used) expect(messages.en[key], key).toBeDefined();
  });

  test('every on-page string the content script needs is translated', () => {
    const keys = Object.keys(constLiteral('content.js', 'STRING_FALLBACK'));
    const sent = read('popup.js').match(/const CONTENT_STRING_KEYS = \[([^\]]+)\]/)[1];
    for (const key of keys) {
      expect(sent, `popup forwards ${key}`).toContain(`'${key}'`);
      expect(messages.en[key], key).toBeDefined();
    }
  });

  test('every language offered in the popup has a locale folder', () => {
    const offered = [...read('popup.html').matchAll(/data-lang="([^"]+)"/g)].map((m) => m[1]);
    expect(offered.sort()).toEqual([...locales].sort());
  });
});

test.describe('manifest and settings', () => {
  test('every file the manifest references exists', () => {
    const files = [
      ...manifest.content_scripts.flatMap((c) => c.js || []),
      manifest.action.default_popup,
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon)
    ];
    for (const file of files) expect(fs.existsSync(path.join(ROOT_DIR, file)), file).toBe(true);
  });

  test('manifest and package.json carry the same version', () => {
    // Both stores accept 1-4 dot-separated integers; npm needs exactly three.
    expect(manifest.version).toMatch(/^\d+(\.\d+){0,3}$/);
    const padded = [...manifest.version.split('.'), '0', '0'].slice(0, 3).join('.');
    expect(JSON.parse(read('package.json')).version).toBe(padded);
  });

  test('popup and content script agree on every default', () => {
    expect(constLiteral('popup.js', 'DEFAULTS')).toEqual(constLiteral('content.js', 'DEFAULTS'));
  });

  test('every popup control maps to a known setting', () => {
    const defaults = constLiteral('content.js', 'DEFAULTS');
    const html = read('popup.html');
    const controls = read('popup.js').match(/const CONTROLS = \{([\s\S]*?)\n\};/)[1];
    for (const [, key, id] of controls.matchAll(/^\s+(\w+): \{ id: '([^']+)'/gm)) {
      expect(defaults, key).toHaveProperty(key);
      expect(html, `#${id} in popup.html`).toContain(`id="${id}"`);
    }
  });

  test('every shortcut button maps to an action the page handles', () => {
    const content = read('content.js');
    const actions = [...read('popup.html').matchAll(/class="shortcut-btn" data-shortcut="(\w+)"/g)];
    expect(actions.length).toBeGreaterThan(0);
    for (const [, action] of actions) expect(content, action).toMatch(new RegExp(`\\b${action}:`));
  });
});

/** Builds one flavour of the extension into a fresh temporary directory. */
function build(target) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yte-${target}-`));
  const log = console.log;
  console.log = () => {};
  try {
    prepareDirectory(dir, target === 'chrome');
  } finally {
    console.log = log;
  }
  return dir;
}

/** Every file below a directory, as forward-slash paths relative to it. */
function listFiles(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`]
  );
}

test.describe('packaging', () => {
  for (const target of ['chrome', 'firefox']) {
    test(`${target} build ships only files the extension uses`, () => {
      const dir = build(target);
      const built = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
      const popupHtml = fs.readFileSync(path.join(dir, built.action.default_popup), 'utf8');
      const used = new Set([
        'manifest.json',
        built.action.default_popup,
        ...built.content_scripts.flatMap((c) => c.js || []),
        ...Object.values(built.icons),
        ...Object.values(built.action.default_icon),
        // Local scripts and stylesheets the popup pulls in.
        ...[...popupHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
          .map((m) => m[1])
          .filter((ref) => !/^[a-z]+:/i.test(ref))
      ]);

      for (const lang of locales) used.add(`_locales/${lang}/messages.json`);

      const unused = listFiles(dir).filter((file) => !used.has(file));
      expect(unused, 'packaged but never loaded').toEqual([]);
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test(`${target} build contains every manifest file`, () => {
      const dir = build(target);
      const built = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
      for (const file of built.content_scripts.flatMap((c) => c.js)) {
        expect(fs.existsSync(path.join(dir, file)), file).toBe(true);
      }
      expect(fs.existsSync(path.join(dir, built.action.default_popup))).toBe(true);
      expect(fs.existsSync(path.join(dir, '_locales', 'en', 'messages.json'))).toBe(true);
      if (target === 'chrome') expect(built.browser_specific_settings).toBeUndefined();
      else {
        const { gecko } = built.browser_specific_settings;
        expect(gecko.strict_min_version).toBe('128.0');
        // The add-on ID is permanent on addons.mozilla.org, so it must never drift from the manifest.
        expect(gecko.id).toBe(manifest.browser_specific_settings.gecko.id);
        expect(gecko.id).not.toMatch(/example\.(com|org|net)/);
      }
      fs.rmSync(dir, { recursive: true, force: true });
    });
  }
});
