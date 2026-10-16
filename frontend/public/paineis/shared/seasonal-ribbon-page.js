(function () {
  var config = window.PV_SEASONAL_CONFIG;
  if (!config) return;

  var body = document.body;

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

  function renderQr() {
    if (!config.qrData) return "";
    return '<aside class="seasonal-qr">' +
      '<div class="seasonal-qr-grid">' +
        '<div class="seasonal-qr-box">' +
          '<img src="data:image/png;base64,' + safe(config.qrData) + '" alt="QR Code para informações oficiais">' +
        '</div>' +
        '<div class="seasonal-qr-copy">' +
          '<b>Saiba mais</b>' +
          '<p>' + safe(config.qrText || "Acesse informações oficiais sobre a campanha.") + '</p>' +
          '<small>' + safe(config.source || "Fonte oficial") + '</small>' +
        '</div>' +
      '</div>' +
    '</aside>';
  }

  var ribbonStyle = [
    "--ribbon-soft:" + (config.ribbonSoft || "#ffd0dc"),
    "--ribbon-main:" + (config.ribbonMain || "#f04f89"),
    "--ribbon-deep:" + (config.ribbonDeep || "#c92866"),
    "--ribbon-edge:" + (config.ribbonEdge || "#ad1d52"),
    "--ribbon-shadow:" + (config.ribbonShadow || "rgba(143,33,77,.2)")
  ].join(";");

  body.innerHTML =
    '<main class="pv-seasonal">' +
      '<div class="seasonal-wave"></div>' +
      '<section class="seasonal-stage">' +
        '<div class="seasonal-copy">' +
          '<div class="seasonal-kicker">' + safe(config.kicker) + '</div>' +
          '<h1 class="seasonal-title">' + safe(config.title) + '<span>' + safe(config.subtitle) + '</span></h1>' +
          '<div class="seasonal-lead">' + safe(config.lead) + '</div>' +
          '<div class="seasonal-text">' + safe(config.text) + '</div>' +
          '<div class="seasonal-tags">' + renderTags(config.tags) + '</div>' +
        '</div>' +
        '<div class="seasonal-visual">' +
          '<div class="seasonal-symbol-stage">' +
            '<div class="campaign-ribbon-wrap" data-pv-campaign-ribbon role="img" aria-label="' + safe(config.ribbonLabel || "Laço de conscientização") + '" style="' + ribbonStyle + '"></div>' +
          '</div>' +
          renderQr() +
        '</div>' +
      '</section>' +
    '</main>';

  var ribbonScript = document.createElement("script");
  ribbonScript.src = "../shared/campaign-ribbon.js?v=5";
  document.body.appendChild(ribbonScript);
}());
