// ============================================================
// AnimationBuilder — Phases 2–8 Orchestrator
// Scene Design → AI Generation → Timeline → Narration → Preview → Publish
// ============================================================

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Loader2,
  Eye,
  Film,
  Check,
  AlertTriangle,
  Layers,
  Clock,
  Mic,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AnimationBlueprint,
  AnimationScene,
  AnimationDocument,
  GeneratedSceneContent,
  VisualType,
  SceneRenderState,
  ManimElement,
  ManimInstruction,
  CameraState,
  SceneRole,
  RevealStrategy,
} from "@/types/animation";
import { MANIM_BG } from "@/types/animation";

// Sub-components
import SceneDesigner from "./SceneDesigner";
import TimelineEditor from "./TimelineEditor";
import NarrationLayer from "./NarrationLayer";

// Renderers
import GraphAnimator from "./renderers/GraphAnimator";
import VectorFieldAnimator from "./renderers/VectorFieldAnimator";
import GridTransformAnimator from "./renderers/GridTransformAnimator";
import ParticleMotionAnimator from "./renderers/ParticleMotionAnimator";
import WavePropagationAnimator from "./renderers/WavePropagationAnimator";
import CircuitFlowAnimator from "./renderers/CircuitFlowAnimator";
import CustomDrawingAnimator from "./renderers/CustomDrawingAnimator";

// ── Types ──

type BuilderPhase = "design" | "timeline" | "narration" | "preview" | "publish";

const PHASE_ORDER: BuilderPhase[] = [
  "design",
  "timeline",
  "narration",
  "preview",
  "publish",
];

const PHASE_LABELS: Record<
  BuilderPhase,
  { label: string; icon: React.ReactNode }
> = {
  design: { label: "Scene Design", icon: <Layers className="w-4 h-4" /> },
  timeline: { label: "Timeline", icon: <Clock className="w-4 h-4" /> },
  narration: { label: "Narration", icon: <Mic className="w-4 h-4" /> },
  preview: { label: "Preview", icon: <Eye className="w-4 h-4" /> },
  publish: { label: "Publish", icon: <Send className="w-4 h-4" /> },
};

interface AnimationBuilderProps {
  blueprint: AnimationBlueprint;
  existingDoc?: AnimationDocument | null;
  onSave: (doc: Partial<AnimationDocument>) => Promise<string | null>;
  onGenerateScene: (
    blueprint: AnimationBlueprint,
    scene: AnimationScene,
  ) => Promise<GeneratedSceneContent | null>;
  onRefineNarration: (
    blueprint: AnimationBlueprint,
    scene: AnimationScene,
    rawNarration: string,
  ) => Promise<{
    refined_text: string;
    segments: any[];
    dignity_safe: boolean;
  } | null>;
  onPublish: (
    animId: string,
  ) => Promise<{ success: boolean; dignity_score?: number; errors?: string[] }>;
  onClose: () => void;
  isGenerating?: boolean;
  isSaving?: boolean;
}

// ── Helpers ──

function getDefaultSceneRole(
  index: number,
  total: number,
  strategy?: RevealStrategy,
): SceneRole {
  // equation_first_geometric must override before the default index-0 guard
  if (index === 0 && strategy === "equation_first_geometric")
    return "formalize_equation";
  if (index === 0) return "introduce_tension";
  if (index === total - 1) return "compress_insight";

  switch (strategy) {
    case "counterexample_resolution":
      if (index === 1) return "show_counterexample";
      return "build_structure";
    case "intuition_formalization":
      if (index === total - 2) return "formalize_equation";
      return "build_structure";
    case "visual_first_equation_later":
      if (index === total - 2) return "formalize_equation";
      return "build_structure";
    case "equation_first_geometric":
      // first scene is handled above; remaining scenes get build_structure
      return "build_structure";
    case "direct_demonstration":
      if (index === 1) return "highlight_invariant";
      if (index === total - 2) return "translate_representation";
      return "build_structure";
    case "comparative_contrast":
      if (index === 1) return "show_counterexample";
      if (index === total - 2) return "highlight_invariant";
      return "build_structure";
    case "gradual_constraint_build":
    default:
      if (index === total - 2) return "reveal_constraint";
      return "build_structure";
  }
}

