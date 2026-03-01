import React, { useState, useRef, useEffect, useMemo, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket } from "lucide-react";
import Sidebar from "@/components/sidebar/Sidebar";
import StreamingMessageBubble from "@/components/chat/StreamingMessageBubble";
import InputBox from "@/components/chat/InputBox";
import ConceptMapView from "@/components/concept-map/ConceptMapView";
import SearchDialog from "@/components/sidebar/SearchDialog";
import CustomModuleWizard from "@/components/module/CustomModuleWizard";
import NodeGraphEditor from "@/components/module/NodeGraphEditor";
import SimulationWizard from "@/components/simulation/SimulationWizard";
import SimulationBuilder from "@/components/simulation/SimulationBuilder";
import AnimationBlueprintWizard from "@/components/animation/AnimationBlueprintWizard";
import AnimationBuilder from "@/components/animation/AnimationBuilder";
import {
  useDashboardChat,
  type StreamingMessage,
} from "@/hooks/useDashboardChat";
import { useTTSAutoRead } from "@/hooks/useTTSAutoRead";
import { useCustomModules } from "@/hooks/useCustomModules";
import { useSimulations } from "@/hooks/useSimulations";
import { useAnimations } from "@/hooks/useAnimations";
import { customModuleToConceptMap } from "@/utils/custom-module-converter";
import type { Chapter, Conversation } from "@/types";
import type {
  ConceptScope,
  LearningObjectives,
  CognitiveDesign,
  NodeGraph,
} from "@/types/custom-module";
import type {
  SimulationBlueprint,
  SimulationDocument,
} from "@/types/simulation";
import type { AnimationBlueprint, AnimationDocument } from "@/types/animation";

// ── Suggested Questions (empty state) ─────────────────────────────────

interface SuggestedQuestion {
  emoji: string;
  text: string;
}

const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { emoji: "🌙", text: "Why doesn't the moon fall to Earth?" },
  { emoji: "🕳️", text: "How do black holes bend spacetime?" },
  { emoji: "💡", text: "What happens at the speed of light?" },
  { emoji: "🌈", text: "Why is the sky blue?" },
];

// ── Home Component ────────────────────────────────────────────────────

