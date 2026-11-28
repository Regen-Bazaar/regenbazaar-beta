import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** One message block for a warning (default), an error (`bad`) or good news (`ok`). */
export function Note({ tone = "warn", title, children }: { tone?: "warn" | "bad" | "ok"; title?: string; children?: ReactNode }) {
  return (
    <div className={`note ${tone === "bad" ? "note-bad" : tone === "ok" ? "note-ok" : ""}`} role={tone === "bad" ? "alert" : "status"}>
      <Icon name={tone === "ok" ? "check" : "alert"} />
      <div>
        {title && <b>{title}</b>}
        {children}
      </div>
    </div>
  );
}