function createEmptyScene(
  index: number,
  visualType: VisualType = "2d_graph",
  blueprint?: AnimationBlueprint,
): AnimationScene {
  const total = blueprint?.scene_count ?? 3;
  return {
    id: `scene_${Date.now()}_${index}`,
    scene_number: index + 1,
    visual_type: visualType,
    description: "",
    duration_seconds: 8,
    narration_type: "ai_narration",
    scene_role: getDefaultSceneRole(index, total, blueprint?.reveal_strategy),
    reveal_pace: "moderate",
  };
}

function getRendererForType(type: VisualType) {
  switch (type) {
    case "2d_graph":
      return GraphAnimator;
    case "vector_field":
      return VectorFieldAnimator;
    case "grid_transformation":
      return GridTransformAnimator;
    case "particle_motion":
      return ParticleMotionAnimator;
    case "wave_propagation":
      return WavePropagationAnimator;
    case "circuit_flow":
      return CircuitFlowAnimator;
    case "custom_drawing":
      return CustomDrawingAnimator;
  }
}

function buildRenderState(
  scene: AnimationScene,
  currentTime: number,
  isPlaying: boolean,
): SceneRenderState {
  const content = scene.generated_content;
  if (!content) {
    return {
      scene_id: scene.id,
      elements: [],
      instructions: [],
      camera: { center: [0, 0], zoom: 1 },
      current_time: 0,
      total_duration: scene.duration_seconds,
      is_playing: false,
      is_3d: false,
    };
  }

  return {
    scene_id: scene.id,
    elements: (content.visual_elements ?? []) as ManimElement[],
    instructions: (content.manim_sequence ?? []) as ManimInstruction[],
    camera: { center: [0, 0], zoom: 1 },
    current_time: currentTime,
    total_duration: scene.duration_seconds,
    is_playing: isPlaying,
    is_3d: false,
  };
}

// ── AnimationBuilder Component ──

