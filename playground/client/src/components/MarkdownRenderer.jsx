import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

function CopyableBlock({ children, className = '' }) {
  const [copied, setCopied] = useState(false);
  const blockRef = useRef(null);

  const handleCopy = () => {
    if (blockRef.current) {
      const text = blockRef.current.innerText;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`relative group ${className}`}>
      <div ref={blockRef} className="overflow-x-auto">
        {children}
      </div>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 bg-panel border border-card-border rounded text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent shadow-sm"
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function MarkdownRenderer({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({node, ...props}) => (
          <CopyableBlock className="my-3 border border-card-border rounded-lg bg-panel/10">
            <table className="w-full text-left border-collapse rounded-lg overflow-hidden" {...props} />
          </CopyableBlock>
        ),
        thead: ({node, ...props}) => <thead className="bg-card-border/30 text-text-primary text-xs uppercase tracking-wider" {...props} />,
        tbody: ({node, ...props}) => <tbody className="divide-y divide-card-border/50 bg-panel/30" {...props} />,
        tr: ({node, ...props}) => <tr className="hover:bg-card-border/20 transition-colors" {...props} />,
        th: ({node, ...props}) => <th className="px-4 py-2 font-semibold border-b border-card-border/50" {...props} />,
        td: ({node, ...props}) => <td className="px-4 py-2 text-text-muted border-b border-card-border/20 last:border-0" {...props} />,
        p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
        li: ({node, ...props}) => <li className="pl-1" {...props} />,
        a: ({node, ...props}) => <a className="text-accent hover:underline break-words" target="_blank" rel="noopener noreferrer" {...props} />,
        h1: ({node, ...props}) => <h1 className="text-lg font-bold text-text-primary mt-4 mb-2" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-base font-bold text-text-primary mt-3 mb-2" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-sm font-bold text-text-primary mt-3 mb-2" {...props} />,
        pre: ({node, ...props}) => (
          <CopyableBlock className="my-3">
            <pre className="bg-[#1e1e1e] border border-card-border rounded-lg p-3 text-[13px] text-gray-300 m-0" {...props} />
          </CopyableBlock>
        ),
        code: ({node, inline, ...props}) => inline 
          ? <code className="bg-card-border/50 text-accent px-1.5 py-0.5 rounded text-[13px] font-mono" {...props} />
          : <code className="font-mono text-[13px]" {...props} />,
        blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-accent pl-3 italic text-text-muted/80 my-2" {...props} />,
        strong: ({node, ...props}) => <strong className="font-semibold text-text-primary" {...props} />
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
