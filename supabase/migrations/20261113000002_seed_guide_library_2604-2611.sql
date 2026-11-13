-- 삼대오백 광고제품 가이드 보관함 (2026년 4월 ~ 11월, 16개)
-- 공유 폴더 '가이드 - 삼대오백' 원문을 최신 양식(2611 크레아틴 가이드 기준)으로 변환해 등록합니다.
-- 20261113000001_ad_products.sql 실행 후 Run. 여러 번 실행해도 중복 생성되지 않습니다.
-- 관리자 > 광고제품 · 가이드 > 편집창의 [지난 가이드 보관함에서 불러오기]에서 골라 쓸 수 있습니다.

-- 2026-04 · 삼대오백 WPI 웨이 프로틴 (인플루언서 협업)
--   ⚠ 인플루언서 협업 가이드(앰버서더용 아님) · 특정 맛 없음 → 제품 미연결, 링크 없음
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-04', $g$삼대오백 WPI 웨이 프로틴 (인플루언서 협업)$g$, 'one', $g$$g$, $g$[{"title":"디저트 대신 먹는 맛있는 단백질","body":"고열량 간식이 땡길 때 프로틴을 한 스쿱 타 마시는 모습 등"},{"title":"빠르게 보충하는 운동 후 단백질","body":"강도 높은 운동 후 프로틴을 마시는 모습 등"},{"title":"번거롭지 않은 식단관리","body":"어지러운 냉장고 내부/식단용 식사를 만드는 모습 다음 장면에\n프로틴을 바로 만들어 마시는 모습 등"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 공동작업자$g$, $g$✔ 달콤하고 맛있는 맛으로 어렵지 않은 단백질 보충&식단관리
✔ 한 스쿱 당 단백질 20~22g함유로 든든한 단백질 함량
✔ 어디서나 물과 함께 바로 손쉽게 흔들어 마시는 단백질$g$, $g$#협찬 #삼대오백 #단백질쉐이크 #WPI #프로틴$g$, 0
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-04' AND title = $g$삼대오백 WPI 웨이 프로틴 (인플루언서 협업)$g$)
  RETURNING id
)
SELECT id FROM ins;

