import type { Metadata } from "next";
import localFont from 'next/font/local';
import "./globals.css";
import NextTopLoader from "nextjs-toploader";
import NavigationLoader from "@/components/NavigationLoader";
import { Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { LanguageProvider } from "@/lib/translations/LanguageContext";

import AppToastContainer from "@/components/AppToastContainer";

const manrope = localFont({
  src: '../fonts/Manrope-Variable.ttf',
  variable: '--font-manrope',
  display: 'swap',
  weight: '200 800',
});
const arabic = localFont({
  src: [
    { path: '../fonts/IBMPlexSansArabic-Regular.ttf', weight: '400' },
    { path: '../fonts/IBMPlexSansArabic-Medium.ttf', weight: '500' },
    { path: '../fonts/IBMPlexSansArabic-SemiBold.ttf', weight: '600' },
    { path: '../fonts/IBMPlexSansArabic-Bold.ttf', weight: '700' },
  ],
  variable: '--font-arabic',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: "SnapSchool - School Management Dashboard",
  description: "Next.js School Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${arabic.variable} font-sans antialiased`}>
        <LanguageProvider>
          <NextTopLoader color="#233BDB" showSpinner={false} />
          <Suspense fallback={null}>
            <NavigationLoader />
          </Suspense>
          {children}
          <AppToastContainer />
          <SpeedInsights />
        </LanguageProvider>
      </body>
    </html>
  );
}
