// ============================================================
// Scene Designer — Per-scene editor panel
// Phase 2 of the Animation Builder pipeline
// ============================================================

import React, { useState, useCallback, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Clock,
  Type,
  Focus,
  Mic,
  BarChart3,
  Wind,
  Grid3X3,
  Atom,
  Activity,
  Zap,
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AnimationScene,
  AnimationBlueprint,
  VisualType,
  NarrationType,
  GeneratedSceneContent,
} from "@/types/animation";

// ── Visual type options with icons ──

const VISUAL_TYPES: {
  value: VisualType;
  icon: React.ReactNode;
  label: string;
  desc: string;
}[] = [
  {
    value: "2d_graph",
    icon: <BarChart3 className="w-5 h-5" />,
    label: "2D Graph",
    desc: "Animated function plots, axes, curves",
  },
  {
    value: "vector_field",
    icon: <Wind className="w-5 h-5" />,
    label: "Vector Field",
    desc: "Arrow grids showing force / flow",
  },
  {
    value: "grid_transformation",
    icon: <Grid3X3 className="w-5 h-5" />,
    label: "Grid Transform",
    desc: "Matrix transformations on a 2D grid",
  },
  {
    value: "particle_motion",
    icon: <Atom className="w-5 h-5" />,
    label: "Particle Motion",
    desc: "Moving particles with trails / collisions",
  },
  {
    value: "wave_propagation",
    icon: <Activity className="w-5 h-5" />,
    label: "Wave Propagation",
    desc: "Travelling / standing waves, interference",
  },
  {
    value: "circuit_flow",
    icon: <Zap className="w-5 h-5" />,
    label: "Circuit Flow",
    desc: "Electric circuit with current animation",
  },
  {
    value: "custom_drawing",
    icon: <Pencil className="w-5 h-5" />,
    label: "Custom Drawing",
    desc: "Freeform shapes, paths, custom SVG",
  },
];

const NARRATION_TYPES: { value: NarrationType; label: string }[] = [
  { value: "ai_narration", label: "AI Generated" },
  { value: "custom_text", label: "Custom Text" },
  { value: "silent", label: "No Narration" },
];

// ── Props ──

interface SceneDesignerProps {
  scene: AnimationScene;
  sceneIndex: number;
  totalScenes: number;
  blueprint: AnimationBlueprint;
  isGenerating: boolean;
  onUpdateScene: (sceneIndex: number, updated: AnimationScene) => void;
  onGenerateContent: (sceneIndex: number) => Promise<void>;
}

