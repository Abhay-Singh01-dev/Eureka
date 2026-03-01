import React, { useState, useRef, useCallback, type FC } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { ConceptNodeData, NodeType } from "@/types";
import type { ConceptNode as NodeMetadata } from "@/data/motionForcesNodes";

const typeColors: Record<NodeType, string> = {
  foundation: "bg-green-50/30",
  connection: "bg-blue-50/30",
  power: "bg-purple-50/30",
  synthesis: "bg-amber-50/30",
  challenge: "bg-red-50/30",
};

interface ConceptNodeProps {
  node: ConceptNodeData;
  onClick: (node: ConceptNodeData) => void;
  isActive: boolean;
  isCollapsed: boolean;
  /** Optional enriched metadata from the central data config */
  metadata?: NodeMetadata;
}

interface TooltipPos {
  x: number; // left edge of the tooltip box (fixed coords)
  top: number; // top edge of the tooltip box (fixed coords, NO transform Y)
  arrowTop: number; // px from tooltip top to arrow centre — tracks the card even when clamped
  side: "left" | "right";
}

const TOOLTIP_WIDTH = 320;
const TOPBAR_HEIGHT = 72; // height of the sticky nav bar
const TOOLTIP_MAX_H = 460; // generous cap; real height may be less
const SCREEN_PAD = 12; // breathing room from viewport edges

