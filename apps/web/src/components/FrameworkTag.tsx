const SDG_NAMES: Record<number, string> = {
  1: "No poverty",
  2: "Zero hunger",
  3: "Good health and well-being",
  4: "Quality education",
  5: "Gender equality",
  6: "Clean water and sanitation",
  7: "Affordable and clean energy",
  8: "Decent work and economic growth",
  9: "Industry, innovation and infrastructure",
  10: "Reduced inequalities",
  11: "Sustainable cities and communities",
  12: "Responsible consumption and production",
  13: "Climate action",
  14: "Life below water",
  15: "Life on land",
  16: "Peace, justice and strong institutions",
  17: "Partnerships for the goals",
};

/** SDG tag -> the UN goal page; EBF tag -> our methodology section. `link={false}` inside another link. */
export function FrameworkTag({ kind, value, link = true }: { kind: "sdg" | "ebf"; value: string; link?: boolean }) {
  let label: string, title: string, href: string;
  if (kind === "sdg") {
    const n = Number(value.replace(/^SDG-/, ""));
    label = value;
    title = SDG_NAMES[n] ? `UN Sustainable Development Goal ${n}: ${SDG_NAMES[n]}` : "UN Sustainable Development Goal";
    href = SDG_NAMES[n] ? `https://sdgs.un.org/goals/goal${n}` : "https://sdgs.un.org/goals";
  } else {
    label = `EBF ${value}`;
    title = `Ecological Benefits Framework: ${value} benefit (see methodology)`;
    href = "/methodology#aw";
  }
  const cls = `tag ${kind === "ebf" ? "tag-ebf" : ""}`;
  if (!link) return <span className={cls} title={title}>{label}</span>;
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      title={title}
      className={`${cls} hover:text-accent`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {label}
    </a>
  );
}
