export type Base64Bytes = string;

export interface ShellAsset {
  relativePath: string;
  bytesBase64: Base64Bytes;
}

export interface ShellFile {
  ok: true;
  path: string;
  name: string;
  bytesBase64: Base64Bytes;
  mtimeMs: number;
  lineEnding: "lf" | "crlf" | "unknown";
}

export interface ShellFolder {
  ok: true;
  path: string;
}

export interface ShellOk {
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
  currentMtimeMs: number;
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
  bytesBase64: Base64Bytes;
  expectedMtimeMs: number;
  assets?: ShellAsset[];
  makeBackup?: boolean;
}

export interface SaveFileAsArgs {
  suggestedName: string;
  bytesBase64: Base64Bytes;
  assets?: ShellAsset[];
  makeBackup?: boolean;
}

export interface RevealInFinderArgs {
  path: string;
}

export interface Doc2mdShell {
  readonly version: 1;
  openFile(): Promise<ShellResult<ShellFile>>;
  saveFile(args: SaveFileArgs): Promise<ShellResult<ShellOk>>;
  saveFileAs(args: SaveFileAsArgs): Promise<ShellResult<ShellOk>>;
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
