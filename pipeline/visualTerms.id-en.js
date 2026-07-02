// Niche-specific ID -> EN concept map for stock-footage search queries.
// Pexels search works best in English; raw Indonesian VO keywords rarely match well.
export const ID_EN_VISUAL = {
  ai: "artificial intelligence",
  karyawan: "office worker",
  kerja: "working",
  bayar: "money payment",
  dibayar: "money payment",
  bosnya: "boss",
  uang: "money",
  duit: "money",
  cuan: "money success",
  laptop: "laptop",
  hp: "smartphone",
  hape: "smartphone",
  ponsel: "smartphone",
  skill: "skill learning",
  klien: "client meeting",
  umkm: "small business shop",
  bisnis: "small business",
  freelance: "freelancer working laptop",
  digital: "digital technology",
  online: "online work",
  portfolio: "portfolio work",
  gampang: "easy simple",
  mudah: "easy simple",
  sukses: "success",
  gagal: "failure",
  malam: "night",
  pagi: "morning",
  kantor: "office",
  rumah: "home",
  belajar: "learning studying",
  template: "template document",
  ragu: "hesitant unsure person",
  percaya: "confident person",
  golden: "golden hour",
};

export function toVisualQuery(keywords) {
  const translated = keywords.map((k) => ID_EN_VISUAL[k] || k);
  return [...new Set(translated)].join(" ");
}
