// ============================================================
// BlockEditor — Step 3 of Node Content Builder
// Drag-reorderable, type-aware block editor with enforcement rules
// ============================================================

import React, { useState, useCallback, type FC } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  GripVertical,
  Trash2,
  Plus,
  Lock,
  BookOpen,
  HelpCircle,
  FlaskConical,
  Play,
  Film,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { ContentBlock, BlockType } from "@/types/custom-module";

// ── Block Type Config ──

interface BlockConfig {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  placeholder: string;
}

const BLOCK_CONFIGS: Record<BlockType, BlockConfig> = {
  entry: {
    type: "entry",
    label: "Entry Block",
    icon: <BookOpen className="w-4 h-4" />,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-l-blue-500",
    placeholder:
      "The opening of this node — how students first encounter the concept...",
  },
  explanation: {
    type: "explanation",
    label: "Explanation",
    icon: <BookOpen className="w-4 h-4" />,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-l-emerald-500",
    placeholder: "Core explanation of the concept...",
  },
  micro_question: {
    type: "micro_question",
    label: "Micro-Question",
    icon: <HelpCircle className="w-4 h-4" />,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-900/20",
    borderColor: "border-l-violet-500",
    placeholder: "A thought-provoking question that challenges the student...",
  },
  simulation: {
    type: "simulation",
    label: "Simulation",
    icon: <FlaskConical className="w-4 h-4" />,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-l-amber-500",
    placeholder: "Description of an interactive simulation or experiment...",
  },
  quiz: {
    type: "quiz",
    label: "Quiz",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-900/20",
    borderColor: "border-l-rose-500",
    placeholder: "A check-for-understanding question...",
  },
  video: {
    type: "video",
    label: "Video",
    icon: <Play className="w-4 h-4" />,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-900/20",
    borderColor: "border-l-pink-500",
    placeholder: "Description of a video or animation for this concept...",
  },
  animation: {
    type: "animation",
    label: "Animation",
    icon: <Film className="w-4 h-4" />,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    borderColor: "border-l-orange-500",
    placeholder: "Description of a Manim-style visual animation...",
  },
};

const ADDABLE_TYPES: BlockType[] = [
  "explanation",
  "micro_question",
  "simulation",
  "animation",
  "quiz",
  "video",
];

// ── Depth Warning Detection ──

const ADVANCED_PATTERNS = [
  /\\frac\{/,
  /\\int/,
  /\\sum/,
  /\\partial/,
  /\\nabla/,
  /\\lim/,
  /\\infty/,
  /eigenvalue/i,
  /differential equation/i,
  /fourier/i,
  /laplacian/i,
  /hamiltonian/i,
  /tensor/i,
  /manifold/i,
  /topology/i,
  /isomorphism/i,
];

function detectDepthWarning(text: string, maxDepth: number): string | null {
  if (maxDepth >= 5) return null; // High depth range — no warning needed
  const matches = ADVANCED_PATTERNS.filter((p) => p.test(text));
  if (matches.length > 0) {
    return `This exceeds your selected depth range (max ${maxDepth}). Would you like to adjust depth settings?`;
  }
  return null;
}

// ── Block Item Component ──

interface BlockItemProps {
  block: ContentBlock;
  onChange: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  canDeleteSocratic: boolean;
  maxDepth: number;
  onGenerateBlock?: (blockId: string, blockType: BlockType) => Promise<void>;
}

const BlockItem: FC<BlockItemProps> = ({
  block,
  onChange,
  onDelete,
  canDeleteSocratic,
  maxDepth,
  onGenerateBlock,
}) => {
  const config = BLOCK_CONFIGS[block.type];
  const isLocked = block.locked || block.type === "entry";
  const depthWarning = detectDepthWarning(block.content, maxDepth);
  const [isGenerating, setIsGenerating] = useState(false);

  // Socratic blocks can't be deleted if socratic_intensity >= Moderate
  const canDelete =
    !isLocked && (block.type !== "micro_question" || canDeleteSocratic);

  const handleGenerate = async () => {
    if (!onGenerateBlock || isGenerating) return;
    setIsGenerating(true);
    try {
      await onGenerateBlock(block.id, block.type);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Reorder.Item value={block} dragListener={!isLocked} className="group">
      <motion.div
        layout
        className={`rounded-xl border ${config.borderColor} border-l-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-200`}
      >
        {/* Block Header */}
        <div
          className={`flex items-center gap-2 px-4 py-2.5 ${config.bgColor} rounded-t-xl`}
        >
          {/* Drag Handle */}
          {!isLocked ? (
            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}

          {/* Icon + Label */}
          <span className={config.color}>{config.icon}</span>
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
          {isLocked && (
            <span className="text-xs text-gray-400 ml-1">(locked)</span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Generate with AI */}
          {onGenerateBlock && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 text-white text-[11px] font-medium shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
              title="Generate content with AI"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>Generate with AI</span>
                </>
              )}
            </button>
          )}

          {/* Delete */}
          {canDelete && (
            <button
              onClick={() => onDelete(block.id)}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-150"
              title="Delete block"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          )}
        </div>

        {/* Block Content */}
        <div className="p-4 relative">
          <textarea
            value={block.content}
            onChange={(e) => onChange(block.id, e.target.value)}
            placeholder={config.placeholder}
            rows={Math.max(3, Math.ceil(block.content.length / 80))}
            className="w-full resize-none border-0 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0 leading-relaxed"
          />

          {/* Generating overlay on textarea */}
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-800/70 rounded-lg"
            >
              <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Writing content...
              </div>
            </motion.div>
          )}

          {/* Depth Warning */}
          {depthWarning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-2 flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {depthWarning}
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </Reorder.Item>
  );
};

