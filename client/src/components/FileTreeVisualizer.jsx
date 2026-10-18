import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  Image,
  Archive,
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  Check,
  FolderTree,
  List,
  Sparkles,
} from 'lucide-react';

/**
 * Format bytes to readable size (B, KB, MB)
 */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get color and icon based on file extension
 */
function getFileIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return { icon: FileCode, color: 'text-amber-400' };
    case 'ts':
    case 'tsx':
      return { icon: FileCode, color: 'text-sky-400' };
    case 'py':
    case 'pyw':
    case 'ipynb':
      return { icon: FileCode, color: 'text-yellow-400' };
    case 'json':
      return { icon: FileJson, color: 'text-amber-300' };
    case 'html':
    case 'xml':
      return { icon: FileCode, color: 'text-orange-400' };
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return { icon: FileCode, color: 'text-pink-400' };
    case 'md':
    case 'markdown':
    case 'txt':
    case 'rst':
      return { icon: FileText, color: 'text-indigo-400' };
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'ico':
    case 'webp':
      return { icon: Image, color: 'text-emerald-400' };
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
      return { icon: Archive, color: 'text-purple-400' };
    default:
      return { icon: File, color: 'text-slate-400' };
  }
}

/**
 * Builds a hierarchical tree structure from a flat array of file paths.
 */
function buildHierarchy(files) {
  const root = { name: '', path: '', type: 'folder', children: {}, size: 0 };

  files.forEach((file) => {
    const parts = file.path.split('/');
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const currentPath = parts.slice(0, index + 1).join('/');

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          size: isFile ? file.size || 0 : 0,
          children: {},
        };
      } else if (isFile) {
        current.children[part].size = file.size || 0;
      }
      current = current.children[part];
    });
  });

  function toArray(node) {
    const list = Object.values(node.children).map((child) => {
      if (child.type === 'folder') {
        const childrenArr = toArray(child);
        const folderSize = childrenArr.reduce((sum, c) => sum + (c.size || 0), 0);
        return {
          ...child,
          size: folderSize,
          children: childrenArr,
        };
      }
      return child;
    });

    // Sort: Folders first, then alphabetically
    return list.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  return toArray(root);
}

/**
 * Generates ASCII folder tree text for copying
 */
function generateAsciiTree(nodes, prefix = '') {
  let result = '';
  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1;
    const marker = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    result += `${prefix}${marker}${node.name}${node.type === 'folder' ? '/' : ''}\n`;

    if (node.type === 'folder' && node.children && node.children.length > 0) {
      result += generateAsciiTree(node.children, childPrefix);
    }
  });
  return result;
}

