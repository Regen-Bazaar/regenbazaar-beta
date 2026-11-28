import { Icon, type IconName } from "./Icon";

const R = 30;
const C = 2 * Math.PI * R;

/** Progress ring: `value` 0..1; the level number in the middle, or the area icon while there is no level. */
export function Ring({ value, level, icon, label, className = "" }: { value: number; level?: number; icon?: IconName; label: string; className?: string }) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <span className={`ring relative ${className}`} role="img" aria-label={label}>
      <svg viewBox="0 0 72 72" className="block h-full w-full" aria-hidden="true">
        <circle cx="36" cy="36" r={R} fill="none" stroke="var(--rb-raised)" strokeWidth="6" />
        {v > 0 && (
          <circle
            cx="36"
            cy="36"
            r={R}
            fill="none"
            stroke="var(--rb-ok)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(C * v).toFixed(1)} ${C.toFixed(1)}`}
            transform="rotate(-90 36 36)"
          />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        {level ? <span className="font-display text-[28px] leading-none">{level}</span> : icon ? <Icon name={icon} className="ic-lg text-subtle" /> : null}
      </span>
    </span>
  );
}
