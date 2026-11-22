import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createVisibilityAwarePoller,
  QUEUE_POLL_INTERVAL_MS,
  type PollingScheduler,
  type VisibilitySource,
} from "./polling";
import {
  fetchStaffIntakeDetail,
  fetchStaffQueue,
  fetchStaffSession,
  StaffApiClientError,
} from "./api-client";

interface FakeTimerEntry {
  readonly id: number;
  readonly fn: () => void;
  readonly ms: number;
  cleared: boolean;
}

function createFakeScheduler(): {
  readonly scheduler: PollingScheduler;
  readonly timers: FakeTimerEntry[];
  readonly activeTimers: () => FakeTimerEntry[];
  readonly fireNext: () => void;
} {
  let nextId = 1;
  const timers: FakeTimerEntry[] = [];

  const scheduler: PollingScheduler = {
    setTimeout(fn, ms) {
      const entry: FakeTimerEntry = {
        id: nextId++,
        fn,
        ms,
        cleared: false,
      };
      timers.push(entry);
      return entry.id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout(handle) {
      const id = handle as unknown as number;
      const match = timers.find((t) => t.id === id);
      if (match) match.cleared = true;
    },
  };

  return {
    scheduler,
    timers,
    activeTimers: () => timers.filter((t) => !t.cleared),
    fireNext: () => {
      const next = timers.find((t) => !t.cleared);
      assert.ok(next, "Expected an active scheduled timer to fire");
      next.cleared = true;
      next.fn();
    },
  };
}

function createFakeVisibilitySource(
  initialState: DocumentVisibilityState = "visible",
): {
  readonly source: VisibilitySource;
  readonly setVisibility: (state: DocumentVisibilityState) => void;
  readonly listenerCount: () => number;
} {
  let state: DocumentVisibilityState = initialState;
  const listeners = new Set<() => void>();

  const source: VisibilitySource = {
    get visibilityState() {
      return state;
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
  };

  return {
    source,
    setVisibility(nextState) {
      state = nextState;
      for (const listener of listeners) {
        listener();
      }
    },
    listenerCount: () => listeners.size,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("createVisibilityAwarePoller uses 5s cadence, avoids overlapping requests, pauses on hidden, and refreshes immediately on visible", async () => {
  assert.equal(QUEUE_POLL_INTERVAL_MS, 5_000);

  const fakeScheduler = createFakeScheduler();
  const fakeVisibility = createFakeVisibilitySource("visible");
  const pauseEvents: boolean[] = [];

  let inFlightCount = 0;
  let maxConcurrent = 0;
  let totalRuns = 0;
  let releaseCurrentTask: (() => void) | null = null;

  const poller = createVisibilityAwarePoller({
    intervalMs: QUEUE_POLL_INTERVAL_MS,
    visibilitySource: fakeVisibility.source,
    scheduler: fakeScheduler.scheduler,
    onVisibilityPauseChange: (paused) => pauseEvents.push(paused),
    task: async () => {
      totalRuns += 1;
      inFlightCount += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlightCount);
      await new Promise<void>((resolve) => {
        releaseCurrentTask = () => {
          inFlightCount -= 1;
          resolve();
        };
      });
    },
  });

  poller.start();
  assert.equal(totalRuns, 1, "Starts with an immediate fetch when visible");
  assert.equal(
    fakeScheduler.activeTimers().length,
    0,
    "Does not schedule next timer while task is still in-flight",
  );

  // Triggering while in-flight must not overlap.
  void poller.triggerNow();
  assert.equal(totalRuns, 1);
  assert.equal(maxConcurrent, 1);

  // Finish first fetch -> schedules next tick at 5000ms.
  releaseCurrentTask!();
  await flushMicrotasks();
  assert.equal(fakeScheduler.activeTimers().length, 1);
  assert.equal(fakeScheduler.activeTimers()[0]?.ms, 5_000);

  // Tab hidden -> clears timer and pauses polling.
  fakeVisibility.setVisibility("hidden");
  assert.equal(poller.isPaused(), true);
  assert.equal(fakeScheduler.activeTimers().length, 0);
  assert.deepEqual(pauseEvents, [true]);

  // Tab returns to visible -> immediately triggers refresh and unpauses.
  fakeVisibility.setVisibility("visible");
  assert.equal(poller.isPaused(), false);
  assert.equal(totalRuns, 2);
  assert.deepEqual(pauseEvents, [true, false]);

  releaseCurrentTask!();
  await flushMicrotasks();
  assert.equal(fakeScheduler.activeTimers().length, 1);

  // Firing the 5s timer runs the 3rd tick.
  fakeScheduler.fireNext();
  assert.equal(totalRuns, 3);
  releaseCurrentTask!();
  await flushMicrotasks();

  // Stopping removes listeners and cancels scheduled timers.
  poller.stop();
  assert.equal(fakeScheduler.activeTimers().length, 0);
  assert.equal(fakeVisibility.listenerCount(), 0);
});

test("fetchStaffQueue attaches Bearer token and retries once with forceRefresh=true on HTTP 401", async () => {
  const tokenRefreshArgs: boolean[] = [];
  const authHeadersSent: string[] = [];

  let callCount = 0;
  const mockFetch: typeof fetch = async (_input, init) => {
    callCount += 1;
    const headers = init?.headers as Record<string, string>;
    authHeadersSent.push(headers.Authorization ?? "");

    if (callCount === 1) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_OR_EXPIRED_TOKEN",
            message: "Token expired.",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        facility: {
          facilityId: "demo-clinic-01",
          facilityName: "MedFlow Synthetic Demo Clinic",
          facilityPublicCode: "DEMO-CLINIC-01",
          role: "nurse",
          isDemo: true,
        },
        items: [],
        pagination: { limit: 25, offset: 0, total: 0, hasMore: false },
        counts: { unassigned: 0, aiUnavailable: 0 },
        fetchedAt: "2026-11-22T12:00:00.000Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const result = await fetchStaffQueue({
    facilityId: "demo-clinic-01",
    limit: 25,
    offset: 0,
    getIdToken: async (forceRefresh = false) => {
      tokenRefreshArgs.push(forceRefresh);
      return forceRefresh ? "fresh-token" : "stale-token";
    },
    fetchImpl: mockFetch,
  });

  assert.deepEqual(tokenRefreshArgs, [false, true]);
  assert.deepEqual(authHeadersSent, [
    "Bearer stale-token",
    "Bearer fresh-token",
  ]);
  assert.equal(result.pagination.total, 0);
});

test("staff API client surfaces auth-expired error when retry still returns 401 and 502 on invalid payload", async () => {
  const always401Fetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "INVALID_OR_EXPIRED_TOKEN",
          message: "Session expired.",
        },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );

  await assert.rejects(
    () =>
      fetchStaffSession({
        getIdToken: async () => "expired-token",
        fetchImpl: always401Fetch,
      }),
    (err: unknown) => {
      assert.ok(err instanceof StaffApiClientError);
      assert.equal(err.status, 401);
      assert.equal(err.isAuthExpired, true);
      return true;
    },
  );

  const malformedPayloadFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ unexpected: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(
    () =>
      fetchStaffIntakeDetail({
        facilityId: "demo-clinic-01",
        intakeId: "11111111-1111-4111-8111-111111111111",
        getIdToken: async () => "valid-token",
        fetchImpl: malformedPayloadFetch,
      }),
    (err: unknown) => {
      assert.ok(err instanceof StaffApiClientError);
      assert.equal(err.status, 502);
      assert.equal(err.code, "INVALID_DETAIL_RESPONSE");
      return true;
    },
  );
});

