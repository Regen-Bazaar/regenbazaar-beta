"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Sheet over the dimmed page: from the bottom on a phone, a centred dialog on desktop.
 * `menu` places it under the app bar on desktop, as a menu. Native <dialog>: focus stays inside, Esc closes.
 */
export function Sheet({
  open,
  onClose,
  title,
  menu = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  menu?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`sheet ${menu ? "sheet-pop" : ""}`}
      aria-labelledby={id}
      onClose={onClose}
      // The dialog box has no padding of its own, so a click that lands on it is a click on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="sheet-body">
          <h2 id={id}>{title}</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
          {children}
        </div>
      )}
    </dialog>
  );
}
