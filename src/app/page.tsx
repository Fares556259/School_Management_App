"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const Homepage = () => {
  const { isSignedIn, user, isLoaded } = useUser();
  const router = useRouter();

  // Auto-redirect signed-in users to the admin dashboard
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const role = user.publicMetadata?.role as string | undefined;
      // If we are strictly an admin-only app for now, we can just push to admin
      // Or we can check if they are indeed an admin
      if (role === "admin") {
        router.push("/admin");
      }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white text-2xl font-black">S</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">
              SchooLama Admin Portal
            </h1>
          </div>
          <p className="text-lg md:text-xl text-slate-500 max-w-xl mx-auto font-medium mb-10">
            Welcome to the centralized school management dashboard.
          </p>

          <button
            onClick={handleLoginClick}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-indigo-300 hover:-translate-y-1"
          >
            Enter Admin Dashboard
            <span>→</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-400">
            © 2024 SchooLama — School Management Dashboard
          </p>
        </div>
      </div>
    </div>
  );
};

export default Homepage;