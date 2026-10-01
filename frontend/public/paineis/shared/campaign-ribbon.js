(() => {
  const STYLE_ID = "pv-campaign-ribbon-style";

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pv-campaign-ribbon {
        --ribbon-soft: #ffc1d8;
        --ribbon-main: #f04f89;
        --ribbon-deep: #c92866;
        --ribbon-edge: #ad1d52;
        --ribbon-shadow: rgba(143, 33, 77, .2);
        width: 100%;
        aspect-ratio: 3 / 4;
        display: grid;
        place-items: center;
        color: var(--ribbon-main);
      }

      .pv-campaign-ribbon.theme-pink {
        --ribbon-soft: #ffc1d8;
        --ribbon-main: #f04f89;
        --ribbon-deep: #c92866;
        --ribbon-edge: #ad1d52;
        --ribbon-shadow: rgba(143, 33, 77, .2);
      }

      .pv-campaign-ribbon.theme-blue {
        --ribbon-soft: #bed8ff;
        --ribbon-main: #3b82f6;
        --ribbon-deep: #1d4ed8;
        --ribbon-edge: #173e9b;
        --ribbon-shadow: rgba(29, 78, 216, .2);
      }

      .pv-campaign-ribbon.theme-yellow {
        --ribbon-soft: #ffec9a;
        --ribbon-main: #f4c430;
        --ribbon-deep: #d39b00;
        --ribbon-edge: #a67600;
        --ribbon-shadow: rgba(166, 118, 0, .2);
      }

      .pv-campaign-ribbon svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
        filter: drop-shadow(0 18px 24px var(--ribbon-shadow));
      }
    `;
    document.head.appendChild(style);
  }

  document.querySelectorAll("[data-pv-campaign-ribbon]").forEach((element, index) => {
    if (!(element instanceof HTMLElement) || element.dataset.ribbonReady === "1") return;

    const id = `pvRibbon${index + 1}`;
    element.dataset.ribbonReady = "1";
    element.classList.add("pv-campaign-ribbon");

    element.innerHTML = `
      <svg viewBox="0 0 240 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="${id}Back" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style="stop-color:var(--ribbon-soft)" />
            <stop offset="48%" style="stop-color:var(--ribbon-main)" />
            <stop offset="100%" style="stop-color:var(--ribbon-deep)" />
          </linearGradient>
          <linearGradient id="${id}Front" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" style="stop-color:var(--ribbon-soft)" />
            <stop offset="42%" style="stop-color:var(--ribbon-main)" />
            <stop offset="100%" style="stop-color:var(--ribbon-deep)" />
          </linearGradient>
          <linearGradient id="${id}Shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#fff" stop-opacity=".54" />
            <stop offset="65%" stop-color="#fff" stop-opacity=".08" />
            <stop offset="100%" stop-color="#fff" stop-opacity="0" />
          </linearGradient>
        </defs>

        <path
          d="M117 18
             C72 18 43 51 43 91
             C43 128 63 157 94 187
             L174 292
             L206 268
             L126 163
             C100 137 73 111 73 88
             C73 63 89 48 117 48
             Z"
          fill="url(#${id}Back)"
        />

        <path
          d="M123 18
             C168 18 197 51 197 91
             C197 128 177 157 146 187
             L66 292
             L34 268
             L114 163
             C140 137 167 111 167 88
             C167 63 151 48 123 48
             Z"
          fill="url(#${id}Front)"
        />

        <path
          d="M117 26
             C80 26 53 54 53 90
             C53 119 68 145 96 173"
          fill="none"
          stroke="url(#${id}Shine)"
          stroke-width="8"
          stroke-linecap="round"
        />

        <path
          d="M124 27
             C159 27 187 55 187 90
             C187 114 176 136 154 160"
          fill="none"
          stroke="rgba(255,255,255,.26)"
          stroke-width="6"
          stroke-linecap="round"
        />

        <path
          d="M109 158
             C119 167 126 176 136 189"
          fill="none"
          stroke="var(--ribbon-edge)"
          stroke-opacity=".16"
          stroke-width="3"
          stroke-linecap="round"
        />
      </svg>
    `;
  });
})();