-- 2026-04 · WPI 웨이 프로틴 딸기라떼맛
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-04', $g$WPI 웨이 프로틴 딸기라떼맛$g$, 'all', $g$https://samdae500.com/surl/p/1215$g$, $g$[{"title":"나의 여름바디 대비 식단템","body":"저녁식사 대신 '딸기라떼맛 WPI'를 타먹는 장면"},{"title":"나의 하루 루틴","body":"하루 루틴 중, '딸기라떼맛 WPI'를 챙겨먹는 장면"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ 봄 시즌 한정으로 출시된 리미티드 에디션
✔ 영국산 프리미엄 분리유청 단백질 사용
✔ 1스쿱 당 20g 단백질 함유$g$, $g$#협찬 #삼대오백 #삼대오백프로틴 #삼대오백WPI #WPI딸기라떼$g$, 1
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-04' AND title = $g$WPI 웨이 프로틴 딸기라떼맛$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백WPI포대1kg딸기라떼$g$, 1, 0)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-04 · 크레아퓨어 크레아틴 츄어블 레몬맛(90정) + 캡슐박스
--   ⚠ 캡슐박스는 제품 DB에 없어 연결 안 함 · 원본에 제품 링크 없음
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-04', $g$크레아퓨어 크레아틴 츄어블 레몬맛(90정) + 캡슐박스$g$, 'all', $g$$g$, $g$[{"title":"나의 데일리 헬시템 3가지","body":"1개 크레아틴 츄어블(메인), 그 외 2개는 자유소개 (보충제/영양제 등)"},{"title":"나의 하루 루틴","body":"하루 루틴 중, '크레아틴 츄어블' 챙겨먹는 장면"},{"title":"내가 크레아틴 츄어블을 먹는 이유","body":"부모님 및 친구에게 선물한다, 건강을 위해 챙겨먹기 좋다 등 개인의 추천이유"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ 건강을 챙기는 누구나, 맛있게 씹어서 먹는 크레아틴
✔ 분리형 캡슐박스로 간편하게 보관 및 휴대 가능 (1칸에 최대 6정⭕)
✔ 물 없이 씹어서 간편하게 먹는 츄어블 타입 크레아틴
✔ 레몬맛으로 거부감 없이 맛있게 섭취 가능
✔ 건강에 관심있는 운동 초급자 & 일반인에게도 딱
✔ 1회 3정씩(총 90정/한 달 분), 크레아틴 모노하이드레이트 3,000mg
✔ 독일산 크레아퓨어 원료 사용$g$, $g$#협찬 #삼대오백 #삼대오백크레아틴 #삼대오백크레아틴츄어블 #크레아틴츄어블$g$, 2
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-04' AND title = $g$크레아퓨어 크레아틴 츄어블 레몬맛(90정) + 캡슐박스$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백크레아퓨어크레아틴츄어블90정레몬$g$, 1, 0)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-05 · [신제품] 삼대오백 WPI 클리어 웨이 프로틴 - 레몬에이드🍋 & 에센셜 프리미엄 트라이탄 쉐이커 600ml(투명)
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-05', $g$[신제품] 삼대오백 WPI 클리어 웨이 프로틴 - 레몬에이드🍋 & 에센셜 프리미엄 트라이탄 쉐이커 600ml(투명)$g$, 'all', $g$https://samdae500.com/surl/p/1455
https://samdae500.com/surl/p/1417$g$, $g$[{"title":"데일리 루틴 속 '클리어 웨이 프로틴'","body":"운동 뿐 아니라 일상 속에서 가볍게 마시는 단백질\n커피 대신 / 운동 후 / 출근 전 등 자연스럽게\n트라이탄쉐이커에 제조+섭취하는 장면 포함"},{"title":"여름 대비 깔끔+청량한 신상 프로틴","body":"기존 프로틴의 텁텁함 → 클리어 프로틴 비교\n물에 타는 장면 + 맑은 색감 강조\n트라이탄쉐이커에 제조+섭취하는 장면 포함"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ WPI 100% 고순도 단백질 (식물성 혼합❌) + 단백질 20g
✔ 텁텁함 없이 음료처럼, 물에 타서 가볍게&청량하게
✔ 레몬에이드 / 복숭아홍차 2가지 맛으로 누구나 취향저격
✔ 영국산 프리미엄 원료로 높은 퀄리티
✔ 피부 컨디션 신경 쓰는 요즘, 깔끔한 단백질로 선택
✔ 더부룩함 없이 속 편하게, 데일리 루틴으로 딱$g$, $g$#협찬 #삼대오백 #클리어웨이 #WPI #프로틴$g$, 0
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-05' AND title = $g$[신제품] 삼대오백 WPI 클리어 웨이 프로틴 - 레몬에이드🍋 & 에센셜 프리미엄 트라이탄 쉐이커 600ml(투명)$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백WPI클리어포대500g레몬에이드$g$, 1, 0), ($g$삼대오백트라이탄쉐이커600ml-투명$g$, 1, 1)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-05 · [신제품] 삼대오백 WPI 클리어 웨이 프로틴 - 복숭아홍차🍑 & 에센셜 프리미엄 트라이탄 쉐이커 600ml(투명)
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-05', $g$[신제품] 삼대오백 WPI 클리어 웨이 프로틴 - 복숭아홍차🍑 & 에센셜 프리미엄 트라이탄 쉐이커 600ml(투명)$g$, 'all', $g$https://samdae500.com/surl/p/1455
https://samdae500.com/surl/p/1417$g$, $g$[{"title":"데일리 루틴 속 '클리어 웨이 프로틴'","body":"운동 뿐 아니라 일상 속에서 가볍게 마시는 단백질\n커피 대신 / 운동 후 / 출근 전 등 자연스럽게\n트라이탄쉐이커에 제조+섭취하는 장면 포함"},{"title":"여름 대비 깔끔+청량한 신상 프로틴","body":"기존 프로틴의 텁텁함 → 클리어 프로틴 비교\n물에 타는 장면 + 맑은 색감 강조\n트라이탄쉐이커에 제조+섭취하는 장면 포함"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ WPI 100% 고순도 단백질 (식물성 혼합❌) + 단백질 20g
✔ 텁텁함 없이 음료처럼, 물에 타서 가볍게&청량하게
✔ 레몬에이드 / 복숭아홍차 2가지 맛으로 누구나 취향저격
✔ 영국산 프리미엄 원료로 높은 퀄리티
✔ 피부 컨디션 신경 쓰는 요즘, 깔끔한 단백질로 선택
✔ 더부룩함 없이 속 편하게, 데일리 루틴으로 딱$g$, $g$#협찬 #삼대오백 #클리어웨이 #WPI #프로틴$g$, 1
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-05' AND title = $g$[신제품] 삼대오백 WPI 클리어 웨이 프로틴 - 복숭아홍차🍑 & 에센셜 프리미엄 트라이탄 쉐이커 600ml(투명)$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백WPI클리어포대500g복숭아홍차$g$, 1, 0), ($g$삼대오백트라이탄쉐이커600ml-투명$g$, 1, 1)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-06 · [신제품] 저당 그래놀라 청크 2종 (오리지널/카카오)
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-06', $g$[신제품] 저당 그래놀라 청크 2종 (오리지널/카카오)$g$, 'all', $g$https://samdae500.com/surl/p/1472$g$, $g$[{"title":"데일리 루틴 속 '그래놀라 청크'","body":"운동하는 사람들의 간식 (출근 전, 업무 중, 운동 전 후, 야식 등 일상 속 섭취)\n그래놀라를 요거트, 우유 등에 제조+섭취하는 장면 포함"},{"title":"바삭한 식감","body":"첫 입 리액션 (ASMR)\n맛 표현 및 리얼 후기\n일반 과자와 성분/원료 등 비교하면서 계속 손이 가는 이유 소개"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ [고단백] 단백질 최대 27g (오리지널 27g / 카카오 25g)
✔ [저당] 설탕 대신 알룰로스로 (당 3g)
✔ [고식이섬유] 13g
✔ [밀가루 Free] 오트와 견과류로 든든하게
✔ [간식&식사대용] 바삭한 식감과 고소한 맛$g$, $g$#협찬 #삼대오백 #그래놀라 #그래놀라청크 #단백질간식$g$, 0
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-06' AND title = $g$[신제품] 저당 그래놀라 청크 2종 (오리지널/카카오)$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백그래놀라청크200g팩-오리지널$g$, 1, 0), ($g$삼대오백그래놀라청크200g팩-카카오$g$, 1, 1)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-07 · [신제품] 바이퍼 에너지드링크 - 버닝옐로우&펌프레드 (맛별 12캔씩, 총 24캔 제공 예정)
--   ⚠ 가이드는 맛별 12캔, 제품 DB는 24캔 트레이 → 수량 확인 필요
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-07', $g$[신제품] 바이퍼 에너지드링크 - 버닝옐로우&펌프레드 (맛별 12캔씩, 총 24캔 제공 예정)$g$, 'all', $g$https://samdae500.com/surl/p/1491
https://samdae500.com/surl/p/1490$g$, $g$[{"title":"상황에 맞게 즐기는 '바이퍼'","body":"2종의 각 섭취 목적 및 상황 비교\n(옐로우는 칼로리 소모·다이어트 / 레드는 운동전 부스터·무카페인으로 저녁 섭취 가능)\n운동 전·중·후, 자기관리 루틴 등 일상 속 자연스러운 음용 장면 포함"},{"title":"시원하게 그리고 건강하게 섭취할 수 있는 제로슈가 에너지 드링크","body":"캔 오픈 및 첫 입 리액션 (ASMR)\n맛 표현 및 리얼 후기\n일반 에너지 드링크와 성분/원료 등 비교 소개"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ [제로슈가] 당 부담 없이 섭취
✔ [버닝옐로우] 자기관리, 러닝, 액티브한 일상에 어울리는 컨셉 (녹차추출분말, 바나바잎추출분말, 카페인, 타우린 함유)
✔ [펌프레드] 무카페인으로 카페인에 민감한 분들 부담없이 즐기는 부스터 컨셉 (글리세롤, 아르기닌, 비트착즙액, 타우린 함유)
✔ [상큼&청량감] 버닝옐로우는 파인애플+자몽 맛 & 펌프레드는 베리 맛$g$, $g$#협찬 #삼대오백 #바이퍼 #에너지드링크 #에너지음료$g$, 0
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-07' AND title = $g$[신제품] 바이퍼 에너지드링크 - 버닝옐로우&펌프레드 (맛별 12캔씩, 총 24캔 제공 예정)$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백바이퍼버닝옐로우트레이(24C)$g$, 1, 0), ($g$삼대오백바이퍼펌프레드트레이(24C)$g$, 1, 1)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-08 · [신제품] 실온 닭가슴살 5종 (맛 별 4개씩 총 20개)
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-08', $g$[신제품] 실온 닭가슴살 5종 (맛 별 4개씩 총 20개)$g$, 'all', $g$https://samdae500.com/surl/p/1412$g$, $g$[{"title":"닭가슴살도 이제 맛으로 골라 먹자! 5가지 맛 솔직 + 긍적적 비교","body":"“내 최애 맛은?”처럼 크리에이터의 솔직한 순위 또는 개인적인 맛 평가 포함\n5가지 맛을 한 번에 비교하는 콘텐츠로 구성 가능"},{"title":"냉동실 자리 없는 사람들을 위한 닭가슴살","body":"실온보관으로 언제 어디서나 간편하게 섭취(운동 전후, 회사, 여행 등 일상 속)\n냉동·해동 걱정 없이 편리하게 즐기는 모습 표현"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ [5가지 다양한 맛] 데리야끼, 블랙페퍼, 칠리, 시장떡볶이, 소이갈릭 취향에 맞게 질리지 않게 섭취
✔ [간편한 섭취] 별도의 해동이나 복잡한 조리 없이 언제 어디서나 간편하게 섭취
✔ [촉촉한 식감] 기존의 냉동 닭가슴살과는 다르게 퍽퍽하지 않고 촉촉한 식감
✔ [실온보관] 냉동실 공간 차지하지 않고 쟁여놓고 섭취$g$, $g$#협찬 #삼대오백 #실온닭가슴살 #닭가슴살 #닭가슴살추천$g$, 0
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-08' AND title = $g$[신제품] 실온 닭가슴살 5종 (맛 별 4개씩 총 20개)$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백실온닭가슴살120g팩데리야끼$g$, 4, 0), ($g$삼대오백실온닭가슴살100g팩블랙페퍼$g$, 4, 1), ($g$삼대오백실온닭가슴살120g팩칠리$g$, 4, 2), ($g$삼대오백실온닭가슴살120g팩떡볶이$g$, 4, 3), ($g$삼대오백실온닭가슴살120g팩소이갈릭$g$, 4, 4)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-09 · 삼대오백 블랙마카 120정 (알약형) & 삼대오백 블랙마카 2200 (액상스틱형)
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-09', $g$삼대오백 블랙마카 120정 (알약형) & 삼대오백 블랙마카 2200 (액상스틱형)$g$, 'all', $g$https://samdae500.com/surl/p/937
https://samdae500.com/surl/p/332$g$, $g$[{"title":"블랙마카, 나는 이렇게 먹는다 (2가지 제형 비교)","body":"두 제품을 함께 보여주며 정 vs 포, 본인 라이프스타일에 맞는 타입 형태로 비교하는 콘텐츠"},{"title":"테토력(?) 챙기는 남자들의 루틴","body":"운동 전후 또는 일상 속에서 블랙마카를 챙겨 먹는 모습을 자연스럽게 보여주는 콘텐츠"},{"title":"남자의 하루, 활력도 관리가 필요합니다","body":"운동, 업무 등 바쁜 일상 속 남성 활력과 컨디션 관리를 위해 블랙마카를 챙기는 루틴"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ 정제형 : 페루산 블랙마카 2,000mg 함유 (흑마늘농출분말, 야관문추출분말, 흑삼분말 등 함유)
✔ 포형태 : 페루산 블랙마카 2,200mg 함유 (국산 사양벌꿀을 통한 깔끔한 맛) (녹용엑기스분말, 흑마늘농축분말, 대추야자농축액 등 함유)
✔ 공통 : 휴대와 섭취가 편리한 포형$g$, $g$#협찬 #삼대오백 #블랙마카 #남성활력 #남자영양제$g$, 0
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-09' AND title = $g$삼대오백 블랙마카 120정 (알약형) & 삼대오백 블랙마카 2200 (액상스틱형)$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백블랙마카120정$g$, 1, 0), ($g$삼대오백블랙마카스틱$g$, 1, 1)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-09 · 삼대오백 바이퍼 버닝 옐로우 12캔
--   ⚠ 가이드는 12캔, 제품 DB는 24캔 트레이 → 수량 확인 필요
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-09', $g$삼대오백 바이퍼 버닝 옐로우 12캔$g$, 'all', $g$https://samdae500.com/surl/p/1491$g$, $g$[{"title":"다이어트할 때 운동 전 챙기는 한 캔","body":"식단 관리와 함께 운동 전 간편하게 챙겨 마시는 일상 속 루틴"},{"title":"칼로리 커팅은 결국 꾸준한 루틴부터","body":"다이어트 기간, 운동과 함께 꾸준히 이어가는 나만의 관리 루틴"},{"title":"운동 전, 가볍게 시작하는 버닝 루틴","body":"운동 전 바이퍼 버닝 옐로우를 마시며 유산소·웨이트를 시작하는 관리 루틴"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ 카페인, 타우린, L-카르니틴 함유
✔ 바나바·녹차추출물(카테킨) 함유
✔ 캔 타입으로 언제 어디서나 간편하게 즐길 수 있는 에너지 드링크$g$, $g$#협찬 #삼대오백 #바이퍼 #바이퍼버닝옐로우 #다이어트$g$, 1
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-09' AND title = $g$삼대오백 바이퍼 버닝 옐로우 12캔$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백바이퍼버닝옐로우트레이(24C)$g$, 1, 0)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-10 · 삼대오백 부스터 프리워크아웃 레전드
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-10', $g$삼대오백 부스터 프리워크아웃 레전드$g$, 'all', $g$https://samdae500.com/surl/p/1569$g$, $g$[{"title":"평벙한 부스터 vs 레전드","body":"일반적인 프리워크아웃과는 다른 강력한 부스터라는 점을 중심 (고함량 성분*)"},{"title":"고강도 웨이트 운동전 필수템","body":"평소보다 강도 높은 운동을 준비하는 날, 운동 전 레전드를 챙겨 마시는 나만의 부스터 루틴"},{"title":"처음 먹어보는 레전드","body":"강력한 프리워크아웃을 처음 경험하는 과정과 섭취 후 본인이 느끼는 솔직한 반응"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ 카페인 400mg — 강력한 자극을 원하는 고강도 운동자를 위한 고카페인 프리워크아웃
✔ L-아르기닌 6,000mg — 강력한 펌핑을 위한 고함량 아르기닌
✔ 글리세린(글리세롤) 4,000mg + 레드비트농축액 4,000mg — 펌핑에 집중한 강력한 배합
✔ 벨벳빈순추출물분말(L-도파 10%) 500mg을 비롯해 L-카르니틴, 주석산수소콜린, 이노시톨 등 다양한 성분 함유
✔ 총 17종의 주원료를 담은 삼대오백 프리워크아웃 라인업 최상위 제품
✔ 평범한 부스터가 아닌, 고강도 트레이닝을 위해 강력한 구성으로 설계된 「레전드」$g$, $g$#협찬 #삼대오백 #부스터 #프리워크아웃 #레전드$g$, 0
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-10' AND title = $g$삼대오백 부스터 프리워크아웃 레전드$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백부스터레전드복분자$g$, 1, 0)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-10 · 트라이탄 쉐이커 신규 2종
--   ⚠ "신규 2종"을 세이지 그린·클라우드 블루로 추정해 연결 (확인 필요)
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-10', $g$트라이탄 쉐이커 신규 2종$g$, 'all', $g$https://samdae500.com/surl/p/1565$g$, $g$[{"title":"트라이탄 쉐이커와 함께하는 나만의 운동/일상 루틴 (피드/릴스)","body":"쉐이커 2종이 비주얼적으로 돋보이는 단독 컷\n운동 가기 전 가방에 챙기는 컷, 차량 탑승 후 컵홀더에 넣는 컷\n운동 전/중/후 타이밍별 마시는 컷\n프로틴, EAA, 크레아틴 등 당사 분말제품을 쉐이커에 넣어 제조하는 컷"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
첫 장은 [제품+본인 컷] 필수
@samdae500_official 태그 필수$g$, $g$✔ "예쁜데 완벽하기까지, 올라운더 트라이탄 쉐이커"
✔ BPA FREE → 냄새 배임이 적고 위생적 (환경호르몬, 발암물질X)
✔ 완전 밀폐 구조로 새지 않음
✔ 키링이 포함된 트렌디한 디자인
✔ 트라이탄 소재 특유의 투명하고 단단한 외관 + 뛰어난 내열성
✔ 둥근 바닥 구조 → 분말 뭉침 최소화 + 세척 편리
✔ 600ml 표기이나 실제 최대 약 800ml까지 사용 가능$g$, $g$#협찬 #삼대오백 #삼대오백트라이탄쉐이커 #트라이탄쉐이커 #트라이탄보틀$g$, 1
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-10' AND title = $g$트라이탄 쉐이커 신규 2종$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백트라이탄쉐이커600ml-세이지그린$g$, 1, 0), ($g$삼대오백트라이탄쉐이커600ml-클라우드블루$g$, 1, 1)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-10 · 삼대오백 바이퍼 버닝 그린 12캔
--   ⚠ 가이드는 "버닝 그린 12캔", 제품 DB는 "에너지 그린 24캔" 트레이 → 확인 필요
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-10', $g$삼대오백 바이퍼 버닝 그린 12캔$g$, 'all', $g$https://samdae500.com/surl/p/1140$g$, $g$[{"title":"운동 전 루틴","body":"헬스장에 도착해 운동복을 갈아입고 바이퍼 에너지 그린을 챙겨 마시는 등, 운동을 시작하기 전 자연스럽게 이어지는 루틴"},{"title":"고강도 운동 필수템","body":"웨이트, 유산소 등 평소보다 강도 있게 운동하는 날 바이퍼 에너지 그린을 함께 챙기는 모습을 중심으로 콘텐츠"},{"title":"일상 브이로그 및 소지품 형태","body":"기상후, 출근 전중후, 운동 전 섭취하는 일상적인 브이로그 형태"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ 고함량 L-아르기닌 4,000mg 함유
✔ 카페인, 타우린, 테아닌, 오르니틴염산염 함유
✔ 불필요한 당 섭취 부담을 줄인 제로 타입 에너지 부스터
✔ 캔 타입으로 운동 전 간편하게 챙겨 마시기 좋은 제품$g$, $g$#협찬 #삼대오백 #바이퍼 #바이퍼에너지그린 #에너지부스트$g$, 2
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-10' AND title = $g$삼대오백 바이퍼 버닝 그린 12캔$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백바이퍼에너지그린트레이(24C)$g$, 1, 0)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-11 · 게이너 1kg (맛 2개중 선택 씨리얼, 쿠키 크럼블)
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-11', $g$게이너 1kg (맛 2개중 선택 씨리얼, 쿠키 크럼블)$g$, 'one', $g$https://samdae500.com/surl/p/1524$g$, $g$[{"title":"벌크업을 위한 한 잔","body":"근육량 증가를 목표로 하는 벌크업 루틴과 함께 섭취\n탄수화물과 단백질을 간편하게 보충하는 제품 특징 소개"},{"title":"벌크업 루틴 필수템","body":"평소 식사와 운동 루틴을 소개하며 게이너 활용\n씨리얼 쿠키와 크럼블 중 맛 표현 및 실제 섭취 후기"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ [2kg에서 1kg로 리뉴얼] 씨리얼과 쿠키크럼블로 맛까지 업그레이드하여 재출시
✔ [탄수화물+단백질, 한잔으로 해결] 탄수화물 25-27g + 단백질 20g
✔ [벌크업] 운동 후 또는 벌크업 루틴에 간편하게 섭취
✔ [진한 풍미 + 고소함 + 달콤함]$g$, $g$#협찬 #삼대오백 #게이너 #벌크업 #벌크업식단$g$, 0
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-11' AND title = $g$게이너 1kg (맛 2개중 선택 씨리얼, 쿠키 크럼블)$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백게이너포대1kg씨리얼$g$, 1, 0), ($g$삼대오백게이너포대1kg쿠키크럼블$g$, 1, 1)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-11 · 삼대오백 마그네슘 리커버리 핫크림 오리지널 & 프로 2종
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-11', $g$삼대오백 마그네슘 리커버리 핫크림 오리지널 & 프로 2종$g$, 'all', $g$https://samdae500.com/surl/p/1360
https://samdae500.com/surl/p/844$g$, $g$[{"title":"오리지널 vs 프로, 온열감 비교","body":"핫크림을 직접 바르는 사용 영상과 함께 오리지널·프로의 온열감 차이 및 실제 사용감 소개"},{"title":"운동 전후, 나만의 바디 케어 루틴","body":"웨이트 트레이닝 전후 종아리, 허벅지, 어깨 등 운동 부위에 핫크림을 활용하는 모습과 개인적인 사용 후기 소개"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ [오리지널 & 프로 2종] 원하는 온열감과 사용감에 따라 선택 가능
✔ [오리지널] 부담 없이 활용하기 좋은 따뜻한 온열감
✔ [프로] 오리지널보다 강한 온열감으로 차별화된 사용 경험
✔ [운동 전 활용] 운동 전 준비 루틴에 추가해 사용하는 핫크림
✔ [운동 후 활용] 운동 후에도 마사지 및 바디 케어 루틴에 활용$g$, $g$#협찬 #삼대오백 #핫크림 #마그네슘핫크림 #리커버리$g$, 1
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-11' AND title = $g$삼대오백 마그네슘 리커버리 핫크림 오리지널 & 프로 2종$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백Mg핫크림오리지널$g$, 1, 0), ($g$삼대오백Mg핫크림프로$g$, 1, 1)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 2026-11 · 삼대오백 크레아틴 300g
WITH ins AS (
  INSERT INTO ad_items (month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order)
  SELECT '2026-11', $g$삼대오백 크레아틴 300g$g$, 'all', $g$https://samdae500.com/surl/p/543$g$, $g$[{"title":"검증된 크레아틴 성분 + 필수 섭취","body":"스포츠 영양 분야에서 다양한 연구가 진행되어 온 대표적인 운동 보충제\n+ 크레아틴 효과 소개"},{"title":"운동 퍼포먼스를 위한 데일리 루틴","body":"고중량 웨이트 트레이닝과 함께 챙기는 크레아틴\n운동 전후 또는 매일 섭취하는 모습"}]$g$::jsonb, $g$릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
@samdae500_official 태그$g$, $g$✔ [검증된 성분] 다양한 연구를 통해 운동수행 능력 및 근력 향상에 대한 효과 성분
✔ [꾸준한 섭취 루틴] 운동하는 날뿐 아니라 매일 꾸준히 챙기는 보충제 루틴
✔ [운동과 함께] 웨이트 트레이닝 및 근력 운동 루틴과 자연스럽게 연계$g$, $g$#협찬 #삼대오백 #크레아틴 #운동보충제 #웨이트트레이닝$g$, 2
  WHERE NOT EXISTS (SELECT 1 FROM ad_items WHERE month = '2026-11' AND title = $g$삼대오백 크레아틴 300g$g$)
  RETURNING id
)
INSERT INTO ad_item_products (item_id, product_id, quantity, sort_order)
SELECT ins.id, p.id, s.qty, s.ord
FROM ins
JOIN (VALUES ($g$삼대오백크레아틴$g$, 1, 0)) AS s(sku, qty, ord) ON true
JOIN products p ON btrim(p.sku) = s.sku;

-- 확인용: 월별 가이드와 연결 제품 수
SELECT i.month, i.title, COUNT(ip.product_id) AS products, COALESCE(SUM(ip.quantity),0) AS qty
FROM ad_items i LEFT JOIN ad_item_products ip ON ip.item_id = i.id
GROUP BY i.id, i.month, i.title, i.sort_order ORDER BY i.month, i.sort_order;
