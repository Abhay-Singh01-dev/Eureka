// ============================================================
// SimulationBuilder — Phases 2–6 Orchestrator
// Engine Generation → Renderer → Cognitive Overlay → Preview → Publish
// ============================================================

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Loader2,
  Settings2,
  Eye,
  Brain,
  FlaskConical,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as math from "mathjs";
import type {
  SimulationBlueprint,
  SimulationModel,
  RendererConfig,
  SimulationGuidance,
  SimulationDocument,
  SimulationState,
  SimulationVariable,
  RendererProps,
} from "@/types/simulation";

// Renderer imports
import GraphRenderer from "@/components/simulation/renderers/GraphRenderer";
import AnimatedObjectRenderer from "@/components/simulation/renderers/AnimatedObjectRenderer";
import NumericalDisplay from "@/components/simulation/renderers/NumericalDisplay";
import VectorFieldRenderer from "@/components/simulation/renderers/VectorFieldRenderer";
import CircuitDiagramRenderer from "@/components/simulation/renderers/CircuitDiagramRenderer";
import GridTransformRenderer from "@/components/simulation/renderers/GridTransformRenderer";
import CognitiveOverlay from "@/components/simulation/CognitiveOverlay";

// ── Types ──

type BuilderPhase =
  | "generating"
  | "configure"
  | "guidance"
  | "preview"
  | "publish";

interface SimulationBuilderProps {
  blueprint: SimulationBlueprint;
  existingDoc?: SimulationDocument | null;
  onSave: (doc: Partial<SimulationDocument>) => Promise<string | null>;
  onGenerateEngine: (blueprint: SimulationBlueprint) => Promise<{
    model: SimulationModel;
    renderer_config: RendererConfig;
  } | null>;
  onGenerateGuidance: (
    blueprint: SimulationBlueprint,
    model: SimulationModel,
  ) => Promise<SimulationGuidance | null>;
  onPublish: (simId: string) => Promise<boolean>;
  onClose: () => void;
  isGenerating?: boolean;
}

// ── Simulation Engine (mathjs-based) ──

function evaluateEquations(
  model: SimulationModel,
  state: SimulationState,
): Record<string, number> {
  const dt = model.time_step || 0.016;
  const scope: Record<string, number> = {
    ...state.variables,
    t: state.time,
    dt,
    pi: Math.PI,
    e: Math.E,
  };

  // Start result from original variables only (no t/dt/pi/e pollution)
  const result: Record<string, number> = { ...state.variables };

  for (const eq of model.equations) {
    try {
      const val = math.evaluate(eq.expression, scope);
      const num = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(num)) {
        console.warn(
          `[SimEngine] Equation "${eq.label}" produced non-finite value for "${eq.output_variable}": ${num}`,
        );
      }
      result[eq.output_variable] = Number.isFinite(num) ? num : 0;
      // Update scope so subsequent equations can reference this
      scope[eq.output_variable] = result[eq.output_variable];
    } catch (err) {
      console.warn(
        `[SimEngine] Equation "${eq.label}" (${eq.expression}) failed:`,
        err,
      );
      // Keep previous value if available, else 0
      if (!(eq.output_variable in result)) {
        result[eq.output_variable] = 0;
      }
    }
  }

  return result;
}

function createInitialState(
  model: SimulationModel,
  blueprint: SimulationBlueprint,
): SimulationState {
  const variables: Record<string, number> = { ...model.initial_state };
  // Overlay blueprint variable defaults
  for (const v of blueprint.variables) {
    if (!(v.symbol in variables)) {
      variables[v.symbol] = v.default_value;
    }
  }

  // Evaluate equations so computed outputs are available immediately
  const seedState: SimulationState = {
    variables,
    time: 0,
    running: false,
    speed: 1,
    history: [],
    max_history: 500,
  };
  const evaluated = evaluateEquations(model, seedState);

  return {
    variables: evaluated,
    time: 0,
    running: false,
    speed: 1,
    history: [{ ...evaluated, t: 0 }],
    max_history: 500,
  };
}

