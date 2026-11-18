import { useState, useEffect, useRef, Fragment } from 'react'
import Head from 'next/head'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../../lib/useAdminAuth'
import { useAdminMonth, monthLabel } from '../../lib/useAdminMonth'
import { groupByAmbassador, buildErpRows, makeErpWorkbook, fetchAdAssignments, ERP_HEADERS, TYPE_LABEL, erpMemo } from '../../lib/erp'
import AdminNav from '../../components/AdminNav'
import PageHeader, { StatCards } from '../../components/PageHeader'

const APPROVERS = [
  { email: 'nhkim2@oa-world.com', name: '김나형', note: '기본' },
  { email: 'wsseo@oa-world.com', name: '서원상', note: '김나형 부재 시' },
]

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
  const [typeFilter, setTypeFilter] = useState('all') // all | free | ad | new(신제품, 따로 등록)
  const [regs, setRegs] = useState({}) // { monthly: {date, memo, rows, people, at}, new: {...} }
  const regKind = typeFilter === 'new' ? 'new' : 'monthly'
  const registered = regs[regKind] || null
  const setRegistered = v => setRegs(r => ({ ...r, [regKind]: v }))
  const regKey = m => (typeFilter === 'new' ? `erp_registered_new_${m}` : `erp_registered_${m}`)
  const [message, setMessage] = useState('')
  const [skipIssues, setSkipIssues] = useState(false)
  const [skips, setSkips] = useState({}) // { monthly: [이름], new: [이름] } 이번 발송에서 뺀 사람
  const [itemMap, setItemMap] = useState({}) // 이번 달 광고/신제품 아이템 (수정용 제품 목록)
  const [editPerson, setEditPerson] = useState(null) // 이름
  const [toast, setToast] = useState('')
  const [autoState, setAutoState] = useState({ phase: 'idle' }) // idle | checking | checked | registering | done | error
  const [showManual, setShowManual] = useState(false)
  const [approver, setApprover] = useState(APPROVERS[0].email) // 기본 김나형, 부재 시 서원상
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
    const [appsRes, ambRes, adsRes, regRes, itemsRes] = await Promise.all([
      supabase.from('applications').select(APP_SELECT).eq('month', m).order('submitted_at'),
      supabase.from('ambassadors').select('*'),
      fetchAdAssignments(supabase, m),
      supabase.from('settings').select('key,value').in('key', [`erp_registered_${m}`, `erp_registered_new_${m}`, `erp_skip_monthly_${m}`, `erp_skip_new_${m}`]),
      supabase.from('ad_items').select('id, title, kind, pick_mode, ad_item_products(product_id, quantity, sort_order, product:products(id, name, sku))').eq('month', m),
    ])
    if (appsRes.error) setLoadError('신청 내역을 불러오지 못했어요: ' + appsRes.error.message)
    setApplications(appsRes.data || [])
    setAmbassadors(ambRes.data || [])
    setAdAssignments(adsRes.data || [])
    const parse = k => { try { const v = regRes.data?.find(r => r.key === k)?.value; return v ? JSON.parse(v) : null } catch { return null } }
    setRegs({ monthly: parse(`erp_registered_${m}`), new: parse(`erp_registered_new_${m}`) })
    setSkips({ monthly: parse(`erp_skip_monthly_${m}`) || [], new: parse(`erp_skip_new_${m}`) || [] })
    setItemMap(Object.fromEntries((itemsRes.data || []).map(it => [it.id, { ...it, products: (it.ad_item_products || []).sort((a, b) => a.sort_order - b.sort_order).filter(x => x.product).map(x => x.product) }])))
    setLoading(false)
  }

  const types = typeFilter === 'all' ? ['free', 'ad'] : [typeFilter]
  const newCount = adAssignments.filter(a => a.item_kind === 'new').length
  const groups = groupByAmbassador(applications, adAssignments)
  const { rows, issues: rawIssues } = buildErpRows(groups, ambassadors, { types, message: message.trim() })
  const skipNames = skips[regKind] || []
  const skipSet = new Set(skipNames)
  const issues = rawIssues.filter(i => !skipSet.has(i.name))
  const issueKeys = new Set(issues.map(i => i.key))
  const exportRows = (skipIssues ? rows.filter(r => !issueKeys.has(r.key)) : rows).filter(r => !skipSet.has(r.values[2]))
  const firstRowOf = new Set()
  { const seen = new Set(); for (const r of rows) { if (!seen.has(r.values[2])) { seen.add(r.values[2]); firstRowOf.add(r.key) } } }
  const personCount = new Set(rows.map(r => r.values[2])).size
  const people = new Set(exportRows.map(r => r.values[2])).size
  const totalQty = exportRows.reduce((a, r) => a + (Number(r.values[1]) || 0), 0)
  const canExport = exportRows.length > 0 && (skipIssues || issues.length === 0)
  const monthNum = Number(String(month).split('-')[1] || 0)
  const memo = erpMemo(month, types, people, [...new Set(exportRows.map(r => r.itemTitle))])

  const basicInfo = [
    ['배송 주문 유형', '일반 배송'],
    ['업체 유형', '기타 배송'],
    ['기타업체 유형', '마케팅'],
    ['배송 방식', '택배'],
    ['출고 창고', '포항물류'],
    ['발송일', shipDate, true],
    ['메모', memo, true],
  ]

  async function callErp(mode, force = false) {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    const res = await fetch('/api/erp/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ month, shipDate, types, message: message.trim(), skipIssues, mode, force, approvers: [approver] }),
    })
    const json = await res.json().catch(() => ({ error: '응답을 읽지 못했어요.' }))
    return { status: res.status, ...json }
  }

  async function checkErp() {
    setAutoState({ phase: 'checking' })
    const r = await callErp('check')
    if (!r.ok) { setAutoState({ phase: 'error', error: r.error, detail: r.unknown || r.issues }); return }
    setAutoState({ phase: 'checked', ...r })
  }

  async function registerErp() {
    const c = autoState
    const dupNote = c.duplicate ? '\n\n⚠️ 이번 달 등록 기록이 이미 있어요. 그래도 등록할까요?' : ''
    if (!confirm(`ERP에 배송주문을 등록할까요?\n\n발송일: ${c.shipDate}\n${c.summary.people}명 · ${c.summary.lines}행 · ${c.summary.qty}개\n승인 담당자: ${(c.approverNames || []).join(', ')}\n메모: ${c.memo}${dupNote}`)) return
    setAutoState({ ...c, phase: 'registering' })
    const r = await callErp('register', !!c.duplicate)
    if (!r.ok) { setAutoState({ ...c, phase: 'error', error: r.error, detail: r.unknown || r.issues }); return }
    setRegistered(r.record)
    setAutoState({ phase: 'done', record: r.record })
  }

  function flash(t) {
    setToast(t)
    setTimeout(() => setToast(''), 2000)
  }

  // ── 인원별 관리: 이번 발송에서 빼기 / 수정 / 삭제 ──
  async function toggleSkip(name) {
    const next = skipSet.has(name) ? skipNames.filter(n => n !== name) : [...skipNames, name]
    setSkips(s => ({ ...s, [regKind]: next }))
    setAutoState({ phase: 'idle' })
    const key = `erp_skip_${regKind}_${month}`
    const { error } = next.length
      ? await supabase.from('settings').upsert({ key, value: JSON.stringify(next) })
      : await supabase.from('settings').delete().eq('key', key)
    if (error) { alert('저장 실패: ' + error.message); load(month) }
  }

  async function deletePerson(name) {
    const mine = rows.filter(r => r.values[2] === name && r.assignId)
    if (!mine.length) { alert('무상제품은 앰버서더가 직접 신청한 거라 여기서 삭제할 수 없어요. [이번 발송에서 빼기]를 써주세요.'); return }
    const label = typeFilter === 'new' ? '신제품' : '광고제품'
    if (!confirm(`${name}님의 ${label} 배정 ${mine.length}건을 삭제할까요?\n(${mine.map(r => r.productName).join(', ')})\n\n사람별 배정에서도 지워져요.${mine.length < rows.filter(r => r.values[2] === name).length ? '\n무상제품은 그대로 남아요.' : ''}`)) return
    const { error } = await supabase.from('ad_assignments').delete().in('id', mine.map(r => r.assignId))
    if (error) { alert('삭제 실패: ' + error.message); return }
    setAutoState({ phase: 'idle' })
    flash(`${name}님 ${label} 배정을 삭제했어요`)
    load(month)
  }

  function download() {
    if (!canExport) return
    const wb = makeErpWorkbook(XLSX, exportRows)
    XLSX.writeFile(wb, `ERP배송주문_삼대오백_${month}_발송${shipDate}_${people}명_${exportRows.length}행.xlsx`)
    flash('ERP 업로드 파일을 다운로드했어요')
  }

  async function markRegistered() {
    const value = { date: shipDate, memo, rows: exportRows.length, people, at: new Date().toISOString() }
    const { error } = await supabase.from('settings').upsert({ key: regKey(month), value: JSON.stringify(value) })
    if (error) { alert('저장 실패: ' + error.message); return }
    setRegistered(value)
    flash('ERP 등록 완료로 표시했어요')
  }

  async function unmarkRegistered() {
    if (!confirm('ERP 등록 완료 표시를 취소할까요?')) return
    await supabase.from('settings').delete().eq('key', regKey(month))
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
          desc={`${monthLabel(month)} 무상 + 광고제품을 오아 ERP 배송주문으로 바로 등록해요.`}
        />

        {registered && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-6 flex flex-wrap items-center gap-3">
            <span className="text-green-700 font-semibold">✓ {monthLabel(month)} {typeFilter === 'new' ? '신제품 ' : ''}ERP 등록 완료</span>
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
                <button key={k} onClick={() => { setTypeFilter(k); setAutoState({ phase: 'idle' }) }} className={chip(typeFilter === k)}>{l}</button>
              ))}
              <span className="w-px h-6 bg-gray-200 mx-1" />
              <button onClick={() => { setTypeFilter('new'); setAutoState({ phase: 'idle' }) }} className={`px-4 py-2 rounded-full text-sm font-semibold ${typeFilter === 'new' ? 'bg-blue-600 text-white' : 'bg-white border border-blue-300 text-blue-700 hover:border-blue-500'}`}>신제품 (따로 등록){newCount ? ` ${newCount}` : ''}</button>
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
                <p className="font-semibold text-gray-700">ERP 업로드 파일 미리보기 {skipNames.filter(n => rows.some(r => r.values[2] === n)).length > 0 && <span className="ml-2 text-sm font-normal text-gray-500">· {personCount}명 중 <b className="text-gray-700">{skipNames.filter(n => rows.some(r => r.values[2] === n)).length}명 이번 발송 제외</b></span>}</p>
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
                        const name = r.values[2]
                        const bad = issueKeys.has(r.key)
                        const personSkipped = skipSet.has(name)
                        const skipped = (bad && skipIssues) || personSkipped
                        const first = firstRowOf.has(r.key)
                        const myRows = first ? rows.filter(x => x.values[2] === name) : []
                        const canDelete = myRows.some(x => x.assignId)
                        const btn = 'text-xs font-semibold rounded-md px-2.5 py-1 border bg-white'
                        return (
                          <Fragment key={r.key}>
                            {first && (
                              <tr className={`border-t-2 border-gray-200 ${personSkipped ? 'bg-gray-100' : 'bg-gray-50'}`}>
                                <td colSpan={9} className="px-3 py-1.5">
                                  <div className="flex items-center gap-2 sticky left-3 w-fit">
                                    <span className={`font-bold ${personSkipped ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{name}</span>
                                    <span className="text-xs text-gray-400 mr-2">제품 {myRows.length}개</span>
                                    {personSkipped ? (<>
                                      <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">이번 발송 제외</span>
                                      <button onClick={() => toggleSkip(name)} className={`${btn} border-green-300 text-green-700 hover:bg-green-50`}>다시 넣기</button>
                                    </>) : (<>
                                      <button onClick={() => toggleSkip(name)} className={`${btn} text-gray-600 hover:bg-gray-100`} title="이번 ERP 등록에서만 빼요 (배정은 그대로)">빼기</button>
                                      <button onClick={() => setEditPerson(name)} className={`${btn} text-gray-600 hover:bg-gray-100`}>수정</button>
                                      {canDelete && <button onClick={() => deletePerson(name)} className={`${btn} border-red-200 text-red-500 hover:bg-red-50`} title="광고·신제품 배정 삭제">삭제</button>}
                                    </>)}
                                  </div>
                                </td>
                              </tr>
                            )}
                            <tr className={`border-b border-gray-100 ${bad && !personSkipped ? 'bg-red-50/60' : ''} ${skipped ? 'opacity-40' : ''}`}>
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.type === 'ad' ? 'bg-orange-100 text-orange-700' : r.type === 'new' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{TYPE_LABEL[r.type]}</span>
                              </td>
                              {r.values.map((v, i) => (
                                <td key={i} className={`px-3 py-1.5 text-gray-700 ${i === 5 ? 'min-w-[260px]' : 'whitespace-nowrap'} ${skipped ? 'line-through' : ''}`}>{String(v ?? '')}</td>
                              ))}
                            </tr>
                          </Fragment>
                        )
                      })}
                      {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                        {typeFilter === 'new' ? (
                          <>
                            <p>{monthLabel(month)} 신제품을 받을 사람이 아직 없어요.</p>
                            <p className="text-sm mt-1">광고제품 · 가이드 › <b>사람별 배정</b>에서 신제품 칸을 고르면 여기에 나와요. (전체 보내려면 칸 위 [일괄 지정 / 전체 배정])</p>
                            <a href="/admin/ads?tab=assign" className="inline-block mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl">사람별 배정으로 가기</a>
                          </>
                        ) : `${monthLabel(month)} 신청·광고 배정 내역이 없어요.`}
                      </td></tr>}
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
              <input type="date" value={shipDate} onChange={e => { setShipDate(e.target.value); setAutoState({ phase: 'idle' }) }} className="w-full border rounded-xl px-4 py-2.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <p className="text-sm font-bold text-orange-600 mt-4 mb-2">승인 담당자</p>
              <div className="grid grid-cols-2 gap-2">
                {APPROVERS.map(a => (
                  <button key={a.email} type="button" onClick={() => { setApprover(a.email); setAutoState({ phase: 'idle' }) }}
                    className={`rounded-xl border-2 px-3 py-2 text-left ${approver === a.email ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="block font-bold">{a.name}</span>
                    <span className="block text-xs text-gray-500">{a.note}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-orange-300 p-5">
              <p className="text-sm font-bold text-orange-600 mb-3">STEP 2 · ERP에 바로 등록</p>
              {autoState.phase === 'done' ? (
                <div className="text-center py-2">
                  <p className="text-green-600 font-bold text-lg">✓ ERP 등록 완료</p>
                  <p className="text-sm text-gray-600 mt-1">주문번호 <b>{autoState.record.orderNumber || '(ERP 목록에서 확인)'}</b></p>
                  <p className="text-xs text-gray-400 mt-1">발송일 {autoState.record.date} · {autoState.record.people}명 · {autoState.record.rows}행{autoState.record.approvers?.length ? ` · 승인 ${autoState.record.approvers.join(', ')}` : ''}</p>
                  <a href={ERP_URL} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm text-orange-600 underline">ERP에서 보기 ↗</a>
                </div>
              ) : (
                <>
                  <button onClick={checkErp} disabled={!canExport || autoState.phase === 'checking' || autoState.phase === 'registering'} className="w-full border-2 border-gray-900 text-gray-900 hover:bg-gray-50 disabled:opacity-40 font-bold py-3 rounded-xl">
                    {autoState.phase === 'checking' ? 'ERP 확인 중…' : '① 등록 전 확인'}
                  </button>
                  <p className="text-xs text-gray-400 mt-1.5 mb-3">ERP 로그인 · 제품 매칭 · 중복 여부만 확인해요 (등록 안 함)</p>

                  {autoState.phase === 'error' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-sm text-red-600">
                      {autoState.error}
                      {/연결되지|권한/.test(autoState.error || '') && <a href="/admin?tab=settings" className="block mt-2 font-semibold underline">설정 › ERP 연결로 이동</a>}
                      {Array.isArray(autoState.detail) && autoState.detail.slice(0, 8).map((d, i) => <div key={i} className="text-xs mt-1">· {d.receiver || d.name} {d.sku || d.product} {d.problem || ''}</div>)}
                    </div>
                  )}

                  {(autoState.phase === 'checked' || autoState.phase === 'registering') && (
                    <div className="bg-gray-50 rounded-xl p-3 mb-3 text-sm space-y-1">
                      <p>✓ ERP 로그인 · 제품 {autoState.summary.lines}행 모두 매칭</p>
                      <p className="text-gray-600">{autoState.summary.people}명 · {autoState.summary.lines}행 · {autoState.summary.qty}개 · 발송일 <b>{autoState.shipDate}</b></p>
                      <p className="text-gray-600 break-keep">메모: {autoState.memo}</p>
                      <p className="text-gray-600">승인 담당자: <b>{(autoState.approverNames || []).join(', ')}</b></p>
                      {autoState.excluded?.length > 0 && (
                        <div className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                          <p className="font-semibold">이미 ERP에 등록된 {autoState.excluded.length}명은 제외했어요</p>
                          <p className="text-xs mt-0.5 break-keep">{autoState.excluded.map(e => e.name).join(', ')}</p>
                          <p className="text-xs text-amber-700/80 mt-0.5">({[...new Set(autoState.excluded.map(e => e.orderNumber))].join(', ')})</p>
                        </div>
                      )}
                      {autoState.duplicate && <p className="text-amber-700 font-semibold">⚠️ 이번 달 등록 기록이 이미 있어요 {autoState.duplicate.erp?.orderNumber ? `(${autoState.duplicate.erp.orderNumber})` : ''}</p>}
                    </div>
                  )}

                  <button onClick={registerErp} disabled={autoState.phase !== 'checked'} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl text-lg">
                    {autoState.phase === 'registering' ? 'ERP에 등록 중…' : '② ERP에 바로 등록'}
                  </button>
                  <p className="text-xs text-gray-400 mt-2">일반 배송 · 기타 배송 · 마케팅 · 택배 · 포항물류로 등록되고, 끝나면 자동으로 '등록 완료' 표시돼요.</p>
                </>
              )}
            </div>

            <div className="bg-white rounded-2xl border p-5">
              <button onClick={() => setShowManual(!showManual)} className="w-full flex items-center justify-between text-sm font-semibold text-gray-600">
                <span>직접 등록하기 (예비 · 파일 다운로드)</span><span>{showManual ? '접기 ▲' : '펼치기 ▼'}</span>
              </button>
            </div>

            {showManual && (<>
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

            </>)}

            {toast && <div className="bg-gray-900 text-white text-sm rounded-xl px-4 py-2 text-center">{toast}</div>}
          </div>
        </div>
      </div>
      {editPerson && (
        <EditPersonModal
          name={editPerson}
          rows={rows.filter(r => r.values[2] === editPerson)}
          itemMap={itemMap}
          onClose={() => setEditPerson(null)}
          onSaved={() => { setEditPerson(null); setAutoState({ phase: 'idle' }); flash(`${editPerson}님 수정 완료`); load(month) }}
        />
      )}
    </div>
  )
}

function EditPersonModal({ name, rows, itemMap, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(rows.filter(r => r.assignId).map(r => [r.assignId, { productId: r.productId, quantity: Number(r.values[1]) || 1 }])))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    for (const r of rows.filter(x => x.assignId)) {
      const d = draft[r.assignId]
      if (!d) continue
      if (d.productId === r.productId && d.quantity === (Number(r.values[1]) || 1)) continue
      const prod = itemMap[r.itemId]?.products.find(p => p.id === d.productId)
      const patch = { quantity: Math.max(1, Number(d.quantity) || 1) }
      if (prod) Object.assign(patch, { product_id: prod.id, product_name: prod.name, sku: (prod.sku || '').trim() })
      const { error } = await supabase.from('ad_assignments').update(patch).eq('id', r.assignId)
      if (error) { setSaving(false); alert('저장 실패: ' + error.message); return }
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-gray-900">{name}님 발송 제품 수정</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {rows.map(r => {
            const item = r.itemId ? itemMap[r.itemId] : null
            const d = r.assignId ? draft[r.assignId] : null
            const canPick = item && item.pick_mode === 'one' && item.products.length > 1
            return (
              <div key={r.key} className="border rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{TYPE_LABEL[r.type]}{r.itemTitle ? ` · ${r.itemTitle}` : ''}</p>
                {!r.assignId ? (
                  <p className="text-sm text-gray-700">{r.productName} <span className="text-xs text-gray-400">(앰버서더 신청 · 신청 현황에서 변경)</span></p>
                ) : (
                  <div className="flex items-center gap-2">
                    {canPick ? (
                      <select value={d.productId || ''} onChange={e => setDraft({ ...draft, [r.assignId]: { ...d, productId: e.target.value } })} className="flex-1 border rounded-lg px-2 py-1.5 text-sm">
                        {item.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : (
                      <p className="flex-1 text-sm text-gray-700">{r.productName}</p>
                    )}
                    <span className="text-xs text-gray-400">수량</span>
                    <input type="number" min={1} value={d.quantity} onChange={e => setDraft({ ...draft, [r.assignId]: { ...d, quantity: Math.max(1, Number(e.target.value) || 1) } })} className="w-16 border rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold">{saving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}
