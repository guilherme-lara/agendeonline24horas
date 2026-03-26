import { useCallback, useRef, useEffect, useState } from "react";

const SOUND_KEY = "app_sounds_enabled";

export function useSoundFeedback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem(SOUND_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    // Create a short "ca-ching" using Web Audio API as a fallback-free approach
    // We generate a tiny inline audio to avoid external file dependencies
    if (!audioRef.current) {
      audioRef.current = new Audio();
      // Use a base64-encoded short notification chime (~0.3s)
      audioRef.current.src = "data:audio/wav;base64,UklGRlwFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTgFAAD/////AACAgP//f38AAIA/AACAP///f/8AAIA/AACAP///f/8AAIA/AAD//wAAgD8AAIA/AAB/fwAAgD8AAIA/AAB/fwAAgD8AAIA///9//wAAgD8AAIA///9//wAAgD8AAIA///9//wAAgD8AAIA///9//wAAgD8AAID///9//wAAgD8AAID///9//wAAgD8AAID///9//wAAgD8AAID///9//wAAgD8AAID///9//wAAgD8AAID///9//wAAgD8AAID///9//wAAgD8AAID///9//wAAgD8AAID///9//wAAgD8AAID///9//wAAgD8AAID//wAAAAAAgD8AAID//wAAAAAAgD8AAID//wAAAAAAgD8AAID//wAAAAAAgD8AAID//wAAAAAAgD8AAID//wAAAAAAAIA/AACA//8AAAABAACAP/8AAID//wAAAAEAAID//wAAgP//AAAAAQAAAID/AACA//8AAAABAACAAAAAAID//wAAAAEAAIAAAACA//8AAAAAAQAAAAAAAAAAAP8AAAAAAQAAAAAAAAAA/wAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      audioRef.current.volume = 0.4;
    }
  }, []);

  const toggleSound = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_KEY, String(next));
      return next;
    });
  }, []);

  const playCaching = useCallback(() => {
    if (!enabled) return;
    // Use Web Audio API for a reliable, short "ca-ching" tone
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;

      // First tone (high pitch "ca")
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1200, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.08);

      // Second tone (higher "ching")
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1800, now + 0.1);
      gain2.gain.setValueAtTime(0.4, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);

      // Third harmonic shimmer
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(2400, now + 0.12);
      gain3.gain.setValueAtTime(0.15, now + 0.12);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc3.connect(gain3).connect(ctx.destination);
      osc3.start(now + 0.12);
      osc3.stop(now + 0.4);

      setTimeout(() => ctx.close(), 500);
    } catch {
      // Fallback: try HTML audio
      audioRef.current?.play().catch(() => {});
    }
  }, [enabled]);

  return { enabled, toggleSound, playCaching };
}
