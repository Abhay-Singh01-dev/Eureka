import React, { useState, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  Rocket,
  Menu,
  FolderPlus,
  Trash2,
  Sparkles,
  Film,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import ModuleAccordion from "./ModuleAccordion";
import RecentConversations from "./RecentConversations";
import SettingsDropdown from "./SettingsDropdown";
import type { Chapter, Conversation, SubjectKey, ModulesData } from "@/types";

const MODULES_DATA: ModulesData = {
  physics: [
    { id: "motion", name: "Motion & Forces", icon: "🏃" },
    { id: "gravity", name: "Gravity & Orbits", icon: "🌍" },
    { id: "energy", name: "Energy & Work", icon: "⚡" },
    { id: "waves", name: "Waves & Light", icon: "🌊" },
    { id: "thermo", name: "Thermodynamics", icon: "🔥" },
  ],

  mathematics: [
    { id: "numbers", name: "Numbers & Patterns", icon: "🔢" },
    { id: "algebra", name: "Algebra Fundamentals", icon: "📐" },
    { id: "geometry", name: "Geometry & Space", icon: "📏" },
    { id: "calculus", name: "Calculus Basics", icon: "∫" },
  ],

  chemistry: [
    { id: "atoms", name: "Atoms & Elements", icon: "⚛️" },
    { id: "reactions", name: "Chemical Reactions", icon: "🧪" },
    { id: "bonds", name: "Chemical Bonds", icon: "🔗" },
  ],

  biology: [
    { id: "cells", name: "Cells & Life", icon: "🧬" },
    { id: "evolution", name: "Evolution", icon: "🦎" },
    { id: "ecology", name: "Ecosystems", icon: "🌿" },
  ],
};

interface NavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  children?: React.ReactNode;
  isCollapsed: boolean;
}

const NavItem: FC<NavItemProps> = ({
  icon: Icon,
  children,
  isCollapsed,
  ...props
}) => (
  <button
    {...props}
    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 transition-colors"
  >
    <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
    <AnimatePresence>
      {!isCollapsed && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.2 }}
          className="text-sm font-medium overflow-hidden whitespace-nowrap"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  </button>
);

