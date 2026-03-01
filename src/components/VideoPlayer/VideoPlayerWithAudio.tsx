import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import VideoControls from "./VideoControls";
import LanguageSelector from "./LanguageSelector";
import type {
  Language,
  LanguageMeta,
  VideoPlayerState,
  VideoPlayerProps,
} from "./types";

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────
const SYNC_INTERVAL_MS = 150;
const MAX_DRIFT_S = 0.25;
const CONTROLS_HIDE_MS = 3_000;
const SEEK_STEP = 5;
const VOLUME_STEP = 0.1;
const LS_LANG_KEY = "eureka-preferred-language";

/** Build the list of available languages for a given topic / slug. */
function buildLanguages(topic: string, slug: string): LanguageMeta[] {
  return [
    {
      code: "en",
      name: "English",
      flag: "🇬🇧",
      videoUrl: `/videos/${topic}/${slug}-en.mp4`,
      audioUrl: `/audio/${topic}/${slug}-en.mp3`,
    },
    {
      code: "hi",
      name: "हिंदी",
      flag: "🇮🇳",
      videoUrl: `/videos/${topic}/${slug}-hi.mp4`,
      audioUrl: `/audio/${topic}/${slug}-hi.mp3`,
    },
    {
      code: "sw",
      name: "Kiswahili",
      flag: "🇰🇪",
      videoUrl: `/videos/${topic}/${slug}-sw.mp4`,
      audioUrl: `/audio/${topic}/${slug}-sw.mp3`,
    },
  ];
}

const initialState: VideoPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  isFullscreen: false,
  isLoading: true,
  error: null,
  isSwitching: false,
};

