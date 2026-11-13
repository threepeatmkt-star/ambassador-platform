-- =====================================================================
-- 광고제품(월별) + 콘텐츠 가이드 + 앰버서더별 배정
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run (여러 번 실행해도 안전)
-- 기존 테이블/데이터(신청, 명단, 제품)는 건드리지 않습니다.
-- =====================================================================

-- 1) 월별 광고 아이템 (= 가이드 1개 단위. 예: "게이너 1kg (맛 2개중 선택)")
CREATE TABLE IF NOT EXISTS ad_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,                                -- 'YYYY-MM'
  title TEXT NOT NULL DEFAULT '',                     -- 📦 줄에 들어가는 제품 표시명
  pick_mode TEXT NOT NULL DEFAULT 'one'
    CHECK (pick_mode IN ('one', 'all')),              -- one: 연결 제품 중 1개 배정 / all: 연결 제품 전부 발송
  links TEXT NOT NULL DEFAULT '',                     -- 제품 링크 (한 줄에 하나)
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,          -- [{"title":"벌크업을 위한 한 잔","body":"..."}]
  notices TEXT NOT NULL DEFAULT '',                   -- 📢 안내 (한 줄에 하나)
  selling_points TEXT NOT NULL DEFAULT '',            -- ✔ 셀링포인트 (한 줄에 하나)
  hashtags TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ad_items_month_idx ON ad_items(month);

-- 2) 광고 아이템에 연결된 실제 제품 (제품 DB에서 선택)
CREATE TABLE IF NOT EXISTS ad_item_products (
  item_id UUID NOT NULL REFERENCES ad_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),   -- 1인당 발송 수량 (예: 닭가슴살 맛별 4개)
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, product_id)
);
ALTER TABLE ad_item_products ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;

-- 3) 앰버서더별 광고제품 배정 (사람마다 다르게, 한 달에 여러 개 가능)
--    명단은 매번 전체 교체되므로 본명(real_name) 기준으로 저장합니다.
--    제품이 DB에서 지워져도 출고 파일이 깨지지 않도록 제품명/전산명을 함께 저장합니다.
CREATE TABLE IF NOT EXISTS ad_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  real_name TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES ad_items(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ad_assignments_month_idx ON ad_assignments(month);
CREATE UNIQUE INDEX IF NOT EXISTS ad_assignments_unique_idx
  ON ad_assignments(item_id, real_name, COALESCE(product_id::text, sku));

-- 4) 권한: 로그인한 관리자만 조회/수정 (앰버서더 신청 페이지는 이 테이블을 쓰지 않음)
ALTER TABLE ad_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_item_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_items_admin_all" ON ad_items;
DROP POLICY IF EXISTS "ad_item_products_admin_all" ON ad_item_products;
DROP POLICY IF EXISTS "ad_assignments_admin_all" ON ad_assignments;
CREATE POLICY "ad_items_admin_all" ON ad_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ad_item_products_admin_all" ON ad_item_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ad_assignments_admin_all" ON ad_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
