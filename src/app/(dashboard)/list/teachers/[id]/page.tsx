import { getRole } from "@/lib/role";
import FormModal from "@/components/FormModal";
import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { Teacher, Subject, Class } from "@prisma/client";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import TeacherFinanceHub from "./TeacherFinanceHub";
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
  ArrowLeft,
} from "lucide-react";

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
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

      {/* 2. TOP BANNER: HERO IDENTITY CARD (8 cols) + 4 KPI METRICS (4 cols in 2x2 grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* HERO CARD */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
          {/* Subtle top banner accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="flex flex-col md:flex-row gap-6 pt-1">
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
            <div className="flex-1 flex flex-col justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 mb-0.5">
                  {teacherFullName}
                </h1>

                <p className="text-xs text-slate-400 font-medium mb-3">
                  Enseignant / Corps professoral · ID: <span className="font-mono text-slate-500">{teacher.id.substring(0, 8)}...</span>
                </p>

                {/* SUBJECTS & CLASSES PILLS */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
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

        {/* 4 KPI METRICS (2x2 GRID MATCHING HERO HEIGHT) */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-3.5">
          {/* KPI 1: Classes */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Users size={20} />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-800 block leading-tight">
                {teacher._count.classes}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                Classes
              </span>
            </div>
          </div>

          {/* KPI 2: Subjects */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-800 block leading-tight">
                {cleanSubjects.length}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                Matières
              </span>
            </div>
          </div>

          {/* KPI 3: Weekly Sessions */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-800 block leading-tight">
                {scheduleItems.length}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                Séances / sem.
              </span>
            </div>
          </div>

          {/* KPI 4: Payments Made */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CreditCard size={20} />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-800 block leading-tight">
                {teacher.payments.length}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                Paiements
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CORE WORKSTATIONS SIDE-BY-SIDE: EMPLOI DU TEMPS (7 cols) & FINANCE HUB (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* EMPLOI DU TEMPS (7 OF 12 COLS = 58.3%) */}
        <div className="xl:col-span-7">
          <TeacherSchedule 
            items={scheduleItems}
            teacherName={teacherFullName}
          />
        </div>

        {/* FINANCIAL HUB (5 OF 12 COLS = 41.7%) */}
        <div className="xl:col-span-5">
          <TeacherFinanceHub
            teacherId={teacher.id}
            teacherName={teacherFullName}
            salary={teacher.salary}
            hourlyRate={teacher.hourlyRate}
            hoursPerMonth={teacher.hoursPerMonth}
            payments={teacher.payments}
            isAdmin={role === "admin"}
          />
        </div>
      </div>
    </div>
  );
};

export default SingleTeacherPage;
