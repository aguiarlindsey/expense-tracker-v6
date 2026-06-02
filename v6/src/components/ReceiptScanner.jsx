import React, { useState, useRef, useCallback, useEffect } from 'react';
import { parseReceipt } from '../utils/receiptParser.js';

const isMobile = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
const MAX_DIM = 1500;

// ── PDF → image ───────────────────────────────────────────────────────────────
// Lazily import pdfjs so it never crashes the app on load
let _pdfjsLib = null;
async function getPdfjs() {
  if (_pdfjsLib) return _pdfjsLib;
  _pdfjsLib = await import('pdfjs-dist');
  if (!_pdfjsLib.GlobalWorkerOptions.workerSrc) {
    _pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  return _pdfjsLib;
}

async function renderPdfToImages(file) {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const urls = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    urls.push(URL.createObjectURL(blob));
  }
  return urls;
}

// ── Image preprocessing ───────────────────────────────────────────────────────
function resizeToCanvas(img) {
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(img.naturalWidth  * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
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
    const g = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
    grays[p] = g; if (g < min) min = g; if (g > max) max = g;
  }
  const range = max - min || 1;
  for (let p = 0; p < grays.length; p++) {
    const v = Math.round((grays[p] - min) / range * 255);
    const i = p * 4; data[i] = data[i+1] = data[i+2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

async function preprocessImage(blobUrl, cropPct) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const resized = resizeToCanvas(img);
        const { x1=0, y1=0, x2=100, y2=100 } = cropPct || {};
        const cx = Math.round(resized.width  * x1/100);
        const cy = Math.round(resized.height * y1/100);
        const cw = Math.max(1, Math.round(resized.width  * (x2-x1)/100));
        const ch = Math.max(1, Math.round(resized.height * (y2-y1)/100));
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(resized, cx, cy, cw, ch, 0, 0, cw, ch);
        grayscaleContrast(c);
        resolve({ canvas: c, dataUrl: c.toDataURL('image/png') });
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
}

async function runOcrOnCanvas(canvas, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: '/tesseract-worker.min.js',
    workerBlobURL: false,
    logger: m => {
      if (m.status === 'loading language traineddata') onProgress('Loading language data…', null);
      else if (m.status === 'recognizing text')        onProgress(null, m.progress || 0);
    },
  });
  try { await worker.setParameters({ tessedit_pageseg_mode: '6' }); } catch (_) {}
  const { data: { text } } = await worker.recognize(canvas);
  await worker.terminate();
  return text;
}

