// ============================================================
// CognitiveOverlay — Hypothesis, observation, misconception alerts
// ============================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FC,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Lightbulb,
  Eye,
  AlertTriangle,
  Compass,
  ChevronDown,
  ChevronUp,
  X,
  Brain,
  MessageCircle,
} from "lucide-react";
import type { SimulationGuidance, SimulationState } from "@/types/simulation";

interface CognitiveOverlayProps {
  guidance: SimulationGuidance;
  state: SimulationState;
  /** Whether student has started the simulation at least once */
  hasStarted: boolean;
  dark?: boolean;
}

/* ── Toast-style notification ────────────────────────────── */

interface ToastNotification {
  id: string;
  type: "observation" | "misconception" | "challenge";
  title: string;
  content: string;
  extra?: string;
}

/* ── Main component ──────────────────────────────────────── */

const CognitiveOverlay: FC<CognitiveOverlayProps> = ({
  guidance,
  state,
  hasStarted,
  dark = false,
}) => {
  const [showHypothesis, setShowHypothesis] = useState(true);
  const [hypothesisResponse, setHypothesisResponse] = useState("");
  const [hypothesisSubmitted, setHypothesisSubmitted] = useState(false);
  const [activeToasts, setActiveToasts] = useState<ToastNotification[]>([]);
  const [firedTriggers, setFiredTriggers] = useState<Set<string>>(new Set());
  const [showInsight, setShowInsight] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "challenges",
  );
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(
    new Set(),
  );

  // ── Trigger observation prompts when conditions are met ──

  useEffect(() => {
    if (!hasStarted) return;

    for (let i = 0; i < guidance.observation_prompts.length; i++) {
      const obs = guidance.observation_prompts[i];
      const key = `obs-${i}`;
      if (firedTriggers.has(key)) continue;

      let shouldFire = false;

      if (obs.trigger === "time" && obs.condition?.time != null) {
        shouldFire = state.time >= obs.condition.time;
      } else if (
        obs.trigger === "variable_threshold" &&
        obs.condition?.variable &&
        obs.condition?.value != null
      ) {
        const val = state.variables[obs.condition.variable] ?? 0;
        const threshold = obs.condition.value;
        switch (obs.condition.operator) {
          case ">":
            shouldFire = val > threshold;
            break;
          case "<":
            shouldFire = val < threshold;
            break;
          case ">=":
            shouldFire = val >= threshold;
            break;
          case "<=":
            shouldFire = val <= threshold;
            break;
          case "==":
            shouldFire = Math.abs(val - threshold) < 0.01;
            break;
        }
      }

      if (shouldFire) {
        setFiredTriggers((prev) => new Set(prev).add(key));
        setActiveToasts((prev) => [
          ...prev,
          {
            id: key,
            type: "observation",
            title: "Observation",
            content: obs.prompt,
          },
        ]);

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          setActiveToasts((prev) => prev.filter((t) => t.id !== key));
        }, 10000);
      }
    }
  }, [
    state.time,
    state.variables,
    guidance.observation_prompts,
    hasStarted,
    firedTriggers,
  ]);

  // ── Show insight summary after significant exploration ──

  useEffect(() => {
    if (!hasStarted) return;
    if (showInsight) return;

    // Show insight after 20 seconds of simulation time or 80% of triggers fired
    const threshold =
      guidance.observation_prompts.length > 0
        ? firedTriggers.size / guidance.observation_prompts.length >= 0.8
        : state.time > 20;

    if (threshold) {
      setShowInsight(true);
    }
  }, [
    state.time,
    firedTriggers,
    guidance.observation_prompts,
    hasStarted,
    showInsight,
  ]);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  }, []);

  const toggleChallenge = useCallback((index: number) => {
    setCompletedChallenges((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Card styling
  const cardBg = dark
    ? "bg-slate-800/90 border-slate-700"
    : "bg-white/90 border-gray-200";
  const textPrimary = dark ? "text-gray-100" : "text-gray-900";
  const textSecondary = dark ? "text-gray-400" : "text-gray-600";

  return (
    <>
      {/* ── Floating toast notifications ── */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {activeToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className={`p-3 rounded-lg border shadow-lg backdrop-blur-sm ${cardBg}`}
            >
              <div className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${textPrimary}`}>
                    {toast.title}
                  </p>
                  <p className={`text-xs mt-1 ${textSecondary}`}>
                    {toast.content}
                  </p>
                </div>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className={`p-0.5 rounded ${dark ? "hover:bg-slate-700" : "hover:bg-gray-100"}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Side panel content ── */}
      <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
        {/* Hypothesis prompt (shown before/at start) */}
        {!hypothesisSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-lg border ${cardBg}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span className={`text-xs font-semibold ${textPrimary}`}>
                Hypothesis
              </span>
            </div>
            <p className={`text-xs ${textSecondary} mb-2`}>
              {guidance.hypothesis_prompt}
            </p>
            <textarea
              value={hypothesisResponse}
              onChange={(e) => setHypothesisResponse(e.target.value)}
              placeholder="Write your prediction here..."
              className={`w-full text-xs p-2 rounded border resize-none ${
                dark
                  ? "bg-slate-900 border-slate-600 text-gray-200 placeholder:text-gray-600"
                  : "bg-gray-50 border-gray-300 text-gray-800 placeholder:text-gray-400"
              }`}
              rows={3}
            />
            <button
              onClick={() => {
                if (hypothesisResponse.trim()) {
                  setHypothesisSubmitted(true);
                  setShowHypothesis(false);
                }
              }}
              disabled={!hypothesisResponse.trim()}
              className={`mt-2 w-full py-1.5 text-xs font-medium rounded ${
                hypothesisResponse.trim()
                  ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  : "bg-gray-500/20 text-gray-500 cursor-not-allowed"
              }`}
            >
              Submit Prediction
            </button>
          </motion.div>
        )}

        {/* Submitted hypothesis (collapsed) */}
        {hypothesisSubmitted && (
          <div
            className={`p-2 rounded-lg border ${cardBg} cursor-pointer`}
            onClick={() => setShowHypothesis(!showHypothesis)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span className={`text-xs font-medium ${textPrimary}`}>
                  Your Prediction
                </span>
              </div>
              {showHypothesis ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </div>
            {showHypothesis && (
              <p className={`text-xs mt-2 ${textSecondary} italic`}>
                "{hypothesisResponse}"
              </p>
            )}
          </div>
        )}

        {/* Misconception alerts */}
        {guidance.misconception_alerts.length > 0 && (
          <div className={`rounded-lg border ${cardBg}`}>
            <button
              onClick={() => toggleSection("misconceptions")}
              className="w-full p-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                <span className={`text-xs font-semibold ${textPrimary}`}>
                  Common Misconceptions ({guidance.misconception_alerts.length})
                </span>
              </div>
              {expandedSection === "misconceptions" ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            <AnimatePresence>
              {expandedSection === "misconceptions" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-2.5 pb-2.5 space-y-2">
                    {guidance.misconception_alerts.map((m, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded text-xs ${
                          dark ? "bg-orange-500/10" : "bg-orange-50"
                        }`}
                      >
                        <p className="text-orange-400 font-medium">
                          ✗ {m.misconception}
                        </p>
                        <p className={`mt-1 ${textSecondary}`}>
                          ✓ {m.correction}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Exploration challenges */}
        {guidance.exploration_challenges.length > 0 && (
          <div className={`rounded-lg border ${cardBg}`}>
            <button
              onClick={() => toggleSection("challenges")}
              className="w-full p-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span className={`text-xs font-semibold ${textPrimary}`}>
                  Exploration Challenges ({completedChallenges.size}/
                  {guidance.exploration_challenges.length})
                </span>
              </div>
              {expandedSection === "challenges" ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            <AnimatePresence>
              {expandedSection === "challenges" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-2.5 pb-2.5 space-y-2">
                    {guidance.exploration_challenges.map((ch, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded text-xs ${
                          completedChallenges.has(i)
                            ? dark
                              ? "bg-emerald-500/10"
                              : "bg-emerald-50"
                            : dark
                              ? "bg-slate-700/50"
                              : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={completedChallenges.has(i)}
                            onChange={() => toggleChallenge(i)}
                            className="mt-0.5 rounded accent-emerald-500"
                          />
                          <div className="flex-1">
                            <p
                              className={`font-medium ${
                                completedChallenges.has(i)
                                  ? "text-emerald-400 line-through"
                                  : textPrimary
                              }`}
                            >
                              {ch.challenge}
                            </p>
                            {ch.hint && (
                              <p className={`mt-1 ${textSecondary} italic`}>
                                💡 Hint: {ch.hint}
                              </p>
                            )}
                            {completedChallenges.has(i) && (
                              <p className="mt-1 text-emerald-400">
                                ✓ {ch.expected_behavior}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Insight summary (shown after exploration) */}
        <AnimatePresence>
          {showInsight && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-3 rounded-lg border ${
                dark
                  ? "bg-gradient-to-br from-cyan-900/30 to-emerald-900/30 border-cyan-700/50"
                  : "bg-gradient-to-br from-cyan-50 to-emerald-50 border-cyan-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                <span className={`text-xs font-semibold ${textPrimary}`}>
                  Key Insight
                </span>
              </div>
              <p className={`text-xs ${textSecondary}`}>
                {guidance.insight_summary}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Observation prompts history */}
        {firedTriggers.size > 0 && (
          <div className={`rounded-lg border ${cardBg}`}>
            <button
              onClick={() => toggleSection("observations")}
              className="w-full p-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                <span className={`text-xs font-semibold ${textPrimary}`}>
                  Observations ({firedTriggers.size})
                </span>
              </div>
              {expandedSection === "observations" ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            <AnimatePresence>
              {expandedSection === "observations" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-2.5 pb-2.5 space-y-1.5">
                    {guidance.observation_prompts.map((obs, i) => {
                      const key = `obs-${i}`;
                      if (!firedTriggers.has(key)) return null;
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded text-xs ${
                            dark ? "bg-blue-500/10" : "bg-blue-50"
                          }`}
                        >
                          <p className={textSecondary}>{obs.prompt}</p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
};

export default CognitiveOverlay;
