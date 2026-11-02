import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, FileImage, FileText, Library, Minus, Plus, StickyNote } from 'lucide-react';
import { DocBlock, readDocx } from '../../flowtion/docx';
import { addFile, addNote, FlowItem, listShelf, readFile, removeItem, saveNote } from '../../flowtion/shelf';

function whenLabel(at: number): string {
  return new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function KindIcon({ kind }: { kind: FlowItem['kind'] }) {
  const className = 'w-3.5 h-3.5 text-text-muted shrink-0';
  if (kind === 'image') return <FileImage className={className} />;
  if (kind === 'note') return <StickyNote className={className} />;
  return <FileText className={className} />;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

function buttonZoom(current: number, direction: 1 | -1): number {
  return clampZoom(current + direction * 0.05);
}

function clampLive(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function trackZoom(
  node: HTMLElement,
  getZoom: () => number,
  preview: (value: number) => void,
  commit: (value: number) => void,
): () => void {
  let live = getZoom();
  let target = live;
  let gesturing = false;
  let raf = 0;
  let idle = 0;
  let last = 0;
  const glide = () => {
    live += (target - live) * 0.18;
    if (Math.abs(target - live) < 0.0015) {
      live = target;
      preview(live);
      raf = 0;
      return;
    }
    preview(live);
    raf = requestAnimationFrame(glide);
  };
  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    if (!gesturing) {
      live = getZoom();
      target = live;
      gesturing = true;
    }
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    if (event.deltaMode === 2) delta *= 400;
    const now = performance.now();
    const step = Math.min(48, Math.max(8, now - last || 16));
    last = now;
    const cap = 0.01 * (step / 16);
    const shift = Math.max(-cap, Math.min(cap, -delta * 0.00075));
    target = clampLive(target * (1 + shift));
    if (!raf) raf = requestAnimationFrame(glide);
    window.clearTimeout(idle);
    idle = window.setTimeout(() => {
      gesturing = false;
      target = clampZoom(target);
      live = target;
      preview(target);
      commit(target);
    }, 200);
  };
  node.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    node.removeEventListener('wheel', onWheel);
    if (raf) cancelAnimationFrame(raf);
    window.clearTimeout(idle);
  };
}

function ZoomBar({ zoom, onChange, labelRef }: { zoom: number; onChange: (zoom: number) => void; labelRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <div className="flex items-center justify-center gap-1 px-3 py-1.5 border-b border-card-border bg-bg-secondary">
      <button
        type="button"
        aria-label="Zoom out"
        disabled={zoom <= MIN_ZOOM}
        onClick={() => onChange(buttonZoom(zoom, -1))}
        className="w-6 h-6 inline-flex items-center justify-center rounded text-text-primary disabled:opacity-30 hover:bg-panel-hover"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        ref={labelRef}
        type="button"
        aria-label="Reset zoom"
        onClick={() => onChange(1)}
        className="w-10 text-center text-[10px] font-semibold text-text-muted hover:text-text-primary"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={zoom >= MAX_ZOOM}
        onClick={() => onChange(buttonZoom(zoom, 1))}
        className="w-6 h-6 inline-flex items-center justify-center rounded text-text-primary disabled:opacity-30 hover:bg-panel-hover"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function fitWidth(scroller: HTMLElement): number {
  const style = getComputedStyle(scroller);
  const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  return Math.max(200, Math.floor(scroller.clientWidth - pad));
}

function placePages(view: HTMLElement, node: HTMLElement, zoomValue: number) {
  node.style.transform = '';
  const frames = [...node.querySelectorAll<HTMLElement>('[data-page]')];
  if (!frames.length) return;
  const width = Math.round(fitWidth(view) * zoomValue);
  const previous = parseFloat(frames[0].style.width) || width;
  const scale = previous > 0 ? width / previous : 1;
  const anchorX = view.scrollLeft + view.clientWidth / 2;
  const anchorY = view.scrollTop + view.clientHeight / 2;
  frames.forEach((frame) => {
    frame.style.width = `${width}px`;
    const canvas = frame.querySelector('canvas');
    const prevW = parseFloat(canvas?.style.width || '');
    const prevH = parseFloat(canvas?.style.height || '');
    if (!canvas || !prevW || !prevH) return;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${Math.round(prevH * (width / prevW))}px`;
  });
  if (Math.abs(scale - 1) > 0.001) {
    view.scrollLeft = anchorX * scale - view.clientWidth / 2;
    view.scrollTop = anchorY * scale - view.clientHeight / 2;
  }
}

function PdfPages({ data }: { data: Uint8Array }) {
  const host = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const gen = useRef(0);
  const [problem, setProblem] = useState('');
  const [zoom, setZoom] = useState(1);
  const [settled, setSettled] = useState(1);
  const [shown, setShown] = useState(1);
  const zoomRef = useRef(1);
  const labelRef = useRef<HTMLButtonElement>(null);
  zoomRef.current = zoom;

  const unbindScroller = useRef<(() => void) | null>(null);
  const bindScroller = useCallback((node: HTMLDivElement | null) => {
    unbindScroller.current?.();
    unbindScroller.current = null;
    scroller.current = node;
    if (!node) return;
    const unbindWheel = trackZoom(node, () => zoomRef.current, (value) => {
      const page = host.current;
      if (!page) return;
      const scale = value / (zoomRef.current || 1);
      page.style.transformOrigin = 'center top';
      page.style.transform = Math.abs(scale - 1) < 0.004 ? '' : `scale(${scale})`;
      if (labelRef.current) labelRef.current.textContent = `${Math.round(value * 100)}%`;
    }, (value) => {
      const view = scroller.current;
      const page = host.current;
      if (view && page) placePages(view, page, value);
      setShown(value);
      setZoom(value);
    });
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (!(event.target instanceof Node) || !host.current?.contains(event.target)) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = node.scrollLeft;
      const startTop = node.scrollTop;
      let dragging = false;
      node.setPointerCapture(event.pointerId);
      const move = (next: PointerEvent) => {
        if (!dragging && Math.hypot(next.clientX - startX, next.clientY - startY) < 5) return;
        dragging = true;
        node.scrollLeft = startLeft - (next.clientX - startX);
        node.scrollTop = startTop - (next.clientY - startY);
      };
      const up = () => {
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
      };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
    };
    node.addEventListener('pointerdown', onPointerDown);
    unbindScroller.current = () => {
      unbindWheel();
      node.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  useEffect(() => {
    const view = scroller.current;
    const node = host.current;
    if (!view || !node) return undefined;
    placePages(view, node, zoom);
    const timer = window.setTimeout(() => setSettled(zoom), 200);
    return () => window.clearTimeout(timer);
  }, [zoom]);

  useEffect(() => {
    const node = host.current;
    const view = scroller.current;
    if (!node || !view) return undefined;
    const token = ++gen.current;
    let cancel = false;
    const paintFrame = async (frame: HTMLElement, pdf: any, width: number) => {
      const canvas = frame.querySelector('canvas');
      const pageNumber = Number(frame.dataset.page);
      if (!canvas || !pageNumber) return;
      const mark = `${width}`;
      if (canvas.dataset.mark === mark) return;
      const slot = canvas as HTMLCanvasElement & { _task?: { cancel: () => void } };
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancel || token !== gen.current) return;
        const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
        const base = page.getViewport({ scale: 1 });
        const display = page.getViewport({ scale: width / base.width });
        let sharpScale = (width / base.width) * ratio;
        if (base.width * sharpScale > 1600) sharpScale = 1600 / base.width;
        const sharp = page.getViewport({ scale: sharpScale });
        slot._task?.cancel?.();
        canvas.width = Math.floor(sharp.width);
        canvas.height = Math.floor(sharp.height);
        canvas.style.width = `${Math.floor(display.width)}px`;
        canvas.style.height = `${Math.floor(display.height)}px`;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context || cancel || token !== gen.current) return;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        const task = page.render({ canvasContext: context, canvas, viewport: sharp });
        slot._task = task;
        await task.promise;
        if (cancel || token !== gen.current) return;
        canvas.dataset.mark = mark;
        frame.style.minHeight = '';
      } catch {
        if (canvas.dataset.mark === mark) canvas.dataset.mark = '';
      }
    };
    const paint = async () => {
      for (let wait = 0; wait < 8 && !cancel && view.clientWidth < 80; wait += 1) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      }
      if (cancel || token !== gen.current) return;
      let pdf = pdfRef.current;
      if (!pdf) {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        if (cancel || token !== gen.current) return;
        if (window.location?.origin) {
          pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdfjs/pdf.worker.min.mjs`;
        }
        pdf = await pdfjs.getDocument({
          data: data.slice(0),
          useWorkerFetch: false,
          cMapUrl: `${window.location.origin}/pdfjs/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${window.location.origin}/pdfjs/standard_fonts/`,
        }).promise;
        if (cancel || token !== gen.current) {
          pdf.destroy?.().catch(() => {});
          return;
        }
        pdfRef.current = pdf;
        const shown = Math.min(pdf.numPages, 30);
        node.replaceChildren();
        for (let pageNumber = 1; pageNumber <= shown; pageNumber += 1) {
          const frame = document.createElement('div');
          frame.className = 'bg-white rounded-md overflow-hidden shadow-sm border border-black/10';
          frame.dataset.page = String(pageNumber);
          const canvas = document.createElement('canvas');
          canvas.style.display = 'block';
          frame.appendChild(canvas);
          node.appendChild(frame);
        }
        if (pdf.numPages > shown) {
          const more = document.createElement('p');
          more.className = 'text-[11px] text-text-muted px-1';
          more.textContent = `Showing the first ${shown} of ${pdf.numPages} pages.`;
          node.appendChild(more);
        }
      }
      const width = Math.round(fitWidth(view) * zoomRef.current);
      const frames = [...node.querySelectorAll<HTMLElement>('[data-page]')];
      frames.forEach((frame) => {
        frame.style.width = `${width}px`;
        if (!frame.querySelector('canvas')?.style.height) frame.style.minHeight = `${Math.round(width * 1.3)}px`;
      });
      const box = view.getBoundingClientRect();
      const visible = frames.filter((frame, index) => {
        if (index === 0) return true;
        const rect = frame.getBoundingClientRect();
        return rect.bottom > box.top - 500 && rect.top < box.bottom + 500;
      });
      for (const frame of visible) {
        if (cancel || token !== gen.current) return;
        await paintFrame(frame, pdf, width);
      }
    };
    paint().catch(() => {
      if (!cancel && token === gen.current) setProblem('This PDF could not be opened.');
    });
    const viewNode = view;
    const onScroll = () => {
      const pdf = pdfRef.current;
      if (!pdf) return;
      const width = Math.round(fitWidth(viewNode) * zoomRef.current);
      const box = viewNode.getBoundingClientRect();
      node.querySelectorAll<HTMLElement>('[data-page]').forEach((frame) => {
        const rect = frame.getBoundingClientRect();
        if (rect.bottom > box.top - 500 && rect.top < box.bottom + 500) {
          paintFrame(frame, pdf, width).catch(() => {});
        }
      });
    };
    view.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancel = true;
      view.removeEventListener('scroll', onScroll);
    };
  }, [data, settled]);

  useEffect(() => () => {
    pdfRef.current?.destroy?.().catch(() => {});
    pdfRef.current = null;
  }, [data]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <ZoomBar zoom={shown} labelRef={labelRef} onChange={(value) => { const next = clampZoom(value); setShown(next); setZoom(next); }} />
      {problem && <p className="text-[11px] text-text-secondary px-3 py-2">{problem}</p>}
      <div ref={bindScroller} className="flex-1 min-h-0 overflow-auto overscroll-contain px-2 py-2 cursor-grab">
        <div ref={host} className="space-y-3 w-max" />
      </div>
    </div>
  );
}

