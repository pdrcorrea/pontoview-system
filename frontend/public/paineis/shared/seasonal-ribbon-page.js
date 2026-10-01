(() => {
  const config = window.PV_SEASONAL_CONFIG;
  if (!config) return;

  const body = document.body;
  const safe = (value) => String(value ?? "");

  const tags = Array.isArray(config.tags)
    ? config.tags.map((tag) => `<span class="seasonal-tag">${safe(tag)}</span>`).join("")
    : "";

  const qr = config.qrData
    ? `
      <aside class="seasonal-qr">
        <div class="seasonal-qr-grid">
          <div class="seasonal-qr-box">
            <img src="data:image/png;base64,${config.qrData}" alt="QR Code para informações oficiais">
          </div>
          <div class="seasonal-qr-copy">
            <b>Saiba mais</b>
            <p>${safe(config.qrText || "Acesse informações oficiais sobre a campanha.")}</p>
            <small>${safe(config.source || "Fonte oficial")}</small>
          </div>
        </div>
      </aside>`
    : "";

  const ribbonStyle = [
    `--ribbon-soft:${config.ribbonSoft || "#ffd0dc"}`,
    `--ribbon-main:${config.ribbonMain || "#f04f89"}`,
    `--ribbon-deep:${config.ribbonDeep || "#c92866"}`,
    `--ribbon-edge:${config.ribbonEdge || "#ad1d52"}`,
    `--ribbon-shadow:${config.ribbonShadow || "rgba(143,33,77,.2)"}`,
  ].join(";");

  body.innerHTML = `
    <main class="pv-seasonal">
      <div class="seasonal-wave"></div>
      <section class="seasonal-stage">
        <div class="seasonal-copy">
          <div class="seasonal-kicker">${safe(config.kicker)}</div>
          <h1 class="seasonal-title">${safe(config.title)}<span>${safe(config.subtitle)}</span></h1>
          <div class="seasonal-lead">${safe(config.lead)}</div>
          <div class="seasonal-text">${safe(config.text)}</div>
          <div class="seasonal-tags">${tags}</div>
        </div>

        <div class="seasonal-visual">
          <div class="seasonal-symbol-stage">
            <div
              class="campaign-ribbon-wrap"
              data-pv-campaign-ribbon
              role="img"
              aria-label="${safe(config.ribbonLabel || "Laço de conscientização")}"
              style="${ribbonStyle}"
            ></div>
          </div>
          ${qr}
        </div>
      </section>
    </main>
  `;

  const ribbonScript = document.createElement("script");
  ribbonScript.src = "../shared/campaign-ribbon.js?v=3";
  document.body.appendChild(ribbonScript);
})();
