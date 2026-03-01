/**
 * Converts a CustomModule's GeneratedNode[]/NodeEdge[] into the
 * ConceptNodeData[]/NodeConnection[] shapes that ConceptMapView expects.
 */

import type {
  ConceptNodeData,
  NodeConnection,
  NodeState,
  NodeType,
  Progress,
} from "@/types";
import type { GeneratedNode, NodeEdge, NodeGraph } from "@/types/custom-module";
import type { ConceptNode as NodeMetadata } from "@/data/motionForcesNodes";

// ── Helpers ────────────────────────────────────────────────────────────

/** Map string node id → stable numeric id for ConceptNodeData (1-based). */
function buildIdMap(nodes: GeneratedNode[]): Map<string, number> {
  const map = new Map<string, number>();
  nodes.forEach((n, i) => map.set(n.id, i + 1));
  return map;
}

/** Infer NodeType from depth_level and graph position. */
function inferNodeType(
  node: GeneratedNode,
  outDegree: number,
  inDegree: number,
): NodeType {
  if (inDegree === 0) return "foundation";
  if (outDegree === 0) return "synthesis";
  if (node.depth_level >= 5) return "challenge";
  if (node.depth_level >= 3) return "power";
  return "connection";
}

/**
 * Automatically compute DAG-aware positions for nodes.
 * Nodes are placed in rows by topological depth (BFS layers).
 * x is distributed evenly across each row; y increments per layer.
 */
function computePositions(
  nodes: GeneratedNode[],
  edges: NodeEdge[],
): Map<string, { x: number; y: number }> {
  // Build adjacency + in-degree
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    inDeg.set(n.id, 0);
  }
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
  }

  // BFS layering (Kahn's)
  const layers: string[][] = [];
  let queue = nodes
    .filter((n) => (inDeg.get(n.id) || 0) === 0)
    .map((n) => n.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    layers.push([...queue]);
    queue.forEach((id) => visited.add(id));
    const next: string[] = [];
    for (const id of queue) {
      for (const child of adj.get(id) || []) {
        inDeg.set(child, (inDeg.get(child) || 0) - 1);
        if ((inDeg.get(child) || 0) <= 0 && !visited.has(child)) {
          next.push(child);
          visited.add(child);
        }
      }
    }
    queue = next;
  }

  // Any remaining (shouldn't happen in a valid DAG) go to last layer
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      if (layers.length === 0) layers.push([]);
      layers[layers.length - 1].push(n.id);
    }
  }

  // Assign positions — x as percentage across width, y in 180px increments
  const positions = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, layerIdx) => {
    const count = layer.length;
    layer.forEach((id, itemIdx) => {
      const x = count === 1 ? 50 : 15 + (itemIdx / (count - 1)) * 70; // 15%–85% range
      const y = layerIdx * 180;
      positions.set(id, { x, y });
    });
  });

  return positions;
}

// ── Main Converter ─────────────────────────────────────────────────────

export interface ConvertedModule {
  nodes: ConceptNodeData[];
  connections: NodeConnection[];
  initialStates: Record<number, NodeState>;
  initialProgress: Progress;
  metadata: NodeMetadata[];
  /** Reverse mapping: numeric ConceptNodeData.id → original string GeneratedNode.id */
  idMapping: Record<number, string>;
}