test("Phase 1D-3 decommissioning check: zero Firestore imports or legacy Firestore artifacts remain while Firebase Auth stays intact", () => {
  const root = process.cwd();

  const walkTsFiles = (dir: string): string[] => {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkTsFiles(fullPath));
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !entry.name.endsWith(".test.ts")
      ) {
        results.push(fullPath);
      }
    }
    return results;
  };

  for (const filePath of walkTsFiles(path.join(root, "src"))) {
    const content = fs.readFileSync(filePath, "utf8");
    const rel = path.relative(root, filePath);
    assert.doesNotMatch(
      content,
      /firebase\/firestore|\bonSnapshot\b|\bgetDocFromServer\b|\bgetFirestore\b/,
      `${rel} must not contain any Cloud Firestore imports or APIs after Phase 1D-3`,
    );
  }

  // Legacy Firestore files must be removed in Phase 1D-3.
  const removedLegacyFiles = [
    "firestore.rules",
    "firebase-blueprint.json",
    "src/lib/firebase/errors.ts",
    "src/lib/firebase/security-rules.test.ts",
    "src/components/shared/FirebaseErrorBoundary.tsx",
    "src/lib/schemas/staff.ts",
  ];
  for (const relPath of removedLegacyFiles) {
    assert.equal(
      fs.existsSync(path.join(root, relPath)),
      false,
      `Legacy Firestore artifact ${relPath} should be deleted in Phase 1D-3`,
    );
  }

  // Firebase Authentication & server ID-token verification must remain intact.
  const preservedAuthFiles = [
    "firebase-applet-config.json",
    "src/lib/firebase/config.ts",
    "src/lib/firebase/client.ts",
    "src/lib/firebase/admin-auth.ts",
    "src/lib/firebase/auth-state.ts",
    "src/lib/firebase/staff-auth.tsx",
  ];
  for (const relPath of preservedAuthFiles) {
    assert.equal(
      fs.existsSync(path.join(root, relPath)),
      true,
      `Firebase Authentication file ${relPath} must remain intact`,
    );
  }
});
