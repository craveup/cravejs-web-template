import type { FulfillmentDetail } from "../types";

export type EntryIntent =
  | { kind: "direct"; detail: Extract<FulfillmentDetail, { mode: "takeout" }>; theme?: string }
  | {
      kind: "table";
      detail: Extract<FulfillmentDetail, { mode: "table-side" }>;
      theme?: string;
    }
  | {
      kind: "room";
      detail: Extract<FulfillmentDetail, { mode: "room-service" }>;
      theme?: string;
    }
  | {
      kind: "invalid";
      reason: "empty-context" | "multiple-contexts" | "non-scalar-context";
      theme?: string;
    };

interface EntryQuery {
  table?: string | string[];
  room?: string | string[];
  theme?: string | string[];
}

function scalar(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : undefined;
}

export function resolveEntryIntent(query: EntryQuery, preview = false): EntryIntent {
  const theme = preview ? scalar(query.theme) || undefined : undefined;
  if (Array.isArray(query.table) || Array.isArray(query.room)) {
    return { kind: "invalid", reason: "non-scalar-context", theme };
  }

  const tableIdentifier = scalar(query.table);
  const roomIdentifier = scalar(query.room);
  if (
    (query.table !== undefined && !tableIdentifier) ||
    (query.room !== undefined && !roomIdentifier)
  ) {
    return { kind: "invalid", reason: "empty-context", theme };
  }
  if (tableIdentifier && roomIdentifier) {
    return { kind: "invalid", reason: "multiple-contexts", theme };
  }
  if (tableIdentifier) {
    return { kind: "table", detail: { mode: "table-side", tableIdentifier }, theme };
  }
  if (roomIdentifier) {
    return {
      kind: "room",
      detail: { mode: "room-service", roomIdentifier },
      theme,
    };
  }
  return { kind: "direct", detail: { mode: "takeout" }, theme };
}
