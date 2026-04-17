"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const features = [
  {
    icon: "💰",
    title: "Financial Command Center",
    desc: "Real-time income, expense and balance tracking with AI-powered forecasting and monthly fiscal reviews.",
    accent: "bg-indigo-50 border-indigo-100",
    iconBg: "bg-indigo-100",
  },
  {
    icon: "📋",
    title: "Immutable Audit Trail",
    desc: "Every create, update and delete action is automatically logged with full metadata and searchable history.",
    accent: "bg-violet-50 border-violet-100",
    iconBg: "bg-violet-100",
  },
  {
    icon: "🎓",
    title: "Student & Teacher Management",
    desc: "Manage enrollment, tuition payments, salaries, assignments and results for every person in your school.",
    accent: "bg-emerald-50 border-emerald-100",
    iconBg: "bg-emerald-100",
  },
  {
    icon: "🗓️",
    title: "Smart Timetable",
    desc: "A visual 5×6 weekly grid for all 18 classes. Admin-editable, teacher-assigned, always up-to-date.",
    accent: "bg-amber-50 border-amber-100",
    iconBg: "bg-amber-100",
  },
  {
    icon: "🤖",
    title: "zbiba AI Assistant",
    desc: "Your personal CFO-level AI analyst. Ask strategic questions, get instant financial insights and recommendations.",
    accent: "bg-rose-50 border-rose-100",
    iconBg: "bg-rose-100",
  },
  {
    icon: "📈",
    title: "Grade Analytics",
    desc: "Track academic performance across classes, subjects and terms with visual breakdowns and averages.",
    accent: "bg-sky-50 border-sky-100",
    iconBg: "bg-sky-100",
  },
];

const stats = [
  { value: "100%", label: "Financial Traceability" },
  { value: "6+", label: "Management Modules" },
  { value: "AI", label: "Powered Insights" },
  { value: "Real-time", label: "Dashboard Updates" },
];

const Homepage = () => {
  const { isSignedIn, user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const role = user.publicMetadata?.role as string | undefined;
      if (role === "admin") router.push("/admin");
    }
  }, [isLoaded, isSignedIn, user, router]);

  const handleLoginClick = () => {
    if (isSignedIn) {
      router.push("/admin");
    } else {
      router.push("/sign-in");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col font-sans">

      {/* TOP NAV */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-black">S</span>
            </div>
            <span className="text-lg font-black text-slate-800 tracking-tight">SnapSchool</span>
          </div>
          <button
            onClick={handleLoginClick}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Sign In →
          </button>
        </div>
      </nav>

      {/* HERO / CHOICE SECTION */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-20">
        <div className="max-w-5xl w-full mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 uppercase tracking-widest shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Private School Management System
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-4">
              Get started with <span className="text-indigo-600">SnapSchool.</span>
            </h1>
            <p className="text-slate-500 font-medium max-w-lg mx-auto leading-relaxed">
              The all-in-one command center for your private school. Choose your entry point below.
            </p>
          </div>

          {/* Dual Paths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* OPTION 1: EXISTING USERS */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 md:p-10 flex flex-col items-center text-center hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-indigo-600 transition-colors"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">I already have an account</h2>
              <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed max-w-[240px]">
                Login using the credentials provided by your school admin
              </p>
              <button
                onClick={handleLoginClick}
                className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg hover:-translate-y-1 active:scale-95 text-base"
              >
                Sign In →
              </button>
              <p className="mt-4 text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                Access provided by school administration
              </p>
            </div>

            {/* OPTION 2: NEW SCHOOLS (HIGHLIGHTED) */}
            <div className="bg-white rounded-[2rem] border-2 border-indigo-600 p-8 md:p-10 flex flex-col items-center text-center shadow-2xl shadow-indigo-100 hover:shadow-indigo-200 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4">
                <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter shadow-sm font-sans">
                  Recommended
                </span>
              </div>
              
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Set up my school</h2>
              <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed max-w-[240px]">
                We’ll set everything up for you in minutes — no technical work needed
              </p>
              
              <div className="w-full flex flex-col gap-3">
                <button
                  onClick={() => router.push("/request-setup")}
                  className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:-translate-y-1 active:scale-95 text-base"
                >
                  Request Free Setup →
                </button>
                
                <a
                  href="https://wa.me/23889444?text=Hello%20I%20want%20to%20set%20up%20my%20school%20on%20SnapSchool"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-emerald-50 text-emerald-700 font-bold rounded-2xl hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 group/wa"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover/wa:scale-110 transition-transform"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Contact on WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Trust Line */}
          <div className="mt-16 text-center">
             <p className="text-sm font-bold text-slate-300 uppercase tracking-[0.2em]">
               Helping private schools simplify management
             </p>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="bg-white border-y border-slate-100 py-8">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-black text-slate-800">{s.value}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Everything you need</p>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">
              All modules in one dashboard
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className={`bg-white rounded-2xl border p-6 flex flex-col gap-4 hover:shadow-md transition-shadow ${f.accent}`}
              >
                <div className={`w-10 h-10 rounded-xl ${f.iconBg} flex items-center justify-center text-xl`}>
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 mb-1 tracking-tight">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-16 px-6 bg-white border-t border-slate-100">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-4">
            Ready to take control?
          </h2>
          <p className="text-slate-400 font-medium mb-8 text-sm">
            Sign in to access the full SnapSchool admin dashboard.
          </p>
          <button
            onClick={handleLoginClick}
            className="px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors shadow-lg hover:-translate-y-0.5"
          >
            Go to Dashboard →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#F7F8FA] border-t border-slate-100 py-6 text-center">
        <p className="text-xs text-slate-400 font-medium">
          © 2025 SnapSchool · Private School Management Suite
        </p>
      </footer>

    </div>
  );
};

export default Homepage;