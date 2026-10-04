'use client';
import { useRef,useState,useEffect,Dispatch,SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import type { CertificateData } from '@/components/AttendanceCertificate';
export function useCertificatePrinting(studentId:string,data:CertificateData,setData:Dispatch<SetStateAction<CertificateData>>) {
  const pending=useRef(false),mounted=useRef(true),controller=useRef<AbortController|null>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  const [printing,setPrinting]=useState(false),[printError,setPrintError]=useState('');
  const handlePrint=async()=>{
    if (pending.current) return;
    pending.current=true;setPrinting(true);setPrintError('');
    controller.current=new AbortController();
    try {
      const response=await fetch('/api/certificates/attendance',{method:'POST',signal:controller.current.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId,data})});
      const result=await response.json();
      if (!response.ok || typeof result.reference!=='string') throw new Error('Registration failed');
      if (!mounted.current) return;
      // Commit preview and print-portal content before the print dialog opens.
      flushSync(()=>setData(previous=>({...previous,certificateNumber:result.reference})));
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      if (mounted.current) window.print();
    } catch {if (mounted.current) setPrintError('تعذر تسجيل الشهادة. تحقق من الاتصال وصلاحيات الإدارة ثم حاول مجدداً. / Enregistrement impossible. Réessayez avant d’imprimer.');}
    finally {pending.current=false;if (mounted.current) setPrinting(false);}
  };
  return {handlePrint,printing,printError};
}
