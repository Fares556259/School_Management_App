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

      {/* HERO */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Private School Management System
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
            Run your school
            <br />
            <span className="text-indigo-600">with full control.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-slate-500 font-medium max-w-xl mx-auto mb-10 leading-relaxed">
            SnapSchool gives private school directors a complete command center —
            finances, staff, students, timetables, and AI-powered insights in one place.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleLoginClick}
              className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5 text-base"
            >
              Enter Dashboard →
            </button>
            <span className="text-sm text-slate-400 font-medium">
              Admin access required
            </span>
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