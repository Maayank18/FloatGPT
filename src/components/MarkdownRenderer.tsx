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

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({node, ...props}: any) => (
          <CopyableBlock className="my-3 border border-card-border rounded-lg bg-panel/10">
            <table className="w-full text-left border-collapse rounded-lg overflow-hidden" {...props} />
          </CopyableBlock>
        ),
        thead: ({node, ...props}: any) => <thead className="bg-card-border/30 text-text-primary text-xs uppercase tracking-wider" {...props} />,
        tbody: ({node, ...props}: any) => <tbody className="divide-y divide-card-border/50 bg-panel/30" {...props} />,
        tr: ({node, ...props}: any) => <tr className="hover:bg-card-border/20 transition-colors" {...props} />,
        th: ({node, ...props}: any) => <th className="px-4 py-2 font-semibold border-b border-card-border/50" {...props} />,
        td: ({node, ...props}: any) => <td className="px-4 py-2 text-text-muted border-b border-card-border/20 last:border-0" {...props} />,
        p: ({node, ...props}: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
        ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mb-2 space-y-0.5" {...props} />,
        ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props} />,
        li: ({node, ...props}: any) => <li className="pl-1 [&>p]:mb-0.5 [&>p:last-child]:mb-0" {...props} />,
        a: ({node, ...props}: any) => <a className="text-accent hover:underline wrap-break-word" target="_blank" rel="noopener noreferrer" {...props} />,
        img: ({node, ...props}: any) => (
          <ChatImage src={props.src} alt={props.alt || 'Generated image'} />
        ),
        h1: ({node, ...props}: any) => <h1 className="text-lg font-bold text-text-primary mt-4 mb-2" {...props} />,
        h2: ({node, ...props}: any) => <h2 className="text-base font-bold text-text-primary mt-3 mb-2" {...props} />,
        h3: ({node, ...props}: any) => <h3 className="text-sm font-bold text-text-primary mt-3 mb-2" {...props} />,
        pre: ({node, ...props}: any) => (
          <CopyableBlock className="my-3">
            <pre className="bg-[#1e1e1e] border border-card-border rounded-lg p-3 text-xs text-gray-300 m-0" {...props} />
          </CopyableBlock>
        ),
        code: ({node, inline, ...props}: any) => inline 
          ? <code className="bg-card-border/50 text-accent px-1.5 py-0.5 rounded text-[11px] font-mono" {...props} />
          : <code className="font-mono text-[11px]" {...props} />,
        blockquote: ({node, ...props}: any) => <blockquote className="border-l-2 border-accent pl-3 italic text-text-muted/80 my-2" {...props} />,
        strong: ({node, ...props}: any) => <strong className="font-semibold text-text-primary" {...props} />
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
