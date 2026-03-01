// ============================================================
// Timeline Editor — Drag & reorder scenes, adjust durations
// Phase 5 of the Animation Builder pipeline
// ============================================================

import React, { useCallback, type FC } from "react";
import {
  GripVertical,
  Clock,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnimationScene, VisualType } from "@/types/animation";

// ── Visual type label map ──

const VISUAL_LABELS: Record<VisualType, string> = {
  "2d_graph": "2D Graph",
  vector_field: "Vector Field",
  grid_transformation: "Grid Transform",
  particle_motion: "Particle Motion",
  wave_propagation: "Wave Propagation",
  circuit_flow: "Circuit Flow",
  custom_drawing: "Custom Drawing",
};

// ── Props ──

interface TimelineEditorProps {
  scenes: AnimationScene[];
  activeSceneIndex: number;
  onSelectScene: (index: number) => void;
  onReorderScene: (fromIndex: number, toIndex: number) => void;
  onUpdateDuration: (index: number, duration: number) => void;
  onRemoveScene: (index: number) => void;
  onAddScene: () => void;
  totalDuration: number;
}

const TimelineEditor: FC<TimelineEditorProps> = ({
  scenes,
  activeSceneIndex,
  onSelectScene,
  onReorderScene,
  onUpdateDuration,
  onRemoveScene,
  onAddScene,
  totalDuration,
}) => {
  const moveUp = useCallback(
    (i: number) => {
      if (i > 0) onReorderScene(i, i - 1);
    },
    [onReorderScene],
  );

  const moveDown = useCallback(
    (i: number) => {
      if (i < scenes.length - 1) onReorderScene(i, i + 1);
    },
    [onReorderScene, scenes.length],
  );

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm dark:shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/5">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-white/70 uppercase tracking-wider">
          Timeline
        </h3>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-white/40">
          <Clock className="w-3 h-3" />
          Total: {totalDuration}s
          {totalDuration > 90 && (
            <span className="text-red-500 dark:text-red-400 font-medium">
              (max 90s)
            </span>
          )}
        </div>
      </div>

      {/* Timeline bars */}
      <div className="px-3 py-2 space-y-1">
        {scenes.map((scene, i) => {
          const hasContent = !!(
            scene.generated_content &&
            scene.generated_content.animation_instructions.length > 0
          );
          const widthPercent =
            totalDuration > 0
              ? (scene.duration_seconds / totalDuration) * 100
              : 100 / scenes.length;

          return (
            <div
              key={scene.id}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition ${
                i === activeSceneIndex
                  ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-400 dark:border-amber-500/25"
                  : "hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent"
              }`}
              onClick={() => onSelectScene(i)}
            >
              {/* Grip */}
              <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-white/20 shrink-0" />

              {/* Scene number */}
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold shrink-0">
                {i + 1}
              </span>

              {/* Bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs text-gray-700 dark:text-white/70 truncate">
                    {scene.description
                      ? scene.description.slice(0, 30)
                      : `Scene ${i + 1}`}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-white/30">
                    {VISUAL_LABELS[scene.visual_type]}
                  </span>
                </div>
                {/* Duration bar */}
                <div className="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      hasContent
                        ? "bg-gradient-to-r from-amber-400/80 to-orange-400/80 dark:from-amber-500/60 dark:to-orange-500/60"
                        : "bg-gray-200 dark:bg-white/15"
                    }`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>

              {/* Duration label */}
              <span className="text-[10px] text-gray-400 dark:text-white/40 shrink-0 tabular-nums">
                {scene.duration_seconds}s
              </span>

              {/* Controls (visible on hover / active) */}
              <div
                className={`flex items-center gap-0.5 shrink-0 transition ${
                  i === activeSceneIndex
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveUp(i);
                  }}
                  disabled={i === 0}
                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-20 text-gray-400 dark:text-white/40"
                  title="Move up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveDown(i);
                  }}
                  disabled={i === scenes.length - 1}
                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-20 text-gray-400 dark:text-white/40"
                  title="Move down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                {scenes.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveScene(i);
                    }}
                    className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400"
                    title="Remove scene"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Scene */}
      {scenes.length < 6 && (
        <div className="px-3 pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddScene}
            className="w-full text-xs text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 border border-dashed border-gray-300 dark:border-white/10"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Scene
          </Button>
        </div>
      )}
    </div>
  );
};

export default TimelineEditor;
