"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { CallTokenPayload } from "@/lib/call/token";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  ConnectionState,
} from "livekit-client";
import { Mic, MicOff, PhoneOff, Sparkles, ShieldCheck, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

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
  const [callState, setCallState] = useState<
    "connecting" | "active" | "speaking" | "executing" | "ending" | "ended" | "error"
  >("connecting");
  const [statusText, setStatusText] = useState("Connexion au salon vocal sécurisé...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [actionsTaken, setActionsTaken] = useState<ActionLog[]>([]);
  const [currentActionNotice, setCurrentActionNotice] = useState<string | null>(null);
  const [endSummary, setEndSummary] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0);

  // References
  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Telegram WebApp detection
  const tg = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;

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
      // Ignore outside Telegram
    }
  };

  // Setup local audio analyser for orb pulse animation
  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioVolume(Math.min(1, avg / 100));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.warn("[CallRoom] Visualizer init warning:", e);
    }
  };

  // Initialize Call Session with LiveKit WebRTC
  const startCall = useCallback(async () => {
    try {
      console.log("[Hnia Voice] Requesting LiveKit token...");
      setStatusText("Négociation du jeton LiveKit...");

      // 1. Request short-lived LiveKit token from our secure server endpoint
      const tokenRes = await fetch("/api/call/livekit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.error || "Impossible d'obtenir la session LiveKit");
      }

      const { livekitUrl, token: livekitToken, roomName } = await tokenRes.json();
      console.log("[Hnia Voice] LiveKit token received. Room:", roomName);

      setStatusText("Connexion au salon vocal...");

      // 2. Initialize LiveKit Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      roomRef.current = room;

      // 3. Register Room Event Listeners
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          console.log("[Hnia Voice UI] Remote audio track received from", participant.identity);
          const el = track.attach();
          el.autoplay = true;
          audioElRef.current = el;
          el.play().catch((playErr) => {
            console.warn("[Hnia Voice UI] Autoplay blocked, attempting user interaction play:", playErr);
          });
          console.log("[Hnia Voice UI] Remote audio attached and playback started");
          setCallState("speaking");
          setStatusText("Hnia vous répond...");
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach();
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const isHniaSpeaking = speakers.some(
          (s) => s.identity.includes("agent") || s.identity.includes("hnia")
        );
        const isUserSpeaking = speakers.some(
          (s) => s.identity.includes("admin") || s === room.localParticipant
        );

        if (isHniaSpeaking) {
          setCallState("speaking");
          setStatusText("Hnia vous répond...");
        } else if (isUserSpeaking) {
          setCallState("active");
          setStatusText("À votre écoute...");
        }
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text);
          if (data.type === "action" && data.action) {
            setActionsTaken((prev) => [data.action, ...prev]);
            setCurrentActionNotice(`✅ ${data.action.summary || data.action.name}`);
            setTimeout(() => setCurrentActionNotice(null), 4500);
            triggerHaptic("success");
          }
          if (data.type === "transcript" && data.turn) {
            transcriptRef.current.push(data.turn);
          }
        } catch (e) {
          // Ignore non-json data
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log("[Hnia Voice] Room disconnected");
        setCallState("ended");
        setStatusText("Appel terminé");
      });

      // 4. Connect to LiveKit Room
      console.log(`[Hnia Voice] Connecting to ${livekitUrl}...`);
      await room.connect(livekitUrl, livekitToken);
      console.log("[Hnia Voice] Room connection established");

      // 5. Request and Publish Microphone Track
      setStatusText("Activation du microphone...");
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log("[Hnia Voice] Local microphone published successfully");

      // Setup audio visualizer on local microphone
      const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
      if (micTrack?.mediaStream) {
        setupAudioAnalyser(micTrack.mediaStream);
      }

      setCallState("active");
      setStatusText("À votre écoute...");
      triggerHaptic("success");

      // Start duration timer
      timerIntervalRef.current = setInterval(() => {
        setDurationSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err: any) {
      console.error("[CallRoom Error]:", err);
      setCallState("error");
      const friendlyErr = err.message || "Impossible de connecter Hnia pour le moment. Réessaie dans quelques secondes.";
      setErrorMessage(friendlyErr);
      setStatusText("Erreur de connexion");
      triggerHaptic("error");
    }
  }, [token]);

  // End Call & Post Details
  const endCall = async () => {
    try {
      triggerHaptic("heavy");
      setCallState("ending");
      setStatusText("Clôture de l'appel...");

      if (roomRef.current) {
        roomRef.current.disconnect();
      }

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      // Post call details to /api/call/end
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
      setEndSummary(data.summary || "Appel clôturé avec succès.");
      setCallState("ended");
      setStatusText("Appel terminé");
      triggerHaptic("success");

      // Auto-close Telegram WebApp after 3.5 seconds
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
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (roomRef.current?.localParticipant) {
      roomRef.current.localParticipant.setMicrophoneEnabled(!nextMute);
    }
  };

  // Initialize on mount
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
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      if (roomRef.current) roomRef.current.disconnect();
    };
  }, [tg, startCall]);

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
              <span>LiveKit WebRTC Chiffré</span>
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
              : callState === "error"
              ? "border-red-500 shadow-red-500/30 bg-red-950/50"
              : "border-slate-700 shadow-none bg-slate-900"
          }`}
          style={{
            transform: callState === "active" ? `scale(${1 + audioVolume * 0.2})` : undefined,
          }}
        >
          {/* Avatar Icon */}
          <div className="text-4xl select-none">
            {callState === "executing" ? "⚡" : callState === "error" ? "⚠️" : "🧕"}
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
              : callState === "error"
              ? "bg-red-950/80 border-red-500/50 text-red-300"
              : "bg-slate-900/80 border-slate-700 text-slate-400"
          }`}
        >
          {callState === "connecting" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {callState === "active" && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          {callState === "speaking" && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />}
          {callState === "executing" && <span className="w-2 h-2 rounded-full bg-amber-400" />}
          {callState === "error" && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
          <span>{statusText}</span>
        </div>

        {/* Error message detail */}
        {errorMessage && callState === "error" && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-xs text-red-200 max-w-sm text-center">
            {errorMessage}
          </div>
        )}

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
        {callState !== "ended" && callState !== "ending" && callState !== "error" && (
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

        {callState === "error" && (
          <button
            onClick={() => {
              setCallState("connecting");
              setErrorMessage(null);
              startCall();
            }}
            className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-lg active:scale-95"
          >
            Réessayer
          </button>
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
