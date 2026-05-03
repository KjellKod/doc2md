// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

export type DesktopSaveState =
  | "saved"
  | "edited"
  | "saving"
  | "conflict"
  | "error"
  | "permission-needed";

export type DesktopSaveEvent =
  | "edit"
  | "saving"
  | "saved"
  | "cancelled"
  | "conflict"
  | "error"
  | "permission-needed"
  | "reset";

export function initialSaveState(): DesktopSaveState {
  return "saved";
}

export function transition(
  current: DesktopSaveState,
  event: DesktopSaveEvent,
): DesktopSaveState {
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