export function customModuleToConceptMap(graph: NodeGraph): ConvertedModule {
  const { nodes: genNodes, edges } = graph;
  const idMap = buildIdMap(genNodes);
  const positions = computePositions(genNodes, edges);

  // Compute degrees for type inference
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  genNodes.forEach((n) => {
    outDegree.set(n.id, 0);
    inDegree.set(n.id, 0);
  });
  edges.forEach((e) => {
    outDegree.set(e.from, (outDegree.get(e.from) || 0) + 1);
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  });

  // Compute unlocks map (id → children numeric ids)
  const unlocksMap = new Map<string, number[]>();
  genNodes.forEach((n) => unlocksMap.set(n.id, []));
  edges.forEach((e) => {
    const numTo = idMap.get(e.to);
    if (numTo !== undefined) {
      unlocksMap.get(e.from)?.push(numTo);
    }
  });

  const nodes: ConceptNodeData[] = genNodes.map((gn) => {
    const numId = idMap.get(gn.id)!;
    const pos = positions.get(gn.id) || { x: 50, y: 0 };
    const nodeType = inferNodeType(
      gn,
      outDegree.get(gn.id) || 0,
      inDegree.get(gn.id) || 0,
    );

    return {
      id: numId,
      emoji: gn.emoji || "📖",
      title: gn.title,
      type: nodeType,
      state: "unlocked" as NodeState,
      prerequisites: gn.prerequisites
        .map((pid) => idMap.get(pid))
        .filter((v): v is number => v !== undefined),
      unlocks: unlocksMap.get(gn.id) || [],
      estimatedTime: `${gn.estimated_time || 5} min`,
      position: pos,
      content: {
        welcomeMessage: `Let's explore ${gn.title}! ${gn.description}`,
        videoTitle: gn.title,
        videoDuration: `${Math.max(2, Math.round(Number(gn.estimated_time || 5) * 0.6))}:00`,
        reflectionQuestion: `What is the most important insight you gained from ${gn.title}?`,
      },
    };
  });

  const connections: NodeConnection[] = edges.map((e) => ({
    from: idMap.get(e.from)!,
    to: idMap.get(e.to)!,
  }));

  // All nodes start unlocked for custom modules; first root is "current"
  const initialStates: Record<number, NodeState> = {};
  const rootIds: number[] = [];
  nodes.forEach((n) => {
    initialStates[n.id] = "unlocked";
    if (n.prerequisites.length === 0) rootIds.push(n.id);
  });
  // Mark first root as "completed" so the next layer lights up
  if (rootIds.length > 0) {
    initialStates[rootIds[0]] = "completed";
  }

  const initialProgress: Progress = {
    completedNodes: rootIds.length > 0 ? 1 : 0,
    currentNode: rootIds.length > 0 ? rootIds[0] : undefined,
    totalNodes: nodes.length,
    progressPercentage: rootIds.length > 0 ? (1 / nodes.length) * 100 : 0,
  };

  // Build lightweight metadata for tooltips (matches ConceptNode interface)
  const metadata: NodeMetadata[] = genNodes.map((gn) => {
    const numId = idMap.get(gn.id)!;
    const pos = positions.get(gn.id) || { x: 50, y: 0 };
    const childTitles = (unlocksMap.get(gn.id) || [])
      .map((uid) => {
        const n = nodes.find((node) => node.id === uid);
        return n ? n.title : "";
      })
      .filter(Boolean);

    const discoverPoints = [gn.description];
    if (gn.addresses_misconception) {
      discoverPoints.push(
        `Misconception addressed: ${gn.addresses_misconception}`,
      );
    }

    return {
      id: numId,
      title: gn.title,
      description: gn.description,
      discoverPoints,
      estimatedTime: `~${gn.estimated_time || 5} min`,
      contextNote:
        gn.prerequisites.length === 0
          ? "Great starting point! No prerequisites needed."
          : `Depth level ${gn.depth_level}`,
      relatedContent:
        childTitles.length > 0
          ? `Unlocks: ${childTitles.join(", ")}`
          : undefined,
      relatedNodeIds: unlocksMap.get(gn.id) || [],
      position: pos,
    };
  });

  // Reverse map: numeric id → original string id (e.g. 1 → "node-1")
  const idMapping: Record<number, string> = {};
  idMap.forEach((numId, strId) => {
    idMapping[numId] = strId;
  });

  return {
    nodes,
    connections,
    initialStates,
    initialProgress,
    metadata,
    idMapping,
  };
}
