// ============================================================
// MisconceptionPanel — Side panel for misconception tracking
// Shows which misconceptions are addressed across nodes
// ============================================================

import React, { type FC } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import type { GeneratedNode } from "@/types/custom-module";

interface MisconceptionStatus {
  misconception: string;
  addressedInCurrentNode: boolean;
  addressedInOtherNode: string | null; // node title
}

interface MisconceptionPanelProps {
  /** All misconceptions from learning objectives */
  misconceptions: string[];
  /** All nodes in the module */
  nodes: GeneratedNode[];
  /** Current node being edited */
  currentNodeId: string;
  /** Current node content text (to auto-detect) */
  currentContent: string;
}

const MisconceptionPanel: FC<MisconceptionPanelProps> = ({
  misconceptions,
  nodes,
  currentNodeId,
  currentContent,
}) => {
  if (!misconceptions.length) return null;

  const statuses: MisconceptionStatus[] = misconceptions.map((m) => {
    // Check if this node explicitly addresses it
    const currentNode = nodes.find((n) => n.id === currentNodeId);
    const addressedInCurrentNode =
      (currentNode?.addresses_misconception || []).some((am) =>
        am.toLowerCase().includes(m.toLowerCase()),
      ) || currentContent.toLowerCase().includes(m.toLowerCase());

    // Check if another node addresses it
    let addressedInOtherNode: string | null = null;
    for (const node of nodes) {
      if (node.id === currentNodeId) continue;
      if (
        (node.addresses_misconception || []).some((am) =>
          am.toLowerCase().includes(m.toLowerCase()),
        )
      ) {
        addressedInOtherNode = node.title;
        break;
      }
    }

    return { misconception: m, addressedInCurrentNode, addressedInOtherNode };
  });

  const allAddressed = statuses.every(
    (s) => s.addressedInCurrentNode || s.addressedInOtherNode,
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-500" />
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Misconception Tracker
        </h4>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Does this node address these common misconceptions?
      </p>

      <div className="space-y-2">
        {statuses.map((status, index) => (
          <div
            key={index}
            className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-colors ${
              status.addressedInCurrentNode
                ? "bg-emerald-50 dark:bg-emerald-900/20"
                : status.addressedInOtherNode
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "bg-gray-50 dark:bg-gray-800/50"
            }`}
          >
            {status.addressedInCurrentNode ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : status.addressedInOtherNode ? (
              <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {status.misconception}
              </p>
              {status.addressedInCurrentNode && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                  ✓ Addressed here
                </p>
              )}
              {status.addressedInOtherNode &&
                !status.addressedInCurrentNode && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                    Addressed in: {status.addressedInOtherNode}
                  </p>
                )}
              {!status.addressedInCurrentNode &&
                !status.addressedInOtherNode && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    Not yet addressed
                  </p>
                )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div
        className={`text-xs font-medium px-3 py-2 rounded-lg text-center ${
          allAddressed
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
            : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
        }`}
      >
        {allAddressed
          ? "All misconceptions addressed ✓"
          : `${statuses.filter((s) => !s.addressedInCurrentNode && !s.addressedInOtherNode).length} misconception(s) still need attention`}
      </div>
    </motion.div>
  );
};

export default MisconceptionPanel;
