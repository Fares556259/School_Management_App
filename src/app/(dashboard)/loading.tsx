export default function Loading() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#F7F8FA] animate-pulse">
      <div className="relative flex items-center justify-center">
        {/* Outer spinning ring */}
        <div className="absolute w-20 h-20 border-4 border-transparent border-t-lamaPurple border-b-lamaSky rounded-full animate-spin"></div>
        
        {/* Inner static logo orb */}
        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
          <span className="text-2xl">🎓</span>
        </div>
      </div>
      
      <div className="mt-6 flex flex-col items-center">
        <h2 className="text-xl font-bold text-slate-700 tracking-tight">SchooLama</h2>
        <p className="text-sm font-medium text-slate-400 mt-1 flex items-center gap-1">
          Loading Data
          <span className="flex gap-0.5">
            <span className="animate-bounce delay-100">.</span>
            <span className="animate-bounce delay-200">.</span>
            <span className="animate-bounce delay-300">.</span>
          </span>
        </p>
      </div>
    </div>
  );
}