// ── Crop Tool ─────────────────────────────────────────────────────────────────
function CropTool({ imgSrc, actions }) {
  const imgRef  = useRef(null);
  const [crop, setCrop] = useState({ x1:3, y1:3, x2:97, y2:97 });
  const dragRef = useRef(null);

  const getPos = e => {
    const r = imgRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(100, (cx-r.left)/r.width  * 100)),
      y: Math.max(0, Math.min(100, (cy-r.top) /r.height * 100)),
    };
  };

  const onDown = (e, h) => { e.preventDefault(); e.stopPropagation(); dragRef.current = h; };

  const onMove = useCallback(e => {
    if (!dragRef.current || !imgRef.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const MIN = 10, h = dragRef.current;
    setCrop(p => {
      const n = { ...p };
      if (h==='tl'){n.x1=Math.min(x,p.x2-MIN);n.y1=Math.min(y,p.y2-MIN);}
      if (h==='tr'){n.x2=Math.max(x,p.x1+MIN);n.y1=Math.min(y,p.y2-MIN);}
      if (h==='bl'){n.x1=Math.min(x,p.x2-MIN);n.y2=Math.max(y,p.y1+MIN);}
      if (h==='br'){n.x2=Math.max(x,p.x1+MIN);n.y2=Math.max(y,p.y1+MIN);}
      if (h==='t') n.y1=Math.min(y,p.y2-MIN);
      if (h==='b') n.y2=Math.max(y,p.y1+MIN);
      if (h==='l') n.x1=Math.min(x,p.x2-MIN);
      if (h==='r') n.x2=Math.max(x,p.x1+MIN);
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
  const mkH = (id, hx, hy, cur) => (
    <div key={id} onMouseDown={e=>onDown(e,id)} onTouchStart={e=>onDown(e,id)}
      style={{ position:'absolute', left:`${hx}%`, top:`${hy}%`, width:HS, height:HS,
        marginLeft:-HS/2, marginTop:-HS/2, background:'#fff',
        border:'2.5px solid var(--primary,#863bff)', borderRadius:5,
        cursor:cur, touchAction:'none', zIndex:4, boxShadow:'0 1px 4px rgba(0,0,0,0.5)' }} />
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
      <p style={{ margin:0, fontSize:'0.8rem', color:'var(--text-muted)' }}>
        Drag handles to frame the receipt area.
      </p>
      <div style={{ background:'#111', borderRadius:8, overflow:'hidden', display:'flex', justifyContent:'center', userSelect:'none' }}>
        <div style={{ position:'relative', display:'inline-block', touchAction:'none', lineHeight:0 }}>
          <img ref={imgRef} src={imgSrc} alt="Crop" draggable={false}
            style={{ display:'block', maxWidth:'100%', maxHeight:300, pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:0, left:0, right:0, height:`${y1}%`, background:'rgba(0,0,0,0.55)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:`${y2}%`, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.55)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:`${y1}%`, left:0, width:`${x1}%`, height:`${y2-y1}%`, background:'rgba(0,0,0,0.55)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:`${y1}%`, left:`${x2}%`, right:0, height:`${y2-y1}%`, background:'rgba(0,0,0,0.55)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:`${y1}%`, left:`${x1}%`, width:`${x2-x1}%`, height:`${y2-y1}%`, border:'2px solid rgba(255,255,255,0.9)', boxSizing:'border-box', pointerEvents:'none' }} />
          {mkH('tl',x1,y1,'nw-resize')}{mkH('tr',x2,y1,'ne-resize')}
          {mkH('bl',x1,y2,'sw-resize')}{mkH('br',x2,y2,'se-resize')}
          {mkH('t',(x1+x2)/2,y1,'n-resize')}{mkH('b',(x1+x2)/2,y2,'s-resize')}
          {mkH('l',x1,(y1+y2)/2,'w-resize')}{mkH('r',x2,(y1+y2)/2,'e-resize')}
        </div>
      </div>
      <div style={{ display:'flex', gap:'0.5rem' }}>
        {actions.map((a, i) => (
          <button key={i} className={a.variant || 'btn-secondary'}
            style={{ flex: a.flex || 1 }}
            onClick={() => a.onClick(crop)}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReceiptScanner({ onResult, onClose }) {
  const [step, setStep]                 = useState('pick');
  const [mode, setMode]                 = useState('single');
  const [pages, setPages]               = useState([]);
  const [currentImgSrc, setCurrentImgSrc] = useState(null);
  const [processedSrc, setProcessedSrc] = useState(null);
  const [progress, setProgress]         = useState(0);
  const [statusMsg, setStatusMsg]       = useState('');
  const [parsed, setParsed]             = useState(null);
  const [rawText, setRawText]           = useState('');
  const [showRaw, setShowRaw]           = useState(false);
  const [errorDetail, setErrorDetail]   = useState('');
  const [reminderSet, setReminderSet]   = useState(false);
  const [vehicleSvc, setVehicleSvc]     = useState(null); // editable vehicle fields

  const fileRef   = useRef(null);
  const cameraRef = useRef(null);
  const urlsRef   = useRef([]);

  const revokeAll = () => { urlsRef.current.forEach(u => URL.revokeObjectURL(u)); urlsRef.current = []; };
  useEffect(() => () => revokeAll(), []);

  // Called once OCR text is ready — sets parsed + initialises the editable vehicle fields
  const finishScan = useCallback(combined => {
    setRawText(combined);
    const result = parseReceipt(combined);
    setParsed(result);
    if (result && result.subcategory === 'Vehicle Maintenance') {
      setVehicleSvc({
        vehicleModel:    result.vehicleModel    || '',
        vehicleReg:      result.vehicleReg      || '',
        serviceType:     result.serviceType     || '',
        currentKm:       result.currentKm != null ? String(result.currentKm) : '',
        nextServiceKm:   '',
        nextServiceDate: result.nextServiceDate || '',
        nextServiceType: result.nextServiceType || '',
      });
    } else {
      setVehicleSvc(null);
    }
  }, []);

  const loadFile = useCallback(async file => {
    if (!file) return;
    if (fileRef.current)   fileRef.current.value   = '';
    if (cameraRef.current) cameraRef.current.value = '';

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (isPdf) {
      setStatusMsg('Reading PDF…');
      setStep('preparing');
      try {
        const imageUrls = await renderPdfToImages(file);
        if (imageUrls.length === 0) {
          setErrorDetail('PDF appears to be empty or could not be rendered.');
          setStep('error');
          return;
        }
        imageUrls.forEach(u => urlsRef.current.push(u));
        if (imageUrls.length === 1) {
          setCurrentImgSrc(imageUrls[0]);
          setStatusMsg('');
          setStep('crop');
        } else {
          // Multi-page PDF: add all pages as parts (full-page crop) ready to scan
          const allPages = imageUrls.map(url => ({ url, crop: { x1:0, y1:0, x2:100, y2:100 } }));
          setPages(prev => [...prev, ...allPages]);
          setMode('multi');
          setStatusMsg('');
          setStep('pick');
        }
      } catch (err) {
        setErrorDetail('Could not read PDF: ' + (err?.message || String(err)));
        setStep('error');
      }
    } else if (isImage) {
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      setCurrentImgSrc(url);
      setStep('crop');
    } else {
      const ext = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : 'unknown';
      setErrorDetail(`".${ext}" files are not supported. Please upload a PDF or image (JPEG, PNG, WEBP, etc.).`);
      setStep('error');
    }
  }, []);

  const saveAndContinue = useCallback(crop => {
    setPages(prev => [...prev, { url: currentImgSrc, crop }]);
    setCurrentImgSrc(null);
    setStep('pick');
  }, [currentImgSrc]);

  const saveAndScan = useCallback(async crop => {
    const allPages = [...pages, { url: currentImgSrc, crop }];
    setPages(allPages);
    setCurrentImgSrc(null);
    setStep('scanning');
    setProgress(0);
    const n = allPages.length;

    try {
      const texts = [];
      for (let i = 0; i < n; i++) {
        const { url, crop: c } = allPages[i];
        setStatusMsg(`Preparing part ${i+1}${n>1?` of ${n}`:''}…`);
        const { canvas, dataUrl } = await preprocessImage(url, c);
        if (i === 0) setProcessedSrc(dataUrl);

        const base = i / n;
        const text = await runOcrOnCanvas(canvas, (msg, prog) => {
          if (msg)  setStatusMsg(msg);
          if (prog != null) {
            setStatusMsg(`Scanning part ${i+1}${n>1?` of ${n}`:''}…`);
            setProgress(Math.round((base + prog / n) * 100));
          }
        });
        texts.push(text);
        setProgress(Math.round(((i+1) / n) * 100));
      }

      const combined = texts.join('\n');
      finishScan(combined);
      setStep('results');
    } catch (err) {
      console.error('OCR error:', err);
      setErrorDetail(err?.message || String(err) || 'Unknown error');
      setStep('error');
    }
  }, [pages, currentImgSrc]);

  const handleUse = useCallback(() => {
    if (!parsed) return;
    const result = vehicleSvc
      ? {
          ...parsed,
          vehicleModel:    vehicleSvc.vehicleModel,
          vehicleReg:      vehicleSvc.vehicleReg,
          serviceType:     vehicleSvc.serviceType,
          currentKm:       vehicleSvc.currentKm ? parseInt(vehicleSvc.currentKm, 10) || null : null,
          nextServiceKm:   vehicleSvc.nextServiceKm ? parseInt(vehicleSvc.nextServiceKm, 10) || null : null,
          nextServiceDate: vehicleSvc.nextServiceDate,
          nextServiceType: vehicleSvc.nextServiceType,
        }
      : parsed;
    onResult({ ...result, _receiptImageB64: processedSrc || null });
    onClose();
  }, [parsed, vehicleSvc, processedSrc, onResult, onClose]);

  const reset = () => {
    revokeAll();
    setStep('pick'); setMode('single'); setPages([]); setCurrentImgSrc(null);
    setProcessedSrc(null); setParsed(null); setRawText('');
    setShowRaw(false); setProgress(0); setErrorDetail(''); setStatusMsg('');
    setVehicleSvc(null); setReminderSet(false);
  };

  const removePage = idx => {
    setPages(prev => {
      URL.revokeObjectURL(prev[idx].url);
      urlsRef.current = urlsRef.current.filter(u => u !== prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Scan already-collected pages without adding another
  const scanCollected = useCallback(() => {
    const pg = [...pages];
    setPages([]);
    setStep('scanning');
    setProgress(0);
    const n = pg.length;
    (async () => {
      try {
        const texts = [];
        for (let i = 0; i < n; i++) {
          const { url, crop } = pg[i];
          setStatusMsg(`Preparing part ${i+1} of ${n}…`);
          const { canvas, dataUrl } = await preprocessImage(url, crop);
          if (i === 0) setProcessedSrc(dataUrl);
          const base = i / n;
          const text = await runOcrOnCanvas(canvas, (msg, prog) => {
            if (msg) setStatusMsg(msg);
            if (prog != null) {
              setStatusMsg(`Scanning part ${i+1} of ${n}…`);
              setProgress(Math.round((base + prog/n) * 100));
            }
          });
          texts.push(text);
          setProgress(Math.round(((i+1)/n)*100));
        }
        const combined = texts.join('\n');
        finishScan(combined);
        setStep('results');
      } catch (err) {
        setErrorDetail(err?.message || String(err));
        setStep('error');
      }
    })();
  }, [pages]);

  const partLabel = n => `part${n !== 1 ? 's' : ''}`;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>Scan Receipt</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── PREPARING (PDF render) ── */}
        {step === 'preparing' && (
          <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem' }}>
            <div style={{ fontSize:'2rem' }}>📄</div>
            <p style={{ margin:0, fontSize:'0.85rem', color:'var(--text-muted)', textAlign:'center' }}>{statusMsg || 'Reading file…'}</p>
          </div>
        )}

        {/* ── PICK ── */}
        {step === 'pick' && (
          <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

            {pages.length === 0 && (
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button className={mode==='single'?'btn-primary':'btn-secondary'} style={{ flex:1 }}
                  onClick={() => setMode('single')}>1 Photo</button>
                <button className={mode==='multi'?'btn-primary':'btn-secondary'} style={{ flex:1 }}
                  onClick={() => setMode('multi')}>
                  Multi-Part<br/><span style={{ fontSize:'0.7rem', fontWeight:400 }}>Long receipt</span>
                </button>
              </div>
            )}

            {pages.length > 0 && (
              <div>
                <p style={{ margin:'0 0 6px', fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:600 }}>
                  {pages.length} {partLabel(pages.length)} captured — add part {pages.length+1}:
                </p>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  {pages.map((p, i) => (
                    <div key={i} style={{ position:'relative', display:'inline-block' }}>
                      <img src={p.url} alt={`Part ${i+1}`}
                        style={{ width:52, height:70, objectFit:'cover', borderRadius:5, border:'1px solid var(--border)' }} />
                      <span style={{ position:'absolute', top:2, left:2, background:'var(--primary)', color:'#fff', fontSize:'0.6rem', borderRadius:3, padding:'1px 4px', fontWeight:700 }}>
                        {i+1}
                      </span>
                      <button onClick={() => removePage(i)}
                        style={{ position:'absolute', top:2, right:2, background:'rgba(0,0,0,0.55)', border:'none', color:'#fff', borderRadius:'50%', width:16, height:16, cursor:'pointer', fontSize:'0.6rem', lineHeight:'16px', padding:0, textAlign:'center' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ margin:0, fontSize:'0.82rem', color:'var(--text-muted)' }}>
              {pages.length === 0 && mode === 'single'
                ? 'Upload a receipt — PDF, JPEG, PNG or any image. You can crop before scanning.'
                : pages.length === 0
                  ? 'Photograph the top section of the receipt first.'
                  : `Start slightly above where part ${pages.length} ended to avoid missing any lines.`}
            </p>

            {isMobile() && (
              <>
                <button className="btn-primary" style={{ width:'100%', padding:'0.75rem' }}
                  onClick={() => cameraRef.current.click()}>
                  📷 {pages.length > 0 ? `Take Photo of Part ${pages.length+1}` : mode==='multi' ? 'Take Photo of Part 1' : 'Take Photo'}
                </button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                  style={{ display:'none' }} onChange={e => loadFile(e.target.files[0])} />
              </>
            )}

            <button className="btn-secondary" style={{ width:'100%', padding:'0.75rem' }}
              onClick={() => fileRef.current.click()}>
              {isMobile()
                ? (pages.length > 0 ? `🖼️ Choose Part ${pages.length+1} from Gallery` : '🖼️ Choose from Gallery')
                : (pages.length > 0 ? `📁 Upload Part ${pages.length+1}` : '📁 Upload Receipt (PDF / Image)')}
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf"
              style={{ display:'none' }} onChange={e => loadFile(e.target.files[0])} />

            {pages.length > 0 && (
              <button className="btn-primary" style={{ width:'100%' }} onClick={scanCollected}>
                Scan {pages.length} Collected {pages.length === 1 ? 'Part' : 'Parts'} Now
              </button>
            )}

            {pages.length > 0 && (
              <button style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'0.8rem' }}
                onClick={reset}>✕ Start over</button>
            )}
          </div>
        )}

        {/* ── CROP ── */}
        {step === 'crop' && currentImgSrc && (
          <div style={{ padding:'1.25rem' }}>
            {mode === 'multi' && (
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'0.5rem 0.75rem', marginBottom:'0.75rem', fontSize:'0.8rem', color:'var(--text-muted)' }}>
                Part {pages.length + 1}
                {pages.length > 0 ? ` — ${pages.length} ${partLabel(pages.length)} already captured` : ' — frame the receipt area'}
              </div>
            )}
            <CropTool
              imgSrc={currentImgSrc}
              actions={mode === 'single' ? [
                { label:'Scan Full Image',    variant:'btn-secondary', flex:1,
                  onClick: () => saveAndScan({ x1:0, y1:0, x2:100, y2:100 }) },
                { label:'Scan Selected Area', variant:'btn-primary',   flex:2,
                  onClick: crop => saveAndScan(crop) },
              ] : [
                { label:'Full Image',         variant:'btn-secondary', flex:1,
                  onClick: () => saveAndContinue({ x1:0, y1:0, x2:100, y2:100 }) },
                { label:'Add Another Part →', variant:'btn-secondary', flex:2,
                  onClick: crop => saveAndContinue(crop) },
                { label:`Scan ${pages.length+1} ${pages.length===0?'Part':'Parts'}`, variant:'btn-primary', flex:2,
                  onClick: crop => saveAndScan(crop) },
              ]}
            />
            <button style={{ marginTop:'0.75rem', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'0.8rem' }}
              onClick={() => { setCurrentImgSrc(null); setStep('pick'); }}>
              ← Discard and go back
            </button>
          </div>
        )}

        {/* ── SCANNING ── */}
        {step === 'scanning' && (
          <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
            {processedSrc && (
              <div>
                <p style={{ margin:'0 0 6px', fontSize:'0.75rem', color:'var(--text-muted)' }}>Processing…</p>
                <img src={processedSrc} alt="Scan"
                  style={{ width:'100%', maxHeight:160, objectFit:'contain', borderRadius:6, border:'1px solid var(--border)', background:'#fff' }} />
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem' }}>
              <div style={{ fontSize:'2rem' }}>🔍</div>
              <p style={{ margin:0, fontSize:'0.82rem', color:'var(--text-muted)', textAlign:'center' }}>{statusMsg}</p>
              <div style={{ width:'100%', background:'var(--border)', borderRadius:99, height:8, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${progress}%`, background:'var(--primary)', borderRadius:99, transition:'width 0.3s ease' }} />
              </div>
              <p style={{ margin:0, fontSize:'0.8rem', color:'var(--text-muted)' }}>{progress}%</p>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {step === 'results' && parsed && (
          <div style={{ padding:'1.25rem', display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            {processedSrc && (
              <div>
                <p style={{ margin:'0 0 4px', fontSize:'0.72rem', color:'var(--text-muted)' }}>Scanned area (part 1 shown):</p>
                <img src={processedSrc} alt="Scanned"
                  style={{ width:'100%', maxHeight:80, objectFit:'contain', borderRadius:6, border:'1px solid var(--border)', background:'#fff' }} />
              </div>
            )}
            <p style={{ margin:0, fontSize:'0.85rem', color:'var(--text-muted)' }}>Review below — edit anything after applying.</p>
            <ResultRow label="Amount"   value={parsed.amount?`₹${parsed.amount}`:'—'}                 found={parsed._confidence.amount} />
            <ResultRow label="Date"     value={parsed.date?(() => { const [y,m,d]=parsed.date.split('-'); return `${d}-${m}-${y}`; })():'—'} found={parsed._confidence.date} />
            <ResultRow label="Merchant" value={parsed.description||'—'}                               found={parsed._confidence.description} />
            <ResultRow label="Category" value={parsed.category?`${parsed.category}${parsed.subcategory?' › '+parsed.subcategory:''}`:'—'} found={parsed._confidence.category} />
            <ResultRow label="Payment"  value={parsed.paymentMethod?`${parsed.paymentMethod}${parsed.paymentDescription?' · '+parsed.paymentDescription:''}`:'—'} found={parsed._confidence.paymentMethod} />

            {/* ── Vehicle service — editable details ── */}
            {vehicleSvc && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:'0.75rem', display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)' }}>
                  Vehicle Service — edit any field before applying
                </div>

                {/* Row helper */}
                {[
                  { label:'Model',       key:'vehicleModel',    placeholder:'e.g. TVS Ntorq 150' },
                  { label:'Reg No.',     key:'vehicleReg',      placeholder:'e.g. MH02GU 1566' },
                  { label:'Service',     key:'serviceType',     placeholder:'e.g. 1st Free Service' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', minWidth:68, fontWeight:600, flexShrink:0 }}>{label}</span>
                    <input
                      value={vehicleSvc[key]}
                      onChange={e => setVehicleSvc(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ flex:1, fontSize:'0.82rem', padding:'0.3rem 0.5rem', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)' }}
                    />
                  </div>
                ))}

                {/* KM row — two fields side by side */}
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', minWidth:68, fontWeight:600, flexShrink:0 }}>KMs now</span>
                  <input
                    type="number" min="0"
                    value={vehicleSvc.currentKm}
                    onChange={e => setVehicleSvc(p => ({ ...p, currentKm: e.target.value }))}
                    placeholder="e.g. 145"
                    style={{ flex:1, fontSize:'0.82rem', padding:'0.3rem 0.5rem', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)' }}
                  />
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', minWidth:68, fontWeight:600, flexShrink:0 }}>Next svc km</span>
                  <input
                    type="number" min="0"
                    value={vehicleSvc.nextServiceKm}
                    onChange={e => setVehicleSvc(p => ({ ...p, nextServiceKm: e.target.value }))}
                    placeholder="e.g. 3000"
                    style={{ flex:1, fontSize:'0.82rem', padding:'0.3rem 0.5rem', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)' }}
                  />
                </div>

                {/* Next service box */}
                <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'0.6rem 0.75rem', display:'flex', flexDirection:'column', gap:'0.45rem' }}>
                  <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)' }}>Next Service Due</div>
                  <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                    <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', minWidth:40, fontWeight:600, flexShrink:0 }}>Date</span>
                    <input
                      type="date"
                      value={vehicleSvc.nextServiceDate}
                      onChange={e => { setVehicleSvc(p => ({ ...p, nextServiceDate: e.target.value })); setReminderSet(false); }}
                      style={{ flex:1, fontSize:'0.82rem', padding:'0.3rem 0.5rem', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)' }}
                    />
                  </div>
                  <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                    <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', minWidth:40, fontWeight:600, flexShrink:0 }}>Type</span>
                    <input
                      value={vehicleSvc.nextServiceType}
                      onChange={e => setVehicleSvc(p => ({ ...p, nextServiceType: e.target.value }))}
                      placeholder="e.g. 2nd Free Service"
                      style={{ flex:1, fontSize:'0.82rem', padding:'0.3rem 0.5rem', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)' }}
                    />
                  </div>
                  {vehicleSvc.nextServiceDate && (
                    <button
                      onClick={() => {
                        try {
                          const existing = JSON.parse(localStorage.getItem('et_svc_reminders') || '[]');
                          const key = vehicleSvc.vehicleReg || vehicleSvc.nextServiceDate;
                          const filtered = existing.filter(r => r.key !== key);
                          filtered.push({
                            key,
                            date: vehicleSvc.nextServiceDate,
                            label: `${vehicleSvc.vehicleModel || 'Vehicle'} service${vehicleSvc.nextServiceType ? ' — ' + vehicleSvc.nextServiceType : ''}`,
                            reg: vehicleSvc.vehicleReg || '',
                          });
                          localStorage.setItem('et_svc_reminders', JSON.stringify(filtered));
                          setReminderSet(true);
                        } catch (_) {}
                      }}
                      style={{ alignSelf:'flex-start', background: reminderSet ? 'var(--success,#22c55e)' : 'var(--primary)', color:'#fff', border:'none', borderRadius:6, padding:'0.35rem 0.85rem', cursor:'pointer', fontSize:'0.8rem', fontWeight:600 }}>
                      {reminderSet ? '✓ Reminder saved' : '🔔 Set Reminder'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {parsed.fuelRate && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:'0.6rem' }}>
                <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', marginBottom:'0.4rem' }}>Fuel details ✓</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
                  <Chip>⛽ ₹{parsed.fuelRate}/L</Chip>
                  {parsed.fuelQuantity && <Chip>{parsed.fuelQuantity} L</Chip>}
                  {parsed.fuelType    && <Chip>{parsed.fuelType}</Chip>}
                </div>
              </div>
            )}
            {parsed.taxAmount > 0 && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:'0.6rem' }}>
                <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', marginBottom:'0.4rem' }}>Taxes — Total ₹{parsed.taxAmount.toFixed(2)} ✓</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
                  {Object.entries(parsed.taxBreakdown).map(([k,v]) => (
                    <Chip key={k}>{k==='serviceCharge'?'Svc Charge':k.toUpperCase()} ₹{v.toFixed(2)}</Chip>
                  ))}
                </div>
              </div>
            )}
            <button style={{ background:'none', border:'none', color:'var(--primary)', cursor:'pointer', fontSize:'0.8rem', textAlign:'left', padding:0 }}
              onClick={() => setShowRaw(v => !v)}>
              {showRaw ? 'Hide raw text ▲' : 'Show raw OCR text ▼'}
            </button>
            {showRaw && (
              <pre style={{ fontSize:'0.72rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'0.75rem', maxHeight:160, overflowY:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word', color:'var(--text-muted)', margin:0 }}>
                {rawText || '(no text detected)'}
              </pre>
            )}
            <div className="modal-footer" style={{ padding:'0.75rem 0 0', margin:0 }}>
              <button className="btn-secondary" onClick={reset}>Re-scan</button>
              <button className="btn-primary"   onClick={handleUse}>Apply to Form</button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === 'error' && (
          <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div style={{ textAlign:'center', fontSize:'2rem' }}>⚠️</div>
            <p style={{ margin:0, fontWeight:600, textAlign:'center' }}>Scan failed</p>
            {errorDetail
              ? <pre style={{ fontSize:'0.72rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'0.75rem', overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-all', color:'var(--text-muted)', margin:0 }}>{errorDetail}</pre>
              : <p style={{ margin:0, fontSize:'0.85rem', color:'var(--text-muted)', textAlign:'center' }}>Try a clearer photo.</p>
            }
            <button className="btn-primary" style={{ alignSelf:'center' }} onClick={reset}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span style={{ fontSize:'0.75rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 7px' }}>
      {children}
    </span>
  );
}

function ResultRow({ label, value, found }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:'0.5rem' }}>
      <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', minWidth:72, fontWeight:600 }}>{label}</span>
      <span style={{ fontSize:'0.9rem', fontWeight:found?500:400, color:found?'var(--text)':'var(--text-muted)', flex:1 }}>{value}</span>
      <span style={{ fontSize:'0.7rem', color:found?'var(--success,#22c55e)':'var(--text-muted)', flexShrink:0 }}>{found?'✓':'?'}</span>
    </div>
  );
}
