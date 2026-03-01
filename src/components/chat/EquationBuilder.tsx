import React, { useState, useRef, useEffect, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlockMath } from "react-katex";
import type { EquationTab, EquationTemplate } from "@/types";

const TABS: EquationTab[] = [
  { id: "calculus", label: "Calculus" },
  { id: "basic", label: "Basic" },
  { id: "operators", label: "Operators" },
  { id: "greek", label: "Greek" },
  { id: "algebra", label: "Algebra" },
  { id: "geometry", label: "Geometry" },
  { id: "matrices", label: "Matrices" },
  { id: "physics", label: "Physics" },
];

const SYMBOLS: Record<string, string[]> = {
  basic: [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "x",
    "y",
    "a",
    "b",
    "n",
    "i",
    "j",
    "k",
    "+",
    "-",
    "\\times",
    "\\div",
    "=",
    "\\neq",
    "<",
    ">",
    "\\leq",
    "\\geq",
    "(",
    ")",
    "\\{",
    "\\}",
    "[",
    "]",
  ],
  operators: [
    "\\pm",
    "\\mp",
    "\\cdot",
    "\\times",
    "\\div",
    "/",
    "\\%",
    "=",
    "\\neq",
    "\\approx",
    "\\equiv",
    "\\propto",
    "\\sim",
    "<",
    ">",
    "\\leq",
    "\\geq",
    "\\land",
    "\\lor",
    "\\lnot",
    "\\Rightarrow",
    "\\Leftrightarrow",
    "\\forall",
    "\\exists",
    "\\in",
    "\\notin",
    "\\subset",
    "\\supset",
    "\\cup",
    "\\cap",
    "\\emptyset",
    "\\mathbb{N}",
    "\\mathbb{Z}",
    "\\mathbb{Q}",
    "\\mathbb{R}",
    "\\mathbb{C}",
  ],
  greek: [
    "\\alpha",
    "\\beta",
    "\\gamma",
    "\\delta",
    "\\epsilon",
    "\\zeta",
    "\\eta",
    "\\theta",
    "\\iota",
    "\\kappa",
    "\\lambda",
    "\\mu",
    "\\nu",
    "\\xi",
    "\\pi",
    "\\rho",
    "\\sigma",
    "\\tau",
    "\\upsilon",
    "\\phi",
    "\\chi",
    "\\psi",
    "\\omega",
    "\\Gamma",
    "\\Delta",
    "\\Theta",
    "\\Lambda",
    "\\Pi",
    "\\Sigma",
    "\\Phi",
    "\\Psi",
    "\\Omega",
  ],
  algebra: [
    "x^2",
    "x^3",
    "x^n",
    "e^x",
    "10^x",
    "\\sqrt{}",
    "\\sqrt[3]{}",
    "\\sqrt[4]{}",
    "\\sqrt[n]{}",
    "\\log",
    "\\ln",
    "\\sin",
    "\\cos",
    "\\tan",
    "\\arcsin",
    "\\arccos",
    "\\arctan",
    "x_0",
    "x_1",
    "x_n",
  ],
  geometry: [
    "\\angle",
    "^\\circ",
    "'",
    "''",
    "\\perp",
    "\\parallel",
    "\\triangle",
    "\\square",
    "\\circ",
    "\\diamond",
    "\\rightarrow",
    "\\vec{}",
    "|\\vec{v}|",
    "\\hat{v}",
    "\\vec{i}",
    "\\vec{j}",
    "\\vec{k}",
    "\\therefore",
    "\\because",
    "\\cong",
  ],
  matrices: [],
  physics: [
    "F",
    "m",
    "a",
    "v",
    "E",
    "p",
    "G",
    "c",
    "h",
    "k",
    "\\hbar",
    "\\text{m}",
    "\\text{kg}",
    "\\text{s}",
    "\\text{N}",
    "\\text{J}",
    "\\text{W}",
    "\\text{V}",
    "\\text{A}",
    "\\text{K}",
    "\\text{mol}",
    "\\text{k}",
    "\\text{M}",
    "\\text{m}",
    "\\mu",
    "\\text{n}",
    "\\vec{F}",
    "\\vec{v}",
    "\\vec{a}",
    "\\vec{E}",
    "\\vec{B}",
  ],
};

