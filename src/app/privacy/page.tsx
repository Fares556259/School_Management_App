import React from "react";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-8 sm:p-10">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
            <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              &larr; Back to Home
            </Link>
          </div>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-sm text-slate-500 mb-6">Last updated: September 3, 2026</p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-3">1. Introduction</h2>
              <p className="text-slate-600 leading-relaxed">
                Welcome to SnapSchool. We respect your privacy and are committed to protecting your personal data. 
                This privacy policy will inform you as to how we look after your personal data when you visit our website 
                or use our mobile application (SnapSchool), and tell you about your privacy rights and how the law protects you.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-3">2. The Data We Collect About You</h2>
              <p className="text-slate-600 leading-relaxed mb-2">We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-2">
                <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
                <li><strong>Contact Data:</strong> includes email address and telephone numbers.</li>
                <li><strong>Educational Data:</strong> includes attendance records, grades, timetable, and school-related communications.</li>
                <li><strong>Technical Data:</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting, and operating system platform.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-3">3. How We Use Your Personal Data</h2>
              <p className="text-slate-600 leading-relaxed mb-2">We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-2">
                <li>Where we need to perform the contract we are about to enter into or have entered into with your educational institution.</li>
                <li>To provide school management services, including attendance tracking and grade reporting.</li>
                <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                <li>To send push notifications related to school activities (absences, new grades, announcements).</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-3">4. Data Security</h2>
              <p className="text-slate-600 leading-relaxed">
                We have put in place appropriate security measures to prevent your personal data from being accidentally lost, 
                used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data 
                to those employees, agents, contractors and other third parties who have a business need to know.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-3">5. Data Retention</h2>
              <p className="text-slate-600 leading-relaxed">
                We will only retain your personal data for as long as necessary to fulfil the purposes we collected it for, 
                including for the purposes of satisfying any legal, accounting, or reporting requirements. 
                Data associated with student records is retained in accordance with the policies of the respective educational institution.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-3">6. Contact Us</h2>
              <p className="text-slate-600 leading-relaxed">
                If you have any questions about this privacy policy or our privacy practices, please contact us or your school administrator directly.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
