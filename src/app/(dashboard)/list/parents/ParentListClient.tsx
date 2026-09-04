"use client";

import { useLanguage } from "@/lib/translations/LanguageContext";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import TableSearch from "@/components/TableSearch";
import CrudFormModal from "@/components/CrudFormModal";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import Image from "next/image";
import { Parent, Student } from "@prisma/client";
import { getUserAvatar } from "@/lib/avatar";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShareParentLinkModal from "@/components/ShareParentLinkModal";
import { Share2 } from "lucide-react";

type ParentList = Parent & { students: Student[] };

export default function ParentListClient({ data, columns, role, count, page, relatedData }: any) {
  const router = useRouter();
  const [isSearchPending, setIsSearchPending] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const { t, locale } = useLanguage();

  const classList = (relatedData?.classId || []).map((c: any) => ({
    id: parseInt(c.value, 10),
    name: c.label,
  }));

  
  const filteredData = data.filter((item: any) => {
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesName = item.name?.toLowerCase().includes(s);
      const matchesSurname = item.surname?.toLowerCase().includes(s);
      const matchesPhone = item.phone?.toLowerCase().includes(s);
      const matchesStudent = item.students?.some((st: any) => st.name?.toLowerCase().includes(s) || st.surname?.toLowerCase().includes(s));
      if (!matchesName && !matchesSurname && !matchesPhone && !matchesStudent) return false;
    }
    return true;
  });

  const ITEM_PER_PAGE = 10;
  const safePage = (page && !isNaN(page) && page > 0) ? page : 1;
  const paginatedData = filteredData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);
  const displayCount = filteredData.length;

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
          src={getUserAvatar(item.img, "parent", (item as any).sex)}
          alt=""
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <h3 className="font-semibold">{item.name} {item.surname}</h3>
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h1 className="text-[24px] font-medium text-[#181d26] tracking-tight">{t.parents.title}</h1>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <TableSearch clientSideOnly onChangeImmediate={(val) => setClientSearch(val)} />
          <div className="flex items-center gap-3 self-end">
            {role === "admin" && (
              <>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-all shadow-xs"
                >
                  <Share2 size={15} className="text-emerald-600" />
                  <span>{locale === 'ar' ? 'تسجيلات وطلبات الأولياء' : locale === 'fr' ? 'Inscriptions & Demandes Parents' : 'Parent Registrations & Requests'}</span>
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
      <div className={`transition-opacity duration-200 ${isSearchPending ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        <Table columns={translatedColumns} renderRow={renderRow} data={paginatedData} />
      </div>
      <Pagination page={page} count={displayCount} />

      <ShareParentLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        classes={classList}
        schoolName={relatedData.schoolName}
        schoolSubdomain={relatedData.schoolSubdomain}
        onApproved={() => router.refresh()}
      />
    </div>
  );
}