function FileView({ item, onBack, onRemoved }: { item: FlowItem; onBack: () => void; onRemoved: () => void }) {
  const [problem, setProblem] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [blocks, setBlocks] = useState<DocBlock[] | null>(null);
  const [title, setTitle] = useState(item.title || item.name);
  const [body, setBody] = useState(item.body || '');
  const [busy, setBusy] = useState(item.kind !== 'note');
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const imageRef = useRef<HTMLImageElement>(null);
  const labelRef = useRef<HTMLButtonElement>(null);
  const imageScroll = useRef<HTMLDivElement>(null);
  zoomRef.current = zoom;

  useEffect(() => {
    if (item.kind === 'note') return undefined;
    let url = '';
    let cancel = false;
    readFile(item.id).then(async (blob) => {
      if (cancel) return;
      if (!blob) {
        setProblem('That file is no longer on this PC.');
        setBusy(false);
        return;
      }
      if (item.kind === 'image') {
        url = URL.createObjectURL(blob);
        if (cancel) {
          URL.revokeObjectURL(url);
          return;
        }
        setImageUrl(url);
      } else if (item.kind === 'pdf') {
        setPdf(new Uint8Array(await blob.arrayBuffer()));
      } else {
        const read = await readDocx(new Uint8Array(await blob.arrayBuffer()));
        setBlocks(read);
        if (!read.length) setProblem('This Word file has no readable text.');
      }
      setBusy(false);
    }).catch(() => {
      if (!cancel) {
        setProblem('That file could not be opened.');
        setBusy(false);
      }
    });
    return () => {
      cancel = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.id, item.kind]);

  useEffect(() => {
    setZoom(1);
  }, [item.id]);

  useEffect(() => {
    const node = imageScroll.current;
    if (!node) return undefined;
    return trackZoom(node, () => zoomRef.current, (value) => {
      if (imageRef.current) imageRef.current.style.width = `${value * 100}%`;
      if (labelRef.current) labelRef.current.textContent = `${Math.round(value * 100)}%`;
    }, setZoom);
  }, [imageUrl]);

  const save = async () => {
    const result = await saveNote(item.id, title, body);
    if (!result.ok) setProblem(result.error);
    else setProblem('');
  };

  const remove = async () => {
    await removeItem(item.id);
    onRemoved();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-card-border bg-bg-secondary">
        <button type="button" onClick={onBack} className="p-1 rounded text-text-muted hover:text-text-primary" aria-label="Back to Flowtion">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-text-primary truncate flex-1">{item.kind === 'note' ? (title || 'Note') : item.name}</h3>
        <button type="button" onClick={remove} className="text-[10px] font-semibold text-text-muted hover:text-danger shrink-0">Remove</button>
      </div>
      {item.kind === 'pdf' && pdf && <PdfPages data={pdf} />}
      {item.kind === 'pdf' && !pdf && (
        <p className="px-3 py-3 text-[11px] text-text-muted">{problem || 'Opening…'}</p>
      )}
      {item.kind === 'image' && !imageUrl && (
        <p className="px-3 py-3 text-[11px] text-text-muted">{problem || 'Opening…'}</p>
      )}
      {item.kind === 'image' && imageUrl && (
        <>
          <ZoomBar zoom={zoom} onChange={setZoom} labelRef={labelRef} />
          <div ref={imageScroll} className="flex-1 min-h-0 overflow-auto overscroll-contain px-2 py-2">
            <img ref={imageRef} src={imageUrl} alt={item.name} className="h-auto max-w-none rounded-md" style={{ width: `${Math.round(zoom * 100)}%` }} />
          </div>
        </>
      )}
      {item.kind !== 'pdf' && item.kind !== 'image' && (
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {problem && <p className="text-[11px] text-text-secondary">{problem}</p>}
        {busy && <p className="text-[11px] text-text-muted">Opening…</p>}
        {blocks && blocks.map((block, index) => (
          block.heading
            ? <h4 key={index} className="text-sm font-semibold text-text-primary">{block.text}</h4>
            : <p key={index} className="text-[12px] leading-relaxed text-text-secondary">{block.text}</p>
        ))}
        {item.kind === 'note' && (
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full bg-bg-secondary border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              placeholder="Title"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              className="w-full bg-bg-secondary border border-card-border rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent resize-none"
              placeholder="The note"
            />
            <button type="submit" className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md">Save</button>
          </form>
        )}
      </div>
      )}
    </div>
  );
}

export function FlowtionPanel({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<FlowItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setItems(await listShelf());
  };

  useEffect(() => {
    refresh().catch(() => setProblem('The shelf could not be opened.'));
  }, []);

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await addFile(file);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      await refresh();
      setOpenId(result.item.id);
    } catch {
      setProblem('That file could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const createNote = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem('');
    try {
      const result = await addNote(title, body);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      setTitle('');
      setBody('');
      setWriting(false);
      await refresh();
      setOpenId(result.item.id);
    } catch {
      setProblem('That note could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const open = items.find((item) => item.id === openId);
  if (open) {
    return (
      <FileView
        item={open}
        onBack={() => setOpenId(null)}
        onRemoved={() => {
          setOpenId(null);
          refresh().catch(() => {});
        }}
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-card-border bg-bg-secondary">
        <button type="button" onClick={onBack} className="p-1 rounded text-text-muted hover:text-text-primary" aria-label="Back to Home">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Library className="w-4 h-4 text-accent shrink-0" />
        <h3 className="text-sm font-semibold text-text-primary flex-1">Flowtion</h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        <p className="text-[11px] text-text-secondary leading-relaxed">Keep a few images, PDFs, Word files, and notes here. They open in this panel and stay on this PC.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => picker.current?.click()} disabled={busy} className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md disabled:opacity-50">Add a file</button>
          <button type="button" onClick={() => { setWriting((value) => !value); setProblem(''); }} className="px-3 py-1.5 border border-card-border text-xs font-medium rounded-md text-text-primary">New note</button>
          <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.docx,.doc" className="hidden" onChange={onPick} />
        </div>
        {problem && <p className="text-[11px] text-text-secondary">{problem}</p>}
        {writing && (
          <form className="space-y-2" onSubmit={createNote}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="w-full bg-bg-secondary border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent" />
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="The note" className="w-full bg-bg-secondary border border-card-border rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent resize-none" />
            <button type="submit" disabled={busy} className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md disabled:opacity-50">Save note</button>
          </form>
        )}
        {items.length === 0 && !writing && <p className="text-[11px] text-text-muted">Nothing saved yet.</p>}
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setOpenId(item.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left bg-card border border-card-border rounded-lg hover:bg-bg-secondary">
                <KindIcon kind={item.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-text-primary truncate">{item.name}</span>
                  <span className="block text-[10px] text-text-muted mt-0.5">{item.kind === 'docx' ? 'Word' : item.kind === 'pdf' ? 'PDF' : item.kind === 'image' ? 'Image' : 'Note'} · {whenLabel(item.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
