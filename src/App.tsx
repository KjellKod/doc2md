import type { CSSProperties, KeyboardEvent, MouseEvent, SVGProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import AboutSection from "./components/AboutSection";
import DownloadButton from "./components/DownloadButton";
import DropZone from "./components/DropZone";
import FileList from "./components/FileList";
import InstallPage from "./components/InstallPage";
import PreviewPanel from "./components/PreviewPanel";
import ThemeProvider from "./components/ThemeProvider";
import ThemeToggle from "./components/ThemeToggle";
import { useDesktopCapability } from "./desktop/useDesktopCapability";
import type { DesktopSaveState } from "./desktop/saveState";
import { useDesktopSaveState } from "./desktop/useDesktopSaveState";
import { useNativeMenuEvents } from "./desktop/useNativeMenuEvents";
import { useFileConversion } from "./hooks/useFileConversion";
import type { FileEntry } from "./types";
import type {
  ShellConflict,
  ShellError,
  ShellLineEnding,
  ShellPermissionNeeded,
} from "./types/doc2mdShell";
import { entryDisplayName } from "./utils/displayName";
import { downloadAllEntries, isDownloadableEntry } from "./utils/download";

const BASE_PAGE_MAX_WIDTH = 1680;
const MIN_PAGE_MAX_WIDTH = 1360;
const HARD_MAX_PAGE_MAX_WIDTH = 2400;
const PAGE_WIDTH_FRAME_ALLOWANCE = 96;
const PAGE_WIDTH_STEP = 48;
type PageView = "convert" | "install";
const DISPLAY_VERSION = __DOC2MD_DISPLAY_VERSION__;
const CONVERSION_FAILED_SAVE_MESSAGE =
  "Cannot save: conversion failed. Please re-open the file or choose another.";

function PanelRightOpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m14 8 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PanelRightCloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M20 5H9a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10 8-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoveHorizontalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="m7 8-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m17 8 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

const PAGES: PageView[] = ["convert", "install"];

function markdownForEntry(entry: FileEntry | null) {
  return entry?.editedMarkdown ?? entry?.markdown ?? "";
}

function suggestedNameForEntry(entry: FileEntry | null) {
  return entry?.name || "Untitled.md";
}

function basenameForPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path || "Untitled.md";
}

function lineEndingForEntry(entry: FileEntry | null): ShellLineEnding {
  return entry?.desktopFile?.lineEnding ?? "lf";
}

type DesktopNotice =
  | { kind: "none" }
  | { kind: "info"; message: string }
  | { kind: "permission-needed"; message: string; path?: string }
  | { kind: "error"; message: string };

type PendingConflict = ShellConflict & {
  entryId: string;
  lineEnding: ShellLineEnding;
};

const IMPORT_HANDOFF_EXPIRED_MESSAGE = "Import handoff expired. Open the file again.";
const IMPORT_HANDOFF_FAILED_MESSAGE =
  "Import failed before the app received the file bytes.";

function noticeFromPermission(result: ShellPermissionNeeded): DesktopNotice {
  return {
    kind: "permission-needed",
    path: result.path,
    message: result.message,
  };
}

function noticeFromError(result: ShellError): DesktopNotice {
  return {
    kind: "error",
    message: result.message,
  };
}

async function readImportFailureMessage(
  importResponse: Response,
): Promise<string> {
  if (importResponse.status === 404) {
    return IMPORT_HANDOFF_EXPIRED_MESSAGE;
  }

  if (importResponse.status !== 413) {
    return IMPORT_HANDOFF_FAILED_MESSAGE;
  }

  try {
    const message = (await importResponse.text()).trim();
    return message || IMPORT_HANDOFF_FAILED_MESSAGE;
  } catch {
    return IMPORT_HANDOFF_FAILED_MESSAGE;
  }
}

function DesktopMenuBridge({
  isDesktop,
  handlers,
}: {
  isDesktop: boolean;
  handlers: Parameters<typeof useNativeMenuEvents>[0];
}) {
  if (!isDesktop) {
    return null;
  }

  return <DesktopMenuEventBridge handlers={handlers} />;
}

