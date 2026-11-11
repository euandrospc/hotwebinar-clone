export interface MapPinPoint {
  id: string;
  x: number;
  y: number;
}

/** Find overlapping icon bounds for the popup without changing any pin's position.
 * Only direct overlaps count; chains must not combine distant locations.
 */
export function findOverlappingMapPins(points: MapPinPoint[], originId: string, width = 16, height = 22) {
  const origin = points.find((point) => point.id === originId);
  if (!origin) return [];
  return points
    .filter((point) => Math.abs(point.x - origin.x) < width && Math.abs(point.y - origin.y) < height)
    .sort((a, b) => a.id.localeCompare(b.id));
}
