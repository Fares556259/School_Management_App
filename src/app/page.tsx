"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Calendar, 
  Cpu, 
  LineChart, 
  Smartphone, 
  Bell, 
  CheckCircle2,
  ArrowRight
} from "lucide-react";

// --- Colors & Tokens (from DESIGN.md) ---
const colors = {
  primary: "#5645d4",
  brandNavy: "#0a1530",
  canvas: "#ffffff",
  surface: "#f6f5f4",
  hairline: "#e5e3df",
  ink: "#1a1a1a",
  charcoal: "#37352f",
  steel: "#787671",
  onDarkMuted: "#a4a097",
  cardPeach: "#ffe8d4",
  cardRose: "#fde0ec",
  cardMint: "#d9f3e1",
  cardLavender: "#e6e0f5",
  cardSky: "#dcecfa",
  cardYellow: "#fef7d6",
  cardYellowBold: "#f9e79f",
};

// --- Components ---

const Navbar = ({ isSignedIn, handleLoginClick, router }: { isSignedIn: boolean; handleLoginClick: () => void; router: any }) => {
  return (
    <nav className="sticky top-0 left-0 right-0 z-50 bg-[#ffffff] border-b border-[#e5e3df] px-6 h-[64px] flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
          <div className="w-8 h-8 bg-white border border-[#e5e3df] rounded-[8px] flex items-center justify-center shadow-sm">
            <span className="text-[#1a1a1a] font-bold text-lg leading-none">S</span>
          </div>
          <span className="text-[16px] font-semibold text-[#1a1a1a] tracking-tight">SnapSchool</span>
        </div>
        
        <div className="hidden md:flex items-center gap-6 font-medium text-[14px] text-[#5d5b54]">
          <Link href="#features" className="hover:text-[#1a1a1a] transition-colors">Product</Link>
          <Link href="#analytics" className="hover:text-[#1a1a1a] transition-colors">Analytics</Link>
          <Link href="#mobile" className="hover:text-[#1a1a1a] transition-colors">Mobile App</Link>
          <Link href="#pricing" className="hover:text-[#1a1a1a] transition-colors">Pricing</Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!isSignedIn ? (
          <>
            <button 
              onClick={handleLoginClick}
              className="text-[#1a1a1a] font-medium text-[14px] hover:text-[#5645d4] transition-colors"
            >
              Log in
            </button>
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-[14px] py-[8px] bg-[#5645d4] text-white font-medium text-[14px] rounded-[8px] hover:bg-[#4534b3] transition-colors"
            >
              Get SnapSchool free
            </button>
          </>
        ) : (
          <button 
            onClick={() => router.push("/admin")}
            className="px-[14px] py-[8px] bg-[#5645d4] text-white font-medium text-[14px] rounded-[8px] hover:bg-[#4534b3] transition-colors"
          >
            Go to Dashboard
          </button>
        )}
      </div>
    </nav>
  );
};

// --- Page Main ---

