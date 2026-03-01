// ============================================================
// Animation Blueprint Wizard — 2-Step Wizard
// Phase 1 of the Animation Builder pipeline
// ============================================================

import React, { useState, useCallback, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Film,
  Loader2,
  Layers,
  LayoutGrid,
  ArrowRightLeft,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AnimationBlueprint,
  AnimationSubject,
  AnimationType,
  SceneStructure,
} from "@/types/animation";

// ── Constants ──

const SUBJECTS: { value: AnimationSubject; emoji: string; label: string }[] = [
  { value: "Physics", emoji: "⚙️", label: "Physics" },
  { value: "Mathematics", emoji: "📐", label: "Mathematics" },
  { value: "Chemistry", emoji: "🧪", label: "Chemistry" },
  { value: "Biology", emoji: "🧬", label: "Biology" },
  { value: "Custom", emoji: "🎨", label: "Custom" },
];

const ANIMATION_TYPES: {
  value: AnimationType;
  icon: React.ReactNode;
  label: string;
  desc: string;
}[] = [
  {
    value: "Process",
    icon: <Layers className="w-5 h-5" />,
    label: "Process",
    desc: "Step-by-step evolution of a concept",
  },
  {
    value: "Transformation",
    icon: <ArrowRightLeft className="w-5 h-5" />,
    label: "Transformation",
    desc: "Morphing from one form to another",
  },
  {
    value: "Comparison",
    icon: <LayoutGrid className="w-5 h-5" />,
    label: "Comparison",
    desc: "Side-by-side or sequential contrast",
  },
  {
    value: "Phenomenon",
    icon: <Eye className="w-5 h-5" />,
    label: "Phenomenon",
    desc: "Visualise a natural or abstract phenomenon",
  },
];

const SCENE_STRUCTURES: {
  value: SceneStructure;
  label: string;
  desc: string;
}[] = [
  {
    value: "single",
    label: "Single Scene",
    desc: "Everything in one continuous animation",
  },
  {
    value: "multi_scene",
    label: "Multi-Scene",
    desc: "Multiple scenes with transitions",
  },
  {
    value: "step_reveal",
    label: "Step Reveal",
    desc: "Progressive build-up, element by element",
  },
  {
    value: "before_after",
    label: "Before / After",
    desc: "Contrast two states of a system",
  },
];

const DEPTH_LABELS: Record<number, string> = {
  1: "Elementary",
  2: "Middle School",
  3: "High School",
  4: "Undergraduate",
  5: "Advanced",
  6: "Graduate",
  7: "Research",
};

// ── Helpers ──

type WizardStep = 1 | 2;

const STEP_LABELS: Record<
  WizardStep,
  { label: string; icon: React.ReactNode }
> = {
  1: { label: "Narrative Goal", icon: <Film className="w-4 h-4" /> },
  2: { label: "Scene Structure", icon: <Layers className="w-4 h-4" /> },
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

// ── Props ──

interface AnimationBlueprintWizardProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (blueprint: AnimationBlueprint) => void;
}

