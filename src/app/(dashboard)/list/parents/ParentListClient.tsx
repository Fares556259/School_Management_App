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

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ShareParentLinkModal from "@/components/ShareParentLinkModal";
import { Share2 } from "lucide-react";

type ParentList = Parent & { students: Student[] };

export default function ParentListClient({ data, columns, role, count, page, relatedData }: any) {
  const router = useRouter();
  const [isSearchPending, setIsSearchPending] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">("all");
  const [currentPage, setCurrentPage] = useState((page && !isNaN(page) && page > 0) ? Number(page) : 1);
  const { t, locale } = useLanguage();

  const classList = (relatedData?.classId || []).map((c: any) => ({
    id: parseInt(c.value, 10),
    name: c.label,
  }));

  // Counts for filters
  const counts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    (data || []).forEach((item: any) => {
      if (item.password && item.password.length > 10) {
        active++;
      } else {
        inactive++;
      }
    });
    return {
      all: (data || []).length,
      active,
      inactive,
    };
  }, [data]);

  const handleStatusChange = (status: "all" | "active" | "inactive") => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setClientSearch(val);
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    return (data || []).filter((item: any) => {
      const isActive = Boolean(item.password && item.password.length > 10);
      if (selectedStatus === "active" && !isActive) return false;
      if (selectedStatus === "inactive" && isActive) return false;

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
  }, [data, selectedStatus, clientSearch]);

  const ITEM_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEM_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
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
            {t.parents.activeBadge || t.crud.activated || "Activated"}
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200">
            {t.parents.pendingBadge || t.crud.pending || "Pending"}
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-medium text-[#181d26] tracking-tight">{t.parents.title}</h1>

          {/* Quick Status Filter Tabs */}
          <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 shadow-2xs">
            <button
              onClick={() => handleStatusChange("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedStatus === "all"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.parents.filterAll || "Tous"} ({counts.all})
            </button>
            <button
              onClick={() => handleStatusChange("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedStatus === "active"
                  ? "bg-white text-emerald-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selectedStatus === "active" ? "bg-emerald-500 ring-2 ring-emerald-200" : "bg-emerald-500"}`} />
              <span>{t.parents.filterActive || "Actifs"}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${selectedStatus === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200/70 text-slate-600"}`}>
                {counts.active}
              </span>
            </button>
            <button
              onClick={() => handleStatusChange("inactive")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedStatus === "inactive"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selectedStatus === "inactive" ? "bg-slate-500 ring-2 ring-slate-200" : "bg-slate-400"}`} />
              <span>{t.parents.filterInactive || "Non actifs"}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${selectedStatus === "inactive" ? "bg-slate-200 text-slate-800" : "bg-slate-200/70 text-slate-600"}`}>
                {counts.inactive}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <TableSearch clientSideOnly onChangeImmediate={handleSearchChange} />
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {role === "admin" && (
              <>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-all shadow-xs cursor-pointer"
                >
                  <Share2 size={15} className="text-emerald-600" />
                  <span>{t.parents.parentRegistrationsAndRequests || (locale === 'ar' ? 'تسجيلات وطلبات الأولياء' : locale === 'fr' ? 'Inscriptions & Demandes Parents' : 'Parent Registrations & Requests')}</span>
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
        {paginatedData.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-4">
            <p className="text-sm font-medium">{t.parents.noParentsFound || "Aucun parent trouvé"}</p>
          </div>
        ) : (
          <Table columns={translatedColumns} renderRow={renderRow} data={paginatedData} />
        )}
      </div>
      <Pagination page={safePage} count={displayCount} onPageChange={(newPage) => setCurrentPage(newPage)} />

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
