export type ShellLineEnding = "lf" | "crlf";

export interface ShellOpenOk {
  ok: true;
  path: string;
  mtimeMs: number;
  content: string;
  lineEnding: ShellLineEnding;
}

export type ShellFile = ShellOpenOk;

export interface ShellSaveOk {
  ok: true;
  path: string;
  mtimeMs: number;
}

export interface ShellRevealOk {
  ok: true;
  path: string;
}

export interface ShellCancel {
  ok: false;
  code: "cancelled";
}

export interface ShellConflict {
  ok: false;
  code: "conflict";
  path: string;
  actualMtimeMs: number;
}

export interface ShellPermissionNeeded {
  ok: false;
  code: "permission-needed";
  path?: string;
  message: string;
}

export interface ShellError {
  ok: false;
  code: "error";
  message: string;
}

export type ShellResult<T> =
  | T
  | ShellCancel
  | ShellConflict
  | ShellPermissionNeeded
  | ShellError;

export interface SaveFileArgs {
  path: string;
  content: string;
  expectedMtimeMs: number;
  lineEnding: ShellLineEnding;
}

export interface SaveFileAsArgs {
  suggestedName: string;
  content: string;
  lineEnding: ShellLineEnding;
}

export interface RevealInFinderArgs {
  path: string;
}

export interface OpenFileArgs {
  path?: string;
}

export interface Doc2mdShell {
  readonly version: 1;
  openFile(args?: OpenFileArgs): Promise<ShellResult<ShellOpenOk>>;
  saveFile(args: SaveFileArgs): Promise<ShellResult<ShellSaveOk>>;
  saveFileAs(args: SaveFileAsArgs): Promise<ShellResult<ShellSaveOk>>;
  revealInFinder(
    args: RevealInFinderArgs,
  ): Promise<ShellResult<ShellRevealOk>>;
}

declare global {
  interface Window {
    doc2mdShell?: Doc2mdShell;
  }
}

export {};
