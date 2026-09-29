"use client";

import { useState, useTransition } from "react";
import { parseStudentsFromText, parseStudentsFromImage, parseStudentsFromExcel } from "../../admin/actions/studentAiActions";
import { bulkCreateStudents } from "@/lib/crudActions";
import { X, Check, Loader2, AlertCircle, Sparkles, FileText, UserPlus, Image as ImageIcon, Type, UploadCloud, FileSpreadsheet } from "lucide-react";
import Image from "next/image";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { compressImage } from "@/lib/imageCompression";

export default function BulkStudentImport({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"input" | "parsing" | "review" | "success">("input");
  const [importMode, setImportMode] = useState<"excel" | "text" | "image">("excel");
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { t } = useLanguage();

  const handleParse = async () => {
    if (importMode === "excel" && !excelFile) return;
    if (importMode === "text" && !rawText.trim()) return;
    if (importMode === "image" && !imageUrl) return;

    if (importMode === "excel" && excelFile) {
      setStep("parsing");
      setError(null);
      const fd = new FormData();
      fd.append("file", excelFile);
      const res = await parseStudentsFromExcel(fd);
      if (res.error) {
        setError(res.error);
        setStep("input");
      } else if (res.data) {
        setParsedData(res.data);
        setStep("review");
      }
      return;
    }

    // Fast path: if user pasted direct JSON (e.g. from the portal extraction script)
    const trimmed = rawText.trim();
    if (importMode === "text" && (trimmed.startsWith("[") || trimmed.startsWith("{"))) {
      try {
        const json = JSON.parse(trimmed);
        const list = Array.isArray(json) ? json : [json];
        const normalized = list.map((s: any) => ({
          ...s,
          name: s.name || s.firstName || "",
          surname: s.surname || s.lastName || "",
          nationalId: s.nationalId || s["المعرف التربوي"] || null,
          sex: s.sex === "FEMALE" || String(s.gender || "").includes("أنثى") ? "FEMALE" : "MALE",
          levelId: Number(s.levelId || selectedLevel || 1),
          classId: s.classId && s.classId !== "null" ? Number(s.classId) : null,
        }));
        setParsedData(normalized);
        setStep("review");
        return;
      } catch (jsonErr) {
        console.warn("Direct JSON parse failed, falling back to AI parse:", jsonErr);
      }
    }

    setStep("parsing");
    setError(null);

    const result = importMode === "text" 
      ? await parseStudentsFromText(rawText)
      : await parseStudentsFromImage(imageUrl!);

    if (result.error) {
      setError(result.error);
      setStep("input");
    } else if (result.data) {
      const enriched = (result.data || []).map((s: any) => ({
        ...s,
        levelId: Number(s.levelId || selectedLevel || 1),
        classId: s.classId && s.classId !== "null" ? Number(s.classId) : null,
      }));
      setParsedData(enriched);
      setStep("review");
    }
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await bulkCreateStudents(parsedData);
        if (res.success) {
          setStep("success");
          setTimeout(() => onClose(), 2000);
        } else {
          setError(res.error || "Failed to save students.");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to save students.");
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
              <h2 className="text-[17px] font-bold text-[#181d26]">{t.students.modal.title}</h2>
              <p className="text-[13px] text-indigo-600/80 font-medium">{t.students.modal.subtitle}</p>
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
              <div className="flex p-1.5 bg-slate-100/80 rounded-[10px] w-fit border border-slate-200/60 shadow-inner flex-wrap gap-1">
                <button
                  onClick={() => setImportMode("excel")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${
                    importMode === "excel" ? "bg-white text-emerald-700 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-emerald-600 border border-transparent"
                  }`}
                >
                  <FileSpreadsheet size={16} className={importMode === "excel" ? "text-emerald-600" : ""} />
                  <span>Fichier Excel (.xlsx)</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">Recommandé</span>
                </button>
                <button
                  onClick={() => setImportMode("text")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${
                    importMode === "text" ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-indigo-500 border border-transparent"
                  }`}
                >
                  <Type size={16} />
                  <span>Coller Texte / JSON</span>
                </button>
                <button
                  onClick={() => setImportMode("image")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${
                    importMode === "image" ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-indigo-500 border border-transparent"
                  }`}
                >
                  <UploadCloud size={16} />
                  <span>Document / Image</span>
                </button>
              </div>

              {importMode === "excel" ? (
                <div className="flex flex-col gap-3">
                  <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-[10px] flex items-start gap-3 shadow-sm">
                    <Check size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-emerald-900 leading-relaxed font-medium">
                      Déposez votre fichier <b>.xlsx</b> officiel. SnapSchool détecte automatiquement le <b>المعرف التربوي</b>, le <b>Nom</b>, le <b>Prénom</b>, le <b>Genre</b> et le <b>Niveau (1ère à 6ème)</b> de chaque élève sans risque d&apos;erreur !
                    </p>
                  </div>

                  <div
                    onClick={() => document.getElementById("excel-student-upload")?.click()}
                    className={`w-full p-8 rounded-[12px] border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                      excelFile
                        ? "border-emerald-500 bg-emerald-50/40"
                        : "border-slate-300 hover:border-emerald-400 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="file"
                      id="excel-student-upload"
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setExcelFile(file);
                      }}
                    />
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <FileSpreadsheet size={28} />
                    </div>
                    {excelFile ? (
                      <div className="text-center">
                        <p className="text-[15px] font-bold text-emerald-900">{excelFile.name}</p>
                        <p className="text-[12px] text-emerald-700 font-medium mt-0.5">
                          {(excelFile.size / 1024).toFixed(1)} Ko • Prêt pour l&apos;importation
                        </p>
                        <span className="inline-block mt-2 text-xs font-semibold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                          ✓ Fichier sélectionné (Cliquez pour changer)
                        </span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-[14.5px] font-bold text-slate-800">Cliquez ou glissez votre fichier Excel (.xlsx)</p>
                        <p className="text-[12.5px] text-slate-500 mt-1">Feuille officielle des inscriptions avec les niveaux</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-indigo-50/80 border border-indigo-100 p-4 rounded-[10px] flex items-start gap-3 shadow-sm">
                    <AlertCircle size={18} className="text-indigo-500 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-indigo-900/80 leading-relaxed font-medium">
                      {importMode === "text" 
                         ? t.students.modal.textInfo
                         : t.students.modal.imageInfo}
                    </p>
                  </div>
                  
                  {/* LEVEL SELECTOR */}
                  <div className="flex flex-col gap-2.5 bg-white p-4 rounded-[12px] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <label className="text-[13px] font-bold text-slate-800">
                        Niveau des élèves à importer (السنة الدراسية)
                      </label>
                      <span className="text-[11.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        Non classés (affectation ultérieure)
                      </span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {[
                        { id: 0, label: "Préscolaire" },
                        { id: 1, label: "1ère (Niv 1)" },
                        { id: 2, label: "2ème (Niv 2)" },
                        { id: 3, label: "3ème (Niv 3)" },
                        { id: 4, label: "4ème (Niv 4)" },
                        { id: 5, label: "5ème (Niv 5)" },
                        { id: 6, label: "6ème (Niv 6)" },
                      ].map((lvl) => {
                        const isSel = selectedLevel === lvl.id;
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setSelectedLevel(lvl.id)}
                            className={`py-2 px-1.5 rounded-lg text-xs font-bold border transition-all text-center ${
                              isSel
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {lvl.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {importMode === "text" ? (
                <div className="flex flex-col gap-2.5">
                  <label className="text-[13.5px] font-semibold text-[#181d26] ml-1">
                    {t.students.modal.rawTextLabel} / JSON ou Texte du portail
                  </label>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={t.students.modal.rawTextPlaceholder}
                    className="w-full h-[240px] p-5 rounded-[12px] border border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-[14px] text-slate-700 resize-none shadow-sm placeholder:text-slate-400"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <label className="text-[13.5px] font-semibold text-[#181d26] ml-1">{t.bulkImport.documentUpload}</label>
                  <div className="w-full h-[240px] rounded-[12px] border-2 border-dashed border-indigo-200/70 bg-indigo-50/30 flex flex-col items-center justify-center gap-4 group hover:border-indigo-400 hover:bg-indigo-50 transition-all overflow-hidden relative cursor-pointer shadow-sm"
                       onClick={() => !imageUrl && document.getElementById('bulk-import-upload')?.click()}>
                    {imageUrl ? (
                      <div className="relative w-full h-full flex flex-col items-center justify-center bg-white">
                        {imageUrl.includes('.pdf') ? (
                          <div className="flex flex-col items-center justify-center gap-3 p-6">
                            <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                               <FileText size={32} />
                            </div>
                            <p className="font-semibold text-rose-700 text-[14px]">{t.bulkImport.pdfReady}</p>
                          </div>
                        ) : (
                          <Image src={imageUrl} alt="Document" fill className="object-contain p-2" />
                        )}
                        <button 
                           onClick={(e) => { e.stopPropagation(); setImageUrl(null); }}
                           className="absolute top-4 right-4 p-2 bg-slate-900/50 text-white rounded-[8px] hover:bg-rose-500 transition-all shadow-xl z-10 backdrop-blur-md"
                           title={t.bulkImport.removeFile}
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
                              const optimizedFile = await compressImage(file, {
                                maxWidth: 1600,
                                maxHeight: 1600,
                                quality: 0.8,
                              });

                              const supabase = (await import('@/utils/supabase/client')).createClient();
                              const ext = optimizedFile.name.split('.').pop()?.toLowerCase() || 'jpeg';
                              const fileName = `bulk-import-${Date.now()}.${ext}`;
                              const filePath = `imports/${fileName}`;

                              const { data, error: uploadError } = await supabase.storage
                                .from('uploads')
                                .upload(filePath, optimizedFile);

                              if (uploadError) throw uploadError;

                              const { data: { publicUrl } } = supabase.storage
                                .from('uploads')
                                .getPublicUrl(filePath);

                              setImageUrl(publicUrl);
                            } catch (err: any) {
                              console.error("Bulk upload failed:", err);
                              setError(err.message || t.bulkImport.uploadError);
                            }
                          }}
                        />
                        <div className="w-14 h-14 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 shadow-sm transition-all duration-300">
                          <UploadCloud size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-[14.5px] font-bold text-indigo-900">{t.bulkImport.dropzoneText}</p>
                          <p className="text-[12.5px] text-indigo-400 font-medium mt-1">{t.bulkImport.supportedFormats}</p>
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
                  disabled={
                    importMode === "excel"
                      ? !excelFile
                      : importMode === "text"
                      ? !rawText.trim()
                      : !imageUrl
                  }
                  className={`px-7 py-3 text-white text-[14.5px] font-semibold rounded-[10px] hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2 ${
                    importMode === "excel"
                      ? "bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200"
                      : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200"
                  }`}
                >
                  {importMode === "excel" ? (
                    <>
                      <FileSpreadsheet size={18} />
                      <span>Analyser le fichier Excel (.xlsx)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>{t.students.modal.startExtraction}</span>
                    </>
                  )}
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
                <h3 className="text-[18px] font-bold text-[#181d26]">{t.bulkImport.analyzingAi}</h3>
                <p className="text-[14px] text-indigo-600/80 font-medium mt-1.5">{t.bulkImport.analyzingAiSubtitle}</p>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-bold text-[#181d26]">{t.bulkImport.reviewTitle}</h3>
                  <p className="text-[13.5px] text-indigo-600/80 font-medium">{t.bulkImport.reviewSubtitle}</p>
                </div>
                <div className="px-4 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[13px] font-bold shadow-sm">
                  {t.bulkImport.studentCount.replace("{count}", String(parsedData.length))}
                </div>
              </div>

              <div className="border border-slate-200 rounded-[12px] overflow-hidden shadow-sm bg-white">
                <div className="max-h-[300px] overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 text-[13px] font-semibold text-slate-500">المعرف التربوي</th>
                        <th className="px-5 py-3.5 text-[13px] font-semibold text-slate-500">{t.bulkImport.studentName}</th>
                        <th className="px-5 py-3.5 text-[13px] font-semibold text-slate-500">{t.bulkImport.gender}</th>
                        <th className="px-5 py-3.5 text-[13px] font-semibold text-slate-500">Niveau</th>
                        <th className="px-5 py-3.5 text-[13px] font-semibold text-slate-500 text-right">Classe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedData.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 text-[13px] font-mono font-bold text-blue-700">
                            {s.nationalId ? (
                              <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                                🆔 {s.nationalId}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-[13.5px] font-semibold text-[#181d26]">{s.name} {s.surname || ""}</td>
                          <td className="px-5 py-4 text-[13px]">
                             <span className={`px-2.5 py-1 rounded-[6px] font-semibold text-[11px] uppercase tracking-wider ${s.sex === "MALE" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"}`}>
                                {s.sex === "MALE" ? "ذكر" : "أنثى"}
                             </span>
                          </td>
                          <td className="px-5 py-4 text-[13px] font-semibold text-slate-700">
                            Niveau {s.levelId || selectedLevel}
                          </td>
                          <td className="px-5 py-4 text-[13px] font-semibold text-slate-600 text-right">
                            {s.classId ? (
                              `#${s.classId}`
                            ) : (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                                Non classé
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-[10px] flex items-start gap-2.5 shadow-sm">
                  <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[13.5px] font-medium text-rose-700">{error}</p>
                </div>
              )}

              <div className="flex justify-between pt-5 border-t border-slate-200 mt-2">
                <button
                  onClick={() => setStep("input")}
                  className="px-6 py-2.5 bg-white text-slate-600 border border-slate-300 text-[14px] font-semibold rounded-[8px] hover:bg-slate-50 transition-colors"
                >
                  {t.bulkImport.back}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="px-8 py-2.5 bg-indigo-600 text-white text-[14px] font-semibold rounded-[8px] hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  {t.bulkImport.enrollStudents}
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
                <h3 className="text-[20px] font-bold text-[#181d26]">{t.bulkImport.successTitle}</h3>
                <p className="text-[14px] text-emerald-600 font-medium mt-1">{t.bulkImport.successStudentDetail.replace("{count}", String(parsedData.length))}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
