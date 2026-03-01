// ──────────────────────────────────────────────────────────
// Eureka – Video Player types
// ──────────────────────────────────────────────────────────

export type Language = "en" | "hi" | "sw";

/** Per-language metadata needed to resolve media URLs. */
export interface LanguageMeta {
  code: Language;
  /** Display name shown in the selector. */
  name: string;
  /** Flag emoji for the button. */
  flag: string;
  /** Path served from /public (Vite static). */
  videoUrl: string;
  /** Path served from /public (Vite static). */
  audioUrl: string;
}

/** Internal playback state managed by VideoPlayerWithAudio. */
export interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  isLoading: boolean;
  error: string | null;
  /** True while a language switch is in flight. */
  isSwitching: boolean;
}

/** Props accepted by the root player component. */
export interface VideoPlayerProps {
  /** Base name used to resolve file paths, e.g. "what-is-motion". */
  slug: string;
  /** Topic folder under /public/videos/ and /public/audio/. */
  topic: string;
  /** Called when the video ends naturally. */
  onComplete?: () => void;
  /** Called when the user clicks "Skip". */
  onSkip?: () => void;
  /** Reports watch progress as a percentage 0-100 on each timeupdate. */
  onProgressUpdate?: (percent: number) => void;
}

/** Props accepted by VideoControls. */
export interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSkip?: () => void;
}

/** Props accepted by LanguageSelector. */
export interface LanguageSelectorProps {
  languages: LanguageMeta[];
  activeLanguage: Language;
  isLoading: boolean;
  onSelect: (lang: Language) => void;
}
