import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../../lib/useAdminAuth'
import { useAdminMonth, monthLabel } from '../../lib/useAdminMonth'
import { groupByAmbassador, buildErpRows, makeErpWorkbook, fetchAdAssignments, ERP_HEADERS, TYPE_LABEL } from '../../lib/erp'
import AdminNav from '../../components/AdminNav'
import PageHeader, { StatCards } from '../../components/PageHeader'

const ERP_URL = 'https://erpw.oa-corp.com/home/sales/delivery_order'

const APP_SELECT = `
  id, month, real_name, submitted_at,
  product1:products!applications_product1_id_fkey(id, name, sku),
  product2:products!applications_product2_id_fkey(id, name, sku)
`

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

export default function AdminShipping() {
  const { session, loading: authLoading, logout } = useAdminAuth()
  const [month, setMonth] = useAdminMonth()
  const [applications, setApplications] = useState([])
  const [adAssignments, setAdAssignments] = useState([])
  const [ambassadors, setAmbassadors] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [shipDate, setShipDate] = useState(today())
  const [typeFilter, setTypeFilter] = useState('all') // all | free | ad
  const [message, setMessage] = useState('')
  const [skipIssues, setSkipIssues] = useState(false)
  const [registered, setRegistered] = useState(null) // { date, memo, rows, people, at }
  const [toast, setToast] = useState('')
  const loadedFor = useRef('')

  useEffect(() => {
    if (session && month && loadedFor.current !== month) {
      loadedFor.current = month
      load(month)
    }
  }, [session, month])

  async function load(m) {
    setLoading(true)
    setLoadError('')
    const [appsRes, ambRes, adsRes, regRes] = await Promise.all([
      supabase.from('applications').select(APP_SELECT).eq('month', m).order('submitted_at'),
      supabase.from('ambassadors').select('*'),
      fetchAdAssignments(supabase, m),
      supabase.from('settings').select('key,value').eq('key', `erp_registered_${m}`),
    ])
    if (appsRes.error) setLoadError('신청 내역을 불러오지 못했어요: ' + appsRes.error.message)
    setApplications(appsRes.data || [])
    setAmbassadors(ambRes.data || [])
    setAdAssignments(adsRes.data || [])
    const reg = regRes.data?.[0]?.value
    try { setRegistered(reg ? JSON.parse(reg) : null) } catch { setRegistered(null) }
    setLoading(false)
  }

  const types = typeFilter === 'all' ? ['free', 'ad'] : [typeFilter]
  const groups = groupByAmbassador(applications, adAssignments)
  const { rows, issues } = buildErpRows(groups, ambassadors, { types, message: message.trim() })
  const issueKeys = new Set(issues.map(i => i.key))
  const exportRows = skipIssues ? rows.filter(r => !issueKeys.has(r.key)) : rows
  const people = new Set(exportRows.map(r => r.values[2])).size
  const totalQty = exportRows.reduce((a, r) => a + (Number(r.values[1]) || 0), 0)
  const canExport = exportRows.length > 0 && (skipIssues || issues.length === 0)
  const monthNum = Number(String(month).split('-')[1] || 0)
  const memo = `삼대오백 ${monthNum}월 엠버서더 광고 및 무상제품 발송 (${people}명)`

  const basicInfo = [
    ['배송 주문 유형', '일반 배송'],
    ['업체 유형', '기타 배송'],
    ['기타업체 유형', '마케팅'],
    ['배송 방식', '택배'],
    ['출고 창고', '포항물류'],
    ['발송일', shipDate, true],
    ['메모', memo, true],
  ]

  function flash(t) {
    setToast(t)
    setTimeout(() => setToast(''), 2000)
  }

  function download() {
    if (!canExport) return
    const wb = makeErpWorkbook(XLSX, exportRows)
    XLSX.writeFile(wb, `ERP배송주문_삼대오백_${month}_발송${shipDate}_${people}명_${exportRows.length}행.xlsx`)
    flash('ERP 업로드 파일을 다운로드했어요')
  }

  async function markRegistered() {
    const value = { date: shipDate, memo, rows: exportRows.length, people, at: new Date().toISOString() }
    const { error } = await supabase.from('settings').upsert({ key: `erp_registered_${month}`, value: JSON.stringify(value) })
    if (error) { alert('저장 실패: ' + error.message); return }
    setRegistered(value)
    flash('ERP 등록 완료로 표시했어요')
  }

  async function unmarkRegistered() {
    if (!confirm('ERP 등록 완료 표시를 취소할까요?')) return
    await supabase.from('settings').delete().eq('key', `erp_registered_${month}`)
    setRegistered(null)
  }

  if (authLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>
  if (!session) return null

  const chip = on => `px-4 py-2 rounded-full text-sm font-semibold ${on ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600 hover:border-gray-400'}`

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>ERP 출고 | 삼대오백 앰버서더 허브</title></Head>
      <AdminNav active="shipping" onLogout={logout} month={month} onMonthChange={setMonth} />

      <div className="max-w-7xl mx-auto px-8 py-8">
        <PageHeader
          title="ERP 출고"
          desc={`${monthLabel(month)} 무상 + 광고제품을 오아 ERP 배송주문 양식으로 만들어요. 등록은 직접 하세요.`}
        />

        {registered && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-6 flex flex-wrap items-center gap-3">
            <span className="text-green-700 font-semibold">✓ {monthLabel(month)} ERP 등록 완료</span>
            <span className="text-green-700/80 text-sm">발송일 {registered.date} · {registered.people}명 · {registered.rows}행 · 표시 {new Date(registered.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <button onClick={unmarkRegistered} className="ml-auto text-sm text-green-700 underline">표시 취소</button>
          </div>
        )}

        <StatCards items={[
          { label: '발송 인원', value: people, unit: '명' },
          { label: '출고 행 (제품 1개 = 1행)', value: exportRows.length, unit: '행' },
          { label: '총 수량', value: totalQty, unit: '개' },
          { label: '확인 필요', value: issues.length, unit: '건', color: issues.length ? 'text-red-500' : 'text-green-600' },
        ]} />

        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          {/* 왼쪽: 미리보기 */}
          <div className="space-y-4 min-w-0">
            <div className="bg-white rounded-2xl border p-5 flex flex-wrap items-center gap-2">
              {[['all', '무상 + 광고'], ['free', '무상만'], ['ad', '광고만']].map(([k, l]) => (
                <button key={k} onClick={() => setTypeFilter(k)} className={chip(typeFilter === k)}>{l}</button>
              ))}
              <input value={message} onChange={e => setMessage(e.target.value)} placeholder="배송메시지 (선택 · 모든 행 동일)" className="flex-1 min-w-[220px] border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>

            {loadError && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600">{loadError}</div>}

            {issues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-red-200 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-red-600 font-semibold">ERP에 올리기 전 확인이 필요한 행 {issues.length}건</p>
                  <label className="flex items-center gap-2 text-sm text-red-600">
                    <input type="checkbox" checked={skipIssues} onChange={e => setSkipIssues(e.target.checked)} />
                    문제 행 빼고 파일 만들기
                  </label>
                </div>
                <div className="divide-y divide-red-100 max-h-56 overflow-y-auto">
                  {issues.map(i => (
                    <div key={i.key} className="px-5 py-2 text-sm flex gap-3">
                      <span className="font-semibold text-gray-800 w-16 flex-shrink-0">{i.name}</span>
                      <span className="text-gray-600 flex-1">{i.product}</span>
                      <span className="text-red-500">{i.problem}</span>
                    </div>
                  ))}
                </div>
                <p className="px-5 py-2 text-xs text-red-500/80">연락처·주소는 [앰버서더 명단] 재업로드, 전산명은 [제품 DB 관리]에서 고친 뒤 이 화면을 새로고침하세요.</p>
              </div>
            )}

            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
                <p className="font-semibold text-gray-700">ERP 업로드 파일 미리보기</p>
                <p className="text-xs text-gray-400">파일에는 아래 8개 열만 들어가요 (같은 사람 행은 붙어서)</p>
              </div>
              {loading ? (
                <div className="text-center py-12 text-gray-400">불러오는 중...</div>
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">구분</th>
                        {ERP_HEADERS.map(h => <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const bad = issueKeys.has(r.key)
                        const skipped = bad && skipIssues
                        return (
                          <tr key={r.key} className={`border-b last:border-0 ${bad ? 'bg-red-50/60' : ''} ${skipped ? 'opacity-40 line-through' : ''}`}>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.type === 'ad' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{TYPE_LABEL[r.type]}</span>
                            </td>
                            {r.values.map((v, i) => (
                              <td key={i} className={`px-3 py-1.5 text-gray-700 ${i === 5 ? 'min-w-[260px]' : 'whitespace-nowrap'}`}>{String(v ?? '')}</td>
                            ))}
                          </tr>
                        )
                      })}
                      {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">{monthLabel(month)} 신청·광고 배정 내역이 없어요.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 등록 순서 */}
          <div className="space-y-4 lg:sticky lg:top-40 self-start">
            <div className="bg-white rounded-2xl border p-5">
              <p className="text-sm font-bold text-orange-600 mb-2">STEP 1 · 발송일 정하기</p>
              <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>

            <div className="bg-white rounded-2xl border p-5">
              <p className="text-sm font-bold text-orange-600 mb-3">STEP 2 · 업로드 파일 받기</p>
              <button onClick={download} disabled={!canExport} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl text-lg">
                ERP 업로드 파일 다운로드
              </button>
              <p className="text-xs text-gray-400 mt-2">{people}명 · {exportRows.length}행 · 연락처·우편번호 앞자리 0 유지</p>
              {!canExport && issues.length > 0 && !skipIssues && <p className="text-xs text-red-500 mt-1">확인 필요 행을 고치거나 [문제 행 빼고 파일 만들기]를 체크하세요.</p>}
            </div>

            <div className="bg-white rounded-2xl border p-5">
              <p className="text-sm font-bold text-orange-600 mb-3">STEP 3 · ERP에 등록 (직접)</p>
              <a href={ERP_URL} target="_blank" rel="noreferrer" className="block text-center border-2 border-orange-400 text-orange-600 hover:bg-orange-50 rounded-xl py-3 font-bold mb-4">
                오아 ERP 배송 주문 열기 ↗
              </a>
              <ol className="text-xs text-gray-600 mb-3 space-y-0.5 list-decimal list-inside">
                <li>ERP에서 <b>[등록]</b> → 아래 기본 정보 입력</li>
                <li>엑셀 파일 업로드 칸 옆 <b className="text-orange-600">[기본값]</b> 먼저 누르기</li>
                <li>다운로드한 파일 올리기 → 배송지 {people}곳 생성 확인</li>
                <li>메모 [추가] → 메모 붙여넣기 → <b>[등록]</b></li>
              </ol>
              <table className="w-full text-sm">
                <tbody>
                  {basicInfo.map(([k, v, copy]) => (
                    <tr key={k} className="border-t">
                      <td className="py-2 text-gray-500 w-24 align-top">{k}</td>
                      <td className="py-2 font-semibold text-gray-900 break-keep">{v}</td>
                      <td className="py-2 text-right align-top">
                        {copy && <button onClick={async () => flash(await copyText(v) ? `${k} 복사됨` : '복사 실패')} className="text-xs border rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-50">복사</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border p-5">
              <p className="text-sm font-bold text-orange-600 mb-3">STEP 4 · 등록했으면 표시</p>
              <button onClick={markRegistered} className="w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 rounded-xl">
                {registered ? '등록 완료 표시 다시 저장' : 'ERP 등록 완료로 표시'}
              </button>
              <p className="text-xs text-gray-400 mt-2">홈과 이 화면에 {monthLabel(month)} 등록 완료로 표시돼요.</p>
            </div>

            {toast && <div className="bg-gray-900 text-white text-sm rounded-xl px-4 py-2 text-center">{toast}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
