"use client";

import { useState, useTransition } from "react";
import { parseStudentsFromText, parseStudentsFromImage } from "../../admin/actions/studentAiActions";
import { bulkCreateStudents } from "@/lib/crudActions";
import { X, Check, Loader2, AlertCircle, Sparkles, FileText, UserPlus, Image as ImageIcon, Type, UploadCloud } from "lucide-react";
import Image from "next/image";

export default function BulkStudentImport({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"input" | "parsing" | "review" | "success">("input");
  const [importMode, setImportMode] = useState<"text" | "image">("text");
  const [rawText, setRawText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleParse = async () => {
    if (importMode === "text" && !rawText.trim()) return;
    if (importMode === "image" && !imageUrl) return;

    setStep("parsing");
    setError(null);

    const result = importMode === "text" 
      ? await parseStudentsFromText(rawText)
      : await parseStudentsFromImage(imageUrl!);

    if (result.error) {
      setError(result.error);
      setStep("input");
    } else if (result.data) {
      setParsedData(result.data);
      setStep("review");
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await bulkCreateStudents(parsedData);
      if (res.success) {
        setStep("success");
        setTimeout(() => onClose(), 2000);
      } else {
        setError(res.error || "Failed to save students.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-white w-full max-w-[800px] rounded-[16px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-indigo-50/50"
      >
        {/* HEADER */}
        <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white shrink-0 border-b border-indigo-100">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-[10px] bg-indigo-600 shadow-md shadow-indigo-200 flex items-center justify-center text-white">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#181d26]">AI Bulk Enroll</h2>
              <p className="text-[13px] text-indigo-600/80 font-medium">Extract students from text or documents instantly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-indigo-100/50 rounded-[8px] text-indigo-900/40 hover:text-indigo-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
          {step === "input" && (
            <div className="flex flex-col gap-6">
              {/* MODE TOGGLE */}
              <div className="flex p-1.5 bg-slate-100/80 rounded-[10px] w-fit border border-slate-200/60 shadow-inner">
                <button
                  onClick={() => setImportMode("text")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-[13.5px] font-semibold transition-all ${
                    importMode === "text" ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-indigo-500 border border-transparent"
                  }`}
                >
                  <Type size={16} />
                  Paste Text
                </button>
                <button
                  onClick={() => setImportMode("image")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-[13.5px] font-semibold transition-all ${
                    importMode === "image" ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-indigo-500 border border-transparent"
                  }`}
                >
                  <UploadCloud size={16} />
                  Upload Document
                </button>
              </div>

              <div className="bg-indigo-50/80 border border-indigo-100 p-4 rounded-[10px] flex items-start gap-3 shadow-sm">
                 <AlertCircle size={18} className="text-indigo-500 mt-0.5 shrink-0" />
                 <p className="text-[13px] text-indigo-900/80 leading-relaxed font-medium">
                   {importMode === "text" 
                      ? "Paste your unstructured list of students below. The AI will intelligently extract and format the data into the correct fields."
                      : "Upload a clear photo, screenshot, or PDF scan of your student list. The AI will read and extract all details automatically."}
                 </p>
              </div>
              
              {importMode === "text" ? (
                <div className="flex flex-col gap-2.5">
                  <label className="text-[13.5px] font-semibold text-[#181d26] ml-1">Raw Text Data</label>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Example: John Doe, Male, Class 1A, Parent: Robert Doe, Phone: 555-1234..."
                    className="w-full h-[240px] p-5 rounded-[12px] border border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-[14px] text-slate-700 resize-none shadow-sm placeholder:text-slate-400"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <label className="text-[13.5px] font-semibold text-[#181d26] ml-1">Document Upload</label>
                  <div className="w-full h-[240px] rounded-[12px] border-2 border-dashed border-indigo-200/70 bg-indigo-50/30 flex flex-col items-center justify-center gap-4 group hover:border-indigo-400 hover:bg-indigo-50 transition-all overflow-hidden relative cursor-pointer shadow-sm"
                       onClick={() => !imageUrl && document.getElementById('bulk-import-upload')?.click()}>
                    {imageUrl ? (
                      <div className="relative w-full h-full flex flex-col items-center justify-center bg-white">
                        {imageUrl.includes('.pdf') ? (
                          <div className="flex flex-col items-center justify-center gap-3 p-6">
                            <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                               <FileText size={32} />
                            </div>
                            <p className="font-semibold text-rose-700 text-[14px]">PDF Document Ready</p>
                          </div>
                        ) : (
                          <Image src={imageUrl} alt="Document" fill className="object-contain p-2" />
                        )}
                        <button 
                           onClick={(e) => { e.stopPropagation(); setImageUrl(null); }}
                           className="absolute top-4 right-4 p-2 bg-slate-900/50 text-white rounded-[8px] hover:bg-rose-500 transition-all shadow-xl z-10 backdrop-blur-md"
                           title="Remove file"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 pointer-events-none">
                        <input
                          type="file"
                          id="bulk-import-upload"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            try {
                              const supabase = (await import('@/utils/supabase/client')).createClient();
                              const ext = file.name.split('.').pop()?.toLowerCase() || 'jpeg';
                              const fileName = `bulk-import-${Date.now()}.${ext}`;
                              const filePath = `imports/${fileName}`;

                              const { data, error: uploadError } = await supabase.storage
                                .from('uploads')
                                .upload(filePath, file);

                              if (uploadError) throw uploadError;

                              const { data: { publicUrl } } = supabase.storage
                                .from('uploads')
                                .getPublicUrl(filePath);

                              setImageUrl(publicUrl);
                            } catch (err: any) {
                              console.error("Bulk upload failed:", err);
                              setError(err.message || "Failed to upload file.");
                            }
                          }}
                        />
                        <div className="w-14 h-14 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 shadow-sm transition-all duration-300">
                          <UploadCloud size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-[14.5px] font-bold text-indigo-900">Click to select a file</p>
                          <p className="text-[12.5px] text-indigo-400 font-medium mt-1">Supports PDF, PNG, or JPG</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-[10px] flex items-start gap-2.5 shadow-sm">
                  <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[13.5px] font-medium text-rose-700">{error}</p>
                </div>
              )}

              <div className="flex justify-end pt-5 border-t border-slate-200 mt-2">
                <button
                  onClick={handleParse}
                  disabled={importMode === "text" ? !rawText.trim() : !imageUrl}
                  className="px-7 py-3 bg-indigo-600 text-white text-[14.5px] font-semibold rounded-[10px] hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  <Sparkles size={18} />
                  Start Extraction
                </button>
              </div>
            </div>
          )}

          {step === "parsing" && (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600 animate-pulse">
                  <Sparkles size={24} />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-[18px] font-bold text-[#181d26]">Analyzing Document...</h3>
                <p className="text-[14px] text-indigo-600/80 font-medium mt-1.5">The AI is currently extracting and structuring the student data.</p>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-bold text-[#181d26]">Review Extracted Data</h3>
                  <p className="text-[13.5px] text-indigo-600/80 font-medium">Please verify the parsed information before enrolling.</p>
                </div>
                <div className="px-4 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[13px] font-bold shadow-sm">
                  {parsedData.length} Students
                </div>
              </div>

              <div className="border border-slate-200 rounded-[12px] overflow-hidden shadow-sm bg-white">
                <div className="max-h-[300px] overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 text-[13px] font-semibold text-slate-500">Student Name</th>
                        <th className="px-5 py-3.5 text-[13px] font-semibold text-slate-500">Gender</th>
                        <th className="px-5 py-3.5 text-[13px] font-semibold text-slate-500">Parent</th>
                        <th className="px-5 py-3.5 text-[13px] font-semibold text-slate-500 text-right">Class ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedData.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 text-[13.5px] font-semibold text-[#181d26]">{s.name} {s.surname || ""}</td>
                          <td className="px-5 py-4 text-[13px]">
                             <span className={`px-2.5 py-1 rounded-[6px] font-semibold text-[11px] uppercase tracking-wider ${s.sex === "MALE" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"}`}>
                                {s.sex}
                             </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-[13.5px] font-medium text-[#181d26]">{s.parentName} {s.parentSurname}</div>
                            <div className="text-[12px] text-slate-400 mt-0.5">{s.parentPhone || "No Phone"}</div>
                          </td>
                          <td className="px-5 py-4 text-[13.5px] font-semibold text-slate-600 text-right">#{s.classId || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between pt-5 border-t border-slate-200 mt-2">
                <button
                  onClick={() => setStep("input")}
                  className="px-6 py-2.5 bg-white text-slate-600 border border-slate-300 text-[14px] font-semibold rounded-[8px] hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="px-8 py-2.5 bg-indigo-600 text-white text-[14px] font-semibold rounded-[8px] hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Enroll Students
                </button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center border-4 border-emerald-100 shadow-sm">
                <Check size={40} />
              </div>
              <div className="text-center">
                <h3 className="text-[20px] font-bold text-[#181d26]">Successfully Enrolled!</h3>
                <p className="text-[14px] text-emerald-600 font-medium mt-1">All {parsedData.length} students have been added to the system.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
