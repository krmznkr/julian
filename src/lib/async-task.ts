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

export function runAsyncTask(
  task: Promise<unknown> | (() => Promise<unknown> | unknown),
  options: AsyncTaskOptions,
) {
  void Promise.resolve()
    .then(() => (typeof task === "function" ? task() : task))
    .catch((error) => {
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
    });
}
