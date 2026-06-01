"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Calendar, 
  LineChart, 
  Smartphone, 
  Bell, 
  CheckCircle2,
} from "lucide-react";

// --- Colors & Tokens (from Webflow DESIGN.md) ---
const colors = {
  primary: "#080808",
  onPrimary: "#ffffff",
  canvas: "#ffffff",
  hairline: "#d8d8d8",
  ink: "#080808",
  body: "#363636",
  bodyMid: "#5a5a5a",
  mute: "#898989",
  accentPurple: "#7a3dff",
  accentPink: "#ed52cb",
  accentBlue: "#3b89ff",
  accentBlueInfo: "#146ef5",
  accentOrange: "#ff6b00",
  accentGreen: "#00d722",
  accentYellow: "#ffae13",
};

// --- Components ---

const Navbar = ({ isSignedIn, handleLoginClick, router }: { isSignedIn: boolean; handleLoginClick: () => void; router: any }) => {
  return (
    <nav className="sticky top-0 left-0 right-0 z-50 bg-[#ffffff] border-b border-[#d8d8d8] px-6 md:px-8 h-[64px] flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
          <div className="w-8 h-8 bg-[#080808] rounded-[4px] flex items-center justify-center">
            <span className="text-[#ffffff] font-semibold text-lg leading-none">S</span>
          </div>
          <span className="text-[16px] font-semibold text-[#080808] tracking-tight">SnapSchool</span>
        </div>
        
        <div className="hidden md:flex items-center gap-6 font-medium text-[14px] text-[#080808]">
          <Link href="#features" className="hover:text-[#5a5a5a] transition-colors">Product</Link>
          <Link href="#analytics" className="hover:text-[#5a5a5a] transition-colors">Analytics</Link>
          <Link href="#mobile" className="hover:text-[#5a5a5a] transition-colors">Mobile App</Link>
          <Link href="#pricing" className="hover:text-[#5a5a5a] transition-colors">Pricing</Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!isSignedIn ? (
          <>
            <button 
              onClick={handleLoginClick}
              className="text-[#080808] font-medium text-[14px] hover:text-[#5a5a5a] transition-colors"
            >
              Log in
            </button>
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-5 py-2.5 bg-[#080808] text-[#ffffff] font-medium text-[16px] rounded-[4px] hover:bg-[#222222] transition-colors"
            >
              Get SnapSchool free
            </button>
          </>
        ) : (
          <button 
            onClick={() => router.push("/admin")}
            className="px-5 py-2.5 bg-[#080808] text-[#ffffff] font-medium text-[16px] rounded-[4px] hover:bg-[#222222] transition-colors"
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
    <div className="flex flex-col bg-[#ffffff] selection:bg-[#3b89ff] selection:text-white font-sans">
      <Navbar isSignedIn={!!isSignedIn} handleLoginClick={handleLoginClick} router={router} />

      {/* 🚀 HERO SECTION (hero-band) */}
      <section className="relative bg-[#ffffff] text-[#080808] pt-[120px] pb-0 flex flex-col items-center overflow-visible">
        <div className="max-w-4xl mx-auto text-center px-6 z-10">
          <h1 className="text-[48px] md:text-[80px] font-semibold leading-[1.04] tracking-[-0.8px] mb-6 text-[#080808]">
            Simplify your operations. <br className="hidden md:block"/> Focus on students.
          </h1>
          <p className="text-[20px] md:text-[24px] font-normal leading-[1.5] text-[#363636] max-w-2xl mx-auto mb-8">
            SnapSchool is the visual workspace for modern private schools. Streamline tasks, automate paperwork, and create a seamless learning experience.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-[80px]">
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-[20px] py-[12px] bg-[#080808] text-[#ffffff] font-medium text-[16px] rounded-[4px] hover:bg-[#222222] transition-colors"
            >
              Get SnapSchool free
            </button>
            <button className="px-[20px] py-[12px] bg-[#ffffff] text-[#080808] font-medium text-[16px] rounded-[4px] border border-[#d8d8d8] hover:bg-[#f9f9f9] transition-colors">
              Request a demo
            </button>
          </div>
        </div>

        {/* Workspace Mockup Card with Level 2 Shadow */}
        <div className="w-full max-w-6xl mx-auto px-6 relative z-10 translate-y-[80px] md:translate-y-[120px]">
          <div className="rounded-[8px] bg-[#ffffff] border border-[#d8d8d8] overflow-hidden" style={{ boxShadow: '0 84px 24px rgba(0,0,0,0), 0 54px 22px rgba(0,0,0,0.01), 0 30px 18px rgba(0,0,0,0.04), 0 13px 13px rgba(0,0,0,0.08), 0 3px 7px rgba(0,0,0,0.09)' }}>
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

      {/* 📦 EYEBROW FEATURE BANNER */}
      <section id="features" className="py-[64px] px-6 bg-[#ffffff]">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-[15px] font-medium text-[#080808] tracking-[1.5px] uppercase mb-4">
            The Complete Platform
          </p>
          <h2 className="text-[44.8px] font-semibold text-[#080808] leading-[1.04] mb-4">
            Everything you need in one workspace
          </h2>
          <p className="text-[18px] text-[#363636] max-w-2xl mx-auto leading-[1.5]">
            Explore our specialized modules designed to cover every aspect of your school's daily operations. Stop juggling multiple disjointed tools.
          </p>
        </div>
      </section>

      {/* 🧩 CHROMATIC FEATURE CARDS GRID */}
      <section className="py-[48px] px-6 bg-[#ffffff]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Financial - Green */}
            <div className="bg-[#00d722] p-[32px] rounded-[8px] flex flex-col text-[#080808]">
              <div className="w-12 h-12 flex items-center justify-start text-[#080808] mb-6">
                <BarChart3 className="w-8 h-8" strokeWidth={2} />
              </div>
              <h3 className="text-[32px] font-medium mb-2 leading-[1.3] tracking-[-0.5px]">Financial Center</h3>
              <p className="text-[16px] leading-[1.5] text-[#080808]/80">Real-time income, expense and balance tracking with AI-powered forecasting.</p>
            </div>

            {/* Audit Trail - Purple */}
            <div className="bg-[#7a3dff] p-[32px] rounded-[8px] flex flex-col text-[#ffffff]">
              <div className="w-12 h-12 flex items-center justify-start text-[#ffffff] mb-6">
                <ShieldCheck className="w-8 h-8" strokeWidth={2} />
              </div>
              <h3 className="text-[32px] font-medium mb-2 leading-[1.3] tracking-[-0.5px]">Audit Trail</h3>
              <p className="text-[16px] leading-[1.5] text-[#ffffff]/80">Every single action is logged with full metadata for perfect accountability.</p>
            </div>

            {/* Personnel - Blue */}
            <div className="bg-[#3b89ff] p-[32px] rounded-[8px] flex flex-col text-[#ffffff]">
              <div className="w-12 h-12 flex items-center justify-start text-[#ffffff] mb-6">
                <Users className="w-8 h-8" strokeWidth={2} />
              </div>
              <h3 className="text-[32px] font-medium mb-2 leading-[1.3] tracking-[-0.5px]">Personnel</h3>
              <p className="text-[16px] leading-[1.5] text-[#ffffff]/80">Dedicated modules for teachers, staff, students and parents sync effortlessly.</p>
            </div>

            {/* Smart Timetable - Orange */}
            <div className="bg-[#ff6b00] p-[32px] rounded-[8px] flex flex-col text-[#ffffff]">
              <div className="w-12 h-12 flex items-center justify-start text-[#ffffff] mb-6">
                <Calendar className="w-8 h-8" strokeWidth={2} />
              </div>
              <h3 className="text-[32px] font-medium mb-2 leading-[1.3] tracking-[-0.5px]">Smart Timetable</h3>
              <p className="text-[16px] leading-[1.5] text-[#ffffff]/80">Visual weekly grid for all classes. Admin-editable and teacher-assigned.</p>
            </div>

            {/* Grade Analytics - Pink */}
            <div className="bg-[#ed52cb] p-[32px] rounded-[8px] flex flex-col text-[#ffffff]">
              <div className="w-12 h-12 flex items-center justify-start text-[#ffffff] mb-6">
                <LineChart className="w-8 h-8" strokeWidth={2} />
              </div>
              <h3 className="text-[32px] font-medium mb-2 leading-[1.3] tracking-[-0.5px]">Grade Analytics</h3>
              <p className="text-[16px] leading-[1.5] text-[#ffffff]/80">Deep academic performance tracking across classes, subjects and terms.</p>
            </div>

            {/* Direct Notices - Yellow */}
            <div className="bg-[#ffae13] p-[32px] rounded-[8px] flex flex-col text-[#080808]">
              <div className="w-12 h-12 flex items-center justify-start text-[#080808] mb-6">
                <Bell className="w-8 h-8" strokeWidth={2} />
              </div>
              <h3 className="text-[32px] font-medium mb-2 leading-[1.3] tracking-[-0.5px]">Direct Notices</h3>
              <p className="text-[16px] leading-[1.5] text-[#080808]/80">Send announcements with PDFs and images to classes or specific students.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 📊 ANALYTICS SPLIT SECTION */}
      <section id="analytics" className="py-[96px] px-6 bg-[#ffffff] border-y border-[#d8d8d8]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-[64px]">
          <div className="flex-1">
            <h2 className="text-[44.8px] font-semibold text-[#080808] tracking-[-0.5px] leading-[1.04] mb-6">
              Get clear and actionable insights.
            </h2>
            <p className="text-[16px] text-[#363636] leading-[1.5] mb-8">
              SnapSchool offers you detailed reports and analysis to make informed decisions for the success of your school.
            </p>
            <div className="flex flex-col gap-6">
              {[
                { title: "Track key indicators", desc: "Get a clear view of your school with real-time data." },
                { title: "Optimize attendance", desc: "Identify trends and act quickly to improve student well-being." },
                { title: "Manage resources", desc: "Evaluate the distribution of staff and resources with precision." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1 w-5 h-5 rounded-[4px] bg-[#146ef5] text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-[#080808] text-[16px] leading-[1.5]">{item.title}</h4>
                    <p className="text-[14px] text-[#5a5a5a] leading-[1.5]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 w-full">
            <div className="bg-[#ffffff] rounded-[8px] p-[32px] border border-[#d8d8d8]" style={{ boxShadow: '0 30px 18px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#d8d8d8]">
                <span className="font-medium text-[#080808]">Student Attendance</span>
                <span className="bg-[#146ef5] text-white text-[12.8px] font-medium px-2 py-1 rounded-[4px]">This Week</span>
              </div>
              <div className="flex items-end gap-4 h-[200px]">
                {[40, 70, 45, 90, 60, 85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-[4px] bg-[#080808]" style={{ height: `${h}%` }} />
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
            <h2 className="text-[44.8px] font-semibold text-[#080808] tracking-[-0.5px] leading-[1.04] mb-6">
              Keep parents in the loop, anywhere.
            </h2>
            <p className="text-[16px] text-[#363636] leading-[1.5] mb-8">
              Our dedicated mobile solution for parents ensures they never miss an update about their child's academic journey.
            </p>
            <div className="flex flex-col gap-6">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-[4px] bg-[#ff6b00] flex items-center justify-center shrink-0 text-white">
                    <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium text-[#080808] text-[16px] leading-[1.5]">Instant Notifications</h4>
                  <p className="text-[14px] text-[#363636] leading-[1.5]">Push alerts for new grades, exam results, and school announcements.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-[4px] bg-[#00d722] flex items-center justify-center shrink-0 text-[#080808]">
                    <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium text-[#080808] text-[16px] leading-[1.5]">Attendance Tracking</h4>
                  <p className="text-[14px] text-[#363636] leading-[1.5]">Parents can see real-time daily attendance and justification requests.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-[4px] bg-[#3b89ff] flex items-center justify-center shrink-0 text-white">
                    <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium text-[#080808] text-[16px] leading-[1.5]">Direct Communication</h4>
                  <p className="text-[14px] text-[#363636] leading-[1.5]">A streamlined path for parents to receive and sign off on school notices.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-[#ffffff] rounded-[8px] p-[32px] border border-[#d8d8d8] flex justify-center">
              <Image 
                src="/landing/mobile.png" 
                alt="SnapSchool Mobile App" 
                width={300} 
                height={600} 
                className="w-[280px] h-auto border-[1px] border-[#d8d8d8] rounded-[24px] shadow-[0_30px_18px_rgba(0,0,0,0.04)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 🏁 FINAL CTA SECTION (hero-band-dark) */}
      <section className="py-[120px] px-6 bg-[#080808] text-[#ffffff]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-[56px] font-semibold text-[#ffffff] tracking-[-0.5px] leading-[1.04] mb-6">
            Ready to revolutionize your school operations?
          </h2>
          <p className="text-[18px] text-[#d8d8d8] mb-10 max-w-2xl mx-auto leading-[1.5]">
            Join our list of leading private schools and experience the power of the most integrated management suite.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-6 py-3 bg-[#ffffff] text-[#080808] font-medium text-[16px] rounded-[4px] hover:bg-[#f9f9f9] transition-colors"
            >
              Get SnapSchool free
            </button>
            <Link 
              href="https://wa.me/23889444" 
              className="px-6 py-3 bg-transparent text-[#ffffff] font-medium text-[16px] rounded-[4px] border border-[#d8d8d8] hover:bg-[#ffffff]/10 transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* 🦶 FOOTER (footer) */}
      <footer className="bg-[#ffffff] px-[32px] py-[64px]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-6 gap-8">
          
          {/* Logo & Description */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#080808] rounded-[4px] flex items-center justify-center">
                <span className="text-[#ffffff] font-semibold text-lg leading-none">S</span>
              </div>
              <span className="text-[16px] font-semibold text-[#080808] tracking-tight">SnapSchool</span>
            </div>
            <p className="text-[14px] text-[#5a5a5a] leading-[1.5]">
              The visual workspace for your private school. Built with modern technology for the next generation of educators.
            </p>
          </div>
          
          {/* Link Columns */}
          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-medium text-[#080808] mb-2">Product</span>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">Features</Link>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">Analytics</Link>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">Mobile App</Link>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">Audit Logs</Link>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-medium text-[#080808] mb-2">Company</span>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">About Us</Link>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">Contact</Link>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">Terms</Link>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">Privacy</Link>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-medium text-[#080808] mb-2">Connect</span>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">WhatsApp</Link>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">Facebook</Link>
            <Link href="#" className="text-[14px] text-[#5a5a5a] hover:text-[#080808] transition-colors">LinkedIn</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}