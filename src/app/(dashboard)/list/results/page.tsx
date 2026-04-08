import { getRole } from "@/lib/role";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import prisma from "../../../../lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import Link from "next/link";

import {
  Prisma,
  Result,
  Student,
  Exam,
  Assignment,
  Lesson,
  Subject,
  Class,
  Teacher,
} from "@prisma/client";

type ResultList = Result & {
  student: Student;
  exam?:
    | (Exam & {
        lesson: Lesson & {
          subject: Subject;
          class: Class;
          teacher: Teacher;
        };
      })
    | null;
  assignment?:
    | (Assignment & {
        lesson: Lesson & {
          subject: Subject;
          class: Class;
          teacher: Teacher;
        };
      })
    | null;
};

const columns = [
  {
    header: "Subject Name",
    accessor: "name",
  },
  {
    header: "Student",
    accessor: "student",
  },
  {
    header: "Score",
    accessor: "score",
    className: "hidden md:table-cell",
  },
  {
    header: "Teacher",
    accessor: "teacher",
    className: "hidden md:table-cell",
  },
  {
    header: "Class",
    accessor: "class",
    className: "hidden md:table-cell",
  },
  {
    header: "Date",
    accessor: "date",
    className: "hidden md:table-cell",
  },
  {
    header: "Actions",
    accessor: "action",
  },
];

const ResultListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId } = auth();
  const role = await getRole();
  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ResultWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "studentId":
            query.studentId = value;
            break;
          case "classId":
            query.OR = [
              { exam: { lesson: { classId: parseInt(value) } } },
              { assignment: { lesson: { classId: parseInt(value) } } },
            ];
            break;
          case "teacherId":
            query.OR = [
              { exam: { lesson: { teacherId: value } } },
              { assignment: { lesson: { teacherId: value } } },
            ];
            break;
          case "search":
            query.OR = [
              { exam: { title: { contains: value, mode: "insensitive" } } },
              { student: { name: { contains: value, mode: "insensitive" } } },
              { student: { surname: { contains: value, mode: "insensitive" } } },
              {
                exam: {
                  lesson: {
                    subject: { name: { contains: value, mode: "insensitive" } },
                  },
                },
              },
              {
                assignment: {
                  lesson: {
                    subject: { name: { contains: value, mode: "insensitive" } },
                  },
                },
              },
            ];
            break;
          default:
            break;
        }
      }
    }
  }

  const renderRow = (item: ResultList) => {
    const label = item.exam ? item.exam.lesson.subject.name : item.assignment?.lesson.subject.name;
    const teacherName = item.exam
      ? item.exam.lesson.teacher.name + " " + item.exam.lesson.teacher.surname
      : item.assignment?.lesson.teacher.name + " " + item.assignment?.lesson.teacher.surname;
    const className = item.exam
      ? item.exam.lesson.class.name
      : item.assignment?.lesson.class.name;
    const date = item.exam ? item.exam.startTime : item.assignment?.dueDate;

    return (
      <tr
        key={item.id}
        className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
      >
        <td className="flex items-center gap-4 p-4">{label}</td>
        <td>{item.student.name}</td>
        <td className="hidden md:table-cell">{item.score}</td>
        <td className="hidden md:table-cell">{teacherName}</td>
        <td className="hidden md:table-cell">{className}</td>
        <td className="hidden md:table-cell">
          {date ? new Intl.DateTimeFormat("en-GB").format(date) : "-"}
        </td>
        <td>
          <div className="flex items-center gap-2">
            {(role === "admin" || role === "teacher") && (
              <>
                <FormModal table="result" type="update" data={item} />
                <FormModal table="result" type="delete" id={item.id} />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const [data, count, sheets] = await prisma.$transaction([
    prisma.result.findMany({
      where: query,
      include: {
        student: true,
        exam: {
          include: {
            lesson: {
              include: {
                subject: true,
                class: true,
                teacher: true,
              },
            },
          },
        },
        assignment: {
          include: {
            lesson: {
              include: {
                subject: true,
                class: true,
                teacher: true,
              },
            },
          },
        },
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.result.count({ where: query }),
    prisma.gradeSheet.findMany({
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
        grades: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    })
  ]);

  return (
    <div className="p-6 flex flex-col gap-6 bg-slate-50 min-h-screen">
      {/* ─── CTA SECTION: PROOF-LINKED RESULTS ─── */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-20 -mt-20 opacity-50 group-hover:scale-110 transition-transform duration-700" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1 bg-indigo-600 rounded-full">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">New Workflow</span>
              </div>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Administrative Verification</h2>
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2 uppercase">Record Paper Results</h1>
            <p className="text-slate-500 font-medium leading-relaxed">
              Upload physical grade sheets from teachers, verify student marks in a split-screen interface, and maintain a permanent visual audit trail for all academic results.
            </p>
          </div>
          
          <Link 
            href="/list/results/record"
            className="flex-shrink-0 px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            Start Digital Recording ↗
          </Link>
        </div>
      </div>

      {/* ─── RECENT SHEETS CAROUSEL ─── */}
      {sheets.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recently Verified Proofs</h2>
            <Link href="/admin/grades" className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest">View All Sheets →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {sheets.map((sheet: any) => (
              <div key={sheet.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3 hover:border-indigo-100 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between gap-2">
                   <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm">📄</div>
                   <a href={sheet.proofUrl} target="_blank" className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">VIEW PROOF</a>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 truncate">{sheet.subject.name}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{sheet.class.name} · Term {sheet.term}</p>
                </div>
                <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400">{sheet.grades.length} MARKS</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase">{new Intl.DateTimeFormat("en-GB").format(sheet.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── LEGACY RESULTS LIST ─── */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">ALL DIGITAL RECORDS</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Search and manage individual student results</p>
          </div>
          <div className="flex items-center gap-3">
            <TableSearch />
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
                <Image src="/filter.png" alt="" width={14} height={14} />
              </button>
              <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
                <Image src="/sort.png" alt="" width={14} height={14} />
              </button>
            </div>
          </div>
        </div>

        <Table columns={columns} renderRow={renderRow} data={data} />
        <Pagination page={p} count={count} />
      </div>
    </div>
  );
};


export default ResultListPage;