const AnimationBuilder: FC<AnimationBuilderProps> = ({
  blueprint,
  existingDoc,
  onSave,
  onGenerateScene,
  onRefineNarration,
  onPublish,
  onClose,
  isGenerating = false,
  isSaving = false,
}) => {
  // ── State ──

  const [phase, setPhase] = useState<BuilderPhase>("design");
  const [scenes, setScenes] = useState<AnimationScene[]>(() => {
    if (existingDoc?.scenes?.length) return existingDoc.scenes;
    // Create empty scenes based on blueprint
    return Array.from({ length: blueprint.scene_count }, (_, i) =>
      createEmptyScene(i, "2d_graph", blueprint),
    );
  });
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [savedAnimId, setSavedAnimId] = useState<string | null>(
    existingDoc?._id ?? null,
  );
  const [generatingSceneIdx, setGeneratingSceneIdx] = useState<number | null>(
    null,
  );
  const [refiningSceneIdx, setRefiningSceneIdx] = useState<number | null>(null);

  // Preview state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewSceneIdx, setPreviewSceneIdx] = useState(0);

  // Publish state
  const [publishResult, setPublishResult] = useState<{
    success: boolean;
    dignity_score?: number;
    errors?: string[];
  } | null>(null);

  // Cognitive summary state
  const [cognitiveSummary, setCognitiveSummary] = useState<Record<
    string,
    any
  > | null>(null);
  const [cognitiveSummaryOpen, setCognitiveSummaryOpen] = useState(false);

  const activeScene = scenes[activeSceneIndex] ?? scenes[0];
  const totalDuration = scenes.reduce((s, sc) => s + sc.duration_seconds, 0);

  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const canGoNext = phaseIndex < PHASE_ORDER.length - 1;
  const canGoBack = phaseIndex > 0;

  // ── Fetch cognitive summary when entering preview phase ──
  useEffect(() => {
    if (phase !== "preview") return;

    const fetchPreviewArc = async () => {
      try {
        const res = await fetch("/api/animations/preview-arc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: blueprint.title,
            subject: blueprint.subject,
            concept: blueprint.concept_description,
            target_depth: blueprint.target_depth,
            animation_type: blueprint.animation_type,
            scene_structure: blueprint.scene_structure,
            core_tension: blueprint.core_tension || "",
            compression_goal: blueprint.compression_goal || "",
            reveal_strategy:
              blueprint.reveal_strategy || "gradual_constraint_build",
            scenes: scenes.map((s) => ({
              id: s.id,
              scene_number: s.scene_number,
              role: s.scene_role || null,
              description: s.description,
              highlight_focus: s.highlight_focus || "",
              visual_type: s.visual_type,
              duration: s.duration_seconds,
              reveal_pace: s.reveal_pace || "moderate",
              narration_type: s.narration_type,
              custom_narration: s.custom_narration || null,
            })),
          }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          setCognitiveSummary({
            tension_type: json.data.tension_profile?.tension_type,
            tension_intensity: json.data.tension_profile?.tension_intensity,
            abstraction_level: json.data.tension_profile?.abstraction_level,
            reveal_strategy: blueprint.reveal_strategy,
            depth: blueprint.target_depth,
            tension_established: scenes.some(
              (s) => s.generated_content?.tension_statement,
            ),
            inevitability_achieved: scenes.some(
              (s) => s.generated_content?.compression_achieved,
            ),
            // Derive a completion score from how many scenes have achieved compression
            inevitability_score: Math.round(
              (scenes.filter((s) => s.generated_content?.compression_achieved)
                .length /
                Math.max(scenes.length, 1)) *
                100,
            ),
            suggestions: json.data.suggestions ?? [],
            enrichments: json.data.enrichments ?? {},
            structural_arc: json.data.structural_arc,
          });
        }
      } catch {
        // Non-critical — silently fail
      }
    };

    fetchPreviewArc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]); // Only re-fetch when entering preview phase; blueprint/scenes are captured at call time

  // ── Scene Manipulation ──

  const updateScene = useCallback((idx: number, updated: AnimationScene) => {
    setScenes((prev) => prev.map((s, i) => (i === idx ? updated : s)));
  }, []);

  const reorderScene = useCallback((from: number, to: number) => {
    setScenes((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      // Re-number
      return copy.map((s, i) => ({ ...s, scene_number: i + 1 }));
    });
    setActiveSceneIndex(to);
  }, []);

  const removeScene = useCallback(
    (idx: number) => {
      setScenes((prev) => {
        const copy = prev.filter((_, i) => i !== idx);
        return copy.map((s, i) => ({ ...s, scene_number: i + 1 }));
      });
      if (activeSceneIndex >= scenes.length - 1 && activeSceneIndex > 0) {
        setActiveSceneIndex(activeSceneIndex - 1);
      }
    },
    [activeSceneIndex, scenes.length],
  );

  const addScene = useCallback(() => {
    setScenes((prev) => {
      const newScene = createEmptyScene(prev.length, "2d_graph", blueprint);
      return [...prev, newScene];
    });
  }, [blueprint]);

  // ── AI Generation ──

  const handleGenerateContent = useCallback(
    async (sceneIdx: number) => {
      setGeneratingSceneIdx(sceneIdx);
      try {
        const result = await onGenerateScene(blueprint, scenes[sceneIdx]);
        if (result) {
          setScenes((prev) =>
            prev.map((s, i) =>
              i === sceneIdx ? { ...s, generated_content: result } : s,
            ),
          );
        }
      } finally {
        setGeneratingSceneIdx(null);
      }
    },
    [blueprint, scenes, onGenerateScene],
  );

  const handleRefineNarration = useCallback(
    async (sceneIdx: number) => {
      const sc = scenes[sceneIdx];
      const rawText =
        sc.generated_content?.narration_text ?? sc.custom_narration ?? "";
      if (!rawText) return;

      setRefiningSceneIdx(sceneIdx);
      try {
        const result = await onRefineNarration(blueprint, sc, rawText);
        if (result) {
          setScenes((prev) =>
            prev.map((s, i) =>
              i === sceneIdx
                ? {
                    ...s,
                    generated_content: s.generated_content
                      ? {
                          ...s.generated_content,
                          narration_text: result.refined_text,
                          narration_segments: result.segments,
                        }
                      : s.generated_content,
                    custom_narration:
                      s.narration_type === "custom_text"
                        ? result.refined_text
                        : s.custom_narration,
                  }
                : s,
            ),
          );
        }
      } finally {
        setRefiningSceneIdx(null);
      }
    },
    [blueprint, scenes, onRefineNarration],
  );

  const handleUpdateNarration = useCallback(
    (sceneIdx: number, text: string) => {
      setScenes((prev) =>
        prev.map((s, i) =>
          i === sceneIdx
            ? {
                ...s,
                custom_narration: text,
                generated_content: s.generated_content
                  ? { ...s.generated_content, narration_text: text }
                  : s.generated_content,
              }
            : s,
        ),
      );
    },
    [],
  );

  // ── Save ──

  const handleSave = useCallback(async () => {
    const doc: Partial<AnimationDocument> = {
      blueprint,
      scenes,
      total_duration: totalDuration,
      status: "draft",
    };
    if (savedAnimId) doc._id = savedAnimId;
    const id = await onSave(doc);
    if (id) setSavedAnimId(id);
  }, [blueprint, scenes, totalDuration, savedAnimId, onSave]);

  // ── Publish ──

  const handlePublish = useCallback(async () => {
    // Save first
    await handleSave();
    if (!savedAnimId) return;
    const result = await onPublish(savedAnimId);
    setPublishResult(result);
  }, [handleSave, savedAnimId, onPublish]);

  // ── Preview Controls ──

  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const resetPreview = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setPreviewSceneIdx(0);
  }, []);

  // ── Active Renderer ──

  const previewScene =
    phase === "preview" ? (scenes[previewSceneIdx] ?? scenes[0]) : activeScene;

  const renderState = useMemo(
    () =>
      buildRenderState(
        previewScene,
        currentTime,
        isPlaying && (phase === "preview" || phase === "design"),
      ),
    [previewScene, currentTime, isPlaying, phase],
  );

  const Renderer = getRendererForType(previewScene.visual_type);

  // ── Render ──

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0D0D1A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-white/5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-[#0D0D1A]/80 dark:to-[#0D0D1A]/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/5 text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition"
          >
            <X className="w-4 h-4" />
          </button>
          <Film className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white/90 truncate max-w-xs">
            {blueprint.title || "Untitled Animation"}
          </h1>
        </div>

        {/* Phase indicators */}
        <div className="flex items-center gap-1">
          {PHASE_ORDER.map((p, i) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                p === phase
                  ? "bg-amber-500 text-white dark:bg-amber-500/15 dark:text-amber-400 border border-amber-500 dark:border-amber-500/30"
                  : i < phaseIndex
                    ? "bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400/60 border border-green-200 dark:border-green-500/15"
                    : "text-gray-400 dark:text-white/25 border border-transparent hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              {PHASE_LABELS[p].icon}
              <span className="hidden md:inline">{PHASE_LABELS[p].label}</span>
            </button>
          ))}
        </div>

        {/* Save + Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 text-xs"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            Save
          </Button>

          <div className="w-px h-4 bg-gray-200 dark:bg-white/10" />

          <Button
            variant="ghost"
            size="sm"
            disabled={!canGoBack}
            onClick={() => setPhase(PHASE_ORDER[phaseIndex - 1])}
            className="text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 disabled:opacity-20 text-xs px-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {canGoNext && (
            <Button
              size="sm"
              onClick={() => setPhase(PHASE_ORDER[phaseIndex + 1])}
              className="bg-amber-500 hover:bg-amber-600 dark:bg-amber-500/80 dark:hover:bg-amber-500 text-white text-xs px-3 h-8"
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Editor Panel */}
        <div className="w-[420px] border-r border-gray-200 dark:border-white/5 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <AnimatePresence mode="wait">
            {/* DESIGN PHASE */}
            {phase === "design" && (
              <motion.div
                key="design"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <h2 className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">
                  Scene Design
                </h2>
                {scenes.map((sc, i) => (
                  <SceneDesigner
                    key={sc.id}
                    scene={sc}
                    sceneIndex={i}
                    totalScenes={scenes.length}
                    blueprint={blueprint}
                    isGenerating={generatingSceneIdx === i}
                    onUpdateScene={updateScene}
                    onGenerateContent={handleGenerateContent}
                  />
                ))}

                {/* Validation Suggestions (non-blocking) */}
                {(() => {
                  const suggestions: string[] = [];
                  if (!blueprint.core_tension?.trim())
                    suggestions.push(
                      "Blueprint has no Core Tension — AI generation may lack narrative focus.",
                    );
                  if (!blueprint.compression_goal?.trim())
                    suggestions.push(
                      'No Compression Goal set — the final "aha" moment may feel weak.',
                    );
                  scenes.forEach((sc, i) => {
                    if (!sc.scene_role)
                      suggestions.push(
                        `Scene ${i + 1} has no purpose role assigned.`,
                      );
                  });
                  const lastScene = scenes[scenes.length - 1];
                  if (
                    lastScene?.scene_role &&
                    !["compress_insight", "recap", "generalize"].includes(
                      lastScene.scene_role,
                    )
                  )
                    suggestions.push(
                      `Last scene role is "${lastScene.scene_role.replace(/_/g, " ")}" — consider ending with Compress Insight or Recap.`,
                    );

                  if (suggestions.length === 0) return null;
                  return (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/15 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Suggestions
                      </div>
                      {suggestions.map((s, i) => (
                        <p
                          key={i}
                          className="text-[11px] text-amber-600/70 dark:text-amber-300/60 pl-5"
                        >
                          • {s}
                        </p>
                      ))}
                    </div>
                  );
                })()}

                {/* Depth-7 Research Banner */}
                {blueprint.target_depth >= 7 &&
                  !scenes.some((sc) =>
                    [
                      "generalize",
                      "formalize_equation",
                      "compress_insight",
                    ].includes(sc.scene_role ?? ""),
                  ) && (
                    <div className="rounded-lg bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/15 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-violet-700 dark:text-violet-400">
                            Research-level depth detected
                          </p>
                          <p className="text-[11px] text-violet-600/70 dark:text-violet-300/60 mt-0.5">
                            Research depth usually benefits from a
                            Generalization or Formalization scene.
                          </p>
                        </div>
                        {scenes.length < 6 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setScenes((prev) => {
                                const genScene = createEmptyScene(
                                  prev.length,
                                  "2d_graph",
                                  blueprint,
                                );
                                genScene.scene_role = "generalize";
                                return [...prev, genScene];
                              });
                            }}
                            className="shrink-0 text-[11px] h-7 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/10 border border-violet-300 dark:border-violet-500/20"
                          >
                            + Add Scene
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                {scenes.length < 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addScene}
                    className="w-full text-xs text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 border border-dashed border-gray-300 dark:border-white/10"
                  >
                    + Add Scene
                  </Button>
                )}
              </motion.div>
            )}

            {/* TIMELINE PHASE */}
            {phase === "timeline" && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <h2 className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">
                  Timeline & Ordering
                </h2>
                <TimelineEditor
                  scenes={scenes}
                  activeSceneIndex={activeSceneIndex}
                  onSelectScene={setActiveSceneIndex}
                  onReorderScene={reorderScene}
                  onUpdateDuration={(i, d) =>
                    updateScene(i, { ...scenes[i], duration_seconds: d })
                  }
                  onRemoveScene={removeScene}
                  onAddScene={addScene}
                  totalDuration={totalDuration}
                />

                <div className="rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-3 space-y-2">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-white/60">
                    Scene {activeSceneIndex + 1} Duration
                  </h3>
                  <input
                    type="range"
                    min={3}
                    max={20}
                    value={activeScene.duration_seconds}
                    onChange={(e) =>
                      updateScene(activeSceneIndex, {
                        ...activeScene,
                        duration_seconds: Number(e.target.value),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-white/30">
                    <span>3s</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {activeScene.duration_seconds}s
                    </span>
                    <span>20s</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* NARRATION PHASE */}
            {phase === "narration" && (
              <motion.div
                key="narration"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <h2 className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">
                  Narration
                </h2>
                {scenes.map((sc, i) => (
                  <NarrationLayer
                    key={sc.id}
                    scene={sc}
                    sceneIndex={i}
                    currentTime={i === activeSceneIndex ? currentTime : 0}
                    isRefining={refiningSceneIdx === i}
                    onUpdateNarration={handleUpdateNarration}
                    onRefineNarration={handleRefineNarration}
                  />
                ))}
              </motion.div>
            )}

            {/* PREVIEW PHASE */}
            {phase === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <h2 className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">
                  Preview
                </h2>

                {/* Scene selector */}
                <div className="space-y-1">
                  {scenes.map((sc, i) => (
                    <button
                      key={sc.id}
                      onClick={() => {
                        setPreviewSceneIdx(i);
                        setCurrentTime(0);
                        setIsPlaying(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition ${
                        i === previewSceneIdx
                          ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-400 dark:border-amber-500/25 text-amber-700 dark:text-amber-300"
                          : "hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500 dark:text-white/50 border border-transparent"
                      }`}
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                        {i + 1}
                      </span>
                      <span className="truncate">
                        {sc.description || `Scene ${i + 1}`}
                      </span>
                      <span className="ml-auto text-gray-400 dark:text-white/30 tabular-nums">
                        {sc.duration_seconds}s
                      </span>
                    </button>
                  ))}
                </div>

                {/* Playback controls */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={togglePlay}
                    className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetPreview}
                    className="text-gray-400 dark:text-white/40"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 text-[10px] text-gray-400 dark:text-white/30 text-right tabular-nums">
                    {currentTime.toFixed(1)}s / {previewScene.duration_seconds}s
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                    style={{
                      width: `${(currentTime / previewScene.duration_seconds) * 100}%`,
                    }}
                  />
                </div>

                {/* Cognitive Summary Card */}
                {cognitiveSummary && (
                  <div className="rounded-xl border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/5 overflow-hidden">
                    <button
                      onClick={() =>
                        setCognitiveSummaryOpen(!cognitiveSummaryOpen)
                      }
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                          Cognitive Summary
                        </span>
                        {cognitiveSummary.inevitability_score != null && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              cognitiveSummary.inevitability_score >= 70
                                ? "bg-green-100 dark:bg-green-500/15 text-green-600 dark:text-green-400"
                                : cognitiveSummary.inevitability_score >= 40
                                  ? "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-red-100 dark:bg-red-500/15 text-red-500 dark:text-red-400"
                            }`}
                          >
                            {cognitiveSummary.inevitability_score}%
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-violet-400 transition-transform ${
                          cognitiveSummaryOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {cognitiveSummaryOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-violet-200 dark:border-violet-500/15">
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="text-[10px]">
                            <span className="text-violet-500 dark:text-violet-400 font-medium">
                              Tension
                            </span>
                            <p className="text-gray-600 dark:text-white/50">
                              {cognitiveSummary.tension_type}
                            </p>
                          </div>
                          <div className="text-[10px]">
                            <span className="text-violet-500 dark:text-violet-400 font-medium">
                              Intensity
                            </span>
                            <p className="text-gray-600 dark:text-white/50">
                              {cognitiveSummary.tension_intensity}
                            </p>
                          </div>
                          <div className="text-[10px]">
                            <span className="text-violet-500 dark:text-violet-400 font-medium">
                              Abstraction
                            </span>
                            <p className="text-gray-600 dark:text-white/50">
                              {cognitiveSummary.abstraction_level}
                            </p>
                          </div>
                          <div className="text-[10px]">
                            <span className="text-violet-500 dark:text-violet-400 font-medium">
                              Strategy
                            </span>
                            <p className="text-gray-600 dark:text-white/50">
                              {(cognitiveSummary.reveal_strategy || "").replace(
                                /_/g,
                                " ",
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Enrichment details */}
                        {cognitiveSummary.enrichments && (
                          <div className="space-y-1.5 pt-1">
                            {cognitiveSummary.enrichments
                              .core_invariant_instruction && (
                              <div className="text-[10px]">
                                <span className="text-violet-500 dark:text-violet-400 font-medium">
                                  🔷 Core Invariant
                                </span>
                                <p className="text-gray-600 dark:text-white/50 mt-0.5">
                                  {
                                    cognitiveSummary.enrichments
                                      .core_invariant_instruction
                                  }
                                </p>
                              </div>
                            )}
                            {cognitiveSummary.enrichments
                              .misconception_instruction && (
                              <div className="text-[10px]">
                                <span className="text-violet-500 dark:text-violet-400 font-medium">
                                  ⚠️ Misconception Target
                                </span>
                                <p className="text-gray-600 dark:text-white/50 mt-0.5">
                                  {
                                    cognitiveSummary.enrichments
                                      .misconception_instruction
                                  }
                                </p>
                              </div>
                            )}
                            {cognitiveSummary.enrichments.transformation_map
                              ?.length > 0 && (
                              <div className="text-[10px]">
                                <span className="text-violet-500 dark:text-violet-400 font-medium">
                                  📍 Transformation Map
                                </span>
                                {cognitiveSummary.enrichments.transformation_map.map(
                                  (t: string, i: number) => (
                                    <p
                                      key={i}
                                      className="text-gray-600 dark:text-white/50 mt-0.5 pl-2"
                                    >
                                      • {t}
                                    </p>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Suggestions */}
                        {cognitiveSummary.suggestions?.length > 0 && (
                          <div className="text-[10px] pt-1">
                            <span className="text-amber-500 dark:text-amber-400 font-medium">
                              Suggestions
                            </span>
                            {cognitiveSummary.suggestions.map(
                              (s: string, i: number) => (
                                <p
                                  key={i}
                                  className="text-amber-600/70 dark:text-amber-300/60 mt-0.5 pl-2"
                                >
                                  • {s}
                                </p>
                              ),
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-1 text-[10px]">
                          <span
                            className={
                              cognitiveSummary.tension_established
                                ? "text-green-500 dark:text-green-400"
                                : "text-red-400"
                            }
                          >
                            {cognitiveSummary.tension_established ? "✓" : "✗"}{" "}
                            Tension
                          </span>
                          <span
                            className={
                              cognitiveSummary.inevitability_achieved
                                ? "text-green-500 dark:text-green-400"
                                : "text-red-400"
                            }
                          >
                            {cognitiveSummary.inevitability_achieved
                              ? "✓"
                              : "✗"}{" "}
                            Inevitability
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* PUBLISH PHASE */}
            {phase === "publish" && (
              <motion.div
                key="publish"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">
                  Publish Validation
                </h2>

                {/* Checklist */}
                <div className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-4 space-y-2">
                  {[
                    {
                      label: "Title set",
                      ok: !!blueprint.title.trim(),
                    },
                    {
                      label: "At least 1 scene",
                      ok: scenes.length > 0,
                    },
                    {
                      label: "All scenes have content",
                      ok: scenes.every(
                        (s) =>
                          s.generated_content &&
                          s.generated_content.key_visual_elements.length > 0,
                      ),
                    },
                    {
                      label: `Total duration ≤ 90s (${totalDuration}s)`,
                      ok: totalDuration <= 90,
                    },
                    {
                      label: "Each scene 3–20s",
                      ok: scenes.every(
                        (s) =>
                          s.duration_seconds >= 3 && s.duration_seconds <= 20,
                      ),
                    },
                  ].map((check, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {check.ok ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span
                        className={
                          check.ok
                            ? "text-gray-700 dark:text-white/70"
                            : "text-red-500 dark:text-red-300"
                        }
                      >
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Publish result */}
                {publishResult && (
                  <div
                    className={`rounded-lg p-3 text-xs ${
                      publishResult.success
                        ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-300"
                        : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-300"
                    }`}
                  >
                    {publishResult.success ? (
                      <>
                        <Check className="w-4 h-4 inline mr-1" />
                        Published successfully! Dignity score:{" "}
                        {((publishResult.dignity_score ?? 0) * 100).toFixed(0)}%
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        {publishResult.errors?.join(", ") ??
                          "Publication failed."}
                      </>
                    )}
                  </div>
                )}

                {/* Publish button */}
                <Button
                  onClick={handlePublish}
                  disabled={
                    isSaving ||
                    !scenes.every(
                      (s) =>
                        s.generated_content &&
                        s.generated_content.key_visual_elements.length > 0,
                    ) ||
                    totalDuration > 90
                  }
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-semibold disabled:opacity-30"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <Send className="w-4 h-4 mr-1.5" />
                  )}
                  Publish Animation
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Canvas Preview */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0D0D1A] p-4">
          {/* Canvas area */}
          <div
            className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/5 shadow-2xl"
            style={{ background: MANIM_BG }}
          >
            {previewScene.generated_content &&
            previewScene.generated_content.key_visual_elements.length > 0 ? (
              <Renderer
                scene={previewScene}
                renderState={renderState}
                width={760}
                height={472}
                onTimeUpdate={handleTimeUpdate}
              />
            ) : (
              <div
                className="flex items-center justify-center text-white/20 text-sm"
                style={{ width: 760, height: 472 }}
              >
                <div className="text-center space-y-2">
                  <Film className="w-8 h-8 mx-auto opacity-30" />
                  <p>Generate scene content to see the preview</p>
                </div>
              </div>
            )}

            {/* Narration overlay (preview mode) */}
            {phase === "preview" &&
              previewScene.narration_type !== "silent" &&
              previewScene.generated_content?.narration_text && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 py-4">
                  <p className="text-sm text-white/90 text-center leading-relaxed">
                    {previewScene.generated_content.narration_text}
                  </p>
                </div>
              )}
          </div>

          {/* Mini playback controls under canvas (design phase) */}
          {phase === "design" &&
            activeScene.generated_content &&
            activeScene.generated_content.key_visual_elements.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePlay}
                  className="text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                  }}
                  className="text-gray-300 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
                <div className="w-48 h-1 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 dark:bg-amber-500/50 transition-all"
                    style={{
                      width: `${(currentTime / activeScene.duration_seconds) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 dark:text-white/30 tabular-nums">
                  {currentTime.toFixed(1)}s
                </span>
              </div>
            )}
        </div>
      </div>
    </motion.div>
  );
};

export default AnimationBuilder;
