export type GooglePickerFile = {
  id: string;
  name: string;
  mimeType: string;
};

type PickerWindow = Window & {
  gapi?: {
    load: (
      name: string,
      options: {
        callback: () => void;
        onerror?: () => void;
        timeout?: number;
        ontimeout?: () => void;
      },
    ) => void;
  };
  google?: any;
};

type PickerPresentation = "auto" | "dialog" | "embedded";

let pickerApiPromise: Promise<void> | null = null;

function loadPickerApi() {
  if (pickerApiPromise) return pickerApiPromise;

  pickerApiPromise = new Promise<void>((resolve, reject) => {
    const win = window as PickerWindow;

    const fail = (message: string) => {
      pickerApiPromise = null;
      reject(new Error(message));
    };

    const loadPicker = () => {
      if (!win.gapi) {
        fail("A biblioteca do Google não foi carregada.");
        return;
      }
      win.gapi.load("picker", {
        callback: resolve,
        onerror: () => fail("Não foi possível carregar o Google Picker."),
        timeout: 10000,
        ontimeout: () => fail("O Google Picker demorou demais para responder."),
      });
    };

    if (win.google?.picker && win.gapi) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-pontoview-google-picker="true"]',
    );
    if (existing) {
      if (win.gapi) loadPicker();
      else {
        existing.addEventListener("load", loadPicker, { once: true });
        existing.addEventListener(
          "error",
          () => fail("Não foi possível carregar os serviços do Google."),
          { once: true },
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.pontoviewGooglePicker = "true";
    script.referrerPolicy = "strict-origin-when-cross-origin";
    script.addEventListener("load", loadPicker, { once: true });
    script.addEventListener(
      "error",
      () => fail("Não foi possível carregar os serviços do Google."),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return pickerApiPromise;
}

export function preloadGoogleDrivePicker() {
  return loadPickerApi();
}

function shouldEmbedPicker() {
  const userAgent = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari =
    /Safari/i.test(userAgent) &&
    !/Chrome|CriOS|Chromium|Edg|OPR|Android/i.test(userAgent);
  const compact = window.matchMedia?.("(max-width: 900px)").matches ?? false;

  return iOS || (safari && compact);
}

export async function openGoogleDrivePicker({
  accessToken,
  apiKey,
  appId,
  presentation = "auto",
}: {
  accessToken: string;
  apiKey: string;
  appId: string;
  presentation?: PickerPresentation;
}): Promise<GooglePickerFile[]> {
  await loadPickerApi();

  const win = window as PickerWindow;
  const google = win.google;
  if (!google?.picker) throw new Error("GOOGLE_PICKER_UNAVAILABLE");

  const useEmbedded =
    presentation === "embedded" ||
    (presentation === "auto" && shouldEmbedPicker());

  return new Promise<GooglePickerFile[]>((resolve, reject) => {
    let cleanup: (() => void) | null = null;

    const finish = (files: GooglePickerFile[]) => {
      cleanup?.();
      resolve(files);
    };

    const fail = (message: string) => {
      cleanup?.();
      reject(new Error(message));
    };

    try {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
      view.setIncludeFolders(true);
      view.setSelectFolderEnabled(false);
      if (google.picker.DocsViewMode?.LIST) {
        view.setMode(google.picker.DocsViewMode.LIST);
      }
      view.setMimeTypes(
        [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/x-matroska",
        ].join(","),
      );

      const builder = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setOrigin(window.location.origin)
        .addView(view)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback((data: Record<string, unknown>) => {
          const action = data[google.picker.Response.ACTION] ?? data.action;

          if (action === google.picker.Action.CANCEL) {
            finish([]);
            return;
          }

          if (action === google.picker.Action.ERROR) {
            fail("GOOGLE_PICKER_ERROR");
            return;
          }

          if (action !== google.picker.Action.PICKED) return;

          const documents =
            (data[google.picker.Response.DOCUMENTS] as
              | Array<Record<string, unknown>>
              | undefined) ||
            (data.docs as Array<Record<string, unknown>> | undefined) ||
            [];

          const files = documents
            .map((document) => ({
              id: String(document[google.picker.Document.ID] ?? document.id ?? ""),
              name: String(
                document[google.picker.Document.NAME] ??
                  document.name ??
                  "Arquivo do Drive",
              ),
              mimeType: String(
                document[google.picker.Document.MIME_TYPE] ??
                  document.mimeType ??
                  "",
              ),
            }))
            .filter(
              (file) =>
                file.id &&
                (file.mimeType.startsWith("image/") ||
                  file.mimeType.startsWith("video/")),
            );

          finish(files);
        });

      if (!useEmbedded) {
        builder.build().setVisible(true);
        return;
      }

      const previous = document.querySelector<HTMLElement>(
        '[data-pontoview-drive-picker="true"]',
      );
      previous?.remove();

      const previousOverflow = document.body.style.overflow;
      const overlay = document.createElement("section");
      overlay.dataset.pontoviewDrivePicker = "true";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Selecionar arquivos do Google Drive");
      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483646",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      });

      const header = document.createElement("div");
      Object.assign(header.style, {
        minHeight: "54px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "0 16px",
        borderBottom: "1px solid rgba(15, 23, 42, .12)",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#0f172a",
        background: "#ffffff",
      });

      const title = document.createElement("strong");
      title.textContent = "Google Drive";
      title.style.fontSize = "16px";

      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "Fechar";
      close.setAttribute("aria-label", "Fechar seletor do Google Drive");
      Object.assign(close.style, {
        border: "0",
        borderRadius: "10px",
        padding: "9px 12px",
        background: "#eef2f7",
        color: "#0f172a",
        font: "600 14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      });

      const iframe = document.createElement("iframe");
      iframe.title = "Arquivos do Google Drive";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.src = String(builder.toUri());
      Object.assign(iframe.style, {
        width: "100%",
        flex: "1 1 auto",
        minHeight: "0",
        border: "0",
        background: "#ffffff",
      });

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") finish([]);
      };
      close.addEventListener("click", () => finish([]));
      window.addEventListener("keydown", onKeyDown);

      cleanup = () => {
        window.removeEventListener("keydown", onKeyDown);
        overlay.remove();
        document.body.style.overflow = previousOverflow;
      };

      header.append(title, close);
      overlay.append(header, iframe);
      document.body.style.overflow = "hidden";
      document.body.appendChild(overlay);
    } catch {
      fail("GOOGLE_PICKER_ERROR");
    }
  });
}
