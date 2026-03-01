/* ──────────────────────────────────────────────────────────────
 *  useAnimations — data hook for the Animation Builder
 *  Mirrors the useSimulations pattern: raw fetch + useState
 * ────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import type {
  AnimationDocument,
  AnimationBlueprint,
  AnimationScene,
  GeneratedSceneContent,
} from "@/types/animation";

const API_BASE = "/api/animations";

export interface UseAnimationsReturn {
  /* state */
  animations: AnimationDocument[];
  isLoading: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  error: string | null;

  /* CRUD */
  refreshAnimations: () => Promise<void>;
  saveAnimation: (doc: Partial<AnimationDocument>) => Promise<string | null>;
  deleteAnimation: (animId: string) => Promise<boolean>;

  /* AI generation */
  generateSceneContent: (
    blueprint: AnimationBlueprint,
    scene: AnimationScene,
  ) => Promise<GeneratedSceneContent | null>;
  refineNarration: (
    blueprint: AnimationBlueprint,
    scene: AnimationScene,
    rawNarration: string,
  ) => Promise<{
    refined_text: string;
    segments: Array<{
      text: string;
      start_time: number;
      end_time: number;
      position: string;
      style: string;
    }>;
    dignity_safe: boolean;
  } | null>;

  /* Field patches */
  updateScenes: (animId: string, scenes: AnimationScene[]) => Promise<boolean>;
  updateBlueprint: (
    animId: string,
    blueprint: AnimationBlueprint,
  ) => Promise<boolean>;

  /* Publishing */
  publishAnimation: (
    animId: string,
  ) => Promise<{ success: boolean; dignity_score?: number; errors?: string[] }>;
}

export function useAnimations(userId: string = "default"): UseAnimationsReturn {
  const [animations, setAnimations] = useState<AnimationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refresh list ──
  const refreshAnimations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}?user_id=${userId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAnimations(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load animations");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshAnimations();
  }, [refreshAnimations]);

  // ── Save ──
  const saveAnimation = useCallback(
    async (doc: Partial<AnimationDocument>): Promise<string | null> => {
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...doc, created_by: userId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        await refreshAnimations();
        return json.id ?? null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [userId, refreshAnimations],
  );

  // ── Delete ──
  const deleteAnimation = useCallback(
    async (animId: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${animId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await refreshAnimations();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
        return false;
      }
    },
    [refreshAnimations],
  );

  // ── Generate scene content (AI) ──
  const generateSceneContentFn = useCallback(
    async (
      blueprint: AnimationBlueprint,
      scene: AnimationScene,
    ): Promise<GeneratedSceneContent | null> => {
      setIsGenerating(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/generate-scene`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blueprint, scene }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || `HTTP ${res.status}`);
        }
        const json = await res.json();
        return json.data ?? null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scene generation failed");
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // ── Refine narration (AI) ──
  const refineNarrationFn = useCallback(
    async (
      blueprint: AnimationBlueprint,
      scene: AnimationScene,
      rawNarration: string,
    ) => {
      setIsGenerating(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/refine-narration`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprint,
            scene,
            raw_narration: rawNarration,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.data ?? null;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Narration refinement failed",
        );
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // ── Patch scenes ──
  const updateScenes = useCallback(
    async (animId: string, scenes: AnimationScene[]): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${animId}/scenes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: scenes }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
        return false;
      }
    },
    [],
  );

  // ── Patch blueprint ──
  const updateBlueprint = useCallback(
    async (animId: string, blueprint: AnimationBlueprint): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${animId}/blueprint`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: blueprint }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
        return false;
      }
    },
    [],
  );

  // ── Publish ──
  const publishAnimationFn = useCallback(
    async (
      animId: string,
    ): Promise<{
      success: boolean;
      dignity_score?: number;
      errors?: string[];
    }> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${animId}/publish`, {
          method: "POST",
        });
        if (res.status === 422) {
          const json = await res.json();
          return {
            success: false,
            errors: json.detail?.errors ?? [json.detail],
          };
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        await refreshAnimations();
        return { success: true, dignity_score: json.dignity_score };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Publish failed");
        return { success: false, errors: [String(e)] };
      }
    },
    [refreshAnimations],
  );

  return {
    animations,
    isLoading,
    isGenerating,
    isSaving,
    error,
    refreshAnimations,
    saveAnimation,
    deleteAnimation,
    generateSceneContent: generateSceneContentFn,
    refineNarration: refineNarrationFn,
    updateScenes,
    updateBlueprint,
    publishAnimation: publishAnimationFn,
  };
}
