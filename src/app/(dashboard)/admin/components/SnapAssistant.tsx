"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Minus, Maximize2, Camera } from 'lucide-react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { getChatResponse, upsertConversation, isAIQuotaReached } from '../actions/aiActions';
import { executeAICommand } from '../actions/crudActions';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { Lock, CheckCircle, AlertTriangle, Trash2, Settings, Receipt, HandCoins, LineChart, Megaphone, Check } from 'lucide-react';
import { AICommand } from '../actions/crudActions';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  command?: AICommand;
  commands?: AICommand[];
  commandExecuted?: boolean;
  executedCommandIndices?: number[];
}

interface SnapAssistantProps {
  context: any;
  fullPage?: boolean;
  initialOpen?: boolean;
  onNewChat?: () => void;
  onUsageUpdate?: () => void;
  initialMessages?: Message[];
  activeSessionId?: string;
  month?: number;
  year?: number;
}

const SnapAssistant: React.FC<SnapAssistantProps> = ({ 
  context, 
  fullPage = false,
  initialOpen = false,
  onNewChat,
  onUsageUpdate,
  initialMessages = [],
  activeSessionId = "new",
  month = new Date().getMonth() + 1,
  year = new Date().getFullYear()
}) => {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(initialOpen || fullPage);
  const [isLocked, setIsLocked] = useState(false);
  const [quota, setQuota] = useState(10);
  const [pendingCommandId, setPendingCommandId] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleConfirmCommand = async (msgIndex: number, commandIndex?: number) => {
    const msg = messages[msgIndex];
    const targetCommand = typeof commandIndex === 'number' ? msg.commands?.[commandIndex] : msg.command;
    if (!targetCommand || isExecuting) return;

    setIsExecuting(true);
    // Track which specific card is loading
    setPendingCommandId(msgIndex); 

    try {
      // Find the last image in history if needed for the command
      let imgUrl = msg.image;
      if (!imgUrl) {
         const lastWithImage = [...messages.slice(0, msgIndex + 1)].reverse().find(m => m.image);
         imgUrl = lastWithImage?.image;
      }
      
      const finalCommand = {
        ...targetCommand,
        type: targetCommand.type.toUpperCase().trim() as any,
        data: {
          ...targetCommand.data,
          img: imgUrl || targetCommand.data.img
        }
      };

      const res = await executeAICommand(finalCommand);
      
      if (res.success) {
        setMessages(prev => {
          const newMsgs = [...prev];
          const currentMsg = { ...newMsgs[msgIndex] };
          
          if (typeof commandIndex === 'number') {
            const executed = currentMsg.executedCommandIndices || [];
            currentMsg.executedCommandIndices = [...executed, commandIndex];
          } else {
            currentMsg.commandExecuted = true;
          }
          
          newMsgs[msgIndex] = currentMsg;
          return [...newMsgs, { role: 'assistant', content: `✅ **${t.zbiba.success}**: ${res.message}` }];
        });
        router.refresh();
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ **${t.zbiba.error}**: ${res.error}` }]);
      }
    } catch (err: any) {
      console.error("Action confirmation error:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ **Error**: Execution failed. ${err.message || ""}` }]);
    } finally {
      setIsExecuting(false);
      setPendingCommandId(null);
    }
  };

  const handleCancelCommand = (msgIndex: number, commandIndex?: number) => {
    setMessages(prev => {
      const newMsgs = [...prev];
      const currentMsg = { ...newMsgs[msgIndex] };

      if (typeof commandIndex === 'number') {
        const executed = currentMsg.executedCommandIndices || [];
        currentMsg.executedCommandIndices = [...executed, commandIndex];
      } else {
        currentMsg.commandExecuted = true;
      }

      newMsgs[msgIndex] = currentMsg;
      return [...newMsgs, { role: 'assistant', content: locale === "fr" ? "L'action a été annulée." : "Action has been cancelled." }];
    });
  };

  useEffect(() => {
    // Quota reached logic disabled for now
    setIsLocked(false);
    /*
    isAIQuotaReached().then(reached => {
      if (reached) {
        setIsLocked(true);
      }
    });
    */
  }, []);
  
  // Initialize with initialMessages if provided, otherwise the welcome message
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length > 0 
      ? initialMessages 
      : [{ role: 'assistant', content: t.zbiba.welcome }]
  );
  
  const [currentSessionId, setCurrentSessionId] = useState(activeSessionId);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const compressImage = (dataUrl: string, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = dataUrl;
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, selectedImage]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setSelectedImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if (isLocked || (!input.trim() && !selectedImage) || isLoading) return;

    const userMessage = input.trim();
    const currentImage = selectedImage; // Store locally for this async operation
    const imageBase64 = currentImage ? currentImage.split(',')[1] : undefined;

    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage || "Sent an image for analysis.",
      image: currentImage || undefined 
    }]);

    setInput('');
    setIsLoading(true);

    let uploadedUrl: string | undefined = undefined;
    if (currentImage) {
      try {
        const fetchRes = await fetch(currentImage);
        const blob = await fetchRes.blob();
        
        // Supabase Storage Upload
        const supabase = (await import('@/utils/supabase/client')).createClient();
        const fileExt = 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `assistant/${fileName}`;

        const { data, error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);
            
          uploadedUrl = publicUrl;
          
          // Update the message we just added with the Supabase URL
          setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs.length > 0) {
              const last = newMsgs[newMsgs.length - 1];
              if (last.role === 'user' && last.image?.startsWith('data:')) {
                last.image = uploadedUrl;
              }
            }
            return newMsgs;
          });
        }
      } catch (error: any) {
        console.error("Supabase upload error:", error);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `❌ **Error**: ${error.message || "Upload failed. Please try again."}` 
        }]);
      }
    }

    try {
      // Enrich context with current month/year view
      const enrichedContext = {
        ...context,
        currentPeriod: { month, year }
      };

      const result = await getChatResponse(userMessage, enrichedContext, imageBase64, locale, messages);

      if (result.response) {
        // ... success logic ...
        if (onUsageUpdate) onUsageUpdate();
        const userMsgObj: Message = { 
          role: 'user', 
          content: userMessage || "Sent an image for analysis.",
          image: uploadedUrl || undefined 
        };
        const assistantMsgObj: Message = { 
          role: 'assistant', 
          content: result.response,
          command: result.command,
          commands: result.commands
        };
        
        const newMessages = [...messages, userMsgObj, assistantMsgObj];

        setMessages(newMessages);

        // PERSIST TO DATABASE
        const saveRes = await upsertConversation({
          id: currentSessionId === "new" ? undefined : currentSessionId,
          title: currentSessionId === "new" ? (userMessage.substring(0, 30) + "...") : "Continued Conversation",
          messages: newMessages,
          month,
          year
        });

        if (saveRes.success && saveRes.conversation) {
          if (currentSessionId === "new") {
            setCurrentSessionId(saveRes.conversation.id);
            if (!fullPage) router.refresh(); // Refresh sidebar in mini-mode
          }
        }
        
        // HANDLE AI COMMANDS (Legacy check, primarily handles single commands if emitted)
        if (result.command && result.command.type) {
          // ... legacy block handled by unified commands array above
        }
      } else {
        if (result.error?.startsWith("DAILY_QUOTA_REACHED")) {
          const quota = result.error.split("|")[1] || "10";
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `✨ **Limite Quotidienne Atteinte** (${quota}/${quota})\n\nZbiba a besoin de plus d'énergie pour continuer ses analyses stratégiques aujourd'hui. \n\n🚀 **Passez à SnapSchool Premium** pour débloquer :\n- ⚡️ Analyses illimitées 24/7\n- 📊 Rapports financiers avancés\n- 🛡️ Support Prioritaire\n\n[Cliquez sur "Passer à Premium" dans la barre latérale pour continuer !]` 
          }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: result.error || "I'm sorry, I'm having trouble connecting right now." }]);
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "❌ **Error**: Connection failed." }]);
    }

    setIsLoading(false);
    setSelectedImage(null); // Clear only AFTER everything is done
  };

  if (fullPage) {
    return (
      <div className="w-full h-full bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col relative">
        {isLocked && (
          <div className="absolute inset-0 z-50 bg-white/20 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
             <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white mb-6 shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50">
                <Lock size={32} />
             </div>
             <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-4">Intelligence Limitée</h3>
             <p className="text-base font-bold text-slate-500 leading-relaxed mb-8 max-w-sm">
                Vous avez utilisé vos **{quota} messages** quotidiens. <br/>
                Débloquez la puissance illimitée de Zbiba avec le plan **Premium**.
             </p>
             <button className="px-10 py-5 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-3xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 font-black flex items-center gap-3 active:scale-95">
                <Sparkles size={20} />
                Passer à Premium
             </button>
          </div>
        )}
        {/* Header - Clean & Minimal */}
        <div className="bg-white p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 relative">
              <Image 
                src={isLoading ? "/zbiba-thinking.png" : selectedImage ? "/zbiba-reports.png" : "/zbiba.png"} 
                alt="zbiba" 
                fill
                className={`object-cover ${isLoading ? 'animate-pulse' : ''}`} 
              />
            </div>
            <div>
              <h3 className="text-slate-900 font-black tracking-tight text-2xl leading-none">zbiba</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Intelligence Opérationnelle</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">En Ligne</span>
              </div>
          </div>
        </div>

        {/* Chat Area - Immersive Slate BG */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 scroll-smooth bg-slate-50/20 relative">
          <div className={isLocked ? 'blur-md select-none pointer-events-none grayscale-[0.5]' : ''}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[75%] p-5 rounded-[28px] text-base leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-xl shadow-indigo-100' 
                      : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none shadow-sm shadow-slate-200/50'
                  }`}
                >
                  <div className="prose prose-indigo prose-sm max-w-none font-medium custom-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                      </ReactMarkdown>
                      {m.image && (
                        <div className="mt-4 rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative min-h-[200px]">
                          <Image src={m.image} alt="Uploaded" fill className="object-contain bg-slate-50" />
                        </div>
                      )}
                      {m.command && !m.commandExecuted && (
                        <ActionCard 
                          command={m.command}
                          locale={locale}
                          isLoading={isExecuting && pendingCommandId === i}
                          isExecuted={!!m.commandExecuted}
                          onConfirm={() => handleConfirmCommand(i)}
                          onCancel={() => handleCancelCommand(i)}
                        />
                      )}
                      
                      {/* BATCH COMMANDS SUPPORT */}
                      {m.commands && m.commands.length > 0 && (
                        <div className="flex flex-col gap-4 mt-4">
                          {m.commands.map((cmd, cmdIdx) => {
                            const isExecuted = m.executedCommandIndices?.includes(cmdIdx);
                            if (isExecuted) return null;
                            return (
                              <ActionCard 
                                key={cmdIdx}
                                command={cmd}
                                locale={locale}
                                isLoading={isExecuting && pendingCommandId === i}
                                isExecuted={false}
                                onConfirm={() => handleConfirmCommand(i, cmdIdx)}
                                onCancel={() => handleCancelCommand(i, cmdIdx)}
                              />
                            );
                          })}
                        </div>
                      )}
                  </div>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-5 rounded-[28px] rounded-tl-none border border-slate-100 shadow-sm flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area - Centered & Premium */}
        <div className="p-8 bg-white border-t border-slate-50">
          <div className="max-w-4xl mx-auto">
            {selectedImage && (
              <div className="mb-4 relative inline-block group">
                <div className="relative rounded-2xl overflow-hidden border-4 border-indigo-500 shadow-2xl w-32 h-32">
                  <Image src={selectedImage} alt="Preview" fill className="object-cover" />
                </div>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-2 shadow-xl hover:bg-rose-600 transition-colors z-10"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            
            <div className="relative flex items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-slate-100 flex items-center justify-center shrink-0 group active:scale-90"
              >
                <Camera size={28} className="group-hover:scale-110 transition-transform" />
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={isLocked}
                  placeholder={isLocked ? "Limite atteinte..." : selectedImage ? t.zbiba.describeImage : t.zbiba.askZbiba}
                  className="w-full p-5 pr-20 bg-slate-50/50 border-2 border-transparent focus:border-indigo-500/10 focus:bg-white rounded-[30px] text-lg focus:ring-8 focus:ring-indigo-500/5 transition-all placeholder:text-slate-400 font-bold disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-4 bg-indigo-600 text-white rounded-[22px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all"
                >
                  <Send size={24} />
                </button>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em] mt-6 text-center">
            {t.zbiba.poweredBy} • {t.zbiba.contextAware}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-[380px] h-[550px] bg-white/90 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/20 overflow-hidden flex flex-col relative"
          >
            {isLocked && (
              <div className="absolute inset-x-0 bottom-0 top-[88px] z-50 bg-white/20 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white mb-4 shadow-xl shadow-indigo-200 ring-8 ring-indigo-50">
                    <Lock size={20} />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tighter mb-2">Limite Atteinte</h3>
                <p className="text-[11px] font-bold text-slate-500 leading-relaxed mb-6 max-w-[220px]">
                    Vous avez utilisé vos **{quota} messages**. <br/> Passez à **Premium** pour continuer.
                </p>
                <button className="px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-black active:scale-95">
                    Mode Premium
                </button>
              </div>
            )}
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-white/40 rounded-2xl blur-sm opacity-25"></div>
                  <div className="relative w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-inner overflow-hidden border border-white/50">
                    <Image 
                      src={isLoading ? "/zbiba-thinking.png" : selectedImage ? "/zbiba-reports.png" : "/zbiba.png"} 
                      alt="zbiba" 
                      fill
                      className={`object-cover ${isLoading ? 'animate-pulse' : ''}`} 
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-white font-black tracking-tight text-lg leading-none">zbiba</h3>
                  <p className="text-indigo-100/70 text-[10px] font-black uppercase tracking-widest mt-1">AI Intelligence Layer</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors group"
              >
                <X className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scroll-smooth relative">
              <div className={isLocked ? 'blur-sm select-none pointer-events-none grayscale-[0.5]' : ''}>
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: m.role === 'user' ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] p-4 rounded-[24px] text-sm leading-relaxed ${
                        m.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-100' 
                          : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'
                      }`}
                    >
                      <div className="prose prose-sm font-medium custom-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {m.content}
                          </ReactMarkdown>
                          {m.image && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 shadow-sm relative h-48">
                              <Image src={m.image} alt="Uploaded" fill className="object-cover" />
                            </div>
                          )}
                          {m.command && !m.commandExecuted && (
                            <ActionCard 
                              command={m.command}
                              locale={locale}
                              isLoading={isExecuting && pendingCommandId === i}
                              isExecuted={!!m.commandExecuted}
                              onConfirm={() => handleConfirmCommand(i)}
                              onCancel={() => handleCancelCommand(i)}
                              mini
                            />
                          )}

                          {m.commands && m.commands.length > 0 && (
                            <div className="flex flex-col gap-2 mt-3">
                              {m.commands.map((cmd, cmdIdx) => {
                                const isExecuted = m.executedCommandIndices?.includes(cmdIdx);
                                if (isExecuted) return null;
                                return (
                                  <ActionCard 
                                    key={cmdIdx}
                                    command={cmd}
                                    locale={locale}
                                    isLoading={isExecuting && pendingCommandId === i}
                                    isExecuted={false}
                                    onConfirm={() => handleConfirmCommand(i, cmdIdx)}
                                    onCancel={() => handleCancelCommand(i, cmdIdx)}
                                    mini
                                  />
                                );
                              })}
                            </div>
                          )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-indigo-50 p-4 rounded-[24px] rounded-tl-none flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-100 bg-white">
              {selectedImage && (
                <div className="mb-3 relative inline-block group">
                  <div className="relative rounded-xl overflow-hidden border-2 border-indigo-500 shadow-lg w-20 h-20">
                    <Image src={selectedImage} alt="Preview" fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                  </div>
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md hover:bg-rose-600 transition-colors z-10"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              
            <div className="relative flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-2xl transition-all shadow-sm border border-indigo-100 flex items-center justify-center shrink-0 group"
                title="Snap a photo of Receipt/Invoice"
              >
                <Camera size={22} className="group-hover:scale-110 transition-transform" />
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={selectedImage ? t.zbiba.describeImage : t.zbiba.askZbiba}
                  className="w-full p-4 pr-12 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 rounded-[22px] text-sm focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-400 font-medium"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-3 text-center">
                {t.zbiba.poweredBy}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center justify-center transition-all duration-500 ${
          isOpen 
            ? 'w-14 h-14 bg-rose-500 rounded-full' 
            : 'w-16 h-16 bg-white rounded-[24px] shadow-[0_10px_40px_-10px_rgba(79,70,229,0.4)]'
        } border border-slate-200/50 group`}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
            >
              <X size={24} className="text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative p-2 w-12 h-12"
            >
              <Image src="/zbiba.png" fill className="object-contain" alt="zbiba" />
              {/* Minimalist Live Indicator */}
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm ring-4 ring-emerald-500/20 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Sleek Tooltip */}
        {!isOpen && (
          <div className="absolute right-full mr-4 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 pointer-events-none whitespace-nowrap uppercase tracking-widest shadow-xl">
            {t.zbiba.askZbiba}
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45" />
          </div>
        )}
      </motion.button>
    </div>
  );
};

interface ActionCardProps {
  command: AICommand;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  isExecuted: boolean;
  locale: string;
  mini?: boolean;
}

const ActionCard: React.FC<ActionCardProps> = ({ 
  command, 
  onConfirm, 
  onCancel, 
  isLoading, 
  isExecuted,
  locale,
  mini = false
}) => {
  const getInfo = () => {
    const rawType = command.type || "UNKNOWN";
    const type = rawType.toUpperCase().trim();
    
    // Resilience: Map common hallucinations to internal keys
    const mappedType = 
       (type.includes("PAYMENT") || type.includes("PAID")) ? "MARK_PAID" :
       (type.includes("EXPENSE")) ? "ADD_EXPENSE" :
       (type.includes("INCOME")) ? "ADD_INCOME" :
       (type.includes("NOTICE") || type.includes("ANNOUNCE")) ? "POST_NOTICE" :
       (type.includes("GRADE") || type.includes("MARK") || type.includes("RESULT")) ? "RECORD_GRADES" :
       type;

    switch(mappedType) {
      case "MARK_PAID": return { icon: HandCoins, color: "emerald", label: locale === "fr" ? "Confirmer Paiement" : "Confirm Payment" };
      case "ADD_EXPENSE": return { icon: Receipt, color: "rose", label: locale === "fr" ? "Enregistrer Dépense" : "Record Expense" };
      case "ADD_INCOME": return { icon: HandCoins, color: "emerald", label: locale === "fr" ? "Enregistrer Revenu" : "Record Income" };
      case "POST_NOTICE": return { icon: Megaphone, color: "amber", label: locale === "fr" ? "Publier l'Annonce" : "Post Announcement" };
      case "RECORD_GRADES": return { icon: LineChart, color: "indigo", label: locale === "fr" ? "Enregistrer les Notes" : "Record Grades" };
      default: return { icon: Settings, color: "slate", label: `${locale === "fr" ? "Confirmer Action" : "Confirm Action"} (${rawType})` };
    }
  };

  const info = getInfo();
  const Icon = info.icon;

  if (isExecuted) return null;

  const colorMap: Record<string, string> = {
    emerald: "emerald",
    rose: "rose",
    amber: "amber",
    indigo: "indigo",
    slate: "slate"
  };

  const c = colorMap[info.color] || "slate";

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`mt-4 bg-${c}-50 border border-${c}-100 rounded-2xl p-4 shadow-sm overflow-hidden`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 bg-white rounded-xl text-${c}-600 shadow-sm border border-${c}-50`}>
          <Icon size={mini ? 16 : 20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-[10px] sm:text-xs font-black text-${c}-900 uppercase tracking-tight`}>{info.label}</h4>
          <div className="mt-2 text-[10px] sm:text-xs text-slate-600 font-medium space-y-1 overflow-hidden">
             {Object.entries(command.data).map(([key, val]: [string, any]) => (
               key !== 'img' && <div key={key} className="flex justify-between border-b border-dashed border-slate-200 pb-1 gap-2">
                 <span className="text-slate-400 capitalize shrink-0">{key}:</span>
                 <span className="font-bold truncate">{typeof val === 'object' ? JSON.stringify(val) : val}</span>
               </div>
             ))}
          </div>
          
          <div className="mt-4 flex gap-2">
            <button 
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 py-2 rounded-xl bg-${c}-600 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-${c}-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-${c}-100 disabled:opacity-50 active:scale-95`}
            >
              {isLoading ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : <Check size={14} />}
              {locale === "fr" ? "Confirmer" : "Confirm"}
            </button>
            <button 
              onClick={onCancel}
              disabled={isLoading}
              className="px-3 sm:px-4 py-2 rounded-xl bg-white text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50 active:scale-95"
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Add custom styles for markdown tables
const markdownStyles = `
  .custom-markdown table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.85rem;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #f1f5f9;
  }
  .custom-markdown th {
    background: #f8fafc;
    padding: 10px;
    text-align: left;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
  }
  .custom-markdown td {
    padding: 10px;
    border-bottom: 1px solid #f1f5f9;
    color: #64748b;
  }
  .custom-markdown tr:last-child td {
    border-bottom: none;
  }
  .custom-markdown tr:hover td {
    background: #fdfdfd;
  }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = markdownStyles;
  document.head.appendChild(style);
}

export default SnapAssistant;
