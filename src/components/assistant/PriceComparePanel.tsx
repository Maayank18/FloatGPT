import React, { useState } from 'react';
import { ChevronLeft, ShoppingCart } from 'lucide-react';
import { formatInr, PriceOffer } from '../../shopping/priceCompare';

export function PriceComparePanel({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [offers, setOffers] = useState<PriceOffer[]>([]);
  const [searched, setSearched] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  const search = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const next = query.trim();
    if (!next || busy) return;
    setBusy(true);
    setProblem('');
    setOffers([]);
    try {
      const response = await fetch(`/api/prices?q=${encodeURIComponent(next)}`);
      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('json') ? await response.json().catch(() => ({})) : {};
      if (!response.ok || !contentType.includes('json')) {
        setProblem(body.error || 'The stores did not answer. Try the search again.');
        return;
      }
      setSearched(next);
      setOffers(Array.isArray(body.offers) ? body.offers : []);
    } catch {
      setProblem('The stores did not answer. Try the search again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-card-border bg-bg-secondary">
        <button
          type="button"
          onClick={onBack}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-panel-hover"
          aria-label="Back to Home"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <ShoppingCart className="w-4 h-4 text-accent shrink-0" />
        <h3 className="text-sm font-semibold text-text-primary leading-snug">Compare prices</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-xs text-text-secondary leading-relaxed">
          Search any product. FloatGPT looks across shop listings and keeps up to six of the lowest prices it can read.
        </p>
        <form onSubmit={search} className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any product"
            aria-label="Product to compare"
            className="flex-1 min-w-0 bg-bg-secondary border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white disabled:opacity-60"
          >
            {busy ? 'Searching' : 'Search'}
          </button>
        </form>
        {problem && <p className="text-xs text-text-secondary leading-relaxed">{problem}</p>}
        {searched && !busy && offers.length === 0 && !problem && (
          <p className="text-xs text-text-secondary">No listed price matched “{searched}”. Try the exact product name.</p>
        )}
        {offers.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {offers.map((offer, index) => (
              <a
                key={`${offer.store}-${offer.url}`}
                href={offer.url}
                target="_blank"
                rel="noreferrer"
                className="block bg-card border border-card-border rounded-xl p-3 hover:border-accent min-w-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted truncate">{offer.store}</span>
                  {index === 0 && <span className="text-[9px] font-semibold text-accent shrink-0">Lowest</span>}
                </div>
                <p className="text-sm font-semibold text-text-primary mt-1">{formatInr(offer.price)}</p>
                <p className="text-[11px] text-text-secondary mt-1 line-clamp-3 leading-snug">{offer.title}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
