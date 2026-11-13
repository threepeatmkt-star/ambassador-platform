// POST /api/erp/register
// body: { month: 'YYYY-MM', shipDate: 'YYYY-MM-DD', types?: ['free','ad'], message?: '', skipIssues?: false, mode: 'check' | 'register', force?: false }
// - check: ERP 로그인 · 제품 매칭 · 중복 확인까지만 (ERP에 아무것도 만들지 않음)
// - register: 실제로 ERP 배송주문 등록
import { createClient } from '@supabase/supabase-js'
import { groupByAmbassador, buildErpRows, fetchAdAssignments } from '../../../lib/erp'
import { erpLogin, erpProductMap, buildErpPayload, erpCreateDeliveryOrder, erpFindOrderByMemo, erpMonthShipped } from '../../../lib/erpApi'

const APP_SELECT = `
  id, month, real_name, submitted_at,
  product1:products!applications_product1_id_fkey(id, name, sku),
  product2:products!applications_product2_id_fkey(id, name, sku)
`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  // 1) 관리자 로그인 확인 (사이트 관리자 세션 토큰)
  const auth = req.headers.authorization || ''
  const userToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!userToken) return res.status(401).json({ error: '관리자 로그인이 필요해요.' })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser(userToken)
  if (userErr || !userData?.user) return res.status(401).json({ error: '관리자 로그인이 만료됐어요. 다시 로그인해주세요.' })

  const { month, shipDate, types = ['free', 'ad'], message = '', skipIssues = false, mode = 'check', force = false, includeShipped = false } = req.body || {}

  // 저장된 ERP 계정 (관리자만 꺼낼 수 있음)
  const { data: credRows, error: credErr } = await supabase.rpc('get_erp_credentials')
  if (credErr) return res.status(403).json({ error: 'ERP 계정을 불러올 권한이 없어요: ' + credErr.message })
  const creds = { id: credRows?.[0]?.erp_id || '', password: credRows?.[0]?.erp_password || '' }

  // 연결 테스트: ERP 로그인만 해보고 끝 (아무것도 등록 안 함)
  if (mode === 'login') {
    try {
      const t = await erpLogin(creds)
      const map = await erpProductMap(t)
      return res.status(200).json({ ok: true, mode: 'login', products: Object.keys(map).length })
    } catch (e) {
      return res.status(400).json({ error: e.message || String(e) })
    }
  }
  if (!/^\d{4}-\d{2}$/.test(month || '')) return res.status(400).json({ error: '기준 월이 올바르지 않아요.' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shipDate || '')) return res.status(400).json({ error: '발송일을 선택해주세요.' })

  try {
    // 2) 이번 달 무상 신청 + 광고 배정 + 명단
    const [appsRes, ambRes, adsRes, regRes] = await Promise.all([
      supabase.from('applications').select(APP_SELECT).eq('month', month).order('submitted_at'),
      supabase.from('ambassadors').select('*'),
      fetchAdAssignments(supabase, month),
      supabase.from('settings').select('key,value').eq('key', `erp_registered_${month}`),
    ])
    if (appsRes.error) throw new Error('신청 내역 조회 실패: ' + appsRes.error.message)
    if (adsRes.error) throw new Error('광고 배정 조회 실패: ' + adsRes.error.message)

    const groups = groupByAmbassador(appsRes.data || [], adsRes.data || [])
    const { rows, issues } = buildErpRows(groups, ambRes.data || [], { types, message: String(message).trim() })
    const issueKeys = new Set(issues.map(i => i.key))
    if (issues.length && !skipIssues) return res.status(400).json({ error: `확인이 필요한 행 ${issues.length}건이 있어요.`, issues })
    const validRows = rows.filter(r => !issueKeys.has(r.key))
    if (!validRows.length) return res.status(400).json({ error: '등록할 행이 없어요.' })

    // 3) ERP 로그인 · 이번 달 이미 등록된 사람 제외 (중복 발송 방지)
    const token = await erpLogin(creds)
    const shipped = await erpMonthShipped(token, month)
    const excluded = [...new Set(validRows.map(r => r.values[2]).filter(n => shipped.names.has(n)))].map(n => ({ name: n, orderNumber: shipped.names.get(n) }))
    const useRows = includeShipped ? validRows : validRows.filter(r => !shipped.names.has(r.values[2]))
    if (!useRows.length) return res.status(400).json({ error: '이번 달 대상자가 모두 이미 ERP에 등록돼 있어요.', excluded, priorOrders: shipped.orders })

    const people = new Set(useRows.map(r => r.values[2])).size
    const monthNum = Number(month.split('-')[1])
    const memo = `삼대오백 ${monthNum}월 엠버서더 광고 및 무상제품 발송 (${people}명)`
    const already = regRes.data?.[0]?.value ? JSON.parse(regRes.data[0].value) : null

    // 4) 제품 매칭
    const productMap = await erpProductMap(token)
    const { payload, unknown, summary } = buildErpPayload(useRows, productMap, { shipDate, memo })
    if (unknown.length) return res.status(400).json({ error: `ERP에서 찾을 수 없는 전산명 ${unknown.length}건`, unknown })

    const existing = await erpFindOrderByMemo(token, memo, `${month}-01`).catch(() => null)
    const duplicate = existing ? { site: already, erp: existing } : null

    if (mode !== 'register') {
      return res.status(200).json({ ok: true, mode: 'check', memo, shipDate, summary, duplicate, excluded, priorOrders: shipped.orders })
    }
    if (duplicate && !force) {
      return res.status(409).json({ error: '이번 달 ERP 등록 기록이 이미 있어요. 중복 등록이 아닌지 확인해주세요.', duplicate })
    }

    // 5) 실제 등록
    const result = await erpCreateDeliveryOrder(token, payload)
    const created = await erpFindOrderByMemo(token, memo).catch(() => null)
    const record = { date: shipDate, memo, rows: summary.lines, people: summary.people, qty: summary.qty, at: new Date().toISOString(), auto: true, orderNumber: created?.orderNumber || null, erpId: created?.id || null, excluded: excluded.length }
    await supabase.from('settings').upsert({ key: `erp_registered_${month}`, value: JSON.stringify(record) })
    return res.status(200).json({ ok: true, mode: 'register', record, erp: result?.response_code ?? null })
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) })
  }
}