const ConceptNode: FC<ConceptNodeProps> = ({
  node,
  onClick,
  isActive,
  isCollapsed,
  metadata,
}) => {
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const computePos = useCallback((): TooltipPos | null => {
    if (!cardRef.current) return null;
    const rect = cardRef.current.getBoundingClientRect();

    // ── Horizontal ───────────────────────────────────────────────────────────
    // Prefer right of the card; fall back to left if it would clip the viewport
    const side: "left" | "right" =
      rect.right + TOOLTIP_WIDTH + 16 <= window.innerWidth ? "right" : "left";
    const x =
      side === "right" ? rect.right + 14 : rect.left - TOOLTIP_WIDTH - 14;

    // ── Vertical ─────────────────────────────────────────────────────────────
    // We work with the ABSOLUTE TOP EDGE of the tooltip box (no translateY).
    // Ideal: centre the tooltip on the mid-point of the card.
    const cardCenterY = rect.top + rect.height / 2;
    const idealTop = cardCenterY - TOOLTIP_MAX_H / 2;

    // Clamp so the box never hides behind the topbar or falls off the bottom
    const minTop = TOPBAR_HEIGHT + SCREEN_PAD;
    const maxTop = window.innerHeight - TOOLTIP_MAX_H - SCREEN_PAD;
    const top = Math.max(minTop, Math.min(idealTop, maxTop));

    // ── Arrow ─────────────────────────────────────────────────────────────────
    // Arrow must always point at the card's vertical centre even when clamped.
    // arrowTop is the distance (px) from the top edge of the tooltip to the arrow.
    const arrowTop = Math.max(
      16,
      Math.min(cardCenterY - top, TOOLTIP_MAX_H - 16),
    );

    return { x, top, arrowTop, side };
  }, []);

  const handleMouseEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    tooltipTimerRef.current = setTimeout(() => {
      const pos = computePos();
      if (pos) {
        setTooltipPos(pos);
        setShowTooltip(true);
      }
    }, 200);
  };

  const handleMouseLeave = () => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    hideTimerRef.current = setTimeout(() => setShowTooltip(false), 80);
  };

  const handleTooltipEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setShowTooltip(true);
  };

  const getNodeStyle = (): React.CSSProperties => ({
    background: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)",
    border: "2px solid #3B82F6",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  });

  if (isCollapsed) {
    return (
      <motion.div
        whileHover={{ scale: 1.1 }}
        onClick={() => onClick(node)}
        className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all ${
          isActive
            ? "bg-blue-500 ring-2 ring-blue-300"
            : "bg-gray-100 hover:bg-gray-200"
        }`}
        title={metadata?.title ?? node.title}
      >
        <span className="text-lg">{node.emoji}</span>
      </motion.div>
    );
  }

  const displayTitle = metadata?.title ?? node.title;
  const displayTime = metadata?.estimatedTime ?? node.estimatedTime;

  const tooltipContent =
    showTooltip && tooltipPos
      ? ReactDOM.createPortal(
          <AnimatePresence>
            <motion.div
              key={`tooltip-${node.id}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              onMouseEnter={handleTooltipEnter}
              onMouseLeave={handleMouseLeave}
              style={{
                position: "fixed",
                left: tooltipPos.x,
                top: tooltipPos.top,
                zIndex: 9999,
                width: `${TOOLTIP_WIDTH}px`,
                maxHeight: `${TOOLTIP_MAX_H}px`,
                overflowY: "auto",
                pointerEvents: "auto",
              }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-5"
            >
              {/* ── Title ── */}
              <h4
                style={{ fontSize: "18px" }}
                className="font-bold text-gray-900 dark:text-white leading-snug mb-3"
              >
                {displayTitle}
              </h4>

              {/* ── Divider ── */}
              <div className="h-px bg-gray-100 dark:bg-gray-700 mb-3" />

              {/* ── You'll discover ── */}
              {metadata?.discoverPoints &&
                metadata.discoverPoints.length > 0 && (
                  <div className="mb-3">
                    <p
                      style={{ fontSize: "14px" }}
                      className="font-medium text-gray-500 dark:text-gray-400 mb-1.5"
                    >
                      You'll discover:
                    </p>
                    <ul className="space-y-1">
                      {metadata.discoverPoints.map((point, i) => (
                        <li
                          key={i}
                          style={{ fontSize: "14px" }}
                          className="text-gray-700 dark:text-gray-300 flex items-start gap-1.5"
                        >
                          <span className="text-blue-400 mt-0.5 shrink-0">
                            –
                          </span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* ── Divider ── */}
              <div className="h-px bg-gray-100 dark:bg-gray-700 mb-3" />

              {/* ── Time ── */}
              <div
                style={{ fontSize: "13px" }}
                className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-2"
              >
                <span>⏱</span>
                <span>{displayTime}</span>
              </div>

              {/* ── Context note ── */}
              {metadata?.contextNote && (
                <p
                  style={{ fontSize: "13px" }}
                  className="text-gray-500 dark:text-gray-400 italic mb-2 leading-snug"
                >
                  {metadata.contextNote}
                </p>
              )}

              {/* ── Related content ── */}
              {metadata?.relatedContent && (
                <p
                  style={{ fontSize: "13px" }}
                  className="text-gray-500 dark:text-gray-400 mb-3 leading-snug whitespace-pre-line"
                >
                  {metadata.relatedContent}
                </p>
              )}

              {/* ── CTA button ── */}
              <button
                style={{
                  backgroundColor: "#3B82F6",
                  color: "#ffffff",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  width: "100%",
                  cursor: "pointer",
                  border: "none",
                  marginTop: "4px",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTooltip(false);
                  onClick(node);
                }}
              >
                Let's Explore →
              </button>

              {/* ── Arrow pointing toward the node card ── */}
              {tooltipPos.side === "right" ? (
                // Tooltip is to the RIGHT of the card → arrow on LEFT edge pointing left
                <div
                  style={{
                    position: "absolute",
                    left: "-7px",
                    top: `${tooltipPos.arrowTop}px`,
                    transform: "translateY(-50%)",
                    width: 0,
                    height: 0,
                    borderTop: "7px solid transparent",
                    borderBottom: "7px solid transparent",
                    borderRight: "7px solid white",
                  }}
                />
              ) : (
                // Tooltip is to the LEFT of the card → arrow on RIGHT edge pointing right
                <div
                  style={{
                    position: "absolute",
                    right: "-7px",
                    top: `${tooltipPos.arrowTop}px`,
                    transform: "translateY(-50%)",
                    width: 0,
                    height: 0,
                    borderTop: "7px solid transparent",
                    borderBottom: "7px solid transparent",
                    borderLeft: "7px solid white",
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div
      className="relative"
      style={{
        position: "absolute",
        left: `${node.position.x}%`,
        top: `${node.position.y}px`,
        transform: "translate(-50%, 0)",
      }}
    >
      <motion.div
        ref={cardRef}
        style={{
          width: "160px",
          height: "140px",
          borderRadius: "16px",
          ...getNodeStyle(),
        }}
        className={`flex flex-col items-center justify-center p-4 cursor-pointer ${typeColors[node.type]} ${isActive ? "ring-4 ring-blue-400 z-50" : ""}`}
        animate={
          !isActive
            ? {
                boxShadow: [
                  "0 4px 6px rgba(0, 0, 0, 0.1)",
                  "0 8px 12px rgba(59, 130, 246, 0.15)",
                  "0 4px 6px rgba(0, 0, 0, 0.1)",
                ],
              }
            : {}
        }
        transition={
          !isActive ? { duration: 5, repeat: Infinity, ease: "easeInOut" } : {}
        }
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onClick(node)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        aria-label={`${displayTitle} - ${displayTime}`}
        tabIndex={0}
      >
        <div className="text-4xl mb-2">{node.emoji}</div>
        <h3 className="text-sm font-semibold text-center leading-tight text-gray-800 dark:text-gray-100">
          {displayTitle}
        </h3>
      </motion.div>

      {tooltipContent}
    </div>
  );
};

export default ConceptNode;
