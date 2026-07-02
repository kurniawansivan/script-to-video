export const ID_STOPWORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "pada", "dengan", "ini", "itu",
  "adalah", "atau", "juga", "akan", "tidak", "ada", "sudah", "belum", "bisa",
  "kamu", "kau", "aku", "saya", "kita", "kami", "mereka", "dia", "nya",
  "gara", "gara-gara", "kayak", "kok", "sih", "deh", "loh", "dong", "banget",
  "cuma", "malah", "jadi", "kalau", "biar", "buat", "punya", "lagi", "masih",
  "tau", "cara", "orang", "gak", "nggak", "ngga", "dulu", "aja", "harus",
  "satu", "dua", "seri", "step", "by",
]);

export function extractKeywords(text, max = 4) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !ID_STOPWORDS.has(w) && w.length > 2);

  const uniqueByLength = [...new Set(words)].sort((a, b) => b.length - a.length);
  return uniqueByLength.slice(0, max);
}
