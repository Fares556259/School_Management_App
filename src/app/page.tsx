"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  ChevronRight, 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Calendar, 
  Cpu, 
  LineChart, 
  Smartphone, 
  Bell, 
  CheckCircle2,
  ArrowRight,
  Play
} from "lucide-react";

// --- Components ---

const Navbar = ({ isSignedIn, handleLoginClick }: { isSignedIn: boolean; handleLoginClick: () => void }) => {
  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl p-3 shadow-premium">
        <div className="flex items-center gap-3 px-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <span className="text-white font-black text-xl tracking-tighter italic">S</span>
          </div>
          <span className="text-xl font-black text-slate-800 tracking-tighter">SnapSchool</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 font-bold text-sm text-slate-500">
          <Link href="#features" className="hover:text-indigo-600 transition-colors">Features</Link>
          <Link href="#analytics" className="hover:text-indigo-600 transition-colors">Analytics</Link>
          <Link href="#mobile" className="hover:text-indigo-600 transition-colors">Mobile App</Link>
          <Link href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</Link>
        </div>

        <div className="flex items-center gap-3">
          {!isSignedIn && (
            <button 
              onClick={handleLoginClick}
              className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm"
            >
              Sign In
            </button>
          )}
          <button 
             onClick={() => (window.location.href = "/request-setup")}
             className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm"
          >
            Get Setup →
          </button>
        </div>
      </div>
    </motion.nav>
  );
};