function stepSimulation(
  model: SimulationModel,
  state: SimulationState,
): SimulationState {
  if (!model.time_dependent) return state;

  const dt = (model.time_step || 0.016) * state.speed;
  const newTime = state.time + dt;

  // Apply update rules if any
  const scope: Record<string, number> = {
    ...state.variables,
    t: newTime,
    dt,
    pi: Math.PI,
    e: Math.E,
  };

  const newVars = { ...state.variables };
  if (model.update_rules) {
    for (const rule of model.update_rules) {
      try {
        const val = math.evaluate(rule.expression, scope);
        const num = typeof val === "number" ? val : Number(val);
        newVars[rule.variable] = Number.isFinite(num)
          ? num
          : (newVars[rule.variable] ?? 0);
        scope[rule.variable] = newVars[rule.variable];
      } catch (err) {
        console.warn(
          `[SimEngine] Update rule for "${rule.variable}" failed:`,
          err,
        );
      }
    }
  }

  // Re-evaluate all equations with new state
  const evaluated = evaluateEquations(model, {
    ...state,
    variables: newVars,
    time: newTime,
  });

  const history = [...state.history, { ...evaluated, t: newTime }].slice(
    -state.max_history,
  );

  return {
    ...state,
    variables: evaluated,
    time: newTime,
    history,
  };
}

// ── Renderer Selector ──

function getRendererComponent(type: string): FC<RendererProps> | null {
  switch (type) {
    case "graph":
      return GraphRenderer;
    case "animated_object":
      return AnimatedObjectRenderer;
    case "numerical_display":
      return NumericalDisplay;
    case "vector_field":
      return VectorFieldRenderer;
    case "circuit_diagram":
      return CircuitDiagramRenderer;
    case "grid_transform":
      return GridTransformRenderer;
    default:
      return null;
  }
}

// ── Main Component ──

