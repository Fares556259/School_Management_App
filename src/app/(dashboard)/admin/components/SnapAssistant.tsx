"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Minus, Maximize2, Camera } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getChatResponse } from '../actions/aiActions';
import { executeAICommand } from '../actions/crudActions';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/translations/LanguageContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

interface SnapAssistantProps {
  context: any;
  fullPage?: boolean;
  initialOpen?: boolean;
}

const SnapAssistant: React.FC<SnapAssistantProps> = ({ 
  context, 
  fullPage = false,
  initialOpen = false
}) => {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(initialOpen || fullPage);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: t.zbiba.welcome }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const compressImage = (dataUrl: string, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
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
    if ((!input.trim() && !selectedImage) || isLoading) return;

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
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', 'school');
        const uploadRes = await fetch('https://api.cloudinary.com/v1_1/dwcyl8r0k/image/upload', {
          method: 'POST',
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedUrl = uploadData.secure_url;
          
          // Update the message we just added with the Cloudinary URL
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
      } catch (err) {
        console.error("Cloudinary upload failed:", err);
      }
    }

    try {
      const result = await getChatResponse(userMessage, context, imageBase64, locale, messages);

      if (result.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
        
        // HANDLE AI COMMANDS
        if (result.command) {
          setMessages(prev => [...prev, { role: 'assistant', content: `⚙️ *${t.zbiba.processing}: ${result.command.type}...*` }]);
          
          // Attach image if we have one (either from this turn or inferred)
          if (uploadedUrl) {
            result.command.data.img = uploadedUrl;
          } else {
            // Check history for the most recent image URL if this is a confirmation turn
            const lastImageMsg = [...messages].reverse().find(m => m.image);
            if (lastImageMsg && lastImageMsg.image?.startsWith('http')) {
               result.command.data.img = lastImageMsg.image;
            }
          }

          const cmdResult = await executeAICommand(result.command);
          if (cmdResult.success) {
            setMessages(prev => [...prev, { role: 'assistant', content: `✅ **${t.zbiba.success}**: ${cmdResult.message}` }]);
            router.refresh();
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ **${t.zbiba.error}**: ${cmdResult.error}` }]);
          }
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: result.error || "I'm sorry, I'm having trouble connecting right now." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "❌ **Error**: Connection failed." }]);
    }

    setIsLoading(false);
    setSelectedImage(null); // Clear only AFTER everything is done
  };

  if (fullPage) {
    return (
      <div className="w-full h-[calc(100vh-140px)] bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        {/* Header - Fixed in Full Page */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg overflow-hidden border border-white/50">
              <img 
                src={isLoading ? "/zbiba-thinking.png" : selectedImage ? "/zbiba-reports.png" : "/zbiba.png"} 
                alt="zbiba" 
                className={`w-full h-full object-cover ${isLoading ? 'animate-pulse' : ''}`} 
              />
            </div>
            <div>
              <h3 className="text-white font-black tracking-tight text-2xl leading-none">zbiba</h3>
              <p className="text-indigo-100/70 text-xs font-black uppercase tracking-widest mt-1">Strategic AI Control Center</p>
            </div>
          </div>
        </div>

        {/* Chat Area - Flex Grow */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 scroll-smooth bg-slate-50/30">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[70%] p-5 rounded-[28px] text-base leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-xl shadow-indigo-100' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="prose prose-indigo prose-sm max-w-none font-medium">
                    <ReactMarkdown>
                        {m.content}
                    </ReactMarkdown>
                    {m.image && (
                      <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                        <img src={m.image} alt="Uploaded" className="w-full max-h-[400px] object-contain bg-slate-100" />
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

        {/* Input Area - Padded */}
        <div className="p-6 border-t border-slate-100 bg-white">
          {selectedImage && (
            <div className="mb-4 relative inline-block group">
              <div className="relative rounded-2xl overflow-hidden border-4 border-indigo-500 shadow-2xl">
                <img src={selectedImage} alt="Preview" className="h-32 w-32 object-cover" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
              </div>
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-1.5 shadow-xl hover:bg-rose-600 transition-colors z-10"
              >
                <X size={18} />
              </button>
            </div>
          )}
          
          <div className="max-w-4xl mx-auto relative flex items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-4 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-2xl transition-all shadow-md border border-indigo-100 flex items-center justify-center shrink-0 group"
              title="Upload Report/Grade Sheet"
            >
              <Camera size={26} className="group-hover:scale-110 transition-transform" />
            </button>
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={selectedImage ? t.zbiba.describeImage : t.zbiba.askZbiba}
                className="w-full p-5 pr-16 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 rounded-[26px] text-lg focus:ring-8 focus:ring-indigo-500/5 transition-all placeholder:text-slate-400 font-medium"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-3.5 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all"
              >
                <Send size={22} />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-4 text-center">
            {t.zbiba.poweredBy}
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
            className="mb-4 w-[380px] h-[550px] bg-white/90 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/20 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-white/40 rounded-2xl blur-sm opacity-25"></div>
                  <div className="relative w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-inner overflow-hidden border border-white/50">
                    <img 
                      src={isLoading ? "/zbiba-thinking.png" : selectedImage ? "/zbiba-reports.png" : "/zbiba.png"} 
                      alt="zbiba" 
                      className={`w-full h-full object-cover ${isLoading ? 'animate-pulse' : ''}`} 
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
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scroll-smooth">
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
                    <div className="prose prose-sm font-medium">
                        <ReactMarkdown>
                            {m.content}
                        </ReactMarkdown>
                        {m.image && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                            <img src={m.image} alt="Uploaded" className="w-full max-h-48 object-cover" />
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

            {/* Input Area */}
            <div className="p-4 border-t border-slate-100 bg-white">
              {selectedImage && (
                <div className="mb-3 relative inline-block group">
                  <div className="relative rounded-xl overflow-hidden border-2 border-indigo-500 shadow-lg">
                    <img src={selectedImage} alt="Preview" className="h-20 w-20 object-cover" />
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
              className="relative p-2"
            >
              <img src="/zbiba.png" className="w-12 h-12 object-contain" alt="zbiba" />
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

export default SnapAssistant;
