// 오아 ERP 배송주문 자동 등록 (서버 전용 - 브라우저에서 import 금지)
// ERP 화면의 [등록]과 같은 요청을 보냅니다. 계정은 관리자 [설정 > ERP 연결]에서 저장 (Supabase Vault)

const ERP_BASE = 'https://api.oa-corp.com/erp'

// ERP 화면 기본값 (사용자 지정: 일반 배송 / 기타 배송 / 마케팅 / 택배 / 포항물류)
export const ERP_FIXED = {
  order_type: 4,          // 배송 주문
  transaction_type: 4,
  delivery_method: 1,     // 택배
  partner_id: 1773,       // 기타업체 유형: 마케팅
  storage_id: 1,          // 출고창고: 포항물류
  post_req_type: 1,
  order_field: '주문번호,주문일시,주문자명,주문자 연락처,주문상품,주문제품,옵션명,수량,수령인,연락처,우편번호,주소,상세주소,배송메시지,주문금액,배송비,수수료,단가',
}

function pickToken(json, res) {
  const d = json?.response_data
  const candidates = [json?.access_token, d?.access_token, d?.token, Array.isArray(d) ? d[0]?.access_token : null]
  for (const c of candidates) if (typeof c === 'string' && c.length > 20) return c
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie().join(';') : (res.headers.get('set-cookie') || '')
  const m = raw.match(/access_token=([^;]+)/)
  return m ? m[1] : null
}

export async function erpLogin(creds = {}) {
  const id = creds.id || process.env.ERP_ID
  const password = creds.password || process.env.ERP_PASSWORD
  if (!id || !password) throw new Error('ERP 계정이 연결되지 않았어요. [설정 > ERP 연결]에서 ERP 아이디·비밀번호를 저장해주세요.')
  const form = new FormData()
  form.append('username', id)
  form.append('password', password)
  const res = await fetch(`${ERP_BASE}/v2/auth/login/token`, { method: 'POST', body: form })
  let json = null
  try { json = await res.json() } catch {}
  const token = pickToken(json, res)
  if (!res.ok || !token) throw new Error(`ERP 로그인 실패 (${res.status}) ${json?.response_message || json?.message || ''}`.trim())
  return token
}

async function erpGet(token, path) {
  const res = await fetch(`${ERP_BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, Cookie: `access_token=${token}` } })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`ERP 조회 실패 (${res.status}) ${path}`)
  return json?.response_data
}

// ERP 제품명(=전산명) → ERP 제품 ID
export async function erpProductMap(token) {
  const d = await erpGet(token, '/v2/master/code/data?data_str=product_info')
  const map = {}
  for (const p of d?.product_info || []) {
    const n = String(p.product_name || '').trim()
    if (n && !map[n]) map[n] = p.id
  }
  return map
}

/**
 * ERP 화면이 보내는 것과 같은 형식의 배송주문 데이터
 * @param rows buildErpRows 결과 rows (values: [전산명, 수량, 수령인, 연락처, 우편번호, 주소, 상세주소, 배송메시지])
 */
export function buildErpPayload(rows, productMap, { shipDate, memo }) {
  const unknown = []
  const people = new Map()
  for (const r of rows) {
    const [sku, qty, receiver, contact, zip, address, detail, message] = r.values
    const productId = productMap[String(sku).trim()]
    if (!productId) { unknown.push({ receiver, sku }); continue }
    const key = `${receiver}|${contact}|${zip}|${address}`
    if (!people.has(key)) people.set(key, { receiver, contact, zip_code: zip, address, address_detail: detail || '', message: message || '', products: new Map() })
    const p = people.get(key).products
    p.set(productId, (p.get(productId) || 0) + (Number(qty) || 1))
  }
  const order_delivery_list = [...people.values()].map(p => ({
    control: { status: 'ADD' },
    post_req_type: ERP_FIXED.post_req_type,
    delivery_method: ERP_FIXED.delivery_method,
    receiver: p.receiver,
    contact: p.contact,
    zip_code: p.zip_code,
    address: p.address,
    address_detail: p.address_detail,
    message: p.message,
    start_warehouse_id: null,
    storage_id: null,
    tracking_list: [{
      storage_id: ERP_FIXED.storage_id,
      product_list: [...p.products.entries()].map(([product_id, quantity]) => ({ product_id, quantity, control: { status: 'ADD' } })),
    }],
  }))
  const payload = {
    delivery_request_date: shipDate,
    delivery_method: ERP_FIXED.delivery_method,
    order_type: ERP_FIXED.order_type,
    transaction_type: ERP_FIXED.transaction_type,
    order_delivery_list,
    partner_id: ERP_FIXED.partner_id,
    order_field: ERP_FIXED.order_field,
    order_payments_list: [],
    memo,
    customer_name: '',
  }
  const lines = order_delivery_list.reduce((a, d) => a + d.tracking_list[0].product_list.length, 0)
  const qty = order_delivery_list.reduce((a, d) => a + d.tracking_list[0].product_list.reduce((s, x) => s + x.quantity, 0), 0)
  return { payload, unknown, summary: { people: order_delivery_list.length, lines, qty } }
}

export async function erpCreateDeliveryOrder(token, payload) {
  const res = await fetch(`${ERP_BASE}/v2/sales/order/delivery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Cookie: `access_token=${token}` },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || (json && json.response_code && json.response_code >= 400)) {
    throw new Error(`ERP 등록 실패 (${res.status}) ${json?.response_message || json?.message || ''}`.trim())
  }
  return json
}

