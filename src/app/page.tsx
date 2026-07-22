"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Calendar, 
  LineChart, 
  Smartphone, 
  Bell, 
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

// --- Components ---

const Navbar = ({ isSignedIn, handleLoginClick, router }: { isSignedIn: boolean; handleLoginClick: () => void; router: any }) => {
  return (
    <nav className="sticky top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border-b border-black/5 px-6 md:px-8 h-[72px] flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo(0, 0)}>
          <div className="w-9 h-9 bg-gradient-to-br from-[#080808] to-[#363636] rounded-[8px] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <span className="text-white font-bold text-xl leading-none tracking-tighter">S</span>
          </div>
          <span className="text-[18px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">SnapSchool</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 font-medium text-[15px] text-gray-600">
          <Link href="#features" className="hover:text-black transition-colors">Platform</Link>
          <Link href="#analytics" className="hover:text-black transition-colors">Analytics</Link>
          <Link href="#mobile" className="hover:text-black transition-colors">Mobile App</Link>
          <Link href="#pricing" className="hover:text-black transition-colors">Pricing</Link>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {!isSignedIn ? (
          <>
            <button 
              onClick={handleLoginClick}
              className="text-gray-700 font-medium text-[15px] hover:text-black transition-colors"
            >
              Log in
            </button>
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-6 py-2.5 bg-black text-white font-medium text-[15px] rounded-full hover:bg-gray-800 hover:scale-105 transition-all shadow-md flex items-center gap-2"
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button 
            onClick={() => router.push("/admin")}
            className="px-6 py-2.5 bg-black text-white font-medium text-[15px] rounded-full hover:bg-gray-800 hover:scale-105 transition-all shadow-md"
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
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsSignedIn(true);
        const role = user.user_metadata?.role as string | undefined;
        if (role === "admin") router.push("/admin");
        else if (role === "superadmin") router.push("/superadmin");
        else if (role === "teacher") router.push("/teacher");
        else if (role === "student") router.push("/student");
        else if (role === "parent") router.push("/parent");
      }
      setIsLoaded(true);
    };
    fetchUser();
  }, [router, supabase]);

  const handleLoginClick = () => {
    if (isSignedIn) {
      router.push("/admin");
    } else {
      router.push("/sign-in");
    }
  };

  const fadeUpVariant: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="flex flex-col bg-[#FAFAFA] selection:bg-[#3b89ff] selection:text-white font-sans overflow-hidden">
      <Navbar isSignedIn={!!isSignedIn} handleLoginClick={handleLoginClick} router={router} />

      {/* 🚀 HERO SECTION */}
      <section className="relative pt-[120px] pb-0 flex flex-col items-center overflow-visible w-full">
        {/* Glow Effects */}
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-purple-400/20 rounded-full blur-[100px] pointer-events-none" />
        
        <motion.div 
          className="max-w-5xl mx-auto text-center px-6 z-10"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
          }}
        >
          <motion.div variants={fadeUpVariant} className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm">
            <span className="text-[13px] font-semibold tracking-wide uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              The Next Generation of School Management
            </span>
          </motion.div>
          <motion.h1 variants={fadeUpVariant} className="text-[56px] md:text-[88px] font-bold leading-[1.05] tracking-tight mb-6 text-gray-900">
            Simplify your operations. <br className="hidden md:block"/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">Focus on students.</span>
          </motion.h1>
          <motion.p variants={fadeUpVariant} className="text-[20px] md:text-[24px] font-medium leading-[1.6] text-gray-500 max-w-3xl mx-auto mb-10">
            SnapSchool is the visual workspace for modern private schools. Streamline tasks, automate paperwork, and create a seamless learning experience.
          </motion.p>
          
          <motion.div variants={fadeUpVariant} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-[80px]">
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-8 py-4 bg-black text-white font-semibold text-[16px] rounded-full hover:bg-gray-800 hover:-translate-y-1 transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] flex items-center gap-2"
            >
              Start for free <ChevronRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 bg-white text-gray-900 font-semibold text-[16px] rounded-full border border-gray-200 hover:bg-gray-50 hover:-translate-y-1 transition-all shadow-sm">
              Request a demo
            </button>
          </motion.div>
        </motion.div>

        {/* Workspace Mockup Card */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="w-full max-w-6xl mx-auto px-6 relative z-10 translate-y-[80px] md:translate-y-[120px]"
        >
          <div className="rounded-[20px] bg-white border border-gray-200/50 overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
            <Image 
              src="/landing/dashboard.png" 
              alt="SnapSchool Dashboard" 
              width={1200} 
              height={800} 
              className="w-full h-auto object-cover"
              priority
            />
          </div>
        </motion.div>
      </section>

      {/* Spacer */}
      <div className="h-[120px] md:h-[200px] bg-transparent" />

      {/* 📦 EYEBROW FEATURE BANNER */}
      <section id="features" className="py-[64px] px-6">
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
          variants={fadeUpVariant}
          className="max-w-6xl mx-auto text-center"
        >
          <h2 className="text-[40px] md:text-[56px] font-bold text-gray-900 leading-[1.1] mb-6 tracking-tight">
            Everything you need in <span className="italic font-light text-gray-500">one workspace</span>
          </h2>
          <p className="text-[20px] text-gray-500 max-w-2xl mx-auto leading-[1.6]">
            Explore our specialized modules designed to cover every aspect of your school&apos;s daily operations. Stop juggling multiple disjointed tools.
          </p>
        </motion.div>
      </section>

      {/* 🧩 CHROMATIC FEATURE CARDS GRID */}
      <section className="py-[48px] px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {[
              {
                icon: BarChart3, title: "Financial Center", desc: "Real-time income, expense and balance tracking with AI-powered forecasting.",
                bg: "bg-gradient-to-br from-emerald-400 to-green-600", text: "text-white"
              },
              {
                icon: ShieldCheck, title: "Audit Trail", desc: "Every single action is logged with full metadata for perfect accountability.",
                bg: "bg-gradient-to-br from-indigo-500 to-purple-600", text: "text-white"
              },
              {
                icon: Users, title: "Personnel", desc: "Dedicated modules for teachers, staff, students and parents sync effortlessly.",
                bg: "bg-gradient-to-br from-blue-400 to-blue-600", text: "text-white"
              },
              {
                icon: Calendar, title: "Smart Timetable", desc: "Visual weekly grid for all classes. Admin-editable and teacher-assigned.",
                bg: "bg-gradient-to-br from-orange-400 to-rose-500", text: "text-white"
              },
              {
                icon: LineChart, title: "Grade Analytics", desc: "Deep academic performance tracking across classes, subjects and terms.",
                bg: "bg-gradient-to-br from-pink-400 to-pink-600", text: "text-white"
              },
              {
                icon: Bell, title: "Direct Notices", desc: "Send announcements with PDFs and images to classes or specific students.",
                bg: "bg-gradient-to-br from-amber-300 to-yellow-500", text: "text-gray-900"
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className={`p-[32px] rounded-[24px] flex flex-col ${feature.bg} ${feature.text} shadow-xl relative overflow-hidden group`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />
                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm mb-6 shadow-inner">
                  <feature.icon className="w-7 h-7" strokeWidth={2.5} />
                </div>
                <h3 className="text-[28px] font-bold mb-3 leading-[1.2] tracking-tight">{feature.title}</h3>
                <p className="text-[16px] leading-[1.6] opacity-90 font-medium">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 📊 ANALYTICS SPLIT SECTION */}
      <section id="analytics" className="py-[120px] px-6 mt-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-[80px]">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariant}
            className="flex-1"
          >
            <h2 className="text-[40px] md:text-[48px] font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
              Get clear and <br/> <span className="text-blue-600">actionable insights.</span>
            </h2>
            <p className="text-[18px] text-gray-500 leading-[1.6] mb-8">
              SnapSchool offers you detailed reports and analysis to make informed decisions for the success of your school.
            </p>
            <div className="flex flex-col gap-8">
              {[
                { title: "Track key indicators", desc: "Get a clear view of your school with real-time data." },
                { title: "Optimize attendance", desc: "Identify trends and act quickly to improve student well-being." },
                { title: "Manage resources", desc: "Evaluate the distribution of staff and resources with precision." }
              ].map((item, i) => (
                <div key={i} className="flex gap-5">
                  <div className="mt-1 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-[18px] mb-1">{item.title}</h4>
                    <p className="text-[15px] text-gray-500 leading-[1.5]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="flex-1 w-full"
          >
            <div className="bg-white rounded-[24px] p-[40px] border border-gray-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] relative overflow-hidden">
              <div className="absolute -right-20 -top-20 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                <span className="font-bold text-gray-900 text-lg">Student Attendance</span>
                <span className="bg-blue-50 text-blue-600 text-[13px] font-bold px-3 py-1.5 rounded-full">This Week</span>
              </div>
              <div className="flex items-end gap-6 h-[240px] justify-between px-2">
                {[40, 70, 45, 90, 60, 85].map((h, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                    className="w-full max-w-[40px] rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-400" 
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 📱 MOBILE SOLUTION SECTION */}
      <section id="mobile" className="py-[120px] px-6 bg-white border-y border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-gray-50 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row-reverse items-center gap-[80px] relative z-10">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariant}
            className="flex-1"
          >
            <h2 className="text-[40px] md:text-[48px] font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
              Keep parents in the loop, <br/> <span className="text-purple-600">anywhere.</span>
            </h2>
            <p className="text-[18px] text-gray-500 leading-[1.6] mb-10">
              Our dedicated mobile solution for parents ensures they never miss an update about their child&apos;s academic journey.
            </p>
            <div className="flex flex-col gap-8">
              <div className="flex gap-5 items-start">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0 text-orange-600 shadow-sm">
                    <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-[18px] mb-1">Instant Notifications</h4>
                  <p className="text-[15px] text-gray-500 leading-[1.5]">Push alerts for new grades, exam results, and school announcements.</p>
                </div>
              </div>
              <div className="flex gap-5 items-start">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center shrink-0 text-green-600 shadow-sm">
                    <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-[18px] mb-1">Attendance Tracking</h4>
                  <p className="text-[15px] text-gray-500 leading-[1.5]">Parents can see real-time daily attendance and justification requests.</p>
                </div>
              </div>
              <div className="flex gap-5 items-start">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0 text-purple-600 shadow-sm">
                    <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-[18px] mb-1">Direct Communication</h4>
                  <p className="text-[15px] text-gray-500 leading-[1.5]">A streamlined path for parents to receive and sign off on school notices.</p>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div 
             initial={{ opacity: 0, scale: 0.9, rotate: -5 }} 
             whileInView={{ opacity: 1, scale: 1, rotate: 0 }} 
             viewport={{ once: true }} 
             transition={{ type: "spring", stiffness: 100, damping: 20 }}
             className="flex-1 flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 rounded-[40px] blur-3xl transform scale-110" />
              <Image 
                src="/landing/mobile.png" 
                alt="SnapSchool Mobile App" 
                width={320} 
                height={650} 
                className="w-[300px] h-auto border-[6px] border-white rounded-[40px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.25)] relative z-10"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 🏁 FINAL CTA SECTION */}
      <section className="relative py-[140px] px-6 bg-gray-900 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariant}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          <h2 className="text-[48px] md:text-[64px] font-bold text-white tracking-tight leading-[1.05] mb-8">
            Ready to revolutionize <br className="hidden md:block"/> your school operations?
          </h2>
          <p className="text-[20px] text-gray-400 mb-12 max-w-2xl mx-auto leading-[1.6]">
            Join our list of leading private schools and experience the power of the most integrated management suite.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-5">
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-8 py-4 bg-white text-gray-900 font-bold text-[16px] rounded-full hover:bg-gray-100 hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2"
            >
              Get Started Now <ChevronRight className="w-5 h-5" />
            </button>
            <Link 
              href="https://wa.me/23889444" 
              className="px-8 py-4 bg-transparent text-white font-bold text-[16px] rounded-full border border-gray-600 hover:bg-white/5 hover:border-gray-400 transition-colors flex items-center justify-center"
            >
              Contact Sales
            </Link>
          </div>
        </motion.div>
      </section>

      {/* 🦶 FOOTER */}
      <footer className="bg-white px-[32px] py-[80px] border-t border-gray-100">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-6 gap-12">
          
          {/* Logo & Description */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-900 to-gray-700 rounded-[8px] flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl leading-none">S</span>
              </div>
              <span className="text-[20px] font-bold text-gray-900 tracking-tight">SnapSchool</span>
            </div>
            <p className="text-[15px] text-gray-500 leading-[1.6]">
              The visual workspace for your private school. Built with modern technology for the next generation of educators.
            </p>
            <div className="text-[14px] text-gray-400 mt-4">
              © {new Date().getFullYear()} SnapSchool. All rights reserved.
            </div>
          </div>
          
          {/* Link Columns */}
          <div className="flex flex-col gap-4 md:ml-auto">
            <span className="text-[16px] font-bold text-gray-900 mb-2">Product</span>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">Features</Link>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">Analytics</Link>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">Mobile App</Link>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">Audit Logs</Link>
          </div>

          <div className="flex flex-col gap-4">
            <span className="text-[16px] font-bold text-gray-900 mb-2">Company</span>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">About Us</Link>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">Contact</Link>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">Terms of Service</Link>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">Privacy Policy</Link>
          </div>

          <div className="flex flex-col gap-4">
            <span className="text-[16px] font-bold text-gray-900 mb-2">Connect</span>
            <Link href="https://wa.me/23889444" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">WhatsApp</Link>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">Facebook</Link>
            <Link href="#" className="text-[15px] text-gray-500 hover:text-blue-600 transition-colors">LinkedIn</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}