// ============================================================
// Custom Module Wizard — 3-Step Curriculum Blueprint Builder
// ============================================================

import React, { useState, useCallback, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Target,
  Brain,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ConceptScope,
  LearningObjectives,
  CognitiveDesign,
  SubjectArea,
  DifficultyLevel,
  TeachingStyle,
  SocraticIntensity,
  BeautyPermission,
  TargetAgeGroup,
  WizardStep,
  NodeGraph,
} from "@/types/custom-module";

// ── Constants ──

const SUBJECTS: SubjectArea[] = [
  "Physics",
  "Mathematics",
  "Chemistry",
  "Biology",
  "Custom",
];

const DIFFICULTIES: DifficultyLevel[] = [
  "Foundational",
  "Intermediate",
  "Advanced",
  "Cross-disciplinary",
];

const TEACHING_STYLES: { value: TeachingStyle; emoji: string; desc: string }[] =
  [
    {
      value: "Concept-first",
      emoji: "📖",
      desc: "Build understanding from principles",
    },
    {
      value: "Example-first",
      emoji: "🔬",
      desc: "Start with concrete examples",
    },
    {
      value: "Simulation-first",
      emoji: "🎮",
      desc: "Interactive exploration first",
    },
    {
      value: "Problem-first",
      emoji: "🧩",
      desc: "Challenge-driven learning",
    },
  ];

const SOCRATIC_LEVELS: { value: SocraticIntensity; desc: string }[] = [
  { value: "Light", desc: "Occasional guiding questions" },
  { value: "Moderate", desc: "Regular Socratic dialogue" },
  { value: "Deep", desc: "Heavy questioning-driven discovery" },
];

const BEAUTY_LEVELS: { value: BeautyPermission; desc: string }[] = [
  { value: "Minimal", desc: "Clean, functional presentation" },
  { value: "Balanced", desc: "Rich visuals when helpful" },
  { value: "Depth-gated Cinematic", desc: "Cinematic depth at mastery" },
];

const AGE_GROUPS: TargetAgeGroup[] = [
  "Middle School",
  "High School",
  "University",
  "Adult Learner",
];

// ── Props ──

interface CustomModuleWizardProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (
    scope: ConceptScope,
    objectives: LearningObjectives,
    design: CognitiveDesign,
  ) => Promise<void>;
  isGenerating?: boolean;
}

// ── Component ──

