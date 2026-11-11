'use strict';
const PLAYER_ORIGIN = 'https://tv.pontoview.com.br';
function isTrustedNavigation(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 4096) return false;
  try { const url = new URL(rawUrl); return url.protocol === 'https:' && url.origin === PLAYER_ORIGIN; } catch { return false; }
}
function isAllowedResourceRequest(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 16384) return false;
  try { return ['https:', 'wss:', 'data:', 'blob:', 'about:'].includes(new URL(rawUrl).protocol); } catch { return false; }
}
function getSafeOrigin(rawUrl) {
  try { const url = new URL(rawUrl); return ['data:', 'blob:'].includes(url.protocol) ? url.protocol : url.origin; } catch { return 'invalid'; }
}
module.exports = { PLAYER_ORIGIN, isTrustedNavigation, isAllowedResourceRequest, getSafeOrigin };
