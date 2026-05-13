export function tokenizeSearch(input: string) {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]+/gu, ""))
    .filter(Boolean);
}
