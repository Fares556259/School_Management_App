import { getRole } from "@/lib/role";
import FormModal from "@/components/FormModal";
import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { Teacher, Subject, Class } from "@prisma/client";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import TeacherSalaryTracker from "./TeacherSalaryTracker";
import SalarySummaryCard from "./SalarySummaryCard";
import TeacherSchedule, { ScheduleItem } from "./TeacherSchedule";
import { getCachedTenantData } from "@/lib/cache";
import { getSchoolId } from "@/lib/school";
import { 
  Phone, 
  MapPin, 
  Calendar as CalendarIcon, 
  Droplet, 
  Banknote, 
  Users, 
  BookOpen, 
  Clock, 
  CreditCard, 
  GraduationCap, 
  FileText, 
  FileCheck, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import dynamic from "next/dynamic";

const Performance = dynamic(() => import("@/components/Performance"), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-50 animate-pulse rounded-2xl border border-slate-100"></div>
});

const SingleTeacherPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const role = await getRole();
  const schoolId = await getSchoolId();

  const teacher = await getCachedTenantData(
    schoolId,
    "teachers",
    [id, schoolId],
    () =>
      prisma.teacher.findUnique({
        where: { id },
        include: {
          subjects: true,
          classes: true,
          payments: true,
          timetable: {
            where: { isDraft: false },
            include: {
              subject: true,
              class: true,
              room: true,
            },
            orderBy: [{ day: "asc" }, { slotNumber: "asc" }],
          },
          lessons: {
            include: {
              subject: true,
              class: true,
            },
          },
          _count: {
            select: {
              lessons: true,
              classes: true,
              subjects: true,
            },
          },
        },
      }),
    600
  );

  if (!teacher) {
    return notFound();
  }

  // Deduplicate and clean subjects (extract primary name before pipe)
  const uniqueSubjectsMap = new Map<number, string>();
  teacher.subjects.forEach((s) => {
    const cleanName = s.name.split("|")[0].trim();
    uniqueSubjectsMap.set(s.id, cleanName);
  });
  const cleanSubjects = Array.from(uniqueSubjectsMap.values());

  // Map timetable slots or fallback to lessons
  const scheduleItems: ScheduleItem[] = (teacher.timetable && teacher.timetable.length > 0)
    ? teacher.timetable.map((slot: any) => ({
        id: slot.id,
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: slot.duration || 120,
        subjectName: slot.subject?.name ? slot.subject.name.split("|")[0].trim() : "Matière",
        subjectId: slot.subjectId || 0,
        className: slot.class?.name || "Classe",
        classId: slot.classId,
        roomName: slot.room?.name || undefined,
      }))
    : (teacher.lessons || []).map((l: any) => {
        const start = new Date(l.startTime);
        const end = new Date(l.endTime);
        const sh = String(start.getHours()).padStart(2, "0");
        const sm = String(start.getMinutes()).padStart(2, "0");
        const eh = String(end.getHours()).padStart(2, "0");
        const em = String(end.getMinutes()).padStart(2, "0");
        return {
          id: l.id,
          day: l.day,
          startTime: `${sh}:${sm}`,
          endTime: `${eh}:${em}`,
          duration: Math.round((end.getTime() - start.getTime()) / (1000 * 60)) || 60,
          subjectName: l.subject?.name ? l.subject.name.split("|")[0].trim() : (l.name || "Matière"),
          subjectId: l.subjectId || 0,
          className: l.class?.name || "Classe",
          classId: l.classId,
          roomName: undefined,
        };
      });

  const teacherFullName = `${teacher.name} ${teacher.surname}`;

  return (
    <div className="flex-1 p-4 lg:p-6 flex flex-col gap-6 max-w-[1600px] mx-auto w-full">
      {/* 1. TOP BREADCRUMB & PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link 
            href="/list/teachers" 
            className="flex items-center gap-1.5 hover:text-blue-600 transition-colors font-medium text-slate-600"
          >
            <ArrowLeft size={16} />
            <span>Enseignants</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-none">
            {teacherFullName}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
            teacher.activated 
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${teacher.activated ? "bg-emerald-500" : "bg-amber-500"}`} />
            {teacher.activated ? "Actif" : "En attente"}
          </span>
        </div>

        {role === "admin" && (
          <div className="flex items-center gap-2">
            <FormModal table="teacher" type="update" data={teacher} />
          </div>
        )}
      </div>

      {/* 2. MAIN TWO-COLUMN LAYOUT */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* LEFT COLUMN: HERO CARD, METRICS, TIMETABLE */}
        <div className="w-full xl:w-2/3 flex flex-col gap-6">
          {/* PROFILE HERO CARD */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
            {/* Subtle top banner accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

            <div className="flex flex-col md:flex-row gap-6 pt-2">
              {/* AVATAR */}
              <div className="flex flex-col items-center sm:items-start shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden relative border-2 border-slate-100 shadow-sm bg-slate-50">
                  <Image
                    src={teacher.img && teacher.img !== "null" && teacher.img !== "undefined" ? teacher.img : "/noAvatar.png"}
                    alt={teacherFullName}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>

              {/* DETAILS */}
              <div className="flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-slate-800">
                      {teacherFullName}
                    </h1>
                  </div>

                  <p className="text-xs text-slate-400 font-medium mb-3">
                    Enseignant / Corps professoral · ID: <span className="font-mono text-slate-500">{teacher.id.substring(0, 8)}...</span>
                  </p>

                  {/* SUBJECTS & CLASSES PILLS */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {cleanSubjects.length > 0 ? (
                      cleanSubjects.map((subj, idx) => (
                        <span 
                          key={idx}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1"
                        >
                          <BookOpen size={12} className="text-blue-500" />
                          {subj}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">Aucune matière assignée</span>
                    )}

                    {teacher.classes.length > 0 && teacher.classes.map((cls) => (
                      <span 
                        key={cls.id}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1"
                      >
                        <Users size={12} className="text-purple-500" />
                        {cls.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* METADATA STRIP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
                  {/* Phone */}
                  <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                      <Phone size={13} />
                    </div>
                    <div className="truncate">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Téléphone</span>
                      {teacher.phone ? (
                        <a href={`tel:${teacher.phone}`} className="font-semibold text-slate-700 hover:text-blue-600 truncate block">
                          {teacher.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Non renseigné</span>
                      )}
                    </div>
                  </div>

                  {/* Birthday */}
                  <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                      <CalendarIcon size={13} />
                    </div>
                    <div className="truncate">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Naissance</span>
                      <span className="font-semibold text-slate-700 truncate block">
                        {new Intl.DateTimeFormat("fr-FR").format(new Date(teacher.birthday))}
                      </span>
                    </div>
                  </div>

                  {/* Blood Type */}
                  <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-rose-500 border border-slate-100 shrink-0">
                      <Droplet size={13} />
                    </div>
                    <div className="truncate">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Groupe sanguin</span>
                      <span className="font-semibold text-slate-700 block">
                        {teacher.bloodType || "Inconnu"}
                      </span>
                    </div>
                  </div>

                  {/* Salary */}
                  <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
                      <Banknote size={13} />
                    </div>
                    <div className="truncate">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Salaire</span>
                      <span className="font-bold text-emerald-700 block">
                        {teacher.salary.toLocaleString("en-US").replace(/,/g, " ")} DT
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 MODERN KPI STAT CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* KPI 1: Classes */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <Users size={20} />
              </div>
              <div>
                <span className="text-xl font-black text-slate-800 block leading-tight">
                  {teacher._count.classes}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                  Classes
                </span>
              </div>
            </div>

            {/* KPI 2: Subjects */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <span className="text-xl font-black text-slate-800 block leading-tight">
                  {cleanSubjects.length}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                  Matières
                </span>
              </div>
            </div>

            {/* KPI 3: Weekly Sessions */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <span className="text-xl font-black text-slate-800 block leading-tight">
                  {scheduleItems.length}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                  Séances / sem.
                </span>
              </div>
            </div>

            {/* KPI 4: Payments Made */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CreditCard size={20} />
              </div>
              <div>
                <span className="text-xl font-black text-slate-800 block leading-tight">
                  {teacher.payments.length}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                  Paiements
                </span>
              </div>
            </div>
          </div>

          {/* DEDICATED MODERN TIMETABLE */}
          <TeacherSchedule 
            items={scheduleItems}
            teacherName={teacherFullName}
          />
        </div>

        {/* RIGHT COLUMN: SHORTCUTS, FINANCE & SALARY SUMMARY */}
        <div className="w-full xl:w-1/3 flex flex-col gap-6">
          {/* QUICK SHORTCUTS CARD */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <GraduationCap size={16} className="text-indigo-600" />
              <span>Accès rapides</span>
            </h2>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                href={`/list/classes?teacherId=${teacher.id}`}
                className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-100 hover:border-indigo-100 transition-all flex flex-col justify-between gap-2 group"
              >
                <div className="flex items-center justify-between text-slate-500 group-hover:text-indigo-600">
                  <Users size={16} />
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-indigo-900">
                  Classes ({teacher._count.classes})
                </span>
              </Link>

              <Link
                href={`/list/students?teacherId=${teacher.id}`}
                className="p-3 rounded-xl bg-slate-50 hover:bg-purple-50/70 border border-slate-100 hover:border-purple-100 transition-all flex flex-col justify-between gap-2 group"
              >
                <div className="flex items-center justify-between text-slate-500 group-hover:text-purple-600">
                  <GraduationCap size={16} />
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-purple-900">
                  Élèves
                </span>
              </Link>

              <Link
                href={`/list/exams?teacherId=${teacher.id}`}
                className="p-3 rounded-xl bg-slate-50 hover:bg-rose-50/70 border border-slate-100 hover:border-rose-100 transition-all flex flex-col justify-between gap-2 group"
              >
                <div className="flex items-center justify-between text-slate-500 group-hover:text-rose-600">
                  <FileCheck size={16} />
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-rose-900">
                  Examens
                </span>
              </Link>

              <Link
                href={`/list/assignments?teacherId=${teacher.id}`}
                className="p-3 rounded-xl bg-slate-50 hover:bg-amber-50/70 border border-slate-100 hover:border-amber-100 transition-all flex flex-col justify-between gap-2 group"
              >
                <div className="flex items-center justify-between text-slate-500 group-hover:text-amber-600">
                  <FileText size={16} />
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-amber-900">
                  Devoirs
                </span>
              </Link>
            </div>
          </div>

          {/* SALARY SUMMARY CARD */}
          <SalarySummaryCard
            salary={teacher.salary}
            payments={teacher.payments}
          />

          {/* TEACHER SALARY TRACKER */}
          <TeacherSalaryTracker 
            teacherId={teacher.id}
            teacherName={teacherFullName}
            salary={teacher.salary}
            payments={teacher.payments}
            isAdmin={role === "admin"}
          />

          {/* PERFORMANCE CARD */}
          <Performance />
        </div>
      </div>
    </div>
  );
};

export default SingleTeacherPage;
