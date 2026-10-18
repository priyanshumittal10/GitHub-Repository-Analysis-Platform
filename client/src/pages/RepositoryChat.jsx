import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import {
  MessageSquare,
  Send,
  RefreshCw,
  ArrowLeft,
  FileCode,
  Bot,
  User,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function InlineMarkdown({ text }) {
  if (!text) return null;
  const sanitized = String(text)
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/\*{3,}/g, "");
  const parts = sanitized.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="px-1 py-0.5 rounded bg-slate-950 text-indigo-300 font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2).trim();
      if (!inner) return null;
      return (
        <strong key={index} className="font-semibold text-white">
          {inner}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      const inner = part.slice(1, -1).trim();
      if (!inner) return null;
      return <em key={index}>{inner}</em>;
    }
    const cleanPlain = part.replace(/\*\*/g, "");
    return <React.Fragment key={index}>{cleanPlain}</React.Fragment>;
  });
}

function MarkdownMessage({ content }) {
  const lines = String(content || "")
    .replaceAll("\\*\\*", "**")
    .replaceAll("\\-", "-")
    .replace(/\*\*\s*\*\*/g, "")
    .split("\n");
  const blocks = [];
  let list = [];
  let code = null;

  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="list-disc pl-5 space-y-1">
          <>
            {list.map((item, i) => (
              <li key={i}>
                <InlineMarkdown text={item} />
              </li>
            ))}
          </>
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (code !== null) {
        blocks.push(
          <pre
            key={`code-${index}`}
            className="p-3 rounded-lg bg-black/50 border border-slate-800 overflow-x-auto text-[11px] font-mono text-slate-300"
          >
            <code>{code.join("\n")}</code>
          </pre>,
        );
        code = null;
      } else {
        flushList();
        code = [];
      }
      return;
    }
    if (code !== null) {
      code.push(line);
      return;
    }

    const trimmed = line.trim();
    if (/^[-*]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }

    flushList();
    if (!trimmed) {
      blocks.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }
    if (/^###\s+/.test(trimmed)) {
      blocks.push(
        <h4 key={index} className="font-semibold text-white text-sm mt-2">
          <InlineMarkdown text={trimmed.replace(/^###\s+/, "")} />
        </h4>,
      );
    } else if (/^##\s+/.test(trimmed)) {
      blocks.push(
        <h3 key={index} className="font-semibold text-white text-base mt-2">
          <InlineMarkdown text={trimmed.replace(/^##\s+/, "")} />
        </h3>,
      );
    } else if (/^#\s+/.test(trimmed)) {
      blocks.push(
        <h2 key={index} className="font-bold text-white text-lg mt-2">
          <InlineMarkdown text={trimmed.replace(/^#\s+/, "")} />
        </h2>,
      );
    } else if (/^>\s?/.test(trimmed)) {
      blocks.push(
        <blockquote
          key={index}
          className="border-l-2 border-indigo-500 pl-3 text-slate-400"
        >
          <InlineMarkdown text={trimmed.replace(/^>\s?/, "")} />
        </blockquote>,
      );
    } else {
      blocks.push(
        <p key={index}>
          <InlineMarkdown text={trimmed} />
        </p>,
      );
    }
  });

  if (code !== null) {
    blocks.push(
      <pre
        key="unclosed-code"
        className="p-3 rounded-lg bg-black/50 border border-slate-800 overflow-x-auto text-[11px] font-mono text-slate-300"
      >
        <code>{code.join("\n")}</code>
      </pre>,
    );
  }
  flushList();
  return <div className="space-y-1.5">{blocks}</div>;
}

export default function RepositoryChat() {
  const { id } = useParams();
  const [repo, setRepo] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I am your GitInsight repository intelligence assistant. I can answer questions grounded strictly in this codebase with file and line-level source citations. What would you like to explore?",
      sources: [],
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexStatus, setIndexStatus] = useState("");
  const [expandedSourceIndex, setExpandedSourceIndex] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchRepo = async () => {
      try {
        const res = await api.get(`/repositories/${id}`);
        setRepo(res.data.repository);
      } catch (err) {
        console.error("Failed to load repository:", err);
      }
    };
    fetchRepo();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleIndexRepo = async () => {
    setIndexing(true);
    setIndexStatus(
      "Indexing key repository files for repository-grounded RAG...",
    );
    try {
      const res = await api.post(`/repositories/${id}/index`);
      setIndexStatus(res.data.message || "Indexing completed successfully.");
    } catch (err) {
      setIndexStatus(
        err.customMessage || "Indexing failed. Please check the backend.",
      );
    } finally {
      setIndexing(false);
    }
  };

  const handleSend = async (questionText) => {
    const query = questionText || inputQuestion;
    if (!query.trim() || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: query.trim() }]);
    setInputQuestion("");
    setLoading(true);

    try {
      const res = await api.post(`/repositories/${id}/chat`, {
        question: query.trim(),
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.answer,
          sources: res.data.sources || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err.customMessage ||
            "Failed to retrieve the repository answer. Please check the backend and try again.",
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to={`/repository/${id}`}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Grounded Code Chat • {repo?.fullName || "Repository"}</span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Repository-grounded retrieval with file and line-level citations
            </p>
          </div>
        </div>
        <button
          onClick={handleIndexRepo}
          disabled={indexing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition disabled:opacity-50"
          title="Index or re-index code chunks"
        >
          <Database
            className={`w-3.5 h-3.5 ${indexing ? "animate-spin text-indigo-400" : "text-slate-400"}`}
          />
          <span>{indexing ? "Indexing..." : "Index Code"}</span>
        </button>
      </div>

      {indexStatus && (
        <div className="my-2 p-2 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-[11px] text-indigo-300 flex items-center justify-between">
          <span>{indexStatus}</span>
          <button
            onClick={() => setIndexStatus("")}
            className="text-slate-500 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-6 space-y-5 pr-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-md"}`}
            >
              {msg.role === "assistant" ? (
                <MarkdownMessage content={msg.content} />
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}

              {msg.sources?.length > 0 && (
                <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-2">
                  <div className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Cited Source References ({msg.sources.length}):</span>
                  </div>
                  <div className="space-y-1.5">
                    {msg.sources.map((s, idx) => {
                      const isExpanded = expandedSourceIndex === `${i}-${idx}`;
                      return (
                        <div
                          key={idx}
                          className="rounded-lg bg-slate-950/80 border border-slate-800/80 overflow-hidden text-[11px]"
                        >
                          <div
                            onClick={() =>
                              setExpandedSourceIndex(
                                isExpanded ? null : `${i}-${idx}`,
                              )
                            }
                            className="p-2 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition"
                          >
                            <span className="font-mono text-indigo-300 font-medium truncate">
                              {s.file} (L{s.startLine}–L{s.endLine})
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </div>
                          {isExpanded && s.snippet && (
                            <pre className="p-2.5 font-mono text-[10px] text-slate-400 bg-black/40 border-t border-slate-800/60 overflow-x-auto whitespace-pre-wrap">
                              {s.snippet}...
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 rounded-tl-none flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>
                Retrieving relevant repository sections & grounding response...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="py-2 flex flex-wrap gap-1.5 shrink-0">
        {[
          "Where is routing implemented?",
          "How does authentication work?",
          "How does error handling work?",
        ].map((promptText) => (
          <button
            key={promptText}
            onClick={() => handleSend(promptText)}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-400 hover:text-slate-200 border border-slate-800 transition disabled:opacity-50"
          >
            {promptText}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-2 shrink-0 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="Ask a technical question about this repository's code..."
          disabled={loading}
          className="flex-1 py-3 px-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !inputQuestion.trim()}
          className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white disabled:opacity-50 transition shadow-lg shadow-indigo-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
