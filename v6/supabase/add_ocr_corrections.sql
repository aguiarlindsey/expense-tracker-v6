-- OCR correction learning: stores user-corrected fields so future scans
-- from the same merchant auto-apply the correction
CREATE TABLE IF NOT EXISTS ocr_corrections (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users NOT NULL,
  field         text        NOT NULL,        -- 'description' | 'amount' | 'category' | 'paymentMethod'
  ocr_value     text,                        -- what the scanner extracted
  correct_value text        NOT NULL,        -- what the user corrected it to
  merchant_hint text,                        -- first 120 chars of OCR text (fingerprint for matching)
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE ocr_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own corrections" ON ocr_corrections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ocr_corrections_user_field ON ocr_corrections (user_id, field);
