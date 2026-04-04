import { useState, useEffect, useRef } from "react";
import { IconSearch } from "./icons";

export type SuggestPickItem = {
  id: number;
  label: string;
  hint?: string;
};

type SuggestPickInputProps = {
  items: SuggestPickItem[];
  onPick: (id: number) => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  /** Подпись для поля (a11y) */
  inputId?: string;
  className?: string;
};

/**
 * Поле ввода с фильтрацией и выпадающим списком (как combobox на странице регистраций).
 * После выбора родитель обычно меняет `key`, чтобы сбросить строку поиска.
 */
const SuggestPickInput = ({
  items,
  onPick,
  disabled = false,
  loading = false,
  placeholder = "Начните вводить для поиска…",
  inputId,
  className = "",
}: SuggestPickInputProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          (it.hint && it.hint.toLowerCase().includes(q))
      )
    : items;

  useEffect(() => {
    const onDocDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleSelect = async (id: number) => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    try {
      await Promise.resolve(onPick(id));
      setSearchQuery("");
    } catch {
      /* ошибка обрабатывается снаружи */
    }
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || loading) return;

    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filtered.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0 && filtered[highlightedIndex]) {
      e.preventDefault();
      handleSelect(filtered[highlightedIndex].id);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const blocked = disabled || loading;

  return (
    <div ref={containerRef} className={`relative flex-1 ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={searchQuery}
          disabled={blocked}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "Добавление…" : placeholder}
          autoComplete="off"
          className={`w-full rounded-lg border border-gray-300 py-2 pl-3 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-wait disabled:bg-gray-50 ${
            loading ? "opacity-60" : ""
          }`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400">
          <IconSearch size={16} />
        </div>
      </div>

      {isOpen && !blocked && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Нет вариантов</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Ничего не найдено</div>
          ) : (
            <>
              {q && filtered.length < items.length && (
                <div className="border-b border-gray-100 px-3 py-1.5 text-xs text-gray-500">
                  Найдено: {filtered.length} из {items.length}
                </div>
              )}
              <div ref={listRef}>
                {filtered.map((it, index) => (
                  <button
                    key={it.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(it.id)}
                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${
                      index === highlightedIndex ? "bg-blue-50" : ""
                    }`}
                  >
                    <span className="text-gray-900">{it.label}</span>
                    {it.hint ? (
                      <span className="text-xs text-gray-500">{it.hint}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SuggestPickInput;
