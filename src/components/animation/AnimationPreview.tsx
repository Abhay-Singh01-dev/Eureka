// ============================================================
// AnimationPreview — Student-facing clean playback view
// No editing UI, just a player with play / pause / scene nav
// ============================================================

import React, { useState, useCallback, useMemo, type FC } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AnimationDocument,
  AnimationScene,
  SceneRenderState,
  ManimElement,
  ManimInstruction,
  VisualType,
} from "@/types/animation";
import { MANIM_BG } from "@/types/animation";

import GraphAnimator from "./renderers/GraphAnimator";
import VectorFieldAnimator from "./renderers/VectorFieldAnimator";
import GridTransformAnimator from "./renderers/GridTransformAnimator";
import ParticleMotionAnimator from "./renderers/ParticleMotionAnimator";
import WavePropagationAnimator from "./renderers/WavePropagationAnimator";
import CircuitFlowAnimator from "./renderers/CircuitFlowAnimator";
import CustomDrawingAnimator from "./renderers/CustomDrawingAnimator";

function getRenderer(type: VisualType) {
  switch (type) {
    case "2d_graph":
      return GraphAnimator;
    case "vector_field":
      return VectorFieldAnimator;
    case "grid_transformation":
      return GridTransformAnimator;
    case "particle_motion":
      return ParticleMotionAnimator;
    case "wave_propagation":
      return WavePropagationAnimator;
    case "circuit_flow":
      return CircuitFlowAnimator;
    case "custom_drawing":
      return CustomDrawingAnimator;
  }
}

function buildRenderState(
  scene: AnimationScene,
  currentTime: number,
  isPlaying: boolean,
): SceneRenderState {
  const content = scene.generated_content;
  if (!content) {
    return {
      scene_id: scene.id,
      elements: [],
      instructions: [],
      camera: { center: [0, 0], zoom: 1 },
      current_time: 0,
      total_duration: scene.duration_seconds,
      is_playing: false,
      is_3d: false,
    };
  }

  return {
    scene_id: scene.id,
    elements: (content.visual_elements ?? []) as ManimElement[],
    instructions: (content.manim_sequence ?? []) as ManimInstruction[],
    camera: { center: [0, 0], zoom: 1 },
    current_time: currentTime,
    total_duration: scene.duration_seconds,
    is_playing: isPlaying,
    is_3d: false,
  };
}

interface AnimationPreviewProps {
  doc: AnimationDocument;
  width?: number;
  height?: number;
}

const AnimationPreview: FC<AnimationPreviewProps> = ({
  doc,
  width = 680,
  height = 420,
}) => {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const scene = doc.scenes[sceneIdx] ?? doc.scenes[0];
  const Renderer = getRenderer(scene.visual_type);

  const renderState = useMemo(
    () => buildRenderState(scene, currentTime, isPlaying),
    [scene, currentTime, isPlaying],
  );

  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
  }, []);

  const nextScene = useCallback(() => {
    if (sceneIdx < doc.scenes.length - 1) {
      setSceneIdx((i) => i + 1);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [sceneIdx, doc.scenes.length]);

  const prevScene = useCallback(() => {
    if (sceneIdx > 0) {
      setSceneIdx((i) => i - 1);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [sceneIdx]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0D0D1A] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-white/80 truncate max-w-xs">
            {doc.blueprint.title}
          </span>
        </div>
        <span className="text-[10px] text-white/30">
          Scene {sceneIdx + 1} / {doc.scenes.length}
        </span>
      </div>

      {/* Canvas */}
      <div className="relative" style={{ background: MANIM_BG }}>
        {scene.generated_content &&
        scene.generated_content.key_visual_elements.length > 0 ? (
          <Renderer
            scene={scene}
            renderState={renderState}
            width={width}
            height={height}
            onTimeUpdate={handleTimeUpdate}
          />
        ) : (
          <div
            className="flex items-center justify-center text-white/20 text-sm"
            style={{ width, height }}
          >
            No content for this scene
          </div>
        )}

        {/* Narration overlay */}
        {scene.narration_type !== "silent" &&
          scene.generated_content?.narration_text && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 py-4">
              <p className="text-sm text-white/90 text-center leading-relaxed">
                {scene.generated_content.narration_text}
              </p>
            </div>
          )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-white/5">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevScene}
          disabled={sceneIdx === 0}
          className="text-white/40 hover:text-white/70 disabled:opacity-20"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Button
          size="sm"
          onClick={() => setIsPlaying((p) => !p)}
          className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="text-white/30 hover:text-white/60"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden mx-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
            style={{
              width: `${(currentTime / scene.duration_seconds) * 100}%`,
            }}
          />
        </div>

        <span className="text-[10px] text-white/30 tabular-nums">
          {currentTime.toFixed(1)}s / {scene.duration_seconds}s
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={nextScene}
          disabled={sceneIdx >= doc.scenes.length - 1}
          className="text-white/40 hover:text-white/70 disabled:opacity-20"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default AnimationPreview;
