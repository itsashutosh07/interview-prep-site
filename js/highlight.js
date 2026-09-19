/**
 * Lightweight syntax highlighter for C++, Java, Python, and SQL.
 * Returns HTML with <span class="tok-*"> tokens (already escaped).
 */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SHARED_KW = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "default", "break",
  "continue", "return", "true", "false", "null", "new", "this", "class",
  "struct", "enum", "public", "private", "protected", "static", "const",
  "void", "try", "catch", "throw", "finally", "import", "from", "as",
]);

const CPP = {
  keywords: new Set([
    ...SHARED_KW,
    "auto", "bool", "char", "int", "long", "short", "float", "double",
    "unsigned", "signed", "sizeof", "typedef", "using", "namespace",
    "template", "typename", "virtual", "override", "final", "inline",
    "friend", "operator", "nullptr", "mutable", "volatile", "extern",
    "goto", "wchar_t", "char16_t", "char32_t", "decltype", "constexpr",
    "noexcept", "concept", "requires", "co_await", "co_return", "co_yield",
    "and", "or", "not", "xor", "delete",
  ]),
  types: new Set([
    "string", "vector", "map", "unordered_map", "set", "unordered_set",
    "pair", "queue", "stack", "priority_queue", "deque", "list", "array",
    "multimap", "multiset", "bitset", "tuple", "optional", "variant",
    "shared_ptr", "unique_ptr", "weak_ptr", "size_t", "ssize_t",
    "int8_t", "int16_t", "int32_t", "int64_t", "uint8_t", "uint16_t",
    "uint32_t", "uint64_t", "ListNode", "TreeNode", "Node",
  ]),
  lineComment: "//",
  blockComment: true,
  stringModes: ['"', "'"],
};

const JAVA = {
  keywords: new Set([
    ...SHARED_KW,
    "abstract", "assert", "boolean", "byte", "char", "int", "long",
    "short", "float", "double", "extends", "implements", "interface",
    "instanceof", "native", "package", "strictfp", "super", "synchronized",
    "throws", "transient", "volatile", "var", "record", "sealed", "permits",
    "yield", "null", "true", "false",
  ]),
  types: new Set([
    "String", "Integer", "Long", "Boolean", "Double", "Float", "Character",
    "Object", "List", "ArrayList", "Map", "HashMap", "Set", "HashSet",
    "Queue", "Deque", "Stack", "Optional", "Stream", "Collections",
    "Comparator", "ConcurrentHashMap", "AtomicInteger", "AtomicReference",
    "ReentrantLock", "ExecutorService", "CompletableFuture", "Future",
    "Thread", "Runnable", "Callable", "Override", "Service", "Component",
    "Repository", "Entity", "Version", "Lock", "LockModeType",
    "VendingMachine", "VendingState", "MenuItem", "Singleton",
  ]),
  lineComment: "//",
  blockComment: true,
  stringModes: ['"', "'"],
};

const PYTHON = {
  keywords: new Set([
    "False", "None", "True", "and", "as", "assert", "async", "await",
    "break", "class", "continue", "def", "del", "elif", "else", "except",
    "finally", "for", "from", "global", "if", "import", "in", "is",
    "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try",
    "while", "with", "yield", "match", "case",
  ]),
  types: new Set([
    "int", "float", "str", "bool", "list", "dict", "set", "tuple",
    "Optional", "List", "Dict", "Set", "Tuple", "Any", "Callable",
  ]),
  lineComment: "#",
  blockComment: false,
  stringModes: ['"', "'"],
};

const SQL = {
  keywords: new Set([
    "select", "from", "where", "and", "or", "not", "in", "is", "null",
    "as", "on", "join", "inner", "left", "right", "full", "outer", "cross",
    "create", "table", "primary", "key", "unique", "foreign", "references",
    "constraint", "index", "default", "insert", "into", "values", "update",
    "set", "delete", "drop", "alter", "add", "column", "if", "exists",
    "order", "by", "group", "having", "limit", "offset", "asc", "desc",
    "distinct", "union", "all", "case", "when", "then", "else", "end",
    "between", "like", "with", "view", "begin", "commit", "rollback",
    "transaction", "cascade", "check", "using", "replace", "ignore",
    "returning", "over", "partition", "window", "true", "false", "for",
    "update", "share", "lock", "nowait", "skip", "locked",
  ]),
  types: new Set([
    "int", "integer", "bigint", "smallint", "tinyint", "varchar", "char",
    "text", "boolean", "bool", "date", "time", "timestamp", "datetime",
    "enum", "decimal", "numeric", "float", "double", "real", "blob",
    "json", "uuid", "serial", "bigserial",
  ]),
  functions: new Set([
    "count", "sum", "avg", "min", "max", "coalesce", "nullif", "cast",
    "convert", "extract", "now", "concat", "lower", "upper", "length",
    "substring", "substr", "trim", "round", "abs", "ifnull", "nvl",
    "greatest", "least", "row_number", "rank", "dense_rank",
  ]),
  lineComment: "--",
  hashComment: true,
  blockComment: true,
  doubledQuotes: true,
  backticks: true,
  caseInsensitive: true,
};

