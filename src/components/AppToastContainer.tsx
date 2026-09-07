"use client";

import { ToastContainer } from "react-toastify";
import { useLanguage } from "@/lib/translations/LanguageContext";
import "react-toastify/dist/ReactToastify.css";

export default function AppToastContainer() {
  const { locale } = useLanguage();
  const isRtl = locale === "ar";

  return (
    <ToastContainer
      position="top-right"
      autoClose={3500}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={isRtl}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
    />
  );
}
