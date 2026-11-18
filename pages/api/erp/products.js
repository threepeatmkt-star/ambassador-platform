// POST /api/erp/products  body: { skus: [...] }
// 제품 DB 동기화용 ERP 조회 (읽기 전용 - ERP에는 아무것도 바꾸지 않음)
import { createClient } from '@supabase/supabase-js'
import { erpLogin, erpProductsForSync } from '../../../lib/erpApi'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const auth = req.headers.authorization || ''
  const userToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!userToken) return res.status(401).json({ error: '관리자 로그인이 필요해요.' })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser(userToken)
  if (userErr || !userData?.user) return res.status(401).json({ error: '관리자 로그인이 만료됐어요. 다시 로그인해주세요.' })
  const { data: credRows, error: credErr } = await supabase.rpc('get_erp_credentials')
  if (credErr) return res.status(403).json({ error: 'ERP 계정을 불러올 권한이 없어요: ' + credErr.message })
  const creds = { id: credRows?.[0]?.erp_id || '', password: credRows?.[0]?.erp_password || '' }
  try {
    const token = await erpLogin(creds)
    const items = await erpProductsForSync(token, Array.isArray(req.body?.skus) ? req.body.skus : [])
    return res.status(200).json({ ok: true, items, at: new Date().toISOString() })
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) })
  }
}
