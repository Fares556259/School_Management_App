import React, { forwardRef } from 'react';
import { Smartphone, CheckCircle2, QrCode } from "lucide-react";

interface ParentFlyerPrintProps {
  schoolName: string;
  joinUrl: string;
}

const ParentFlyerPrint = forwardRef<HTMLDivElement, ParentFlyerPrintProps>(
  ({ schoolName, joinUrl }, ref) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(joinUrl)}`;

    return (
      <div ref={ref} className="bg-white text-slate-900 font-sans mx-auto" style={{ width: '210mm' }}>
        {/* PAGE 1: FLYER */}
        <div className="flex flex-col" style={{ height: '290mm', padding: '32px', position: 'relative', pageBreakAfter: 'always', overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="text-center border-b-2 border-indigo-100 pb-4 mb-4 mt-2">
          <h1 className="text-4xl font-extrabold text-indigo-700 mb-4">{schoolName}</h1>
          <h2 className="text-3xl font-bold text-slate-800">Application Parentale / تطبيق الأولياء</h2>
          <p className="text-xl text-slate-500 mt-3 font-medium">Suivez la scolarité de vos enfants en temps réel !</p>
        </div>

        {/* Two Column Layout for Instructions */}
        <div className="flex gap-8 mb-6">
          {/* French Side */}
          <div className="flex-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
               🇫🇷 Comment nous rejoindre ?
            </h3>
            <ul className="space-y-6 text-slate-700 text-lg">
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold mt-0.5">1</div>
                <p>Ouvrez l&apos;appareil photo de votre smartphone et <strong>scannez le code QR</strong> ci-dessous.</p>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold mt-0.5">2</div>
                <p>Remplissez le formulaire d&apos;inscription avec vos informations.</p>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold mt-0.5">3</div>
                <p>Suivez les notes, absences et bulletins de vos enfants directement sur votre téléphone !</p>
              </li>
            </ul>
          </div>

          {/* Arabic Side */}
          <div className="flex-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-200" dir="rtl">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
               🇹🇳 كيف تنضم إلينا؟
            </h3>
            <ul className="space-y-6 text-slate-700 text-lg">
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold mt-0.5">1</div>
                <p>افتح كاميرا هاتفك الذكي و <strong>قم بمسح رمز QR</strong> الموجود بالأسفل.</p>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold mt-0.5">2</div>
                <p>املأ استمارة التسجيل بمعلوماتك الشخصية.</p>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold mt-0.5">3</div>
                <p>تابع درجات، غيابات، وتقارير أبنائك مباشرة على هاتفك!</p>
              </li>
            </ul>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="flex flex-col items-center justify-center bg-white p-8 rounded-3xl border-2 border-indigo-100 shadow-sm max-w-xl mx-auto mb-4">
          <div className="w-56 h-56 bg-white border-4 border-white shadow-md rounded-2xl overflow-hidden mb-6">
            <img
              src={qrUrl}
              alt="Join QR Code"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center gap-3 text-indigo-700 font-bold text-3xl text-center">
            <Smartphone className="w-10 h-10" />
            SCAN ME / امسح هنا
          </div>
          <p className="text-base text-slate-400 mt-4 text-center w-full truncate font-medium">{joinUrl}</p>
        </div>

        {/* Footer Features */}
        <div className="mt-auto flex justify-between items-center border-t-2 border-slate-100 pt-6 w-full">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-lg">
            <CheckCircle2 className="w-6 h-6" /> Suivi en temps réel
          </div>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-lg">
            <CheckCircle2 className="w-6 h-6" /> 100% Sécurisé
          </div>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-lg" dir="rtl">
            متابعة فورية <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>
        {/* PAGE 2: INSTRUCTIONS */}
        <div style={{ height: '290mm', padding: '32px', position: 'relative', overflow: 'hidden', pageBreakAfter: 'always' }}>
          <div className="text-center border-b-2 border-indigo-100 pb-4 mb-6 mt-2">
            <h1 className="text-3xl font-extrabold text-indigo-700 mb-2">Guide d&apos;utilisation / دليل الاستخدام</h1>
            <p className="text-lg text-slate-500 font-medium">Découvrez comment utiliser l&apos;application / اكتشف كيف تستخدم التطبيق</p>
          </div>
          
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-2">
            {/* Feature 1: Schedule */}
            <div className="flex flex-col items-center">
              <div className="h-[380px] w-[180px] rounded-[2rem] border-[8px] border-slate-800 overflow-hidden shadow-xl mb-3 bg-slate-100 relative">
                <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl mx-auto w-16 z-10"></div>
                <img src="/assets/mobile-guide/schedule.png" alt="Schedule" className="w-full h-full object-cover object-top" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Emploi du temps</h3>
              <p className="text-slate-500 font-semibold text-sm" dir="rtl">جدول الأوقات</p>
            </div>

            {/* Feature 2: Grades */}
            <div className="flex flex-col items-center">
              <div className="h-[380px] w-[180px] rounded-[2rem] border-[8px] border-slate-800 overflow-hidden shadow-xl mb-3 bg-slate-100 relative">
                <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl mx-auto w-16 z-10"></div>
                <img src="/assets/mobile-guide/grades.png" alt="Grades" className="w-full h-full object-cover object-top" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Notes & Bulletins</h3>
              <p className="text-slate-500 font-semibold text-sm" dir="rtl">الأعداد والنتائج</p>
            </div>

            {/* Feature 3: Announcements */}
            <div className="flex flex-col items-center">
              <div className="h-[380px] w-[180px] rounded-[2rem] border-[8px] border-slate-800 overflow-hidden shadow-xl mb-3 bg-slate-100 relative">
                <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl mx-auto w-16 z-10"></div>
                <img src="/assets/mobile-guide/announcements.png" alt="Announcements" className="w-full h-full object-cover object-top" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Actualités & Annonces</h3>
              <p className="text-slate-500 font-semibold text-sm" dir="rtl">أخبار المدرسة</p>
            </div>

            {/* Feature 4: Payments */}
            <div className="flex flex-col items-center">
              <div className="h-[380px] w-[180px] rounded-[2rem] border-[8px] border-slate-800 overflow-hidden shadow-xl mb-3 bg-slate-100 relative">
                <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl mx-auto w-16 z-10"></div>
                <img src="/assets/mobile-guide/payments.png" alt="Payments" className="w-full h-full object-cover object-top" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Suivi des paiements</h3>
              <p className="text-slate-500 font-semibold text-sm" dir="rtl">الأقساط المدفوعة</p>
            </div>
          </div>
        </div>
        {/* PAGE 3: SIGN UP FLOW */}
        <div style={{ height: '290mm', padding: '32px', position: 'relative', overflow: 'hidden' }}>
          <div className="text-center border-b-2 border-indigo-100 pb-4 mb-6 mt-2">
            <h1 className="text-3xl font-extrabold text-indigo-700 mb-2">Comment se connecter / كيفية تسجيل الدخول</h1>
            <p className="text-lg text-slate-500 font-medium">Étapes de première connexion / مراحل الدخول لأول مرة</p>
          </div>
          
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-2">
            {/* Step 1 */}
            <div className="flex flex-col items-center">
              <div className="h-[380px] w-[180px] rounded-[2rem] border-[8px] border-slate-800 overflow-hidden shadow-xl mb-3 bg-slate-100 relative">
                <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl mx-auto w-16 z-10"></div>
                <img src="/assets/mobile-guide/step1.png" alt="Step 1" className="w-full h-full object-cover object-top" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">1. Choisissez &quot;Parent&quot;</h3>
              <p className="text-slate-500 font-semibold text-sm" dir="rtl">اختر &quot;ولي الأمر&quot;</p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center">
              <div className="h-[380px] w-[180px] rounded-[2rem] border-[8px] border-slate-800 overflow-hidden shadow-xl mb-3 bg-slate-100 relative">
                <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl mx-auto w-16 z-10"></div>
                <img src="/assets/mobile-guide/step2.png" alt="Step 2" className="w-full h-full object-cover object-top" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">2. Entrez votre numéro</h3>
              <p className="text-slate-500 font-semibold text-sm" dir="rtl">أدخل رقم هاتفك</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center">
              <div className="h-[380px] w-[180px] rounded-[2rem] border-[8px] border-slate-800 overflow-hidden shadow-xl mb-3 bg-slate-100 relative">
                <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl mx-auto w-16 z-10"></div>
                <img src="/assets/mobile-guide/step3.png" alt="Step 3" className="w-full h-full object-cover object-top" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">3. Créez un mot de passe</h3>
              <p className="text-slate-500 font-semibold text-sm" dir="rtl">أنشئ كلمة سر جديدة</p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center">
              <div className="h-[380px] w-[180px] rounded-[2rem] border-[8px] border-slate-800 overflow-hidden shadow-xl mb-3 bg-slate-100 relative">
                <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl mx-auto w-16 z-10"></div>
                <img src="/assets/mobile-guide/step4.png" alt="Step 4" className="w-full h-full object-cover object-top" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">4. Connectez-vous !</h3>
              <p className="text-slate-500 font-semibold text-sm" dir="rtl">تسجيل الدخول بنجاح!</p>
            </div>
          </div>

          {/* Password Warning Footer */}
          <div className="absolute bottom-8 left-8 right-8 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
            <div>
              <p className="text-amber-800 font-bold text-lg">Mot de passe oublié ?</p>
              <p className="text-amber-700 font-medium">Veuillez contacter l&apos;administration de l&apos;école.</p>
            </div>
            <div dir="rtl" className="sm:text-right">
              <p className="text-amber-800 font-bold text-lg">هل نسيت كلمة السر؟</p>
              <p className="text-amber-700 font-medium">الرجاء الاتصال بإدارة المدرسة.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ParentFlyerPrint.displayName = "ParentFlyerPrint";
export default ParentFlyerPrint;
