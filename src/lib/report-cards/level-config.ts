export interface DomainConfig {
  name: string;
  subjects: string[]; // Exact names of subjects to include
}

export interface LevelConfig {
  domains: DomainConfig[];
}

export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: {
    domains: [
      {
        name: "مجال اللغة العربية",
        subjects: ["التواصل الشفوي", "الخط", "القراءة", "الإنتاج الكتابي"],
      },
      {
        name: "مجال العلوم والرياضيات",
        subjects: ["الرياضيات", "الإيقاظ العلمي", "التربية التكنولوجية"],
      },
      {
        name: "مجال التنشئة",
        subjects: ["التربية الإسلامية", "تربية موسيقية", "تربية تشكيلية", "تربية بدنية"],
      }
    ]
  }
};
