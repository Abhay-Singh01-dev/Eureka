// ============================================================
// useCustomModules — Hook for custom module CRUD operations
// ============================================================

import { useState, useEffect, useCallback } from "react";
import type {
  CustomModule,
  ConceptScope,
  LearningObjectives,
  CognitiveDesign,
  NodeGraph,
  EntryStyle,
  ExperienceType,
  BlockType,
  StageContent,
  NodeScaffold,
  NodeContent,
  GeneratedNode,
  PublishValidation,
} from "@/types/custom-module";
import type { Chapter } from "@/types";

// Use trailing slash to avoid 307 redirects from FastAPI
const API_BASE = "/api/custom-modules";

interface UseCustomModulesReturn {
  /** All custom modules loaded from the backend */
  modules: CustomModule[];
  /** Chapters derived from custom modules (for sidebar display) */
  chapters: Chapter[];
  /** Whether modules are being loaded */
  isLoading: boolean;
  /** Whether a graph is being generated */
  isGenerating: boolean;
  /** Whether a module is being saved */
  isSaving: boolean;
  /** Whether a scaffold is being generated */
  isGeneratingScaffold: boolean;
  /** Current error message */
  error: string | null;
  /** Refresh modules from backend */
  refreshModules: () => Promise<void>;
  /** Generate a node graph from wizard data */
  generateMap: (
    scope: ConceptScope,
    objectives: LearningObjectives,
    design: CognitiveDesign,
  ) => Promise<NodeGraph | null>;
  /** Save a complete custom module */
  saveModule: (
    scope: ConceptScope,
    objectives: LearningObjectives,
    design: CognitiveDesign,
    graph: NodeGraph,
  ) => Promise<string | null>;
  /** Delete a custom module */
  deleteModule: (moduleId: string) => Promise<boolean>;
  /** Update a module's node graph */
  updateGraph: (moduleId: string, graph: NodeGraph) => Promise<boolean>;
  /** Get full custom module by ID */
  getModule: (moduleId: string) => CustomModule | undefined;
  /** Generate a content scaffold for a node via GPT (stage-aware) */
  generateScaffold: (
    moduleId: string,
    nodeId: string,
    entryStyle: EntryStyle,
    cognitiveDesign: CognitiveDesign,
    nodeMetadata: GeneratedNode,
    stageNumber?: number,
    totalStages?: number,
  ) => Promise<NodeScaffold | null>;
  /** Save node content (stage-based) */
  saveNodeContent: (
    moduleId: string,
    nodeId: string,
    experienceType: ExperienceType,
    stages: StageContent[],
  ) => Promise<boolean>;
  /** Get saved node content */
  getNodeContent: (
    moduleId: string,
    nodeId: string,
  ) => Promise<NodeContent | null>;
  /** Validate module for publish */
  validateForPublish: (moduleId: string) => Promise<PublishValidation | null>;
  /** Publish module */
  publishModule: (moduleId: string) => Promise<PublishValidation | null>;
  /** Generate AI content for a single block */
  generateBlockContent: (
    blockType: BlockType,
    nodeTitle: string,
    nodeDescription: string,
    entryStyle: string,
    depthLevel: number,
    existingBlocks?: { type: string; content: string }[],
  ) => Promise<string | null>;
}

