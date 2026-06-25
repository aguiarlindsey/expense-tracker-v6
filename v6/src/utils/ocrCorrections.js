import { supabase } from './supabase.js';

const CACHE_KEY = 'et_v6_ocr_corrections';
const FIELDS    = ['description', 'amount', 'category', 'paymentMethod'];

// Load corrections from Supabase, cache in localStorage for offline use
export async function loadCorrections() {
  try {
    const { data, error } = await supabase
      .from('ocr_corrections')
      .select('field, ocr_value, correct_value, merchant_hint')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    localStorage.setItem(CACHE_KEY, JSON.stringify(data || []));
    return data || [];
  } catch {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  }
}

// Save a correction when a user edits an OCR-extracted field before saving
export async function saveCorrection({ field, ocrValue, correctValue, ocrText }) {
  if (!FIELDS.includes(field)) return;
  if (!correctValue || correctValue === ocrValue) return;
  const merchant_hint = (ocrText || '').slice(0, 120);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('ocr_corrections').upsert({
    user_id:       user.id,
    field,
    ocr_value:     ocrValue || null,
    correct_value: correctValue,
    merchant_hint,
  }, { onConflict: 'user_id,field,ocr_value' });
  // Update cache
  const cached = localStorage.getItem(CACHE_KEY);
  const list = cached ? JSON.parse(cached) : [];
  const existing = list.findIndex(c => c.field === field && c.ocr_value === ocrValue);
  const entry = { field, ocr_value: ocrValue || null, correct_value: correctValue, merchant_hint };
  if (existing >= 0) list[existing] = entry; else list.unshift(entry);
  localStorage.setItem(CACHE_KEY, JSON.stringify(list));
}

// Apply saved corrections to a parsed receipt result
// Matches by checking if merchant_hint (first 120 chars of OCR text) is a substring of current text
export function applyCorrections(parsed, ocrText) {
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return parsed;
  const corrections = JSON.parse(cached);
  const textSnippet = (ocrText || '').slice(0, 120).toLowerCase();
  const result = { ...parsed };
  for (const c of corrections) {
    if (!FIELDS.includes(c.field)) continue;
    // Match: either same OCR value extracted, or merchant hint appears in current text
    const hintMatches = c.merchant_hint && textSnippet.includes(c.merchant_hint.toLowerCase().slice(0, 60));
    const valueMatches = c.ocr_value !== null && String(parsed[c.field] || '') === String(c.ocr_value);
    if (hintMatches || valueMatches) {
      result[c.field] = c.correct_value;
    }
  }
  return result;
}
