// Regen Bazaar icon set: one grid (24), one stroke (1.75), drawn for the redesign. Inner SVG markup is static.
const PATHS = {
  alert: "<path d=\"M12 4l9 16H3z\"/><path d=\"M12 10v4.5M12 17.5v.010\"/>",
  arrowup: "<path d=\"M12 19V6M6 12l6-6 6 6\"/>",
  back: "<path d=\"M15 6l-6 6 6 6\"/>",
  bag: "<path d=\"M4 7h16\"/><path d=\"M9 7V4.5h6V7\"/><path d=\"M6 7l1 13h10l1-13\"/><path d=\"M10 11v5M14 11v5\"/>",
  book: "<path d=\"M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z\"/><path d=\"M5 17a3 3 0 0 1 3-3h11\"/>",
  calendar: "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 9.5h16M8 3v4M16 3v4\"/>",
  camera: "<path d=\"M4 8h3l1.5-2h7L17 8h3v11H4z\"/><circle cx=\"12\" cy=\"13\" r=\"3.5\"/>",
  cap: "<path d=\"M2 9l10-5 10 5-10 5z\"/><path d=\"M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5\"/><path d=\"M22 9v6\"/>",
  chat: "<path d=\"M4 5h16v11H9l-5 4z\"/>",
  check: "<path d=\"M5 12.5l4.5 4.5L19 7.5\"/>",
  chev: "<path d=\"M9 6l6 6-6 6\"/>",
  city: "<path d=\"M4 20V9l5-3v14M9 20V4l7 3v13M16 20v-8l4 2v6M3 20h18\"/>",
  clock: "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 7.5V12l3 2\"/>",
  coast: "<path d=\"M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0\"/><path d=\"M6 12a6 6 0 0 1 12 0\"/>",
  copy: "<rect x=\"8\" y=\"8\" width=\"11\" height=\"12\" rx=\"2\"/><path d=\"M5 16V6a2 2 0 0 1 2-2h8\"/>",
  cup: "<path d=\"M6 8h10v6a5 5 0 0 1-10 0zM16 9h2a2 2 0 0 1 0 4h-2M5 20h12\"/>",
  doc: "<path d=\"M7 3h7l4 4v14H7z\"/><path d=\"M14 3v4h4\"/>",
  dots: "<circle cx=\"6\" cy=\"6\" r=\"1.7\"/><circle cx=\"12\" cy=\"6\" r=\"1.7\"/><circle cx=\"18\" cy=\"6\" r=\"1.7\"/><circle cx=\"6\" cy=\"12\" r=\"1.7\"/><circle cx=\"12\" cy=\"12\" r=\"1.7\"/><circle cx=\"18\" cy=\"12\" r=\"1.7\"/><circle cx=\"6\" cy=\"18\" r=\"1.7\"/><circle cx=\"12\" cy=\"18\" r=\"1.7\"/><circle cx=\"18\" cy=\"18\" r=\"1.7\"/>",
  down: "<path d=\"M6 9l6 6 6-6\"/>",
  download: "<path d=\"M12 4v11M7 11l5 5 5-5M5 20h14\"/>",
  drop: "<path d=\"M12 4s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10z\"/>",
  edit: "<path d=\"M4 20h4L19 9l-4-4L4 16z\"/>",
  eye: "<path d=\"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\"/>",
  eyeoff: "<path d=\"M4 4l16 16\"/><path d=\"M9.5 6C10.3 5.7 11.1 5.5 12 5.5c6 0 9.5 6.5 9.5 6.5s-1 1.9-2.9 3.6M6.2 8.1C3.8 9.8 2.5 12 2.5 12S6 18.5 12 18.5c1.3 0 2.5-.3 3.5-.8\"/>",
  flag: "<path d=\"M6 21V4h11l-2 4 2 4H6\"/>",
  flame: "<path d=\"M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z\"/>",
  globe: "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17\"/>",
  grass: "<path d=\"M4 20c1-5 2-7 4-9M9 20c0-6 1-9 3-12M14 20c0-5 1-7 3-9M3 20h18\"/>",
  grid: "<rect x=\"4\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"4\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/>",
  heart: "<path d=\"M12 20s-7-4.3-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.7 12 20 12 20z\"/>",
  image: "<rect x=\"4\" y=\"5\" width=\"16\" height=\"14\" rx=\"2\"/><path d=\"M4 16l5-5 4 4 3-3 4 4\"/><circle cx=\"9\" cy=\"9.5\" r=\"1.5\"/>",
  layers: "<path d=\"M12 4l9 5-9 5-9-5z\"/><path d=\"M3 14l9 5 9-5\"/>",
  link: "<path d=\"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1\"/>",
  list: "<path d=\"M9 6h11M9 12h11M9 18h11\"/><path d=\"M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2\"/>",
  lock: "<rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>",
  minus: "<path d=\"M6 12h12\"/>",
  out: "<path d=\"M14 5h5v5M19 5l-8 8\"/><path d=\"M11 6H6v12h12v-5\"/>",
  pause: "<path d=\"M9 6v12M15 6v12\"/>",
  paw: "<path d=\"M12 13c-3 0-5 2.2-5 4.3 0 1.4 1.1 2.2 2.5 2.2 1 0 1.7-.5 2.5-.5s1.5.5 2.5.5c1.4 0 2.5-.8 2.5-2.2C17 15.2 15 13 12 13z\"/><circle cx=\"6.5\" cy=\"10.5\" r=\"1.4\"/><circle cx=\"10\" cy=\"7\" r=\"1.4\"/><circle cx=\"14\" cy=\"7\" r=\"1.4\"/><circle cx=\"17.5\" cy=\"10.5\" r=\"1.4\"/>",
  pin: "<path d=\"M12 21s-6-5.5-6-10.5a6 6 0 0 1 12 0C18 15.5 12 21 12 21z\"/><circle cx=\"12\" cy=\"10.5\" r=\"2\"/>",
  plus: "<path d=\"M12 6v12M6 12h12\"/>",
  qr: "<rect x=\"4\" y=\"4\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"14\" y=\"4\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"4\" y=\"14\" width=\"6\" height=\"6\" rx=\"1\"/><path d=\"M14 14h2v2M20 14v2M14 20h2M18 18h2v2\"/>",
  reef: "<path d=\"M12 20v-7M12 13c0-3-3-3-3-6M12 13c0-3 3-3 3-6M9 16c-2 0-3-1-3-3M15 16c2 0 3-1 3-3\"/>",
  refresh: "<path d=\"M20 12a8 8 0 1 1-2.3-5.7\"/><path d=\"M20 4v5h-5\"/>",
  ruler: "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"1.5\"/><path d=\"M7 8v3M11 8v4M15 8v3M19 8v0\"/>",
  seagrass: "<path d=\"M7 20c0-6 2-8 1-13M12 20c0-7-2-9 0-15M17 20c0-6-2-8-1-13\"/>",
  seal: "<circle cx=\"12\" cy=\"10\" r=\"6\"/><path d=\"M9 15.5L8 21l4-2 4 2-1-5.5\"/><path d=\"M9.5 10l2 2 3-3.5\"/>",
  search: "<circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"M16 16l4 4\"/>",
  share: "<circle cx=\"6\" cy=\"12\" r=\"2.5\"/><circle cx=\"17\" cy=\"6\" r=\"2.5\"/><circle cx=\"17\" cy=\"18\" r=\"2.5\"/><path d=\"M8.2 10.8l6.6-3.6M8.2 13.2l6.6 3.6\"/>",
  shield: "<path d=\"M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z\"/><path d=\"M9 12l2 2 4-4\"/>",
  sign: "<path d=\"M4 17c3-6 5-9 7-9s0 7 2 7 2-4 4-4 1 3 3 3\"/><path d=\"M4 20h16\"/>",
  sliders: "<path d=\"M4 7h10M18 7h2M4 17h4M12 17h8\"/><circle cx=\"16\" cy=\"7\" r=\"2\"/><circle cx=\"10\" cy=\"17\" r=\"2\"/>",
  sort: "<path d=\"M7 5v14M4 16l3 3 3-3M14 7h6M14 12h4M14 17h2\"/>",
  spark: "<path d=\"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z\"/><path d=\"M19 15l.700 2 2 .700-2 .700-.700 2-.700-2-2-.700 2-.700z\"/>",
  spin: "<path d=\"M12 3.5a8.5 8.5 0 1 0 8.5 8.5\" /><path d=\"M12 3.5a8.5 8.5 0 0 1 8.5 8.5\" opacity=\".25\"/>",
  sprout: "<path d=\"M12 21V11\"/><path d=\"M12 13C12 9 9 7 5 7c0 4 3 6 7 6z\"/><path d=\"M12 11c0-4 3-6 7-6 0 4-3 6-7 6z\"/>",
  star: "<path d=\"M12 4l2.4 5 5.6.700-4 3.9 1 5.4-5-2.7-5 2.7 1-5.4-4-3.9 5.6-.700z\"/>",
  store: "<path d=\"M4 9l1.5-5h13L20 9\"/><path d=\"M5 9v11h14V9\"/><path d=\"M4 9h16\"/><path d=\"M9.5 20v-6h5v6\"/>",
  switch: "<path d=\"M4 8h14l-3-3M20 16H6l3 3\"/>",
  text: "<path d=\"M5 6h14M5 10h14M5 14h9M5 18h6\"/>",
  token: "<path d=\"M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z\"/><path d=\"M9 12l2 2 4-4\"/>",
  tool: "<path d=\"M14 6a4 4 0 0 0 5 5l-8 8a2 2 0 0 1-3-3z\"/>",
  trash: "<path d=\"M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13\"/>",
  tree: "<path d=\"M12 21v-6\"/><path d=\"M12 3l5 7h-3l4 5H6l4-5H7z\"/>",
  trophy: "<path d=\"M8 4h8v5a4 4 0 0 1-8 0z\"/><path d=\"M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4\"/><path d=\"M12 13v4M8.5 20h7M10 17h4\"/>",
  truck: "<path d=\"M3 7h11v9H3zM14 10h4l3 3v3h-7z\"/><circle cx=\"7\" cy=\"17.5\" r=\"1.5\"/><circle cx=\"17\" cy=\"17.5\" r=\"1.5\"/>",
  undo: "<path d=\"M8 5L4 9l4 4\"/><path d=\"M4 9h10a5 5 0 0 1 0 10h-3\"/>",
  up: "<path d=\"M6 15l6-6 6 6\"/>",
  user: "<circle cx=\"12\" cy=\"8\" r=\"3.5\"/><path d=\"M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5\"/>",
  users: "<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6\"/><circle cx=\"17\" cy=\"9\" r=\"2.5\"/><path d=\"M16.5 14.2c2.8.3 4.5 2.4 4.5 5.8\"/>",
  wallet: "<rect x=\"3\" y=\"6\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M3 10h18\"/><circle cx=\"16.5\" cy=\"14.5\" r=\"1\"/>",
  wave: "<path d=\"M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0\"/>",
  x: "<path d=\"M6 6l12 12M18 6L6 18\"/>",
} as const;

export type IconName = keyof typeof PATHS;

/** Decorative by default; pass `title` when the icon is the only label. */
export function Icon({ name, className = "", title }: { name: IconName; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`ic ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      // Static strings from the table above, never user data.
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
