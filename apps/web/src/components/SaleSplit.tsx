import { bpsToPercent, saleSplitBps } from "../lib/partner-share";

/** Where each payment goes, as RegenPrimarySale pays it in the same transaction. */
export function SaleSplit({ partner }: { partner: { name: string; feeBps: number } | null }) {
  const split = saleSplitBps(partner?.feeBps ?? 0);
  return (
    <div className="mt-2 flex items-baseline justify-between gap-3 text-sm text-muted">
      <span>Payment goes to</span>
      <span className="text-right">
        creator {bpsToPercent(split.creator)}
        {partner && (
          <>
            {" "}· {partner.name} {bpsToPercent(split.partner)}
          </>
        )}{" "}
        · platform {bpsToPercent(split.platform)}
      </span>
    </div>
  );
}
