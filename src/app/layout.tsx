import type { Metadata } from "next";
import { Nunito, Montserrat } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import NextTopLoader from "nextjs-toploader";
import NavigationLoader from "@/components/NavigationLoader";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";

import { LanguageProvider } from "@/lib/translations/LanguageContext";

const nunito = Nunito({ 
  subsets: ["latin"],
  variable: '--font-nunito',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: '--font-montserrat',
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
    <ClerkProvider>
      <html lang="en">
        <body className={`${nunito.variable} ${montserrat.variable} ${nunito.className} antialiased`}>
          <LanguageProvider>
            <NextTopLoader color="#4f46e5" showSpinner={true} />
            <Suspense fallback={null}>
              <NavigationLoader />
            </Suspense>
            {children}
            <SpeedInsights />
          </LanguageProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
