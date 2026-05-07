import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { parseReceipt } from '../utils/receiptParser.js';

const isMobile = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const MAX_DIM = 1500; // phone photos can be 48MP — resize before OCR or it crashes

function resizeToCanvas(img) {
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas;
}

// Find the rectangular region that looks like a receipt:
// receipt paper = bright pixels (>170 luminance) with some dark text (>1.5% dark pixels per row/col)
function detectReceiptBounds(canvas) {
  const { width, height } = canvas;
  const { data } = canvas.getContext('2d').getImageData(0, 0, width, height);

  const rowBright = new Float32Array(height);
  const rowDark   = new Int32Array(height);
  const colBright = new Float32Array(width);
  const colDark   = new Int32Array(width);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      rowBright[y] += gray;
      colBright[x] += gray;
      if (gray < 100) { rowDark[y]++; colDark[x]++; }
    }
  }

  // Returns [start, end] of the largest contiguous "receipt" band
  const findRange = (len, sumArr, darkArr, span) => {
    const isTarget = Array.from({ length: len }, (_, i) =>
      sumArr[i] / span > 170 && darkArr[i] / span > 0.015
    );
    let bestStart = 0, bestEnd = len - 1, bestLen = 0, curStart = 0;
    for (let i = 0; i <= len; i++) {
      if (i < len && isTarget[i]) continue;
      const bl = i - curStart;
      if (bl > bestLen) { bestLen = bl; bestStart = curStart; bestEnd = i - 1; }
      curStart = i + 1;
    }
    // Only use the crop if we found something meaningful (>15% of dimension)
    return bestLen > len * 0.15 ? [bestStart, bestEnd] : [0, len - 1];
  };

  const [y0, y1] = findRange(height, rowBright, rowDark, width);
  const [x0, x1] = findRange(width, colBright, colDark, height);
  const PAD = 25;
  return {
    x: Math.max(0, x0 - PAD),
    y: Math.max(0, y0 - PAD),
    w: Math.min(width - Math.max(0, x0 - PAD),  x1 - x0 + PAD * 2),
    h: Math.min(height - Math.max(0, y0 - PAD), y1 - y0 + PAD * 2),
  };
}

// Grayscale + auto contrast-stretch — makes receipt text much crisper for Tesseract
function grayscaleContrast(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const grays = new Uint8Array(data.length / 4);
  let min = 255, max = 0;
  for (let p = 0; p < grays.length; p++) {
    const i = p * 4;
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    grays[p] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = max - min || 1;
  for (let p = 0; p < grays.length; p++) {
    const v = Math.round((grays[p] - min) / range * 255);
    const i = p * 4;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

async function preprocessImage(blobUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const resized = resizeToCanvas(img);
        const { x, y, w, h } = detectReceiptBounds(resized);
        const cropped = document.createElement('canvas');
        cropped.width = w;
        cropped.height = h;
        cropped.getContext('2d').drawImage(resized, x, y, w, h, 0, 0, w, h);
        grayscaleContrast(cropped);
        resolve({ canvas: cropped, dataUrl: cropped.toDataURL('image/png') });
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
}

export default function ReceiptScanner({ onResult, onClose }) {
  const [step, setStep]               = useState('pick');
  const [imgSrc, setImgSrc]           = useState(null);
  const [processedSrc, setProcessedSrc] = useState(null);
  const [progress, setProgress]       = useState(0);
  const [statusMsg, setStatusMsg]     = useState('');
  const [parsed, setParsed]           = useState(null);
  const [rawText, setRawText]         = useState('');
  const [showRaw, setShowRaw]         = useState(false);
  const [errorDetail, setErrorDetail] = useState('');

  const fileRef      = useRef(null);
  const cameraRef    = useRef(null);
  const objUrlRef    = useRef(null);
  const processedRef = useRef(null);

  useEffect(() => () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); }, []);

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    const url = URL.createObjectURL(file);
    objUrlRef.current = url;
    setImgSrc(url);
    setProcessedSrc(null);
    setStep('preview');
  }, []);

  const runOcr = useCallback(async () => {
    if (!imgSrc) return;
    setStep('scanning');
    setProgress(0);
    setStatusMsg('Detecting receipt area…');
    try {
      const { canvas, dataUrl } = await preprocessImage(imgSrc);
      processedRef.current = canvas;
      setProcessedSrc(dataUrl);

      setStatusMsg('Loading OCR engine…');
      const worker = await createWorker('eng', 1, {
        // serve worker from our own domain — avoids CDN/CSP issues entirely
        workerPath: '/tesseract-worker.min.js',
        workerBlobURL: false,
        logger: m => {
          if (m.status === 'loading tesseract core')        setStatusMsg('Loading OCR engine…');
          else if (m.status === 'initializing tesseract')   setStatusMsg('Initialising…');
          else if (m.status === 'loading language traineddata') setStatusMsg('Loading language data (first use ~10 MB)…');
          else if (m.status === 'recognizing text') {
            setStatusMsg('Reading text…');
            setProgress(Math.round((m.progress || 0) * 100));
          }
        },
      });

      // PSM 6 = single uniform text block — best for receipts
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
    setParsed(null); setRawText(''); setShowRaw(false); setProgress(0);
    setErrorDetail(''); processedRef.current = null;
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
              Photograph or upload a receipt. The bill area is auto-detected and cropped before scanning.
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
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Tip: fill the frame with the receipt for best results.
            </p>
          </div>
        )}

        {/* ── preview ── */}
        {step === 'preview' && imgSrc && (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <img src={imgSrc} alt="Receipt preview"
              style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Make sure the full receipt text is visible and sharp.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={reset}>Try Another</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={runOcr}>Scan This Receipt</button>
            </div>
          </div>
        )}

        {/* ── scanning ── */}
        {step === 'scanning' && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {processedSrc && (
              <div>
                <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-cropped receipt area:</p>
                <img src={processedSrc} alt="Cropped receipt"
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
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Unknown error — try a clearer photo.
              </p>
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
