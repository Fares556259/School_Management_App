import Image from "next/image";

const UserCard = ({ type, count }: { type: string; count: number }) => {
  return (
    <div className="glass-card p-6 flex-1 min-w-[140px] group interactive-glow rounded-3xl">
      <div className="flex justify-between items-center mb-6">
        <span className="text-[11px] bg-indigo-50 px-3 py-1 rounded-full text-indigo-600 font-bold tracking-wider uppercase">
          2024/25
        </span>
        <div className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
          <Image src="/more.png" alt="" width={20} height={20} className="opacity-40 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">{count}</h1>
        <h2 className="capitalize text-xs font-bold text-slate-400 tracking-widest">{type}s</h2>
      </div>
      <div className="mt-4 h-1 w-full bg-slate-50 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 w-2/3 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
      </div>
    </div>
  );
};

export default UserCard;
