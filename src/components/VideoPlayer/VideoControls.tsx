import React, { useRef, useCallback, type FC } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  SkipForward,
} from "lucide-react";
import type { VideoControlsProps } from "./types";

// ── helpers ──────────────────────────────────────────────────
const fmt = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const VolumeIcon: FC<{ volume: number; muted: boolean }> = ({
  volume,
  muted,
}) => {
  if (muted || volume === 0) return <VolumeX className="w-4 h-4" />;
  if (volume < 0.5) return <Volume1 className="w-4 h-4" />;
  return <Volume2 className="w-4 h-4" />;
};

// ── component ────────────────────────────────────────────────
const VideoControls: FC<VideoControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isFullscreen,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onSkip,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // ── seek via progress bar ────────────────────────────────
  const seekFromEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      if (!bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      onSeek(pct * duration);
    },
    [duration, onSeek],
  );

  // ── drag-seek ────────────────────────────────────────────
  const startSeekDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      seekFromEvent(e);
      const onMove = (ev: MouseEvent) => {
        const bar = progressRef.current;
        if (!bar || !duration) return;
        const rect = bar.getBoundingClientRect();
        const pct = Math.max(
          0,
          Math.min(1, (ev.clientX - rect.left) / rect.width),
        );
        onSeek(pct * duration);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [duration, onSeek, seekFromEvent],
  );

  // ── volume drag ──────────────────────────────────────────
  const changeVolumeFromEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = volumeRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      onVolumeChange(pct);
    },
    [onVolumeChange],
  );

  const startVolumeDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      changeVolumeFromEvent(e);
      const onMove = (ev: MouseEvent) => {
        const bar = volumeRef.current;
        if (!bar) return;
        const rect = bar.getBoundingClientRect();
        const pct = Math.max(
          0,
          Math.min(1, (ev.clientX - rect.left) / rect.width),
        );
        onVolumeChange(pct);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onVolumeChange, changeVolumeFromEvent],
  );

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 px-3 pb-3 select-none">
      {/* ── Progress bar ───────────────────────────────── */}
      <div
        ref={progressRef}
        className="group/bar relative h-1.5 mb-2.5 cursor-pointer rounded-full bg-white/25 hover:h-2.5 transition-all"
        onMouseDown={startSeekDrag}
        role="slider"
        aria-label="Seek"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
      >
        {/* buffered / loaded */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/30"
          style={{ width: "100%" }}
        />
        {/* played */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-500"
          style={{ width: `${progressPct}%` }}
        />
        {/* thumb */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md opacity-0 group-hover/bar:opacity-100 transition-opacity"
          style={{ left: `calc(${progressPct}% - 7px)` }}
        />
      </div>

      {/* ── Button row ─────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* play / pause */}
        <button
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-colors focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        {/* volume */}
        <div className="group/vol relative flex items-center">
          <button
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-colors focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <VolumeIcon volume={volume} muted={isMuted} />
          </button>

          {/* volume slider (shows on hover) */}
          <div
            ref={volumeRef}
            className="hidden group-hover/vol:flex items-center w-20 h-1 ml-1 rounded-full bg-white/25 cursor-pointer"
            onMouseDown={startVolumeDrag}
            role="slider"
            aria-label="Volume"
            aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />
          </div>
        </div>

        {/* time */}
        <span className="text-xs text-white/70 tabular-nums ml-1">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        {/* spacer */}
        <div className="flex-1" />

        {/* skip */}
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-xs text-white/70 hover:text-white flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-2 py-1"
            aria-label="Skip video"
          >
            Skip <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}

        {/* fullscreen */}
        <button
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-colors focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

export default VideoControls;
