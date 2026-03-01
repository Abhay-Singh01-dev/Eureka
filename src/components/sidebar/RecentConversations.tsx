import React, { useState, useRef, useEffect, type FC } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Conversation } from "@/types";

interface RecentConversationsProps {
  conversations: Conversation[];
  onSelect: (conv: Conversation) => void;
  activeId?: string;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
}

const RecentConversations: FC<RecentConversationsProps> = ({
  conversations,
  onSelect,
  activeId,
  onDelete,
  onRename,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus the rename input when entering rename mode
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  if (!conversations || conversations.length === 0) {
    return null;
  }

  const startRename = (conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  };

  const confirmRename = () => {
    if (renamingId && renameValue.trim() && onRename) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  return (
    <div className="px-3 py-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
        Recent
      </h3>
      <div className="space-y-1">
        {conversations.slice(0, 5).map((conv, index) => (
          <motion.div
            key={conv.id || index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-all duration-150 group relative ${
              activeId === conv.id
                ? "bg-gray-100 dark:bg-gray-700/50"
                : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
            }`}
          >
            {/* Clickable conversation area */}
            <button
              className="flex items-start gap-2 flex-1 min-w-0 text-left"
              onClick={() => {
                if (renamingId !== conv.id) onSelect(conv);
              }}
            >
              <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {renamingId === conv.id ? (
                  /* Inline rename input */
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={confirmRename}
                      className="text-sm w-full bg-white dark:bg-gray-700 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        confirmRename();
                      }}
                      className="p-0.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                      title="Confirm"
                    >
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        cancelRename();
                      }}
                      className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                      {conv.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(
                        new Date(conv.created_date || Date.now()),
                        { addSuffix: true },
                      )}
                    </p>
                  </>
                )}
              </div>
            </button>

            {/* 3-dot menu — only show when NOT renaming */}
            {renamingId !== conv.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity flex-shrink-0 mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right" className="w-36">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(conv);
                    }}
                    className="cursor-pointer"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(conv.id);
                    }}
                    className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RecentConversations;