const CustomModuleWizard: FC<CustomModuleWizardProps> = ({
  open,
  onClose,
  onGenerate,
  isGenerating = false,
}) => {
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 — Concept Scope
  const [moduleTitle, setModuleTitle] = useState("");
  const [subject, setSubject] = useState<SubjectArea>("Physics");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("Intermediate");
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [newPrereq, setNewPrereq] = useState("");
  const [duration, setDuration] = useState(60);
  const [regionalContext, setRegionalContext] = useState("");
  const [ageGroup, setAgeGroup] = useState<TargetAgeGroup>("High School");

  // Step 2 — Learning Objectives
  const [conceptualUnderstanding, setConceptualUnderstanding] = useState<
    string[]
  >(["", ""]);
  const [mathSkills, setMathSkills] = useState<string[]>([]);
  const [realWorldApps, setRealWorldApps] = useState<string[]>([]);
  const [misconceptions, setMisconceptions] = useState<string[]>([]);
  const [showMathSkills, setShowMathSkills] = useState(false);
  const [showApps, setShowApps] = useState(false);
  const [showMisconceptions, setShowMisconceptions] = useState(false);

  // Step 3 — Cognitive Design
  const [teachingStyle, setTeachingStyle] =
    useState<TeachingStyle>("Concept-first");
  const [socraticIntensity, setSocraticIntensity] =
    useState<SocraticIntensity>("Moderate");
  const [depthMin, setDepthMin] = useState(1);
  const [depthMax, setDepthMax] = useState(5);
  const [beautyPermission, setBeautyPermission] =
    useState<BeautyPermission>("Balanced");

  // ── Validation ──

  const isStep1Valid = () => {
    return moduleTitle.trim().length > 0 && duration >= 15 && duration <= 180;
  };

  const isStep2Valid = () => {
    const filled = conceptualUnderstanding.filter((s) => s.trim().length > 0);
    return filled.length >= 2;
  };

  const isStep3Valid = () => {
    return depthMin <= depthMax && depthMin >= 1 && depthMax <= 7;
  };

  // ── Handlers ──

  const addPrerequisite = () => {
    const val = newPrereq.trim();
    if (val && !prerequisites.includes(val)) {
      setPrerequisites((p) => [...p, val]);
      setNewPrereq("");
    }
  };

  const removePrerequisite = (idx: number) => {
    setPrerequisites((p) => p.filter((_, i) => i !== idx));
  };

  const updateConceptual = (idx: number, val: string) => {
    setConceptualUnderstanding((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const addConceptual = () => {
    setConceptualUnderstanding((prev) => [...prev, ""]);
  };

  const removeConceptual = (idx: number) => {
    if (conceptualUnderstanding.length <= 2) return;
    setConceptualUnderstanding((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    idx: number,
    val: string,
  ) => {
    setter((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const addListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((prev) => [...prev, ""]);
  };

  const removeListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    idx: number,
  ) => {
    setter((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    const scope: ConceptScope = {
      module_title: moduleTitle.trim(),
      subject,
      difficulty_level: difficulty,
      assumed_prerequisites: prerequisites,
      estimated_duration_minutes: duration,
      regional_context: regionalContext.trim() || undefined,
      target_age_group: ageGroup,
    };

    const objectives: LearningObjectives = {
      conceptual_understanding: conceptualUnderstanding.filter(
        (s) => s.trim().length > 0,
      ),
      mathematical_skills: mathSkills.filter((s) => s.trim().length > 0).length
        ? mathSkills.filter((s) => s.trim().length > 0)
        : undefined,
      real_world_applications: realWorldApps.filter((s) => s.trim().length > 0)
        .length
        ? realWorldApps.filter((s) => s.trim().length > 0)
        : undefined,
      common_misconceptions: misconceptions.filter((s) => s.trim().length > 0)
        .length
        ? misconceptions.filter((s) => s.trim().length > 0)
        : undefined,
    };

    const design: CognitiveDesign = {
      teaching_style: teachingStyle,
      socratic_intensity: socraticIntensity,
      allowed_depth_range: { min: depthMin, max: depthMax },
      beauty_permission: beautyPermission,
    };

    await onGenerate(scope, objectives, design);
  };

  const stepVariants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Curriculum Blueprint Wizard
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Step {step} of 3
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ── Progress Indicators ── */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    s < step
                      ? "bg-violet-600 text-white"
                      : s === step
                        ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 ring-2 ring-violet-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                  }`}
                >
                  {s < step ? "✓" : s}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    s === step
                      ? "text-violet-700 dark:text-violet-300"
                      : "text-gray-400"
                  }`}
                >
                  {s === 1 ? "Scope" : s === 2 ? "Outcomes" : "Design"}
                </span>
                {s < 3 && (
                  <div
                    className={`flex-1 h-0.5 rounded ${
                      s < step
                        ? "bg-violet-400"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Step Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            {/* ════════ STEP 1 — Concept Scope ════════ */}
            {step === 1 && (
              <motion.div
                key="step1"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-violet-500" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      What are you teaching?
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Define the scope and context of your module.
                  </p>
                </div>

                {/* Module Title */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Module Title <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={moduleTitle}
                    onChange={(e) => setModuleTitle(e.target.value)}
                    placeholder="e.g. Quantum Mechanics Foundations"
                    className="w-full"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Subject Area
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSubject(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          subject === s
                            ? "bg-violet-600 text-white shadow-sm"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Difficulty Level <span className="text-red-400">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          difficulty === d
                            ? "bg-violet-600 text-white shadow-sm"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Age Group */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Target Age Group
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AGE_GROUPS.map((g) => (
                      <button
                        key={g}
                        onClick={() => setAgeGroup(g)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          ageGroup === g
                            ? "bg-violet-600 text-white shadow-sm"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Estimated Duration (minutes){" "}
                    <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={15}
                      max={180}
                      step={5}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="flex-1 accent-violet-600"
                    />
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300 w-16 text-right">
                      {duration} min
                    </span>
                  </div>
                </div>

                {/* Prerequisites */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Assumed Prerequisites{" "}
                    <span className="text-gray-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newPrereq}
                      onChange={(e) => setNewPrereq(e.target.value)}
                      placeholder="e.g. Basic algebra"
                      onKeyDown={(e) => e.key === "Enter" && addPrerequisite()}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addPrerequisite}
                      disabled={!newPrereq.trim()}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {prerequisites.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {prerequisites.map((p, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-xs font-medium"
                        >
                          {p}
                          <button
                            onClick={() => removePrerequisite(i)}
                            className="hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Regional Context */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Regional Context{" "}
                    <span className="text-gray-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <Input
                    value={regionalContext}
                    onChange={(e) => setRegionalContext(e.target.value)}
                    placeholder="e.g. Indian education board (CBSE/ICSE)"
                    className="w-full"
                  />
                </div>
              </motion.div>
            )}

            {/* ════════ STEP 2 — Learning Outcomes ════════ */}
            {step === 2 && (
              <motion.div
                key="step2"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-violet-500" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      What should students understand by the end?
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Define at least 2 conceptual understanding objectives.
                  </p>
                </div>

                {/* Conceptual Understanding */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Conceptual Understanding{" "}
                    <span className="text-red-400">*</span>
                    <span className="text-gray-400 font-normal ml-1">
                      (min 2)
                    </span>
                  </label>
                  <div className="space-y-2">
                    {conceptualUnderstanding.map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5">
                          {idx + 1}.
                        </span>
                        <Input
                          value={val}
                          onChange={(e) =>
                            updateConceptual(idx, e.target.value)
                          }
                          placeholder={
                            idx === 0
                              ? "e.g. Understand wave-particle duality"
                              : "e.g. Explain quantum superposition"
                          }
                          className="flex-1"
                        />
                        {conceptualUnderstanding.length > 2 && (
                          <button
                            onClick={() => removeConceptual(idx)}
                            className="p-1 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addConceptual}
                      className="flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 font-medium mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add objective
                    </button>
                  </div>
                </div>

                {/* Collapsible: Mathematical Skills */}
                <CollapsibleSection
                  title="Mathematical Skills"
                  isOpen={showMathSkills}
                  onToggle={() => setShowMathSkills((v) => !v)}
                  items={mathSkills}
                  onAdd={() => addListItem(setMathSkills)}
                  onRemove={(i) => removeListItem(setMathSkills, i)}
                  onUpdate={(i, v) => updateListItem(setMathSkills, i, v)}
                  placeholder="e.g. Solve Schrödinger equation"
                />

                {/* Collapsible: Real-World Applications */}
                <CollapsibleSection
                  title="Real-World Applications"
                  isOpen={showApps}
                  onToggle={() => setShowApps((v) => !v)}
                  items={realWorldApps}
                  onAdd={() => addListItem(setRealWorldApps)}
                  onRemove={(i) => removeListItem(setRealWorldApps, i)}
                  onUpdate={(i, v) => updateListItem(setRealWorldApps, i, v)}
                  placeholder="e.g. Transistor design"
                />

                {/* Collapsible: Common Misconceptions */}
                <CollapsibleSection
                  title="Common Misconceptions"
                  isOpen={showMisconceptions}
                  onToggle={() => setShowMisconceptions((v) => !v)}
                  items={misconceptions}
                  onAdd={() => addListItem(setMisconceptions)}
                  onRemove={(i) => removeListItem(setMisconceptions, i)}
                  onUpdate={(i, v) => updateListItem(setMisconceptions, i, v)}
                  placeholder="e.g. Electrons orbit like planets"
                />
              </motion.div>
            )}

            {/* ════════ STEP 3 — Cognitive Design ════════ */}
            {step === 3 && (
              <motion.div
                key="step3"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-4 h-4 text-violet-500" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      How should Eureka teach this?
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Configure the cognitive engine for your module.
                  </p>
                </div>

                {/* Teaching Style */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Teaching Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TEACHING_STYLES.map((ts) => (
                      <button
                        key={ts.value}
                        onClick={() => setTeachingStyle(ts.value)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-all duration-200 border ${
                          teachingStyle === ts.value
                            ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20 shadow-sm"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <span className="text-xl">{ts.emoji}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {ts.value}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {ts.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Socratic Intensity */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Socratic Intensity
                  </label>
                  <div className="flex gap-2">
                    {SOCRATIC_LEVELS.map((sl) => (
                      <button
                        key={sl.value}
                        onClick={() => setSocraticIntensity(sl.value)}
                        className={`flex-1 p-3 rounded-xl text-center transition-all duration-200 border ${
                          socraticIntensity === sl.value
                            ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20 shadow-sm"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {sl.value}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {sl.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Depth Range */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Allowed Depth Range
                    <span className="text-gray-400 font-normal ml-1">
                      (1 = surface, 7 = expert)
                    </span>
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <span className="text-xs text-gray-500 block mb-1">
                        Min: {depthMin}
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={7}
                        value={depthMin}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setDepthMin(v);
                          if (v > depthMax) setDepthMax(v);
                        }}
                        className="w-full accent-violet-600"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-xs text-gray-500 block mb-1">
                        Max: {depthMax}
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={7}
                        value={depthMax}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setDepthMax(v);
                          if (v < depthMin) setDepthMin(v);
                        }}
                        className="w-full accent-violet-600"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between mt-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <span
                        key={d}
                        className={`text-xs w-6 text-center ${
                          d >= depthMin && d <= depthMax
                            ? "text-violet-600 font-bold"
                            : "text-gray-300"
                        }`}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Beauty Permission */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Beauty Permission
                  </label>
                  <div className="flex gap-2">
                    {BEAUTY_LEVELS.map((bl) => (
                      <button
                        key={bl.value}
                        onClick={() => setBeautyPermission(bl.value)}
                        className={`flex-1 p-3 rounded-xl text-center transition-all duration-200 border ${
                          beautyPermission === bl.value
                            ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20 shadow-sm"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {bl.value}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {bl.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button
                variant="ghost"
                onClick={() => setStep((s) => (s - 1) as WizardStep)}
                disabled={isGenerating}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isGenerating}>
              Cancel
            </Button>

            {step < 3 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as WizardStep)}
                disabled={
                  (step === 1 && !isStep1Valid()) ||
                  (step === 2 && !isStep2Valid())
                }
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!isStep3Valid() || isGenerating}
                className="bg-violet-600 hover:bg-violet-700 text-white min-w-[180px]"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Generate Learning Map
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Collapsible Section Sub-component ──

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  items: string[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, val: string) => void;
  placeholder: string;
}

const CollapsibleSection: FC<CollapsibleSectionProps> = ({
  title,
  isOpen,
  onToggle,
  items,
  onAdd,
  onRemove,
  onUpdate,
  placeholder,
}) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    >
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {title} <span className="text-gray-400 font-normal">(optional)</span>
      </span>
      <motion.div
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
      </motion.div>
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-3 space-y-2">
            {items.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={val}
                  onChange={(e) => onUpdate(idx, e.target.value)}
                  placeholder={placeholder}
                  className="flex-1"
                />
                <button
                  onClick={() => onRemove(idx)}
                  className="p-1 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add item
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default CustomModuleWizard;
