export function normalizeHouseSearch(value: string): string {
  return value.replace(/№/g, " ").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function matchesHouseSearch(query: string, ...names: Array<string | null | undefined>): boolean {
  const search = normalizeHouseSearch(query);
  if (!search) return true;
  const name = normalizeHouseSearch(names.filter(Boolean).join(" "));
  return search.split(" ").filter(Boolean).every(word => /^\d+$/.test(word)
    ? name.split(" ").some(part => part.startsWith(word)) : name.includes(word)) ||
    name.replace(/ /g, "").includes(search.replace(/ /g, ""));
}
