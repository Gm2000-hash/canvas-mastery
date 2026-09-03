// MONOCHROME baseline — every unit renders identically in black/white/grey.
// Color coding was deprecated when the app moved to a strict B&W theme.
const NEUTRAL = {
  bg: "bg-muted",
  text: "text-foreground",
  border: "border-border",
  dot: "bg-foreground",
};

const UNIT_COLORS = [NEUTRAL];

export function getUnitColor(_unitId: string | null) {
  return NEUTRAL;
}

export { UNIT_COLORS };
