import React from 'react';

/**
 * Cleanly renders text with markdown bold (**text**) and code (`code`),
 * completely stripping out unnecessary or empty asterisks (** **, ****, etc.).
 */
export default function FormattedText({ text, className = '' }) {
  if (!text || typeof text !== 'string') return null;

  // Clean empty or dangling asterisks (** **, ****)
  const cleaned = text
    .replace(/\*\*\s*\*\*/g, '')
    .replace(/\*{3,}/g, '')
    .trim();

  // Split by markdown bold (**...**) or code (`...`)
  const parts = cleaned.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null;
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={index}
              className="px-1 py-0.5 rounded bg-slate-950 text-indigo-300 font-mono text-[11px]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2).trim();
          if (!inner) return null;
          return (
            <strong key={index} className="font-semibold text-white">
              {inner}
            </strong>
          );
        }
        // Remove any orphaned stray asterisks from plain text chunk
        const cleanedPart = part.replace(/\*\*/g, '');
        return <React.Fragment key={index}>{cleanedPart}</React.Fragment>;
      })}
    </span>
  );
}
