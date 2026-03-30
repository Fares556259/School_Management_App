import { getRole } from "@/lib/role";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
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
} from "@/generated/prisma";

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

  const [data, count] = await prisma.$transaction([
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
  ]);

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold">All Results</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            {(role === "admin" || role === "teacher") && (
              <FormModal table="result" type="create" />
            )}
          </div>
        </div>
      </div>
      {/* LIST */}
      <Table columns={columns} renderRow={renderRow} data={data} />
      {/* PAGINATION */}
      <Pagination page={p} count={count} />
    </div>
  );
};

export default ResultListPage;