// 등록 후 ERP 목록에서 주문번호 찾기 (메모 기준, 오늘 등록분)
export async function erpFindOrderByMemo(token, memo, sinceDate) {
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) // KST
  const from = sinceDate || today
  const d = await erpGet(token, `/v2/sales/order/delivery/paging?register_date_time_start=${from}&register_date_time_end=${today}&page=1&size=100`)
  const list = d?.response_list || []
  const hit = list.find(o => String(o.memo || '').trim() === memo.trim())
  return hit ? { id: hit.id, orderNumber: hit.order_number, state: hit.order_state, approval: hit.approval_state, registeredAt: hit.register_date_time } : null
}

// 이번 달 이미 ERP에 등록된 앰버서더 발송 건의 수령인 (중복 발송 방지)
// 메모에 '삼대오백' + '엠버서더(앰버서더)' + 'N월'이 들어간 배송주문을 찾아 수령인을 모음
export async function erpMonthShipped(token, month) {
  const monthNum = Number(month.split('-')[1])
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const from = `${month}-01` < today ? `${month}-01` : today
  // 전월 말에 미리 등록하는 경우도 있어 1주일 앞부터 조회
  const start = new Date(new Date(from).getTime() - 7 * 86400000).toISOString().slice(0, 10)
  const all = []
  for (let page = 1; page <= 20; page++) {
    const d = await erpGet(token, `/v2/sales/order/delivery/paging?register_date_time_start=${start}&register_date_time_end=${today}&page=${page}&size=200`)
    const list = d?.response_list || []
    all.push(...list)
    if (list.length < 200) break
  }
  const re = new RegExp(`(?<!\\d)${monthNum}월`)
  const orders = all.filter(o => {
    const m = String(o.memo || '')
    return /삼대오백/.test(m) && /[엠앰]버서더/.test(m) && re.test(m) && String(o.order_state) !== '4' // 주문 취소 제외
  })
  const names = new Map()
  for (const o of orders) {
    const detail = await erpGet(token, `/v2/sales/order/${o.id}`)
    const od = Array.isArray(detail) ? detail[0] : detail
    for (const x of od?.order_delivery_list || []) {
      const n = String(x.receiver || '').trim()
      if (n && !names.has(n)) names.set(n, o.order_number)
    }
  }
  return { orders: orders.map(o => ({ orderNumber: o.order_number, memo: o.memo })), names }
}
