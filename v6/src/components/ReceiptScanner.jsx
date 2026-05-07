import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { parseReceipt } from '../utils/receiptParser.js';

const isMobile = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const MAX_DIM = 1500;

function resizeToCanvas(img) {
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas;
}

function grayscaleContrast(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const grays = new Uint8Array(data.length / 4);
  let min = 255, max = 0;
  for (let p = 0; p < grays.length; p++) {
    const i = p * 4;
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    grays[p] = g; if (g < min) min = g; if (g > max) max = g;
  }
  const range = max - min || 1;
  for (let p = 0; p < grays.length; p++) {
    const v = Math.round((grays[p] - min) / range * 255);
    const i = p * 4;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

// cropPct: { x1, y1, x2, y2 } — percentages of image dimensions (0–100)
async function preprocessImage(blobUrl, cropPct) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const resized = resizeToCanvas(img);
        const { x1 = 0, y1 = 0, x2 = 100, y2 = 100 } = cropPct || {};
        const cx = Math.round(resized.width  * x1 / 100);
        const cy = Math.round(resized.height * y1 / 100);
        const cw = Math.max(1, Math.round(resized.width  * (x2 - x1) / 100));
        const ch = Math.max(1, Math.round(resized.height * (y2 - y1) / 100));
        const cropped = document.createElement('canvas');
        cropped.width = cw; cropped.height = ch;
        cropped.getContext('2d').drawImage(resized, cx, cy, cw, ch, 0, 0, cw, ch);
        grayscaleContrast(cropped);
        resolve({ canvas: cropped, dataUrl: cropped.toDataURL('image/png') });
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
}

// ─── Crop Tool ────────────────────────────────────────────────────────────────
// imgRef wraps only the <img> element — no letterbox bars.
// All percentages are calculated relative to the img element itself so
// the crop coordinates exactly match image pixel coordinates.
function CropTool({ imgSrc, onConfirm }) {
  const imgRef  = useRef(null);
  const [crop, setCrop] = useState({ x1: 3, y1: 3, x2: 97, y2: 97 });
  const dragRef = useRef(null);

  // Always measure against the img element, not any outer container.
  const getPos = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(100, (clientX - rect.left) / rect.width  * 100)),
      y: Math.max(0, Math.min(100, (clientY - rect.top)  / rect.height * 100)),
    };
  };

  const onDown = (e, h) => { e.preventDefault(); e.stopPropagation(); dragRef.current = { h }; };

  const onMove = useCallback((e) => {
    if (!dragRef.current || !imgRef.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const MIN = 10;
    const h = dragRef.current.h;
    setCrop(prev => {
      const n = { ...prev };
      if (h === 'tl') { n.x1 = Math.min(x, prev.x2 - MIN); n.y1 = Math.min(y, prev.y2 - MIN); }
      if (h === 'tr') { n.x2 = Math.max(x, prev.x1 + MIN); n.y1 = Math.min(y, prev.y2 - MIN); }
      if (h === 'bl') { n.x1 = Math.min(x, prev.x2 - MIN); n.y2 = Math.max(y, prev.y1 + MIN); }
      if (h === 'br') { n.x2 = Math.max(x, prev.x1 + MIN); n.y2 = Math.max(y, prev.y1 + MIN); }
      if (h === 't')  { n.y1 = Math.min(y, prev.y2 - MIN); }
      if (h === 'b')  { n.y2 = Math.max(y, prev.y1 + MIN); }
      if (h === 'l')  { n.x1 = Math.min(x, prev.x2 - MIN); }
      if (h === 'r')  { n.x2 = Math.max(x, prev.x1 + MIN); }
      return n;
    });
  }, []);

  const onUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [onMove, onUp]);

  const { x1, y1, x2, y2 } = crop;
  const HS = 26;

  const mkHandle = (id, hx, hy, cursor) => (
    <div key={id}
      onMouseDown={e => onDown(e, id)}
      onTouchStart={e => onDown(e, id)}
      style={{
        position: 'absolute', left: `${hx}%`, top: `${hy}%`,
        width: HS, height: HS, marginLeft: -HS / 2, marginTop: -HS / 2,
        background: '#fff', border: '2.5px solid var(--primary, #863bff)',
        borderRadius: 5, cursor, touchAction: 'none', zIndex: 4,
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Drag the handles to frame the receipt, then tap <strong>Scan</strong>.
      </p>

      {/* Outer: dark background, centres the image */}
      <div style={{ background: '#111', borderRadius: 8, overflow: 'hidden', display: 'flex', justifyContent: 'center', userSelect: 'none' }}>
        {/* Inner: shrinks to exactly the rendered img size — no letterbox bars */}
        <div style={{ position: 'relative', display: 'inline-block', touchAction: 'none', lineHeight: 0 }}>
          <img
            ref={imgRef}
            src={imgSrc}
            alt="Crop"
            draggable={false}
            style={{ display: 'block', maxWidth: '100%', maxHeight: 340, pointerEvents: 'none' }}
          />

          {/* Dark mask outside crop area */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${y1}%`,        background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: `${y2}%`, left: 0, right: 0, bottom: 0,        background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: `${y1}%`, left: 0, width: `${x1}%`,            height: `${y2-y1}%`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: `${y1}%`, left: `${x2}%`, right: 0,            height: `${y2-y1}%`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />

          {/* Crop border */}
          <div style={{ position: 'absolute', top: `${y1}%`, left: `${x1}%`, width: `${x2-x1}%`, height: `${y2-y1}%`, border: '2px solid rgba(255,255,255,0.9)', boxSizing: 'border-box', pointerEvents: 'none' }} />

          {/* Handles */}
          {mkHandle('tl', x1, y1, 'nw-resize')}
          {mkHandle('tr', x2, y1, 'ne-resize')}
          {mkHandle('bl', x1, y2, 'sw-resize')}
          {mkHandle('br', x2, y2, 'se-resize')}
          {mkHandle('t',  (x1+x2)/2, y1,        'n-resize')}
          {mkHandle('b',  (x1+x2)/2, y2,        's-resize')}
          {mkHandle('l',  x1,        (y1+y2)/2, 'w-resize')}
          {mkHandle('r',  x2,        (y1+y2)/2, 'e-resize')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn-secondary" style={{ flex: 1 }}
          onClick={() => onConfirm({ x1: 0, y1: 0, x2: 100, y2: 100 })}>
          Scan Full Image
        </button>
        <button className="btn-primary" style={{ flex: 2 }}
          onClick={() => onConfirm(crop)}>
          Scan Selected Area
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ReceiptScanner({ onResult, onClose }) {
  const [step, setStep]                 = useState('pick');
  const [imgSrc, setImgSrc]             = useState(null);
  const [processedSrc, setProcessedSrc] = useState(null);
  const [progress, setProgress]         = useState(0);
  const [statusMsg, setStatusMsg]       = useState('');
  const [parsed, setParsed]             = useState(null);
  const [rawText, setRawText]           = useState('');
  const [showRaw, setShowRaw]           = useState(false);
  const [errorDetail, setErrorDetail]   = useState('');

  const fileRef      = useRef(null);
  const cameraRef    = useRef(null);
  const objUrlRef    = useRef(null);

  useEffect(() => () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); }, []);

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    const url = URL.createObjectURL(file);
    objUrlRef.current = url;
    setImgSrc(url);
    setProcessedSrc(null);
    setStep('crop');
  }, []);

  const runOcr = useCallback(async (cropPct) => {
    if (!imgSrc) return;
    setStep('scanning');
    setProgress(0);
    setStatusMsg('Preparing image…');
    try {
      const { canvas, dataUrl } = await preprocessImage(imgSrc, cropPct);
      setProcessedSrc(dataUrl);

      setStatusMsg('Loading OCR engine…');
      const worker = await createWorker('eng', 1, {
        workerPath: '/tesseract-worker.min.js',
        workerBlobURL: false,
        logger: m => {
          if (m.status === 'loading tesseract core')           setStatusMsg('Loading OCR engine…');
          else if (m.status === 'initializing tesseract')      setStatusMsg('Initialising…');
          else if (m.status === 'loading language traineddata') setStatusMsg('Loading language data (first use ~10 MB)…');
          else if (m.status === 'recognizing text') {
            setStatusMsg('Reading text…');
            setProgress(Math.round((m.progress || 0) * 100));
          }
        },
      });
      try { await worker.setParameters({ tessedit_pageseg_mode: '6' }); } catch (_) {}

      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      setRawText(text);
      const result = parseReceipt(text);
      setParsed(result);
      setStep('results');
    } catch (err) {
      console.error('OCR error:', err);
      setErrorDetail(err?.message || String(err) || 'Unknown error');
      setStep('error');
    }
  }, [imgSrc]);

  const handleUse = useCallback(() => {
    if (parsed) onResult(parsed);
    onClose();
  }, [parsed, onResult, onClose]);

  const reset = () => {
    setStep('pick'); setImgSrc(null); setProcessedSrc(null);
    setParsed(null); setRawText(''); setShowRaw(false);
    setProgress(0); setErrorDetail('');
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>Scan Receipt</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── pick ── */}
        {step === 'pick' && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Take a photo or upload an image. You'll be able to crop to the receipt before scanning.
            </p>
            {isMobile() && (
              <>
                <button className="btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  onClick={() => cameraRef.current.click()}>
                  📷 Take Photo
                </button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                  style={{ display: 'none' }} onChange={e => loadFile(e.target.files[0])} />
              </>
            )}
            <button className="btn-secondary" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
              onClick={() => fileRef.current.click()}>
              {isMobile() ? '🖼️ Choose from Gallery' : '📁 Upload Receipt Image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => loadFile(e.target.files[0])} />
          </div>
        )}

        {/* ── crop ── */}
        {step === 'crop' && imgSrc && (
          <div style={{ padding: '1.25rem' }}>
            <CropTool imgSrc={imgSrc} onConfirm={cropPct => runOcr(cropPct)} />
            <button style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
              onClick={reset}>
              ← Choose a different image
            </button>
          </div>
        )}

        {/* ── scanning ── */}
        {step === 'scanning' && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {processedSrc && (
              <div>
                <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scanning this area:</p>
                <img src={processedSrc} alt="Scan area"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', background: '#fff' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '2rem' }}>🔍</div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>{statusMsg}</p>
              <div style={{ width: '100%', background: 'var(--border)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', borderRadius: 99, transition: 'width 0.3s ease' }} />
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{progress}%</p>
            </div>
          </div>
        )}

        {/* ── results ── */}
        {step === 'results' && parsed && (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {processedSrc && (
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scanned area:</p>
                <img src={processedSrc} alt="Scanned"
                  style={{ width: '100%', maxHeight: 100, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', background: '#fff' }} />
              </div>
            )}
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Review below — edit anything in the form after applying.
            </p>
            <ResultRow label="Amount"   value={parsed.amount ? `₹${parsed.amount}` : '—'} found={parsed._confidence.amount} />
            <ResultRow label="Date"     value={parsed.date || '—'}                          found={parsed._confidence.date} />
            <ResultRow label="Merchant" value={parsed.description || '—'}                  found={parsed._confidence.description} />
            <ResultRow label="Category" value={parsed.category ? `${parsed.category}${parsed.subcategory ? ' › ' + parsed.subcategory : ''}` : '—'} found={parsed._confidence.category} />
            <ResultRow label="Payment"  value={parsed.paymentMethod ? `${parsed.paymentMethod}${parsed.paymentDescription ? ' · ' + parsed.paymentDescription : ''}` : '—'} found={parsed._confidence.paymentMethod} />

            <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', padding: 0 }}
              onClick={() => setShowRaw(v => !v)}>
              {showRaw ? 'Hide raw text ▲' : 'Show raw OCR text ▼'}
            </button>
            {showRaw && (
              <pre style={{ fontSize: '0.72rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.75rem', maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-muted)', margin: 0 }}>
                {rawText || '(no text detected)'}
              </pre>
            )}
            <div className="modal-footer" style={{ padding: '0.75rem 0 0', margin: 0 }}>
              <button className="btn-secondary" onClick={reset}>Re-scan</button>
              <button className="btn-primary" onClick={handleUse}>Apply to Form</button>
            </div>
          </div>
        )}

        {/* ── error ── */}
        {step === 'error' && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ textAlign: 'center', fontSize: '2rem' }}>⚠️</div>
            <p style={{ margin: 0, fontWeight: 600, textAlign: 'center' }}>Scan failed</p>
            {errorDetail ? (
              <pre style={{ fontSize: '0.72rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-muted)', margin: 0 }}>
                {errorDetail}
              </pre>
            ) : (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>Unknown error — try again.</p>
            )}
            <button className="btn-primary" style={{ alignSelf: 'center' }} onClick={reset}>Try Again</button>
          </div>
        )}

      </div>
    </div>
  );
}

function ResultRow({ label, value, found }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 72, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: found ? 500 : 400, color: found ? 'var(--text)' : 'var(--text-muted)', flex: 1 }}>{value}</span>
      <span style={{ fontSize: '0.7rem', color: found ? 'var(--success, #22c55e)' : 'var(--text-muted)', flexShrink: 0 }}>
        {found ? '✓' : '?'}
      </span>
    </div>
  );
}