const SceneDesigner: FC<SceneDesignerProps> = ({
  scene,
  sceneIndex,
  totalScenes,
  blueprint,
  isGenerating,
  onUpdateScene,
  onGenerateContent,
}) => {
  const [expanded, setExpanded] = useState(true);

  const update = useCallback(
    (patch: Partial<AnimationScene>) => {
      onUpdateScene(sceneIndex, { ...scene, ...patch });
    },
    [scene, sceneIndex, onUpdateScene],
  );

  /** Auto-fill description from blueprint if empty, then generate */
  const handleGenerateWithAI = useCallback(async () => {
    if (!scene.description.trim()) {
      // Auto-fill description from blueprint concept
      const autoDesc = `Scene ${sceneIndex + 1}: ${blueprint.concept_description.slice(0, 200)}`;
      onUpdateScene(sceneIndex, { ...scene, description: autoDesc });
    }
    onGenerateContent(sceneIndex);
  }, [scene, sceneIndex, blueprint, onUpdateScene, onGenerateContent]);

  const hasContent = !!(
    scene.generated_content &&
    scene.generated_content.animation_instructions.length > 0
  );

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm dark:shadow-none">
      {/* ── Header ── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
            {sceneIndex + 1}
          </span>
          <span className="text-sm font-medium text-gray-800 dark:text-white/80">
            Scene {sceneIndex + 1}{" "}
            {scene.description ? `— ${scene.description.slice(0, 40)}` : ""}
          </span>
          {hasContent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-500/15 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20">
              Generated
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 dark:text-white/30" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-white/30" />
        )}
      </button>

      {/* ── Body ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-white/5 pt-3">
              {/* Visual Type */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/60 mb-2">
                  <Focus className="w-3.5 h-3.5" /> Visual Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {VISUAL_TYPES.map((vt) => (
                    <button
                      key={vt.value}
                      onClick={() => update({ visual_type: vt.value })}
                      className={`flex items-start gap-2 p-2.5 rounded-lg text-left transition text-xs ${
                        scene.visual_type === vt.value
                          ? "bg-amber-50 dark:bg-amber-500/15 border border-amber-400 dark:border-amber-500/40 text-amber-700 dark:text-amber-300"
                          : "bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{vt.icon}</div>
                      <div className="min-w-0">
                        <div className="font-medium leading-tight">
                          {vt.label}
                        </div>
                        <div className="opacity-60 text-[10px] leading-tight mt-0.5 break-words">
                          {vt.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                  <Type className="w-3.5 h-3.5" /> Scene Description
                </label>
                <textarea
                  value={scene.description}
                  onChange={(e) => update({ description: e.target.value })}
                  rows={2}
                  placeholder="What should this scene show? e.g. Draw the axes, then animate a sine curve being drawn..."
                  className="w-full rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500 dark:focus:border-amber-500/40"
                />
                <Button
                  size="sm"
                  disabled={isGenerating}
                  onClick={handleGenerateWithAI}
                  className="mt-1.5 text-xs h-8 bg-amber-50 dark:bg-amber-500/10 border border-amber-400 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Generate with AI
                    </>
                  )}
                </Button>
              </div>

              {/* Duration + Highlight Focus (row) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                    <Clock className="w-3.5 h-3.5" /> Duration (sec):{" "}
                    <span className="text-amber-600 dark:text-amber-400">
                      {scene.duration_seconds}s
                    </span>
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={20}
                    value={scene.duration_seconds}
                    onChange={(e) =>
                      update({ duration_seconds: Number(e.target.value) })
                    }
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-white/30 mt-0.5">
                    <span>3s</span>
                    <span>20s</span>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                    <Focus className="w-3.5 h-3.5" /> Highlight Focus
                  </label>
                  <Input
                    value={scene.highlight_focus ?? ""}
                    onChange={(e) =>
                      update({ highlight_focus: e.target.value || undefined })
                    }
                    placeholder="e.g. the peak of the curve"
                    className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 text-sm"
                  />
                </div>
              </div>

              {/* Narration Type */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                  <Mic className="w-3.5 h-3.5" /> Narration
                </label>
                <div className="flex gap-2">
                  {NARRATION_TYPES.map((nt) => (
                    <button
                      key={nt.value}
                      onClick={() => update({ narration_type: nt.value })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        scene.narration_type === nt.value
                          ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40"
                          : "bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/40 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                      }`}
                    >
                      {nt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom narration text */}
              {scene.narration_type === "custom_text" && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5 block">
                    Custom Narration Text
                  </label>
                  <textarea
                    value={scene.custom_narration ?? ""}
                    onChange={(e) =>
                      update({ custom_narration: e.target.value })
                    }
                    rows={2}
                    placeholder="Type your narration for this scene..."
                    className="w-full rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500 dark:focus:border-amber-500/40"
                  />
                </div>
              )}

              {/* Status */}
              <div className="flex items-center pt-1">
                <div className="text-[10px] text-gray-400 dark:text-white/30">
                  {hasContent
                    ? `✓ ${scene.generated_content!.key_visual_elements?.length ?? 0} visual elements, ${scene.generated_content!.manim_sequence?.length ?? 0} instructions`
                    : "No content generated yet"}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SceneDesigner;
