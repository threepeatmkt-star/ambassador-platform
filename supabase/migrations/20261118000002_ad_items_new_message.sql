-- 신제품 소개 메시지 (가이드 양식 없이: 인사말 + 간단한 소개 + 공식 홈페이지)
ALTER TABLE ad_items ADD COLUMN IF NOT EXISTS greeting TEXT NOT NULL DEFAULT '';
ALTER TABLE ad_items ADD COLUMN IF NOT EXISTS intro TEXT NOT NULL DEFAULT '';