const Home: FC = () => {
  // Sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Concept map
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [showConceptMap, setShowConceptMap] = useState(false);

  // Search dialog
  const [showSearchDialog, setShowSearchDialog] = useState(false);

  // Custom module wizard & editor
  const [showWizard, setShowWizard] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorGraph, setEditorGraph] = useState<NodeGraph | null>(null);
  const [pendingScope, setPendingScope] = useState<ConceptScope | null>(null);
  const [pendingObjectives, setPendingObjectives] =
    useState<LearningObjectives | null>(null);
  const [pendingDesign, setPendingDesign] = useState<CognitiveDesign | null>(
    null,
  );
  // Active custom module being viewed (its ID)
  const [activeCustomModuleId, setActiveCustomModuleId] = useState<
    string | null
  >(null);

  // Simulation wizard & builder
  const [showSimWizard, setShowSimWizard] = useState(false);
  const [showSimBuilder, setShowSimBuilder] = useState(false);
  const [activeSimulation, setActiveSimulation] =
    useState<SimulationDocument | null>(null);

  // Animation wizard & builder
  const [showAnimWizard, setShowAnimWizard] = useState(false);
  const [showAnimBuilder, setShowAnimBuilder] = useState(false);
  const [animBlueprint, setAnimBlueprint] = useState<AnimationBlueprint | null>(
    null,
  );

  // Custom modules hook
  const {
    chapters: customModuleChapters,
    isGenerating,
    isSaving,
    generateMap,
    saveModule,
    deleteModule,
    getModule,
    generateScaffold,
    saveNodeContent,
    generateBlockContent,
    updateGraph,
  } = useCustomModules();

  // Simulations hook
  const {
    isGenerating: isSimGenerating,
    generateEngine,
    generateGuidance,
    saveSimulation,
    publishSimulation,
  } = useSimulations();

  // Animations hook
  const {
    isGenerating: isAnimGenerating,
    isSaving: isAnimSaving,
    generateSceneContent,
    refineNarration,
    saveAnimation,
    updateScenes,
    updateBlueprint,
    publishAnimation,
  } = useAnimations();

  // Recent conversations (loaded from API)
  const [recentConversations, setRecentConversations] = useState<
    Conversation[]
  >([]);

  // Auto-scroll refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Dashboard streaming chat hook
  const {
    messages,
    isStreaming,
    error,
    conversationId,
    sendMessage,
    startNewChat,
    loadConversation,
  } = useDashboardChat({
    onConversationCreated: () => {
      // Refresh sidebar after new conversation is created
      setTimeout(refreshConversations, 1500);
    },
  });

  // ── TTS auto-read ───────────────────────────────────────────────────
  const lastAssistantContent = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && !messages[i].isStreaming) {
        return messages[i].content;
      }
    }
    return undefined;
  }, [messages]);

  const { autoReadEnabled, toggleAutoRead, stopPlayback } = useTTSAutoRead({
    lastAssistantContent,
    isStreaming,
  });

  // ── Auto-scroll — throttled to ~10 Hz via RAF to prevent 60 fps thrash ──
  const scrollRafRef = useRef<number>(0);
  useEffect(() => {
    if (scrollRafRef.current) return; // already scheduled
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    });
    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = 0;
      }
    };
  }, [messages, isStreaming]);

  // ── Load recent conversations on mount ──
  useEffect(() => {
    refreshConversations();
  }, []);

  const refreshConversations = async () => {
    try {
      const res = await fetch("/api/dashboard/conversations");
      const data = await res.json();
      const mapped: Conversation[] = (data.conversations || []).map(
        (c: any) => ({
          id: c.conversation_id,
          title: c.title,
          created_date: new Date((c.updated_at || c.created_at) * 1000),
        }),
      );
      setRecentConversations(mapped);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  // ── Handlers ──

  const handleSendMessage = async (
    content: string,
    equations: string[] = [],
  ) => {
    let fullMessage = content;
    if (equations.length > 0) {
      fullMessage +=
        "\n\nEquations:\n" + equations.map((eq) => `$$${eq}$$`).join("\n");
    }

    // Switch to dashboard view if on concept map
    if (showConceptMap) {
      setShowConceptMap(false);
      setActiveChapter(null);
    }

    await sendMessage(fullMessage);

    // Refresh conversations after response
    setTimeout(refreshConversations, 2000);
  };

  const handleNewChat = () => {
    stopPlayback();
    startNewChat();
    setActiveChapter(null);
    setShowConceptMap(false);
  };

  const handleConversationSelect = async (conv: Conversation) => {
    setShowConceptMap(false);
    setActiveChapter(null);
    setShowSearchDialog(false);

    try {
      const res = await fetch(
        `/api/dashboard/conversations/${conv.id}/messages`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const msgs: StreamingMessage[] = (data.messages || []).map(
        (m: any, i: number) => ({
          id: i + 1,
          role: m.role as "user" | "assistant",
          content: m.content,
          images: (m.images || []).map((img: any) => ({
            base64: img.base64 || "",
            mime: img.mime || "image/png",
            description: img.description || "",
            insertAfterChar: img.insertAfterChar ?? 0,
            loading: false,
          })),
          videos: (m.videos || []).map((vid: any) => ({
            base64: vid.base64 || "",
            mime: vid.mime || "video/mp4",
            description: vid.description || "",
            insertAfterChar: vid.insertAfterChar ?? 0,
            loading: false,
          })),
          isStreaming: false,
          timestamp: new Date((m.timestamp || 0) * 1000),
        }),
      );

      loadConversation(conv.id, msgs);
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const handleChapterSelect = (chapter: Chapter) => {
    setActiveChapter(chapter);

    // Custom module — id starts with "cm-"
    if (chapter.id.startsWith("cm-")) {
      // Pass the full id (e.g. "cm-abc123") — matches module.id in MongoDB
      setActiveCustomModuleId(chapter.id);
      setShowConceptMap(true);
      return;
    }

    // Default modules — only Motion & Forces has a concept map currently
    setActiveCustomModuleId(null);
    if (chapter.id === "motion") {
      setShowConceptMap(true);
    } else {
      // Other default modules don't have concept map data yet
      setShowConceptMap(false);
    }
  };

  // ── Custom module flow handlers ──

  const handleCreateCustomModule = () => {
    setShowWizard(true);
  };

  const handleWizardGenerate = async (
    scope: ConceptScope,
    objectives: LearningObjectives,
    design: CognitiveDesign,
  ) => {
    setPendingScope(scope);
    setPendingObjectives(objectives);
    setPendingDesign(design);

    const graph = await generateMap(scope, objectives, design);
    if (graph) {
      setEditorGraph(graph);
      setShowWizard(false);
      setShowEditor(true);
    }
  };

  const handleEditorConfirm = async (graph: NodeGraph) => {
    if (!pendingScope || !pendingObjectives || !pendingDesign) return;

    const moduleId = await saveModule(
      pendingScope,
      pendingObjectives,
      pendingDesign,
      graph,
    );
    if (moduleId) {
      setShowEditor(false);
      setEditorGraph(null);
      setPendingScope(null);
      setPendingObjectives(null);
      setPendingDesign(null);
    }
  };

  const handleEditorBack = () => {
    setShowEditor(false);
    setEditorGraph(null);
    setShowWizard(true); // Go back to wizard
  };

  // ── Simulation flow handlers ──

  const handleCreateSimulation = () => {
    setShowSimWizard(true);
  };

  const handleSimWizardGenerate = async (blueprint: SimulationBlueprint) => {
    // Generate engine model from AI
    const result = await generateEngine(blueprint);
    if (result) {
      // Build a fresh SimulationDocument to hand to the builder
      const doc: SimulationDocument = {
        _id: "",
        user_id: "",
        blueprint,
        model: result.model,
        renderer_config: result.renderer_config,
        guidance: null,
        status: "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setActiveSimulation(doc);
      setShowSimWizard(false);
      setShowSimBuilder(true);
    }
  };

  const handleSimBuilderClose = () => {
    setShowSimBuilder(false);
    setActiveSimulation(null);
  };

  // ── Animation flow handlers ──

  const handleCreateAnimation = () => {
    setShowAnimWizard(true);
  };

  const handleAnimWizardGenerate = (blueprint: AnimationBlueprint) => {
    setAnimBlueprint(blueprint);
    setShowAnimWizard(false);
    setShowAnimBuilder(true);
  };

  const handleAnimBuilderClose = () => {
    setShowAnimBuilder(false);
    setAnimBlueprint(null);
  };

  const handleDeleteCustomModule = async (moduleId: string) => {
    const ok = await deleteModule(moduleId);
    if (ok) {
      // If we're currently viewing the deleted module, go back
      if (activeCustomModuleId === moduleId) {
        setShowConceptMap(false);
        setActiveChapter(null);
        setActiveCustomModuleId(null);
      }
    }
  };

  // Compute dynamic concept map data for the active custom module
  const customMapData = useMemo(() => {
    if (!activeCustomModuleId) return null;
    const mod = getModule(activeCustomModuleId);
    if (!mod || !mod.node_graph) return null;
    return customModuleToConceptMap(mod.node_graph);
  }, [activeCustomModuleId, getModule]);

  // Full active custom module (for Phase C content builder)
  const activeCustomModule = useMemo(() => {
    if (!activeCustomModuleId) return null;
    return getModule(activeCustomModuleId) || null;
  }, [activeCustomModuleId, getModule]);

  const handleDeleteConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/conversations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // If the deleted conversation is currently active, start a new chat
      if (conversationId === id) {
        startNewChat();
      }
      refreshConversations();
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const res = await fetch(
        `/api/dashboard/conversations/${id}/rename?title=${encodeURIComponent(newTitle)}`,
        { method: "PATCH" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refreshConversations();
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    }
  };

  const handleBackFromMap = () => {
    setShowConceptMap(false);
    setActiveChapter(null);
    setActiveCustomModuleId(null);
  };

  const hasMessages = messages.length > 0;

  // ── Render ──

  return (
    <div className="flex h-screen bg-[#F9FAFB] dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onNewChat={handleNewChat}
        onSearchClick={() => setShowSearchDialog(true)}
        onChapterSelect={handleChapterSelect}
        activeChapter={activeChapter}
        onConversationSelect={handleConversationSelect}
        activeConversationId={conversationId || undefined}
        conversations={recentConversations}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        customModuleChapters={customModuleChapters}
        onCreateCustomModule={handleCreateCustomModule}
        onDeleteCustomModule={handleDeleteCustomModule}
        onCreateSimulation={handleCreateSimulation}
        onCreateAnimation={handleCreateAnimation}
      />

      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {showConceptMap ? (
          <ConceptMapView
            chapter={activeChapter}
            onBack={handleBackFromMap}
            {...(customMapData
              ? {
                  dynamicNodes: customMapData.nodes,
                  dynamicConnections: customMapData.connections,
                  dynamicInitialStates: customMapData.initialStates,
                  dynamicInitialProgress: customMapData.initialProgress,
                  nodeMetadata: customMapData.metadata,
                }
              : {})}
            customModule={activeCustomModule}
            isContentSaving={isSaving}
            onGenerateScaffold={generateScaffold}
            onSaveNodeContent={saveNodeContent}
            onGenerateBlockContent={generateBlockContent}
            onUpdateGraph={updateGraph}
            idMapping={customMapData?.idMapping}
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Scroll area — stable flex-1 container, never animated */}
            <div
              ref={scrollContainerRef}
              className="flex-1 min-h-0 overflow-y-auto [overflow-anchor:none]"
            >
              <AnimatePresence mode="wait">
                {!hasMessages ? (
                  /* ── Empty state ── */
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                    className="min-h-full flex flex-col items-center justify-start pt-36 px-4"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="text-center mb-8"
                    >
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <Rocket className="w-8 h-8 text-blue-600" />
                        <h1 className="text-5xl font-bold text-gray-800 dark:text-white">
                          EUREKA
                        </h1>
                      </div>
                      <p className="text-base text-gray-500 dark:text-gray-400 tracking-wide">
                        Think clearly. Understand deeply.
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="w-full max-w-3xl mb-6"
                    >
                      <InputBox
                        onSend={handleSendMessage}
                        placeholder="Ask me anything — I'm here to help you understand..."
                        isLoading={isStreaming}
                        isCentered={true}
                      />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-3xl"
                    >
                      {SUGGESTED_QUESTIONS.map((question, index) => (
                        <motion.button
                          key={index}
                          onClick={() => handleSendMessage(question.text)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="p-4 text-left rounded-xl border border-gray-200 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-all duration-200"
                        >
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="mr-2">{question.emoji}</span>
                            {question.text}
                          </p>
                        </motion.button>
                      ))}
                    </motion.div>
                  </motion.div>
                ) : (
                  /* ── Messages ── */
                  <motion.div
                    key="messages"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="max-w-3xl mx-auto px-4 pt-6 pb-6 w-full">
                      <AnimatePresence mode="popLayout">
                        {messages.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={`mb-4 flex ${
                              msg.role === "user"
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <StreamingMessageBubble message={msg} />
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {error && (
                        <div className="text-center text-red-500 text-sm py-2">
                          {error}
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input — pinned to bottom, never inside scroll area */}
            {hasMessages && (
              <div className="flex-shrink-0 bg-[#F9FAFB] dark:bg-gray-900">
                <InputBox
                  onSend={handleSendMessage}
                  placeholder="Ask me anything — I'm here to help you understand..."
                  isLoading={isStreaming}
                  isCentered={false}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Search Dialog */}
      <SearchDialog
        open={showSearchDialog}
        onOpenChange={setShowSearchDialog}
        onSelect={handleConversationSelect}
      />

      {/* Custom Module Wizard */}
      <CustomModuleWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onGenerate={handleWizardGenerate}
        isGenerating={isGenerating}
      />

      {/* Custom Module Graph Editor */}
      <AnimatePresence>
        {showEditor && editorGraph && pendingScope && (
          <motion.div
            key="graph-editor-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white dark:bg-gray-900"
          >
            <NodeGraphEditor
              graph={editorGraph}
              moduleInfo={pendingScope}
              onConfirm={handleEditorConfirm}
              onBack={handleEditorBack}
              isSaving={isSaving}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulation Wizard */}
      <SimulationWizard
        open={showSimWizard}
        onClose={() => setShowSimWizard(false)}
        onGenerate={handleSimWizardGenerate}
        isGenerating={isSimGenerating}
      />

      {/* Simulation Builder */}
      <AnimatePresence>
        {showSimBuilder && activeSimulation && (
          <motion.div
            key="sim-builder-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white dark:bg-gray-900"
          >
            <SimulationBuilder
              blueprint={activeSimulation.blueprint}
              existingDoc={activeSimulation}
              onClose={handleSimBuilderClose}
              onSave={saveSimulation}
              onGenerateEngine={generateEngine}
              onGenerateGuidance={generateGuidance}
              onPublish={publishSimulation}
              isGenerating={isSimGenerating}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animation Blueprint Wizard */}
      <AnimationBlueprintWizard
        open={showAnimWizard}
        onClose={() => setShowAnimWizard(false)}
        onGenerate={handleAnimWizardGenerate}
      />

      {/* Animation Builder */}
      <AnimatePresence>
        {showAnimBuilder && animBlueprint && (
          <motion.div
            key="anim-builder-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white dark:bg-gray-900"
          >
            <AnimationBuilder
              blueprint={animBlueprint}
              onClose={handleAnimBuilderClose}
              onGenerateScene={generateSceneContent}
              onRefineNarration={refineNarration}
              onSave={saveAnimation}
              onPublish={publishAnimation}
              isGenerating={isAnimGenerating}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
