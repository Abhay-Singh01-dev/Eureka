// ============================================================
// AnimatedObjectRenderer — Canvas 2D + Three.js 3D physics objects
// ============================================================

import React, { useRef, useEffect, useMemo, type FC } from "react";
import * as math from "mathjs";
import type { RendererProps, AnimatedObjectConfig } from "@/types/simulation";

// ── 2D Canvas Renderer ──

const Canvas2DRenderer: FC<RendererProps & { cfg: AnimatedObjectConfig }> = ({
  cfg,
  state,
  model,
  width,
  height,
  dark = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // World-to-screen transform
  const worldToScreen = useMemo(() => {
    const [xMin, xMax] = cfg.bounds.x;
    const [yMin, yMax] = cfg.bounds.y;
    const padding = 40;
    const w = width - padding * 2;
    const h = height - padding * 2;

    return {
      x: (wx: number) => padding + ((wx - xMin) / (xMax - xMin)) * w,
      y: (wy: number) => padding + ((yMax - wy) / (yMax - yMin)) * h,
      scale: Math.min(w / (xMax - xMin), h / (yMax - yMin)),
    };
  }, [cfg.bounds, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // Clear
    ctx.fillStyle = cfg.background || (dark ? "#0f172a" : "#ffffff");
    ctx.fillRect(0, 0, width, height);

    // Draw axes
    if (cfg.show_axes) {
      const [xMin, xMax] = cfg.bounds.x;
      const [yMin, yMax] = cfg.bounds.y;

      ctx.strokeStyle = dark ? "#374151" : "#d1d5db";
      ctx.lineWidth = 1;

      // X axis (y=0 line)
      if (yMin <= 0 && yMax >= 0) {
        const y0 = worldToScreen.y(0);
        ctx.beginPath();
        ctx.moveTo(worldToScreen.x(xMin), y0);
        ctx.lineTo(worldToScreen.x(xMax), y0);
        ctx.stroke();
      }

      // Y axis (x=0 line)
      if (xMin <= 0 && xMax >= 0) {
        const x0 = worldToScreen.x(0);
        ctx.beginPath();
        ctx.moveTo(x0, worldToScreen.y(yMin));
        ctx.lineTo(x0, worldToScreen.y(yMax));
        ctx.stroke();
      }

      // Tick marks
      ctx.fillStyle = dark ? "#6b7280" : "#9ca3af";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";

      const stepX = Math.ceil((xMax - xMin) / 10);
      for (let x = Math.ceil(xMin); x <= xMax; x += stepX) {
        const sx = worldToScreen.x(x);
        const sy = worldToScreen.y(0);
        ctx.fillText(String(x), sx, sy + 14);
      }

      ctx.textAlign = "right";
      const stepY = Math.ceil((yMax - yMin) / 10);
      for (let y = Math.ceil(yMin); y <= yMax; y += stepY) {
        const sx = worldToScreen.x(0);
        const sy = worldToScreen.y(y);
        ctx.fillText(String(y), sx - 6, sy + 3);
      }
    }

    // Draw each object
    const scope: Record<string, number> = {
      ...state.variables,
      t: state.time,
      pi: Math.PI,
      e: Math.E,
    };

    for (const obj of cfg.objects) {
      let x = 0;
      let y = 0;

      try {
        x = Number(math.evaluate(obj.position.x, scope));
        y = Number(math.evaluate(obj.position.y, scope));
      } catch {
        continue;
      }

      const sx = worldToScreen.x(x);
      const sy = worldToScreen.y(y);

      // Draw trail from history
      if (obj.trail && state.history.length > 1) {
        ctx.strokeStyle = obj.color + "40";
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < state.history.length; i++) {
          const h = state.history[i];
          const trailScope = { ...h, pi: Math.PI, e: Math.E };
          try {
            const tx = Number(math.evaluate(obj.position.x, trailScope));
            const ty = Number(math.evaluate(obj.position.y, trailScope));
            const tsx = worldToScreen.x(tx);
            const tsy = worldToScreen.y(ty);
            if (i === 0) ctx.moveTo(tsx, tsy);
            else ctx.lineTo(tsx, tsy);
          } catch {
            // skip
          }
        }
        ctx.stroke();
      }

      // Draw shape
      ctx.fillStyle = obj.color;
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = 2;

      const size = obj.size || 10;

      switch (obj.shape) {
        case "circle":
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case "rect":
          ctx.fillRect(sx - size, sy - size, size * 2, size * 2);
          break;

        case "arrow": {
          // Draw arrow pointing in velocity direction
          const vx = scope[`v${obj.id}_x`] ?? scope["vx"] ?? 1;
          const vy = scope[`v${obj.id}_y`] ?? scope["vy"] ?? 0;
          const mag = Math.sqrt(vx * vx + vy * vy);
          const angle = Math.atan2(-vy, vx); // -vy because canvas y is inverted

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(angle);

          const arrowLen = Math.min(size * 2, mag * worldToScreen.scale * 0.1);
          ctx.beginPath();
          ctx.moveTo(-arrowLen / 2, 0);
          ctx.lineTo(arrowLen / 2, 0);
          ctx.lineTo(arrowLen / 2 - 6, -5);
          ctx.moveTo(arrowLen / 2, 0);
          ctx.lineTo(arrowLen / 2 - 6, 5);
          ctx.stroke();

          ctx.restore();
          break;
        }

        case "spring": {
          // Draw spring from origin to current position
          const [startX, startY] = [worldToScreen.x(0), worldToScreen.y(0)];
          const coils = 8;
          const amplitude = 8;

          ctx.beginPath();
          ctx.moveTo(startX, startY);

          const dx = sx - startX;
          const dy = sy - startY;
          const totalLen = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);

          ctx.save();
          ctx.translate(startX, startY);
          ctx.rotate(angle);

          for (let i = 0; i <= coils * 4; i++) {
            const px = (i / (coils * 4)) * totalLen;
            const py =
              i === 0 || i === coils * 4
                ? 0
                : Math.sin((i / 4) * Math.PI * 2) * amplitude;
            ctx.lineTo(px, py);
          }

          ctx.stroke();
          ctx.restore();

          // Draw mass at end
          ctx.beginPath();
          ctx.arc(sx, sy, 8, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case "pendulum": {
          // Draw pendulum from pivot
          const pivotX = worldToScreen.x(0);
          const pivotY = worldToScreen.y(cfg.bounds.y[1] * 0.8);

          ctx.strokeStyle = dark ? "#64748b" : "#94a3b8";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pivotX, pivotY);
          ctx.lineTo(sx, sy);
          ctx.stroke();

          // Pivot
          ctx.fillStyle = dark ? "#64748b" : "#6b7280";
          ctx.beginPath();
          ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
          ctx.fill();

          // Bob
          ctx.fillStyle = obj.color;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        default:
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
      }

      // Label
      ctx.fillStyle = dark ? "#9ca3af" : "#6b7280";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`(${x.toFixed(1)}, ${y.toFixed(1)})`, sx, sy + size + 14);
    }
  }, [state, cfg, width, height, dark, worldToScreen, model]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
};

// ── 3D Three.js Renderer ──

const Canvas3DRenderer: FC<RendererProps & { cfg: AnimatedObjectConfig }> = ({
  cfg,
  state,
  model,
  width,
  height,
  dark = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const sceneRef = useRef<{
    scene: any;
    camera: any;
    renderer: any;
    objects: Map<string, any>;
    trails: Map<string, any>;
    THREE: any;
  } | null>(null);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Dynamic import of three.js
  useEffect(() => {
    let active = true;

    (async () => {
      const THREE = await import("three");
      if (!active || !containerRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(dark ? "#0f172a" : "#f8fafc");

      const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
      const bounds = cfg.bounds;
      const maxBound = Math.max(
        bounds.x[1] - bounds.x[0],
        bounds.y[1] - bounds.y[0],
        (bounds.z?.[1] ?? 10) - (bounds.z?.[0] ?? -10),
      );
      camera.position.set(maxBound * 1.2, maxBound * 0.8, maxBound * 1.2);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(renderer.domElement);

      // Axes
      if (cfg.show_axes) {
        const axesHelper = new THREE.AxesHelper(maxBound * 0.5);
        scene.add(axesHelper);

        // Grid
        const gridHelper = new THREE.GridHelper(
          maxBound,
          10,
          dark ? 0x374151 : 0xd1d5db,
          dark ? 0x1f2937 : 0xe5e7eb,
        );
        scene.add(gridHelper);
      }

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(10, 10, 10);
      scene.add(dirLight);

      // Create objects
      const objects = new Map<string, any>();
      const trails = new Map<string, any>();

      for (const obj of cfg.objects) {
        const color = new THREE.Color(obj.color);
        const material = new THREE.MeshStandardMaterial({ color });
        const geometry = new THREE.SphereGeometry(obj.size * 0.1, 16, 16);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        objects.set(obj.id, mesh);

        // Trail
        if (obj.trail) {
          const trailGeom = new THREE.BufferGeometry();
          const trailMat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.4,
          });
          const line = new THREE.Line(trailGeom, trailMat);
          scene.add(line);
          trails.set(obj.id, line);
        }
      }

      sceneRef.current = { scene, camera, renderer, objects, trails, THREE };
      renderer.render(scene, camera);
    })();

    return () => {
      active = false;
      if (sceneRef.current) {
        sceneRef.current.renderer.dispose();
        sceneRef.current = null;
      }
    };
  }, [width, height, dark]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update object positions
  useEffect(() => {
    if (!sceneRef.current) return;
    const { scene, camera, renderer, objects, trails, THREE } =
      sceneRef.current;

    const scope: Record<string, number> = {
      ...state.variables,
      t: state.time,
      pi: Math.PI,
      e: Math.E,
    };

    for (const obj of cfg.objects) {
      const mesh = objects.get(obj.id);
      if (!mesh) continue;

      try {
        const x = Number(math.evaluate(obj.position.x, scope));
        const y = Number(math.evaluate(obj.position.y, scope));
        const z = obj.position.z
          ? Number(math.evaluate(obj.position.z, scope))
          : 0;
        mesh.position.set(x, y, z);
      } catch {
        // skip
      }

      // Update trail
      const trail = trails.get(obj.id);
      if (trail && state.history.length > 1) {
        const positions: number[] = [];
        for (const h of state.history) {
          const trailScope = { ...h, pi: Math.PI, e: Math.E };
          try {
            const tx = Number(math.evaluate(obj.position.x, trailScope));
            const ty = Number(math.evaluate(obj.position.y, trailScope));
            const tz = obj.position.z
              ? Number(math.evaluate(obj.position.z, trailScope))
              : 0;
            positions.push(tx, ty, tz);
          } catch {
            // skip
          }
        }
        if (positions.length >= 6) {
          trail.geometry.dispose();
          const newGeom = new THREE.BufferGeometry();
          newGeom.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3),
          );
          trail.geometry = newGeom;
        }
      }
    }

    renderer.render(scene, camera);
  }, [state, cfg]);

  return <div ref={containerRef} className="w-full h-full" />;
};

// ── Main Export ──

const AnimatedObjectRenderer: FC<RendererProps> = (props) => {
  const cfg = props.config as AnimatedObjectConfig;

  if (cfg.dimension === "3d") {
    return <Canvas3DRenderer {...props} cfg={cfg} />;
  }

  return <Canvas2DRenderer {...props} cfg={cfg} />;
};

export default AnimatedObjectRenderer;
