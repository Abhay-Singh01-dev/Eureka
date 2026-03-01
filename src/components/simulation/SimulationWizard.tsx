// ============================================================
// Simulation Wizard — 3-Step Blueprint Builder
// Phase 1 of the Simulation Builder pipeline
// ============================================================

import React, { useState, useCallback, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  FlaskConical,
  Gauge,
  Brain,
  Plus,
  Trash2,
  Loader2,
  BarChart3,
  Orbit,
  Hash,
  Wind,
  Zap,
  Grid3X3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  SimulationBlueprint,
  SimulationCategory,
  RendererType,
  DifficultyLevel,
  SimulationVariable,
  WizardStep1Data,
  WizardStep2Data,
  WizardStep3Data,
} from "@/types/simulation";

// ── Constants ──

const CATEGORIES: {
  value: SimulationCategory;
  emoji: string;
  label: string;
}[] = [
  { value: "mechanics", emoji: "⚙️", label: "Mechanics" },
  { value: "waves", emoji: "🌊", label: "Waves & Oscillations" },
  { value: "thermodynamics", emoji: "🔥", label: "Thermodynamics" },
  { value: "electromagnetism", emoji: "🧲", label: "Electromagnetism" },
  { value: "optics", emoji: "🔦", label: "Optics" },
  { value: "circuits", emoji: "⚡", label: "Circuits" },
  { value: "fluid_dynamics", emoji: "💧", label: "Fluid Dynamics" },
  { value: "quantum", emoji: "⚛️", label: "Quantum Mechanics" },
  { value: "chemistry", emoji: "🧪", label: "Chemistry" },
  { value: "biology", emoji: "🧬", label: "Biology" },
  { value: "mathematics", emoji: "📐", label: "Mathematics" },
  { value: "economics", emoji: "📊", label: "Economics" },
  { value: "custom", emoji: "🎨", label: "Custom" },
];

const RENDERER_TYPES: {
  value: RendererType;
  icon: React.ReactNode;
  label: string;
  desc: string;
}[] = [
  {
    value: "graph",
    icon: <BarChart3 className="w-5 h-5" />,
    label: "2D Graph",
    desc: "Line/scatter plots with interactive axes",
  },
  {
    value: "animated_object",
    icon: <Orbit className="w-5 h-5" />,
    label: "Animated Object",
    desc: "Moving objects with physics — 2D or 3D",
  },
  {
    value: "numerical_display",
    icon: <Hash className="w-5 h-5" />,
    label: "Numerical Display",
    desc: "Live gauges, counters, and readouts",
  },
  {
    value: "vector_field",
    icon: <Wind className="w-5 h-5" />,
    label: "Vector Field",
    desc: "Arrow grids showing force/velocity fields",
  },
  {
    value: "circuit_diagram",
    icon: <Zap className="w-5 h-5" />,
    label: "Circuit Diagram",
    desc: "Interactive circuit with current flow",
  },
  {
    value: "grid_transform",
    icon: <Grid3X3 className="w-5 h-5" />,
    label: "Grid Transform",
    desc: "Visual matrix / linear algebra transforms",
  },
];

const DIFFICULTIES: { value: DifficultyLevel; label: string }[] = [
  { value: "introductory", label: "Introductory" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "research", label: "Research-level" },
];

const SUBJECTS = [
  "Physics",
  "Mathematics",
  "Chemistry",
  "Biology",
  "Engineering",
  "Economics",
  "Computer Science",
  "Custom",
];

// ── Helpers ──

type WizardStep = 1 | 2 | 3;

const STEP_LABELS: Record<
  WizardStep,
  { label: string; icon: React.ReactNode }
