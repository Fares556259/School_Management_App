import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import NextTopLoader from "nextjs-toploader";
import NavigationLoader from "@/components/NavigationLoader";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";

import { LanguageProvider } from "@/lib/translations/LanguageContext";

import { Plus_Jakarta_Sans, Inter, Montserrat } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: '--font-jakarta',
});

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
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
        <body className={`${jakarta.variable} ${inter.variable} ${montserrat.variable} ${jakarta.className} antialiased`}>
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
