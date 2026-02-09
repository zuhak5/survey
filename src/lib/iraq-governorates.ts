export type IraqGovernorate = {
  code: string;
  name_ar: string;
  name_en: string;
  aliases: string[];
};

export const IRAQ_GOVERNORATES: IraqGovernorate[] = [
  { code: "baghdad", name_ar: "بغداد", name_en: "Baghdad", aliases: ["baghdad", "بغداد"] },
  { code: "basra", name_ar: "البصرة", name_en: "Basra", aliases: ["basra", "البصرة", "البصره"] },
  { code: "nineveh", name_ar: "نينوى", name_en: "Nineveh", aliases: ["nineveh", "نينوى", "نينوي"] },
  { code: "anbar", name_ar: "الأنبار", name_en: "Al Anbar", aliases: ["anbar", "al anbar", "الانبار", "الأنبار"] },
  { code: "diyala", name_ar: "ديالى", name_en: "Diyala", aliases: ["diyala", "ديالى", "دياله"] },
  { code: "babil", name_ar: "بابل", name_en: "Babil", aliases: ["babil", "بابل"] },
  { code: "karbala", name_ar: "كربلاء", name_en: "Karbala", aliases: ["karbala", "كربلاء", "كربلا"] },
  { code: "najaf", name_ar: "النجف", name_en: "Najaf", aliases: ["najaf", "النجف"] },
  { code: "qadisiyyah", name_ar: "القادسية", name_en: "Al-Qadisiyyah", aliases: ["qadisiyyah", "al qadisiyyah", "القادسية", "القادسيه"] },
  { code: "muthanna", name_ar: "المثنى", name_en: "Al Muthanna", aliases: ["muthanna", "al muthanna", "المثنى", "المثني"] },
  { code: "dhi_qar", name_ar: "ذي قار", name_en: "Dhi Qar", aliases: ["dhi qar", "ذي قار", "ذيقار"] },
  { code: "maysan", name_ar: "ميسان", name_en: "Maysan", aliases: ["maysan", "ميسان"] },
  { code: "wasit", name_ar: "واسط", name_en: "Wasit", aliases: ["wasit", "واسط"] },
  { code: "salah_al_din", name_ar: "صلاح الدين", name_en: "Salah al-Din", aliases: ["salah al-din", "salahaddin", "صلاح الدين"] },
  { code: "kirkuk", name_ar: "كركوك", name_en: "Kirkuk", aliases: ["kirkuk", "كركوك"] },
  { code: "erbil", name_ar: "أربيل", name_en: "Erbil", aliases: ["erbil", "اربيل", "أربيل"] },
  { code: "sulaymaniyah", name_ar: "السليمانية", name_en: "Sulaymaniyah", aliases: ["sulaymaniyah", "sulaimaniyah", "السليمانية", "السليمانيه"] },
  { code: "duhok", name_ar: "دهوك", name_en: "Duhok", aliases: ["duhok", "دهوك"] },
];

function stripCommonAffixes(value: string): string {
  return value
    .replace(/\b(governorate|province|state)\b/gi, "")
    .replace(/\b(of)\b/gi, "")
    .replace(/محافظة|محافظه/g, "");
}

export function normalizeGovernorateName(value: string): string {
  const cleaned = stripCommonAffixes(value);
  return cleaned
    .replace(/[،,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function governorateCodeFromName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeGovernorateName(value);
  if (!normalized) {
    return null;
  }

  for (const gov of IRAQ_GOVERNORATES) {
    if (gov.aliases.some((alias) => normalizeGovernorateName(alias) === normalized)) {
      return gov.code;
    }
  }

  // Fallback: substring match (handles cases like "Baghdad Governorate").
  for (const gov of IRAQ_GOVERNORATES) {
    if (gov.aliases.some((alias) => normalized.includes(normalizeGovernorateName(alias)))) {
      return gov.code;
    }
  }

  return null;
}