function DesktopMenuEventBridge({
  handlers,
}: {
  handlers: Parameters<typeof useNativeMenuEvents>[0];
}) {
  useNativeMenuEvents(handlers);

  return <span data-testid="desktop-menu-bridge" hidden />;
}

function clampPageWidth(width: number) {
  if (typeof window === "undefined") {
    return Math.min(
      Math.max(Math.round(width), MIN_PAGE_MAX_WIDTH),
      HARD_MAX_PAGE_MAX_WIDTH,
    );
  }

  const viewportLimitedMax = Math.min(
    HARD_MAX_PAGE_MAX_WIDTH,
    Math.max(MIN_PAGE_MAX_WIDTH, window.innerWidth - PAGE_WIDTH_FRAME_ALLOWANCE),
  );

  return Math.min(
    Math.max(Math.round(width), MIN_PAGE_MAX_WIDTH),
    viewportLimitedMax,
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<PageView>("convert");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPageResizing, setIsPageResizing] = useState(false);
  const [pageMaxWidth, setPageMaxWidth] = useState(BASE_PAGE_MAX_WIDTH);
  const convertTabRef = useRef<HTMLButtonElement>(null);
  const installTabRef = useRef<HTMLButtonElement>(null);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(BASE_PAGE_MAX_WIDTH);
  const {
    entries,
    addFiles,
    addUrl,
    addScratchEntry,
    addOpenedFileEntry,
    addImportedFileEntry,
    clearEntries,
    replaceEntryWithOpenedFile,
    selectEntry,
    selectedEntry,
    updateEntryDesktopFile,
    updateMarkdown,
  } = useFileConversion();
  const { isDesktop, shell } = useDesktopCapability();
  const saveState = useDesktopSaveState(isDesktop);
  const saveInFlightRef = useRef(false);
  const [desktopNotice, setDesktopNotice] = useState<DesktopNotice>({
    kind: "none",
  });
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(
    null,
  );
  let convertedCount = 0;
  let draftCount = 0;
  let activeCount = 0;
  for (const entry of entries) {
    if (isDownloadableEntry(entry) && !entry.isScratch) convertedCount++;
    if (entry.isScratch) draftCount++;
    if (entry.status === "pending" || entry.status === "converting")
      activeCount++;
  }
  const buildSummary = (emptyLabel: string, draftSuffix: string) => {
    if (entries.length === 0) return emptyLabel;
    return (
      [
        convertedCount > 0
          ? `${convertedCount} ${pluralize(convertedCount, "converted file")}`
          : null,
        activeCount > 0 ? `${activeCount} processing` : null,
        draftCount > 0
          ? `${draftCount} ${pluralize(draftCount, "draft")}${draftSuffix}`
          : null,
      ]
        .filter(Boolean)
        .join(", ") ||
      `${entries.length} ${pluralize(entries.length, "entry")} in session`
    );
  };
  const heroSummary = buildSummary(
    "Start from scratch or with single and mixed-format batches",
    " open",
  );
  const fileSummary = buildSummary("No files or drafts yet.", "");

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia("(max-width: 980px)");
    const handleChange = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        setSidebarCollapsed(false);
        setIsPageResizing(false);
        setPageMaxWidth(BASE_PAGE_MAX_WIDTH);
      }
    };

    handleChange(mediaQueryList);

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);

      return () => {
        mediaQueryList.removeEventListener("change", handleChange);
      };
    }

    mediaQueryList.addListener(handleChange);

    return () => {
      mediaQueryList.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isPageResizing) {
      return;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      setPageMaxWidth(
        clampPageWidth(
          dragStartWidthRef.current + (event.clientX - dragStartXRef.current),
        ),
      );
    };
    const handleMouseUp = () => {
      setIsPageResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPageResizing]);

  useEffect(() => {
    document.body.classList.toggle("is-page-resizing", isPageResizing);

    return () => {
      document.body.classList.remove("is-page-resizing");
    };
  }, [isPageResizing]);

  const handlePageResizeStart = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const normalizedWidth = clampPageWidth(pageMaxWidth);
    dragStartXRef.current = event.clientX;
    dragStartWidthRef.current = normalizedWidth;

    if (normalizedWidth !== pageMaxWidth) {
      setPageMaxWidth(normalizedWidth);
    }

    setIsPageResizing(true);
  };

  const handlePageResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPageMaxWidth((current) => clampPageWidth(current + PAGE_WIDTH_STEP));
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPageMaxWidth((current) => clampPageWidth(current - PAGE_WIDTH_STEP));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setPageMaxWidth(BASE_PAGE_MAX_WIDTH);
    }
  };

  const pageFrameStyle = {
    "--page-max-width": `${pageMaxWidth}px`,
  } as CSSProperties;

  const focusPageTab = (page: PageView) => {
    const tab =
      page === "convert" ? convertTabRef.current : installTabRef.current;
    tab?.focus();
  };

  const handleViewTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentPage: PageView,
  ) => {
    const pages = PAGES;
    const currentIndex = pages.indexOf(currentPage);
    let nextPage: PageView | null = null;

    if (event.key === "ArrowRight") {
      nextPage = pages[(currentIndex + 1) % pages.length];
    } else if (event.key === "ArrowLeft") {
      nextPage = pages[(currentIndex - 1 + pages.length) % pages.length];
    } else if (event.key === "Home") {
      nextPage = pages[0];
    } else if (event.key === "End") {
      nextPage = pages[pages.length - 1];
    }

    if (!nextPage) {
      return;
    }

    event.preventDefault();
    setActivePage(nextPage);
    focusPageTab(nextPage);
  };

  async function handleUrlAdded(url: string) {
    await addUrl(url);
  }

  const selectedPath = selectedEntry?.desktopFile?.path;
  const desktopTitle = selectedPath
    ? basenameForPath(selectedPath)
    : suggestedNameForEntry(selectedEntry);
  const saveStateLabels = {
    saved: "Saved",
    edited: "Edited",
    saving: "Saving",
    conflict: "Conflict",
    error: "Error",
    "permission-needed": "Permission needed",
  } as const;
  const saveStateLabel = saveStateLabels[saveState.state];
  const appReady = isDesktop && Boolean(desktopTitle) && Boolean(saveStateLabel);

  const clearDesktopProblem = useCallback(() => {
    setPendingConflict(null);
    setDesktopNotice({ kind: "none" });
  }, []);

  const handleOpenFile = useCallback(async () => {
    if (!shell) {
      return;
    }

    try {
      const result = await shell.openFile();
      if (result.ok) {
        if (result.kind === "markdown") {
          addOpenedFileEntry(result);
          saveState.markSaved();
          clearDesktopProblem();
          return;
        }

        if (window.location.protocol !== "doc2md:") {
          setDesktopNotice({
            kind: "info",
            message:
              "Importing non-Markdown files requires the Release desktop bundle. Run `npm run build:mac` or open the file from the installed app.",
          });
          return;
        }

        const importResponse = await fetch(result.importUrl);
        if (!importResponse.ok) {
          const message = await readImportFailureMessage(importResponse);
          saveState.markError();
          setDesktopNotice({
            kind: "error",
            message,
          });
          return;
        }

        const blob = await importResponse.blob();
        const file = new File([blob], result.name, {
          type: result.mimeType || blob.type || "application/octet-stream",
          lastModified: result.mtimeMs,
        });

        addImportedFileEntry({
          file,
          path: result.path,
          mtimeMs: result.mtimeMs,
          sourceFormat: result.format,
        });
        saveState.markEdited();
        clearDesktopProblem();
        return;
      }

      if (result.code === "cancelled") {
        return;
      }

      if (result.code === "permission-needed") {
        saveState.markPermissionNeeded();
        setDesktopNotice(noticeFromPermission(result));
        return;
      }

      if (result.code === "error") {
        saveState.markError();
        setDesktopNotice(noticeFromError(result));
      }
    } catch (error) {
      saveState.markError();
      setDesktopNotice({
        kind: "error",
        message: "Open failed before the app received a native result.",
      });
      console.error("doc2md desktop openFile transport failure", error);
    }
  }, [
    addImportedFileEntry,
    addOpenedFileEntry,
    clearDesktopProblem,
    saveState,
    shell,
  ]);

  const restoreCancelledSaveState = useCallback(
    (previousState: DesktopSaveState) => {
      saveState.restore(previousState);
    },
    [saveState],
  );

  const saveEntryFile = useCallback(
    async (entry: FileEntry, expectedMtimeMs?: number) => {
      if (!shell || saveInFlightRef.current) {
        return;
      }

      const desktopFile = entry.desktopFile;
      if (!desktopFile) {
        return;
      }

      const previousState = saveState.state;
      saveInFlightRef.current = true;
      saveState.markSaving();

      try {
        const result = await shell.saveFile({
          path: desktopFile.path,
          content: markdownForEntry(entry),
          expectedMtimeMs: expectedMtimeMs ?? desktopFile.mtimeMs,
          lineEnding: lineEndingForEntry(entry),
        });

        if (result.ok) {
          updateEntryDesktopFile(entry.id, {
            path: result.path,
            mtimeMs: result.mtimeMs,
            lineEnding: lineEndingForEntry(entry),
          });
          saveState.markSaved();
          clearDesktopProblem();
          return;
        }

        if (result.code === "conflict") {
          setPendingConflict({
            ...result,
            entryId: entry.id,
            lineEnding: lineEndingForEntry(entry),
          });
          saveState.markConflict();
          setDesktopNotice({ kind: "none" });
          return;
        }

        if (result.code === "cancelled") {
          restoreCancelledSaveState(previousState);
          return;
        }

        if (result.code === "permission-needed") {
          saveState.markPermissionNeeded();
          setDesktopNotice(noticeFromPermission(result));
          return;
        }

        saveState.markError();
        setDesktopNotice(noticeFromError(result));
      } catch (error) {
        saveState.markError();
        setDesktopNotice({
          kind: "error",
          message: "Save failed before the app received a native result.",
        });
        console.error("doc2md desktop saveFile transport failure", error);
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [
      clearDesktopProblem,
      restoreCancelledSaveState,
      saveState,
      shell,
      updateEntryDesktopFile,
    ],
  );

  const handleSaveAs = useCallback(async () => {
    if (!shell || !selectedEntry || saveInFlightRef.current) {
      return;
    }

    const previousState = saveState.state;
    const entry = selectedEntry;
    if (entry.status === "pending" || entry.status === "converting") {
      setDesktopNotice({
        kind: "info",
        message: "Finishing conversion. Try saving again in a moment.",
      });
      return;
    }
    if (entry.status === "error") {
      setDesktopNotice({
        kind: "error",
        message: CONVERSION_FAILED_SAVE_MESSAGE,
      });
      return;
    }
    saveInFlightRef.current = true;
    saveState.markSaving();

    try {
      const result = await shell.saveFileAs({
        suggestedName: suggestedNameForEntry(entry),
        content: markdownForEntry(entry),
        lineEnding: lineEndingForEntry(entry),
      });

      if (result.ok) {
        updateEntryDesktopFile(entry.id, {
          path: result.path,
          mtimeMs: result.mtimeMs,
          lineEnding: lineEndingForEntry(entry),
        });
        saveState.markSaved();
        clearDesktopProblem();
        return;
      }

      if (result.code === "cancelled") {
        restoreCancelledSaveState(previousState);
        return;
      }

      if (result.code === "conflict") {
        setPendingConflict({
          ...result,
          entryId: entry.id,
          lineEnding: lineEndingForEntry(entry),
        });
        saveState.markConflict();
        return;
      }

      if (result.code === "permission-needed") {
        saveState.markPermissionNeeded();
        setDesktopNotice(noticeFromPermission(result));
        return;
      }

      saveState.markError();
      setDesktopNotice(noticeFromError(result));
    } catch (error) {
      saveState.markError();
      setDesktopNotice({
        kind: "error",
        message: "Save As failed before the app received a native result.",
      });
      console.error("doc2md desktop saveFileAs transport failure", error);
    } finally {
      saveInFlightRef.current = false;
    }
  }, [
    clearDesktopProblem,
    restoreCancelledSaveState,
    saveState,
    selectedEntry,
    shell,
    updateEntryDesktopFile,
  ]);

  const handleSave = useCallback(() => {
    if (!selectedEntry) {
      setDesktopNotice({
        kind: "info",
        message: "Select a document before saving.",
      });
      return;
    }

    if (
      selectedEntry.status === "pending" ||
      selectedEntry.status === "converting"
    ) {
      setDesktopNotice({
        kind: "info",
        message: "Finishing conversion. Try saving again in a moment.",
      });
      return;
    }

    if (selectedEntry.status === "error") {
      setDesktopNotice({
        kind: "error",
        message: CONVERSION_FAILED_SAVE_MESSAGE,
      });
      return;
    }

    if (!selectedEntry.desktopFile) {
      void handleSaveAs();
      return;
    }

    if (selectedEntry.desktopFile.path.toLowerCase().endsWith(".markdown")) {
      void handleSaveAs();
      return;
    }

    void saveEntryFile(selectedEntry);
  }, [handleSaveAs, saveEntryFile, selectedEntry]);

  const handleRevealInFinder = useCallback(async () => {
    if (!shell || !selectedPath) {
      setDesktopNotice({
        kind: "info",
        message: "Save the document before revealing it in Finder.",
      });
      return;
    }

    try {
      const result = await shell.revealInFinder({ path: selectedPath });
      if (result.ok) {
        setDesktopNotice({
          kind: "info",
          message: `Revealed ${basenameForPath(result.path)} in Finder.`,
        });
        return;
      }

      if (result.code === "cancelled") {
        return;
      }

      if (result.code === "permission-needed") {
        saveState.markPermissionNeeded();
        setDesktopNotice(noticeFromPermission(result));
        return;
      }

      if (result.code === "error") {
        saveState.markError();
        setDesktopNotice(noticeFromError(result));
      }
    } catch (error) {
      saveState.markError();
      setDesktopNotice({
        kind: "error",
        message: "Reveal failed before the app received a native result.",
      });
      console.error("doc2md desktop revealInFinder transport failure", error);
    }
  }, [saveState, selectedPath, shell]);

  const handleReloadConflict = useCallback(async () => {
    if (!shell || !pendingConflict) {
      return;
    }

    const entry = entries.find((candidate) => candidate.id === pendingConflict.entryId);
    if (!entry) {
      saveState.markError();
      setDesktopNotice({
        kind: "error",
        message: "The conflicted document is no longer available.",
      });
      setPendingConflict(null);
      return;
    }

    selectEntry(entry.id);

    try {
      const result = await shell.openFile({ path: pendingConflict.path });
      if (result.ok) {
        if (result.kind !== "markdown") {
          console.error("conflict-reload received non-markdown kind");
          setPendingConflict(null);
          saveState.markError();
          setDesktopNotice({
            kind: "error",
            message: "Reload failed: file is no longer a Markdown target.",
          });
          return;
        }

        replaceEntryWithOpenedFile(entry.id, result);
        saveState.markSaved();
        clearDesktopProblem();
        return;
      }

      if (result.code === "cancelled") {
        return;
      }

      if (result.code === "permission-needed") {
        saveState.markPermissionNeeded();
        setDesktopNotice(noticeFromPermission(result));
        return;
      }

      if (result.code === "error") {
        saveState.markError();
        setDesktopNotice(noticeFromError(result));
      }
    } catch (error) {
      saveState.markError();
      setDesktopNotice({
        kind: "error",
        message: "Reload failed before the app received a native result.",
      });
      console.error("doc2md desktop reload transport failure", error);
    }
  }, [
    clearDesktopProblem,
    entries,
    pendingConflict,
    replaceEntryWithOpenedFile,
    saveState,
    selectEntry,
    shell,
  ]);

  const handleOverwriteConflict = useCallback(() => {
    if (!pendingConflict) {
      return;
    }

    const entry = entries.find((candidate) => candidate.id === pendingConflict.entryId);
    if (!entry) {
      saveState.markError();
      setDesktopNotice({
        kind: "error",
        message: "The conflicted document is no longer available.",
      });
      setPendingConflict(null);
      return;
    }

    selectEntry(entry.id);
    void saveEntryFile(entry, pendingConflict.actualMtimeMs);
  }, [entries, pendingConflict, saveEntryFile, saveState, selectEntry]);

  const handleCancelConflict = useCallback(() => {
    setPendingConflict(null);
    saveState.markCancelled();
  }, [saveState]);

  const nativeMenuHandlers = {
    onNew: () => {
      addScratchEntry();
      saveState.markEdited();
      clearDesktopProblem();
    },
    onOpen: () => {
      void handleOpenFile();
    },
    onSave: handleSave,
    onSaveAs: () => {
      void handleSaveAs();
    },
    onRevealInFinder: () => {
      void handleRevealInFinder();
    },
    onCloseWindow: saveState.reset,
  };

  return (
    <ThemeProvider>
      <div className="app-shell">
        <DesktopMenuBridge
          isDesktop={isDesktop}
          handlers={nativeMenuHandlers}
        />
        <main
          className={`page-frame${isPageResizing ? " is-page-resizing" : ""}`}
          style={pageFrameStyle}
        >
          <div className="page">
            <p className="page-version" aria-label="Current release version">
              {DISPLAY_VERSION}
            </p>
            <header className="hero">
              <div className="hero-top">
                <p className="eyebrow">Private markdown workspace</p>
                <ThemeToggle />
              </div>
              <h1>Edit or convert to Markdown, without leaving the browser.</h1>
              <p className="hero-copy">
                Start with a blank draft, paste in existing content, or bring in
                a local file or document URL to convert in your browser before
                you review and download clean Markdown.
              </p>
              <div className="hero-meta" aria-label="Product highlights">
                <span className="hero-pill">
                  Browser-side conversion with no doc2md upload backend
                </span>
                <span className="hero-pill">
                  Supports .md, .txt, .json, .csv, .tsv, .html, .docx, .xlsx,
                  .pdf, and .pptx
                </span>
                <span className="hero-pill">
                  {activePage === "convert"
                    ? heroSummary
                    : "CLI, Node, and portable skill setup from one place"}
                </span>
              </div>
            </header>

            <div className="view-switcher" role="tablist" aria-label="doc2md views">
              <button
                id="view-tab-convert"
                ref={convertTabRef}
                type="button"
                role="tab"
                aria-selected={activePage === "convert"}
                aria-controls="view-panel-convert"
                tabIndex={activePage === "convert" ? 0 : -1}
                className={`view-tab${activePage === "convert" ? " is-active" : ""}`}
                onClick={() => setActivePage("convert")}
                onKeyDown={(event) => handleViewTabKeyDown(event, "convert")}
              >
                Convert
              </button>
              <button
                id="view-tab-install"
                ref={installTabRef}
                type="button"
                role="tab"
                aria-selected={activePage === "install"}
                aria-controls="view-panel-install"
                tabIndex={activePage === "install" ? 0 : -1}
                className={`view-tab${activePage === "install" ? " is-active" : ""}`}
                onClick={() => setActivePage("install")}
                onKeyDown={(event) => handleViewTabKeyDown(event, "install")}
              >
                Install & Use
              </button>
            </div>

            <section
              id="view-panel-convert"
              className="view-panel"
              role="tabpanel"
              aria-labelledby="view-tab-convert"
              hidden={activePage !== "convert"}
            >
              {isDesktop ? (
                <section
                  className={`desktop-shell-bar desktop-shell-bar-${saveState.state}`}
                  aria-label="Desktop file status"
                  data-app-ready={appReady ? "true" : undefined}
                >
                  <div className="desktop-shell-main">
                    <span className="desktop-shell-title" title={desktopTitle}>
                      {desktopTitle}
                    </span>
                    <span className="desktop-save-pill">{saveStateLabel}</span>
                    <button
                      type="button"
                      className="ghost-button desktop-reveal-button"
                      onClick={() => void handleRevealInFinder()}
                      disabled={!selectedPath}
                      aria-label="Reveal in Finder"
                      title="Reveal in Finder"
                    >
                      Reveal
                    </button>
                  </div>

                  <div
                    className="desktop-shell-status"
                    role={
                      saveState.state === "conflict" ||
                      desktopNotice.kind === "permission-needed" ||
                      desktopNotice.kind === "error"
                        ? "alert"
                        : "status"
                    }
                  >
                    {pendingConflict ? (
                      <div className="desktop-conflict-bar">
                        <span>File changed on disk.</span>
                        <button type="button" onClick={handleReloadConflict}>
                          Reload
                        </button>
                        <button type="button" onClick={handleOverwriteConflict}>
                          Overwrite
                        </button>
                        <button type="button" onClick={handleCancelConflict}>
                          Cancel
                        </button>
                      </div>
                    ) : desktopNotice.kind === "permission-needed" ? (
                      <span>
                        Permission needed: {desktopNotice.message}
                      </span>
                    ) : desktopNotice.kind === "error" ? (
                      <span>{desktopNotice.message}</span>
                    ) : desktopNotice.kind === "info" ? (
                      <span>{desktopNotice.message}</span>
                    ) : (
                      <span>{selectedPath ?? "No saved path yet."}</span>
                    )}
                  </div>
                </section>
              ) : null}

              <section
                className={`workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
              >
                {sidebarCollapsed ? (
                  <section className="panel collapse-rail" aria-label="Upload rail">
                    <button
                      type="button"
                      className="collapse-rail-button"
                      onClick={() => setSidebarCollapsed(false)}
                      aria-label="Show upload panel"
                      title="Show upload panel"
                    >
                      <PanelRightOpenIcon
                        className="collapse-toggle-icon"
                        aria-hidden="true"
                      />
                      <span className="collapse-rail-label">Upload</span>
                    </button>
                  </section>
                ) : (
                  <section
                    className="panel sidebar-panel"
                    aria-labelledby="upload-title"
                  >
                    <div className="panel-heading">
                      <div>
                        <h2 id="upload-title">Upload</h2>
                        <p className="panel-copy">
                          Drop in documents, spreadsheets, PDFs, or
                          presentations, add a doc URL, or start writing from
                          scratch and keep everything in one session.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button collapse-toggle"
                        onClick={() => setSidebarCollapsed(true)}
                        aria-label="Hide upload panel"
                        title="Hide upload panel"
                      >
                        <PanelRightCloseIcon
                          className="collapse-toggle-icon"
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <DropZone
                      onFilesAdded={addFiles}
                      onUrlAdded={handleUrlAdded}
                    />

                    <div className="panel-heading panel-heading-tight">
                      <div>
                        <h2>Files</h2>
                        <p className="panel-copy">{fileSummary}</p>
                      </div>
                      <DownloadButton entry={selectedEntry} />
                    </div>

                    <FileList
                      entries={entries}
                      onClearAll={clearEntries}
                      onDownloadAll={() => downloadAllEntries(entries)}
                      onSelect={selectEntry}
                    />
                  </section>
                )}

                <section
                  className="panel preview-panel"
                  aria-labelledby="preview-title"
                >
                  <div className="panel-heading">
                    <div>
                      <h2 id="preview-title">Preview</h2>
                      <p className="panel-copy">
                        {selectedEntry
                          ? entryDisplayName(selectedEntry)
                          : "Start writing, paste Markdown, or convert a file and review it here."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ghost-button page-width-handle"
                      onMouseDown={handlePageResizeStart}
                      onKeyDown={handlePageResizeKeyDown}
                      aria-label="Resize workspace width"
                      title="Drag to widen or narrow the workspace"
                    >
                      <MoveHorizontalIcon
                        className="page-width-icon"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  <PreviewPanel
                    entry={selectedEntry}
                    onStartWriting={addScratchEntry}
                    onMarkdownChange={(text) => {
                      if (selectedEntry) {
                        updateMarkdown(selectedEntry.id, text);
                        if (isDesktop) {
                          saveState.markEdited();
                          setPendingConflict(null);
                        }
                      }
                    }}
                  />
                </section>
              </section>

              <AboutSection />
            </section>

            <section
              id="view-panel-install"
              className="view-panel"
              role="tabpanel"
              aria-labelledby="view-tab-install"
              hidden={activePage !== "install"}
            >
              <InstallPage active={activePage === "install"} />
            </section>
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
