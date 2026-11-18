-- 광고제품 / 신제품 구분 (신제품: 출시 시 따로 보내는 시딩, ERP도 별도 주문)
ALTER TABLE ad_items ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'ad';
DO $$ BEGIN
  ALTER TABLE ad_items ADD CONSTRAINT ad_items_kind_check CHECK (kind IN ('ad', 'new'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
