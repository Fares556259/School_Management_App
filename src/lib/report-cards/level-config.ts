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
  // ── Level 1: 1ère année (No French, No English) ──
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
  // ── Level 2: 2ème année (No French, No English) ──
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
  // ── Level 3: 3ème année (French starts, Grammar replaces Handwriting) ──
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
          { search: "التعبير الشفوي", display: "Exp. Orale" },
          { search: "الإنتاج الكتابي (فرنسية)", display: "Pro. Ecrite" },
          { search: "القراءة (فرنسية)", display: "Lecture" },
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
  // ── Level 4: 4ème année (French continues) ──
  4: {
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
          { search: "التعبير الشفوي", display: "Exp. Orale" },
          { search: "الإنتاج الكتابي (فرنسية)", display: "Pro. Ecrite" },
          { search: "القراءة (فرنسية)", display: "Lecture" },
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
  // ── Level 5: 5ème année (French + History/Geography/Civics added) ──
  5: {
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
          { search: "التعبير الشفوي", display: "Exp. Orale" },
          { search: "الإنتاج الكتابي (فرنسية)", display: "Pro. Ecrite" },
          { search: "القراءة (فرنسية)", display: "Lecture" },
        ],
      },
      {
        name: "مجال التنشئة",
        subjects: [
          { search: "التربية الإسلامية", display: "تربية اسلامية" },
          { search: "التربية الموسيقية", display: "تربية موسيقية" },
          { search: "التربية التشكيلية", display: "تربية تشكيلية" },
          { search: "التاريخ", display: "التاريخ" },
          { search: "الجغرافيا", display: "الجغرافيا" },
          { search: "التربية المدنية", display: "المدنية" },
          { search: "التربية البدنية", display: "تربية بدنية" },
        ],
      }
    ]
  },
  // ── Level 6: 6ème année (French + English + History/Geography/Civics) ──
  6: {
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
        name: "اللغات الاجنبية",
        subjects: [
          { search: "التعبير الشفوي", display: "Exp. Orale" },
          { search: "الإنتاج الكتابي (فرنسية)", display: "Pro. Ecrite" },
          { search: "القراءة (فرنسية)", display: "Lecture" },
          { search: "Anglais", display: "Anglais" },
        ],
      },
      {
        name: "مجال التنشئة",
        subjects: [
          { search: "التربية الإسلامية", display: "تربية اسلامية" },
          { search: "التربية الموسيقية", display: "تربية موسيقية" },
          { search: "التربية التشكيلية", display: "تربية تشكيلية" },
          { search: "التاريخ", display: "التاريخ" },
          { search: "الجغرافيا", display: "الجغرافيا" },
          { search: "التربية المدنية", display: "المدنية" },
          { search: "التربية البدنية", display: "تربية بدنية" },
        ],
      }
    ]
  }
};