interface SidebarProps {
  isCollapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onNewChat: () => void;
  onSearchClick: () => void;
  onChapterSelect: (chapter: Chapter) => void;
  activeChapter: Chapter | null;
  onConversationSelect: (conv: Conversation) => void;
  activeConversationId?: string;
  conversations: Conversation[];
  onDeleteConversation?: (id: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => void;
  /** Custom modules loaded from API */
  customModuleChapters?: Chapter[];
  /** Trigger the wizard to create a new custom module */
  onCreateCustomModule?: () => void;
  /** Delete a custom module */
  onDeleteCustomModule?: (moduleId: string) => void;
  /** Trigger the wizard to create a new simulation */
  onCreateSimulation?: () => void;
  /** Trigger the wizard to create a new animation */
  onCreateAnimation?: () => void;
}

const Sidebar: FC<SidebarProps> = ({
  isCollapsed,
  setCollapsed,
  onNewChat,
  onSearchClick,
  onChapterSelect,
  activeChapter,
  onConversationSelect,
  activeConversationId,
  conversations,
  onDeleteConversation,
  onRenameConversation,
  customModuleChapters = [],
  onCreateCustomModule,
  onDeleteCustomModule,
  onCreateSimulation,
  onCreateAnimation,
}) => {
  const [expandedSubject, setExpandedSubject] = useState<SubjectKey | null>(
    "physics",
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [createExpanded, setCreateExpanded] = useState(false);
  const [createSection, setCreateSection] = useState<
    "modules" | "simulations" | "animations" | null
  >(null);

  const handleSubjectToggle = (subject: SubjectKey) => {
    setExpandedSubject(expandedSubject === subject ? null : subject);
  };

  const SidebarIcon = isCollapsed ? Menu : ChevronLeft;

  return (
    <motion.div
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="h-screen bg-white dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700/50 flex flex-col flex-shrink-0 relative"
    >
      {/* Header */}
      <div
        className="p-4 border-b border-gray-200 dark:border-gray-700/50 flex items-center justify-center"
        style={{ minHeight: "65px" }}
      >
        {isCollapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            title="Open sidebar"
          >
            <Rocket className="w-6 h-6 text-blue-600" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1">
              <Rocket className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                EUREKA
              </h1>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </>
        )}
      </div>

      {/* Main navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2">
        <NavItem
          icon={Plus}
          isCollapsed={isCollapsed}
          onClick={onNewChat}
          className="text-gray-700 pt-2 pr-3 pb-2 pl-4 rounded-lg w-full flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors"
        >
          New Chat
        </NavItem>
        <NavItem
          icon={Search}
          isCollapsed={isCollapsed}
          onClick={onSearchClick}
          className="text-gray-700 pt-2 pr-3 pb-2 pl-4 rounded-lg w-full flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors"
        >
          Search
        </NavItem>

        {/* Modules */}
        <div className="pt-2">
          <NavItem
            icon={BookOpen}
            isCollapsed={isCollapsed}
            className="text-gray-700 pt-2 pr-3 pb-2 pl-4 rounded-lg w-full flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors"
          >
            Modules
          </NavItem>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: "auto",
                  opacity: 1,
                  transition: { delay: 0.2 },
                }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1 border-l border-gray-200 dark:border-gray-700 ml-5 pl-3">
                  {(
                    Object.entries(MODULES_DATA) as [SubjectKey, Chapter[]][]
                  ).map(([subject, chapters]) => (
                    <ModuleAccordion
                      key={subject}
                      subject={subject}
                      chapters={chapters}
                      isExpanded={expandedSubject === subject}
                      onToggle={() => handleSubjectToggle(subject)}
                      onChapterClick={onChapterSelect}
                      activeChapter={activeChapter}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Create */}
        <div className="pt-2">
          <button
            onClick={() => !isCollapsed && setCreateExpanded((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Sparkles className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-medium overflow-hidden whitespace-nowrap flex-1 text-left"
                >
                  Create
                </motion.span>
              )}
            </AnimatePresence>
            {!isCollapsed && (
              <motion.div
                animate={{ rotate: createExpanded ? 180 : 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </motion.div>
            )}
          </button>

          <AnimatePresence>
            {!isCollapsed && createExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: "auto",
                  opacity: 1,
                  transition: { delay: 0.1 },
                }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1 border-l border-gray-200 dark:border-gray-700 ml-5 pl-3">
                  {/* ── Modules ── */}
                  <div className="mb-1">
                    <button
                      onClick={() =>
                        setCreateSection((v) =>
                          v === "modules" ? null : "modules",
                        )
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
                        createSection === "modules"
                          ? "text-violet-600 bg-violet-50 dark:bg-violet-900/20"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-violet-500" />
                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                          Modules
                        </span>
                      </div>
                      <motion.div
                        animate={{
                          rotate: createSection === "modules" ? 180 : 0,
                        }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {createSection === "modules" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pl-4 pr-2 py-2 space-y-1">
                            {/* Existing custom modules */}
                            {customModuleChapters.map((mod) => (
                              <div
                                key={mod.id}
                                className={`group w-full flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-md text-left transition-all duration-150 ${
                                  activeChapter?.id === mod.id
                                    ? "bg-violet-100 dark:bg-violet-900/30"
                                    : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                                }`}
                              >
                                <button
                                  onClick={() => onChapterSelect(mod)}
                                  className="flex-1 flex items-center gap-2 min-w-0"
                                >
                                  <span className="text-sm">{mod.icon}</span>
                                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                    {mod.name}
                                  </span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteCustomModule?.(mod.id);
                                  }}
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-150"
                                  title="Delete module"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </div>
                            ))}

                            {/* Create a New Module button */}
                            <button
                              onClick={() => onCreateCustomModule?.()}
                              className="w-full flex items-center gap-2 pl-3 pr-2 py-2 rounded-md text-left border border-dashed border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all duration-150 group"
                            >
                              <FolderPlus className="w-4 h-4 text-violet-500 group-hover:text-violet-600" />
                              <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
                                Create a New Module
                              </span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Simulations ── */}
                  <div className="mb-1">
                    <button
                      onClick={() =>
                        setCreateSection((v) =>
                          v === "simulations" ? null : "simulations",
                        )
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
                        createSection === "simulations"
                          ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-emerald-500" />
                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                          Simulations
                        </span>
                      </div>
                      <motion.div
                        animate={{
                          rotate: createSection === "simulations" ? 180 : 0,
                        }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {createSection === "simulations" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pl-4 pr-2 py-2 space-y-1">
                            <button
                              onClick={() => onCreateSimulation?.()}
                              className="w-full flex items-center gap-2 pl-3 pr-2 py-2 rounded-md text-left border border-dashed border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-150 group"
                            >
                              <FlaskConical className="w-4 h-4 text-emerald-500 group-hover:text-emerald-600" />
                              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                Create a Simulation
                              </span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Animations ── */}
                  <div className="mb-1">
                    <button
                      onClick={() =>
                        setCreateSection((v) =>
                          v === "animations" ? null : "animations",
                        )
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
                        createSection === "animations"
                          ? "text-amber-600 bg-amber-50 dark:bg-amber-900/20"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-amber-500" />
                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                          Animations
                        </span>
                      </div>
                      <motion.div
                        animate={{
                          rotate: createSection === "animations" ? 180 : 0,
                        }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {createSection === "animations" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pl-4 pr-2 py-2 space-y-1">
                            <button
                              onClick={() => onCreateAnimation?.()}
                              className="w-full flex items-center gap-2 pl-3 pr-2 py-2 rounded-md text-left border border-dashed border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-150 group"
                            >
                              <Film className="w-4 h-4 text-amber-500 group-hover:text-amber-600" />
                              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                Create an Animation
                              </span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Conversations */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.3 } }}
              exit={{ opacity: 0 }}
            >
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
                <RecentConversations
                  conversations={conversations}
                  onSelect={onConversationSelect}
                  activeId={activeConversationId}
                  onDelete={onDeleteConversation}
                  onRename={onRenameConversation}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700/50">
        <SettingsDropdown isCollapsed={isCollapsed} />
      </div>
    </motion.div>
  );
};

export default Sidebar;
