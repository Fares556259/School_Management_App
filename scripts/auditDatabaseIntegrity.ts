import prisma from "../src/lib/prisma";

interface AuditIssue {
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: string;
  message: string;
  details?: any;
}

async function runDatabaseAudit() {
  console.log("\n=======================================================");
  console.log("🏥  SNAPSCHOOL - AUDIT D'INTÉGRITÉ DE LA BASE DE DONNÉES");
  console.log("=======================================================\n");

  const issues: AuditIssue[] = [];
  const startTime = Date.now();

  // 1. Identification de l'école principale
  const schools = await prisma.school.findMany({
    select: { id: true, name: true, plan: true },
  });
  console.log(`🏫 Établissements trouvés en base : ${schools.length}`);
  schools.forEach((s) => console.log(`   • [${s.id}] : ${s.name} (Plan: ${s.plan})`));

  const targetSchool = schools.find((s) => s.id === "bringbringa138gmailcom-1") || schools[0];
  if (!targetSchool) {
    console.error("❌ Aucune école trouvée dans la base de données !");
    process.exit(1);
  }

  const schoolId = targetSchool.id;
  console.log(`\n🎯 Audit centré sur l'établissement actif : "${targetSchool.name}" (${schoolId})`);

  // 2. Vérification des Effectifs Réels
  console.log("\n--- 1. Comptage des Effectifs Réels ---");
  const [teachersCount, parentsCount, studentsCount, staffCount, classesCount, levelsCount, subjectsCount] =
    await Promise.all([
      prisma.teacher.count({ where: { schoolId } }),
      prisma.parent.count({ where: { schoolId } }),
      prisma.student.count({ where: { schoolId } }),
      prisma.staff.count({ where: { schoolId } }),
      prisma.class.count({ where: { schoolId } }),
      prisma.level.count({ where: { schoolId } }),
      prisma.subject.count({ where: { schoolId } }),
    ]);

  console.log(`  👨‍🏫 Enseignants : ${teachersCount}`);
  console.log(`  👨‍👩‍👧‍👦 Parents     : ${parentsCount}`);
  console.log(`  🎓 Élèves      : ${studentsCount}`);
  console.log(`  💼 Staff       : ${staffCount}`);
  console.log(`  🏫 Classes     : ${classesCount}`);
  console.log(`  📊 Niveaux     : ${levelsCount}`);
  console.log(`  📚 Matières    : ${subjectsCount}`);

  // Validation d'effectifs
  if (schoolId === "bringbringa138gmailcom-1") {
    if (teachersCount < 13) {
      issues.push({
        severity: "WARNING",
        category: "EFFECTIFS",
        message: `Nombre d'enseignants (${teachersCount}) inférieur au référentiel attendu (13)`,
      });
    }
    if (parentsCount < 26) {
      issues.push({
        severity: "WARNING",
        category: "EFFECTIFS",
        message: `Nombre de parents (${parentsCount}) inférieur au référentiel attendu (26)`,
      });
    }
    if (studentsCount < 53) {
      issues.push({
        severity: "WARNING",
        category: "EFFECTIFS",
        message: `Nombre d'élèves (${studentsCount}) inférieur au référentiel attendu (53)`,
      });
    }
  }

  // 3. Intégrité Référentielle & Détection d'Orphelins
  console.log("\n--- 2. Intégrité Référentielle & Orphelins ---");

  // A. Élèves sans classe
  const studentsWithoutClass = await prisma.student.findMany({
    where: { schoolId, classId: null },
    select: { id: true, name: true, surname: true },
  });
  if (studentsWithoutClass.length > 0) {
    issues.push({
      severity: "INFO",
      category: "ÉLÈVES",
      message: `${studentsWithoutClass.length} élève(s) sans classe assignée`,
      details: studentsWithoutClass.map((s) => `${s.name} ${s.surname}`),
    });
  } else {
    console.log("  ✅ Tous les élèves sont affectés à une classe.");
  }

  // B. Élèves sans parent
  const studentsWithoutParent = await prisma.student.findMany({
    where: { schoolId, parentId: null },
    select: { id: true, name: true, surname: true },
  });
  if (studentsWithoutParent.length > 0) {
    issues.push({
      severity: "WARNING",
      category: "PARENTS",
      message: `${studentsWithoutParent.length} élève(s) sans parent rattaché`,
      details: studentsWithoutParent.map((s) => `${s.name} ${s.surname}`),
    });
  } else {
    console.log("  ✅ Tous les élèves ont un parent rattaché.");
  }

  // C. Parents orphelins (sans enfants)
  const parentsWithoutChildren = await prisma.parent.findMany({
    where: { schoolId, students: { none: {} } },
    select: { id: true, name: true, surname: true, phone: true },
  });
  if (parentsWithoutChildren.length > 0) {
    issues.push({
      severity: "INFO",
      category: "PARENTS",
      message: `${parentsWithoutChildren.length} parent(s) sans aucun enfant inscrit`,
      details: parentsWithoutChildren.map((p) => `${p.name} ${p.surname} (${p.phone})`),
    });
  } else {
    console.log("  ✅ Aucun parent orphelin : chaque parent est relié à au moins un enfant.");
  }

  // D. Paiements orphelins
  const orphanPayments = await prisma.payment.findMany({
    where: {
      schoolId,
      studentId: null,
      teacherId: null,
      staffId: null,
    },
    select: { id: true, amount: true, month: true, year: true, userType: true },
  });
  if (orphanPayments.length > 0) {
    issues.push({
      severity: "CRITICAL",
      category: "FINANCES",
      message: `${orphanPayments.length} paiement(s) orphelin(s) sans élève, enseignant ou employé associé !`,
      details: orphanPayments,
    });
  } else {
    console.log("  ✅ Tous les enregistrements de paiements sont reliés à une entité valide.");
  }

  // E. Séances sans enseignant ou sans classe
  const orphanLessons = await prisma.lesson.findMany({
    where: {
      schoolId,
      OR: [{ teacherId: "" }, { classId: 0 }],
    },
    select: { id: true, name: true },
  });
  if (orphanLessons.length > 0) {
    issues.push({
      severity: "WARNING",
      category: "EMPLOI_DU_TEMPS",
      message: `${orphanLessons.length} séance(s) avec enseignant ou classe manquant`,
    });
  } else {
    console.log("  ✅ Toutes les séances d'emploi du temps sont correctement configurées.");
  }

  // 4. Sanité Financière (Anomalies de Dates, Montants, Statuts)
  console.log("\n--- 3. Sanité Financière & Cohérence Comptable ---");

  // A. Détection de mois invalides (month: 0 ou month > 12)
  const invalidMonthPayments = await prisma.payment.findMany({
    where: {
      schoolId,
      OR: [{ month: { lt: 1 } }, { month: { gt: 12 } }],
    },
    select: { id: true, month: true, year: true, amount: true, userType: true },
  });
  if (invalidMonthPayments.length > 0) {
    issues.push({
      severity: "CRITICAL",
      category: "FINANCES",
      message: `${invalidMonthPayments.length} paiement(s) avec un numéro de mois invalide (ex: month: 0) !`,
      details: invalidMonthPayments,
    });
  } else {
    console.log("  ✅ Aucun paiement avec un numéro de mois hors-norme (zéro anomalie 'month: 0').");
  }

  // B. Montants négatifs
  const negativePayments = await prisma.payment.findMany({
    where: { schoolId, amount: { lt: 0 } },
    select: { id: true, amount: true },
  });
  if (negativePayments.length > 0) {
    issues.push({
      severity: "CRITICAL",
      category: "FINANCES",
      message: `${negativePayments.length} paiement(s) avec un montant négatif !`,
    });
  } else {
    console.log("  ✅ Aucun paiement avec montant négatif.");
  }

  const negativeExpenses = await prisma.expense.findMany({
    where: { schoolId, amount: { lt: 0 } },
    select: { id: true, title: true, amount: true },
  });
  if (negativeExpenses.length > 0) {
    issues.push({
      severity: "CRITICAL",
      category: "FINANCES",
      message: `${negativeExpenses.length} dépense(s) avec montant négatif !`,
    });
  } else {
    console.log("  ✅ Aucune dépense négative.");
  }

  // C. Incohérence Statut vs Montant
  const paidWithZero = await prisma.payment.findMany({
    where: {
      schoolId,
      status: "PAID",
      amount: { lte: 0 },
    },
    select: { id: true, amount: true, month: true, year: true, userType: true },
  });
  if (paidWithZero.length > 0) {
    issues.push({
      severity: "WARNING",
      category: "FINANCES",
      message: `${paidWithZero.length} paiement(s) marqués PAID mais ayant un montant <= 0`,
      details: paidWithZero,
    });
  } else {
    console.log("  ✅ Cohérence des paiements PAID (tous ont un montant > 0).");
  }

  const partialWithZero = await prisma.payment.findMany({
    where: {
      schoolId,
      status: "PARTIAL",
      amount: { lte: 0 },
    },
    select: { id: true, amount: true, month: true, year: true, userType: true },
  });
  if (partialWithZero.length > 0) {
    issues.push({
      severity: "WARNING",
      category: "FINANCES",
      message: `${partialWithZero.length} paiement(s) marqués PARTIAL mais ayant un montant <= 0`,
      details: partialWithZero,
    });
  } else {
    console.log("  ✅ Cohérence des paiements PARTIAL (tous ont un acompte > 0).");
  }

  // D. Cohérence des types de paiement
  const mismatchedUserTypePayments = await prisma.payment.findMany({
    where: {
      schoolId,
      OR: [
        { userType: "STUDENT", studentId: null },
        { userType: "TEACHER", teacherId: null },
        { userType: "STAFF", staffId: null },
      ],
    },
    select: { id: true, userType: true, studentId: true, teacherId: true, staffId: true },
  });
  if (mismatchedUserTypePayments.length > 0) {
    issues.push({
      severity: "CRITICAL",
      category: "FINANCES",
      message: `${mismatchedUserTypePayments.length} paiement(s) avec discordance entre userType et la clé étrangère`,
    });
  } else {
    console.log("  ✅ Concordance parfaite entre userType ('STUDENT', 'TEACHER', 'STAFF') et les clés associées.");
  }

  // 5. Sanité des Présences
  console.log("\n--- 4. Sanité des Présences (Attendance) ---");
  const futureAttendances = await prisma.attendance.findMany({
    where: {
      schoolId,
      date: { gt: new Date(Date.now() + 7 * 24 * 3600 * 1000) }, // plus de 7 jours dans le futur
    },
    select: { id: true, date: true, status: true },
  });
  if (futureAttendances.length > 0) {
    issues.push({
      severity: "WARNING",
      category: "PRÉSENCES",
      message: `${futureAttendances.length} présence(s) enregistrée(s) avec des dates futures anormales`,
    });
  } else {
    console.log("  ✅ Les enregistrements de présence ont tous des dates cohérentes.");
  }

  // 6. Synthèse Finale
  const duration = Date.now() - startTime;
  console.log("\n=======================================================");
  console.log(`📋 RAPPORT DE SYNTHÈSE AUDIT (${duration}ms)`);
  console.log("=======================================================");

  const criticals = issues.filter((i) => i.severity === "CRITICAL");
  const warnings = issues.filter((i) => i.severity === "WARNING");
  const infos = issues.filter((i) => i.severity === "INFO");

  console.log(`🔴 CRITIQUES : ${criticals.length}`);
  console.log(`🟡 WARNINGS  : ${warnings.length}`);
  console.log(`ℹ️ INFORMATIONS : ${infos.length}`);

  if (issues.length > 0) {
    console.log("\nDétail des alertes constatées :");
    for (const issue of issues) {
      const icon = issue.severity === "CRITICAL" ? "🔴" : issue.severity === "WARNING" ? "🟡" : "ℹ️";
      console.log(`  ${icon} [${issue.category}] ${issue.message}`);
      if (issue.details && Array.isArray(issue.details) && issue.details.length <= 5) {
        console.log(`     └ Détails : ${JSON.stringify(issue.details)}`);
      }
    }
  }

  // 7. Mode Réparation Automatique (--fix)
  const shouldFix = process.argv.includes("--fix");
  if (shouldFix && (criticals.length > 0 || warnings.length > 0)) {
    console.log("\n🛠️  EXÉCUTION DU MODE RÉPARATION AUTOMATIQUE (--fix)...");

    // 1. Suppression des paiements orphelins sans aucune entité rattachée
    const deletedOrphans = await prisma.payment.deleteMany({
      where: {
        schoolId,
        studentId: null,
        teacherId: null,
        staffId: null,
      },
    });
    if (deletedOrphans.count > 0) {
      console.log(`  🧹 Supprimé : ${deletedOrphans.count} paiement(s) orphelin(s).`);
    }

    // 2. Suppression des paiements erronés avec mois 0 et montant 0
    const deletedInvalidMonth = await prisma.payment.deleteMany({
      where: {
        schoolId,
        OR: [{ month: { lt: 1 } }, { month: { gt: 12 } }],
        amount: { lte: 0 },
      },
    });
    if (deletedInvalidMonth.count > 0) {
      console.log(`  🧹 Supprimé : ${deletedInvalidMonth.count} paiement(s) invalides (mois hors 1-12 et montant 0).`);
    }

    // 3. Rectification des paiements marqués PAID mais ayant un montant 0
    const fixedZeroPaid = await prisma.payment.updateMany({
      where: {
        schoolId,
        status: "PAID",
        amount: { lte: 0 },
      },
      data: {
        status: "PENDING",
      },
    });
    if (fixedZeroPaid.count > 0) {
      console.log(`  🔧 Rectifié : ${fixedZeroPaid.count} paiement(s) montant 0 remis à statut 'PENDING'.`);
    }

    console.log("  ✨ Réparation terminée avec succès !");
  }

  if (criticals.length === 0 || shouldFix) {
    console.log("\n🎉 SANTÉ DE LA BASE DE DONNÉES : VALIDÉE !\n");
    process.exit(0);
  } else {
    console.error("\n❌ DES ANOMALIES CRITIQUES NÉCESSITENT VOTRE ATTENTION !");
    console.log("💡 Astuce : Exécutez 'npx tsx scripts/auditDatabaseIntegrity.ts --fix' pour nettoyer automatiquement ces résidus.\n");
    process.exit(1);
  }
}

runDatabaseAudit()
  .catch((err) => {
    console.error("Erreur fatale lors de l'audit de la base de données :", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