const FeatureCard = ({ icon: Icon, title, desc, color }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
  >
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:scale-110 shadow-sm ${color}`}>
      <Icon className="w-7 h-7" />
    </div>
    <h3 className="text-xl font-black text-slate-800 mb-3 tracking-tight">{title}</h3>
    <p className="text-slate-500 font-medium text-sm leading-relaxed">{desc}</p>
  </motion.div>
);

const SectionHeader = ({ tag, title, desc, center = true }: any) => (
  <div className={`flex flex-col gap-4 mb-16 ${center ? "items-center text-center" : "items-start text-left"}`}>
    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100/50">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
      {tag}
    </span>
    <h2 className={`text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.15] ${center ? "max-w-3xl" : "max-w-xl"}`}>
      {title}
    </h2>
    <p className={`text-slate-500 font-medium text-lg leading-relaxed ${center ? "max-w-2xl" : "max-w-lg"}`}>
      {desc}
    </p>
  </div>
);

// --- Page Main ---

const Homepage = () => {
  const { isSignedIn, user, isLoaded } = useUser();
  const router = useRouter();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef });
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);

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
    <div className="flex flex-col bg-[#F7F8FA] selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <Navbar isSignedIn={isSignedIn} handleLoginClick={handleLoginClick} />

      {/* 🚀 HERO SECTION */}
      <section ref={heroRef} className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <SectionHeader 
              tag="Private School Management"
              title={<>Simplify your operations, <br className="hidden md:block"/> focus on your <span className="text-indigo-600">students.</span></>}
              desc="Streamline tasks, automate paperwork, manage data and create a seamless learning experience for your students with SnapSchool."
            />
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <button 
                onClick={() => router.push("/request-setup")}
                className="w-full sm:w-auto px-10 py-5 bg-indigo-600 text-white font-black rounded-3xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 text-lg hover:-translate-y-1 active:scale-95"
              >
                Request Free Setup
              </button>
              <button className="w-full sm:w-auto px-10 py-5 bg-white text-slate-800 font-bold rounded-3xl hover:bg-slate-50 transition-all border border-slate-100 text-lg flex items-center justify-center gap-2 group shadow-sm">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
                Watch Demo
              </button>
            </div>
            
            {/* Trusted By Strip */}
            <div className="mt-20 flex flex-col items-center gap-8">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Trusted by leaders in education</p>
              <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                <span className="text-xl md:text-2xl font-black tracking-tighter">TAKI ACADEMY</span>
                <span className="text-xl md:text-2xl font-black tracking-tighter">NAGDA</span>
                <span className="text-xl md:text-2xl font-black tracking-tighter">IECD</span>
                <span className="text-xl md:text-2xl font-black tracking-tighter">AVANCE</span>
              </div>
            </div>
          </motion.div>

          {/* Large Dashboard Reveal */}
          <motion.div 
            style={{ y }}
            initial={{ opacity: 0, scale: 0.95, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 1 }}
            className="w-full max-w-6xl mx-auto relative group"
          >
            <div className="relative rounded-[3rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] border-[8px] border-white/50 backdrop-blur-md">
               <Image 
                src="/landing/dashboard.png" 
                alt="SnapSchool Dashboard" 
                width={1200} 
                height={800} 
                className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/10 to-transparent pointer-events-none" />
            </div>
            
            {/* Floating Visual Elements */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="absolute -top-10 -right-10 hidden lg:flex bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-premium border border-white gap-4 items-center z-10"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Live Attendance</span>
                <span className="text-lg font-black text-slate-800">96.2% Today</span>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 5, delay: 1 }}
              className="absolute top-1/2 -left-20 hidden lg:flex bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-premium border border-white gap-4 items-center z-10"
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">System Status</span>
                <span className="text-base font-black text-slate-800">Fully Secure</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 📊 ANALYTICS SECTION */}
      <section id="analytics" className="py-24 px-6 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16 md:gap-24">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1"
          >
            <SectionHeader 
              center={false}
              tag="Analytics & Inihst"
              title="Get clear and actionable insights from your school data."
              desc="SnapSchool offers you detailed reports and analysis to make informed decisions for the success of your school."
            />
            
            <div className="flex flex-col gap-6 mt-10">
              {[
                { title: "Track key indicators", desc: "Get a clear view of your school with real-time data on the total number of classes, students, and teachers.", icon: Target, color: "text-rose-500 bg-rose-50" },
                { title: "Optimize attendance", desc: "Identify trends and act quickly to improve student well-being and adapt your strategies.", icon: LineChart, color: "text-sky-500 bg-sky-50" },
                { title: "Manage resource distribution", desc: "Evaluate the distribution of staff and resources across grade levels with precision.", icon: Cpu, color: "text-amber-500 bg-amber-50" }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 group cursor-default">
                  <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-base mb-1">{item.title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex-1 relative"
          >
            <div className="bg-slate-50 rounded-[3rem] p-8 md:p-12 border border-slate-100 relative shadow-inner overflow-hidden">
               {/* Simplified Chart Visual */}
               <div className="flex flex-col gap-8">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-sm font-bold text-slate-800">Student Attendance</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded">This Week</span>
                    </div>
                    <div className="flex items-end gap-3 h-32">
                      {[40, 70, 45, 90, 60, 85].map((h, i) => (
                        <div key={i} className={`flex-1 rounded-t-lg transition-all hover:opacity-80 ${i % 2 === 0 ? "bg-indigo-500" : "bg-amber-400"}`} style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global average</span>
                      <span className="text-2xl font-black text-slate-800 tracking-tight text-emerald-500">+12%</span>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>
               </div>
               
               {/* Decorative Element */}
               <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 📱 MOBILE SOLUTION SECTION */}
      <section id="mobile" className="py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row-reverse items-center gap-16 md:gap-24">
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1"
          >
            <SectionHeader 
              center={false}
              tag="Parent Connectivity"
              title="Keep parents in the loop, anywhere and anytime."
              desc="Our dedicated mobile solution for parents ensures they never miss an update about their child's academic journey."
            />
            
            <div className="flex flex-col gap-6 mt-10">
              {[
                { title: "Instant Notifications", desc: "Push alerts for new grades, exam results, and school announcements.", icon: Bell },
                { title: "Attendance Tracking", desc: "Parents can see real-time daily attendance and justification requests.", icon: Calendar },
                { title: "Direct Communication", desc: "A streamlined path for parents to receive and sign off on school notices.", icon: Smartphone }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 transition-transform group-hover:rotate-6">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-base mb-1">{item.title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex-1 relative flex justify-center"
          >
            <div className="relative z-10">
              <Image 
                src="/landing/mobile.png" 
                alt="SnapSchool Mobile App" 
                width={400} 
                height={800} 
                className="w-[300px] md:w-[350px] h-auto rounded-[3.5rem] shadow-2xl border-[10px] border-white"
              />
            </div>
            {/* Background Bloom */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] -z-1" />
          </motion.div>
        </div>
      </section>

      {/* 📦 MODULES GRID */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <SectionHeader 
            tag="Complete Ecosystem"
            title="Everything you need in one dashboard."
            desc="Explore our specialized modules designed to cover every aspect of your school's daily operations."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={BarChart3} 
              title="Financial Center" 
              desc="Real-time income, expense and balance tracking with AI-powered forecasting."
              color="bg-indigo-50 text-indigo-600"
            />
            <FeatureCard 
              icon={ShieldCheck} 
              title="Audit Trail" 
              desc="Every single action is logged with full metadata for perfect accountability."
              color="bg-violet-50 text-violet-600"
            />
            <FeatureCard 
              icon={Users} 
              title="Personnel Management" 
              desc="Dedicated modules for teachers, staff, students and parents sync effortlessly."
              color="bg-emerald-50 text-emerald-600"
            />
            <FeatureCard 
              icon={Calendar} 
              title="Smart Timetable" 
              desc="Visual 5×6 weekly grid for all 18 classes. Admin-editable and teacher-assigned."
              color="bg-amber-50 text-amber-600"
            />
            <FeatureCard 
              icon={BarChart3} 
              title="Grade Analytics" 
              desc="Deep academic performance tracking across classes, subjects and terms."
              color="bg-sky-50 text-sky-600"
            />
            <FeatureCard 
              icon={Bell} 
              title="Direct Notices" 
              desc="Send announcements with PDFs and images to classes or specific students."
              color="bg-rose-50 text-rose-600"
            />
          </div>
        </div>
      </section>

      {/* 🏁 FINAL CTA SECTION */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-slate-900 rounded-[4rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl"
          >
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-600/30 rounded-full blur-[100px] -ml-20 -mt-20" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-600/30 rounded-full blur-[100px] -mr-20 -mb-20" />
            
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] mb-6">Start your transformation</span>
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.1] mb-8">
                Ready to revolutionize your <br className="hidden md:block"/> school operations?
              </h2>
              <p className="text-slate-400 text-lg md:text-xl font-medium max-w-2xl mb-12">
                Join our list of leading private schools and experience the power of the most integrated management suite.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button 
                  onClick={() => router.push("/request-setup")}
                  className="w-full sm:w-auto px-12 py-6 bg-white text-slate-900 font-black rounded-[2rem] hover:bg-slate-50 transition-all shadow-xl text-xl hover:-translate-y-1 active:scale-95"
                >
                  Schedule Free Setup →
                </button>
                <Link href="https://wa.me/23889444" className="text-white text-sm font-bold flex items-center gap-2 hover:text-indigo-400 transition-colors py-4 px-6 underline decoration-white/20 underline-offset-8">
                  Contact Sales on WhatsApp
                </Link>
              </div>
            </div>
            
            {/* Testimonial Quote */}
            <div className="mt-20 pt-20 border-t border-white/10 flex flex-col items-center">
              <p className="text-white italic text-lg md:text-2xl font-medium max-w-3xl leading-relaxed opacity-80 mb-6">
                &ldquo;With SnapSchool, we have doubled our operational efficiency and regained full visibility over our school&apos;s financial health.&rdquo;
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10" />
                <div className="flex flex-col items-start gap-1">
                  <span className="text-white font-bold text-sm">Principal Sarah Thompson</span>
                  <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Sunny Heights Academy</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 🦶 FOOTER */}
      <footer className="bg-white px-6 py-12 md:py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start justify-between gap-12">
          <div className="flex flex-col gap-6 max-w-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white italic font-black text-lg">S</div>
              <span className="text-xl font-black text-slate-800 tracking-tighter">SnapSchool</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              The all-in-one command center for your private school. Built with modern technology for the next generation of educators.
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-12 md:gap-24 uppercase font-black text-[10px] tracking-widest text-slate-400">
            <div className="flex flex-col gap-6">
              <span className="text-slate-800 border-b border-indigo-500/20 pb-2">Product</span>
              <div className="flex flex-col gap-4 text-slate-500">
                <Link href="#" className="hover:text-indigo-600">Features</Link>
                <Link href="#" className="hover:text-indigo-600">Analytics</Link>
                <Link href="#" className="hover:text-indigo-600">Mobile Solution</Link>
                <Link href="#" className="hover:text-indigo-600">Audit Logs</Link>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <span className="text-slate-800 border-b border-indigo-500/20 pb-2">Company</span>
              <div className="flex flex-col gap-4 text-slate-500">
                <Link href="#" className="hover:text-indigo-600">About Us</Link>
                <Link href="#" className="hover:text-indigo-600">Contact</Link>
                <Link href="#" className="hover:text-indigo-600">Terms</Link>
                <Link href="#" className="hover:text-indigo-600">Privacy</Link>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <span className="text-slate-800 border-b border-indigo-500/20 pb-2">Connect</span>
              <div className="flex flex-col gap-4 text-slate-500">
                <Link href="#" className="hover:text-indigo-600">WhatsApp</Link>
                <Link href="#" className="hover:text-indigo-600">Facebook</Link>
                <Link href="#" className="hover:text-indigo-600">LinkedIn</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-slate-50 text-center">
          <p className="text-xs text-slate-300 font-bold uppercase tracking-[0.2em]">© 2025 SnapSchool · Secure Enrollment & Financial Management Suite</p>
        </div>
      </footer>
    </div>
  );
};

// --- Missing Icons ---
const Target = (props: any) => (
  <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);

const TrendingUp = (props: any) => (
  <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
);

export default Homepage;