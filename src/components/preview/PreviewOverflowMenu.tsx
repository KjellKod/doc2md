import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

// A single overflow "More" control that demotes the low-frequency toolbar
// actions on hosted phones (P1). It mirrors the proven a11y of the
// WorkingModeBar recent-files menu (WorkingModeBar.tsx:94-136) and the
// PreviewToolbar shortcut popover close logic — real <button> elements,
// role="menu"/role="menuitem", aria-haspopup/expanded/controls, first-item
// focus on open, Escape + click-outside close with focus return, and trapped
// Arrow/Tab navigation (ux-guidebook§4.8). It renders nothing structural on
// desktop because PreviewToolbar only mounts it on the compact render path.

export interface PreviewOverflowMenuItem {
  key: string;
  label: string;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
}

interface PreviewOverflowMenuProps {
  items: PreviewOverflowMenuItem[];
}

export default function PreviewOverflowMenu({
  items,
}: PreviewOverflowMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Focus the first enabled item when the menu opens (mirror
  // WorkingModeBar.tsx:46).
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const firstEnabled = itemRefs.current.find((item) => item && !item.disabled);
    (firstEnabled ?? itemRefs.current[0])?.focus();
  }, [isOpen]);

  // Close on click-outside via a mousedown listener (mirror the shortcut
  // popover at PreviewToolbar.tsx:111-119). Focus is not stolen on outside
  // close.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node | null)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  const closeAndReturnFocus = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const focusableItems = itemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    if (focusableItems.length === 0) {
      return;
    }
    const currentIndex = Math.max(
      0,
      focusableItems.findIndex((item) => item === document.activeElement),
    );

    if (event.key === "Escape") {
      event.preventDefault();
      closeAndReturnFocus();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + focusableItems.length) % focusableItems.length
        : (currentIndex + 1) % focusableItems.length;
      focusableItems[nextIndex]?.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex =
        event.key === "ArrowDown"
          ? (currentIndex + 1) % focusableItems.length
          : (currentIndex - 1 + focusableItems.length) % focusableItems.length;
      focusableItems[nextIndex]?.focus();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusableItems[currentIndex]?.click();
    }
  };

  const stopMenuMouseDown = (event: ReactMouseEvent) => {
    // Keep the trigger's own outside-mousedown listener from treating a click
    // inside the menu as an outside click (mirror WorkingModeBar:148-150).
    event.stopPropagation();
  };

  const runAndClose = (item: PreviewOverflowMenuItem) => {
    if (item.disabled) {
      return;
    }
    setIsOpen(false);
    triggerRef.current?.focus();
    void item.onSelect();
  };

  return (
    <div ref={rootRef} className="preview-overflow-menu">
      <button
        ref={triggerRef}
        type="button"
        className="ghost-button preview-overflow-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label="More actions"
        onClick={() => setIsOpen((open) => !open)}
      >
        <MoreHorizontal className="preview-overflow-icon" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div
          id={menuId}
          className="preview-overflow-popover"
          role="menu"
          aria-label="More actions"
          onKeyDown={handleMenuKeyDown}
          onMouseDown={stopMenuMouseDown}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              className="preview-overflow-item"
              disabled={item.disabled}
              aria-disabled={item.disabled}
              onClick={() => runAndClose(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