const SimulationBuilder: FC<SimulationBuilderProps> = ({
  blueprint,
  existingDoc,
  onSave,
  onGenerateEngine,
  onGenerateGuidance,
  onPublish,
  onClose,
  isGenerating: externalGenerating = false,
}) => {
  // ── Core state ──
  const [phase, setPhase] = useState<BuilderPhase>(
    existingDoc?.model ? "configure" : "generating",
  );
  const [model, setModel] = useState<SimulationModel | null>(
    existingDoc?.model ?? null,
  );
  const [rendererConfig, setRendererConfig] = useState<RendererConfig | null>(
    existingDoc?.renderer_config ?? null,
  );
  const [guidance, setGuidance] = useState<SimulationGuidance | null>(
    existingDoc?.guidance ?? null,
  );
  const [simId, setSimId] = useState<string | null>(existingDoc?._id ?? null);

  // ── Simulation runtime ──
  const [simState, setSimState] = useState<SimulationState | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // ── UI state ──
  const [isGeneratingEngine, setIsGeneratingEngine] = useState(false);
  const [isGeneratingGuidance, setIsGeneratingGuidance] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // ── Measure container ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Auto-generate engine on mount if needed ──
  useEffect(() => {
    if (phase === "generating" && !model) {
      (async () => {
        setIsGeneratingEngine(true);
        setError(null);
        try {
          const result = await onGenerateEngine(blueprint);
          if (result) {
            setModel(result.model);
            setRendererConfig(result.renderer_config);
            setPhase("configure");
          } else {
            setError("Engine generation failed. Please try again.");
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Engine generation failed");
        } finally {
          setIsGeneratingEngine(false);
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initialize sim state when model is ready ──
  useEffect(() => {
    if (model && !simState) {
      setSimState(createInitialState(model, blueprint));
    }
  }, [model, blueprint, simState]);

  // ── Animation loop ──
  useEffect(() => {
    if (!simState?.running || !model) return;

    const maxTime = model.max_time ?? Infinity;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;

      // Step at ~60fps
      if (elapsed >= 16) {
        lastTimeRef.current = timestamp;
        setSimState((prev) => {
          if (!prev || !prev.running) return prev;
          if (prev.time >= maxTime) return { ...prev, running: false };
          return stepSimulation(model, prev);
        });
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [simState?.running, model]);

  // ── Controls ──
  const togglePlay = useCallback(() => {
    setSimState((prev) => (prev ? { ...prev, running: !prev.running } : prev));
    lastTimeRef.current = 0;
  }, []);

  const resetSim = useCallback(() => {
    if (model) {
      cancelAnimationFrame(animFrameRef.current);
      setSimState(createInitialState(model, blueprint));
    }
  }, [model, blueprint]);

  const handleVariableChange = useCallback(
    (variable: string, value: number) => {
      setSimState((prev) => {
        if (!prev || !model) return prev;
        const newVars = { ...prev.variables, [variable]: value };
        // Re-evaluate equations
        const evaluated = evaluateEquations(model, {
          ...prev,
          variables: newVars,
        });
        // If not running, also reset history with fresh evaluated values
        const history = prev.running
          ? prev.history
          : [{ ...evaluated, t: prev.time }];
        return { ...prev, variables: evaluated, history };
      });
    },
    [model],
  );

  const setSpeed = useCallback((speed: number) => {
    setSimState((prev) => (prev ? { ...prev, speed } : prev));
  }, []);

  // ── Generate guidance ──
  const handleGenerateGuidance = useCallback(async () => {
    if (!model) return;
    setIsGeneratingGuidance(true);
    setError(null);
    try {
      const result = await onGenerateGuidance(blueprint, model);
      if (result) {
        setGuidance(result);
      } else {
        setError("Guidance generation failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Guidance generation failed");
    } finally {
      setIsGeneratingGuidance(false);
    }
  }, [blueprint, model, onGenerateGuidance]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const doc: Partial<SimulationDocument> = {
        _id: simId ?? undefined,
        blueprint,
        model,
        renderer_config: rendererConfig,
        guidance,
        status: "ready",
      };
      const id = await onSave(doc);
      if (id) {
        setSimId(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [simId, blueprint, model, rendererConfig, guidance, onSave]);

  // ── Publish ──
  const handlePublish = useCallback(async () => {
    if (!simId) {
      // Save first
      await handleSave();
    }
    if (simId) {
      const ok = await onPublish(simId);
      if (ok) {
        onClose();
      }
    }
  }, [simId, handleSave, onPublish, onClose]);

  // ── Regenerate engine ──
  const handleRegenerateEngine = useCallback(async () => {
    setIsGeneratingEngine(true);
    setError(null);
    setSimState(null);
    try {
      const result = await onGenerateEngine(blueprint);
      if (result) {
        setModel(result.model);
        setRendererConfig(result.renderer_config);
        setSimState(createInitialState(result.model, blueprint));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setIsGeneratingEngine(false);
    }
  }, [blueprint, onGenerateEngine]);

  // ── Phase labels ──
  const PHASE_LABELS: Record<BuilderPhase, string> = {
    generating: "Generating Engine",
    configure: "Configure & Test",
    guidance: "Cognitive Overlay",
    preview: "Student Preview",
    publish: "Publish",
  };

  const phases: BuilderPhase[] = [
    "generating",
    "configure",
    "guidance",
    "preview",
    "publish",
  ];
  const phaseIndex = phases.indexOf(phase);

  const RendererComponent = rendererConfig
    ? getRendererComponent(rendererConfig.type)
    : null;

  const inputVariables = blueprint.variables.filter((v) => v.is_input);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-gray-900 dark:to-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              {blueprint.title}
            </h2>
            <p className="text-xs text-gray-500">{PHASE_LABELS[phase]}</p>
          </div>
        </div>

        {/* Phase tabs */}
        <div className="flex items-center gap-1">
          {phases.slice(1).map((p, i) => (
            <button
              key={p}
              onClick={() => model && setPhase(p)}
              disabled={!model}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                phase === p
                  ? "bg-emerald-600 text-white"
                  : p === "publish" && !guidance
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {PHASE_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={!model || isSaving}
            className="gap-1"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </Button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Generating Phase ── */}
        {phase === "generating" && (
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Generating Simulation Engine
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  AI is creating equations, initial conditions, and renderer
                  configuration…
                </p>
              </div>
              <div className="flex items-center justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-emerald-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* ── Configure / Preview Phase ── */}
        {(phase === "configure" || phase === "preview") &&
          model &&
          rendererConfig &&
          simState && (
            <>
              {/* Left: Renderer */}
              <div className="flex-1 flex flex-col">
                {/* Controls bar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
                  {model.time_dependent && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={togglePlay}
                        className="gap-1"
                      >
                        {simState.running ? (
                          <>
                            <Pause className="w-3.5 h-3.5" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" /> Play
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={resetSim}
                        className="gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                      </Button>

                      {/* Speed control */}
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-xs text-gray-500">Speed:</span>
                        {[0.25, 0.5, 1, 2, 4].map((s) => (
                          <button
                            key={s}
                            onClick={() => setSpeed(s)}
                            className={`px-1.5 py-0.5 rounded text-xs font-mono transition-all ${
                              simState.speed === s
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>

                      <span className="ml-2 text-xs font-mono text-gray-400">
                        t = {simState.time.toFixed(2)}s
                      </span>
                    </>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {phase === "configure" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRegenerateEngine}
                        disabled={isGeneratingEngine}
                        className="gap-1 text-xs"
                      >
                        {isGeneratingEngine ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Regenerate
                      </Button>
                    )}
                    {guidance && (
                      <Button
                        size="sm"
                        variant={showOverlay ? "default" : "ghost"}
                        onClick={() => setShowOverlay(!showOverlay)}
                        className="gap-1 text-xs"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        {showOverlay ? "Hide" : "Show"} Guidance
                      </Button>
                    )}
                  </div>
                </div>

                {/* Renderer viewport */}
                <div
                  ref={containerRef}
                  className="flex-1 relative overflow-hidden"
                >
                  {RendererComponent && (
                    <RendererComponent
                      config={rendererConfig}
                      state={simState}
                      model={model}
                      onVariableChange={handleVariableChange}
                      width={dimensions.width}
                      height={dimensions.height}
                      dark={document.documentElement.classList.contains("dark")}
                    />
                  )}

                  {/* Cognitive overlay */}
                  {guidance && showOverlay && phase === "preview" && (
                    <CognitiveOverlay
                      guidance={guidance}
                      state={simState}
                      hasStarted={simState.time > 0}
                      dark={document.documentElement.classList.contains("dark")}
                    />
                  )}
                </div>
              </div>

              {/* Right: Variable sliders */}
              <div className="w-72 border-l border-gray-200 dark:border-gray-800 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                <div className="p-4 space-y-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Variables
                  </h4>

                  {inputVariables.map((v) => (
                    <div key={v.symbol} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {v.name}{" "}
                          <span className="text-xs text-gray-400 font-mono">
                            ({v.symbol})
                          </span>
                        </label>
                        <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                          {(
                            simState.variables[v.symbol] ?? v.default_value
                          ).toFixed(v.step < 1 ? 2 : 0)}{" "}
                          <span className="text-xs text-gray-400">
                            {v.unit}
                          </span>
                        </span>
                      </div>
                      <input
                        type="range"
                        min={v.min}
                        max={v.max}
                        step={v.step}
                        value={simState.variables[v.symbol] ?? v.default_value}
                        onChange={(e) =>
                          handleVariableChange(v.symbol, Number(e.target.value))
                        }
                        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-700 accent-emerald-600"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>
                          {v.min} {v.unit}
                        </span>
                        <span>
                          {v.max} {v.unit}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Computed values */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Computed Values
                    </h4>
                    {model.equations.map((eq) => (
                      <div
                        key={eq.output_variable}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {eq.label}
                        </span>
                        <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                          {(
                            simState.variables[eq.output_variable] ?? 0
                          ).toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Equations list */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Equations
                    </h4>
                    {model.equations.map((eq, i) => (
                      <div
                        key={i}
                        className="py-1.5 px-2 rounded bg-gray-100 dark:bg-gray-800 mb-1.5"
                      >
                        <div className="text-[10px] text-gray-500">
                          {eq.label}
                        </div>
                        <code className="text-xs text-emerald-600 dark:text-emerald-400 break-all">
                          {eq.expression}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

        {/* ── Guidance Phase ── */}
        {phase === "guidance" && (
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl w-full space-y-6"
            >
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
                  <Brain className="w-7 h-7 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Cognitive Overlay
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  AI-generated educational guidance: hypothesis prompts,
                  observation cues, misconception alerts, and exploration
                  challenges.
                </p>
              </div>

              {!guidance ? (
                <div className="text-center">
                  <Button
                    onClick={handleGenerateGuidance}
                    disabled={isGeneratingGuidance || !model}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8"
                  >
                    {isGeneratingGuidance ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Guidance…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Cognitive Overlay
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Hypothesis */}
                  <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
                    <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">
                      Hypothesis Prompt
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {guidance.hypothesis_prompt}
                    </p>
                  </div>

                  {/* Observation prompts */}
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
                      Observation Prompts ({guidance.observation_prompts.length}
                      )
                    </h4>
                    <div className="space-y-2">
                      {guidance.observation_prompts.map((op, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-mono flex-shrink-0">
                            {op.trigger}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {op.prompt}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Insight */}
                  <div className="p-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
                    <h4 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">
                      Key Insight
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {guidance.insight_summary}
                    </p>
                  </div>

                  {/* Misconceptions */}
                  <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                    <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
                      Misconception Alerts
                    </h4>
                    <div className="space-y-2">
                      {guidance.misconception_alerts.map((ma, i) => (
                        <div key={i} className="text-sm space-y-0.5">
                          <div className="text-red-600 dark:text-red-400">
                            ✗ {ma.misconception}
                          </div>
                          <div className="text-green-600 dark:text-green-400 pl-3">
                            ✓ {ma.correction}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Exploration challenges */}
                  <div className="p-4 rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/20">
                    <h4 className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-2">
                      Exploration Challenges
                    </h4>
                    <div className="space-y-2">
                      {guidance.exploration_challenges.map((ch, i) => (
                        <div key={i} className="text-sm">
                          <div className="font-medium text-gray-700 dark:text-gray-300">
                            🔬 {ch.challenge}
                          </div>
                          {ch.hint && (
                            <div className="text-xs text-gray-500 pl-5 mt-0.5">
                              Hint: {ch.hint}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleGenerateGuidance}
                      disabled={isGeneratingGuidance}
                      className="gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Regenerate
                    </Button>
                    <Button
                      onClick={() => setPhase("preview")}
                      className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview with Overlay
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* ── Publish Phase ── */}
        {phase === "publish" && (
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full text-center space-y-6"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Send className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Publish Simulation
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Make this simulation available to students.
                </p>
              </div>

              {/* Readiness checklist */}
              <div className="text-left space-y-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                {[
                  { label: "Engine generated", ok: !!model },
                  { label: "Renderer configured", ok: !!rendererConfig },
                  { label: "Cognitive guidance", ok: !!guidance },
                  { label: "Saved to database", ok: !!simId },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 text-sm"
                  >
                    {item.ok ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <X className="w-4 h-4 text-red-400" />
                    )}
                    <span
                      className={
                        item.ok
                          ? "text-gray-700 dark:text-gray-300"
                          : "text-gray-400"
                      }
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                onClick={handlePublish}
                disabled={!model || !rendererConfig || !guidance}
                className="gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white px-8"
              >
                <Send className="w-4 h-4" />
                Publish Simulation
              </Button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulationBuilder;
