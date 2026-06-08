"use client";

import React, { useState } from "react";
import { BookOpen, CreditCard, Users, Wrench, ChevronDown, Mail, Phone, MessageCircle } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const HelpPage = () => {
  const { t, locale } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const categories = [
    {
      icon: <BookOpen className="text-indigo-500" size={24} />,
      title: t.helpPage?.gettingStarted || "Getting Started",
      description: t.helpPage?.gettingStartedDesc || "Learn the basics of setting up your school dashboard.",
      bg: "bg-indigo-50",
      href: "/settings"
    },
    {
      icon: <CreditCard className="text-emerald-500" size={24} />,
      title: t.helpPage?.accountBilling || "Account & Billing",
      description: t.helpPage?.accountBillingDesc || "Manage your subscription, invoices, and payment methods.",
      bg: "bg-emerald-50",
      href: "/list/incomes"
    },
    {
      icon: <Users className="text-blue-500" size={24} />,
      title: t.helpPage?.studentManagement || "Student Management",
      description: t.helpPage?.studentManagementDesc || "How to enroll, grade, and manage students.",
      bg: "bg-blue-50",
      href: "/list/students"
    },
    {
      icon: <Wrench className="text-rose-500" size={24} />,
      title: t.helpPage?.technicalSupport || "Technical Support",
      description: t.helpPage?.technicalSupportDesc || "Report issues, bugs, or system downtime.",
      bg: "bg-rose-50",
      href: "mailto:support@snapschool.com"
    }
  ];

  const faqs = [
    {
      title: t.helpPage?.faq1Title || "How do I add a new teacher?",
      description: t.helpPage?.faq1Desc || "Navigate to the Teachers section from the sidebar and click on the 'Add Teacher' button. Fill in their personal details and assigned subjects."
    },
    {
      title: t.helpPage?.faq2Title || "Can I customize the grading system?",
      description: t.helpPage?.faq2Desc || "Yes. Go to Settings > Academic Structure to modify how grades and terms are calculated."
    },
    {
      title: t.helpPage?.faq3Title || "What happens if I forget my password?",
      description: t.helpPage?.faq3Desc || "Click the 'Forgot Password' link on the login screen, or ask your system administrator to reset it via the Admin Dashboard."
    },
    {
      title: t.helpPage?.faq4Title || "How do I generate student report cards?",
      description: t.helpPage?.faq4Desc || "Go to the Results page. You can either enter grades manually or use the AI Bulk Scan to process physical grade sheets."
    },
    {
      title: t.helpPage?.faq5Title || "How do I communicate with parents?",
      description: t.helpPage?.faq5Desc || "Use the Announcements section to create a global or class-specific notice. You can attach PDFs and mark it as Urgent."
    },
    {
      title: t.helpPage?.faq6Title || "Can I export the timetable to PDF?",
      description: t.helpPage?.faq6Desc || "Yes, navigate to the Timetable view and click the 'Export PDF' button at the top right of the schedule."
    }
  ];

  return (
    <div className={`p-4 sm:p-6 md:p-8 flex-1 flex flex-col gap-8 w-full max-w-[1200px] mx-auto pb-32`}>
      {/* Header Section */}
      <div className="flex flex-col gap-4 items-center justify-center text-center py-12 px-4 bg-[#f8fafc] rounded-[16px] border border-[#dddddd] relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]"></div>
        
        <h1 className="text-[28px] md:text-[32px] font-bold text-[#181d26] relative z-10">
          {t.helpPage?.title || "Help & Support"}
        </h1>
        <p className="text-[#5a5a5a] text-[15px] max-w-lg relative z-10 mt-2">
          {t.helpPage?.subtitle || "Find answers, explore guides, or contact our support team."}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content (Categories + FAQ) */}
        <div className="flex-[2] flex flex-col gap-8">
          
          {/* Quick Links Categories */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[18px] font-bold text-[#181d26] flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-500 rounded-full inline-block"></span>
              {t.helpPage?.quickLinks || "Quick Links"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat, idx) => (
                <Link key={idx} href={cat.href} className="group p-5 bg-white border border-[#dddddd] rounded-[12px] hover:border-indigo-300 transition-all cursor-pointer shadow-sm hover:shadow-md block">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${cat.bg}`}>
                    {cat.icon}
                  </div>
                  <h3 className="text-[15px] font-bold text-[#181d26] mb-1 group-hover:text-indigo-600 transition-colors">
                    {cat.title}
                  </h3>
                  <p className="text-[13px] text-[#9297a0] leading-relaxed">
                    {cat.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {/* FAQ Accordion */}
          <div className="flex flex-col gap-4 mt-4">
            <h2 className="text-[18px] font-bold text-[#181d26] flex items-center gap-2">
              <span className="w-1.5 h-6 bg-emerald-500 rounded-full inline-block"></span>
              {t.helpPage?.faq || "Frequently Asked Questions"}
            </h2>
            <div className="flex flex-col gap-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className={`bg-white border transition-all rounded-[12px] overflow-hidden ${isOpen ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500/20' : 'border-[#dddddd] hover:border-[#9297a0]'}`}>
                    <button 
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between p-5 text-start focus:outline-none"
                    >
                      <span className={`text-[14px] font-bold transition-colors ${isOpen ? 'text-indigo-600' : 'text-[#181d26]'}`}>
                        {faq.title}
                      </span>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-5 pt-0 text-[13.5px] text-[#5a5a5a] leading-relaxed border-t border-slate-100 mx-5 mt-2">
                            {faq.description}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Sidebar (Contact Card) */}
        <div className="flex-1">
          <div className="bg-[#181d26] rounded-[16px] p-6 text-white sticky top-6 shadow-xl relative overflow-hidden">
             {/* Background graphics */}
             <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/5 rounded-full blur-[20px]"></div>
             <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-white/5 rounded-full blur-[20px]"></div>

             <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mb-6">
                  <MessageCircle size={24} className="text-white" />
                </div>
                
                <h3 className="text-[18px] font-bold mb-2">
                  {t.helpPage?.contactUs || "Still need help?"}
                </h3>
                <p className="text-[13px] text-slate-300 mb-8 leading-relaxed">
                  {t.helpPage?.contactUsDesc || "Our support team is available 24/7 to assist you with any questions or technical issues."}
                </p>

                <div className="flex flex-col gap-3">
                  <button className="w-full flex items-center justify-center gap-3 py-3 bg-white text-[#181d26] rounded-[8px] font-bold text-[13px] hover:bg-slate-100 transition-all shadow-sm">
                    <Mail size={16} />
                    {t.helpPage?.emailUs || "Email Us"}
                  </button>
                  <button className="w-full flex items-center justify-center gap-3 py-3 bg-white/10 text-white border border-white/20 rounded-[8px] font-bold text-[13px] hover:bg-white/20 transition-all">
                    <Phone size={16} />
                    <span dir="ltr">+216 23 889 444</span>
                  </button>
                  <button className="w-full flex items-center justify-center gap-3 py-3 bg-transparent text-slate-300 rounded-[8px] font-medium text-[13px] hover:text-white transition-all">
                    <MessageCircle size={16} />
                    {t.helpPage?.liveChat || "Live Chat"}
                  </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
