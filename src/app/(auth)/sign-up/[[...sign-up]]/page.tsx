import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <SignUp
        afterSignUpUrl="/onboarding"
        redirectUrl="/onboarding"
        appearance={{
          elements: {
            rootBox: "shadow-2xl shadow-slate-200/60",
            card: "rounded-[2.5rem] border border-slate-100 shadow-none",
            headerTitle: "font-black text-slate-800 tracking-tight",
            headerSubtitle: "text-slate-500",
            formButtonPrimary:
              "bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 text-sm",
            formFieldInput:
              "rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20",
            footerActionLink: "text-indigo-600 font-bold hover:text-indigo-700",
          },
        }}
      />
    </div>
  );
}