const TEMPLATES: Record<string, EquationTemplate[]> = {
  calculus: [
    { label: "Integral", latex: "\\int_{a}^{b} f(x)\\,dx" },
    { label: "Double Integral", latex: "\\iint_{D} f(x,y)\\,dA" },
    { label: "Triple Integral", latex: "\\iiint_{V} f(x,y,z)\\,dV" },
    { label: "Contour Integral", latex: "\\oint_{C} f(z)\\,dz" },
    { label: "Derivative", latex: "\\frac{d}{dx}f(x)" },
    { label: "2nd Derivative", latex: "\\frac{d^2}{dx^2}f(x)" },
    { label: "Partial Derivative", latex: "\\frac{\\partial f}{\\partial x}" },
    { label: "Prime Notation", latex: "f'(x)" },
    { label: "Double Prime", latex: "f''(x)" },
    { label: "Limit", latex: "\\lim_{x \\to a} f(x)" },
    { label: "Limit to Infinity", latex: "\\lim_{x \\to \\infty} f(x)" },
    { label: "Limit to Zero", latex: "\\lim_{x \\to 0} f(x)" },
    { label: "Summation", latex: "\\sum_{i=1}^{n} a_i" },
    { label: "Product", latex: "\\prod_{i=1}^{n} a_i" },
    { label: "Gradient", latex: "\\nabla f" },
    { label: "Laplacian", latex: "\\Delta f" },
  ],
  basic: [
    { label: "Fraction", latex: "\\frac{a}{b}" },
    { label: "Power", latex: "x^{n}" },
    { label: "Subscript", latex: "x_{n}" },
    { label: "Square Root", latex: "\\sqrt{x}" },
    { label: "Cube Root", latex: "\\sqrt[3]{x}" },
    { label: "Nth Root", latex: "\\sqrt[n]{x}" },
  ],
  operators: [
    { label: "Plus/Minus", latex: "\\pm" },
    { label: "Minus/Plus", latex: "\\mp" },
    { label: "Times", latex: "\\times" },
    { label: "Divide", latex: "\\div" },
    { label: "Not Equal", latex: "\\neq" },
    { label: "Approx", latex: "\\approx" },
    { label: "Greater or Equal", latex: "\\geq" },
    { label: "Less or Equal", latex: "\\leq" },
  ],
  greek: [],
  algebra: [
    { label: "Square", latex: "x^2" },
    { label: "Cube", latex: "x^3" },
    { label: "Power n", latex: "x^n" },
    { label: "Exponential", latex: "e^x" },
    { label: "Log base b", latex: "\\log_b(x)" },
    { label: "Natural Log", latex: "\\ln(x)" },
    { label: "Sine", latex: "\\sin(x)" },
    { label: "Cosine", latex: "\\cos(x)" },
    { label: "Tangent", latex: "\\tan(x)" },
  ],
  geometry: [
    { label: "Angle", latex: "\\angle ABC" },
    { label: "Triangle", latex: "\\triangle ABC" },
    { label: "Perpendicular", latex: "AB \\perp CD" },
    { label: "Parallel", latex: "AB \\parallel CD" },
    { label: "Vector", latex: "\\vec{v}" },
    { label: "Magnitude", latex: "|\\vec{v}|" },
    { label: "Unit Vector", latex: "\\hat{v}" },
  ],
  matrices: [
    {
      label: "2×2 Matrix",
      latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}",
    },
    {
      label: "3×3 Matrix",
      latex:
        "\\begin{bmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{bmatrix}",
    },
    {
      label: "Column Vector",
      latex: "\\begin{bmatrix} x \\\\ y \\\\ z \\end{bmatrix}",
    },
    { label: "Row Vector", latex: "\\begin{bmatrix} x & y & z \\end{bmatrix}" },
    { label: "Determinant", latex: "\\det(A)" },
    { label: "Transpose", latex: "A^T" },
    { label: "Inverse", latex: "A^{-1}" },
    {
      label: "Parentheses",
      latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
    },
    {
      label: "Vertical Bars",
      latex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}",
    },
  ],
  physics: [
    { label: "Newton's 2nd Law", latex: "F = ma" },
    { label: "Kinetic Energy", latex: "E_k = \\frac{1}{2}mv^2" },
    { label: "Potential Energy", latex: "E_p = mgh" },
    { label: "Einstein's E=mc²", latex: "E = mc^2" },
    { label: "Momentum", latex: "p = mv" },
    { label: "Force Vector", latex: "\\vec{F} = m\\vec{a}" },
  ],
};

