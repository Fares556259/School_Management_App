"use client";

import { useLanguage } from "@/lib/translations/LanguageContext";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import CrudFormModal from "@/components/CrudFormModal";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import Image from "next/image";
import { Parent, Student } from "@prisma/client";

import { useState } from "react";
import ShareParentLinkModal from "@/components/ShareParentLinkModal";
import { Share2 } from "lucide-react";

type ParentList = Parent & { students: Student[] };

export default function ParentListClient({ data, columns, role, count, page, relatedData }: any) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { t } = useLanguage();

  const classList = (relatedData?.classId || []).map((c: any) => ({
    id: parseInt(c.value, 10),
    name: c.label,
  }));

  const translatedColumns = columns.map((c: any) => ({
    ...c,
    header: c.accessor === "info" ? t.parents.info
          : c.accessor === "students" ? t.parents.studentNames
          : c.accessor === "phone" ? t.parents.phone
          : c.accessor === "address" ? t.parents.address
          : c.accessor === "status" ? t.parents.mobileStatus
          : c.accessor === "action" ? t.parents.actions
          : c.header
  }));

  const renderRow = (item: ParentList) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
    >
      <td className="flex items-center gap-4 p-4">
        <Image
          src={item.img || "/noAvatar.png"}
          alt=""
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <h3 className="font-semibold">{item.name}</h3>
        </div>
      </td>
      <td className="hidden md:table-cell">
        {item.students.map((s) => s.name).join(", ")}
      </td>
      <td className="hidden md:table-cell">{item.phone || <span className="text-[#a1a1aa] italic text-[13px]">{t.parents.notProvided}</span>}</td>
      <td className="hidden lg:table-cell">{item.address || <span className="text-[#a1a1aa] italic text-[13px]">{t.parents.notProvided}</span>}</td>
      <td className="hidden xl:table-cell text-center">
        {item.password && item.password.length > 10 ? (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 border border-green-200 shadow-sm">
            {t.crud.activated || "Activated"}
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200">
            {t.crud.pending || "Pending"}
          </span>
        )}
      </td>
      <td>
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <>
              <CrudFormModal entity="parent" mode="update" data={item} id={item.id} relatedData={relatedData} />
              <ResetPasswordButton parentId={item.id} />
              <CrudFormModal entity="parent" mode="delete" id={item.id} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="hidden md:block text-lg font-semibold">{t.parents.title}</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3 self-end">
            {role === "admin" && (
              <>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-all shadow-xs"
                >
                  <Share2 size={15} className="text-emerald-600" />
                  <span>Lien Parents (WhatsApp)</span>
                </button>
                <CrudFormModal
                  entity="parent"
                  mode="create"
                  relatedData={relatedData}
                />
              </>
            )}
          </div>
        </div>
      </div>
      <Table columns={translatedColumns} renderRow={renderRow} data={data} />
      <Pagination page={page} count={count} />

      <ShareParentLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        classes={classList}
      />
    </div>
  );
}
