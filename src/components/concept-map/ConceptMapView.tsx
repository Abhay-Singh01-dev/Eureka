import React, { useState, useEffect, useMemo, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Info, Edit3 } from "lucide-react";
import ConceptNode from "./ConceptNode";
import NodeConnections from "./NodeConnections";
import NodeContent from "./NodeContent";
import NodeContentBuilder from "../module/NodeContentBuilder";
import NodeGraphEditor from "../module/NodeGraphEditor";
import CustomNodeContent from "../module/CustomNodeContent";
import { migrateNodeContent } from "@/types/custom-module";
import {
  motionAndForcesNodes,
  nodeConnections as defaultConnections,
  initialProgress,
} from "./nodeData";
import {
  motionForcesNodes,
  type ConceptNode as NodeMetadata,
} from "@/data/motionForcesNodes";
import type {
  Chapter,
  ConceptNodeData,
  NodeConnection,
  NodeState,
  Progress,
} from "@/types";
import type {
  CustomModule,
  NodeGraph,
  EntryStyle,
  ExperienceType,
  BlockType,
  StageContent,
  CognitiveDesign,
  GeneratedNode,
  NodeScaffold,
  NodeContent as NodeContentType,
} from "@/types/custom-module";

interface ConceptMapViewProps {
  chapter: Chapter | null;
  onBack: () => void;
  /**
   * Optional enriched metadata for tooltip rendering.
   * Defaults to motionForcesNodes when not provided.
   */
  nodeMetadata?: NodeMetadata[];
  /** Dynamic nodes — when provided, overrides the default Motion & Forces nodes. */
  dynamicNodes?: ConceptNodeData[];
  /** Dynamic connections — required when dynamicNodes is provided. */
  dynamicConnections?: NodeConnection[];
  /** Initial node states — required when dynamicNodes is provided. */
  dynamicInitialStates?: Record<number, NodeState>;
  /** Initial progress — required when dynamicNodes is provided. */
  dynamicInitialProgress?: Progress;
  /** Full custom module object (for Phase C content builder) */
  customModule?: CustomModule | null;
  /** Whether node content is being saved */
  isContentSaving?: boolean;
  /** Generate scaffold for a node (stage-aware) */
  onGenerateScaffold?: (
    moduleId: string,
    nodeId: string,
    entryStyle: EntryStyle,
    cognitiveDesign: CognitiveDesign,
    nodeMetadata: GeneratedNode,
    stageNumber?: number,
    totalStages?: number,
  ) => Promise<NodeScaffold | null>;
  /** Save node content (stage-based) */
  onSaveNodeContent?: (
    moduleId: string,
    nodeId: string,
    experienceType: ExperienceType,
    stages: StageContent[],
  ) => Promise<boolean>;
  /** Reverse mapping: numeric ConceptNodeData.id → original string node ID */
  idMapping?: Record<number, string>;
  /** Generate AI content for a single block */
  onGenerateBlockContent?: (
    blockType: BlockType,
    nodeTitle: string,
    nodeDescription: string,
    entryStyle: string,
    depthLevel: number,
    existingBlocks?: { type: string; content: string }[],
  ) => Promise<string | null>;
  /** Update node graph for a custom module */
  onUpdateGraph?: (moduleId: string, graph: NodeGraph) => Promise<boolean>;
}