const AnimationBlueprintWizard: FC<AnimationBlueprintWizardProps> = ({
  open,
  onClose,
  onGenerate,
}) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [direction, setDirection] = useState(1);

  // Step 1 – Narrative Goal
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<AnimationSubject>("Physics");
  const [conceptDescription, setConceptDescription] = useState("");
  const [targetDepth, setTargetDepth] = useState(3);
  const [animationType, setAnimationType] = useState<AnimationType>("Process");

  // Step 2 – Scene Structure
  const [sceneStructure, setSceneStructure] =
    useState<SceneStructure>("multi_scene");
  const [sceneCount, setSceneCount] = useState(3);

  // ── Navigation ──

  const canAdvanceStep1 =
    title.trim().length > 0 && conceptDescription.trim().length > 0;

  const canGenerate = sceneCount >= 1 && sceneCount <= 6;

  const goNext = useCallback(() => {
    if (step < 2) {
      setDirection(1);
      setStep(2);
    }
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 1) {
      setDirection(-1);
      setStep(1);
    }
  }, [step]);

  const handleGenerate = useCallback(() => {
    const blueprint: AnimationBlueprint = {
      title: title.trim(),
      subject,
      concept_description: conceptDescription.trim(),
      target_depth: targetDepth as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      animation_type: animationType,
      scene_structure: sceneStructure,
      scene_count: sceneCount,
    };
    onGenerate(blueprint);
  }, [
    title,
    subject,
    conceptDescription,
    targetDepth,
    animationType,
    sceneStructure,
    sceneCount,
    onGenerate,
  ]);

  if (!open) return null;

  // ── Render ──

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 260 }}
        className="relative w-full max-w-2xl mx-4 rounded-2xl border border-amber-400/20 dark:border-amber-500/20 bg-white dark:bg-[#1C1C2E] shadow-2xl shadow-amber-500/5 overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-400/10 dark:border-amber-500/10">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Animation Blueprint
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-white/50 hover:text-gray-600 dark:hover:text-white/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step Indicators ── */}
        <div className="flex items-center gap-3 px-6 pt-4">
          {([1, 2] as WizardStep[]).map((s) => (
            <div
              key={s}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                s === step
                  ? "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-400/30 dark:border-amber-500/30"
                  : s < step
                    ? "bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-400/20 dark:border-green-500/20"
                    : "bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30 border border-gray-200 dark:border-white/5"
              }`}
            >
              {STEP_LABELS[s].icon}
              {STEP_LABELS[s].label}
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="relative min-h-[420px] max-h-[calc(100vh-220px)] px-6 py-5 overflow-y-auto">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                    Animation Title
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Fourier Series Decomposition"
                    className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                    Subject Area
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setSubject(s.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                          subject === s.value
                            ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40"
                            : "bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/50 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                        }`}
                      >
                        <span>{s.emoji}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Concept Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                    What concept should this animation explain?
                  </label>
                  <textarea
                    value={conceptDescription}
                    onChange={(e) => setConceptDescription(e.target.value)}
                    rows={3}
                    placeholder="e.g. Show how any periodic function can be decomposed into a sum of sine and cosine waves, starting with a simple square wave..."
                    className="w-full rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500/40"
                  />
                </div>

                {/* Target Depth */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                    Target Depth:{" "}
                    <span className="text-amber-500 dark:text-amber-400">
                      {targetDepth} — {DEPTH_LABELS[targetDepth]}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={targetDepth}
                    onChange={(e) => setTargetDepth(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-white/30 mt-1">
                    <span>Elementary</span>
                    <span>Research</span>
                  </div>
                </div>

                {/* Animation Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                    Animation Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ANIMATION_TYPES.map((at) => (
                      <button
                        key={at.value}
                        onClick={() => setAnimationType(at.value)}
                        className={`flex items-start gap-2.5 p-3 rounded-xl text-left transition ${
                          animationType === at.value
                            ? "bg-amber-50 dark:bg-amber-500/15 border border-amber-400 dark:border-amber-500/40 text-amber-700 dark:text-amber-300"
                            : "bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10"
                        }`}
                      >
                        <div className="mt-0.5">{at.icon}</div>
                        <div>
                          <div className="text-sm font-medium">{at.label}</div>
                          <div className="text-xs opacity-60">{at.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Scene Structure */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/60 mb-2">
                    Scene Structure
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SCENE_STRUCTURES.map((ss) => (
                      <button
                        key={ss.value}
                        onClick={() => {
                          setSceneStructure(ss.value);
                          if (ss.value === "single") setSceneCount(1);
                          else if (ss.value === "before_after")
                            setSceneCount(2);
                          else if (sceneCount < 2) setSceneCount(3);
                        }}
                        className={`flex flex-col items-start p-3 rounded-xl text-left transition ${
                          sceneStructure === ss.value
                            ? "bg-amber-50 dark:bg-amber-500/15 border border-amber-400 dark:border-amber-500/40 text-amber-700 dark:text-amber-300"
                            : "bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10"
                        }`}
                      >
                        <div className="text-sm font-medium">{ss.label}</div>
                        <div className="text-xs opacity-60 mt-0.5">
                          {ss.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scene Count */}
                {sceneStructure !== "single" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">
                      Number of Scenes:{" "}
                      <span className="text-amber-500 dark:text-amber-400">
                        {sceneCount}
                      </span>
                    </label>
                    <input
                      type="range"
                      min={sceneStructure === "before_after" ? 2 : 2}
                      max={6}
                      value={sceneCount}
                      onChange={(e) => setSceneCount(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 dark:text-white/30 mt-1">
                      <span>
                        {sceneStructure === "before_after"
                          ? "2 (Before & After)"
                          : "2 scenes"}
                      </span>
                      <span>6 scenes</span>
                    </div>
                  </div>
                )}

                {/* Summary Preview */}
                <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-white/80">
                    Blueprint Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-gray-400 dark:text-white/40">
                      Title
                    </span>
                    <span className="text-gray-700 dark:text-white/80 truncate">
                      {title || "—"}
                    </span>
                    <span className="text-gray-400 dark:text-white/40">
                      Subject
                    </span>
                    <span className="text-gray-700 dark:text-white/80 capitalize">
                      {subject}
                    </span>
                    <span className="text-gray-400 dark:text-white/40">
                      Type
                    </span>
                    <span className="text-gray-700 dark:text-white/80 capitalize">
                      {animationType}
                    </span>
                    <span className="text-gray-400 dark:text-white/40">
                      Depth
                    </span>
                    <span className="text-gray-700 dark:text-white/80">
                      {targetDepth} — {DEPTH_LABELS[targetDepth]}
                    </span>
                    <span className="text-gray-400 dark:text-white/40">
                      Structure
                    </span>
                    <span className="text-gray-700 dark:text-white/80 capitalize">
                      {sceneStructure.replace("_", " ")}
                    </span>
                    <span className="text-gray-400 dark:text-white/40">
                      Scenes
                    </span>
                    <span className="text-gray-700 dark:text-white/80">
                      {sceneCount}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-2 line-clamp-2">
                    {conceptDescription || "No description yet."}
                  </p>
                </div>

                {/* Manim Style Note */}
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-400/10 dark:border-amber-500/10 p-3">
                  <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-600/70 dark:text-amber-300/70">
                    All animations use a 3Blue1Brown / Manim-inspired style:
                    dark background, bright colours, smooth morphing, and
                    handwriting-style reveals. The AI will generate optimal
                    visual elements for each scene.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-white/5">
          <Button
            variant="ghost"
            onClick={step === 1 ? onClose : goBack}
            className="text-gray-400 dark:text-white/50 hover:text-gray-600 dark:hover:text-white/80"
          >
            {step === 1 ? (
              "Cancel"
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </>
            )}
          </Button>

          {step === 1 ? (
            <Button
              onClick={goNext}
              disabled={!canAdvanceStep1}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold disabled:opacity-30"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-semibold disabled:opacity-30"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Create Animation
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AnimationBlueprintWizard;
