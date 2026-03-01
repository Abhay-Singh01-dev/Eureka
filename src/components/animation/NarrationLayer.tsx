// ============================================================
// Narration Layer — Display / edit narration text synced to scene
// Phase 6 of the Animation Builder pipeline
// ============================================================

import React, { useState, useCallback, type FC } from "react";
import {
  Mic,
  Type,
  VolumeX,
  Sparkles,
  Loader2,
  Edit2,
  Check,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnimationScene, NarrationSegment } from "@/types/animation";

// ── Props ──

interface NarrationLayerProps {
  scene: AnimationScene;
  sceneIndex: number;
  currentTime: number;
  isRefining: boolean;
  onUpdateNarration: (sceneIndex: number, text: string) => void;
  onRefineNarration: (sceneIndex: number) => Promise<void>;
}

const NarrationLayer: FC<NarrationLayerProps> = ({
  scene,
  sceneIndex,
  currentTime,
  isRefining,
  onUpdateNarration,
  onRefineNarration,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const narrationText =
    scene.generated_content?.narration_text ?? scene.custom_narration ?? "";

  // Build a single narration segment spanning the scene duration
  const segments: NarrationSegment[] = narrationText
    ? [
        {
          text: narrationText,
          start_time: 0,
          end_time: scene.duration_seconds,
          position: "bottom" as const,
          style: "standard" as const,
        },
      ]
    : [];

  // Find active segment based on current time
  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start_time && currentTime < seg.end_time,
  );

  const startEditing = useCallback(() => {
    setEditText(narrationText);
    setIsEditing(true);
  }, [narrationText]);

  const saveEdit = useCallback(() => {
    onUpdateNarration(sceneIndex, editText);
    setIsEditing(false);
  }, [editText, sceneIndex, onUpdateNarration]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  if (scene.narration_type === "silent") {
    return (
      <div className="rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 px-3 py-2 flex items-center gap-2 text-xs text-gray-400 dark:text-white/30">
        <VolumeX className="w-3.5 h-3.5" />
        No narration for this scene
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm dark:shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/60">
          {scene.narration_type === "ai_narration" ? (
            <Mic className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Type className="w-3.5 h-3.5 text-blue-400" />
          )}
          Narration — Scene {sceneIndex + 1}
        </div>
        <div className="flex items-center gap-1">
          {!isEditing && narrationText && (
            <button
              onClick={startEditing}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-300 dark:text-white/30 hover:text-gray-500 dark:hover:text-white/60"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}
          {scene.narration_type === "ai_narration" && narrationText && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isRefining}
              onClick={() => onRefineNarration(sceneIndex)}
              className="text-[10px] h-6 px-2 text-amber-400/70 hover:text-amber-400"
            >
              {isRefining ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-0.5" /> Refine
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500/40"
            />
            <div className="flex justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelEdit}
                className="text-xs h-7 text-gray-400 dark:text-white/40"
              >
                <RotateCcw className="w-3 h-3 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveEdit}
                className="text-xs h-7 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
              >
                <Check className="w-3 h-3 mr-1" /> Save
              </Button>
            </div>
          </div>
        ) : narrationText ? (
          <div className="space-y-1.5">
            {/* Full text with active segment highlight */}
            {segments.length > 0 ? (
              <div className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
                {segments.map((seg, i) => {
                  const isActive = seg === activeSegment;
                  return (
                    <span
                      key={i}
                      className={`transition-all duration-300 ${
                        isActive
                          ? "text-amber-600 dark:text-amber-300 font-medium"
                          : "text-gray-400 dark:text-white/50"
                      }`}
                    >
                      {seg.text}{" "}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-white/60 leading-relaxed">
                {narrationText}
              </p>
            )}

            {/* Word count */}
            <div className="text-[10px] text-gray-300 dark:text-white/25">
              {narrationText.split(/\s+/).length} words
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 dark:text-white/30 py-2 text-center">
            {scene.narration_type === "ai_narration"
              ? "Generate scene content first to get narration"
              : "Type your custom narration text"}
          </div>
        )}
      </div>
    </div>
  );
};

export default NarrationLayer;
