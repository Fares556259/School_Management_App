import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { getGradeSubjects } from "@/lib/subject-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticateMobileRequest(req);
  if (auth.error) return auth.error;
  const { userId, userType } = auth.payload;
  if (userType !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const searchParams = req.nextUrl.searchParams;
    const teacherId = searchParams.get("teacherId");
    const classId = searchParams.get("classId");

    if (!teacherId || !classId) {
      return NextResponse.json(
        { error: "teacherId and classId are required" },
        { status: 400 }
      );
    }
    if (teacherId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch subjects directly assigned to the teacher and from lessons for this class
    const [teacher, classData] = await Promise.all([
      prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
          subjects: {
            select: { 
              id: true, 
              name: true, 
              domain: true, 
              parentId: true,
              components: { select: { id: true, name: true, domain: true, parentId: true } }
            }
          },
          lessons: {
            where: { classId: Number(classId) },
            include: {
              subject: { 
                select: { 
                  id: true, 
                  name: true, 
                  domain: true,
                  parentId: true,
                  components: { select: { id: true, name: true, domain: true, parentId: true } }
                } 
              }
            }
          }
        }
      }),
      prisma.class.findUnique({
        where: { id: Number(classId) },
        include: { level: true }
      })
    ]);

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const parseArabicName = (name: string): string => {
      if (!name) return name || "";
      const parts = name.split("|");
      const arabicPart = parts.find(part => /[\u0600-\u06FF]/.test(part));
      return arabicPart ? arabicPart.trim() : parts[0].trim();
    };

    const subjectsMap = new Map();
    teacher.subjects.forEach(s => subjectsMap.set(s.id, s));
    teacher.lessons.forEach(l => {
      if (l.subject) subjectsMap.set(l.subject.id, l.subject);
    });

    const subjectsList = Array.from(subjectsMap.values());
    const gradeableSubjects: any[] = [];
    subjectsList.forEach((s: any) => {
      if (s.components && s.components.length > 0) {
        gradeableSubjects.push(...s.components);
      } else {
        gradeableSubjects.push(s);
      }
    });

    let finalSubjects = gradeableSubjects;
    const levelNum = classData?.level?.level;
    const { LEVEL_CONFIGS } = require("@/lib/report-cards/level-config");
    const levelConfig = levelNum ? LEVEL_CONFIGS[levelNum] : undefined;

    if (levelConfig) {
      finalSubjects = [];
      levelConfig.domains.forEach((domainConfig: any) => {
        domainConfig.subjects.forEach((sub: any) => {
          const searchTerm = sub.search.trim().toLowerCase();
          const dbSubject = gradeableSubjects.find((s: any) => {
            const parts = s.name.split('|').map((p: string) => p.trim().toLowerCase());
            return parts.includes(searchTerm) || s.name.toLowerCase() === searchTerm;
          });
          if (dbSubject) {
            // Keep the original id but update domain/name
            finalSubjects.push({
              ...dbSubject,
              domain: domainConfig.name,
              name: sub.display || parseArabicName(dbSubject.name),
            });
          }
        });
      });
    }

    const subjects = finalSubjects.map((subject: any) => ({
      ...subject,
      name: levelConfig ? subject.name : parseArabicName(subject.name),
      components: []
    }));

    return NextResponse.json(subjects);
  } catch (error) {
    console.error("Failed to get subjects:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
