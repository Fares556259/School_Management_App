"use client";

import { useFormState } from "react-dom";
import { submitSetupRequest } from "./actions";
import InputField from "@/components/InputField";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const RequestSetupPage = () => {
  const [state, formAction] = useFormState(submitSetupRequest, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.success, router]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-8 md:p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
             <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">Request Free Setup</h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            Fill in the details below and we&apos;ll get in touch to set up your school dashboard.
          </p>
        </div>

        {!state.success ? (
          <form action={formAction} className="flex flex-col gap-4">
            <InputField
              label="School Name"
              name="schoolName"
              placeholder="e.g. Sunny Heights Academy"
              required
            />
            <InputField
              label="Owner / Director Name"
              name="ownerName"
              placeholder="e.g. John Doe"
              required
            />
            <InputField
              label="Phone Number"
              name="phoneNumber"
              placeholder="e.g. +216 23 889 444"
              required
            />
            <InputField
              label="City"
              name="city"
              placeholder="e.g. Tunis"
              required
            />

            {state.error && (
              <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-100">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              className="mt-4 w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:-translate-y-1 active:scale-95 text-base"
            >
              Submit Request →
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full py-3 text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 mx-auto border-4 border-white shadow-lg shadow-emerald-100">
               <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">Request Sent!</h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
              We have received your request. Our team will contact you within 24 hours to finalize your setup.
            </p>
            <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest animate-pulse">
              Redirecting to home...
            </p>
          </div>
        )}
      </div>
      
      {/* Footer / Trust Line */}
      <p className="mt-12 text-[10px] text-slate-300 font-bold uppercase tracking-[0.3em]">
        SnapSchool · Secure Enrollment System
      </p>
    </div>
  );
};

export default RequestSetupPage;
