(() => {
  const config = window.PV_COMM_CONFIG;
  if (!config) return;

  const safe = (value) => String(value ?? "");
  const root = document.body;

  const icons = {
    crown: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M58 126l52 38 50-86 50 86 52-38-21 110H79z" fill="var(--comm-accent)"/>
        <rect x="88" y="226" width="144" height="24" rx="12" fill="var(--comm-accent-2)"/>
        <circle cx="110" cy="164" r="10" fill="var(--comm-highlight)"/>
        <circle cx="160" cy="124" r="10" fill="var(--comm-highlight)"/>
        <circle cx="210" cy="164" r="10" fill="var(--comm-highlight)"/>
      </svg>`,
    carnival: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs><linearGradient id="maskA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c4dff"/><stop offset="1" stop-color="#00b8d4"/></linearGradient></defs>
        <path d="M68 116c28-28 62-34 92-18 30-16 64-10 92 18-3 76-38 116-92 116S71 192 68 116z" fill="url(#maskA)"/>
        <ellipse cx="122" cy="152" rx="24" ry="16" fill="white"/><ellipse cx="198" cy="152" rx="24" ry="16" fill="white"/>
        <path d="M130 198c18 12 42 12 60 0" fill="none" stroke="white" stroke-width="10" stroke-linecap="round"/>
        <circle cx="64" cy="78" r="10" fill="#ffca28"/><circle cx="250" cy="88" r="9" fill="#ff4081"/><circle cx="232" cy="54" r="7" fill="#00c853"/>
        <path d="M84 66l14 22M258 120l18 20M44 166l20 6" stroke="var(--comm-highlight)" stroke-width="8" stroke-linecap="round"/>
      </svg>`,
    flower: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g transform="translate(160 150)">
          <ellipse rx="34" ry="74" transform="rotate(0)" fill="var(--comm-accent)"/>
          <ellipse rx="34" ry="74" transform="rotate(60)" fill="var(--comm-accent-2)"/>
          <ellipse rx="34" ry="74" transform="rotate(120)" fill="var(--comm-accent)"/>
          <circle r="34" fill="var(--comm-highlight)"/>
        </g>
        <path d="M160 184v84" stroke="var(--comm-deep)" stroke-width="12" stroke-linecap="round"/>
        <path d="M160 226c-34-28-56-14-62 10 30 2 48 0 62-10z" fill="var(--comm-soft-accent)"/>
      </svg>`,
    cross: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="137" y="54" width="46" height="212" rx="10" fill="var(--comm-accent)"/>
        <rect x="84" y="112" width="152" height="46" rx="10" fill="var(--comm-accent)"/>
        <circle cx="160" cy="160" r="116" fill="none" stroke="var(--comm-highlight)" stroke-opacity=".25" stroke-width="8"/>
      </svg>`,
    easter: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M160 48c-54 0-92 88-92 146 0 50 38 82 92 82s92-32 92-82c0-58-38-146-92-146z" fill="var(--comm-accent)"/>
        <path d="M88 154c42 26 102 26 144 0M80 196c48 30 112 30 160 0" fill="none" stroke="var(--comm-highlight)" stroke-width="14"/>
        <circle cx="126" cy="118" r="12" fill="var(--comm-highlight)"/><circle cx="194" cy="118" r="12" fill="var(--comm-highlight)"/>
      </svg>`,
    star: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M160 48l29 70 76 7-58 49 18 74-65-39-65 39 18-74-58-49 76-7z" fill="var(--comm-accent)"/>
        <circle cx="160" cy="160" r="112" fill="none" stroke="var(--comm-highlight)" stroke-opacity=".24" stroke-width="8"/>
      </svg>`,
    work: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="58" y="108" width="204" height="132" rx="24" fill="var(--comm-accent)"/>
        <rect x="118" y="76" width="84" height="44" rx="14" fill="none" stroke="var(--comm-accent-2)" stroke-width="14"/>
        <rect x="58" y="150" width="204" height="30" fill="var(--comm-accent-2)"/>
        <circle cx="160" cy="165" r="12" fill="var(--comm-highlight)"/>
      </svg>`,
    heartFlower: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M160 258S64 198 64 126c0-36 26-62 60-62 22 0 38 12 48 28 10-16 26-28 48-28 34 0 60 26 60 62 0 72-96 132-120 132z" fill="var(--comm-accent)"/>
        <circle cx="160" cy="126" r="30" fill="var(--comm-highlight)"/>
        <g fill="var(--comm-accent-2)"><ellipse cx="160" cy="84" rx="18" ry="34"/><ellipse cx="160" cy="168" rx="18" ry="34"/><ellipse cx="118" cy="126" rx="34" ry="18"/><ellipse cx="202" cy="126" rx="34" ry="18"/></g>
      </svg>`,
    chalice: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="160" cy="82" r="46" fill="var(--comm-highlight)"/>
        <path d="M104 122h112c0 62-28 94-56 94s-56-32-56-94z" fill="var(--comm-accent)"/>
        <rect x="148" y="210" width="24" height="42" rx="10" fill="var(--comm-accent-2)"/>
        <rect x="110" y="246" width="100" height="20" rx="10" fill="var(--comm-accent-2)"/>
      </svg>`,
    hearts: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M118 242S54 202 54 150c0-28 20-48 46-48 20 0 34 12 42 26 8-14 22-26 42-26 26 0 46 20 46 48 0 52-64 92-112 92z" fill="var(--comm-accent)"/>
        <path d="M202 220s-44-28-44-66c0-22 16-38 36-38 15 0 26 8 32 18 6-10 17-18 32-18 20 0 36 16 36 38 0 38-44 66-92 66z" fill="var(--comm-accent-2)" opacity=".92"/>
      </svg>`,
    junina: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M48 72h224" stroke="var(--comm-deep)" stroke-width="8" stroke-linecap="round"/>
        <path d="M70 76l22 44 22-44M118 76l22 44 22-44M166 76l22 44 22-44M214 76l22 44 22-44" fill="var(--comm-accent)"/>
        <path d="M160 122c38 40 44 72 14 102 3-24-8-34-20-44 2 28-18 40-18 64-34-24-28-74 24-122z" fill="var(--comm-accent)"/>
        <path d="M110 254h100" stroke="var(--comm-deep)" stroke-width="16" stroke-linecap="round"/>
      </svg>`,
    family: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="120" cy="116" r="36" fill="var(--comm-accent)"/><circle cx="200" cy="116" r="36" fill="var(--comm-accent-2)"/>
        <path d="M72 250c8-56 34-86 88-86s80 30 88 86" fill="var(--comm-soft-accent)"/>
        <path d="M160 244s-50-34-50-76c0-22 16-38 36-38 15 0 26 8 32 20 6-12 17-20 32-20 20 0 36 16 36 38 0 42-50 76-86 76z" fill="var(--comm-highlight)" opacity=".92"/>
      </svg>`,
    tieHeart: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M160 260S72 206 72 138c0-34 24-58 56-58 20 0 36 10 46 26 10-16 26-26 46-26 32 0 56 24 56 58 0 68-88 122-116 122z" fill="var(--comm-accent)"/>
        <path d="M146 100h28l18 30-32 64-32-64z" fill="var(--comm-highlight)"/>
        <path d="M146 100l14 16 14-16" fill="none" stroke="var(--comm-accent-2)" stroke-width="8"/>
      </svg>`,
    brazil: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="64" y="64" width="192" height="192" rx="46" fill="#168447"/>
        <path d="M160 92l86 68-86 68-86-68z" fill="#f2c94c"/>
        <circle cx="160" cy="160" r="44" fill="#2b57a4"/>
        <path d="M124 158c24-10 48-10 72 0" fill="none" stroke="white" stroke-width="8" stroke-linecap="round"/>
      </svg>`,
    mary: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M160 54c-46 0-82 70-82 164h164c0-94-36-164-82-164z" fill="var(--comm-accent)"/>
        <circle cx="160" cy="114" r="30" fill="var(--comm-highlight)"/>
        <path d="M114 226c12-46 28-70 46-70s34 24 46 70" fill="var(--comm-accent-2)"/>
        <path d="M128 62l32-22 32 22" fill="none" stroke="var(--comm-highlight)" stroke-width="10" stroke-linecap="round"/>
      </svg>`,
    balloons: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="110" cy="112" rx="46" ry="58" fill="#ff6b6b"/><ellipse cx="210" cy="110" rx="44" ry="56" fill="#4dabf7"/><ellipse cx="160" cy="160" rx="42" ry="54" fill="#ffd43b"/>
        <path d="M110 170c18 26 22 54 4 92M210 166c-16 28-18 54 0 94M160 214c6 18 8 34 4 52" fill="none" stroke="var(--comm-deep)" stroke-width="5"/>
      </svg>`,
    book: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M58 86c44-12 78 2 102 26v142c-26-24-60-34-102-22z" fill="var(--comm-accent)"/>
        <path d="M262 86c-44-12-78 2-102 26v142c26-24 60-34 102-22z" fill="var(--comm-accent-2)"/>
        <path d="M160 112v142" stroke="var(--comm-highlight)" stroke-width="8"/>
        <circle cx="228" cy="74" r="26" fill="var(--comm-highlight)"/>
      </svg>`,
    candle: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="118" y="126" width="84" height="132" rx="20" fill="var(--comm-accent)"/>
        <path d="M160 110c-34-28-12-66 0-84 12 18 34 56 0 84z" fill="var(--comm-highlight)"/>
        <ellipse cx="160" cy="128" rx="42" ry="12" fill="var(--comm-accent-2)"/>
      </svg>`,
    unity: `
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="112" cy="122" r="38" fill="var(--comm-accent)"/><circle cx="208" cy="122" r="38" fill="var(--comm-accent-2)"/>
        <path d="M72 248c8-56 40-84 88-84s80 28 88 84" fill="var(--comm-soft-accent)"/>
        <circle cx="160" cy="206" r="34" fill="var(--comm-highlight)"/>
        <path d="M92 76l18-26M228 76l-18-26M160 62V28" stroke="var(--comm-highlight)" stroke-width="8" stroke-linecap="round"/>
      </svg>`
  };

  root.innerHTML = `
    <main class="pv-seasonal">
      <div class="seasonal-wave"></div>
      <section class="seasonal-stage">
        <div class="seasonal-copy">
          <div class="seasonal-kicker">${safe(config.kicker)}</div>
          <h1 class="seasonal-title">${safe(config.title)}<span>${safe(config.subtitle)}</span></h1>
          <div class="seasonal-lead">${safe(config.lead)}</div>
          <div class="seasonal-text">${safe(config.text)}</div>
          <div class="seasonal-tags">
            ${(config.tags || []).map((tag) => `<span class="seasonal-tag">${safe(tag)}</span>`).join("")}
          </div>
        </div>
        <div class="seasonal-visual no-qr">
          <div class="seasonal-symbol-stage">
            <div class="seasonal-symbol" role="img" aria-label="${safe(config.symbolLabel || config.name || "")}">
              ${icons[config.symbol] || icons.star}
            </div>
          </div>
        </div>
      </section>
    </main>
  `;
})();
