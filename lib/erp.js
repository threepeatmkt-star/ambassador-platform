// ERP(오아 ERP > 영업 > 주문 > 배송 주문) 엑셀 업로드 양식
// 컬럼 순서: 주문제품, 수량, 수령인, 연락처, 우편번호, 주소, 상세주소, 배송메시지

export const ERP_HEADERS = ['주문제품', '수량', '수령인', '연락처', '우편번호', '주소', '상세주소', '배송메시지']
const ERP_COL_WIDTHS = [40.375, 5.25, 7.125, 14.375, 9, 67.875, 9, 34.5] // 기존 ERP 업로드 파일과 동일

// ERP 등록 화면에서 직접 고르는 기본정보 (엑셀에는 들어가지 않음)
export const ERP_BASIC_INFO = [
  ['배송 주문 유형', '일반 배송'],
  ['업체 유형', '기타 배송'],
  ['기타업체 유형', '마케팅'],
  ['배송 방식', '택배'],
  ['발송일', '출고일에 맞춰 직접 선택'],
  ['메모', '목적에 맞춰 직접 입력'],
]

export const TYPE_LABEL = { free: '무상', ad: '광고' }

const digits = v => String(v ?? '').replace(/\D/g, '')

export function normalizePhone(v) {
  let d = digits(v)
  if (d.length === 10 && d.startsWith('1')) d = '0' + d // 엑셀에서 앞자리 0이 빠진 경우
  return d
}

export function normalizeZip(v) {
  const d = digits(v)
  return d.length > 0 && d.length < 5 ? d.padStart(5, '0') : d
}

export function cleanSku(sku) {
  return String(sku ?? '').trim()
}

export function isValidSku(sku) {
  const s = cleanSku(sku)
  return !!s && !/^["'`.\-]+$/.test(s)
}

/**
 * 앰버서더별 무상 + 광고 제품 묶기
 * @param applications [{ real_name, submitted_at, product1, product2 }]  (무상: 앰버서더가 직접 신청)
 * @param adAssignments [{ real_name, item_id, item_title, product_name, sku, quantity, product }] (광고: 관리자 배정)
 * @returns [{ name, applied, free: [{name, sku, quantity}], ad: [{name, sku, quantity, item_title}] }]
 *          순서: 무상 신청 순 → 광고만 배정된 사람(이름순)
 */
export function groupByAmbassador(applications = [], adAssignments = []) {
  const map = new Map()
  const get = name => {
    if (!map.has(name)) map.set(name, { name, applied: false, submitted_at: null, free: [], ad: [] })
    return map.get(name)
  }
  for (const app of applications) {
    const g = get(app.real_name)
    g.applied = true
    g.submitted_at = app.submitted_at
    for (const p of [app.product1, app.product2]) {
      if (p) g.free.push({ name: p.name, sku: cleanSku(p.sku), quantity: 1 })
    }
  }
  for (const a of adAssignments) {
    const g = get(a.real_name)
    g.ad.push({
      name: a.product?.name || a.product_name || '(삭제된 제품)',
      sku: cleanSku(a.product?.sku || a.sku),
      quantity: a.quantity || 1,
      item_title: a.item_title || '',
    })
  }
  const list = [...map.values()]
  const applied = list.filter(g => g.applied).sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)))
  const adOnly = list.filter(g => !g.applied).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return [...applied, ...adOnly]
}

/**
 * ERP 업로드 행 (제품 1개 = 1행, 같은 사람 행은 붙어서 나옴)
 * @param groups groupByAmbassador 결과
 * @param ambassadors [{ real_name, phone, zipcode, address, address_detail }]
 * @param opts { types: ['free','ad'], message }
 */
export function buildErpRows(groups, ambassadors, opts = {}) {
  const types = opts.types || ['free', 'ad']
  const message = opts.message || ''
  const byName = new Map(ambassadors.map(a => [a.real_name, a]))
  const rows = []
  const issues = []

  for (const g of groups) {
    const items = [
      ...(types.includes('free') ? g.free.map(p => ({ ...p, type: 'free' })) : []),
      ...(types.includes('ad') ? g.ad.map(p => ({ ...p, type: 'ad' })) : []),
    ]
    if (!items.length) continue

    const amb = byName.get(g.name)
    const phone = normalizePhone(amb?.phone)
    const zip = normalizeZip(amb?.zipcode)
    const address = String(amb?.address ?? '').trim()
    const detail = String(amb?.address_detail ?? '').trim()
    const personProblems = []
    if (!amb) personProblems.push('현재 명단에 없음')
    else {
      if (!/^01\d{8,9}$/.test(phone)) personProblems.push('연락처 확인')
      if (!/^\d{5}$/.test(zip)) personProblems.push('우편번호 확인')
      if (!address) personProblems.push('주소 없음')
    }

    items.forEach((it, idx) => {
      const problems = [...personProblems]
      if (!isValidSku(it.sku)) problems.push('전산명(SKU) 없음/오류')
      const key = `${g.name}-${it.type}-${idx}`
      rows.push({
        key,
        type: it.type,
        productName: it.name,
        itemTitle: it.item_title || '',
        values: [cleanSku(it.sku), it.quantity || 1, g.name, phone, zip, address, detail, message],
        problems,
      })
      if (problems.length) issues.push({ key, name: g.name, product: it.name, problem: problems.join(', ') })
    })
  }
  return { rows, issues }
}

// ERP 양식 시트 (연락처/우편번호는 텍스트로 저장해 앞자리 0 유지)
export function makeErpSheet(XLSX, rows) {
  const ws = XLSX.utils.aoa_to_sheet([ERP_HEADERS, ...rows.map(r => r.values)])
  for (let r = 1; r <= rows.length; r++) {
    for (const c of [3, 4]) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (ws[ref]) { ws[ref].t = 's'; ws[ref].z = '@'; ws[ref].v = String(ws[ref].v) }
    }
  }
  ws['!cols'] = ERP_COL_WIDTHS.map(wch => ({ wch }))
  return ws
}

export function makeErpWorkbook(XLSX, rows) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, makeErpSheet(XLSX, rows), 'Sheet1')
  return wb
}

// 관리자 화면에서 공통으로 쓰는 광고 배정 조회 (아이템 제목 포함)
export async function fetchAdAssignments(supabase, months) {
  const list = Array.isArray(months) ? months : [months]
  if (!list.length) return { data: [], error: null }
  const { data, error } = await supabase
    .from('ad_assignments')
    .select('month, real_name, item_id, product_name, sku, quantity, product:products(id, name, sku), item:ad_items(title, sort_order)')
    .in('month', list)
  const rows = (data || [])
    .map(a => ({ ...a, item_title: a.item?.title || '', item_order: a.item?.sort_order ?? 0 }))
    .sort((a, b) => a.item_order - b.item_order)
  return { data: rows, error }
}

// 기간(YYYY-MM-DD ~ YYYY-MM-DD)에 걸친 월 목록
export function monthsBetween(from, to) {
  if (!from || !to) return []
  const out = []
  let [y, m] = from.slice(0, 7).split('-').map(Number)
  const [ty, tm] = to.slice(0, 7).split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
    if (out.length > 36) break
  }
  return out
}
