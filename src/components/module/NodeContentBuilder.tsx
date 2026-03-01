// ============================================================
// NodeContentBuilder — Phase C intelligent content creation
// Multi-stage aware: Experience Type → Per-stage Entry Style →
// Per-stage Scaffold Generation → Stage-tabbed Block Editor
// with Misconception tracking, Student Preview, and Save/Publish
// ============================================================

import React, { useState, useCallback, useMemo, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Save,
  Eye,
  Loader2,
  ChevronLeft,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import ExperienceTypeSelector from "./ExperienceTypeSelector";
import EntryStyleSelector from "./EntryStyleSelector";
import BlockEditor from "./BlockEditor";
import StudentPreview from "./StudentPreview";
import MisconceptionPanel from "./MisconceptionPanel";
import type {
  ExperienceType,
  EntryStyle,
  BlockType,
  ContentBlock,
  NodeScaffold,
  StageContent,
  GeneratedNode,
  CognitiveDesign,
  NodeContent,
} from "@/types/custom-module";
import { migrateNodeContent } from "@/types/custom-module";

// ── Types ──

type BuilderPhase = "experience_type" | "entry_style" | "generating" | "editor";

interface NodeContentBuilderProps {
  /** The module this node belongs to */
  moduleId: string;
  /** The node being designed */
  node: GeneratedNode;
  /** All nodes in the module (for misconception tracking) */
  allNodes: GeneratedNode[];
  /** Cognitive design settings from the module */
  cognitiveDesign: CognitiveDesign;
  /** Common misconceptions from learning objectives */
  misconceptions: string[];
  /** Existing saved content (null if new) */
  existingContent: NodeContent | null;
  /** Whether content is being saved */
  isSaving: boolean;
  /** Callback: generate scaffold via API */
  onGenerateScaffold: (
    moduleId: string,
    nodeId: string,
    entryStyle: EntryStyle,
    cognitiveDesign: CognitiveDesign,
    nodeMetadata: GeneratedNode,
    stageNumber?: number,
    totalStages?: number,
  ) => Promise<NodeScaffold | null>;
  /** Callback: save node content (stage-based) */
  onSave: (
    moduleId: string,
    nodeId: string,
    experienceType: ExperienceType,
    stages: StageContent[],
  ) => Promise<boolean>;
  /** Close the builder */
  onClose: () => void;
  /** Generate AI content for a single block */
  onGenerateBlockContent?: (
    blockType: BlockType,
    nodeTitle: string,
    nodeDescription: string,
    entryStyle: string,
    depthLevel: number,
    existingBlocks?: { type: string; content: string }[],
  ) => Promise<string | null>;
}

// ── Scaffold → Blocks converter ──

function scaffoldToBlocks(scaffold: NodeScaffold): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let idx = 0;

  if (scaffold.entry_block?.content) {
    blocks.push({
      id: `block-${idx++}`,
      type: "entry",
      content: scaffold.entry_block.content,
      locked: true,
    });
  }

  if (scaffold.explanation_block) {
    blocks.push({
      id: `block-${idx++}`,
      type: "explanation",
      content: scaffold.explanation_block,
    });
  }

  if (scaffold.micro_questions) {
    for (const q of scaffold.micro_questions) {
      blocks.push({ id: `block-${idx++}`, type: "micro_question", content: q });
    }
  }

  if (scaffold.misconception_probe) {
    blocks.push({
      id: `block-${idx++}`,
      type: "micro_question",
      content: scaffold.misconception_probe,
    });
  }

  if (scaffold.simulation_suggestion) {
    blocks.push({
      id: `block-${idx++}`,
      type: "simulation",
      content: scaffold.simulation_suggestion,
    });
  }

  if (scaffold.quiz_prompt) {
    blocks.push({
      id: `block-${idx++}`,
      type: "quiz",
      content: scaffold.quiz_prompt,
    });
  }

  return blocks;
}

// ── Default entry style for experience types ──

function defaultEntryStyleForType(
  experienceType: ExperienceType,
): EntryStyle | null {
  switch (experienceType) {
    case "simulation_led":
      return "simulation_first";
    case "dialogue_based":
      return "question_first";
    default:
      return null; // user chooses
  }
}

// ── Main Component ──

