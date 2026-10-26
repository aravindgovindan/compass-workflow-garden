/** Palette for statuses, priorities and labels. Stored by name; rendered via design tokens. */
export const CONFIG_COLORS = ["slate", "blue", "teal", "green", "amber", "red", "violet", "pink"] as const;
export type ConfigColor = (typeof CONFIG_COLORS)[number];

const DOT: Record<ConfigColor, string> = {
  slate: "bg-swatch-slate",
  blue: "bg-swatch-blue",
  teal: "bg-swatch-teal",
  green: "bg-swatch-green",
  amber: "bg-swatch-amber",
  red: "bg-swatch-red",
  violet: "bg-swatch-violet",
  pink: "bg-swatch-pink",
};

export function swatchClass(color: string): string {
  return DOT[(CONFIG_COLORS as readonly string[]).includes(color) ? (color as ConfigColor) : "slate"];
}