// ── Add Block Dropdown ──

interface AddBlockDropdownProps {
  onAdd: (type: BlockType) => void;
}

const AddBlockDropdown: FC<AddBlockDropdownProps> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
      >
        <Plus className="w-4 h-4" />
        Add Block
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="mt-2 space-y-1 overflow-hidden"
          >
            {ADDABLE_TYPES.map((type) => {
              const config = BLOCK_CONFIGS[type];
              return (
                <button
                  key={type}
                  onClick={() => {
                    onAdd(type);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all duration-150 hover:shadow-sm ${config.bgColor} border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600`}
                >
                  <span className={config.color}>{config.icon}</span>
                  <span className={`text-sm font-medium ${config.color}`}>
                    {config.label}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main BlockEditor Component ──

interface BlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
  socraticIntensity: string;
  maxDepth: number;
  dignityWarning?: string | null;
  onGenerateBlock?: (blockId: string, blockType: BlockType) => Promise<void>;
}

const BlockEditor: FC<BlockEditorProps> = ({
  blocks,
  onBlocksChange,
  socraticIntensity,
  maxDepth,
  dignityWarning,
  onGenerateBlock,
}) => {
  // Socratic elements can't be deleted if intensity >= Moderate
  const canDeleteSocratic = socraticIntensity === "Light";

  const handleChange = useCallback(
    (id: string, content: string) => {
      onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
    },
    [blocks, onBlocksChange],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onBlocksChange(blocks.filter((b) => b.id !== id));
    },
    [blocks, onBlocksChange],
  );

  const handleAdd = useCallback(
    (type: BlockType) => {
      const newBlock: ContentBlock = {
        id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        content: "",
      };
      onBlocksChange([...blocks, newBlock]);
    },
    [blocks, onBlocksChange],
  );

  const handleReorder = useCallback(
    (reordered: ContentBlock[]) => {
      // Ensure entry block always stays first
      const entryBlock = reordered.find((b) => b.type === "entry");
      const rest = reordered.filter((b) => b.type !== "entry");
      if (entryBlock) {
        onBlocksChange([entryBlock, ...rest]);
      } else {
        onBlocksChange(reordered);
      }
    },
    [onBlocksChange],
  );

  return (
    <div className="space-y-4">
      {/* Dignity Warning */}
      {dignityWarning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl"
        >
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Tone Advisory
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {dignityWarning}
            </p>
          </div>
        </motion.div>
      )}

      {/* Block List */}
      <Reorder.Group
        axis="y"
        values={blocks}
        onReorder={handleReorder}
        className="space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {blocks.map((block) => (
            <BlockItem
              key={block.id}
              block={block}
              onChange={handleChange}
              onDelete={handleDelete}
              canDeleteSocratic={canDeleteSocratic}
              maxDepth={maxDepth}
              onGenerateBlock={onGenerateBlock}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* Add Block */}
      <AddBlockDropdown onAdd={handleAdd} />

      {/* Enforcement Note */}
      {!canDeleteSocratic && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center italic">
          Socratic elements cannot be removed (intensity: {socraticIntensity})
        </p>
      )}
    </div>
  );
};

export default BlockEditor;