const ConceptMapView: FC<ConceptMapViewProps> = ({
  chapter,
  onBack,
  nodeMetadata = motionForcesNodes,
  dynamicNodes,
  dynamicConnections,
  dynamicInitialStates,
  dynamicInitialProgress,
  customModule,
  isContentSaving = false,
  onGenerateScaffold,
  onSaveNodeContent,
  idMapping,
  onGenerateBlockContent,
  onUpdateGraph,
}) => {
  // Determine which data source to use
  const isCustom = !!dynamicNodes;
  const baseNodes = useMemo(
    () => dynamicNodes || motionAndForcesNodes,
    [dynamicNodes],
  );
  const connections = useMemo(
    () => dynamicConnections || defaultConnections,
    [dynamicConnections],
  );
  const defaultStates = useMemo<Record<number, NodeState>>(() => {
    if (dynamicInitialStates) return dynamicInitialStates;
    return {
      1: "completed",
      2: "unlocked",
      3: "unlocked",
      4: "locked",
      5: "locked",
      6: "locked",
      7: "locked",
      8: "locked",
    };
  }, [dynamicInitialStates]);
  const defaultProgress = useMemo(
    () => dynamicInitialProgress || initialProgress,
    [dynamicInitialProgress],
  );

  const [selectedNode, setSelectedNode] = useState<ConceptNodeData | null>(
    null,
  );
  const [currentView, setCurrentView] = useState<"map" | "content">("map");
  const [mapExpanded, setMapExpanded] = useState<boolean>(true);
  const [nodeStates, setNodeStates] =
    useState<Record<number, NodeState>>(defaultStates);
  const [progress, setProgress] = useState<Progress>(defaultProgress);
  // Phase C: Show content builder for custom module nodes
  const [showContentBuilder, setShowContentBuilder] = useState(false);
  const [activeBuilderNodeId, setActiveBuilderNodeId] = useState<string | null>(
    null,
  );
  // Node graph editor overlay
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [isUpdatingGraph, setIsUpdatingGraph] = useState(false);

  // Reset state when the underlying data source changes (switching modules)
  useEffect(() => {
    setNodeStates(defaultStates);
    setProgress(defaultProgress);
    setSelectedNode(null);
    setCurrentView("map");
    setMapExpanded(true);
    setShowContentBuilder(false);
    setActiveBuilderNodeId(null);
    setShowNodeEditor(false);
  }, [defaultStates, defaultProgress]);
  const [collapseTimeout, setCollapseTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [showHint, setShowHint] = useState<boolean>(() => {
    const dismissed = localStorage.getItem("eureka-map-hint-dismissed");
    return !dismissed;
  });

  // Auto-collapse map after 5 seconds when content is visible
  useEffect(() => {
    if (currentView === "content" && mapExpanded) {
      const timeout = setTimeout(() => {
        setMapExpanded(false);
      }, 5000);
      setCollapseTimeout(timeout);
      return () => clearTimeout(timeout);
    }
  }, [currentView, mapExpanded]);

  const handleNodeClick = (node: ConceptNodeData) => {
    // For custom modules
    if (isCustom && customModule) {
      const originalId = idMapping?.[node.id] ?? node.id.toString();
      const rawContent = customModule.node_contents?.[originalId];

      // If the node has saved content → show screen-style student view
      if (rawContent) {
        const migrated = migrateNodeContent(rawContent);
        const hasBlocks = migrated.stages?.some((s) => s.blocks.length > 0);
        if (hasBlocks) {
          setActiveBuilderNodeId(originalId);
          setSelectedNode(node);
          setCurrentView("content");
          setMapExpanded(true);
          if (collapseTimeout) clearTimeout(collapseTimeout);
          return;
        }
      }

      // No content yet → open the builder directly (teacher mode)
      if (onGenerateScaffold && onSaveNodeContent) {
        setActiveBuilderNodeId(originalId);
        setShowContentBuilder(true);
      }
      return;
    }

    // Default modules
    setSelectedNode(node);
    setCurrentView("content");
    setMapExpanded(true);

    // Clear any existing timeout
    if (collapseTimeout) {
      clearTimeout(collapseTimeout);
    }
  };

  const handleBackToMap = () => {
    setCurrentView("map");
    setSelectedNode(null);
    setMapExpanded(true);
    setShowContentBuilder(false);
    setActiveBuilderNodeId(null);
  };

  const handleMarkComplete = (nodeId: number) => {
    // Update node state to completed
    setNodeStates((prev) => {
      const newStates: Record<number, NodeState> = {
        ...prev,
        [nodeId]: "completed",
      };

      // Unlock next nodes
      const node = baseNodes.find((n) => n.id === nodeId);
      if (node) {
        node.unlocks.forEach((nextId) => {
          if (newStates[nextId] === "locked") {
            newStates[nextId] = "unlocked";
          }
        });
      }

      return newStates;
    });

    const completedCount =
      Object.values(nodeStates).filter((s) => s === "completed").length + 1;
    setProgress({
      completedNodes: completedCount,
      totalNodes: baseNodes.length,
      progressPercentage: (completedCount / baseNodes.length) * 100,
    });

    // Show success message (you can add a toast here)
    console.log("🎉 Concept mastered! New paths unlocked.");
  };

  const handleMapHover = () => {
    if (!mapExpanded && currentView === "content") {
      setMapExpanded(true);
    }
  };

  const handleMapLeave = () => {
    // Don't auto-collapse on mouse leave - only when user moves away
  };

  const dismissHint = () => {
    setShowHint(false);
    localStorage.setItem("eureka-map-hint-dismissed", "true");
  };

  // Update nodes with current states
  const updatedNodes = baseNodes.map((node) => ({
    ...node,
    state: nodeStates[node.id],
  }));

  const getRecommendedNext = (): ConceptNodeData | undefined => {
    const unlockedNodes = updatedNodes.filter((n) => n.state === "unlocked");
    return unlockedNodes[0];
  };

  const recommendedNode = getRecommendedNext();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Concept Map Container */}
      <motion.div
        className={`concept-map-container bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0 ${
          currentView === "content" && !mapExpanded ? "collapsed" : ""
        }`}
        animate={{
          width: currentView === "map" ? "100%" : mapExpanded ? "28%" : "60px",
        }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        onMouseEnter={handleMapHover}
        onMouseLeave={handleMapLeave}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                {!mapExpanded && currentView === "content" ? null : (
                  <span className="text-sm font-medium">Back</span>
                )}
              </button>
              {!mapExpanded && currentView === "content" ? null : (
                <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Info className="w-5 h-5 text-gray-500" />
                </button>
              )}
            </div>

            {!mapExpanded && currentView === "content" ? null : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{chapter?.icon || "🏃"}</span>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white flex-1">
                    {chapter?.name || "Motion & Forces"}
                  </h1>
                  {isCustom && customModule && onUpdateGraph && (
                    <button
                      onClick={() => setShowNodeEditor(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200"
                      title="Edit concept nodes"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Nodes
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Exploring {chapter?.name || "Motion & Forces"}
                  </div>
                  {showHint && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center justify-between gap-3 px-3 py-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg"
                    >
                      <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                        Start anywhere — follow what makes you curious
                      </p>
                      <button
                        onClick={dismissHint}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium whitespace-nowrap"
                      >
                        Got it
                      </button>
                    </motion.div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Node Map Canvas */}
        {!mapExpanded && currentView === "content" ? (
          <div className="p-2 space-y-2">
            {updatedNodes.map((node) => (
              <ConceptNode
                key={node.id}
                node={node}
                onClick={handleNodeClick}
                isActive={selectedNode?.id === node.id}
                isCollapsed={true}
                metadata={nodeMetadata.find((m) => m.id === node.id)}
              />
            ))}
          </div>
        ) : (
          <div className="relative p-8" style={{ minHeight: "1000px" }}>
            <NodeConnections
              nodes={updatedNodes}
              nodeStates={nodeStates}
              connections={connections}
            />
            <div
              className={
                currentView === "content" && selectedNode ? "relative" : ""
              }
            >
              {updatedNodes.map((node) => {
                const isNodeSelected = selectedNode?.id === node.id;
                const shouldFade =
                  currentView === "content" && selectedNode && !isNodeSelected;
                return (
                  <motion.div
                    key={node.id}
                    animate={{ opacity: shouldFade ? 0.3 : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ConceptNode
                      node={node}
                      onClick={handleNodeClick}
                      isActive={isNodeSelected}
                      isCollapsed={false}
                      metadata={nodeMetadata.find((m) => m.id === node.id)}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Content Area — Custom Module Student View */}
      <AnimatePresence>
        {currentView === "content" &&
          selectedNode &&
          isCustom &&
          customModule &&
          activeBuilderNodeId &&
          !showContentBuilder &&
          (() => {
            const graphNode = customModule.node_graph.nodes.find(
              (n) => n.id === activeBuilderNodeId,
            );
            const rawContent =
              customModule.node_contents?.[activeBuilderNodeId];
            if (!graphNode || !rawContent) return null;
            const migrated = migrateNodeContent(rawContent);
            return (
              <CustomNodeContent
                node={graphNode}
                stages={migrated.stages}
                onBack={handleBackToMap}
                moduleTitle={customModule.blueprint.module_title}
                isExpanded={!mapExpanded}
                onEdit={
                  onGenerateScaffold && onSaveNodeContent
                    ? () => setShowContentBuilder(true)
                    : undefined
                }
              />
            );
          })()}
      </AnimatePresence>

      {/* Content Area — Default modules */}
      <AnimatePresence>
        {currentView === "content" && selectedNode && !isCustom && (
          <NodeContent
            node={selectedNode}
            onBack={handleBackToMap}
            onMarkComplete={handleMarkComplete}
            totalNodes={baseNodes.length}
            isExpanded={!mapExpanded}
          />
        )}
      </AnimatePresence>

      {/* Phase C: Content Builder (custom modules) */}
      <AnimatePresence>
        {showContentBuilder &&
          customModule &&
          activeBuilderNodeId &&
          onGenerateScaffold &&
          onSaveNodeContent &&
          (() => {
            const graphNode = customModule.node_graph.nodes.find(
              (n) => n.id === activeBuilderNodeId,
            );
            if (!graphNode) return null;
            const existingContent =
              customModule.node_contents?.[activeBuilderNodeId] || null;
            return (
              <NodeContentBuilder
                moduleId={customModule.id}
                node={graphNode}
                allNodes={customModule.node_graph.nodes}
                cognitiveDesign={customModule.cognitive_design}
                misconceptions={
                  customModule.objectives?.common_misconceptions || []
                }
                existingContent={existingContent}
                isSaving={isContentSaving}
                onGenerateScaffold={onGenerateScaffold}
                onSave={onSaveNodeContent}
                onGenerateBlockContent={onGenerateBlockContent}
                onClose={() => {
                  setShowContentBuilder(false);
                  // If the node has content, return to student view;
                  // otherwise go back to map
                  const nc =
                    customModule!.node_contents?.[activeBuilderNodeId!];
                  if (!nc) {
                    setActiveBuilderNodeId(null);
                    setCurrentView("map");
                    setSelectedNode(null);
                    setMapExpanded(true);
                  }
                }}
              />
            );
          })()}
      </AnimatePresence>

      {/* Node Graph Editor Overlay */}
      {showNodeEditor && isCustom && customModule && onUpdateGraph && (
        <NodeGraphEditor
          graph={customModule.node_graph}
          moduleInfo={customModule.blueprint}
          isEditing={true}
          isSaving={isUpdatingGraph}
          onConfirm={async (updatedGraph) => {
            setIsUpdatingGraph(true);
            try {
              const success = await onUpdateGraph(
                customModule.id,
                updatedGraph,
              );
              if (success) {
                setShowNodeEditor(false);
                // Reset selection since node structure may have changed
                setSelectedNode(null);
                setCurrentView("map");
                setMapExpanded(true);
              }
            } finally {
              setIsUpdatingGraph(false);
            }
          }}
          onBack={() => setShowNodeEditor(false)}
        />
      )}
    </div>
  );
};

export default ConceptMapView;
