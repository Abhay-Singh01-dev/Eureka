import React, { useState, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChemElement, ChemCompound, ReactionSymbol } from "@/types";

const TABS: { id: string; label: string }[] = [
  { id: "periodic", label: "Periodic Table" },
  { id: "compounds", label: "Common Compounds" },
  { id: "reactions", label: "Reactions" },
  { id: "states", label: "States & Ions" },
];

const COMMON_ELEMENTS: ChemElement[] = [
  { symbol: "H", name: "Hydrogen", number: 1, type: "nonmetal" },
  { symbol: "He", name: "Helium", number: 2, type: "noble" },
  { symbol: "C", name: "Carbon", number: 6, type: "nonmetal" },
  { symbol: "N", name: "Nitrogen", number: 7, type: "nonmetal" },
  { symbol: "O", name: "Oxygen", number: 8, type: "nonmetal" },
  { symbol: "F", name: "Fluorine", number: 9, type: "nonmetal" },
  { symbol: "Na", name: "Sodium", number: 11, type: "metal" },
  { symbol: "Mg", name: "Magnesium", number: 12, type: "metal" },
  { symbol: "Al", name: "Aluminum", number: 13, type: "metal" },
  { symbol: "Si", name: "Silicon", number: 14, type: "metalloid" },
  { symbol: "P", name: "Phosphorus", number: 15, type: "nonmetal" },
  { symbol: "S", name: "Sulfur", number: 16, type: "nonmetal" },
  { symbol: "Cl", name: "Chlorine", number: 17, type: "nonmetal" },
  { symbol: "K", name: "Potassium", number: 19, type: "metal" },
  { symbol: "Ca", name: "Calcium", number: 20, type: "metal" },
  { symbol: "Fe", name: "Iron", number: 26, type: "metal" },
  { symbol: "Cu", name: "Copper", number: 29, type: "metal" },
  { symbol: "Zn", name: "Zinc", number: 30, type: "metal" },
  { symbol: "Br", name: "Bromine", number: 35, type: "nonmetal" },
  { symbol: "Ag", name: "Silver", number: 47, type: "metal" },
  { symbol: "I", name: "Iodine", number: 53, type: "nonmetal" },
  { symbol: "Au", name: "Gold", number: 79, type: "metal" },
];

const COMMON_COMPOUNDS: ChemCompound[] = [
  { formula: "H₂O", name: "Water" },
  { formula: "CO₂", name: "Carbon Dioxide" },
  { formula: "NaCl", name: "Sodium Chloride" },
  { formula: "H₂SO₄", name: "Sulfuric Acid" },
  { formula: "HCl", name: "Hydrochloric Acid" },
  { formula: "NaOH", name: "Sodium Hydroxide" },
  { formula: "NH₃", name: "Ammonia" },
  { formula: "CH₄", name: "Methane" },
  { formula: "C₆H₁₂O₆", name: "Glucose" },
  { formula: "CaCO₃", name: "Calcium Carbonate" },
  { formula: "O₂", name: "Oxygen Gas" },
  { formula: "N₂", name: "Nitrogen Gas" },
];

const REACTION_SYMBOLS: ReactionSymbol[] = [
  { symbol: "→", name: "Yields" },
  { symbol: "⇌", name: "Reversible" },
  { symbol: "+", name: "Plus" },
  { symbol: "Δ", name: "Heat" },
  { symbol: "⬆", name: "Gas Evolved" },
  { symbol: "⬇", name: "Precipitate" },
  { symbol: "hν", name: "Light" },
  { symbol: "[cat.]", name: "Catalyst" },
];

const STATES_IONS: { symbol: string; name: string }[] = [
  { symbol: "(s)", name: "Solid" },
  { symbol: "(l)", name: "Liquid" },
  { symbol: "(g)", name: "Gas" },
  { symbol: "(aq)", name: "Aqueous" },
  { symbol: "⁺", name: "Positive" },
  { symbol: "⁻", name: "Negative" },
  { symbol: "²⁺", name: "2+ charge" },
  { symbol: "²⁻", name: "2- charge" },
  { symbol: "³⁺", name: "3+ charge" },
  { symbol: "³⁻", name: "3- charge" },
];

