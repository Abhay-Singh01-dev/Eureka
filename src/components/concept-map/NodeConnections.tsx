import React, { type FC } from "react";
import { motion } from "framer-motion";
import { nodeConnections as defaultConnections } from "./nodeData";
import type { ConceptNodeData, NodeConnection, NodeState } from "@/types";

interface NodeConnectionsProps {
  nodes: ConceptNodeData[];
  nodeStates: Record<number, NodeState>;
  /** Optional connections array — defaults to motionAndForces connections. */
  connections?: NodeConnection[];
}

const NodeConnections: FC<NodeConnectionsProps> = ({
  nodes,
  nodeStates,
  connections,
}) => {
  const activeConnections = connections || defaultConnections;
  const getNodePosition = (nodeId: number): { x: number; y: number } => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    // Calculate center position
    const x = node.position.x; // percentage
    const y = node.position.y + 70; // center of node (70px is half height)

    return { x, y };
  };

  const getLineStyle = (fromId: number, toId: number) => {
    const fromState = nodeStates[fromId];
    const toState = nodeStates[toId];

    if (fromState === "completed" && toState === "completed") {
      return {
        stroke: "#F59E0B",
        strokeWidth: 3,
        strokeDasharray: "none",
        opacity: 1,
      };
    } else if (fromState === "completed" && toState === "unlocked") {
      return {
        stroke: "#3B82F6",
        strokeWidth: 3,
        strokeDasharray: "8 4",
        opacity: 1,
      };
    } else {
      return {
        stroke: "#D1D5DB",
        strokeWidth: 2,
        strokeDasharray: "4 4",
        opacity: 0.4,
      };
    }
  };

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <defs>
        <marker
          id="arrow-completed"
          viewBox="0 0 10 6"
          refX="9"
          refY="3"
          markerWidth="10"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 3 L 0 6 z" fill="#F59E0B" />
        </marker>
        <marker
          id="arrow-active"
          viewBox="0 0 10 6"
          refX="9"
          refY="3"
          markerWidth="10"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 3 L 0 6 z" fill="#3B82F6" />
        </marker>
        <marker
          id="arrow-locked"
          viewBox="0 0 10 6"
          refX="9"
          refY="3"
          markerWidth="10"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 3 L 0 6 z" fill="#D1D5DB" opacity="0.4" />
        </marker>
      </defs>
      {activeConnections.map((connection, index) => {
        const from = getNodePosition(connection.from);
        const to = getNodePosition(connection.to);
        const style = getLineStyle(connection.from, connection.to);

        // Convert percentage to actual pixels for x coordinate (assuming container width)
        // We'll use viewBox to make this responsive
        const fromX = from.x;
        const toX = to.x;

        // Determine arrow marker based on state
        const fromState = nodeStates[connection.from];
        const toState = nodeStates[connection.to];
        const markerId =
          fromState === "completed" && toState === "completed"
            ? "url(#arrow-completed)"
            : fromState === "completed" && toState === "unlocked"
              ? "url(#arrow-active)"
              : "url(#arrow-locked)";

        return (
          <motion.line
            key={`${connection.from}-${connection.to}`}
            x1={`${fromX}%`}
            y1={from.y}
            x2={`${toX}%`}
            y2={to.y}
            {...style}
            markerEnd={markerId}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          />
        );
      })}
    </svg>
  );
};

export default NodeConnections;
