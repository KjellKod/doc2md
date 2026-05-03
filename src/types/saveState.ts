export type SaveState =
  | "saved"
  | "edited"
  | "saving"
  | "conflict"
  | "error"
  | "permission-needed";

export type SaveEvent =
  | "edit"
  | "saving"
  | "saved"
  | "cancelled"
  | "conflict"
  | "error"
  | "permission-needed"
  | "reset";

export function initialSaveState(): SaveState {
  return "saved";
}

export function transition(current: SaveState, event: SaveEvent): SaveState {
  switch (event) {
    case "edit":
      return current === "saving" ? "saving" : "edited";
    case "saving":
      return "saving";
    case "saved":
    case "reset":
      return "saved";
    case "cancelled":
      return "edited";
    case "conflict":
      return "conflict";
    case "error":
      return "error";
    case "permission-needed":
      return "permission-needed";
  }
}