interface EquationBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
  initialLatex?: string;
}

const EquationBuilder: FC<EquationBuilderProps> = ({
  isOpen,
  onClose,
  onInsert,
  initialLatex = "",
}) => {
  const [activeTab, setActiveTab] = useState<string>("calculus");
  const [latex, setLatex] = useState<string>(initialLatex);
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex || "");
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, initialLatex]);

  const insertSymbol = (symbol: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setLatex((prev) => prev + symbol);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newLatex = latex.substring(0, start) + symbol + latex.substring(end);

    setLatex(newLatex);

    // Update recent symbols
    setRecentSymbols((prev) => {
      const filtered = prev.filter((s) => s !== symbol);
      return [symbol, ...filtered].slice(0, 10);
    });

    textarea.focus();
    setTimeout(() => {
      const newPos = start + symbol.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleInsert = () => {
    if (latex.trim()) {
      onInsert(latex);
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Equation Builder
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex md:flex-row flex-col min-h-0">
              {/* Symbol Palette */}
              <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 p-2 flex-shrink-0 overflow-y-auto">
                <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap text-left w-full ${
                        activeTab === tab.id
                          ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor & Preview */}
              <div className="flex-1 flex flex-col p-4 min-w-0 overflow-y-auto">
                {/* Templates Section */}
                {TEMPLATES[activeTab] && TEMPLATES[activeTab].length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Quick Templates
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {TEMPLATES[activeTab].map((template, index) => (
                        <button
                          key={index}
                          onClick={() => insertSymbol(template.latex)}
                          className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center min-h-[50px]"
                          title={template.label}
                        >
                          <div className="scale-75">
                            <BlockMath math={template.latex} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Symbols Grid */}
                {SYMBOLS[activeTab] && SYMBOLS[activeTab].length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Symbols
                    </p>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-48 overflow-y-auto">
                      {SYMBOLS[activeTab].map((symbol, index) => (
                        <button
                          key={index}
                          onClick={() => insertSymbol(symbol)}
                          className="h-10 rounded border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center text-sm"
                        >
                          <BlockMath math={symbol} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* LaTeX Input */}
                <div className="mb-3">
                  <label
                    htmlFor="latex-input"
                    className="text-xs text-gray-500 dark:text-gray-400 mb-1 block"
                  >
                    LaTeX Input
                  </label>
                  <textarea
                    id="latex-input"
                    ref={textareaRef}
                    value={latex}
                    onChange={(e) => setLatex(e.target.value)}
                    className="w-full h-20 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Type LaTeX: \frac{a}{b} or \int_{0}^{\infty}"
                  />
                </div>

                {/* Live Preview */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Live Preview
                  </p>
                  <div className="min-h-[80px] max-h-[120px] bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 p-3 flex items-center justify-center overflow-hidden">
                    {latex ? (
                      <div
                        className="max-w-full"
                        style={{ fontSize: "clamp(14px, 2vw, 20px)" }}
                      >
                        <BlockMath math={latex} errorColor={"#EF4444"} />
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 italic text-sm">
                        Equation preview
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleInsert}
                  disabled={!latex.trim()}
                  className="bg-blue-600 hover:bg-blue-700 dark:text-white"
                >
                  Insert Equation
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EquationBuilder;