> = {
  1: { label: "Simulation Scope", icon: <FlaskConical className="w-4 h-4" /> },
  2: { label: "Renderer & Goals", icon: <Gauge className="w-4 h-4" /> },
  3: { label: "Variables", icon: <Brain className="w-4 h-4" /> },
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

function emptyVariable(): SimulationVariable {
  return {
    name: "",
    symbol: "",
    unit: "",
    min: 0,
    max: 100,
    default_value: 50,
    step: 1,
    is_input: true,
  };
}

// ── Props ──

interface SimulationWizardProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (blueprint: SimulationBlueprint) => Promise<void>;
  isGenerating?: boolean;
}

const SimulationWizard: FC<SimulationWizardProps> = ({
  open,
  onClose,
  onGenerate,
  isGenerating = false,
}) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [direction, setDirection] = useState(1);

  // Step 1 state
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SimulationCategory>("mechanics");

  // Step 2 state
  const [rendererType, setRendererType] = useState<RendererType>("graph");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("intermediate");
  const [targetAudience, setTargetAudience] = useState("High School");
  const [learningGoal, setLearningGoal] = useState("");
  const [constraints, setConstraints] = useState("");

  // Step 3 state
  const [variables, setVariables] = useState<SimulationVariable[]>([
    emptyVariable(),
  ]);

  // ── Navigation ──

  const canAdvanceStep1 = title.trim().length > 0 && topic.trim().length > 0;
  const canAdvanceStep2 = learningGoal.trim().length > 0;
  const canGenerate =
    variables.length > 0 &&
    variables.every((v) => v.name.trim() && v.symbol.trim());

  const goNext = useCallback(() => {
    if (step < 3) {
      setDirection(1);
      setStep((s) => (s + 1) as WizardStep);
    }
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 1) {
      setDirection(-1);
      setStep((s) => (s - 1) as WizardStep);
    }
  }, [step]);

  const handleGenerate = useCallback(async () => {
    const blueprint: SimulationBlueprint = {
      title: title.trim(),
      subject,
      topic: topic.trim(),
      description: description.trim(),
      category,
      renderer_type: rendererType,
      difficulty,
      variables,
      target_audience: targetAudience,
      learning_goal: learningGoal.trim(),
      constraints: constraints.trim() || undefined,
    };
    await onGenerate(blueprint);
  }, [
    title,
    subject,
    topic,
    description,
    category,
    rendererType,
    difficulty,
    variables,
    targetAudience,
    learningGoal,
    constraints,
    onGenerate,
  ]);

  // ── Variable helpers ──

  const addVariable = () => setVariables((v) => [...v, emptyVariable()]);

  const removeVariable = (idx: number) =>
    setVariables((v) => v.filter((_, i) => i !== idx));

  const updateVariable = (
    idx: number,
    field: keyof SimulationVariable,
    value: unknown,
  ) =>
    setVariables((v) =>
      v.map((variable, i) =>
        i === idx ? { ...variable, [field]: value } : variable,
      ),
    );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Simulation Blueprint
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Step {step} of 3 — {STEP_LABELS[step].label}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ── Step Indicator ── */}
        <div className="flex items-center justify-center gap-2 py-3 border-b border-gray-100 dark:border-gray-800">
          {([1, 2, 3] as WizardStep[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s === step
                    ? "bg-emerald-600 text-white scale-110"
                    : s < step
                      ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-0.5 rounded ${
                    s < step ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Step Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="space-y-5"
              >
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Simulation Title *
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Projectile Motion Explorer"
                    className="text-base"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Subject
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSubject(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          subject === s
                            ? "bg-emerald-600 text-white shadow-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Specific Topic *
                  </label>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Projectile motion with air resistance"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setCategory(c.value)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                          category === c.value
                            ? "bg-emerald-600 text-white shadow-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        <span>{c.emoji}</span>
                        <span className="truncate">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe what this simulation should demonstrate..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
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
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="space-y-5"
              >
                {/* Renderer Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Visualization Type *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {RENDERER_TYPES.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setRendererType(r.value)}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          rendererType === r.value
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-md"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg ${
                            rendererType === r.value
                              ? "bg-emerald-600 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                          }`}
                        >
                          {r.icon}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {r.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {r.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Difficulty Level
                  </label>
                  <div className="flex gap-2">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => setDifficulty(d.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          difficulty === d.value
                            ? "bg-emerald-600 text-white shadow-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Audience */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Target Audience
                  </label>
                  <div className="flex gap-2">
                    {[
                      "Middle School",
                      "High School",
                      "University",
                      "Adult Learner",
                    ].map((a) => (
                      <button
                        key={a}
                        onClick={() => setTargetAudience(a)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          targetAudience === a
                            ? "bg-emerald-600 text-white shadow-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Learning Goal */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Learning Goal *
                  </label>
                  <textarea
                    value={learningGoal}
                    onChange={(e) => setLearningGoal(e.target.value)}
                    placeholder="What should students understand after interacting with this simulation?"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* Constraints */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Constraints / Notes (optional)
                  </label>
                  <Input
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    placeholder="e.g. Ignore air resistance, assume ideal spring..."
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Simulation Variables
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Define the parameters students can adjust. AI will also
                      suggest additional computed variables.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addVariable}
                    className="gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Variable
                  </Button>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {variables.map((v, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          Variable {idx + 1}
                        </span>
                        {variables.length > 1 && (
                          <button
                            onClick={() => removeVariable(idx)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Row 1: Name, Symbol, Unit */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">
                            Name *
                          </label>
                          <Input
                            value={v.name}
                            onChange={(e) =>
                              updateVariable(idx, "name", e.target.value)
                            }
                            placeholder="Velocity"
                            className="text-sm h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">
                            Symbol *
                          </label>
                          <Input
                            value={v.symbol}
                            onChange={(e) =>
                              updateVariable(idx, "symbol", e.target.value)
                            }
                            placeholder="v0"
                            className="text-sm h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">
                            Unit
                          </label>
                          <Input
                            value={v.unit}
                            onChange={(e) =>
                              updateVariable(idx, "unit", e.target.value)
                            }
                            placeholder="m/s"
                            className="text-sm h-8"
                          />
                        </div>
                      </div>

                      {/* Row 2: Min, Max, Default, Step */}
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">
                            Min
                          </label>
                          <Input
                            type="number"
                            value={v.min}
                            onChange={(e) =>
                              updateVariable(idx, "min", Number(e.target.value))
                            }
                            className="text-sm h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">
                            Max
                          </label>
                          <Input
                            type="number"
                            value={v.max}
                            onChange={(e) =>
                              updateVariable(idx, "max", Number(e.target.value))
                            }
                            className="text-sm h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">
                            Default
                          </label>
                          <Input
                            type="number"
                            value={v.default_value}
                            onChange={(e) =>
                              updateVariable(
                                idx,
                                "default_value",
                                Number(e.target.value),
                              )
                            }
                            className="text-sm h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">
                            Step
                          </label>
                          <Input
                            type="number"
                            value={v.step}
                            onChange={(e) =>
                              updateVariable(
                                idx,
                                "step",
                                Number(e.target.value),
                              )
                            }
                            className="text-sm h-8"
                          />
                        </div>
                      </div>

                      {/* Row 3: Is Input toggle */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateVariable(idx, "is_input", !v.is_input)
                          }
                          className={`relative w-9 h-5 rounded-full transition-colors ${
                            v.is_input
                              ? "bg-emerald-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              v.is_input ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {v.is_input
                            ? "Student-adjustable (input)"
                            : "Computed (output)"}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Button
            variant="ghost"
            onClick={step === 1 ? onClose : goBack}
            disabled={isGenerating}
            className="gap-1"
          >
            {step === 1 ? (
              "Cancel"
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" /> Back
              </>
            )}
          </Button>

          {step < 3 ? (
            <Button
              onClick={goNext}
              disabled={
                (step === 1 && !canAdvanceStep1) ||
                (step === 2 && !canAdvanceStep2)
              }
              className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white px-6"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Engine…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Simulation
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SimulationWizard;
