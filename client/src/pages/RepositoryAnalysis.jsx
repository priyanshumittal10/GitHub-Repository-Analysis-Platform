import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import {
  ShieldCheck,
  Code2,
  FileText,
  Wrench,
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Terminal,
  MessageSquare,
} from "lucide-react";
import FormattedText from "../components/FormattedText";

export default function RepositoryAnalysis() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [repo, setRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("findings"); // findings, recommendations, onboarding

  const fetchAnalysisData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [repoRes, analysisRes] = await Promise.allSettled([
        api.get(`/repositories/${id}`),
        api.get(`/repositories/${id}/analysis`),
      ]);

      if (repoRes.status === "fulfilled") {
        setRepo(repoRes.value.data.repository);
      }

      if (analysisRes.status === "fulfilled") {
        setAnalysis(analysisRes.value.data.analysis);
      } else {
        // Not analyzed yet, trigger automatically
        await handleTriggerAnalysis();
      }
    } catch (err) {
      setError(err.customMessage || "Failed to load analysis data.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.post(`/repositories/${id}/analyze`);
      setAnalysis(res.data.analysis);
    } catch (err) {
      setError(err.customMessage || "Failed to run static analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchAnalysisData();
  }, [id]);

  if (loading && !analysis) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">
          Running static analysis and scoring engine...
        </p>
      </div>
    );
  }

  const scoreColor =
    analysis?.healthScore >= 80
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : analysis?.healthScore >= 60
        ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
        : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to={`/repository/${id}`}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Repository Overview</span>
        </Link>

        <div className="flex items-center gap-3">
        <Link to={`/repository/${id}/chat`} 
         className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/10 hover:bg-violet-600/20 text-violet-300 border border-violet-500/20 text-xs font-medium transition" > 
         <MessageSquare className="w-3.5 h-3.5" /> 
         <span>Open Code Chat</span> 
         </Link> 

        <button
          onClick={handleTriggerAnalysis}
          disabled={analyzing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${analyzing ? "animate-spin text-indigo-400" : ""}`}
          />
          <span>{analyzing ? "Re-analyzing..." : "Re-run Analysis"}</span>
        </button>
      </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Score & Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score Dial */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col items-center justify-center text-center space-y-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Repository Health Score
          </span>

          <div
            className={`w-36 h-36 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl ${scoreColor}`}
          >
            <span className="text-4xl font-extrabold tracking-tight">
              {analysis?.healthScore}
            </span>
            <span className="text-xs font-medium opacity-80">out of 100</span>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">
              {analysis?.healthScore >= 80
                ? "Production Ready"
                : analysis?.healthScore >= 60
                  ? "Moderate Health"
                  : "Needs Attention"}
            </h3>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Deterministic score derived from static analysis, documentation,
              testing, and security heuristics.
            </p>
          </div>
        </div>

        {/* AI Architectural Summary */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">
                  AI-Powered Repository Summary
                </h3>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Grounded Interpretation
              </span>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              <FormattedText text={analysis?.aiSummary || "Analysis summary is generating..."} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
            <div>
              <span>Files Audited: </span>
              <strong className="text-slate-200 font-mono">
                {analysis?.metrics?.totalFiles || 0}
              </strong>
            </div>
            <div>
              <span>Test Files: </span>
              <strong className="text-slate-200 font-mono">
                {analysis?.metrics?.testFiles || 0}
              </strong>
            </div>
            <div>
              <span>Static Findings: </span>
              <strong className="text-slate-200 font-mono">
                {analysis?.findings?.length || 0}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Category Breakdown Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Category Breakdown</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: "Code Quality",
              score: analysis?.categories?.codeQuality || 0,
              icon: Code2,
              weight: "20%",
            },
            {
              label: "Security",
              score: analysis?.categories?.security || 0,
              icon: ShieldCheck,
              weight: "20%",
            },
            {
              label: "Documentation",
              score: analysis?.categories?.documentation || 0,
              icon: FileText,
              weight: "15%",
            },
            {
              label: "Maintainability",
              score: analysis?.categories?.maintainability || 0,
              icon: Wrench,
              weight: "15%",
            },
            {
              label: "Architecture",
              score: analysis?.categories?.architecture || 0,
              icon: Layers,
              weight: "15%",
            },
            {
              label: "Testing",
              score: analysis?.categories?.testing || 0,
              icon: CheckCircle2,
              weight: "15%",
            },
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.label}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <Icon className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-mono text-slate-500">
                    {cat.weight}
                  </span>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">
                    {cat.score}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 truncate">
                    {cat.label}
                  </div>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      cat.score >= 80
                        ? "bg-emerald-400"
                        : cat.score >= 60
                          ? "bg-amber-400"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs: Findings / Recommendations / Onboarding */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          {[
            {
              id: "findings",
              label: `Static Findings (${analysis?.findings?.length || 0})`,
            },
            {
              id: "recommendations",
              label: `Recommendations (${analysis?.aiRecommendations?.length || 0})`,
            },
            { id: "onboarding", label: "Developer Onboarding Guide" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === t.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Findings Table */}
        {activeTab === "findings" && (
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
            {analysis?.findings && analysis.findings.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {analysis.findings.map((f, i) => (
                  <div
                    key={i}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            f.severity === "high"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : f.severity === "medium"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          }`}
                        >
                          {f.severity}
                        </span>
                        <span className="font-mono text-slate-300 font-semibold">
                          {f.file}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        <FormattedText text={f.message} />
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      Rule: {f.rule}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No high-risk static code issues detected. The repository
                complies with all static rules.
              </div>
            )}
          </div>
        )}

        {/* Tab: Recommendations */}
        {activeTab === "recommendations" && (
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Prioritized Action Items
            </h4>
            <div className="space-y-3">
              {analysis?.aiRecommendations &&
              analysis.aiRecommendations.length > 0 ? (
                analysis.aiRecommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-300"
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 font-bold text-[11px]">
                      {i + 1}
                    </span>
                    <div className="leading-relaxed mt-0.5">
                      <FormattedText text={rec} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">
                  No recommendations available.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab: Developer Onboarding */}
        {activeTab === "onboarding" && (
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Developer Onboarding Roadmap</span>
              </h4>
              <p className="text-xs text-slate-400">
                Grounded guide to help new contributors get up to speed with
                this codebase.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <h5 className="font-semibold text-indigo-300">
                  Technology Stack & Architecture
                </h5>
                <div className="text-slate-300 leading-relaxed">
                  <FormattedText text={analysis?.aiOnboarding?.techStack} />
                </div>
                <div className="text-slate-400 leading-relaxed">
                  <FormattedText text={analysis?.aiOnboarding?.architecture} />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h5 className="font-semibold text-indigo-300">
                  How to Run & Develop Locally
                </h5>
                <pre className="font-mono text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                  {analysis?.aiOnboarding?.gettingStarted ||
                    "npm install\nnpm start"}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
