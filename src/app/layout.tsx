import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Montserrat } from "next/font/google";
import "./globals.css";
import NextTopLoader from "nextjs-toploader";
import NavigationLoader from "@/components/NavigationLoader";
import { Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { LanguageProvider } from "@/lib/translations/LanguageContext";
import QueryProvider from "@/providers/QueryProvider";

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: '--font-jakarta',
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
    <html lang="en">
      <body className={`${jakarta.variable} ${montserrat.variable} ${jakarta.className} antialiased`}>
        <QueryProvider>
          <LanguageProvider>
            <NextTopLoader color="#4f46e5" showSpinner={true} />
            <Suspense fallback={null}>
              <NavigationLoader />
            </Suspense>
            {children}
            <SpeedInsights />
          </LanguageProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
