// ============================================================
// Graph Validation — DAG validation & topological sort
// ============================================================

import type { NodeGraph } from "@/types/custom-module";

/**
 * Verify the node graph is a valid Directed Acyclic Graph.
 * Uses Kahn's algorithm (BFS-based topological sort).
 */
export function isDAG(graph: NodeGraph): boolean {
  const { nodes, edges } = graph;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    adj.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited++;
    for (const neighbor of adj.get(current) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return visited === nodeIds.size;
}

/**
 * Returns topologically sorted node IDs, or null if a cycle exists.
 */
export function topologicalSort(graph: NodeGraph): string[] | null {
  const { nodes, edges } = graph;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    adj.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adj.get(current) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return sorted.length === nodeIds.size ? sorted : null;
}

/**
 * Check if the graph has at least one synthesis node
 * (a node with no outgoing edges, or explicitly marked).
 */
export function hasSynthesisNode(graph: NodeGraph): boolean {
  const outDegree = new Map<string, number>();
  for (const node of graph.nodes) {
    outDegree.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    outDegree.set(edge.from, (outDegree.get(edge.from) || 0) + 1);
  }
  // A synthesis node = a node with zero outgoing edges (terminal/leaf)
  return Array.from(outDegree.values()).some((deg) => deg === 0);
}

/**
 * Check if adding an edge would create a cycle.
 */
export function wouldCreateCycle(
  graph: NodeGraph,
  fromId: string,
  toId: string,
): boolean {
  // Create a temporary graph with the new edge
  const tempGraph: NodeGraph = {
    nodes: graph.nodes,
    edges: [...graph.edges, { from: fromId, to: toId }],
  };
  return !isDAG(tempGraph);
}

/**
 * Full graph validation — returns array of error messages (empty = valid).
 */
export function validateGraph(graph: NodeGraph): string[] {
  const errors: string[] = [];

  // Node count check
  if (graph.nodes.length < 2) {
    errors.push("Graph must have at least 2 nodes.");
  }
  if (graph.nodes.length > 10) {
    errors.push("Graph cannot exceed 10 nodes.");
  }

  // DAG check
  if (!isDAG(graph)) {
    errors.push("Graph contains circular dependencies.");
  }

  // Synthesis node check
  if (!hasSynthesisNode(graph)) {
    errors.push("Graph must have at least one synthesis (terminal) node.");
  }

  // Node ID uniqueness
  const ids = graph.nodes.map((n) => n.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    errors.push("Duplicate node IDs detected.");
  }

  // Edge validity
  for (const edge of graph.edges) {
    if (!uniqueIds.has(edge.from)) {
      errors.push(`Edge references unknown source node: ${edge.from}`);
    }
    if (!uniqueIds.has(edge.to)) {
      errors.push(`Edge references unknown target node: ${edge.to}`);
    }
    if (edge.from === edge.to) {
      errors.push(`Self-loop detected on node: ${edge.from}`);
    }
  }

  return errors;
}
