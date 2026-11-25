/**
 * KrishiMitra AI — Phase 9: Voice Assistant.
 *
 * Speech input (recognition) and spoken replies (synthesis) using the
 * browser's built-in Web Speech API — no API keys, works on Chrome/Android
 * where most farmers' phones are. Locales map 1:1 to the app languages.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";

export const SPEECH_LOCALES: Record<Lang, string> = {
  kn: "kn-IN",
  en: "en-IN",
  hi: "hi-IN",
};

/* ------------------------------------------------------------------ */
/* Minimal Web Speech typings (absent from some TS DOM libs)           */
/* ------------------------------------------------------------------ */

interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  0: SRAlternative;
  isFinal: boolean;
  length: number;
}
interface SREvent {
  resultIndex: number;
  results: { length: number } & Record<number, SRResult>;
}
interface SRErrorEvent {
  error: string;
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SRInstance;

function getRecognitionCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/* ------------------------------------------------------------------ */
/* Speech recognition hook                                             */
/* ------------------------------------------------------------------ */

/**
 * Listens once per `start()`; calls `onFinal` with the recognised sentence.
 * Recreated when the language changes so the locale stays in sync.
 */
export function useSpeechRecognition(
  onFinal: (text: string) => void,
  lang: Lang,
) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SRInstance | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = SPEECH_LOCALES[lang];
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
      }
      if (final.trim()) onFinalRef.current(final.trim());
    };
    rec.onerror = (e) => {
      setError(e.error);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    setError(null);
    const rec = recRef.current;
    if (!rec) return false;
    try {
      rec.start();
      setListening(true);
      return true;
    } catch {
      /* start() throws if already started — ignore */
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  return { listening, error, start, stop, supported: speechSupported() };
}

/* ------------------------------------------------------------------ */
/* Text-to-speech (spoken replies)                                     */
/* ------------------------------------------------------------------ */

let playbackId = 0;
let keepAliveId: number | null = null;
let fallbackId: number | null = null;
let remoteTimeoutId: number | null = null;
let activeAudio: HTMLAudioElement | null = null;
let reusableAudio: HTMLAudioElement | null = null;

function matchingVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const prefix = lang.toLowerCase();
  return window.speechSynthesis
    .getVoices()
    .find((voice) => voice.lang.toLowerCase().split("-")[0] === prefix);
}

function clearSpeechTimers() {
  if (keepAliveId !== null) window.clearInterval(keepAliveId);
  if (fallbackId !== null) window.clearTimeout(fallbackId);
  if (remoteTimeoutId !== null) window.clearTimeout(remoteTimeoutId);
  keepAliveId = null;
  fallbackId = null;
  remoteTimeoutId = null;
}

function finishSpeech(id: number, onEnd?: () => void) {
  if (id !== playbackId) return;
  clearSpeechTimers();
  activeAudio = null;
  onEnd?.();
}

function subtitleDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2_500, Math.ceil(words * 430 + 1_200));
}

function finishWithTimedCaptions(text: string, id: number, onEnd?: () => void) {
  if (id !== playbackId) return;
  fallbackId = window.setTimeout(() => finishSpeech(id, onEnd), subtitleDuration(text));
}

function speakWithWebSpeech(
  text: string,
  lang: Lang,
  id: number,
  voice: SpeechSynthesisVoice | undefined,
  onEnd?: () => void,
) {
  if (id !== playbackId) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    finishWithTimedCaptions(text, id, onEnd);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? SPEECH_LOCALES[lang];
  if (voice) utterance.voice = voice;
  utterance.rate = 0.92;
  utterance.pitch = 1.0;
  utterance.onend = () => finishSpeech(id, onEnd);
  utterance.onerror = () => finishSpeech(id, onEnd);
  keepAliveId = window.setInterval(() => {
    if (id === playbackId && window.speechSynthesis.speaking) {
      window.speechSynthesis.resume();
    }
  }, 10_000);
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    clearSpeechTimers();
    finishWithTimedCaptions(text, id, onEnd);
  }
}

function sentenceChunks(text: string): string[] {
  const sentences = text.match(/[^.!?।॥]+[.!?।॥]*/gu) ?? [text];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    let remaining = sentence.trim();
    while (remaining.length > 160) {
      let cut = remaining.lastIndexOf(" ", 160);
      if (cut < 1) cut = 160;
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) chunks.push(remaining);
  }
  return chunks.length ? chunks : [text.slice(0, 160)];
}

function speakWithRemoteAudio(
  text: string,
  lang: Lang,
  id: number,
  voice: SpeechSynthesisVoice | undefined,
  onEnd?: () => void,
) {
  if (typeof Audio === "undefined") {
    if (voice || lang === "en") speakWithWebSpeech(text, lang, id, voice, onEnd);
    else finishWithTimedCaptions(text, id, onEnd);
    return;
  }
  const chunks = sentenceChunks(text);
  const audio = reusableAudio ?? new Audio();
  reusableAudio = audio;
  audio.volume = 1.0;
  audio.setAttribute("referrerpolicy", "no-referrer");
  audio.preload = "auto";
  let index = 0;
  let failed = false;

  const fallback = () => {
    if (failed || id !== playbackId) return;
    failed = true;
    if (remoteTimeoutId !== null) window.clearTimeout(remoteTimeoutId);
    remoteTimeoutId = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    activeAudio = null;
    if (voice || lang === "en") speakWithWebSpeech(text, lang, id, voice, onEnd);
    else finishWithTimedCaptions(text, id, onEnd);
  };

  let provider = 0;
  const retryOrFallback = () => {
    if (id !== playbackId || failed) return;
    if (provider === 0) {
      provider = 1;
      playCurrentChunk();
    } else {
      fallback();
    }
  };

  const playCurrentChunk = () => {
    if (id !== playbackId || failed) return;
    if (remoteTimeoutId !== null) window.clearTimeout(remoteTimeoutId);
    const client = provider === 0 ? "gtx" : "tw-ob";
    const base = provider === 0
      ? "https://translate.googleapis.com/translate_tts"
      : "https://translate.google.com/translate_tts";
    audio.src =
      `${base}?ie=UTF-8&client=${client}&tl=${lang}` +
      `&q=${encodeURIComponent(chunks[index]!)}`;
    audio.load();
    remoteTimeoutId = window.setTimeout(retryOrFallback, 18_000);
    void audio.play().catch(retryOrFallback);
  };

  const playNext = () => {
    if (id !== playbackId || failed) return;
    if (index >= chunks.length) {
      audio.onended = null;
      audio.onerror = null;
      finishSpeech(id, onEnd);
      return;
    }
    provider = 0;
    audio.onended = () => {
      if (id !== playbackId || failed) return;
      if (remoteTimeoutId !== null) window.clearTimeout(remoteTimeoutId);
      remoteTimeoutId = null;
      index += 1;
      playNext();
    };
    audio.onerror = retryOrFallback;
    activeAudio = audio;
    playCurrentChunk();
  };

  playNext();
}

export function speak(text: string, lang: Lang, onEnd?: () => void) {
  if (typeof window === "undefined" || !text.trim()) return;
  stopSpeaking();
  const id = ++playbackId;
  const voice = matchingVoice(lang);

  if (lang === "kn" || (lang === "hi" && !voice)) {
    speakWithRemoteAudio(text, lang, id, voice, onEnd);
    return;
  }
  speakWithWebSpeech(text, lang, id, voice, onEnd);
}

export function stopSpeaking() {
  playbackId += 1;
  clearSpeechTimers();
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
