import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { SecurityPromptCard } from './assistant/SecurityPromptCard';

const SECURITY_CARD_REGEX = /<!--\s*SECURITY_PROMPT_CARD:\s*(\{.*?\})\s*-->/s;

function CopyableBlock({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const [copied, setCopied] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

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

function ChatImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <p className="mb-2 text-sm text-text-primary">Image generation failed.</p>;
  }
  return (
    <img
      src={src}
      alt={alt || 'Generated image'}
      loading="eager"
      referrerPolicy="no-referrer"
      className="max-w-full rounded-xl border border-card-border my-2"
      onError={() => setFailed(true)}
    />
  );
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: { content: string }) {
  // Check if this message contains an embedded Security Prompt Card
  const match = (content || '').match(SECURITY_CARD_REGEX);

  if (match) {
    const jsonStr = match[1];
    let cardData: { category: string; reason: string; script: string } | null = null;
    try {
      cardData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse security card JSON:', e);
    }

    const before = content.slice(0, match.index);
    const after = content.slice(match.index! + match[0].length);

    return (
      <div className="flex flex-col gap-1">
        {before.trim() && <MarkdownRenderer content={before} />}
        {cardData && (
          <SecurityPromptCard
            category={cardData.category}
            reason={cardData.reason}
            script={cardData.script}
          />
        )}
        {after.trim() && <MarkdownRenderer content={after} />}
      </div>
    );
  }

  // Sanitize content:
  // 1. Normalize line endings (\r\n -> \n)
  // 2. Prevent stray bullets/numbers on their own lines: e.g. "* \n" or "1. \n" -> "* " / "1. "
  // 3. Collapse 3 or more consecutive newlines into 2 to eliminate huge empty gaps
  const sanitized = (content || '')
    .replace(/\r\n/g, '\n')
    .replace(/^([ \t]*[-*+•]|\d+\.)[ \t]*\n+/gm, '$1 ')
    .replace(/\n{3,}/g, '\n\n');

  return (
    <div className="markdown-body text-text-primary text-xs leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({node, ...props}: any) => (
            <CopyableBlock className="my-2 border border-card-border rounded-lg bg-panel/30">
              <table className="w-full text-left border-collapse rounded-lg overflow-hidden text-xs" {...props} />
            </CopyableBlock>
          ),
          thead: ({node, ...props}: any) => <thead className="bg-card-border/30 text-text-primary text-[11px] uppercase tracking-wider font-semibold" {...props} />,
          tbody: ({node, ...props}: any) => <tbody className="divide-y divide-card-border/40 bg-panel/10" {...props} />,
          tr: ({node, ...props}: any) => <tr className="hover:bg-card-border/20 transition-colors" {...props} />,
          th: ({node, ...props}: any) => <th className="px-3 py-1.5 font-semibold border-b border-card-border/50 text-text-primary" {...props} />,
          td: ({node, ...props}: any) => <td className="px-3 py-1.5 text-text-primary/90 border-b border-card-border/20 last:border-0" {...props} />,
          p: ({node, ...props}: any) => <p className="mb-2 last:mb-0 leading-relaxed text-text-primary" {...props} />,
          ul: ({node, ...props}: any) => <ul className="list-disc pl-5 my-1.5 space-y-1 text-text-primary" {...props} />,
          ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 my-1.5 space-y-1 text-text-primary" {...props} />,
          li: ({node, ...props}: any) => (
            <li className="pl-0.5 leading-relaxed text-text-primary [&>p]:inline [&>p]:my-0 [&>p+p]:block [&>p+p]:mt-1" {...props} />
          ),
          a: ({node, ...props}: any) => <a className="text-accent hover:underline break-all" target="_blank" rel="noopener noreferrer" {...props} />,
          img: ({node, ...props}: any) => (
            <ChatImage src={props.src} alt={props.alt || 'Generated image'} />
          ),
          h1: ({node, ...props}: any) => <h1 className="text-base font-bold text-text-primary mt-3.5 mb-1.5 first:mt-0 tracking-tight" {...props} />,
          h2: ({node, ...props}: any) => <h2 className="text-sm font-semibold text-text-primary mt-3 mb-1.5 first:mt-0 tracking-tight" {...props} />,
          h3: ({node, ...props}: any) => <h3 className="text-xs font-semibold text-text-primary mt-2 mb-1 first:mt-0 tracking-tight" {...props} />,
          hr: ({node, ...props}: any) => <hr className="my-2.5 border-card-border" {...props} />,
          pre: ({node, ...props}: any) => (
            <CopyableBlock className="my-2">
              <pre className="bg-[#18181b] border border-card-border rounded-lg p-2.5 text-xs text-gray-200 overflow-x-auto m-0 font-mono" {...props} />
            </CopyableBlock>
          ),
          code: ({node, inline, ...props}: any) => inline 
            ? <code className="bg-card-border/40 text-accent px-1.5 py-0.5 rounded text-[11px] font-mono border border-card-border/30" {...props} />
            : <code className="font-mono text-[11px] text-gray-200" {...props} />,
          blockquote: ({node, ...props}: any) => <blockquote className="border-l-2 border-accent/80 pl-3 italic text-text-muted my-2 bg-card-border/10 py-1 rounded-r" {...props} />,
          strong: ({node, ...props}: any) => <strong className="font-semibold text-text-primary" {...props} />,
          em: ({node, ...props}: any) => <em className="italic text-text-primary/90" {...props} />
        }}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  );
});
