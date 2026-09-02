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

let pickerApiPromise: Promise<void> | null = null;

function loadPickerApi() {
  if (pickerApiPromise) return pickerApiPromise;

  pickerApiPromise = new Promise<void>((resolve, reject) => {
    const win = window as PickerWindow;

    const loadPicker = () => {
      if (!win.gapi) {
        reject(new Error("A biblioteca do Google não foi carregada."));
        return;
      }
      win.gapi.load("picker", {
        callback: resolve,
        onerror: () => reject(new Error("Não foi possível carregar o Google Picker.")),
        timeout: 10000,
        ontimeout: () => reject(new Error("O Google Picker demorou demais para responder.")),
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
      else existing.addEventListener("load", loadPicker, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.pontoviewGooglePicker = "true";
    script.addEventListener("load", loadPicker, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Não foi possível carregar os serviços do Google.")),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return pickerApiPromise;
}

export async function openGoogleDrivePicker({
  accessToken,
  apiKey,
  appId,
}: {
  accessToken: string;
  apiKey: string;
  appId: string;
}): Promise<GooglePickerFile[]> {
  await loadPickerApi();

  const win = window as PickerWindow;
  const google = win.google;
  if (!google?.picker) throw new Error("Google Picker indisponível.");

  return new Promise<GooglePickerFile[]>((resolve, reject) => {
    try {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
      view.setIncludeFolders(true);
      view.setSelectFolderEnabled(false);
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
      if (typeof view.setEnableDrives === "function") view.setEnableDrives(true);

      const builder = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setOrigin(window.location.origin)
        .addView(view)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback((data: Record<string, unknown>) => {
          const action =
            data[google.picker.Response.ACTION] ?? data.action;

          if (action === google.picker.Action.CANCEL) {
            resolve([]);
            return;
          }

          if (action !== google.picker.Action.PICKED) return;

          const documents =
            (data[google.picker.Response.DOCUMENTS] as Array<Record<string, unknown>> | undefined) ||
            (data.docs as Array<Record<string, unknown>> | undefined) ||
            [];

          const files = documents
            .map((document) => ({
              id: String(
                document[google.picker.Document.ID] ?? document.id ?? "",
              ),
              name: String(
                document[google.picker.Document.NAME] ?? document.name ?? "Arquivo do Drive",
              ),
              mimeType: String(
                document[google.picker.Document.MIME_TYPE] ?? document.mimeType ?? "",
              ),
            }))
            .filter(
              (file) =>
                file.id &&
                (file.mimeType.startsWith("image/") ||
                  file.mimeType.startsWith("video/")),
            );

          resolve(files);
        });

      if (google.picker.Feature.SUPPORT_DRIVES) {
        builder.enableFeature(google.picker.Feature.SUPPORT_DRIVES);
      }

      builder.build().setVisible(true);
    } catch (error) {
      reject(error);
    }
  });
}
