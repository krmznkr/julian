// Background task runner for fire-and-forget work at the React boundary.
//
// Internally this schedules the work as an `Effect` on the app runtime instead
// of a raw Promise chain. The public API and console/report behaviour are kept
// identical so callers (and tests) don't change.
import { Cause, Effect } from "effect";
import { runFork } from "@/lib/effect/runtime";

type AsyncTaskReporter = false | ((error: Error) => void);

type AsyncTaskOptions = {
  action: string;
  context?: Record<string, unknown>;
  onError?: (error: Error) => void;
  reportError?: AsyncTaskReporter;
};

function normalizeAsyncTaskError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unknown async task error");
}

function reportAsyncTaskError(error: unknown, options: AsyncTaskOptions) {
  const normalizedError = normalizeAsyncTaskError(error);

  try {
    options.onError?.(normalizedError);
  } catch {
    // swallow error handler failures
  }

  if (options.reportError === false) {
    return;
  }

  if (typeof options.reportError === "function") {
    options.reportError(normalizedError);
    return;
  }

  console.warn("Client error", {
    context: { action: options.action, surface: "app", ...options.context },
    error: normalizedError,
  });
}

export function runAsyncTask(
  task: Promise<unknown> | (() => Promise<unknown> | unknown),
  options: AsyncTaskOptions,
) {
  const program = Effect.tryPromise({
    try: async () => (typeof task === "function" ? task() : task),
    catch: (error) => error,
  });

  runFork(
    program.pipe(
      Effect.catchCause((cause: Cause.Cause<unknown>) =>
        Effect.sync(() => {
          reportAsyncTaskError(Cause.squash(cause), options);
        }),
      ),
    ),
  );
}
