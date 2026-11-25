import { useLang } from "@/context/LanguageContext";
import { LANGUAGES } from "@/lib/i18n";

export function LangSwitcher({ large = false }: { large?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center" role="group" aria-label="Language">
      {LANGUAGES.map((l, i) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setLang(l.id)}
          aria-pressed={lang === l.id}
          className={`nb-press bg-white font-bold uppercase ${
            large ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs"
          } ${lang === l.id ? "!bg-[#ffc53d]" : ""} ${i > 0 ? "-ml-[2px]" : ""}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