export default function FileTreeVisualizer({ files = [], repoName = 'Repository' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'flat'
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());
  const [copied, setCopied] = useState(false);

  // Compute total repository stats
  const stats = useMemo(() => {
    let totalSize = 0;
    const folderSet = new Set();
    files.forEach((f) => {
      totalSize += f.size || 0;
      const parts = f.path.split('/');
      parts.slice(0, -1).forEach((_, i) => {
        folderSet.add(parts.slice(0, i + 1).join('/'));
      });
    });
    return {
      totalFiles: files.length,
      totalFolders: folderSet.size,
      totalSize: formatBytes(totalSize),
    };
  }, [files]);

  // Build hierarchy tree
  const fullTree = useMemo(() => buildHierarchy(files), [files]);

  // Filter files based on search
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return fullTree;
    const term = searchTerm.toLowerCase();

    function filterNode(node) {
      if (node.type === 'file') {
        return node.path.toLowerCase().includes(term) ? node : null;
      }
      const filteredChildren = node.children
        .map(filterNode)
        .filter(Boolean);

      if (filteredChildren.length > 0 || node.name.toLowerCase().includes(term)) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    }

    return fullTree.map(filterNode).filter(Boolean);
  }, [fullTree, searchTerm]);

  // Auto-expand folders when searching
  useMemo(() => {
    if (searchTerm.trim()) {
      const allPaths = new Set();
      function collectFolderPaths(nodes) {
        nodes.forEach((n) => {
          if (n.type === 'folder') {
            allPaths.add(n.path);
            if (n.children) collectFolderPaths(n.children);
          }
        });
      }
      collectFolderPaths(filteredTree);
      setExpandedFolders(allPaths);
    }
  }, [searchTerm, filteredTree]);

  // Toggle folder expansion
  const toggleFolder = (path) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Expand / Collapse all
  const handleToggleAll = (expand) => {
    if (!expand) {
      setExpandedFolders(new Set());
      return;
    }
    const allPaths = new Set();
    function collect(nodes) {
      nodes.forEach((n) => {
        if (n.type === 'folder') {
          allPaths.add(n.path);
          if (n.children) collect(n.children);
        }
      });
    }
    collect(fullTree);
    setExpandedFolders(allPaths);
  };

  // Copy ASCII Tree
  const handleCopyTree = async () => {
    const ascii = `${repoName}/\n${generateAsciiTree(filteredTree)}`;
    try {
      await navigator.clipboard.writeText(ascii);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy tree:', err);
    }
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node, depth = 0) => {
    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.path);
      const childCount = node.children?.length || 0;

      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 18 + 12}px` }}
            className="py-1.5 pr-3 flex items-center justify-between text-xs hover:bg-slate-800/60 rounded-lg cursor-pointer transition group"
          >
            <div className="flex items-center gap-2 truncate font-mono text-slate-200">
              <span className="text-slate-500 group-hover:text-slate-300 transition shrink-0">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <span className="font-semibold text-slate-200 truncate">{node.name}/</span>
              <span className="text-[10px] text-slate-500 font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                {childCount}
              </span>
            </div>
            {node.size > 0 && (
              <span className="text-[10px] font-mono text-slate-500 shrink-0 opacity-0 group-hover:opacity-100 transition">
                {formatBytes(node.size)}
              </span>
            )}
          </div>

          {isExpanded && node.children && node.children.length > 0 && (
            <div className="border-l border-slate-800/80 ml-5">
              {node.children.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File Node
    const { icon: Icon, color } = getFileIcon(node.name);

    return (
      <div
        key={node.path}
        style={{ paddingLeft: `${depth * 18 + 12}px` }}
        className="py-1.5 pr-3 flex items-center justify-between text-xs hover:bg-slate-800/40 rounded-lg transition group font-mono"
      >
        <div className="flex items-center gap-2 truncate text-slate-300">
          <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
          <span className="truncate group-hover:text-white transition">{node.name}</span>
        </div>
        {node.size > 0 && (
          <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
            {formatBytes(node.size)}
          </span>
        )}
      </div>
    );
  };

  // Filtered Flat List
  const flatFilteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return files;
    const term = searchTerm.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(term));
  }, [files, searchTerm]);

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">
              Repository Directory Tree
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {stats.totalFiles} files • {stats.totalFolders} folders
            {stats.totalSize && ` • ${stats.totalSize} total`}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter files..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                &times;
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
            <button
              onClick={() => setViewMode('tree')}
              className={`p-1.5 rounded text-xs transition flex items-center gap-1 ${
                viewMode === 'tree'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Interactive Tree View"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tree</span>
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`p-1.5 rounded text-xs transition flex items-center gap-1 ${
                viewMode === 'flat'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Flat Path List"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Flat</span>
            </button>
          </div>

          {/* Expand / Collapse All (Tree mode only) */}
          {viewMode === 'tree' && (
            <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
              <button
                onClick={() => handleToggleAll(true)}
                className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white transition"
                title="Expand all directories"
              >
                Expand
              </button>
              <span className="text-slate-700">|</span>
              <button
                onClick={() => handleToggleAll(false)}
                className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white transition"
                title="Collapse all directories"
              >
                Collapse
              </button>
            </div>
          )}

          {/* Copy ASCII Tree Button */}
          <button
            onClick={handleCopyTree}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition shadow-sm"
            title="Copy ASCII directory tree for documentation or README"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Tree</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tree Content Area */}
      <div className="max-h-[500px] overflow-y-auto rounded-xl bg-slate-950/90 border border-slate-800/80 p-3 scrollbar-thin scrollbar-thumb-slate-800">
        {viewMode === 'tree' ? (
          filteredTree.length > 0 ? (
            <div className="space-y-0.5">
              {filteredTree.map((node) => renderTreeNode(node, 0))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No files or folders matched your search.
            </div>
          )
        ) : (
          /* Flat List View */
          flatFilteredFiles.length > 0 ? (
            <div className="divide-y divide-slate-800/50 font-mono text-xs">
              {flatFilteredFiles.map((file) => {
                const { icon: Icon, color } = getFileIcon(file.path);
                return (
                  <div
                    key={file.path}
                    className="px-3 py-2 flex items-center justify-between hover:bg-slate-900/60 rounded-md transition"
                  >
                    <div className="flex items-center gap-2 truncate text-slate-300">
                      <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                      <span className="truncate">{file.path}</span>
                    </div>
                    {file.size > 0 && (
                      <span className="text-[11px] text-slate-500 shrink-0 ml-2">
                        {formatBytes(file.size)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No files matched your search.
            </div>
          )
        )}
      </div>
    </div>
  );
}
