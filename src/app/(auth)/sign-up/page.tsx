"use client";

import { signUpAction } from "../actions";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);
    const result = await signUpAction(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F8FA] py-10">
      <div className="bg-white p-8 rounded-md shadow-2xl flex flex-col gap-4 w-[450px]">
        <div className="flex items-center gap-2 justify-center mb-4">
          <Image src="/logo.png" alt="logo" width={32} height={32} />
          <span className="font-bold text-xl">SnapSchool</span>
        </div>
        
        <h1 className="text-xl font-bold text-center">Create an Account</h1>
        <p className="text-sm text-center text-gray-500 mb-2">Get started with SnapSchool for your institution.</p>
        
        {error && (
          <div className="bg-red-100 text-red-600 p-3 rounded-md text-sm text-center">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-xs text-gray-500">First Name</label>
              <input
                type="text"
                name="name"
                required
                className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-xs text-gray-500">Last Name</label>
              <input
                type="text"
                name="surname"
                required
                className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-500">School / Institution Name</label>
            <input
              type="text"
              name="schoolName"
              required
              className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-500">Email Address</label>
            <input
              type="email"
              name="email"
              required
              className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-500">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="bg-[#4f46e5] text-white p-2 rounded-md font-medium disabled:opacity-50 mt-2 hover:bg-[#4338ca] transition-colors"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-4">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-[#4f46e5] underline hover:text-[#4338ca]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
