import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import StaffSalaryTracker from "./StaffSalaryTracker";

const SingleStaffPage = async ({
  params,
}: {
  params: { id: string };
}) => {
  const role = await getRole();
  if (role !== "admin") redirect(`/${role || "sign-in"}`);

  const staff = await prisma.staff.findUnique({
    where: { id: params.id },
    include: {
      expenses: {
        orderBy: { date: "desc" },
      },
    },
  });

  if (!staff) return notFound();

  const isAdmin = role === "admin";

  return (
    <div className="flex-1 p-4 flex flex-col gap-4 xl:flex-row">
      {/* LEFT */}
      <div className="w-full xl:w-2/3">
        {/* TOP */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* USER INFO CARD */}
          <div className="bg-lamaSky py-6 px-4 rounded-md flex-1 flex gap-4">
            <div className="w-1/3">
              <Image
                src={staff.img || "/noAvatar.png"}
                alt=""
                width={144}
                height={144}
                className="w-36 h-36 rounded-full object-cover"
              />
            </div>
            <div className="w-2/3 flex flex-col justify-between gap-4">
              <h1 className="text-xl font-semibold">{staff.name} {staff.surname}</h1>
              <p className="text-sm text-gray-500">{staff.role}</p>
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-medium">
                <div className="w-full md:w-1/3 lg:w-full 2xl:w-1/3 flex items-center gap-2">
                  <Image src="/blood.png" alt="" width={14} height={14} />
                  <span>{staff.bloodType}</span>
                </div>
                <div className="w-full md:w-1/3 lg:w-full 2xl:w-1/3 flex items-center gap-2">
                  <Image src="/date.png" alt="" width={14} height={14} />
                  <span>{new Intl.DateTimeFormat("en-GB").format(staff.birthday)}</span>
                </div>
                {staff.email && (
                  <div className="w-full md:w-1/3 lg:w-full 2xl:w-1/3 flex items-center gap-2">
                    <Image src="/mail.png" alt="" width={14} height={14} />
                    <span>{staff.email}</span>
                  </div>
                )}
                {staff.phone && (
                  <div className="w-full md:w-1/3 lg:w-full 2xl:w-1/3 flex items-center gap-2">
                    <Image src="/phone.png" alt="" width={14} height={14} />
                    <span>{staff.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* SMALL CARDS */}
          <div className="flex-1 flex gap-4 justify-between flex-wrap">
            <div className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]">
              <Image src="/singleBranch.png" alt="" width={24} height={24} className="w-6 h-6" />
              <div>
                <h1 className="text-xl font-semibold">{staff.role}</h1>
                <span className="text-sm text-gray-400">Role</span>
              </div>
            </div>
            <div className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]">
              <Image src="/singleBranch.png" alt="" width={24} height={24} className="w-6 h-6" />
              <div>
                <h1 className="text-xl font-semibold">${staff.salary.toLocaleString()}</h1>
                <span className="text-sm text-gray-400">Monthly Salary</span>
              </div>
            </div>
            <div className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]">
              <Image src="/singleBranch.png" alt="" width={24} height={24} className="w-6 h-6" />
              <div>
                <h1 className="text-xl font-semibold">{staff.expenses.length}</h1>
                <span className="text-sm text-gray-400">Payments Made</span>
              </div>
            </div>
            <div className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]">
              <Image src="/singleBranch.png" alt="" width={24} height={24} className="w-6 h-6" />
              <div>
                <h1 className="text-xl font-semibold">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${staff.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {staff.isPaid ? "Paid" : "Unpaid"}
                  </span>
                </h1>
                <span className="text-sm text-gray-400">Current Status</span>
              </div>
            </div>
          </div>
        </div>

        {/* SALARY TRACKER */}
        <StaffSalaryTracker
          staffId={staff.id}
          staffName={`${staff.name} ${staff.surname}`}
          salary={staff.salary}
          expenses={staff.expenses.map((e) => ({
            title: e.title,
            amount: e.amount,
            date: e.date,
          }))}
          isAdmin={isAdmin}
        />
      </div>

      {/* RIGHT */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-md">
          <h1 className="text-xl font-semibold mb-4">Payment History</h1>
          <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
            {staff.expenses.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No payments yet.</p>
            ) : (
              staff.expenses.map((exp) => (
                <div key={exp.id} className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{exp.title}</p>
                    <p className="text-xs text-slate-400">{exp.date.toLocaleDateString("en-GB")}</p>
                  </div>
                  <span className="text-rose-500 font-bold text-sm bg-rose-50 px-2 py-1 rounded-full">
                    -${exp.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-md">
          <h1 className="text-xl font-semibold mb-4">Details</h1>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Address:</span>
              <span className="font-medium">{staff.address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sex:</span>
              <span className="font-medium">{staff.sex}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Blood Type:</span>
              <span className="font-medium">{staff.bloodType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Joined:</span>
              <span className="font-medium">{staff.createdAt.toLocaleDateString("en-GB")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleStaffPage;
