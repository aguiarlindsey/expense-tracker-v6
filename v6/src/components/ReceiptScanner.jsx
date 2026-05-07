import React, { useState, useRef, useCallback, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { parseReceipt } from '../utils/receiptParser.js';

const isMobile = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function ReceiptScanner({ onResult, onClose }) {
  const [step, setStep] = useState('pick');       // pick | preview | scanning | results | error
  const [imgSrc, setImgSrc] = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [parsed, setParsed] = useState(null);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const objUrlRef = useRef(null);

  useEffect(() => {
    return () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); };
  }, []);

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    const url = URL.createObjectURL(file);
    objUrlRef.current = url;
    setImgSrc(url);
    setStep('preview');
  }, []);

  const runOcr = useCallback(async () => {
    if (!imgSrc) return;
    setStep('scanning');
    setProgress(0);
    setStatusMsg('Loading OCR engine…');
    try {
      const { data: { text } } = await Tesseract.recognize(
        imgSrc,
        'eng',
        {
          logger: m => {
            if (m.status === 'loading tesseract core') setStatusMsg('Loading OCR engine…');
            else if (m.status === 'initializing tesseract') setStatusMsg('Initialising…');
            else if (m.status === 'loading language traineddata') setStatusMsg('Loading language data (first time ~10MB)…');
            else if (m.status === 'recognizing text') {
              setStatusMsg('Scanning receipt…');
              setProgress(Math.round((m.progress || 0) * 100));
            }
          },
        }
      );
      setRawText(text);
      const result = parseReceipt(text);
      setParsed(result);
      setStep('results');
    } catch (err) {
      console.error('OCR error:', err);
      setStep('error');
    }
  }, [imgSrc]);

  const handleUse = useCallback(() => {
    if (parsed) onResult(parsed);
    onClose();
  }, [parsed, onResult, onClose]);

  const reset = () => {
    setStep('pick');
    setImgSrc(null);
    setParsed(null);
    setRawText('');
    setShowRaw(false);
    setProgress(0);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>

        {/* Header */}
        <div className="modal-header">
          <h2>Scan Receipt</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── STEP: pick ── */}
        {step === 'pick' && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Point your camera at a receipt or upload a photo. Fields will be pre-filled for you to review.
            </p>

            {isMobile() && (
              <>
                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                  onClick={() => cameraRef.current.click()}
                >
                  📷 Take Photo
                </button>
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => loadFile(e.target.files[0])}
                />
              </>
            )}

            <button
              className="btn-secondary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
              onClick={() => fileRef.current.click()}
            >
              {isMobile() ? '🖼️ Choose from Gallery' : '📁 Upload Receipt Image'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => loadFile(e.target.files[0])}
            />

            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Works best with clear, well-lit photos of printed receipts.
            </p>
          </div>
        )}

        {/* ── STEP: preview ── */}
        {step === 'preview' && imgSrc && (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <img
              src={imgSrc}
              alt="Receipt preview"
              style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }}
            />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Make sure the receipt is fully visible and the text is sharp.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={reset}>Try Another</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={runOcr}>Scan This Receipt</button>
            </div>
          </div>
        )}

        {/* ── STEP: scanning ── */}
        {step === 'scanning' && (
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ fontSize: '2.5rem' }}>🔍</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Scanning…</p>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>{statusMsg}</p>

            {/* Progress bar */}
            <div style={{ width: '100%', background: 'var(--border)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--primary)',
                  borderRadius: 99,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{progress}%</p>
          </div>
        )}

        {/* ── STEP: results ── */}
        {step === 'results' && parsed && (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Review the extracted data — edit anything in the form after applying.
            </p>

            <ResultRow label="Amount" value={parsed.amount ? `₹${parsed.amount}` : '—'} found={parsed._confidence.amount} />
            <ResultRow label="Date" value={parsed.date || '—'} found={parsed._confidence.date} />
            <ResultRow label="Description" value={parsed.description || '—'} found={parsed._confidence.description} />
            <ResultRow label="Category" value={parsed.category ? `${parsed.category}${parsed.subcategory ? ' › ' + parsed.subcategory : ''}` : '—'} found={parsed._confidence.category} />
            <ResultRow label="Payment" value={parsed.paymentMethod ? `${parsed.paymentMethod}${parsed.paymentDescription ? ' · ' + parsed.paymentDescription : ''}` : '—'} found={parsed._confidence.paymentMethod} />

            {/* Raw text toggle */}
            <button
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', padding: 0 }}
              onClick={() => setShowRaw(v => !v)}
            >
              {showRaw ? 'Hide raw text ▲' : 'Show raw OCR text ▼'}
            </button>
            {showRaw && (
              <pre style={{ fontSize: '0.72rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.75rem', maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-muted)' }}>
                {rawText || '(no text detected)'}
              </pre>
            )}

            <div className="modal-footer" style={{ padding: '0.75rem 0 0', margin: 0 }}>
              <button className="btn-secondary" onClick={reset}>Re-scan</button>
              <button className="btn-primary" onClick={handleUse}>Apply to Form</button>
            </div>
          </div>
        )}

        {/* ── STEP: error ── */}
        {step === 'error' && (
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2rem' }}>⚠️</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Scan failed</p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Could not read the image. Try a clearer photo with better lighting.
            </p>
            <button className="btn-primary" onClick={reset}>Try Again</button>
          </div>
        )}

      </div>
    </div>
  );
}

function ResultRow({ label, value, found }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 88, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: found ? 500 : 400, color: found ? 'var(--text)' : 'var(--text-muted)', flex: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: '0.7rem', color: found ? 'var(--success, #22c55e)' : 'var(--text-muted)', flexShrink: 0 }}>
        {found ? '✓' : '?'}
      </span>
    </div>
  );
}
