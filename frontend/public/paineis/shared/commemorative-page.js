(function () {
  var config = window.PV_COMM_CONFIG;
  if (!config) return;

  function supportsModernJavaScript() {
    try {
      new Function("const a={x:1}; const b={...a}; const f=(v)=>v?.x ?? 0; return `${f(b)}`;");
      return true;
    } catch (error) {
      return false;
    }
  }

  function safe(value) {
    return String(value == null ? "" : value);
  }

  function renderTags(tags) {
    if (!Array.isArray(tags)) return "";
    var html = "";
    for (var i = 0; i < tags.length; i += 1) {
      html += '<span class="seasonal-tag">' + safe(tags[i]) + '</span>';
    }
    return html;
  }

  function fallbackSymbol() {
    var label = safe(config.symbolLabel || config.name || config.title || "PontoView");
    var initials = "PV";
    var words = safe(config.name || config.title).replace(/[^A-Za-zÀ-ÿ0-9 ]/g, " ").split(/\s+/);
    if (words.length) {
      initials = words[0].charAt(0).toUpperCase();
      if (words.length > 1) initials += words[words.length - 1].charAt(0).toUpperCase();
    }
    return '<div class="pv-legacy-emblem" role="img" aria-label="' + label + '">' +
      '<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<circle cx="160" cy="160" r="112" fill="rgba(255,255,255,.45)" stroke="var(--seasonal-accent)" stroke-width="8" opacity=".95" />' +
        '<path d="M74 159c0-48 39-87 87-87" fill="none" stroke="var(--seasonal-accent-2)" stroke-width="12" stroke-linecap="round" opacity=".7" />' +
        '<path d="M246 161c0 48-39 87-87 87" fill="none" stroke="var(--seasonal-accent)" stroke-width="12" stroke-linecap="round" opacity=".72" />' +
        '<circle cx="160" cy="160" r="46" fill="var(--seasonal-accent)" opacity=".95" />' +
        '<text x="160" y="172" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#fff">' + initials + '</text>' +
      '</svg>' +
    '</div>';
  }

  function renderLegacy() {
    var style = document.createElement("style");
    style.textContent =
      'html,body{width:100%;height:100%;margin:0;overflow:hidden;}' +
      '.pv-seasonal{width:100%;height:100%;min-height:100%;display:block;position:relative;overflow:hidden;}' +
      '.seasonal-stage{width:100%;height:100%;box-sizing:border-box;display:flex!important;align-items:center;justify-content:space-between;padding:5vw!important;gap:4vw!important;}' +
      '.seasonal-copy{width:58%;display:block!important;}' +
      '.seasonal-visual{width:36%;height:72%;display:flex!important;align-items:center;justify-content:center;}' +
      '.seasonal-symbol-stage{width:100%;height:100%;display:flex!important;align-items:center;justify-content:center;}' +
      '.pv-legacy-emblem{width:90%;max-width:430px;}' +
      '.pv-legacy-emblem svg{display:block;width:100%;height:auto;}' +
      '.seasonal-kicker{font-size:14px!important;margin-bottom:18px;}' +
      '.seasonal-title{font-size:6vw!important;line-height:.9!important;margin:0 0 22px!important;}' +
      '.seasonal-title span{display:block;}' +
      '.seasonal-lead{font-size:2.15vw!important;line-height:1.15!important;margin-bottom:18px;}' +
      '.seasonal-text{font-size:1.25vw!important;line-height:1.45!important;}' +
      '.seasonal-tags{display:flex!important;flex-wrap:wrap;gap:8px!important;margin-top:22px;}' +
      '.seasonal-tag{font-size:12px!important;padding:8px 11px!important;}' +
      '@media (orientation:portrait){' +
        '.seasonal-stage{flex-direction:column!important;justify-content:center;padding:7vw!important;gap:4vh!important;}' +
        '.seasonal-copy{width:100%;}' +
        '.seasonal-visual{width:62%;height:auto;max-height:38%;}' +
        '.seasonal-title{font-size:11vw!important;}' +
        '.seasonal-lead{font-size:4vw!important;}' +
        '.seasonal-text{font-size:2.5vw!important;}' +
      '}';
    document.head.appendChild(style);

    document.body.innerHTML =
      '<main class="pv-seasonal pv-legacy-panel">' +
        '<div class="seasonal-wave"></div>' +
        '<section class="seasonal-stage">' +
          '<div class="seasonal-copy">' +
            '<div class="seasonal-kicker">' + safe(config.kicker) + '</div>' +
            '<h1 class="seasonal-title">' + safe(config.title) + '<span>' + safe(config.subtitle) + '</span></h1>' +
            '<div class="seasonal-lead">' + safe(config.lead) + '</div>' +
            '<div class="seasonal-text">' + safe(config.text) + '</div>' +
            '<div class="seasonal-tags">' + renderTags(config.tags) + '</div>' +
          '</div>' +
          '<div class="seasonal-visual no-qr"><div class="seasonal-symbol-stage">' + fallbackSymbol() + '</div></div>' +
        '</section>' +
      '</main>';
  }

  if (supportsModernJavaScript()) {
    var script = document.createElement("script");
    script.src = "../shared/commemorative-modern.js?v=2";
    script.onerror = renderLegacy;
    document.body.appendChild(script);
    return;
  }

  renderLegacy();
}());
