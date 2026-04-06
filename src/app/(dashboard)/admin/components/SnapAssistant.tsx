"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Minus, Maximize2, Camera } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getChatResponse } from '../actions/aiActions';
import { executeAICommand } from '../actions/crudActions';
import { useRouter } from 'next/navigation';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

interface SnapAssistantProps {
  context: any;
}

const SnapAssistant: React.FC<SnapAssistantProps> = ({ context }) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm **SnapAssistant**. I now have **AI-Vision**: you can upload receipts or tuition slips and I will automatically process them for you. How can I help today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, selectedImage]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage = input.trim();
    const imageBase64 = selectedImage ? selectedImage.split(',')[1] : undefined;

    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage || "Sent an image for analysis.",
      image: selectedImage || undefined 
    }]);

    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    const result = await getChatResponse(userMessage, context, imageBase64);

    if (result.response) {
      setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
      
      // HANDLE AI COMMANDS
      if (result.command) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚙️ *Processing Action: ${result.command.type}...*` }]);
        const cmdResult = await executeAICommand(result.command);
        if (cmdResult.success) {
          setMessages(prev => [...prev, { role: 'assistant', content: `✅ **Success**: ${cmdResult.message}` }]);
          router.refresh();
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: `❌ **Error**: ${cmdResult.error}` }]);
        }
      }
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: result.error || "I'm sorry, I'm having trouble connecting right now." }]);
    }

    setIsLoading(false);
  };

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
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-black tracking-tight text-lg leading-none">SnapAssistant</h3>
                  <p className="text-indigo-100/70 text-[10px] font-black uppercase tracking-widest mt-1">AI Intelligence Layer</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white" />
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
                  placeholder={selectedImage ? "Describe this image..." : "Ask SnapAssistant..."}
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
                Powered by Gemini 1.5 Flash • Context Aware
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="p-5 bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-full shadow-2xl shadow-indigo-200 border-4 border-white flex items-center justify-center group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        {isOpen ? <Minus className="w-7 h-7 relative z-10" /> : <MessageCircle className="w-7 h-7 relative z-10" />}
      </motion.button>
    </div>
  );
};

export default SnapAssistant;