export default function Homepage() {
  const { isSignedIn, user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const role = user.publicMetadata?.role as string | undefined;
      if (role === "admin" || role === "superuser") router.push("/admin");
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
    <div className="flex flex-col bg-[#ffffff] selection:bg-[#5645d4] selection:text-white font-sans">
      <Navbar isSignedIn={!!isSignedIn} handleLoginClick={handleLoginClick} router={router} />

      {/* 🚀 HERO SECTION (hero-band-dark) */}
      <section className="relative bg-[#0a1530] text-white pt-[120px] pb-0 flex flex-col items-center overflow-visible">
        {/* Decorative Dots (simulating the sticky notes/mesh wires) */}
        <div className="absolute top-20 left-[15%] w-4 h-4 rounded-full bg-[#ff64c8] opacity-80" />
        <div className="absolute top-40 right-[20%] w-3 h-3 rounded-full bg-[#f5d75e] opacity-80" />
        <div className="absolute top-32 left-[25%] w-5 h-5 rounded-full bg-[#2a9d99] opacity-80" />
        <div className="absolute bottom-40 right-[15%] w-6 h-6 rounded-full bg-[#7b3ff2] opacity-80" />
        <div className="absolute top-10 right-[35%] w-4 h-4 rounded-full bg-[#dd5b00] opacity-80" />

        <div className="max-w-4xl mx-auto text-center px-6 z-10">
          <h1 className="text-[48px] md:text-[80px] font-semibold leading-[1.05] tracking-[-2px] mb-6">
            Simplify your operations. <br className="hidden md:block"/> Focus on students.
          </h1>
          <p className="text-[18px] font-normal leading-[1.5] text-[#a4a097] max-w-2xl mx-auto mb-8">
            SnapSchool is the all-in-one workspace for modern private schools. Streamline tasks, automate paperwork, and create a seamless learning experience.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-[80px]">
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-[18px] py-[10px] bg-[#5645d4] text-white font-medium text-[14px] rounded-[8px] hover:bg-[#4534b3] transition-colors"
            >
              Get SnapSchool free
            </button>
            <button className="px-[18px] py-[10px] bg-transparent text-white font-medium text-[14px] rounded-[8px] border border-[#a4a097] hover:bg-white/10 transition-colors">
              Request a demo
            </button>
          </div>
        </div>

        {/* Workspace Mockup Card (breaks out of hero band) */}
        <div className="w-full max-w-6xl mx-auto px-6 relative z-10 translate-y-[80px] md:translate-y-[120px]">
          <div className="rounded-[12px] bg-[#ffffff] border border-[#e5e3df] overflow-hidden" style={{ boxShadow: 'rgba(15, 15, 15, 0.20) 0px 24px 48px -8px' }}>
            <Image 
              src="/landing/dashboard.png" 
              alt="SnapSchool Dashboard" 
              width={1200} 
              height={800} 
              className="w-full h-auto object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* Spacer to account for the overlapping mockup */}
      <div className="h-[120px] md:h-[200px] bg-[#ffffff]" />

      {/* 📦 BOLD YELLOW FEATURE BANNER */}
      <section id="features" className="py-[64px] px-6 bg-[#ffffff]">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#f9e79f] rounded-[12px] p-[40px] md:p-[64px] flex flex-col items-center text-center">
            <h2 className="text-[36px] font-semibold text-[#37352f] leading-[1.2] tracking-[-0.5px] mb-4">
              Everything you need in one dashboard
            </h2>
            <p className="text-[18px] text-[#37352f] max-w-2xl mb-8 leading-[1.5]">
              Explore our specialized modules designed to cover every aspect of your school's daily operations. Stop juggling multiple disjointed tools.
            </p>
            <button className="px-[18px] py-[10px] bg-[#1a1a1a] text-white font-medium text-[14px] rounded-[8px] hover:bg-black transition-colors">
              Explore Features
            </button>
          </div>
        </div>
      </section>

      {/* 🧩 PASTEL FEATURE CARDS GRID */}
      <section className="py-[48px] px-6 bg-[#ffffff]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-[#ffe8d4] p-[32px] rounded-[12px] flex flex-col">
              <div className="w-10 h-10 bg-white/50 rounded-[8px] flex items-center justify-center text-[#dd5b00] mb-6">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-[22px] font-semibold text-[#37352f] mb-2 leading-[1.3]">Financial Center</h3>
              <p className="text-[16px] text-[#5d5b54] leading-[1.55]">Real-time income, expense and balance tracking with AI-powered forecasting.</p>
            </div>

            <div className="bg-[#e6e0f5] p-[32px] rounded-[12px] flex flex-col">
              <div className="w-10 h-10 bg-white/50 rounded-[8px] flex items-center justify-center text-[#7b3ff2] mb-6">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-[22px] font-semibold text-[#37352f] mb-2 leading-[1.3]">Audit Trail</h3>
              <p className="text-[16px] text-[#5d5b54] leading-[1.55]">Every single action is logged with full metadata for perfect accountability.</p>
            </div>

            <div className="bg-[#d9f3e1] p-[32px] rounded-[12px] flex flex-col">
              <div className="w-10 h-10 bg-white/50 rounded-[8px] flex items-center justify-center text-[#1aae39] mb-6">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-[22px] font-semibold text-[#37352f] mb-2 leading-[1.3]">Personnel</h3>
              <p className="text-[16px] text-[#5d5b54] leading-[1.55]">Dedicated modules for teachers, staff, students and parents sync effortlessly.</p>
            </div>

            <div className="bg-[#fef7d6] p-[32px] rounded-[12px] flex flex-col">
              <div className="w-10 h-10 bg-white/50 rounded-[8px] flex items-center justify-center text-[#523410] mb-6">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-[22px] font-semibold text-[#37352f] mb-2 leading-[1.3]">Smart Timetable</h3>
              <p className="text-[16px] text-[#5d5b54] leading-[1.55]">Visual weekly grid for all classes. Admin-editable and teacher-assigned.</p>
            </div>

            <div className="bg-[#dcecfa] p-[32px] rounded-[12px] flex flex-col">
              <div className="w-10 h-10 bg-white/50 rounded-[8px] flex items-center justify-center text-[#0075de] mb-6">
                <LineChart className="w-5 h-5" />
              </div>
              <h3 className="text-[22px] font-semibold text-[#37352f] mb-2 leading-[1.3]">Grade Analytics</h3>
              <p className="text-[16px] text-[#5d5b54] leading-[1.55]">Deep academic performance tracking across classes, subjects and terms.</p>
            </div>

            <div className="bg-[#fde0ec] p-[32px] rounded-[12px] flex flex-col">
              <div className="w-10 h-10 bg-white/50 rounded-[8px] flex items-center justify-center text-[#a02e6d] mb-6">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-[22px] font-semibold text-[#37352f] mb-2 leading-[1.3]">Direct Notices</h3>
              <p className="text-[16px] text-[#5d5b54] leading-[1.55]">Send announcements with PDFs and images to classes or specific students.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 📊 ANALYTICS SPLIT SECTION */}
      <section id="analytics" className="py-[96px] px-6 bg-[#f6f5f4] border-y border-[#e5e3df]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-[64px]">
          <div className="flex-1">
            <h2 className="text-[48px] font-semibold text-[#1a1a1a] tracking-[-0.5px] leading-[1.15] mb-6">
              Get clear and actionable insights.
            </h2>
            <p className="text-[18px] text-[#5d5b54] leading-[1.5] mb-8">
              SnapSchool offers you detailed reports and analysis to make informed decisions for the success of your school.
            </p>
            <div className="flex flex-col gap-6">
              {[
                { title: "Track key indicators", desc: "Get a clear view of your school with real-time data." },
                { title: "Optimize attendance", desc: "Identify trends and act quickly to improve student well-being." },
                { title: "Manage resources", desc: "Evaluate the distribution of staff and resources with precision." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1 w-6 h-6 rounded-full bg-[#1aae39]/20 text-[#1aae39] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1a1a1a] text-[16px] leading-[1.55]">{item.title}</h4>
                    <p className="text-[14px] text-[#5d5b54] leading-[1.5]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="bg-[#ffffff] rounded-[12px] p-[32px] border border-[#e5e3df] shadow-sm">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#e5e3df]">
                <span className="font-semibold text-[#1a1a1a]">Student Attendance</span>
                <span className="bg-[#e6e0f5] text-[#391c57] text-[13px] font-semibold px-[8px] py-[2px] rounded-[4px]">This Week</span>
              </div>
              <div className="flex items-end gap-4 h-[200px]">
                {[40, 70, 45, 90, 60, 85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-[4px] bg-[#5645d4]" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 📱 MOBILE SOLUTION SECTION */}
      <section id="mobile" className="py-[96px] px-6 bg-[#ffffff]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row-reverse items-center gap-[64px]">
          <div className="flex-1">
            <h2 className="text-[48px] font-semibold text-[#1a1a1a] tracking-[-0.5px] leading-[1.15] mb-6">
              Keep parents in the loop, anywhere.
            </h2>
            <p className="text-[18px] text-[#5d5b54] leading-[1.5] mb-8">
              Our dedicated mobile solution for parents ensures they never miss an update about their child's academic journey.
            </p>
            <div className="flex flex-col gap-6">
              <div className="flex gap-4 items-start">
                <Bell className="w-5 h-5 text-[#dd5b00] mt-1 shrink-0" />
                <p className="text-[16px] text-[#37352f] leading-[1.55]"><strong className="font-semibold">Instant Notifications:</strong> Push alerts for new grades, exam results, and school announcements.</p>
              </div>
              <div className="flex gap-4 items-start">
                <Calendar className="w-5 h-5 text-[#2a9d99] mt-1 shrink-0" />
                <p className="text-[16px] text-[#37352f] leading-[1.55]"><strong className="font-semibold">Attendance Tracking:</strong> Parents can see real-time daily attendance and justification requests.</p>
              </div>
              <div className="flex gap-4 items-start">
                <Smartphone className="w-5 h-5 text-[#5645d4] mt-1 shrink-0" />
                <p className="text-[16px] text-[#37352f] leading-[1.55]"><strong className="font-semibold">Direct Communication:</strong> A streamlined path for parents to receive and sign off on school notices.</p>
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-[#f6f5f4] rounded-[12px] p-[32px] border border-[#e5e3df] flex justify-center">
              <Image 
                src="/landing/mobile.png" 
                alt="SnapSchool Mobile App" 
                width={300} 
                height={600} 
                className="w-[280px] h-auto border-[1px] border-[#e5e3df] rounded-[32px] shadow-[rgba(15,15,15,0.08)_0px_4px_12px_0px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 🏁 FINAL CTA SECTION (cta-banner-light) */}
      <section className="py-[96px] px-6 bg-[#ffffff]">
        <div className="max-w-5xl mx-auto bg-[#f6f5f4] rounded-[12px] p-[64px] text-center border border-[#e5e3df]">
          <h2 className="text-[36px] font-semibold text-[#1a1a1a] tracking-[-0.5px] leading-[1.2] mb-4">
            Ready to revolutionize your school operations?
          </h2>
          <p className="text-[16px] text-[#5d5b54] mb-8 max-w-2xl mx-auto leading-[1.55]">
            Join our list of leading private schools and experience the power of the most integrated management suite.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-[18px] py-[10px] bg-[#5645d4] text-white font-medium text-[14px] rounded-[8px] hover:bg-[#4534b3] transition-colors"
            >
              Get SnapSchool free
            </button>
            <Link 
              href="https://wa.me/23889444" 
              className="px-[18px] py-[10px] bg-transparent text-[#1a1a1a] font-medium text-[14px] rounded-[8px] border border-[#c8c4be] hover:bg-[#ede9e4] transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* 🦶 FOOTER (footer-region) */}
      <footer className="bg-[#ffffff] border-t border-[#e5e3df] px-[32px] py-[64px]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-6 gap-8">
          
          {/* Logo & Description (takes 2 cols on md) */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white border border-[#e5e3df] rounded-[8px] flex items-center justify-center shadow-sm">
                <span className="text-[#1a1a1a] font-bold text-lg leading-none">S</span>
              </div>
              <span className="text-[16px] font-semibold text-[#1a1a1a] tracking-tight">SnapSchool</span>
            </div>
            <p className="text-[14px] text-[#787671] leading-[1.5]">
              The all-in-one command center for your private school. Built with modern technology for the next generation of educators.
            </p>
          </div>
          
          {/* Link Columns */}
          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-medium text-[#1a1a1a] mb-2">Product</span>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">Features</Link>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">Analytics</Link>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">Mobile App</Link>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">Audit Logs</Link>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-medium text-[#1a1a1a] mb-2">Company</span>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">About Us</Link>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">Contact</Link>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">Terms</Link>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">Privacy</Link>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-medium text-[#1a1a1a] mb-2">Connect</span>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">WhatsApp</Link>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">Facebook</Link>
            <Link href="#" className="text-[14px] text-[#787671] hover:text-[#0075de] transition-colors py-1">LinkedIn</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}