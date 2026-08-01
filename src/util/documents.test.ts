import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isContentDocument, isHtmlContentType } from './documents.js';

test('assets, data endpoints and downloads are not content documents', () => {
  for (const url of [
    'https://example.com/assets/images/hero.webp',
    'https://example.com/assets/images/hero.PNG',
    'https://example.com/api/site.json',
    'https://example.com/llms.txt',
    'https://example.com/robots.txt',
    'https://example.com/sitemap.xml',
    'https://example.com/feed/',
    'https://example.com/styles/main.css',
    'https://example.com/app.js',
    'https://example.com/fonts/inter.woff2',
    'https://example.com/whitepaper.pdf',
    'https://example.com/assets/hero.webp?v=2',
  ]) {
    assert.equal(isContentDocument(url), false, url);
  }
});

test('pages are content documents whatever they are served as', () => {
  for (const url of [
    'https://example.com/',
    'https://example.com/pricing',
    'https://example.com/blog/post/',
    'https://example.com/index.html',
    'https://example.com/legacy.php',
    'https://example.com/careers.aspx',
    'https://example.com/2026/08/01/a-post-about-node.js-tooling',
  ]) {
    assert.equal(isContentDocument(url), true, url);
  }
});

test('a missing content type is parsed rather than dropped', () => {
  assert.equal(isHtmlContentType(null), true);
  assert.equal(isHtmlContentType('text/html; charset=utf-8'), true);
  assert.equal(isHtmlContentType('application/xhtml+xml'), true);
  assert.equal(isHtmlContentType('image/webp'), false);
  assert.equal(isHtmlContentType('application/json'), false);
});
