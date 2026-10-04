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
            <p className="text-sm text-slate-500 mb-6">Last updated: October 4, 2026</p>

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
                <li><strong>School profile data:</strong> may include address, date of birth, gender and blood type supplied by your school. Blood type is sensitive health information and should only be recorded where necessary for the school’s legitimate purpose.</li>
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
              <h2 className="text-xl font-semibold text-slate-800 mb-3">6. Photos, audio, financial records and AI</h2>
              <p className="text-slate-600 leading-relaxed">If you choose to upload a photo or document, SnapSchool stores the selected file to provide the requested school feature. The system photo picker shares only the items you select. Camera and microphone access is requested when you use those features. Voice messages, prompts, selected images and relevant school context may be processed by AI service providers, including Google Gemini, to provide Hnia responses and transcription. Do not submit information unrelated to the school task. Hnia responses may be inaccurate; review information and confirm financial actions before proceeding.</p>
              <p className="text-slate-600 leading-relaxed mt-3">Tuition, salary, payment and receipt records are processed to provide school financial administration. Hosting, authentication, storage and notification providers, including Vercel, Supabase and Expo, process necessary data on our behalf. We do not sell personal data.</p>
              <p className="text-slate-600 leading-relaxed mt-3">SnapSchool mobile version 1.0.4 and the updated website disable PostHog analytics and interaction autocapture. Older installed versions may have transmitted user identifiers, usage events and financial event properties to PostHog. Existing analytics data must be reviewed and removed when no longer needed.</p>
            </section>
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-3">7. Account deletion and data retention</h2>
              <p className="text-slate-600 leading-relaxed">You can request deletion of your account and associated personal data from the app’s privacy controls or from our public <Link className="text-blue-700 underline" href="/account-deletion">account deletion page</Link>. Your identity is verified before processing. A request is recorded for review by your school; it does not immediately delete the account. Your school will explain any educational, accounting or legal records it must retain, their retention period and why. Other personal data that is no longer necessary is deleted or anonymised. If you cannot sign in, contact your school to verify your identity and request deletion.</p>
            </section>
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-3">8. Contact Us</h2>
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
