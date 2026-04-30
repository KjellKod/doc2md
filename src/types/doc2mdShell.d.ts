export type ShellLineEnding = "lf" | "crlf";
export type Theme = "light" | "dark";

export interface ShellOpenMarkdownOk {
  ok: true;
  kind: "markdown";
  path: string;
  mtimeMs: number;
  content: string;
  lineEnding: ShellLineEnding;
}

export interface ShellOpenImportOk {
  ok: true;
  kind: "import-source";
  path: string;
  name: string;
  format: string;
  mtimeMs: number;
  importUrl: string;
  mimeType?: string;
}

export type ShellFile = ShellOpenMarkdownOk | ShellOpenImportOk;
export type ShellOpenOk = ShellOpenMarkdownOk;

export interface ShellSaveOk {
  ok: true;
  path: string;
  mtimeMs: number;
}

export interface ShellRevealOk {
  ok: true;
  path: string;
}

export interface DesktopRecentFile {
  path: string;
  displayName: string;
  lastOpenedAt: string;
}

export interface DesktopPersistenceSettings {
  ok: true;
  persistenceEnabled: boolean;
  theme?: Theme;
  recentFiles: DesktopRecentFile[];
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

export interface SetPersistenceEnabledArgs {
  enabled: boolean;
}

export interface SetPersistenceThemeArgs {
  theme: Theme;
}

export interface Doc2mdShell {
  readonly version: 2;
  openFile(args?: OpenFileArgs): Promise<ShellResult<ShellFile>>;
  saveFile(args: SaveFileArgs): Promise<ShellResult<ShellSaveOk>>;
  saveFileAs(args: SaveFileAsArgs): Promise<ShellResult<ShellSaveOk>>;
  revealInFinder(
    args: RevealInFinderArgs,
  ): Promise<ShellResult<ShellRevealOk>>;
  getPersistenceSettings(): Promise<ShellResult<DesktopPersistenceSettings>>;
  setPersistenceEnabled(
    args: SetPersistenceEnabledArgs,
  ): Promise<ShellResult<DesktopPersistenceSettings>>;
  setPersistenceTheme(
    args: SetPersistenceThemeArgs,
  ): Promise<ShellResult<DesktopPersistenceSettings>>;
}

declare global {
  interface Window {
    doc2mdShell?: Doc2mdShell;
  }
}

export {};
