/* ──────────────────────────────────────────────────────────────
 *  useSimulations — data hook for the Simulation Builder
 *  Mirrors the useCustomModules pattern: raw fetch + useState
 * ────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import type {
  SimulationDocument,
  SimulationBlueprint,
  SimulationModel,
  RendererConfig,
  SimulationGuidance,
} from "@/types/simulation";

const API_BASE = "/api/simulations";

export interface UseSimulationsReturn {
  /* state */
  simulations: SimulationDocument[];
  isLoading: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  error: string | null;

  /* CRUD */
  refreshSimulations: () => Promise<void>;
  saveSimulation: (doc: Partial<SimulationDocument>) => Promise<string | null>;
  deleteSimulation: (simId: string) => Promise<boolean>;

  /* AI generation */
  generateEngine: (
    blueprint: SimulationBlueprint,
  ) => Promise<{
    model: SimulationModel;
    renderer_config: RendererConfig;
  } | null>;
  generateGuidance: (
    blueprint: SimulationBlueprint,
    model: SimulationModel,
  ) => Promise<SimulationGuidance | null>;

  /* Field patches */
  updateModel: (simId: string, model: SimulationModel) => Promise<boolean>;
  updateRenderer: (simId: string, config: RendererConfig) => Promise<boolean>;
  updateGuidance: (
    simId: string,
    guidance: SimulationGuidance,
  ) => Promise<boolean>;

  /* Publishing */
  publishSimulation: (simId: string) => Promise<boolean>;
}

export function useSimulations(
  userId: string = "default",
): UseSimulationsReturn {
  const [simulations, setSimulations] = useState<SimulationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── List ──────────────────────────────────────────────────

  const refreshSimulations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/?user_id=${userId}`);
      if (!res.ok) throw new Error(`Failed to list simulations: ${res.status}`);
      const data = await res.json();
      setSimulations(data.simulations ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshSimulations();
  }, [refreshSimulations]);

  // ── Save ──────────────────────────────────────────────────

  const saveSimulation = useCallback(
    async (doc: Partial<SimulationDocument>): Promise<string | null> => {
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...doc, user_id: userId }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        const data = await res.json();
        await refreshSimulations();
        return data.simulation_id ?? null;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [userId, refreshSimulations],
  );

  // ── Delete ────────────────────────────────────────────────

  const deleteSimulation = useCallback(
    async (simId: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${simId}/`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
        await refreshSimulations();
        return true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return false;
      }
    },
    [refreshSimulations],
  );

  // ── Generate Engine (Phase 2) ─────────────────────────────

  const generateEngine = useCallback(
    async (
      blueprint: SimulationBlueprint,
    ): Promise<{
      model: SimulationModel;
      renderer_config: RendererConfig;
    } | null> => {
      setIsGenerating(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/generate-engine/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blueprint }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.detail || `Engine generation failed: ${res.status}`,
          );
        }
        const data = await res.json();
        return {
          model: data.model as SimulationModel,
          renderer_config: data.renderer_config as RendererConfig,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // ── Generate Guidance (Phase 4) ───────────────────────────

  const generateGuidance = useCallback(
    async (
      blueprint: SimulationBlueprint,
      model: SimulationModel,
    ): Promise<SimulationGuidance | null> => {
      setIsGenerating(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/generate-guidance/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blueprint, model }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.detail || `Guidance generation failed: ${res.status}`,
          );
        }
        const data = await res.json();
        return data.guidance as SimulationGuidance;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // ── Patch Helpers ─────────────────────────────────────────

  const updateModel = useCallback(
    async (simId: string, model: SimulationModel): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE}/${simId}/model/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: model }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const updateRenderer = useCallback(
    async (simId: string, config: RendererConfig): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE}/${simId}/renderer/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: config }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const updateGuidance = useCallback(
    async (simId: string, guidance: SimulationGuidance): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE}/${simId}/guidance/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: guidance }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  // ── Publish ───────────────────────────────────────────────

  const publishSimulation = useCallback(
    async (simId: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${simId}/publish/`, {
          method: "POST",
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            typeof errData.detail === "string"
              ? errData.detail
              : errData.detail?.message || `Publish failed: ${res.status}`,
          );
        }
        await refreshSimulations();
        return true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return false;
      }
    },
    [refreshSimulations],
  );

  return {
    simulations,
    isLoading,
    isGenerating,
    isSaving,
    error,
    refreshSimulations,
    saveSimulation,
    deleteSimulation,
    generateEngine,
    generateGuidance,
    updateModel,
    updateRenderer,
    updateGuidance,
    publishSimulation,
  };
}