// ──────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────
const VideoPlayerWithAudio: FC<VideoPlayerProps> = ({
  slug = "what-is-motion",
  topic = "motion",
  onComplete,
  onSkip,
  onProgressUpdate,
}) => {
  // ── refs ────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── derived language list ───────────────────────────────
  const languages = buildLanguages(topic, slug);

  // ── state ───────────────────────────────────────────────
  const savedLang = (localStorage.getItem(LS_LANG_KEY) ?? "en") as Language;
  const [activeLanguage, setActiveLanguage] = useState<Language>(
    languages.some((l) => l.code === savedLang) ? savedLang : "en",
  );
  const [ps, setPs] = useState<VideoPlayerState>(initialState);
  const [showControls, setShowControls] = useState(true);
  const [audioError, setAudioError] = useState(false);

  const langMeta = languages.find((l) => l.code === activeLanguage)!;

  // ── load media ──────────────────────────────────────────
  const loadMedia = useCallback(
    async (lang: Language, resumeAt = 0, wasPlaying = false) => {
      const meta = languages.find((l) => l.code === lang)!;
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video || !audio) return;

      setPs((p) => ({ ...p, isLoading: true, error: null, isSwitching: true }));
      setAudioError(false);

      // Pause current playback first
      video.pause();
      audio.pause();

      // Set sources
      video.src = meta.videoUrl;
      audio.src = meta.audioUrl;

      // Wait for metadata
      try {
        await Promise.all([
          new Promise<void>((res, rej) => {
            const ok = () => {
              video.removeEventListener("loadedmetadata", ok);
              video.removeEventListener("error", fail);
              res();
            };
            const fail = () => {
              video.removeEventListener("loadedmetadata", ok);
              video.removeEventListener("error", fail);
              rej(new Error("Video failed to load"));
            };
            if (video.readyState >= 1) {
              res();
              return;
            }
            video.addEventListener("loadedmetadata", ok);
            video.addEventListener("error", fail);
            video.load();
          }),
          new Promise<void>((res) => {
            const ok = () => {
              audio.removeEventListener("loadedmetadata", ok);
              audio.removeEventListener("error", errCb);
              res();
            };
            const errCb = () => {
              audio.removeEventListener("loadedmetadata", ok);
              audio.removeEventListener("error", errCb);
              setAudioError(true);
              res(); /* graceful – video can still play */
            };
            if (audio.readyState >= 1) {
              res();
              return;
            }
            audio.addEventListener("loadedmetadata", ok);
            audio.addEventListener("error", errCb);
            audio.load();
          }),
        ]);

        // Restore position
        const seekTo = Math.min(resumeAt, video.duration || Infinity);
        video.currentTime = seekTo;
        audio.currentTime = seekTo;

        setPs((p) => ({
          ...p,
          isLoading: false,
          isSwitching: false,
          duration: video.duration || 0,
          currentTime: seekTo,
        }));

        if (wasPlaying) {
          video.play().catch(() => {});
          audio.play().catch(() => {});
          setPs((p) => ({ ...p, isPlaying: true }));
        }
      } catch {
        setPs((p) => ({
          ...p,
          isLoading: false,
          isSwitching: false,
          error:
            "Video failed to load. Please check your connection or try again.",
        }));
      }
    },
    [languages],
  );

  // ── initial load ────────────────────────────────────────
  useEffect(() => {
    loadMedia(activeLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── video / audio event wiring ──────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setPs((p) => ({ ...p, currentTime: video.currentTime }));
      if (video.duration > 0 && onProgressUpdate) {
        onProgressUpdate((video.currentTime / video.duration) * 100);
      }
    };
    const onEnded = () => {
      // CRITICAL: also stop audio when video ends
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPs((p) => ({ ...p, isPlaying: false, currentTime: 0 }));
      onComplete?.();
    };
    const onDurationChange = () =>
      setPs((p) => ({ ...p, duration: video.duration }));

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("durationchange", onDurationChange);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("durationchange", onDurationChange);
    };
  }, [onComplete]);

  // ── audio ↔ video sync loop ─────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const v = videoRef.current;
      const a = audioRef.current;
      if (!v || !a || v.paused) return;

      // Sync playback rate
      if (a.playbackRate !== v.playbackRate) {
        a.playbackRate = v.playbackRate;
      }

      // Drift correction
      if (Math.abs(v.currentTime - a.currentTime) > MAX_DRIFT_S) {
        a.currentTime = v.currentTime;
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // ── keep audio volume in sync with state ────────────────
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = ps.volume;
    a.muted = ps.isMuted;
  }, [ps.volume, ps.isMuted]);

  // ── controls auto-hide ──────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setPs((p) => {
        if (p.isPlaying) setShowControls(false);
        return p;
      });
    }, CONTROLS_HIDE_MS);
  }, []);

  // ── playback controls ──────────────────────────────────-
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v) return;

    if (v.paused) {
      v.play().catch(() => {});
      a?.play().catch(() => {});
      setPs((p) => ({ ...p, isPlaying: true }));
    } else {
      v.pause();
      a?.pause();
      setPs((p) => ({ ...p, isPlaying: false }));
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(t, v.duration || 0));
    v.currentTime = clamped;
    if (a) a.currentTime = clamped;
    setPs((p) => ({ ...p, currentTime: clamped }));
  }, []);

  const changeVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setPs((p) => ({ ...p, volume: clamped, isMuted: clamped === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    setPs((p) => ({ ...p, isMuted: !p.isMuted }));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() =>
        setPs((p) => ({ ...p, isFullscreen: true })),
      );
    } else {
      document
        .exitFullscreen?.()
        .then(() => setPs((p) => ({ ...p, isFullscreen: false })));
    }
  }, []);

  // ── fullscreen change listener ──────────────────────────
  useEffect(() => {
    const handler = () =>
      setPs((p) => ({
        ...p,
        isFullscreen: !!document.fullscreenElement,
      }));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── language switch ─────────────────────────────────────
  const switchLanguage = useCallback(
    async (lang: Language) => {
      if (lang === activeLanguage) return;
      const wasPlaying = !videoRef.current?.paused;
      const pos = videoRef.current?.currentTime ?? 0;

      setActiveLanguage(lang);
      localStorage.setItem(LS_LANG_KEY, lang);
      await loadMedia(lang, pos, wasPlaying);
    },
    [activeLanguage, loadMedia],
  );

  // ── keyboard shortcuts ──────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only respond when this player's container (or its children) is focused
      if (
        !containerRef.current?.contains(document.activeElement) &&
        document.activeElement !== document.body
      )
        return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(ps.currentTime - SEEK_STEP);
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(ps.currentTime + SEEK_STEP);
          break;
        case "ArrowUp":
          e.preventDefault();
          changeVolume(ps.volume + VOLUME_STEP);
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume(ps.volume - VOLUME_STEP);
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    togglePlay,
    seek,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    ps.currentTime,
    ps.volume,
  ]);

  // ── retry on error ──────────────────────────────────────
  const retry = useCallback(() => {
    loadMedia(activeLanguage);
  }, [activeLanguage, loadMedia]);

  // ── render ──────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* ─── player container ────────────────────────── */}
      <div
        ref={containerRef}
        tabIndex={0}
        className="relative rounded-xl overflow-hidden bg-[#1e1b4b] group outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onMouseMove={resetHideTimer}
        onMouseLeave={() => {
          if (ps.isPlaying) setShowControls(false);
        }}
      >
        {/* 16 : 9 container */}
        <div className="relative aspect-video">
          {/* ── <video> ── */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain bg-[#1e1b4b]"
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
          />

          {/* ── hidden <audio> ── */}
          <audio ref={audioRef} preload="metadata" />

          {/* ── loading overlay ── */}
          <AnimatePresence>
            {ps.isLoading && (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1b4b]/90 z-20"
              >
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-3" />
                <p className="text-sm text-white/70">
                  {ps.isSwitching ? "Switching language…" : "Loading video…"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── error overlay ── */}
          <AnimatePresence>
            {ps.error && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1b4b]/95 z-20 p-6 text-center"
              >
                <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
                <p className="text-sm text-white/80 max-w-sm mb-4">
                  {ps.error}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={retry}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Retry
                  </button>
                  {onSkip && (
                    <button
                      onClick={onSkip}
                      className="px-4 py-2 text-white/70 hover:text-white text-sm border border-white/20 rounded-lg transition-colors"
                    >
                      Continue Without Video
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── big play button (when paused and no error/loading) ── */}
          <AnimatePresence>
            {!ps.isPlaying && !ps.isLoading && !ps.error && (
              <motion.button
                key="bigPlay"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors z-10"
                aria-label="Play video"
              >
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                  <svg
                    className="w-7 h-7 text-gray-900 ml-1"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── controls bar ── */}
          <motion.div
            initial={false}
            animate={{ opacity: showControls || !ps.isPlaying ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="z-30"
            style={{
              pointerEvents: showControls || !ps.isPlaying ? "auto" : "none",
            }}
          >
            <VideoControls
              isPlaying={ps.isPlaying}
              currentTime={ps.currentTime}
              duration={ps.duration}
              volume={ps.volume}
              isMuted={ps.isMuted}
              isFullscreen={ps.isFullscreen}
              onTogglePlay={togglePlay}
              onSeek={seek}
              onVolumeChange={changeVolume}
              onToggleMute={toggleMute}
              onToggleFullscreen={toggleFullscreen}
              onSkip={onSkip}
            />
          </motion.div>
        </div>
      </div>

      {/* ─── audio warning ───────────────────────────── */}
      {audioError && !ps.error && (
        <p className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Audio unavailable — video will play without narration. Subtitles are
          still on.
        </p>
      )}

      {/* ─── language selector ───────────────────────── */}
      <LanguageSelector
        languages={languages}
        activeLanguage={activeLanguage}
        isLoading={ps.isSwitching}
        onSelect={switchLanguage}
      />
    </div>
  );
};

export default VideoPlayerWithAudio;
