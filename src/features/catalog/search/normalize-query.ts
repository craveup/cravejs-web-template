const COMBINING_MARKS = /\p{M}+/gu;
const WHITESPACE = /\s+/u;

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLocaleLowerCase()
    .trim();
}

export function tokenizeQuery(value: string): string[] {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(WHITESPACE) : [];
}
