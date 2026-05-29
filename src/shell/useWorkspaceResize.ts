// AppShell dedup Phase 2 — shared workspace resize state and handlers.
//
// Owns sidebar/workspace width state, edit-shell height state, ceiling math,
// media-query reset, drag handlers, keyboard handlers, reset handlers,
// preview panel ref, body resize classes, and style objects.
//
// Persistence stays outside the hook. Adapter callers supply initial state
// or explicit callbacks when desktop restore or browser persistence is
// needed; native persistence does not move into this module.

import type { CSSProperties, KeyboardEvent, MouseEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export const BASE_PAGE_MAX_WIDTH = 1680;
export const DEFAULT_SIDEBAR_WIDTH = 380;
export const SIDEBAR_COLLAPSE_WIDTH = 56;
export const SIDEBAR_SNAP_THRESHOLD = 200;
export const SIDEBAR_WIDTH_STEP = 16;
export const MIN_EDIT_SHELL_HEIGHT = 240;
export const EDIT_SHELL_HEIGHT_STEP = 32;
export const EDIT_SHELL_BOTTOM_GUTTER = 20;
export const DEFAULT_HEADER_OFFSET_PX = 280;
export const MAX_SIDEBAR_WIDTH = 430;

export type ResizeAxis = "sidebar" | "height";

export function computeEditShellCeiling(
  innerHeight: number,
  previewPanelTop: number | null,
  bottomGutter = EDIT_SHELL_BOTTOM_GUTTER,
  fallbackHeaderOffset = DEFAULT_HEADER_OFFSET_PX,
): number {
  const raw =
    typeof previewPanelTop === "number" &&
    Number.isFinite(previewPanelTop) &&
    previewPanelTop > 0
      ? innerHeight - previewPanelTop - bottomGutter
      : innerHeight - fallbackHeaderOffset;

  return Math.max(MIN_EDIT_SHELL_HEIGHT, Math.round(raw));
}

function outerHeight(element: Element | null): number {
  if (!(element instanceof HTMLElement)) {
    return 0;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const marginTop = Number.parseFloat(style.marginTop) || 0;
  const marginBottom = Number.parseFloat(style.marginBottom) || 0;

  return rect.height + marginTop + marginBottom;
}

function computeFallbackHeaderOffsetPx(): number {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return DEFAULT_HEADER_OFFSET_PX;
  }

  const workspace = document.querySelector(".workspace");
  const workspaceTop = workspace?.getBoundingClientRect().top;
  if (
    typeof workspaceTop === "number" &&
    Number.isFinite(workspaceTop) &&
    workspaceTop > 0
  ) {
    return Math.round(workspaceTop);
  }

  const appShell = document.querySelector(".app-shell");
  const hero = document.querySelector(".hero");
  const viewSwitcherRow = document.querySelector(".view-switcher-row");
  const appShellTopPadding =
    appShell instanceof HTMLElement
      ? Number.parseFloat(window.getComputedStyle(appShell).paddingTop) || 0
      : 0;
  // Fallback breakdown: app shell top padding, rendered hero height,
  // rendered view-switcher row including its bottom margin, and a small
  // workspace gap allowance when layout has not produced a usable rect yet.
  const measuredOffset =
    appShellTopPadding + outerHeight(hero) + outerHeight(viewSwitcherRow) + 24;

  return measuredOffset > 0
    ? Math.round(measuredOffset)
    : DEFAULT_HEADER_OFFSET_PX;
}

function clampEditShellHeight(height: number, ceiling: number) {
  return Math.min(
    Math.max(Math.round(height), MIN_EDIT_SHELL_HEIGHT),
    Math.max(MIN_EDIT_SHELL_HEIGHT, ceiling),
  );
}

function clampSidebarWidth(width: number) {
  return Math.min(
    Math.max(Math.round(width), SIDEBAR_COLLAPSE_WIDTH),
    MAX_SIDEBAR_WIDTH,
  );
}

function clampKeyboardSidebarWidth(width: number) {
  return Math.min(
    Math.max(Math.round(width), SIDEBAR_SNAP_THRESHOLD),
    MAX_SIDEBAR_WIDTH,
  );
}

export type WorkspaceResizeResult = {
  activeResizeAxis: ResizeAxis | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  previewPanelRef: RefObject<HTMLElement | null>;
  pageFrameStyle: CSSProperties;
  workspaceStyle: CSSProperties & Record<"--sidebar-width", string>;
  previewPanelStyle: CSSProperties & Record<"--preview-panel-ceiling", string>;
  handleShowSidebar: () => void;
  handleCollapseSidebar: () => void;
  handleSidebarResizeStart: (event: MouseEvent<HTMLButtonElement>) => void;
  handleSidebarResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  handleSidebarResizeClickReset: (event: MouseEvent<HTMLButtonElement>) => void;
  handleSidebarResizeMouseUp: (event: MouseEvent<HTMLButtonElement>) => void;
  handleSidebarResizeReset: () => void;
  handleHeightResizeStart: (event: MouseEvent<HTMLButtonElement>) => void;
  handleHeightResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  handleHeightResizeClickReset: (event: MouseEvent<HTMLButtonElement>) => void;
  handleHeightResizeMouseUp: (event: MouseEvent<HTMLButtonElement>) => void;
  handleHeightResizeReset: () => void;
  /**
   * Notifies the hook that the user opened a non-scratch entry for the first
   * time. The hook fires the one-shot auto-collapse if the user has not yet
   * expressed a sidebar preference. Responsive-width auto-collapse is opt-in
   * so native shells keep their previous narrow-window behavior. Calling
   * adapters wire this from their post-commit "non-scratch selectedEntry"
   * effect; the hook tracks the one-shot guard and the "user touched sidebar"
   * preference internally.
   */
  triggerFirstOpenAutoCollapse: (selectedEntryIsScratch: boolean) => void;
  /**
   * Recomputes the edit-shell height ceiling against the current layout.
   * Exposed so adapters can re-trigger measurement after the working-mode
   * collapse — a reflow the internal ResizeObserver can miss because none of
   * the observed boxes change size when the panel only shifts position.
   */
  recomputeEditShellHeightCeiling: () => void;
};

export type WorkspaceResizeOptions = {
  autoCollapseResponsiveWidths?: boolean;
  /**
   * Identifier of the currently selected document. When it changes, the hook
   * restores that document's remembered edit-shell height (or falls back to
   * the auto ceiling-driven height when nothing is stored).
   */
  documentKey?: string | null;
  /**
   * Returns the stored edit-shell height for a document id, or null/undefined
   * to use the auto height. Persistence lives in the adapter; the hook only
   * reads through this resolver on document change.
   */
  resolveInitialEditShellHeight?: (key: string) => number | null | undefined;
  /**
   * Persists a user-committed edit-shell height (drag, keyboard, or reset)
   * for the active document. `null` means the document was reset to auto.
   */
  onEditShellHeightChange?: (key: string, height: number | null) => void;
};

export function useWorkspaceResize(
  options: WorkspaceResizeOptions = {},
): WorkspaceResizeResult {
  const autoCollapseResponsiveWidths =
    options.autoCollapseResponsiveWidths ?? false;
  const { documentKey = null } = options;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeResizeAxis, setActiveResizeAxis] = useState<ResizeAxis | null>(
    null,
  );
  const [editShellHeight, setEditShellHeight] = useState<number | null>(null);
  const [editShellHeightCeiling, setEditShellHeightCeiling] = useState(() =>
    computeEditShellCeiling(
      typeof window === "undefined" ? DEFAULT_HEADER_OFFSET_PX : window.innerHeight,
      null,
    ),
  );
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);

  const previewPanelRef = useRef<HTMLElement | null>(null);
  const editShellHeightCeilingRef = useRef(editShellHeightCeiling);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef<number | null>(null);
  const dragStartSidebarWidthRef = useRef<number | null>(null);
  const latestSidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const restoreSidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const lastSidebarClickAtRef = useRef(-Infinity);
  const lastHeightClickAtRef = useRef(-Infinity);
  const sidebarDragMovedRef = useRef(false);
  const heightDragMovedRef = useRef(false);
  const userTouchedSidebarRef = useRef(false);
  const firstAutoCollapseFiredRef = useRef(false);
  // Per-document height memory. These refs keep the latest values readable
  // from event handlers and effects without re-binding on every render, so
  // persistence reads the correct (key, height) pair at commit time.
  const editShellHeightRef = useRef(editShellHeight);
  const documentKeyRef = useRef(documentKey);
  const resolveInitialEditShellHeightRef = useRef(
    options.resolveInitialEditShellHeight,
  );
  const onEditShellHeightChangeRef = useRef(options.onEditShellHeightChange);

  // Keep the latest values readable from event handlers/effects. Synced in an
  // effect (not during render) so ref access stays out of the render path.
  useEffect(() => {
    editShellHeightRef.current = editShellHeight;
    documentKeyRef.current = documentKey;
    resolveInitialEditShellHeightRef.current =
      options.resolveInitialEditShellHeight;
    onEditShellHeightChangeRef.current = options.onEditShellHeightChange;
  });

  // Persist a user-committed height for the active document. Called from the
  // drag-end, keyboard, and reset paths — never from the doc-change restore —
  // so a height is always stored under the key it was produced for.
  const persistEditShellHeight = useCallback((height: number | null) => {
    const key = documentKeyRef.current;
    if (key != null) {
      onEditShellHeightChangeRef.current?.(key, height);
    }
  }, []);

  function measureEditShellHeight(): number | null {
    if (typeof document === "undefined") {
      return null;
    }
    const panel = document.querySelector(".preview-panel");
    if (panel) {
      return clampEditShellHeight(
        panel.getBoundingClientRect().height,
        editShellHeightCeilingRef.current,
      );
    }
    const shell = document.querySelector(".markdown-edit-shell");
    if (shell) {
      return clampEditShellHeight(
        shell.getBoundingClientRect().height,
        editShellHeightCeilingRef.current,
      );
    }
    return MIN_EDIT_SHELL_HEIGHT;
  }

  function measureSidebarWidth(): number | null {
    if (typeof document === "undefined") {
      return null;
    }
    const sidebar =
      document.querySelector<HTMLElement>(".sidebar-panel") ??
      document.querySelector<HTMLElement>(".collapse-rail");
    if (!sidebar) {
      return null;
    }
    return clampSidebarWidth(sidebar.getBoundingClientRect().width);
  }

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia("(max-width: 980px)");
    const handleChange = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        setSidebarCollapsed(false);
        setActiveResizeAxis(null);
        // Clear drag-driven inline overrides when the layout collapses to
        // the mobile single-column breakpoint. Without this, a previously
        // dragged-large editor height or narrowed sidebar would persist as
        // inline style and override the @media single-column rules.
        setEditShellHeight(null);
        setSidebarWidth(null);
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

  const recomputeEditShellHeightCeiling = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const previewPanelTop =
      previewPanelRef.current?.getBoundingClientRect().top ?? null;
    const ceiling = computeEditShellCeiling(
      window.innerHeight,
      previewPanelTop,
      EDIT_SHELL_BOTTOM_GUTTER,
      computeFallbackHeaderOffsetPx(),
    );
    editShellHeightCeilingRef.current = ceiling;
    setEditShellHeightCeiling((current) =>
      current === ceiling ? current : ceiling,
    );
    setEditShellHeight((current) =>
      current === null ? current : clampEditShellHeight(current, ceiling),
    );
  }, []);

  useEffect(() => {
    recomputeEditShellHeightCeiling();

    let frameId: number | null = null;
    if (typeof window.requestAnimationFrame === "function") {
      frameId = window.requestAnimationFrame(recomputeEditShellHeightCeiling);
    }

    window.addEventListener("resize", recomputeEditShellHeightCeiling);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(recomputeEditShellHeightCeiling);
      const previewPanel = previewPanelRef.current;
      const observedElements = new Set<Element>();

      if (previewPanel) {
        observedElements.add(previewPanel);
        if (previewPanel.parentElement) {
          observedElements.add(previewPanel.parentElement);
        }
        const viewPanel = previewPanel.closest(".view-panel");
        if (viewPanel) {
          observedElements.add(viewPanel);
        }
      }

      const appShell = document.querySelector(".app-shell");
      if (appShell) {
        observedElements.add(appShell);
      }

      observedElements.forEach((element) => observer?.observe(element));
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", recomputeEditShellHeightCeiling);
      observer?.disconnect();
    };
  }, [recomputeEditShellHeightCeiling]);

  // Restore the active document's remembered height (or fall back to auto)
  // whenever the selection changes. Runs only on documentKey change so it
  // never clobbers the value the persist path just wrote for another doc.
  useEffect(() => {
    if (documentKey == null) {
      return;
    }
    const stored = resolveInitialEditShellHeightRef.current?.(documentKey);
    setEditShellHeight(
      stored == null
        ? null
        : clampEditShellHeight(stored, editShellHeightCeilingRef.current),
    );
  }, [documentKey]);

  useEffect(() => {
    if (activeResizeAxis === null) {
      return;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (activeResizeAxis === "sidebar") {
        const baseSidebarWidth = dragStartSidebarWidthRef.current;
        if (baseSidebarWidth === null) {
          return;
        }
        if (Math.abs(event.clientX - dragStartXRef.current) > 2) {
          sidebarDragMovedRef.current = true;
        }
        const nextWidth = clampSidebarWidth(
          baseSidebarWidth + (event.clientX - dragStartXRef.current),
        );
        latestSidebarWidthRef.current = nextWidth;
        setSidebarWidth(nextWidth);
        return;
      }

      const baseHeight = dragStartHeightRef.current;
      if (baseHeight !== null) {
        if (Math.abs(event.clientY - dragStartYRef.current) > 2) {
          heightDragMovedRef.current = true;
        }
        const nextHeight = clampEditShellHeight(
          baseHeight + (event.clientY - dragStartYRef.current),
          editShellHeightCeilingRef.current,
        );
        // Sync the ref imperatively here, not only via the passive effect:
        // mouseup persists editShellHeightRef.current and can fire before the
        // final mousemove's effect flushes, which would otherwise store a
        // one-move-stale height.
        editShellHeightRef.current = nextHeight;
        setEditShellHeight(nextHeight);
      }
    };
    const handleMouseUp = (event: globalThis.MouseEvent) => {
      if (
        activeResizeAxis === "sidebar" &&
        latestSidebarWidthRef.current < SIDEBAR_SNAP_THRESHOLD
      ) {
        const restoreWidth = restoreSidebarWidthRef.current;
        setSidebarWidth(restoreWidth);
        // Snap-collapse remains in-session only; reload behavior is unchanged.
        setSidebarCollapsed(true);
      }
      if (activeResizeAxis === "sidebar") {
        if (sidebarDragMovedRef.current) {
          userTouchedSidebarRef.current = true;
        }
        lastSidebarClickAtRef.current = sidebarDragMovedRef.current
          ? -Infinity
          : event.timeStamp;
      }
      if (activeResizeAxis === "height") {
        lastHeightClickAtRef.current = heightDragMovedRef.current
          ? -Infinity
          : event.timeStamp;
        if (heightDragMovedRef.current) {
          persistEditShellHeight(editShellHeightRef.current);
        }
      }
      setActiveResizeAxis(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeResizeAxis, persistEditShellHeight]);

  useEffect(() => {
    document.body.classList.toggle(
      "is-sidebar-resizing",
      activeResizeAxis === "sidebar",
    );
    document.body.classList.toggle(
      "is-height-resizing",
      activeResizeAxis === "height",
    );

    return () => {
      document.body.classList.remove("is-sidebar-resizing");
      document.body.classList.remove("is-height-resizing");
    };
  }, [activeResizeAxis]);

  const handleSidebarResizeReset = useCallback(() => {
    userTouchedSidebarRef.current = true;
    lastSidebarClickAtRef.current = -Infinity;
    restoreSidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH;
    latestSidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH;
    setSidebarCollapsed(false);
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
  }, []);

  const handleSidebarResizeStart = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail >= 2) {
        event.preventDefault();
        handleSidebarResizeReset();
        return;
      }

      const measuredSidebarWidth = measureSidebarWidth();
      const startWidth =
        sidebarWidth ?? measuredSidebarWidth ?? MAX_SIDEBAR_WIDTH;
      dragStartXRef.current = event.clientX;
      dragStartSidebarWidthRef.current = startWidth;
      latestSidebarWidthRef.current = startWidth;
      restoreSidebarWidthRef.current = startWidth;
      sidebarDragMovedRef.current = false;
      setSidebarWidth(startWidth);
      setSidebarCollapsed(false);
      setActiveResizeAxis("sidebar");
    },
    [handleSidebarResizeReset, sidebarWidth],
  );

  const handleSidebarResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        userTouchedSidebarRef.current = true;
        setSidebarWidth((current) =>
          clampKeyboardSidebarWidth(
            (current ?? measureSidebarWidth() ?? MAX_SIDEBAR_WIDTH) +
              SIDEBAR_WIDTH_STEP,
          ),
        );
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        userTouchedSidebarRef.current = true;
        setSidebarWidth((current) =>
          clampKeyboardSidebarWidth(
            (current ?? measureSidebarWidth() ?? MAX_SIDEBAR_WIDTH) -
              SIDEBAR_WIDTH_STEP,
          ),
        );
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        handleSidebarResizeReset();
      }
    },
    [handleSidebarResizeReset],
  );

  const handleSidebarResizeClickReset = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const elapsedSinceLastClick =
        event.timeStamp - lastSidebarClickAtRef.current;
      lastSidebarClickAtRef.current = event.timeStamp;

      if (event.detail < 2 && elapsedSinceLastClick >= 500) {
        return;
      }

      event.preventDefault();
      lastSidebarClickAtRef.current = -Infinity;
      handleSidebarResizeReset();
    },
    [handleSidebarResizeReset],
  );

  const handleSidebarResizeMouseUp = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      lastSidebarClickAtRef.current = sidebarDragMovedRef.current
        ? -Infinity
        : event.timeStamp;
    },
    [],
  );

  const handleCollapseSidebar = useCallback(() => {
    userTouchedSidebarRef.current = true;
    restoreSidebarWidthRef.current =
      sidebarWidth ?? measureSidebarWidth() ?? DEFAULT_SIDEBAR_WIDTH;
    setSidebarCollapsed(true);
  }, [sidebarWidth]);

  const handleShowSidebar = useCallback(() => {
    userTouchedSidebarRef.current = true;
    setSidebarWidth(restoreSidebarWidthRef.current);
    setSidebarCollapsed(false);
  }, []);

  const handleHeightResizeReset = useCallback(() => {
    lastHeightClickAtRef.current = -Infinity;
    setEditShellHeight(null);
    persistEditShellHeight(null);
  }, [persistEditShellHeight]);

  const handleHeightResizeStart = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail >= 2) {
        event.preventDefault();
        handleHeightResizeReset();
        return;
      }

      recomputeEditShellHeightCeiling();
      const measuredHeight =
        editShellHeight ?? measureEditShellHeight() ?? MIN_EDIT_SHELL_HEIGHT;
      dragStartYRef.current = event.clientY;
      dragStartHeightRef.current = measuredHeight;
      heightDragMovedRef.current = false;
      setActiveResizeAxis("height");
    },
    [editShellHeight, handleHeightResizeReset, recomputeEditShellHeightCeiling],
  );

  const handleHeightResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const base =
          editShellHeightRef.current ??
          measureEditShellHeight() ??
          MIN_EDIT_SHELL_HEIGHT;
        const delta =
          event.key === "ArrowDown"
            ? EDIT_SHELL_HEIGHT_STEP
            : -EDIT_SHELL_HEIGHT_STEP;
        const next = clampEditShellHeight(
          base + delta,
          editShellHeightCeilingRef.current,
        );
        setEditShellHeight(next);
        persistEditShellHeight(next);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        handleHeightResizeReset();
      }
    },
    [handleHeightResizeReset, persistEditShellHeight],
  );

  const handleHeightResizeClickReset = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const elapsedSinceLastClick =
        event.timeStamp - lastHeightClickAtRef.current;
      lastHeightClickAtRef.current = event.timeStamp;

      if (event.detail < 2 && elapsedSinceLastClick >= 500) {
        return;
      }

      event.preventDefault();
      lastHeightClickAtRef.current = -Infinity;
      handleHeightResizeReset();
    },
    [handleHeightResizeReset],
  );

  const handleHeightResizeMouseUp = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      lastHeightClickAtRef.current = heightDragMovedRef.current
        ? -Infinity
        : event.timeStamp;
    },
    [],
  );

  const triggerFirstOpenAutoCollapse = useCallback(
    (selectedEntryIsScratch: boolean) => {
      if (firstAutoCollapseFiredRef.current) {
        return;
      }
      if (selectedEntryIsScratch) {
        return;
      }
      if (userTouchedSidebarRef.current) {
        return;
      }
      if (sidebarCollapsed) {
        return;
      }
      if (
        !autoCollapseResponsiveWidths &&
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 980px)").matches
      ) {
        return;
      }
      firstAutoCollapseFiredRef.current = true;
      restoreSidebarWidthRef.current =
        sidebarWidth ?? measureSidebarWidth() ?? DEFAULT_SIDEBAR_WIDTH;
      setSidebarCollapsed(true);
    },
    [autoCollapseResponsiveWidths, sidebarCollapsed, sidebarWidth],
  );

  const pageFrameStyle = {
    "--page-max-width": `${BASE_PAGE_MAX_WIDTH}px`,
  } as CSSProperties;

  const previewPanelStyle =
    editShellHeight !== null
      ? ({
          "--preview-panel-ceiling": `${editShellHeightCeiling}px`,
          height: `${editShellHeight}px`,
          minHeight: `${editShellHeight}px`,
        } as CSSProperties & Record<"--preview-panel-ceiling", string>)
      : ({
          "--preview-panel-ceiling": `${editShellHeightCeiling}px`,
        } as CSSProperties & Record<"--preview-panel-ceiling", string>);

  const workspaceStyle = {
    "--sidebar-width": `${sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH}px`,
  } as CSSProperties & Record<"--sidebar-width", string>;

  return {
    activeResizeAxis,
    sidebarCollapsed,
    setSidebarCollapsed,
    previewPanelRef,
    pageFrameStyle,
    workspaceStyle,
    previewPanelStyle,
    handleShowSidebar,
    handleCollapseSidebar,
    handleSidebarResizeStart,
    handleSidebarResizeKeyDown,
    handleSidebarResizeClickReset,
    handleSidebarResizeMouseUp,
    handleSidebarResizeReset,
    handleHeightResizeStart,
    handleHeightResizeKeyDown,
    handleHeightResizeClickReset,
    handleHeightResizeMouseUp,
    handleHeightResizeReset,
    triggerFirstOpenAutoCollapse,
    recomputeEditShellHeightCeiling,
  };
}
