const Announcements = () => {
  return (
    <div className="glass-card p-6 rounded-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Announcements</h1>
        <span className="text-xs font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer transition-colors uppercase tracking-widest">View All</span>
      </div>
      <div className="flex flex-col gap-4">
        {[
          { color: "bg-indigo-50", border: "border-indigo-100", accent: "text-indigo-600" },
          { color: "bg-slate-50", border: "border-slate-100", accent: "text-slate-600" },
          { color: "bg-amber-50", border: "border-amber-100", accent: "text-amber-600" }
        ].map((style, index) => (
          <div className={`${style.color} border ${style.border} rounded-2xl p-4 transition-all hover:shadow-sm hover:scale-[1.01] cursor-pointer group`} key={index}>
            <div className="flex items-center justify-between mb-2">
              <h2 className={`font-bold text-sm ${style.accent}`}>Campus Event Update</h2>
              <span className="text-[10px] font-bold text-slate-400 bg-white shadow-sm border border-slate-50 rounded-lg px-2 py-1">
                JAN 24, 2025
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500 font-medium">
              Join us for the upcoming annual science fair. Students will showcase their innovative projects.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};


export default Announcements;