const SUBSCRIPTS: string[] = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

const elementTypeColors: Record<ChemElement["type"], string> = {
  metal: "bg-blue-100 border-blue-300 hover:bg-blue-200",
  nonmetal: "bg-green-100 border-green-300 hover:bg-green-200",
  metalloid: "bg-purple-100 border-purple-300 hover:bg-purple-200",
  noble: "bg-amber-100 border-amber-300 hover:bg-amber-200",
};

interface ChemistryBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (formula: string) => void;
}

const ChemistryBuilder: FC<ChemistryBuilderProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const [activeTab, setActiveTab] = useState<string>("periodic");
  const [formula, setFormula] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);

  const addToFormula = (text: string) => {
    const newFormula = formula + text;
    setFormula(newFormula);
    setHistory([...history, formula]);
  };

  const undo = () => {
    if (history.length > 0) {
      setFormula(history[history.length - 1]);
      setHistory(history.slice(0, -1));
    }
  };

  const clear = () => {
    setFormula("");
    setHistory([]);
  };

  const handleInsert = () => {
    if (formula.trim()) {
      onInsert(formula);
      clear();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Chemistry Formula Builder
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Preview */}
            <div className="px-6 py-4 bg-teal-50 border-b border-gray-100">
              <p className="text-xs text-teal-600 mb-2">Formula Preview</p>
              <div className="min-h-[60px] bg-white rounded-lg border border-teal-200 px-4 py-3 flex items-center">
                {formula ? (
                  <span className="text-2xl font-medium text-gray-800">
                    {formula}
                  </span>
                ) : (
                  <span className="text-gray-400 italic">
                    Your formula will appear here...
                  </span>
                )}
              </div>

              {/* Subscript buttons */}
              <div className="flex gap-1 mt-3">
                <span className="text-xs text-gray-500 mr-2">Subscripts:</span>
                {SUBSCRIPTS.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => addToFormula(sub)}
                    className="w-7 h-7 rounded border border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-sm font-medium transition-colors"
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 py-3 border-b border-gray-100">
              <div className="flex gap-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-teal-100 text-teal-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 max-h-[300px] overflow-y-auto">
              {activeTab === "periodic" && (
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {COMMON_ELEMENTS.map((el) => (
                    <button
                      key={el.symbol}
                      onClick={() => addToFormula(el.symbol)}
                      className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center ${elementTypeColors[el.type]}`}
                      title={el.name}
                    >
                      <span className="text-xs text-gray-500">{el.number}</span>
                      <span className="text-lg font-bold">{el.symbol}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "compounds" && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {COMMON_COMPOUNDS.map((comp) => (
                    <button
                      key={comp.formula}
                      onClick={() => addToFormula(comp.formula)}
                      className="p-3 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
                    >
                      <span className="text-lg font-medium block">
                        {comp.formula}
                      </span>
                      <span className="text-xs text-gray-500">{comp.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "reactions" && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {REACTION_SYMBOLS.map((item) => (
                    <button
                      key={item.symbol}
                      onClick={() => addToFormula(` ${item.symbol} `)}
                      className="p-4 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all flex flex-col items-center"
                    >
                      <span className="text-2xl">{item.symbol}</span>
                      <span className="text-xs text-gray-500 mt-1">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "states" && (
                <div className="grid grid-cols-5 gap-3">
                  {STATES_IONS.map((item) => (
                    <button
                      key={item.symbol}
                      onClick={() => addToFormula(item.symbol)}
                      className="p-4 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all flex flex-col items-center"
                    >
                      <span className="text-xl font-medium">{item.symbol}</span>
                      <span className="text-xs text-gray-500 mt-1">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            {activeTab === "periodic" && (
              <div className="px-6 py-2 border-t border-gray-100 flex gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>{" "}
                  Metal
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span>{" "}
                  Nonmetal
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></span>{" "}
                  Metalloid
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>{" "}
                  Noble Gas
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
              <div className="flex gap-2">
                <button
                  onClick={undo}
                  disabled={history.length === 0}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Undo2 className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={clear}
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleInsert}
                  disabled={!formula.trim()}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  Insert Formula
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChemistryBuilder;