export function useCustomModules(
  userId: string = "default",
): UseCustomModulesReturn {
  const [modules, setModules] = useState<CustomModule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingScaffold, setIsGeneratingScaffold] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load all modules ──
  const refreshModules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/?user_id=${userId}`);
      if (!res.ok) throw new Error(`Failed to load modules: ${res.status}`);
      const data = await res.json();
      setModules(data.modules || []);
    } catch (err: any) {
      console.error("Failed to load custom modules:", err);
      setError(err.message);
      setModules([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load modules on mount
  useEffect(() => {
    refreshModules();
  }, [refreshModules]);

  // ── Generate node graph ──
  const generateMap = useCallback(
    async (
      scope: ConceptScope,
      objectives: LearningObjectives,
      design: CognitiveDesign,
    ): Promise<NodeGraph | null> => {
      setIsGenerating(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/generate-map/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            concept_scope: scope,
            learning_objectives: objectives,
            cognitive_design: design,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || `Generation failed: ${res.status}`);
        }

        const data = await res.json();
        return data.node_graph as NodeGraph;
      } catch (err: any) {
        console.error("Graph generation failed:", err);
        setError(err.message);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // ── Save complete module ──
  const saveModule = useCallback(
    async (
      scope: ConceptScope,
      objectives: LearningObjectives,
      design: CognitiveDesign,
      graph: NodeGraph,
    ): Promise<string | null> => {
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprint: scope,
            objectives,
            cognitive_design: design,
            node_graph: graph,
            created_by: userId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || `Save failed: ${res.status}`);
        }

        const data = await res.json();
        await refreshModules();
        return data.module_id;
      } catch (err: any) {
        console.error("Failed to save custom module:", err);
        setError(err.message);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [userId, refreshModules],
  );

  // ── Delete module ──
  const deleteModule = useCallback(
    async (moduleId: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${moduleId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
        await refreshModules();
        return true;
      } catch (err: any) {
        console.error("Failed to delete module:", err);
        setError(err.message);
        return false;
      }
    },
    [refreshModules],
  );

  // ── Update graph ──
  const updateGraph = useCallback(
    async (moduleId: string, graph: NodeGraph): Promise<boolean> => {
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${moduleId}/graph`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ node_graph: graph }),
        });
        if (!res.ok) throw new Error(`Update failed: ${res.status}`);
        await refreshModules();
        return true;
      } catch (err: any) {
        console.error("Failed to update graph:", err);
        setError(err.message);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshModules],
  );

  // ── Get single module ──
  const getModule = useCallback(
    (moduleId: string): CustomModule | undefined => {
      return modules.find((m) => m.id === moduleId);
    },
    [modules],
  );

  // ── Generate node content scaffold ──
  const generateScaffold = useCallback(
    async (
      moduleId: string,
      nodeId: string,
      entryStyle: EntryStyle,
      cognitiveDesign: CognitiveDesign,
      nodeMetadata: GeneratedNode,
      stageNumber?: number,
      totalStages?: number,
    ): Promise<NodeScaffold | null> => {
      setIsGeneratingScaffold(true);
      setError(null);
      try {
        const body: Record<string, any> = {
          module_id: moduleId,
          node_id: nodeId,
          entry_style: entryStyle,
          cognitive_design: cognitiveDesign,
          node_metadata: {
            id: nodeMetadata.id,
            title: nodeMetadata.title,
            description: nodeMetadata.description,
            depth_level: nodeMetadata.depth_level,
            addresses_misconception: nodeMetadata.addresses_misconception || [],
            prerequisites: nodeMetadata.prerequisites || [],
            emoji: nodeMetadata.emoji,
            estimated_time: nodeMetadata.estimated_time,
            discover_points: nodeMetadata.discover_points || [],
          },
        };

        if (stageNumber != null) {
          body.stage_number = stageNumber;
          if (totalStages != null) {
            body.total_stages = totalStages;
          }
        }

        const res = await fetch(`${API_BASE}/generate-node-scaffold/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.detail || `Scaffold generation failed: ${res.status}`,
          );
        }

        const data = await res.json();
        return data.scaffold as NodeScaffold;
      } catch (err: any) {
        console.error("Scaffold generation failed:", err);
        setError(err.message);
        return null;
      } finally {
        setIsGeneratingScaffold(false);
      }
    },
    [],
  );

  // ── Generate content for a single block ──
  const generateBlockContent = useCallback(
    async (
      blockType: BlockType,
      nodeTitle: string,
      nodeDescription: string,
      entryStyle: string,
      depthLevel: number,
      existingBlocks?: { type: string; content: string }[],
    ): Promise<string | null> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/generate-block-content/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            block_type: blockType,
            node_title: nodeTitle,
            node_description: nodeDescription,
            entry_style: entryStyle,
            depth_level: depthLevel,
            existing_blocks: existingBlocks || [],
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.detail || `Block content generation failed: ${res.status}`,
          );
        }

        const data = await res.json();
        return data.content as string;
      } catch (err: any) {
        console.error("Block content generation failed:", err);
        setError(err.message);
        return null;
      }
    },
    [],
  );

  // ── Save node content (stage-based) ──
  const saveNodeContent = useCallback(
    async (
      moduleId: string,
      nodeId: string,
      experienceType: ExperienceType,
      stages: StageContent[],
    ): Promise<boolean> => {
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/${moduleId}/nodes/${nodeId}/content/`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              experience_type: experienceType,
              stages: stages.map((s) => ({
                stage_number: s.stage_number,
                entry_style: s.entry_style,
                blocks: s.blocks.map((b) => ({
                  id: b.id,
                  type: b.type,
                  content: b.content,
                  locked: b.locked,
                })),
              })),
            }),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || `Save failed: ${res.status}`);
        }

        // Refresh modules to get updated node_contents
        await refreshModules();
        return true;
      } catch (err: any) {
        console.error("Failed to save node content:", err);
        setError(err.message);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshModules],
  );

  // ── Get node content ──
  const getNodeContent = useCallback(
    async (moduleId: string, nodeId: string): Promise<NodeContent | null> => {
      try {
        const res = await fetch(
          `${API_BASE}/${moduleId}/nodes/${nodeId}/content/`,
        );
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Failed to get content: ${res.status}`);
        const data = await res.json();
        return data.content as NodeContent;
      } catch (err: any) {
        console.error("Failed to get node content:", err);
        return null;
      }
    },
    [],
  );

  // ── Validate for publish ──
  const validateForPublish = useCallback(
    async (moduleId: string): Promise<PublishValidation | null> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${moduleId}/validate/`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || `Validation failed: ${res.status}`);
        }
        return (await res.json()) as PublishValidation;
      } catch (err: any) {
        console.error("Module validation failed:", err);
        setError(err.message);
        return null;
      }
    },
    [],
  );

  // ── Publish module ──
  const publishModule = useCallback(
    async (moduleId: string): Promise<PublishValidation | null> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${moduleId}/publish/`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || `Publish failed: ${res.status}`);
        }
        const result = (await res.json()) as PublishValidation;
        if (result.valid) {
          await refreshModules();
        }
        return result;
      } catch (err: any) {
        console.error("Module publish failed:", err);
        setError(err.message);
        return null;
      }
    },
    [refreshModules],
  );

  // ── Derive sidebar chapters ──
  // NOTE: chapter.id === module.id (e.g. "cm-abc123") — no extra prefix.
  // Home.tsx checks startsWith("cm-") to detect custom modules.
  const chapters: Chapter[] = modules.map((m) => ({
    id: m.id,
    name: m.blueprint?.module_title ?? "Untitled",
    icon: "📝",
  }));

  return {
    modules,
    chapters,
    isLoading,
    isGenerating,
    isSaving,
    isGeneratingScaffold,
    error,
    refreshModules,
    generateMap,
    saveModule,
    deleteModule,
    updateGraph,
    getModule,
    generateScaffold,
    saveNodeContent,
    getNodeContent,
    validateForPublish,
    publishModule,
    generateBlockContent,
  };
}
