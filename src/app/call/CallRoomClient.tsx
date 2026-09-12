"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { CallTokenPayload } from "@/lib/call/token";
import { Mic, MicOff, PhoneOff, Sparkles, ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";

interface CallRoomClientProps {
  token: string;
  initialPayload: CallTokenPayload;
}

interface ActionLog {
  id: string;
  name: string;
  args: any;
  summary: string;
  time: string;
}

interface TranscriptTurn {
  role: "user" | "hnia";
  text: string;
  time: number;
}

export default function CallRoomClient({ token, initialPayload }: CallRoomClientProps) {
  // Connection & Call State
  const [callState, setCallState] = useState<"connecting" | "active" | "speaking" | "executing" | "ending" | "ended">("connecting");
  const [statusText, setStatusText] = useState("Connexion à Hnia...");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [actionsTaken, setActionsTaken] = useState<ActionLog[]>([]);
  const [currentActionNotice, setCurrentActionNotice] = useState<string | null>(null);
  const [endSummary, setEndSummary] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Telegram WebApp detection
  const tg = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;

  // Trigger Telegram Haptic Feedback
  const triggerHaptic = (type: "light" | "medium" | "heavy" | "success" | "error" = "medium") => {
    try {
      if (tg?.HapticFeedback) {
        if (type === "success" || type === "error") {
          tg.HapticFeedback.notificationOccurred(type);
        } else {
          tg.HapticFeedback.impactOccurred(type);
        }
      }
    } catch (e) {
      // Ignore if not in Telegram
    }
  };

  // Convert Float32Array to 16-bit PCM Buffer
  const floatTo16BitPCM = (input: Float32Array): ArrayBuffer => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output.buffer;
  };

  // Convert ArrayBuffer to Base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Convert Base64 to 24kHz AudioBuffer
  const base64ToAudioBuffer = async (audioCtx: AudioContext, base64: string): Promise<AudioBuffer> => {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Gemini Live audio is 24kHz mono PCM
    const buffer = audioCtx.createBuffer(1, float32Array.length, 24000);
    buffer.getChannelData(0).set(float32Array);
    return buffer;
  };

  // Stop currently playing model audio immediately (on interruption)
  const stopAllModelAudio = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might already be stopped
      }
    });
    activeSourcesRef.current = [];
    if (audioCtxRef.current) {
      nextPlayTimeRef.current = audioCtxRef.current.currentTime;
    }
    setCallState((prev) => (prev === "speaking" ? "active" : prev));
    setStatusText("À votre écoute...");
  }, []);

  // Handle Tool Call from Gemini Live
  const handleServerToolCall = async (toolCall: { name: string; args: any; id: string }) => {
    setCallState("executing");
    setStatusText(`Exécution : ${toolCall.name}...`);
    setCurrentActionNotice(`⚡ Exécution : ${toolCall.name}`);
    triggerHaptic("medium");

    try {
      const res = await fetch("/api/call/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          toolCall,
        }),
      });

      const data = await res.json();
      const output = data.output || { success: true };

      // Record action log
      const logEntry: ActionLog = {
        id: toolCall.id,
        name: toolCall.name,
        args: toolCall.args,
        summary: typeof output === "object" ? JSON.stringify(output).slice(0, 80) : String(output),
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      };
      setActionsTaken((prev) => [logEntry, ...prev]);
      setCurrentActionNotice(`✅ Réalisé : ${toolCall.name}`);
      setTimeout(() => setCurrentActionNotice(null), 4000);
      triggerHaptic("success");

      // Send tool response back to Gemini Live WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const toolResponseMsg = {
          toolResponse: {
            functionResponses: [
              {
                response: { output },
                id: toolCall.id,
              },
            ],
          },
        };
        wsRef.current.send(JSON.stringify(toolResponseMsg));
      }
    } catch (err: any) {
      console.error("[Call Tool Error]:", err);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            toolResponse: {
              functionResponses: [
                {
                  response: { error: err.message || "Échec de l'exécution de l'outil" },
                  id: toolCall.id,
                },
              ],
            },
          })
        );
      }
    }
  };

  // Initialize Call Session & Gemini Live WebSocket
  const startCall = useCallback(async () => {
    try {
      setStatusText("Initialisation du canal audio sécurisé...");

      // 1. Fetch Gemini session config from our backend
      const sessionRes = await fetch("/api/call/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!sessionRes.ok) {
        const errData = await sessionRes.json();
        throw new Error(errData.error || "Impossible d'obtenir la session");
      }

      const sessionConfig = await sessionRes.json();

      // 2. Setup Web Audio Context
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      nextPlayTimeRef.current = audioCtx.currentTime;

      // 3. Request Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // 4. Connect to Gemini Multimodal Live WebSocket
      const ws = new WebSocket(sessionConfig.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[CallRoom] Connected to Gemini Live WebSocket");
        // Send initial setup message with tools and prompt
        const setupMessage = {
          setup: {
            model: sessionConfig.model,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede", // Warm, clear multilingual voice
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: sessionConfig.systemInstruction }],
            },
            tools: sessionConfig.tools,
          },
        };
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = async (event) => {
        try {
          const rawText = typeof event.data === "string" ? event.data : await event.data.text();
          const response = JSON.parse(rawText);

          // A. Setup Complete
          if (response.setupComplete) {
            setCallState("active");
            setStatusText("À votre écoute...");
            triggerHaptic("success");

            // Start call duration timer
            timerIntervalRef.current = setInterval(() => {
              setDurationSeconds((sec) => sec + 1);
            }, 1000);

            // Send initial voice greeting trigger
            const initGreeting = {
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `Bonjour Hnia ! Je suis ${sessionConfig.adminName}, administrateur de ${sessionConfig.schoolName}. Je t'appelle pour faire le point sur l'école. Salue-moi brièvement en une phrase chaleureuse.`,
                      },
                    ],
                  },
                ],
                turnComplete: true,
              },
            };
            ws.send(JSON.stringify(initGreeting));
          }

          // B. Server Content (Incoming Audio or Interruption)
          if (response.serverContent) {
            const serverContent = response.serverContent;

            // Handle Interruption
            if (serverContent.interrupted) {
              console.log("[CallRoom] User interrupted Hnia");
              stopAllModelAudio();
            }

            // Handle Model Turn (Audio Stream or Tool Call)
            if (serverContent.modelTurn?.parts) {
              for (const part of serverContent.modelTurn.parts) {
                // Incoming Audio Chunk
                if (part.inlineData?.data) {
                  setCallState("speaking");
                  setStatusText("Hnia vous répond...");

                  const audioBuffer = await base64ToAudioBuffer(audioCtx, part.inlineData.data);
                  const source = audioCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(audioCtx.destination);

                  const startTime = Math.max(audioCtx.currentTime, nextPlayTimeRef.current);
                  source.start(startTime);
                  nextPlayTimeRef.current = startTime + audioBuffer.duration;

                  activeSourcesRef.current.push(source);
                  source.onended = () => {
                    activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
                    if (activeSourcesRef.current.length === 0) {
                      setCallState("active");
                      setStatusText("À votre écoute...");
                    }
                  };
                }

                // Incoming Tool Call
                if (part.functionCall) {
                  await handleServerToolCall(part.functionCall);
                }

                // Model Text Transcript
                if (part.text) {
                  transcriptRef.current.push({
                    role: "hnia",
                    text: part.text,
                    time: Date.now(),
                  });
                }
              }
            }
          }
        } catch (msgErr) {
          console.warn("[CallRoom] WebSocket message parsing issue:", msgErr);
        }
      };

      ws.onerror = (err) => {
        console.error("[CallRoom] WebSocket error:", err);
        setStatusText("Erreur de connexion audio");
      };

      ws.onclose = (event) => {
        console.log("[CallRoom] WebSocket closed:", event.code, event.reason);
      };

      // 5. Audio Input Processor (Stream 16kHz PCM to WebSocket)
      const micSource = audioCtx.createMediaStreamSource(stream);
      const scriptProcessor = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (e) => {
        if (isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate simple volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setAudioVolume(Math.min(1, rms * 5));

        // Send audio chunk if WebSocket is ready
        if (ws.readyState === WebSocket.OPEN) {
          const pcm16Buffer = floatTo16BitPCM(inputData);
          const base64Audio = arrayBufferToBase64(pcm16Buffer);

          const audioChunkMsg = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm;rate=16000",
                  data: base64Audio,
                },
              ],
            },
          };
          ws.send(JSON.stringify(audioChunkMsg));
        }
      };

      micSource.connect(scriptProcessor);
      scriptProcessor.connect(audioCtx.destination);
    } catch (err: any) {
      console.error("[CallRoom Error]:", err);
      setStatusText(`Erreur : ${err.message || "Microphone non accessible"}`);
      setCallState("ended");
    }
  }, [token, isMuted, stopAllModelAudio]);

  // End Call & Generate Telegram Summary
  const endCall = async () => {
    triggerHaptic("heavy");
    setCallState("ending");
    setStatusText("Génération du compte-rendu d'appel...");

    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // Stop mic
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Disconnect audio processors
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
    }
    stopAllModelAudio();

    // Close WebSocket cleanly
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, "User ended call");
    }

    // Post call details to /api/call/end
    try {
      const res = await fetch("/api/call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          durationSeconds,
          transcript: transcriptRef.current,
          actionsTaken,
        }),
      });

      const data = await res.json();
      setEndSummary(data.summary || "Compte-rendu envoyé avec succès sur Telegram !");
      setCallState("ended");
      setStatusText("Appel terminé • Compte-rendu envoyé sur Telegram");
      triggerHaptic("success");

      // Auto-close Telegram WebApp after 3 seconds
      setTimeout(() => {
        if (tg?.close) {
          tg.close();
        }
      }, 3500);
    } catch (err: any) {
      console.error("[Call End Error]:", err);
      setCallState("ended");
      setStatusText("Appel terminé");
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    triggerHaptic("light");
    setIsMuted((prev) => !prev);
  };

  // Initialize Telegram WebApp & Start Call on Mount
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.enableClosingConfirmation) {
        tg.enableClosingConfirmation();
      }
    }

    startCall();

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      if (wsRef.current) wsRef.current.close();
    };
  }, [tg, startCall]);

  // Format Duration (MM:SS)
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 text-white flex flex-col justify-between p-6 select-none overflow-hidden font-sans">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">{initialPayload.schoolName}</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              <span>Canal Vocal Chiffré</span>
            </div>
          </div>
        </div>

        {/* Live Timer Pill */}
        <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono tracking-wider text-slate-300">
          {formatTimer(durationSeconds)}
        </div>
      </div>

      {/* ── Center Avatar & Voice Reactive Orb ───────────────────────────────── */}
      <div className="flex flex-col items-center justify-center my-auto relative">
        {/* Concentric Glow Rings */}
        <div
          className={`absolute rounded-full transition-all duration-300 pointer-events-none ${
            callState === "speaking"
              ? "w-64 h-64 bg-indigo-500/20 animate-ping opacity-50"
              : callState === "active"
              ? "w-56 h-56 bg-emerald-500/15"
              : "w-48 h-48 bg-slate-700/10"
          }`}
        />

        <div
          className={`relative w-36 h-36 rounded-full flex items-center justify-center border-4 shadow-2xl transition-all duration-500 ${
            callState === "speaking"
              ? "border-indigo-400 shadow-indigo-500/40 scale-105 bg-gradient-to-tr from-indigo-900 via-purple-900 to-indigo-700"
              : callState === "executing"
              ? "border-amber-400 shadow-amber-500/40 animate-pulse bg-gradient-to-tr from-amber-900 to-orange-800"
              : callState === "active"
              ? "border-emerald-400 shadow-emerald-500/30 bg-gradient-to-tr from-slate-900 via-emerald-950 to-slate-900"
              : "border-slate-700 shadow-none bg-slate-900"
          }`}
          style={{
            transform: callState === "active" ? `scale(${1 + audioVolume * 0.15})` : undefined,
          }}
        >
          {/* Avatar Icon */}
          <div className="text-4xl select-none">
            {callState === "executing" ? "⚡" : "🧕"}
          </div>
        </div>

        {/* Assistant Title & Status */}
        <h1 className="text-2xl font-bold mt-5 tracking-tight text-white flex items-center gap-2">
          Hnia <span className="text-sm font-normal text-slate-400">(هنية)</span>
        </h1>
        <p className="text-xs text-indigo-300 font-medium tracking-wide uppercase mt-0.5">
          Assistante Vocale Opérationnelle
        </p>

        {/* Dynamic Status Pill */}
        <div
          className={`mt-4 px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 border transition-all ${
            callState === "speaking"
              ? "bg-indigo-950/80 border-indigo-500/50 text-indigo-200"
              : callState === "executing"
              ? "bg-amber-950/80 border-amber-500/50 text-amber-200 animate-pulse"
              : callState === "active"
              ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
              : "bg-slate-900/80 border-slate-700 text-slate-400"
          }`}
        >
          {callState === "connecting" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {callState === "active" && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          {callState === "speaking" && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />}
          {callState === "executing" && <span className="w-2 h-2 rounded-full bg-amber-400" />}
          <span>{statusText}</span>
        </div>

        {/* Live Action Notification Toast */}
        {currentActionNotice && (
          <div className="mt-3 px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 shadow-lg animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate max-w-[260px]">{currentActionNotice}</span>
          </div>
        )}

        {/* Summary Card upon Call End */}
        {callState === "ended" && endSummary && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900/95 border border-emerald-500/40 text-left max-w-sm w-full text-xs text-slate-300 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Compte-rendu envoyé sur Telegram !</span>
            </div>
            <p className="text-slate-400">
              La synthèse et le détail des actions sont maintenant disponibles dans votre chat Telegram.
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom Call Controls ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-6 pb-6 pt-2">
        {callState !== "ended" && callState !== "ending" && (
          <>
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                isMuted
                  ? "bg-amber-500 text-slate-950 shadow-amber-500/20"
                  : "bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* End Call Button (Large Red) */}
            <button
              onClick={endCall}
              className="w-18 h-18 px-7 py-4 rounded-full bg-red-600 hover:bg-red-500 active:scale-90 text-white flex items-center justify-center shadow-xl shadow-red-600/40 transition-all font-semibold gap-2"
            >
              <PhoneOff className="w-6 h-6" />
              <span className="text-sm tracking-wide">Raccrocher</span>
            </button>
          </>
        )}

        {(callState === "ended" || callState === "ending") && (
          <div className="text-center py-2">
            <p className="text-xs text-slate-400 animate-pulse">Fermeture automatique...</p>
          </div>
        )}
      </div>
    </div>
  );
}
