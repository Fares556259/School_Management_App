export interface SubjectConfig {
  search: string; // The text to search for in the database subject name
  display: string; // The exact text to display on the report card
}

export interface DomainConfig {
  name: string;
  subjects: SubjectConfig[];
}

export interface LevelConfig {
  domains: DomainConfig[];
}

export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: {
    domains: [
      {
        name: "مجال العربية",
        subjects: [
          { search: "التواصل الشفوي", display: "تواصل شفوي" },
          { search: "الخط", display: "الخط" },
          { search: "القراءة", display: "القراءة" },
          { search: "الإنتاج الكتابي", display: "الانتاج الكتابي" },
        ],
      },
      {
        name: "مجال العلوم",
        subjects: [
          { search: "الرياضيات", display: "الرياضيات" },
          { search: "الإيقاظ العلمي", display: "الايقاظ العلمي" },
          { search: "التربية التكنولوجية", display: "التربية التكنولوجية" },
        ],
      },
      {
        name: "مجال التنشئة",
        subjects: [
          { search: "التربية الإسلامية", display: "تربية اسلامية" },
          { search: "التربية الموسيقية", display: "تربية موسيقية" },
          { search: "التربية التشكيلية", display: "تربية تشكيلية" },
          { search: "التربية البدنية", display: "تربية بدنية" },
        ],
      }
    ]
  },
  2: {
    domains: [
      {
        name: "مجال العربية",
        subjects: [
          { search: "التواصل الشفوي", display: "تواصل شفوي" },
          { search: "الخط", display: "الخط" },
          { search: "القراءة", display: "القراءة" },
          { search: "الإنتاج الكتابي", display: "الانتاج الكتابي" },
        ],
      },
      {
        name: "مجال العلوم",
        subjects: [
          { search: "الرياضيات", display: "الرياضيات" },
          { search: "الإيقاظ العلمي", display: "الايقاظ العلمي" },
          { search: "التربية التكنولوجية", display: "التربية التكنولوجية" },
        ],
      },
      {
        name: "مجال التنشئة",
        subjects: [
          { search: "التربية الإسلامية", display: "تربية اسلامية" },
          { search: "التربية الموسيقية", display: "تربية موسيقية" },
          { search: "التربية التشكيلية", display: "تربية تشكيلية" },
          { search: "التربية البدنية", display: "تربية بدنية" },
        ],
      }
    ]
  },
  3: {
    domains: [
      {
        name: "مجال العربية",
        subjects: [
          { search: "التواصل الشفوي", display: "تواصل شفوي" },
          { search: "قواعد اللغة", display: "قواعد اللغة" },
          { search: "القراءة", display: "القراءة" },
          { search: "الإنتاج الكتابي", display: "الانتاج الكتابي" },
        ],
      },
      {
        name: "مجال العلوم",
        subjects: [
          { search: "الرياضيات", display: "الرياضيات" },
          { search: "الإيقاظ العلمي", display: "الايقاظ العلمي" },
          { search: "التربية التكنولوجية", display: "التربية التكنولوجية" },
        ],
      },
      {
        name: "اللغة الفرنسية",
        subjects: [
          { search: "Exp", display: "Exp. Orale" },
          { search: "Pro", display: "Pro. Ecrite" },
          { search: "Lecture", display: "Lecture" },
        ],
      },
      {
        name: "مجال التنشئة",
        subjects: [
          { search: "التربية الإسلامية", display: "تربية اسلامية" },
          { search: "التربية الموسيقية", display: "تربية موسيقية" },
          { search: "التربية التشكيلية", display: "تربية تشكيلية" },
          { search: "التربية البدنية", display: "تربية بدنية" },
        ],
      }
    ]
  }
};
