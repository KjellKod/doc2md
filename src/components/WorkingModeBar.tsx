import { FilePlus, FolderOpen } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import type { DesktopRecentFile } from "../types/doc2mdShell";

type WorkingModeBarVariant = "browser" | "desktop";

interface WorkingModeBarProps {
  variant: WorkingModeBarVariant;
  onHome: () => void;
  onOpen: () => void | Promise<void>;
  onNew: () => void;
  recentFiles?: DesktopRecentFile[];
  onOpenRecentFile?: (path: string) => void | Promise<void>;
}

export default function WorkingModeBar({
  variant,
  onHome,
  onOpen,
  onNew,
  recentFiles = [],
  onOpenRecentFile,
}: WorkingModeBarProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const hasDesktopRecentMenu = variant === "desktop" && recentFiles.length > 0;

  useEffect(() => {
    if (!isRecentOpen) {
      return;
    }

    menuItemRefs.current[0]?.focus();
  }, [isRecentOpen]);

  useEffect(() => {
    if (!isRecentOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node | null)) {
        setIsRecentOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isRecentOpen]);

  useEffect(() => {
    if (!hasDesktopRecentMenu) {
      setIsRecentOpen(false);
    }
  }, [hasDesktopRecentMenu]);

  const closeMenu = () => {
    setIsRecentOpen(false);
  };

  const closeMenuAndReturnFocus = () => {
    setIsRecentOpen(false);
    openButtonRef.current?.focus();
  };

  const runAndClose = (callback: () => void | Promise<void>) => {
    closeMenu();
    void callback();
  };

  const handleOpenClick = () => {
    if (!hasDesktopRecentMenu) {
      void onOpen();
      return;
    }

    setIsRecentOpen((isOpen) => !isOpen);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    if (items.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      items.findIndex((item) => item === document.activeElement),
    );

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenuAndReturnFocus();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + items.length) % items.length
        : (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex =
        event.key === "ArrowDown"
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
      items[nextIndex]?.focus();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      items[currentIndex]?.click();
    }
  };

  const handleHome = () => {
    closeMenu();
    onHome();
  };

  const handleNew = () => {
    closeMenu();
    onNew();
  };

  const stopMenuMouseDown = (event: ReactMouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div ref={rootRef} className={`working-mode-bar working-mode-bar-${variant}`}>
      <button
        type="button"
        className="working-mode-logo"
        aria-label="Show intro and return to landing"
        title="Show intro and return to landing"
        onClick={handleHome}
      >
        <span className="working-mode-wordmark">
          <span className="working-mode-brand">doc2md</span>
          <span className="working-mode-wordmark-sep" aria-hidden="true"> - </span>
          <span className="working-mode-tagline">PRIVATE MARKDOWN WORKSPACE</span>
        </span>
      </button>

      <div className="working-mode-actions">
        <div className="working-mode-open-group">
          <button
            ref={openButtonRef}
            type="button"
            className="secondary-button working-mode-button"
            aria-haspopup={hasDesktopRecentMenu ? "menu" : undefined}
            aria-expanded={hasDesktopRecentMenu ? isRecentOpen : undefined}
            aria-controls={hasDesktopRecentMenu ? menuId : undefined}
            onClick={handleOpenClick}
          >
            <FolderOpen className="working-mode-button-icon" aria-hidden="true" />
            <span>Open</span>
          </button>

          {hasDesktopRecentMenu && isRecentOpen ? (
            <div
              id={menuId}
              className="working-mode-recent-menu"
              role="menu"
              aria-label="Recent files"
              onKeyDown={handleMenuKeyDown}
              onMouseDown={stopMenuMouseDown}
            >
              <button
                ref={(element) => {
                  menuItemRefs.current[0] = element;
                }}
                type="button"
                role="menuitem"
                className="working-mode-recent-item"
                onClick={() => runAndClose(onOpen)}
              >
                Browse...
              </button>
              {recentFiles.map((file, index) => (
                <button
                  key={file.path}
                  ref={(element) => {
                    menuItemRefs.current[index + 1] = element;
                  }}
                  type="button"
                  role="menuitem"
                  className="working-mode-recent-item"
                  title={file.path}
                  onClick={() =>
                    runAndClose(() => onOpenRecentFile?.(file.path))
                  }
                >
                  <span className="working-mode-recent-name">
                    {file.displayName}
                  </span>
                  <span className="working-mode-recent-path">{file.path}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="primary-button working-mode-button"
          onClick={handleNew}
        >
          <FilePlus className="working-mode-button-icon" aria-hidden="true" />
          <span>New</span>
        </button>
      </div>
    </div>
  );
}