const NodeContentBuilder: FC<NodeContentBuilderProps> = ({
  moduleId,
  node,
  allNodes,
  cognitiveDesign,
  misconceptions,
  existingContent,
  isSaving,
  onGenerateScaffold,
  onSave,
  onClose,
  onGenerateBlockContent,
}) => {
  // ── Migrate existing content ──
  const migrated = existingContent ? migrateNodeContent(existingContent) : null;
  const hasExisting =
    !!migrated?.stages?.length &&
    migrated.stages.some((s) => s.blocks.length > 0);

  // ── State ──
  const [phase, setPhase] = useState<BuilderPhase>(
    hasExisting ? "editor" : "experience_type",
  );
  const [experienceType, setExperienceType] = useState<ExperienceType | null>(
    migrated?.experience_type || null,
  );
  const [stageCount, setStageCount] = useState<number>(
    migrated?.stages?.length || 2,
  );
  const [stages, setStages] = useState<StageContent[]>(migrated?.stages || []);

  // For per-stage entry style selection
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [stageEntryStyles, setStageEntryStyles] = useState<
    (EntryStyle | null)[]
  >(migrated?.stages?.map((s) => s.entry_style) || []);

  // Active stage tab in editor
  const [activeStageTab, setActiveStageTab] = useState<number>(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStageIdx, setGeneratingStageIdx] = useState<number>(-1);
  const [showPreview, setShowPreview] = useState(false);
  const [dignityWarning, setDignityWarning] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );

  // Total number of stages for the current experience type
  const totalStages = useMemo(() => {
    if (!experienceType) return 1;
    return experienceType === "multi_stage" ? stageCount : 1;
  }, [experienceType, stageCount]);

  // ── Generate scaffolds for all stages ──
  const generateAllStages = useCallback(
    async (entryStyles: (EntryStyle | null)[], total: number) => {
      const newStages: StageContent[] = [];

      for (let i = 0; i < total; i++) {
        setGeneratingStageIdx(i);
        const style = entryStyles[i] || "short_explanation";

        try {
          const scaffold = await onGenerateScaffold(
            moduleId,
            node.id,
            style,
            cognitiveDesign,
            node,
            total > 1 ? i + 1 : undefined,
            total > 1 ? total : undefined,
          );

          if (scaffold) {
            newStages.push({
              stage_number: i + 1,
              entry_style: style,
              blocks: scaffoldToBlocks(scaffold),
            });

            if (scaffold.dignity_warning) {
              setDignityWarning(scaffold.dignity_warning);
            }
          } else {
            // Generation failed — push empty stage
            newStages.push({
              stage_number: i + 1,
              entry_style: style,
              blocks: [],
            });
          }
        } catch (err) {
          console.error(`Scaffold generation failed for stage ${i + 1}:`, err);
          newStages.push({
            stage_number: i + 1,
            entry_style: style,
            blocks: [],
          });
        }
      }

      setStages(newStages);
      setGeneratingStageIdx(-1);
      setIsGenerating(false);
      setActiveStageTab(0);
      setPhase("editor");
    },
    [moduleId, node, cognitiveDesign, onGenerateScaffold],
  );

  // ── Experience Type Continue ──
  const handleExperienceTypeContinue = useCallback(() => {
    if (!experienceType) return;

    const total = experienceType === "multi_stage" ? stageCount : 1;

    // Initialize stageEntryStyles for all stages
    const defaultStyle = defaultEntryStyleForType(experienceType);
    const styles: (EntryStyle | null)[] = Array.from(
      { length: total },
      () => defaultStyle,
    );
    setStageEntryStyles(styles);
    setCurrentStageIndex(0);

    // If there's a default entry style (simulation_led, dialogue_based),
    // skip entry style selection — go straight to generation
    if (defaultStyle) {
      // Pre-fill styles and start generating
      setPhase("generating");
      setIsGenerating(true);
      generateAllStages(styles, total);
    } else {
      setPhase("entry_style");
    }
  }, [experienceType, stageCount, generateAllStages]);

  // ── Per-Stage Entry Style Continue ──
  const handleEntryStyleSet = useCallback(
    (style: EntryStyle) => {
      const updated = [...stageEntryStyles];
      updated[currentStageIndex] = style;
      setStageEntryStyles(updated);
    },
    [stageEntryStyles, currentStageIndex],
  );

  const handleEntryStyleContinue = useCallback(() => {
    const nextIdx = currentStageIndex + 1;
    if (nextIdx < totalStages) {
      // Move to next stage's entry style
      setCurrentStageIndex(nextIdx);
    } else {
      // All entry styles selected — generate all scaffolds
      setPhase("generating");
      setIsGenerating(true);
      generateAllStages(stageEntryStyles, totalStages);
    }
  }, [currentStageIndex, totalStages, stageEntryStyles, generateAllStages]);

  // ── Update blocks for a specific stage ──
  const handleStageBlocksChange = useCallback(
    (stageIdx: number, newBlocks: ContentBlock[]) => {
      setStages((prev) =>
        prev.map((s, i) => (i === stageIdx ? { ...s, blocks: newBlocks } : s)),
      );
    },
    [],
  );

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!experienceType || stages.length === 0) return;

    setSaveStatus("idle");
    const success = await onSave(moduleId, node.id, experienceType, stages);
    setSaveStatus(success ? "saved" : "error");

    if (success) {
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, [moduleId, node.id, experienceType, stages, onSave]);

  // ── Regenerate ──
  const handleRegenerate = useCallback(() => {
    setPhase("experience_type");
    setSaveStatus("idle");
  }, []);

  // ── Generate content for a single stage via AI ──
  const handleGenerateStage = useCallback(
    async (stageIdx: number) => {
      const stage = stages[stageIdx];
      if (!stage) return;

      setIsGenerating(true);
      setGeneratingStageIdx(stageIdx);

      try {
        const scaffold = await onGenerateScaffold(
          moduleId,
          node.id,
          stage.entry_style || "short_explanation",
          cognitiveDesign,
          node,
          stages.length > 1 ? stageIdx + 1 : undefined,
          stages.length > 1 ? stages.length : undefined,
        );

        if (scaffold) {
          const newBlocks = scaffoldToBlocks(scaffold);
          setStages((prev) =>
            prev.map((s, i) =>
              i === stageIdx ? { ...s, blocks: newBlocks } : s,
            ),
          );
          if (scaffold.dignity_warning) {
            setDignityWarning(scaffold.dignity_warning);
          }
        }
      } catch (err) {
        console.error(`Stage ${stageIdx + 1} generation failed:`, err);
      } finally {
        setIsGenerating(false);
        setGeneratingStageIdx(-1);
      }
    },
    [stages, moduleId, node, cognitiveDesign, onGenerateScaffold],
  );

  // ── Generate content for a single block via AI ──
  const handleGenerateBlock = useCallback(
    async (blockId: string, blockType: BlockType) => {
      if (!onGenerateBlockContent) return;

      const currentStage = stages[activeStageTab];
      if (!currentStage) return;

      // Gather existing blocks as context
      const existingBlocks = currentStage.blocks
        .filter((b) => b.id !== blockId && b.content)
        .map((b) => ({ type: b.type, content: b.content }));

      const content = await onGenerateBlockContent(
        blockType,
        node.title,
        node.description || "",
        currentStage.entry_style || "short_explanation",
        node.depth_level || 3,
        existingBlocks,
      );

      if (content) {
        setStages((prev) =>
          prev.map((s, i) =>
            i === activeStageTab
              ? {
                  ...s,
                  blocks: s.blocks.map((b) =>
                    b.id === blockId ? { ...b, content } : b,
                  ),
                }
              : s,
          ),
        );
      }
    },
    [stages, activeStageTab, node, onGenerateBlockContent],
  );

  // ── Aggregate content for misconception detection ──
  const allBlockContent = useMemo(
    () => stages.flatMap((s) => s.blocks.map((b) => b.content)).join(" "),
    [stages],
  );

  // ── Active stage blocks (for editor tab) ──
  const activeStage = stages[activeStageTab] || null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex bg-black/30 backdrop-blur-sm"
      >
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="ml-auto w-full max-w-4xl h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {(phase === "editor" || phase === "entry_style") && (
                <button
                  onClick={
                    phase === "entry_style" && currentStageIndex > 0
                      ? () => setCurrentStageIndex((p) => p - 1)
                      : handleRegenerate
                  }
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={
                    phase === "entry_style" && currentStageIndex > 0
                      ? "Previous stage"
                      : "Change experience type"
                  }
                >
                  <ChevronLeft className="w-5 h-5 text-gray-500" />
                </button>
              )}
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-xl">{node.emoji || "📘"}</span>
                  Design Node: {node.title}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Depth Level {node.depth_level} ·{" "}
                  {node.estimated_time || "~5 min"}
                  {experienceType && (
                    <span className="ml-2 text-violet-500 dark:text-violet-400">
                      · {experienceType.replace(/_/g, " ")}
                      {totalStages > 1 && ` (${totalStages} stages)`}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Save Status */}
              <AnimatePresence mode="wait">
                {saveStatus === "saved" && (
                  <motion.span
                    key="saved"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1 text-xs font-medium text-emerald-600"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Saved
                  </motion.span>
                )}
                {saveStatus === "error" && (
                  <motion.span
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-red-500"
                  >
                    Save failed
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Action Buttons (only in editor phase) */}
              {phase === "editor" && (
                <>
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title="Regenerate scaffold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview as Student
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={
                      isSaving || stages.every((s) => s.blocks.length === 0)
                    }
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save Draft
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-hidden flex">
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AnimatePresence mode="wait">
                {/* Phase: Experience Type Selection */}
                {phase === "experience_type" && (
                  <motion.div
                    key="experience-type"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="max-w-xl mx-auto"
                  >
                    <ExperienceTypeSelector
                      nodeTitle={node.title}
                      selected={experienceType}
                      onSelect={setExperienceType}
                      stageCount={stageCount}
                      onStageCountChange={setStageCount}
                      onContinue={handleExperienceTypeContinue}
                    />
                  </motion.div>
                )}

                {/* Phase: Per-Stage Entry Style Selection */}
                {phase === "entry_style" && (
                  <motion.div
                    key={`entry-style-${currentStageIndex}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="max-w-xl mx-auto"
                  >
                    {totalStages > 1 && (
                      <div className="flex items-center justify-center gap-2 mb-4">
                        {Array.from({ length: totalStages }, (_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i === currentStageIndex
                                ? "bg-violet-500"
                                : i < currentStageIndex
                                  ? "bg-violet-300 dark:bg-violet-700"
                                  : "bg-gray-300 dark:bg-gray-600"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <EntryStyleSelector
                      nodeTitle={node.title}
                      selected={stageEntryStyles[currentStageIndex] || null}
                      onSelect={handleEntryStyleSet}
                      onContinue={handleEntryStyleContinue}
                      stageLabel={
                        totalStages > 1
                          ? `Stage ${currentStageIndex + 1}`
                          : undefined
                      }
                    />
                  </motion.div>
                )}

                {/* Phase: Generating */}
                {phase === "generating" && (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full gap-6"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Infinity,
                        duration: 2,
                        ease: "linear",
                      }}
                    >
                      <Sparkles className="w-12 h-12 text-blue-500" />
                    </motion.div>
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Generating Content Scaffold
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                        {totalStages > 1
                          ? `Building stage ${generatingStageIdx + 1} of ${totalStages} for "${node.title}"...`
                          : `Designing a structured scaffold for "${node.title}"...`}
                      </p>
                    </div>
                    {/* Stage progress dots */}
                    {totalStages > 1 && (
                      <div className="flex gap-2">
                        {Array.from({ length: totalStages }, (_, i) => (
                          <motion.div
                            key={i}
                            className={`w-3 h-3 rounded-full ${
                              i < generatingStageIdx
                                ? "bg-emerald-500"
                                : i === generatingStageIdx
                                  ? "bg-blue-500"
                                  : "bg-gray-300 dark:bg-gray-600"
                            }`}
                            animate={
                              i === generatingStageIdx
                                ? { scale: [1, 1.3, 1] }
                                : {}
                            }
                            transition={{
                              repeat: Infinity,
                              duration: 0.8,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2.5 h-2.5 rounded-full bg-blue-500"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{
                            repeat: Infinity,
                            duration: 1.2,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Phase: Block Editor */}
                {phase === "editor" && (
                  <motion.div
                    key="editor"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    {/* Node Description */}
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {node.description}
                      </p>
                      {experienceType && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">
                            {experienceType.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-gray-400">
                            Depth {cognitiveDesign.allowed_depth_range.min}–
                            {cognitiveDesign.allowed_depth_range.max}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Stage Tabs (only for multi-stage) */}
                    {stages.length > 1 && (
                      <div className="flex items-center gap-1 mb-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        {stages.map((stage, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveStageTab(idx)}
                            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                              activeStageTab === idx
                                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                          >
                            Stage {stage.stage_number}
                            {stage.blocks.length > 0 && (
                              <CheckCircle2 className="inline w-3 h-3 ml-1 text-emerald-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Active Stage Entry Style Badge */}
                    {activeStage && (
                      <div className="mb-4 flex items-center gap-2">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                          Entry: {activeStage.entry_style.replace(/_/g, " ")}
                        </span>
                        {stages.length > 1 && (
                          <span className="text-xs text-gray-400">
                            Stage {activeStage.stage_number} of {stages.length}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Block Editor for Active Stage */}
                    {activeStage && (
                      <BlockEditor
                        blocks={activeStage.blocks}
                        onBlocksChange={(newBlocks) =>
                          handleStageBlocksChange(activeStageTab, newBlocks)
                        }
                        socraticIntensity={cognitiveDesign.socratic_intensity}
                        maxDepth={cognitiveDesign.allowed_depth_range.max}
                        dignityWarning={dignityWarning}
                        onGenerateBlock={
                          onGenerateBlockContent
                            ? handleGenerateBlock
                            : undefined
                        }
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Misconception Side Panel ── */}
            {phase === "editor" && misconceptions.length > 0 && (
              <div className="w-72 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800/30">
                <MisconceptionPanel
                  misconceptions={misconceptions}
                  nodes={allNodes}
                  currentNodeId={node.id}
                  currentContent={allBlockContent}
                />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* ── Student Preview Modal ── */}
      <AnimatePresence>
        {showPreview && (
          <StudentPreview
            stages={stages}
            nodeTitle={node.title}
            nodeEmoji={node.emoji}
            maxDepth={cognitiveDesign.allowed_depth_range.max}
            beautyPermission={cognitiveDesign.beauty_permission}
            socraticIntensity={cognitiveDesign.socratic_intensity}
            onClose={() => setShowPreview(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default NodeContentBuilder;
