// ============================================================
// Node Graph Editor — Card-based interactive editor for teachers
// Matches Eureka's design language with same animations
// ============================================================

import React, { useState, useMemo, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Edit3,
  Link2,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  NodeGraph,
  GeneratedNode,
  NodeEdge,
  ConceptScope,
} from "@/types/custom-module";
import {
  isDAG,
  hasSynthesisNode,
  wouldCreateCycle,
  validateGraph,
} from "@/utils/graph-validation";

// ── Node Type Colors (matching ConceptNode typeColors) ──

const depthColors: Record<number, string> = {
  1: "border-green-400 bg-green-50/50 dark:bg-green-900/15",
  2: "border-blue-400 bg-blue-50/50 dark:bg-blue-900/15",
  3: "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/15",
  4: "border-purple-400 bg-purple-50/50 dark:bg-purple-900/15",
  5: "border-amber-400 bg-amber-50/50 dark:bg-amber-900/15",
  6: "border-orange-400 bg-orange-50/50 dark:bg-orange-900/15",
  7: "border-red-400 bg-red-50/50 dark:bg-red-900/15",
};

const depthLabels: Record<number, string> = {
  1: "Foundation",
  2: "Exploration",
  3: "Connection",
  4: "Deepening",
  5: "Application",
  6: "Integration",
  7: "Mastery",
};

// ── Props ──

interface NodeGraphEditorProps {
  graph: NodeGraph;
  moduleInfo: ConceptScope;
  onConfirm: (graph: NodeGraph) => void;
  onBack: () => void;
  isSaving?: boolean;
  /** When true, skips the "Cognitive Sequencing Generated" overlay */
  isEditing?: boolean;
}

// ── Component ──

