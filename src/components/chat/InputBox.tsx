import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, PenTool, FlaskConical, X, Edit2 } from "lucide-react";
import VoiceButton from "@/components/ui/VoiceButton";
import EquationBuilder from "./EquationBuilder";
import ChemistryBuilder from "./ChemistryBuilder";
import { BlockMath } from "react-katex";

interface InputBoxProps {
  onSend: (message: string, equations?: string[]) => void;
  placeholder?: string;
  isLoading: boolean;
  isCentered: boolean;
}

const InputBox: FC<InputBoxProps> = ({
  onSend,
  placeholder,
  isLoading,
  isCentered,
}) => {
  const [message, setMessage] = useState<string>("");
  const [equations, setEquations] = useState<string[]>([]);
  const [showEquationBuilder, setShowEquationBuilder] =
    useState<boolean>(false);
  const [showChemistryBuilder, setShowChemistryBuilder] =
    useState<boolean>(false);
  const [editingEquation, setEditingEquation] = useState<{
    index: number | null;
    latex: string;
  }>({
    index: null,
    latex: "",
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!canSend) return;

    onSend(message, equations);
    setMessage("");
    setEquations([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEquationInsert = (latex: string) => {
    if (editingEquation.index !== null) {
      const newEquations = [...equations];
      newEquations[editingEquation.index] = latex;
      setEquations(newEquations);
    } else {
      setEquations([...equations, latex]);
    }
    setEditingEquation({ index: null, latex: "" });
  };

  const handleChemistryInsert = (formula: string) => {
    setEquations([...equations, formula]);
  };

  const removeEquation = (indexToRemove: number) => {
    setEquations(equations.filter((_, index) => index !== indexToRemove));
  };

  const editEquation = (indexToEdit: number) => {
    setEditingEquation({ index: indexToEdit, latex: equations[indexToEdit] });
    setShowEquationBuilder(true);
  };

  /* Resize on every message change — fires before paint */
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  /* Also run on mount so reopened nodes start at the correct compact height */
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, []);

  const canSend = (message.trim() || equations.length > 0) && !isLoading;

  const inputUi = (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden transition-all focus-within:ring-0 focus-within:outline-none">
        <AnimatePresence>
          {equations.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pt-3 flex flex-wrap gap-2"
            >
              {equations.map((latex, index) => (
                <motion.div
                  key={index}
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative group bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="px-3 py-2 text-lg">
                    <BlockMath math={latex} />
                  </div>
                  <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => editEquation(index)}
                      className="p-1 bg-white dark:bg-gray-600 rounded-full shadow hover:bg-gray-100"
                    >
                      <Edit2 className="w-3 h-3 text-gray-600 dark:text-gray-200" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEquation(index)}
                      className="p-1 bg-white dark:bg-gray-600 rounded-full shadow hover:bg-gray-100"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-4 py-2">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              placeholder ||
              "Ask about physics, or describe what confuses you..."
            }
            className="w-full resize-none bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-[15px] leading-normal min-h-[20px] max-h-[150px]"
            rows={1}
            disabled={isLoading}
          />
        </div>

        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <VoiceButton
              onTranscript={(t: string) => setMessage((p) => p + t)}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowEquationBuilder(true)}
              disabled={isLoading}
              className="bg-slate-50 text-gray-600 px-3 text-sm font-medium rounded-full flex items-center gap-1.5 h-10 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Equation builder"
            >
              <PenTool className="w-4 h-4" />
              <span className="hidden sm:inline">Math</span>
            </button>

            <button
              type="button"
              onClick={() => setShowChemistryBuilder(true)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 h-10 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Chemistry formula builder"
            >
              <FlaskConical className="w-4 h-4" />
              <span className="hidden sm:inline">Chem</span>
            </button>
          </div>

          <motion.button
            type="submit"
            disabled={!canSend}
            whileTap={{ scale: 0.95 }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              canSend
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
            aria-label="Send message"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </div>
    </form>
  );

  return (
    <>
      <div className={`w-full ${isCentered ? "" : "pt-4 pb-4"}`}>
        <div className={`w-full ${isCentered ? "" : "max-w-3xl mx-auto px-4"}`}>
          {inputUi}
        </div>
      </div>

      <EquationBuilder
        isOpen={showEquationBuilder}
        onClose={() => {
          setShowEquationBuilder(false);
          setEditingEquation({ index: null, latex: "" });
        }}
        onInsert={handleEquationInsert}
        initialLatex={editingEquation.latex}
      />

      <ChemistryBuilder
        isOpen={showChemistryBuilder}
        onClose={() => setShowChemistryBuilder(false)}
        onInsert={handleChemistryInsert}
      />
    </>
  );
};

export default InputBox;