function langConfig(lang) {
  const l = (lang || "").toLowerCase();
  if (l === "cpp" || l === "c++" || l === "c") return CPP;
  if (l === "java") return JAVA;
  if (l === "python" || l === "py") return PYTHON;
  if (l === "sql") return SQL;
  return null;
}

function isIdentStart(ch) {
  return /[A-Za-z_]/.test(ch);
}

function isIdent(ch) {
  return /[A-Za-z0-9_]/.test(ch);
}

/**
 * @param {string} code
 * @param {string} lang  cpp | java | python | sql
 * @returns {string} HTML
 */
export function highlight(code, lang) {
  const cfg = langConfig(lang);
  if (!cfg || !code) return escapeHtml(code);

  let i = 0;
  const n = code.length;
  let out = "";

  const push = (cls, text) => {
    out += `<span class="tok-${cls}">${escapeHtml(text)}</span>`;
  };

  while (i < n) {
    const ch = code[i];
    const next2 = code.slice(i, i + 2);

    // Line comment
    if (cfg.lineComment && code.startsWith(cfg.lineComment, i)) {
      let j = i;
      while (j < n && code[j] !== "\n") j++;
      push("cm", code.slice(i, j));
      i = j;
      continue;
    }

    // MySQL # comment
    if (cfg.hashComment && ch === "#") {
      let j = i;
      while (j < n && code[j] !== "\n") j++;
      push("cm", code.slice(i, j));
      i = j;
      continue;
    }

    // Block comment /* */
    if (cfg.blockComment && next2 === "/*") {
      let j = i + 2;
      while (j < n - 1 && !(code[j] === "*" && code[j + 1] === "/")) j++;
      j = Math.min(n, j + 2);
      push("cm", code.slice(i, j));
      i = j;
      continue;
    }

    // Python triple quotes
    if (langConfig(lang) === PYTHON && (code.startsWith('"""', i) || code.startsWith("'''", i))) {
      const q = code.slice(i, i + 3);
      let j = i + 3;
      while (j < n && code.slice(j, j + 3) !== q) j++;
      j = Math.min(n, j + 3);
      push("st", code.slice(i, j));
      i = j;
      continue;
    }

    // Quoted identifiers (`table`)
    if (cfg.backticks && ch === "`") {
      let j = i + 1;
      while (j < n) {
        if (code[j] === "`" && code[j + 1] === "`") {
          j += 2;
          continue;
        }
        if (code[j] === "`") {
          j++;
          break;
        }
        j++;
      }
      push("st", code.slice(i, j));
      i = j;
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === quote) {
          if (cfg.doubledQuotes && code[j + 1] === quote) {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        if (code[j] === "\n" && langConfig(lang) !== PYTHON) break;
        j++;
      }
      push("st", code.slice(i, j));
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(code[i + 1] || ""))) {
      let j = i;
      if (code.startsWith("0x", i) || code.startsWith("0X", i)) {
        j += 2;
        while (j < n && /[0-9a-fA-F]/.test(code[j])) j++;
      } else {
        while (j < n && /[0-9.]/.test(code[j])) j++;
        if (j < n && /[lLfFdDuU]/.test(code[j])) j++;
      }
      push("nm", code.slice(i, j));
      i = j;
      continue;
    }

    // Identifiers / keywords / types / functions
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdent(code[j])) j++;
      const word = code.slice(i, j);

      // Lookahead for function call
      let k = j;
      while (k < n && /\s/.test(code[k])) k++;
      const isFn = code[k] === "(";

      const key = cfg.caseInsensitive ? word.toLowerCase() : word;
      const knownFn = cfg.functions ? cfg.functions.has(key) : isFn;
      if (cfg.keywords.has(key)) {
        push("kw", word);
      } else if (cfg.types.has(key)) {
        push("ty", word);
      } else if (isFn && knownFn) {
        push("fn", word);
      } else if (/^[A-Z]/.test(word) && word.length > 1) {
        // PascalCase → type-ish (ListNode, HashMap, etc.)
        push("ty", word);
      } else {
        out += escapeHtml(word);
      }
      i = j;
      continue;
    }

    // Preprocessor (C++)
    if (ch === "#" && (lang === "cpp" || lang === "c++" || lang === "c")) {
      let j = i;
      while (j < n && code[j] !== "\n") j++;
      push("kw", code.slice(i, j));
      i = j;
      continue;
    }

    // Single punctuation / whitespace
    out += escapeHtml(ch);
    i++;
  }

  return out;
}

export function supportsHighlight(lang) {
  return !!langConfig(lang);
}
