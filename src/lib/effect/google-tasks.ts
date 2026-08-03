// Google Tasks API as an Effect service.
//
// Tasks are surfaced in the year view as a synthetic all-day calendar. Keeping
// them behind their own service means a Tasks outage cannot change how calendar
// events are fetched, and the aggregation layer decides how to degrade.
import { Context, Effect, Layer, Option, Stream } from "effect";
import type { GoogleApiFailure } from "@/lib/effect/errors";
import * as S from "@/lib/effect/schemas";
import { GoogleHttp } from "@/lib/effect/google-http";

const TASKS_BASE = "https://www.googleapis.com/tasks/v1";

export interface GoogleTasksShape {
  readonly listTaskLists: Effect.Effect<ReadonlyArray<S.GoogleTaskListItem>, GoogleApiFailure>;
  readonly listTasks: (
    taskListId: string,
  ) => Effect.Effect<ReadonlyArray<S.GoogleTask>, GoogleApiFailure>;
}

export class GoogleTasks extends Context.Service<GoogleTasks, GoogleTasksShape>()(
  "@julian/GoogleTasks",
) {}

export const googleTasksLayer: Layer.Layer<GoogleTasks, never, GoogleHttp> = Layer.effect(
  GoogleTasks,
  Effect.gen(function* () {
    const http = yield* GoogleHttp;

    const listTaskLists = http
      .getJson(
        S.GoogleTaskList,
        `${TASKS_BASE}/users/@me/lists`,
        "GoogleTasks.listTaskLists",
        "Failed to fetch task lists",
      )
      .pipe(Effect.map((data) => data.items ?? []));

    const listTasks: GoogleTasksShape["listTasks"] = Effect.fn("GoogleTasks.listTasks")(function* (
      taskListId: string,
    ) {
      // `maxResults` caps a *page*, not the result set, so this follows
      // `nextPageToken`. Reading only the first page silently hid tasks from
      // anyone with more than 100 incomplete tasks in a list.
      const pages = http.paginate(
        S.GoogleTasksPage,
        (pageToken) => {
          const params = new URLSearchParams({ showCompleted: "false", maxResults: "100" });
          if (Option.isSome(pageToken)) params.set("pageToken", pageToken.value);
          return `${TASKS_BASE}/lists/${encodeURIComponent(taskListId)}/tasks?${params}`;
        },
        (page) => page.nextPageToken,
        "GoogleTasks.listTasks",
        `Failed to fetch tasks from list ${taskListId}`,
      );

      return yield* pages.pipe(
        Stream.map((page) => page.items ?? []),
        Stream.flattenIterable,
        Stream.runCollect,
      );
    });

    return GoogleTasks.of({ listTaskLists, listTasks });
  }),
);
