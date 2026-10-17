type YouTubePlayerTarget = {
  mute?: () => void;
  playVideo?: () => void;
  getPlayerState?: () => number;
};

type YouTubePlayerEvent = {
  target?: YouTubePlayerTarget;
};

type YouTubePlayerOptions = {
  events?: Record<string, ((event: YouTubePlayerEvent) => void) | undefined>;
  [key: string]: unknown;
};

function recoverAutoplay(target?: YouTubePlayerTarget) {
  if (!target) return;
  try {
    target.mute?.();
    target.playVideo?.();
  } catch {
    // A falha de recuperação não pode derrubar o player principal.
  }
}

function installYouTubeAutoplayGuard() {
  const runtime = window as typeof window & {
    YT?: { Player?: any };
    onYouTubeIframeAPIReady?: () => void;
  };

  const NativePlayer = runtime.YT?.Player;
  if (!NativePlayer || NativePlayer.__pvAutoplayGuard) return;

  const GuardedPlayer = function (element: HTMLElement, options: YouTubePlayerOptions = {}) {
    const originalEvents = options.events || {};
    const originalReady = originalEvents.onReady;
    const originalBlocked = originalEvents.onAutoplayBlocked;

    const guardedOptions: YouTubePlayerOptions = {
      ...options,
      events: {
        ...originalEvents,
        onReady: (event: YouTubePlayerEvent) => {
          originalReady?.(event);

          // WebViews mais antigos podem não disparar onAutoplayBlocked. Depois
          // do onReady, verificamos se o vídeo realmente entrou em reprodução.
          window.setTimeout(() => {
            const state = event.target?.getPlayerState?.();
            // 1 = playing, 3 = buffering. Qualquer outro estado neste ponto
            // indica que o autoplay provavelmente foi bloqueado.
            if (state !== 1 && state !== 3) recoverAutoplay(event.target);
          }, 1600);
        },
        onAutoplayBlocked: (event: YouTubePlayerEvent) => {
          // Em sinalização digital a prioridade é o conteúdo continuar sozinho.
          // Se o navegador bloquear autoplay com áudio, retomamos silenciado.
          recoverAutoplay(event.target);
          originalBlocked?.(event);
        },
      },
    };

    return new NativePlayer(element, guardedOptions);
  } as any;

  GuardedPlayer.prototype = NativePlayer.prototype;
  Object.setPrototypeOf(GuardedPlayer, NativePlayer);
  GuardedPlayer.__pvAutoplayGuard = true;
  runtime.YT!.Player = GuardedPlayer;
}

const runtime = window as typeof window & {
  YT?: { Player?: any };
  onYouTubeIframeAPIReady?: () => void;
};

const previousReady = runtime.onYouTubeIframeAPIReady;
runtime.onYouTubeIframeAPIReady = () => {
  previousReady?.();
  installYouTubeAutoplayGuard();
};

installYouTubeAutoplayGuard();

export {};
