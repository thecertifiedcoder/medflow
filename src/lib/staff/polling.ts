export const QUEUE_POLL_INTERVAL_MS = 5_000;

export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface PollingScheduler {
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

export interface VisibilityPollerOptions {
  readonly intervalMs?: number;
  readonly task: () => Promise<void> | void;
  readonly onVisibilityPauseChange?: (paused: boolean) => void;
  readonly visibilitySource?: VisibilitySource | null;
  readonly scheduler?: PollingScheduler;
}

export interface VisibilityPollerController {
  readonly start: () => void;
  readonly stop: () => void;
  readonly triggerNow: () => Promise<void>;
  readonly isPaused: () => boolean;
}

/**
 * Visibility-aware 5-second queue poller:
 * - Prevents overlapping in-flight fetches (next tick schedules only after task settles).
 * - Automatically pauses timers while document.visibilityState === "hidden".
 * - Refreshes immediately and resumes the 5-second cadence when visibility returns.
 */
export function createVisibilityAwarePoller(
  options: VisibilityPollerOptions,
): VisibilityPollerController {
  const intervalMs = options.intervalMs ?? QUEUE_POLL_INTERVAL_MS;
  const visibilitySource =
    options.visibilitySource !== undefined
      ? options.visibilitySource
      : typeof document !== "undefined"
        ? document
        : null;
  const scheduler: PollingScheduler = options.scheduler ?? {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle),
  };

  let running = false;
  let inFlight = false;
  let timerHandle: ReturnType<typeof setTimeout> | null = null;
  let paused = false;

  const isDocumentHidden = (): boolean =>
    visibilitySource !== null && visibilitySource.visibilityState === "hidden";

  const clearTimer = (): void => {
    if (timerHandle !== null) {
      scheduler.clearTimeout(timerHandle);
      timerHandle = null;
    }
  };

  const setPaused = (nextPaused: boolean): void => {
    if (paused !== nextPaused) {
      paused = nextPaused;
      options.onVisibilityPauseChange?.(paused);
    }
  };

  const scheduleNext = (): void => {
    clearTimer();
    if (!running) return;
    if (isDocumentHidden()) {
      setPaused(true);
      return;
    }
    setPaused(false);
    timerHandle = scheduler.setTimeout(() => {
      timerHandle = null;
      void runTick();
    }, intervalMs);
  };

  const runTick = async (): Promise<void> => {
    if (!running || inFlight) return;
    if (isDocumentHidden()) {
      setPaused(true);
      return;
    }

    inFlight = true;
    clearTimer();
    setPaused(false);
    try {
      await options.task();
    } finally {
      inFlight = false;
      if (running) {
        scheduleNext();
      }
    }
  };

  const handleVisibilityChange = (): void => {
    if (!running) return;
    if (isDocumentHidden()) {
      clearTimer();
      setPaused(true);
    } else {
      setPaused(false);
      void runTick();
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      visibilitySource?.addEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      if (isDocumentHidden()) {
        setPaused(true);
      } else {
        void runTick();
      }
    },

    stop() {
      if (!running) return;
      running = false;
      clearTimer();
      visibilitySource?.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    },

    async triggerNow() {
      if (!running) {
        await options.task();
        return;
      }
      await runTick();
    },

    isPaused() {
      return paused;
    },
  };
}
