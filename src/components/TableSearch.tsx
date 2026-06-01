"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

const TableSearch = () => {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const value = (e.currentTarget[0] as HTMLInputElement).value;

    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.delete("page");
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full sm:w-72"
    >
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#41454d]" size={16} />
      <input
        type="text"
        placeholder="Search..."
        className="w-full bg-white border border-[#dddddd] rounded-[6px] pl-10 pr-4 py-2 text-[13px] font-medium text-[#181d26] placeholder-[#41454d]/60 focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm"
      />
    </form>
  );
};

export default TableSearch;
