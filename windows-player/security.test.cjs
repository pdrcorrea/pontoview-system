'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isTrustedNavigation, isAllowedResourceRequest } = require('./security.cjs');
test('top-level navigation stays in PontoView origin', () => {
  for (const u of ['https://tv.pontoview.com.br/', 'https://tv.pontoview.com.br/player', 'https://tv.pontoview.com.br:443/a']) assert.equal(isTrustedNavigation(u), true, u);
  for (const u of ['http://tv.pontoview.com.br', 'https://tv.pontoview.com.br.evil.test/', 'https://evil.test/@tv.pontoview.com.br', 'javascript:alert(1)', 'data:text/html,hello', 'file:///C:/malware', 'https://tv.pontoview.com.br:444/a', 'about:blank', '', undefined]) assert.equal(isTrustedNavigation(u), false, String(u));
});
test('network requests reject insecure and privileged schemes', () => {
  for (const u of ['https://example.com/a', 'wss://example.com/live', 'blob:https://tv.pontoview.com.br/1', 'data:image/png;base64,AA==']) assert.equal(isAllowedResourceRequest(u), true, u);
  for (const u of ['http://example.com/a', 'ws://example.com/live', 'javascript:alert(1)', 'ftp://example.com/a', 'file:///C:/sensitive.txt', 'custom://abc', '']) assert.equal(isAllowedResourceRequest(u), false, u);
});
