import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  GitBranch,
  Star,
  GitFork,
  AlertCircle,
  FileCode,
  Folder,
  Layers,
  Package,
  Clock,
  ExternalLink,
  ArrowLeft,
  RefreshCw,
  FileText,
  Search,
  Activity,
  Cpu,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import FileTreeVisualizer from "../components/FileTreeVisualizer";
import FormattedText from "../components/FormattedText";

const LANGUAGE_COLORS = [
  "#6366f1", // Indigo
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#64748b", // Slate
];

export default function RepositoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [repo, setRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // overview, files, dependencies, readme
  const [fileSearch, setFileSearch] = useState("");

  const fetchRepo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/repositories/${id}`);
      setRepo(res.data.repository);
    } catch (err) {
      console.error("Failed to fetch repository:", err);
      setError(err.customMessage || "Could not load repository details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepo();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">
          Loading repository intelligence...
        </p>
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-rose-200 space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
            <h2 className="text-lg font-bold">Failed to Load Repository</h2>
          </div>
          <p className="text-sm text-rose-300">
            {error || "Repository not found."}
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-200 hover:text-white border border-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  // Filter file tree
  const filteredFiles = (repo.structure?.fileTree || []).filter((f) =>
    f.path.toLowerCase().includes(fileSearch.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button & quick actions */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Repositories</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to={`/repository/${repo.id}/analysis`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Health & Static Analysis</span>
          </Link>
          <Link
            to={`/repository/${repo.id}/chat`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/10 hover:bg-violet-600/20 text-violet-300 border border-violet-500/30 text-xs font-semibold transition"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>RAG Code Chat</span>
          </Link>
          <a
            href={repo.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 border border-slate-800 transition"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {repo.owner}
              </span>
              <span className="text-slate-600">/</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {repo.name}
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-800">
                {repo.defaultBranch}
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              <FormattedText text={repo.description} />
            </p>
          </div>

          {/* Quick Metrics Chips */}
          <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Stars:</span>
              <strong className="text-slate-200">
                {repo.stars.toLocaleString()}
              </strong>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <GitFork className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400">Forks:</span>
              <strong className="text-slate-200">
                {repo.forks.toLocaleString()}
              </strong>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Analyzed:</span>
              <span className="text-slate-300 font-mono text-[11px]">
                {new Date(repo.analyzedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-slate-800/80 pt-4 overflow-x-auto">
          {[
            { id: "overview", label: "Overview & Languages", icon: Layers },
            {
              id: "files",
              label: `File Tree (${repo.structure?.totalFiles || 0})`,
              icon: Folder,
            },
            {
              id: "dependencies",
              label: `Dependencies (${repo.dependencies?.runtime?.length || 0})`,
              icon: Package,
            },
            { id: "readme", label: "README", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-950 border border-slate-800/80"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab: Overview & Languages */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Language Breakdown */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span>Language Composition</span>
              </h3>
              <span className="text-xs text-slate-400">
                Primary:{" "}
                <strong className="text-indigo-400">
                  {repo.primaryLanguage}
                </strong>
              </span>
            </div>

            {repo.languages && repo.languages.length > 0 ? (
              <div className="space-y-6">
                {/* Horizontal Progress Bar */}
                <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-950 border border-slate-800">
                  {repo.languages.map((lang, idx) => (
                    <div
                      key={lang.name}
                      style={{
                        width: `${lang.percentage}%`,
                        backgroundColor:
                          LANGUAGE_COLORS[idx % LANGUAGE_COLORS.length],
                      }}
                      title={`${lang.name}: ${lang.percentage}%`}
                    />
                  ))}
                </div>

                {/* Language Table / Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {repo.languages.map((lang, idx) => (
                    <div
                      key={lang.name}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              LANGUAGE_COLORS[idx % LANGUAGE_COLORS.length],
                          }}
                        />
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {lang.name}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-indigo-300">
                        {lang.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No language data available for this repository.
              </p>
            )}
          </div>

          {/* Key Architectural Directories */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Folder className="w-4 h-4 text-indigo-400" />
              <span>Key Detected Directories</span>
            </h3>

            {repo.structure?.keyDirectories &&
            repo.structure.keyDirectories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {repo.structure.keyDirectories.map((dir) => (
                  <span
                    key={dir}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300"
                  >
                    <Folder className="w-3 h-3 text-indigo-400" />
                    <span>{dir}/</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No standard architectural directories identified.
              </p>
            )}

            <div className="border-t border-slate-800 pt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total Files Indexed</span>
                <strong className="text-slate-200 font-mono">
                  {repo.structure?.totalFiles}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total Folders</span>
                <strong className="text-slate-200 font-mono">
                  {repo.structure?.totalDirs}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>License</span>
                <strong className="text-slate-200 font-mono">
                  {repo.license}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: File Tree */}
      {activeTab === "files" && (
        <FileTreeVisualizer
          files={repo.structure?.fileTree || []}
          repoName={repo.name || repo.fullName}
        />
      )}

      {/* Tab: Dependencies */}
      {activeTab === "dependencies" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-400" />
                <span>
                  Runtime Dependencies (
                  {repo.dependencies?.runtime?.length || 0})
                </span>
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 text-indigo-400 border border-slate-800">
                Package Manager: {repo.dependencies?.packageManager || "npm"}
              </span>
            </div>

            {repo.dependencies?.runtime &&
            repo.dependencies.runtime.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {repo.dependencies.runtime.map((dep) => (
                  <div
                    key={dep.name}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-slate-200 font-semibold truncate mr-2">
                      {dep.name}
                    </span>
                    <span className="font-mono text-indigo-300 shrink-0 text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {dep.version}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No runtime dependencies found in package.json.
              </p>
            )}
          </div>

          {/* Dev Dependencies */}
          {repo.dependencies?.dev && repo.dependencies.dev.length > 0 && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-violet-400" />
                <span>
                  Development Dependencies ({repo.dependencies.dev.length})
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {repo.dependencies.dev.map((dep) => (
                  <div
                    key={dep.name}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-slate-300 truncate mr-2">
                      {dep.name}
                    </span>
                    <span className="font-mono text-slate-400 shrink-0 text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {dep.version}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: README */}
      {activeTab === "readme" && (
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>README.md Preview</span>
            </h3>
            <span className="text-xs text-slate-400">
              {repo.readme?.exists
                ? "Verified GitHub Readme"
                : "No README in repository"}
            </span>
          </div>

          {repo.readme?.exists ? (
            <div className="prose prose-invert max-w-none text-xs leading-relaxed text-slate-300 font-mono whitespace-pre-wrap bg-slate-950/80 p-6 rounded-xl border border-slate-800 max-h-[600px] overflow-y-auto">
              {repo.readme.content}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-8 text-center">
              This repository does not have a README file.
            </p>
          )}
        </div>
      )}

      {/* Recent Commits Stream */}
      {repo.recentCommits && repo.recentCommits.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Recent Commits Freshness</span>
          </h3>
          <div className="space-y-2">
            {repo.recentCommits.map((c) => (
              <div
                key={c.sha}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {c.sha}
                  </span>
                  <span className="text-slate-200 truncate">{c.message}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0 font-mono">
                  <span>{c.author}</span>
                  <span>&bull;</span>
                  <span>{new Date(c.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
