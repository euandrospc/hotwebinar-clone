export interface MapPinPoint {
  id: string;
  x: number;
  y: number;
}

// Only the marker's screen position changes. The stored location stays intact.
// A spatial grid keeps individual pins selectable even at identical coordinates.
export function separateMapPins(points: MapPinPoint[], spacing = 21) {
  const cells = new Map<string, MapPinPoint[]>();
  const cursors = new Map<string, number>();
  const offsets = new Map<string, { x: number; y: number }>();
  const angle = Math.PI * (3 - Math.sqrt(5));

  function isFree(x: number, y: number) {
    const column = Math.floor(x / spacing);
    const row = Math.floor(y / spacing);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nearby = cells.get(`${column + dx}:${row + dy}`) ?? [];
        if (nearby.some((point) => Math.hypot(point.x - x, point.y - y) < spacing)) return false;
      }
    }
    return true;
  }

  for (const point of [...points].sort((a, b) => a.id.localeCompare(b.id))) {
    const origin = `${point.x}:${point.y}`;
    let index = cursors.get(origin) ?? 0;
    let x = point.x;
    let y = point.y;
    while (true) {
      const radius = spacing * 0.62 * Math.sqrt(index);
      x = point.x + Math.cos(index * angle) * radius;
      y = point.y + Math.sin(index * angle) * radius;
      index++;
      if (isFree(x, y)) break;
    }
    cursors.set(origin, index);
    const cell = `${Math.floor(x / spacing)}:${Math.floor(y / spacing)}`;
    const occupied = cells.get(cell) ?? [];
    occupied.push({ id: point.id, x, y });
    cells.set(cell, occupied);
    offsets.set(point.id, { x: x - point.x, y: y - point.y });
  }

  return offsets;
}