const NodeGraphEditor: FC<NodeGraphEditorProps> = ({
  graph: initialGraph,
  moduleInfo,
  onConfirm,
  onBack,
  isSaving = false,
  isEditing = false,
}) => {
  const [nodes, setNodes] = useState<GeneratedNode[]>([...initialGraph.nodes]);
  const [edges, setEdges] = useState<NodeEdge[]>([...initialGraph.edges]);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [addingEdge, setAddingEdge] = useState<{
    from: string;
    step: "select-to";
  } | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [newNodeDescription, setNewNodeDescription] = useState("");
  const [newNodeDepth, setNewNodeDepth] = useState(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(!isEditing);

  // Dismiss generation overlay after 2s (only for initial creation)
  React.useEffect(() => {
    if (isEditing) return;
    const t = setTimeout(() => setShowOverlay(false), 2000);
    return () => clearTimeout(t);
  }, [isEditing]);

  // Current graph state
  const currentGraph = useMemo<NodeGraph>(
    () => ({ nodes, edges }),
    [nodes, edges],
  );

  // Validation
  const validationErrors = useMemo(
    () => validateGraph(currentGraph),
    [currentGraph],
  );
  const isValid = validationErrors.length === 0;

  // Terminal nodes (synthesis candidates)
  const terminalNodeIds = useMemo(() => {
    const outDegree = new Map<string, number>();
    nodes.forEach((n) => outDegree.set(n.id, 0));
    edges.forEach((e) =>
      outDegree.set(e.from, (outDegree.get(e.from) || 0) + 1),
    );
    return new Set(
      Array.from(outDegree.entries())
        .filter(([, d]) => d === 0)
        .map(([id]) => id),
    );
  }, [nodes, edges]);

  // Root nodes (no incoming edges)
  const rootNodeIds = useMemo(() => {
    const hasIncoming = new Set(edges.map((e) => e.to));
    return new Set(
      nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id),
    );
  }, [nodes, edges]);

  // ── Handlers ──

  const startEditNode = (node: GeneratedNode) => {
    setEditingNode(node.id);
    setEditTitle(node.title);
    setEditDescription(node.description);
  };

  const saveEditNode = () => {
    if (!editingNode) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === editingNode
          ? {
              ...n,
              title: editTitle.trim(),
              description: editDescription.trim(),
            }
          : n,
      ),
    );
    setEditingNode(null);
    setErrorMessage(null);
  };

  const deleteNode = (nodeId: string) => {
    // Cannot delete if it's the only terminal node
    if (terminalNodeIds.has(nodeId) && terminalNodeIds.size === 1) {
      setErrorMessage(
        "Cannot delete the only synthesis node. Add another terminal node first.",
      );
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    // Cannot delete root nodes
    if (rootNodeIds.has(nodeId) && rootNodeIds.size === 1) {
      setErrorMessage("Cannot delete the only root node.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (nodes.length <= 2) {
      setErrorMessage("Graph must have at least 2 nodes.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) =>
      prev.filter((e) => e.from !== nodeId && e.to !== nodeId),
    );
    setErrorMessage(null);
  };

  const addNode = () => {
    if (nodes.length >= 10) {
      setErrorMessage("Maximum 10 nodes allowed.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    if (!newNodeTitle.trim()) return;

    const newNode: GeneratedNode = {
      id: `node-new-${Date.now()}`,
      title: newNodeTitle.trim(),
      description: newNodeDescription.trim() || "New concept node",
      depth_level: newNodeDepth,
      prerequisites: [],
      emoji: "📝",
      estimated_time: "~5 min",
      discover_points: [],
    };

    setNodes((prev) => [...prev, newNode]);
    setNewNodeTitle("");
    setNewNodeDescription("");
    setNewNodeDepth(3);
    setShowAddNode(false);
    setErrorMessage(null);
  };

  const startAddEdge = (fromId: string) => {
    setAddingEdge({ from: fromId, step: "select-to" });
    setErrorMessage(null);
  };

  const completeAddEdge = (toId: string) => {
    if (!addingEdge) return;

    if (addingEdge.from === toId) {
      setErrorMessage("Cannot create a self-loop.");
      setTimeout(() => setErrorMessage(null), 3000);
      setAddingEdge(null);
      return;
    }

    // Check duplicate
    if (edges.some((e) => e.from === addingEdge.from && e.to === toId)) {
      setErrorMessage("This connection already exists.");
      setTimeout(() => setErrorMessage(null), 3000);
      setAddingEdge(null);
      return;
    }

    // Check cycle
    if (wouldCreateCycle(currentGraph, addingEdge.from, toId)) {
      setErrorMessage("That connection breaks cognitive sequencing.");
      setTimeout(() => setErrorMessage(null), 3000);
      setAddingEdge(null);
      return;
    }

    setEdges((prev) => [...prev, { from: addingEdge.from, to: toId }]);
    setAddingEdge(null);
    setErrorMessage(null);
  };

  const removeEdge = (from: string, to: string) => {
    const newEdges = edges.filter((e) => !(e.from === from && e.to === to));
    // Check if removing breaks synthesis node requirement
    const tempGraph: NodeGraph = { nodes, edges: newEdges };
    if (!hasSynthesisNode(tempGraph)) {
      setErrorMessage(
        "Removing this connection would break the synthesis node requirement.",
      );
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    setEdges(newEdges);
    setErrorMessage(null);
  };

  const handleConfirm = () => {
    if (!isValid) {
      setErrorMessage(`Cannot save: ${validationErrors[0]}`);
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    // Sync each node's prerequisites array from the current edges
    const syncedNodes = nodes.map((n) => ({
      ...n,
      prerequisites: edges.filter((e) => e.to === n.id).map((e) => e.from),
    }));
    onConfirm({ nodes: syncedNodes, edges });
  };

  // Order nodes by topological position for display
  const orderedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => a.depth_level - b.depth_level);
  }, [nodes]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      {/* Generation Overlay */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-12 h-12 text-violet-400" />
              </motion.div>
              <p className="text-lg font-semibold text-white">
                Cognitive Sequencing Generated
              </p>
              <p className="text-sm text-gray-300">
                {nodes.length} nodes • {edges.length} connections
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {moduleInfo.module_title}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Edit the learning map • {nodes.length} nodes • {edges.length}{" "}
                connections
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isValid && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {validationErrors.length} issue
                {validationErrors.length > 1 ? "s" : ""}
              </span>
            )}
            <Button
              onClick={handleConfirm}
              disabled={!isValid || isSaving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Confirm & Continue
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-6 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  {errorMessage}
                </p>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="ml-auto p-1 hover:text-red-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edge selection hint */}
        <AnimatePresence>
          {addingEdge && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-6 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-500" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Click a target node to connect from "
                  {nodes.find((n) => n.id === addingEdge.from)?.title}"
                </p>
                <button
                  onClick={() => setAddingEdge(null)}
                  className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Node Cards */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">
            {orderedNodes.map((node, idx) => {
              const isTerminal = terminalNodeIds.has(node.id);
              const isRoot = rootNodeIds.has(node.id);
              const isEditing = editingNode === node.id;
              const nodeEdgesFrom = edges.filter((e) => e.from === node.id);
              const nodeEdgesTo = edges.filter((e) => e.to === node.id);
              const depthColor =
                depthColors[node.depth_level] ||
                "border-gray-300 bg-gray-50/50";
              const depthLabel =
                depthLabels[node.depth_level] || `Depth ${node.depth_level}`;

              return (
                <motion.div
                  key={node.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className={`relative rounded-xl border-2 p-4 transition-all duration-200 ${depthColor} ${
                    addingEdge
                      ? addingEdge.from === node.id
                        ? "ring-2 ring-blue-400 opacity-60"
                        : "cursor-pointer hover:ring-2 hover:ring-blue-300"
                      : ""
                  }`}
                  onClick={() => {
                    if (addingEdge && addingEdge.from !== node.id) {
                      completeAddEdge(node.id);
                    }
                  }}
                >
                  {/* Node Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-2xl flex-shrink-0">
                        {node.emoji || "📘"}
                      </span>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="text-sm font-semibold"
                              autoFocus
                            />
                            <textarea
                              value={editDescription}
                              onChange={(e) =>
                                setEditDescription(e.target.value)
                              }
                              rows={2}
                              className="w-full text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={saveEditNode}
                                className="bg-violet-600 hover:bg-violet-700 text-white text-xs"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingNode(null)}
                                className="text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {node.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                              {node.description}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Meta badges & actions */}
                    {!isEditing && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/70 dark:bg-gray-800/70 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                          {depthLabel}
                        </span>
                        {node.estimated_time && (
                          <span className="text-[10px] text-gray-400">
                            {node.estimated_time}
                          </span>
                        )}
                        {isTerminal && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            Synthesis
                          </span>
                        )}
                        {isRoot && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            Root
                          </span>
                        )}

                        <div className="flex items-center gap-0.5 ml-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditNode(node);
                            }}
                            className="p-1.5 rounded-md hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors"
                            title="Edit node"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startAddEdge(node.id);
                            }}
                            className="p-1.5 rounded-md hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors"
                            title="Add connection"
                          >
                            <Link2 className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNode(node.id);
                            }}
                            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete node"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Misconceptions */}
                  {node.addresses_misconception &&
                    node.addresses_misconception.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {node.addresses_misconception.map((m, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
                          >
                            ⚠ {m}
                          </span>
                        ))}
                      </div>
                    )}

                  {/* Connections */}
                  {(nodeEdgesFrom.length > 0 || nodeEdgesTo.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {nodeEdgesTo.map((e) => {
                        const sourceNode = nodes.find((n) => n.id === e.from);
                        return (
                          <span
                            key={`in-${e.from}`}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                          >
                            ← {sourceNode?.title || e.from}
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                removeEdge(e.from, e.to);
                              }}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                      {nodeEdgesFrom.map((e) => {
                        const targetNode = nodes.find((n) => n.id === e.to);
                        return (
                          <span
                            key={`out-${e.to}`}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400"
                          >
                            → {targetNode?.title || e.to}
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                removeEdge(e.from, e.to);
                              }}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Add Node */}
          <div className="mt-4">
            <AnimatePresence>
              {showAddNode ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 p-4 space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Add New Node
                    </h4>
                    <Input
                      value={newNodeTitle}
                      onChange={(e) => setNewNodeTitle(e.target.value)}
                      placeholder="Node title"
                      className="w-full"
                    />
                    <Input
                      value={newNodeDescription}
                      onChange={(e) => setNewNodeDescription(e.target.value)}
                      placeholder="Brief description"
                      className="w-full"
                    />
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Depth Level: {newNodeDepth}
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={7}
                        value={newNodeDepth}
                        onChange={(e) =>
                          setNewNodeDepth(Number(e.target.value))
                        }
                        className="w-full accent-violet-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={addNode}
                        disabled={!newNodeTitle.trim() || nodes.length >= 10}
                        className="bg-violet-600 hover:bg-violet-700 text-white text-xs"
                      >
                        Add Node
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAddNode(false)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => setShowAddNode(true)}
                  disabled={nodes.length >= 10}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50/30 dark:hover:bg-violet-900/10 transition-all duration-200 text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Node ({nodes.length}/10)
                </button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NodeGraphEditor;
