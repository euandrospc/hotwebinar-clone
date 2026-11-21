const webinarTitleCollator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

export function sortWebinarOptions<T extends { id: string; title: string }>(webinars: readonly T[]): T[] {
  return [...webinars].sort((a, b) =>
    webinarTitleCollator.compare(a.title.trim(), b.title.trim()) || a.id.localeCompare(b.id)
  );
}
