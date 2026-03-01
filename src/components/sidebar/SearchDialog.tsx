import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FC,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@/types";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conv: Conversation) => void;
}

const SearchDialog: FC<SearchDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number>(0);

  const fetchResults = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = q.trim()
        ? `/api/dashboard/search?q=${encodeURIComponent(q.trim())}`
        : `/api/dashboard/conversations?limit=30`;
      const res = await fetch(url);
      const data = await res.json();
      const mapped: Conversation[] = (data.conversations || []).map(
        (c: any) => ({
          id: c.conversation_id,
          title: c.title,
          created_date: new Date((c.updated_at || c.created_at) * 1000),
        }),
      );
      setResults(mapped);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load all conversations when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("");
      fetchResults("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, fetchResults]);

  // Debounced search on query change
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchResults(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, fetchResults]);

  const handleSelect = (conv: Conversation) => {
    onSelect(conv);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-base font-semibold">
            Search Conversations
          </DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or content..."
              className="pl-9 h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0 max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">
              {query ? "No conversations found" : "No conversations yet"}
            </div>
          ) : (
            <div className="py-1">
              {results.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate font-medium">
                      {conv.title}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatDistanceToNow(new Date(conv.created_date), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchDialog;
