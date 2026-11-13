import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminNav from '../../components/AdminNav'
import PageHeader, { StatCards } from '../../components/PageHeader'
import { useAdminMonth, monthLabel } from '../../lib/useAdminMonth'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../../lib/useAdminAuth'
import Head from 'next/head'
import * as XLSX from 'xlsx'
import { groupByAmbassador, buildErpRows, makeErpSheet, fetchAdAssignments, monthsBetween } from '../../lib/erp'

export default function AdminDashboard() {
  const { session, loading: authLoading, logout } = useAdminAuth()
  const router = useRouter()

  const [applications, setApplications] = useState([])
  const [ambassadors, setAmbassadors] = useState([])
  const [currentMonth, setCurrentMonth] = useAdminMonth() // 상단 '기준 월' (모든 화면 공통)
  const [settingsMonth, setSettingsMonth] = useState('') // 앰버서더 신청 페이지의 신청 월
  const [search, setSearch] = useState('')
  const [rowFilter, setRowFilter] = useState('all') // all | notApplied | noAd
  const [deadline, setDeadline] = useState('')
  const [deadlineInput, setDeadlineInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('applications')
  const [savingDeadline, setSavingDeadline] = useState(false)
  const [newMonth, setNewMonth] = useState('')
  const [lastUploaded, setLastUploaded] = useState('')
  const [filterMode, setFilterMode] = useState('month') // 'month' | 'range'
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rangeApplications, setRangeApplications] = useState([])
  const [rangeLoading, setRangeLoading] = useState(false)
  const [adAssignments, setAdAssignments] = useState([])
  const [rangeAdAssignments, setRangeAdAssignments] = useState([])

  useEffect(() => {
    if (session) loadData()
  }, [session])

  // 기준 월이 정해지거나 바뀌면 그 달 신청·광고 배정 불러오기
  useEffect(() => {
    if (session && currentMonth) loadMonthData(currentMonth).then(() => setLoading(false))
  }, [session, currentMonth])

  // 상단 메뉴(/admin?tab=...)로 탭 이동, 탭 없이 /admin 으로 오면 홈으로
  useEffect(() => {
    if (!router.isReady) return
    const q = router.query.tab
    if (q === 'applications' || q === 'ambassadors' || q === 'settings') setTab(q)
    else router.replace('/admin/home')
    const f = router.query.filter
    if (f === 'notApplied' || f === 'noAd') setRowFilter(f)
  }, [router.isReady, router.query.tab, router.query.filter])

  async function loadData() {
    const [settingsRes, ambassadorsRes] = await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('ambassadors').select('*'),
    ])
    if (settingsRes.data) {
      const dl = settingsRes.data.find(r => r.key === 'deadline')?.value || ''
      const month = settingsRes.data.find(r => r.key === 'current_month')?.value || ''
      const ul = settingsRes.data.find(r => r.key === 'last_ambassador_upload')?.value || ''
      if (ul) setLastUploaded(ul)
      setDeadline(dl)
      setDeadlineInput(dl)
      setSettingsMonth(month)
      setNewMonth(month)
    }
    if (ambassadorsRes.data) setAmbassadors(ambassadorsRes.data)
  }

  async function loadMonthData(month) {
    const { data: apps } = await supabase
      .from('applications')
      .select(`
        id, month, real_name, submitted_at,
        product1:products!applications_product1_id_fkey(id, name, sku),
        product2:products!applications_product2_id_fkey(id, name, sku)
      `)
      .eq('month', month)
      .order('submitted_at', { ascending: false })
    if (apps) setApplications(apps)
    const { data: ads } = await fetchAdAssignments(supabase, month)
    setAdAssignments(ads)
  }

  async function loadRangeData(from, to) {
    if (!from || !to) return
    setRangeLoading(true)
    const { data: apps } = await supabase
      .from('applications')
      .select(`
        id, month, real_name, submitted_at,
        product1:products!applications_product1_id_fkey(id, name, sku),
        product2:products!applications_product2_id_fkey(id, name, sku)
      `)
      .gte('submitted_at', from + 'T00:00:00')
      .lte('submitted_at', to + 'T23:59:59')
      .order('submitted_at', { ascending: false })
    if (apps) setRangeApplications(apps)
    const { data: ads } = await fetchAdAssignments(supabase, monthsBetween(from, to))
    setRangeAdAssignments(ads)
    setRangeLoading(false)
  }

  async function saveDeadline() {
    setSavingDeadline(true)
    await supabase.from('settings').upsert({ key: 'deadline', value: deadlineInput })
    setDeadline(deadlineInput)
    setSavingDeadline(false)
    alert('마감일이 저장되었습니다.')
  }

  async function saveMonth() {
    await supabase.from('settings').upsert({ key: 'current_month', value: newMonth })
    setSettingsMonth(newMonth)
    setCurrentMonth(newMonth)
    alert(`신청 월이 ${newMonth}로 변경되었습니다. 상단 기준 월도 ${newMonth}로 바뀌었어요.`)
  }

  function getAmbassadorInfo(realName) {
    return ambassadors.find(a => a.real_name === realName) || {}
  }

  function exportExcel() {
    const targetApps = filterMode === 'range' ? rangeApplications : applications
    const targetAds = filterMode === 'range' ? rangeAdAssignments : adAssignments
    const label = filterMode === 'range' ? `${dateFrom}~${dateTo}` : currentMonth
    const groups = groupByAmbassador([...targetApps].reverse(), targetAds)
    const byName = new Map(groups.map(g => [g.name, g]))
    const appByName = new Map(targetApps.map(a => [a.real_name, a]))
    const join = (list, key) => list.map(x => x[key]).filter(Boolean).join('\n')

    // ── 시트1: 신청내역 (앰버서더별 무상 + 광고) ──
    const names = [...groups.map(g => g.name), ...ambassadors.map(a => a.real_name).filter(n => !byName.has(n))]
    const rows = names.map(name => {
      const amb = getAmbassadorInfo(name)
      const g = byName.get(name) || { free: [], ad: [] }
      const app = appByName.get(name)
      return {
        '인스타그램': amb.instagram ? `@${amb.instagram}` : '',
        '본명': name,
        '연락처': amb.phone || '',
        '우편번호': amb.zipcode || '',
        '주소': amb.address || '',
        '무상제품1': app ? (app.product1?.name || '') : '미신청',
        '무상제품1 전산명': app?.product1?.sku?.trim() || '',
        '무상제품2': app ? (app.product2?.name || '') : '미신청',
        '무상제품2 전산명': app?.product2?.sku?.trim() || '',
        '광고제품': join(g.ad, 'name'),
        '광고제품 전산명': join(g.ad, 'sku'),
        '광고 가이드': [...new Set(g.ad.map(p => p.item_title).filter(Boolean))].join('\n'),
        '신청일시': app ? new Date(app.submitted_at).toLocaleString('ko-KR') : '',
      }
    })

    // ── 시트2: ERP 배송주문 (오아 ERP 업로드 양식 그대로, 제품 1개 = 1행, 무상+광고) ──
    const { rows: erpRows } = buildErpRows(groups, ambassadors)

    // ── 시트3: 요약VER (반복 브랜드명 제거) ──
    const stripBrand = (name) => {
      if (!name) return ''
      return name
        .replace(/삼대오백/g, '')
        .replace(/SAMDAE500/gi, '')
        .trim()
    }
    const summaryRows = groups.map(g => {
      const amb = getAmbassadorInfo(g.name)
      return {
        '인스타그램': amb.instagram ? `@${amb.instagram}` : '',
        '본명': g.name,
        '무상제품 (2개)': g.free.map(p => stripBrand(p.name)).filter(Boolean).join(', ') || '미신청',
        '광고제품': g.ad.map(p => stripBrand(p.name)).filter(Boolean).join(', '),
      }
    })

    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(rows)
    ws1['!cols'] = [14, 8, 13, 8, 50, 30, 26, 30, 26, 32, 30, 34, 20].map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws1, '신청내역')
    XLSX.utils.book_append_sheet(wb, makeErpSheet(XLSX, erpRows), 'ERP 배송주문')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), '요약VER')
    XLSX.writeFile(wb, `삼대오백_앰버서더_${label}_무상+광고제품.xlsx`)
  }

  async function handleCancel(app) {
    if (!confirm(`${app.real_name}님의 신청을 취소하시겠습니까?\n취소하면 해당 앰버서더가 다시 신청할 수 있습니다.`)) return
    const { error } = await supabase.from('applications').delete().eq('id', app.id)
    if (error) { alert('취소 중 오류가 발생했습니다.'); return }
    await loadMonthData(currentMonth)
  }

  const isRange = filterMode === 'range'
  const displayApplications = isRange ? rangeApplications : applications
  const displayAds = isRange ? rangeAdAssignments : adAssignments
  const submittedCount = applications.length
  const totalCount = ambassadors.length
  const adNames = new Set(adAssignments.map(a => a.real_name))
  const notSubmittedCount = ambassadors.filter(a => !applications.find(app => app.real_name === a.real_name)).length

  // 표 한 줄 = 앰버서더 1명 (신청자 + 기준 월 보기에서는 미신청자도 회색으로)
  const appRows = displayApplications.map(app => ({ name: app.real_name, app }))
  const missingRows = isRange ? [] : ambassadors
    .filter(a => !applications.find(app => app.real_name === a.real_name))
    .map(a => ({ name: a.real_name, app: null }))
  const q = search.trim().toLowerCase()
  const rows = [...appRows, ...missingRows].filter(r => {
    if (rowFilter === 'notApplied' && r.app) return false
    if (rowFilter === 'noAd' && displayAds.some(a => a.real_name === r.name)) return false
    if (!q) return true
    const amb = getAmbassadorInfo(r.name)
    return r.name.toLowerCase().includes(q) || String(amb.instagram || '').toLowerCase().includes(q)
  })
  const countNotApplied = isRange ? 0 : missingRows.length
  const countNoAd = [...appRows, ...missingRows].filter(r => !displayAds.some(a => a.real_name === r.name)).length

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>
  }

  if (!session) return null

  const input = 'border rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400'
  const chip = on => `px-4 py-2 rounded-full text-sm font-semibold transition ${on ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600 hover:border-gray-400'}`

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>어드민 | 삼대오백 앰버서더</title></Head>

      <AdminNav active={tab} onLogout={logout} month={currentMonth} onMonthChange={m => { setFilterMode('month'); setCurrentMonth(m) }} />

      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* ===== 신청 현황 ===== */}
        {tab === 'applications' && (
          <div>
            <PageHeader
              title="신청 현황"
              desc={isRange ? `${dateFrom || '시작일'} ~ ${dateTo || '종료일'} 신청 내역` : `${monthLabel(currentMonth)} · 앰버서더별 무상제품 신청과 광고제품 배정`}
              actions={
                <button onClick={exportExcel} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  엑셀 다운로드
                </button>
              }
            />

            {!isRange && (
              <StatCards items={[
                { label: '무상 신청 완료', value: submittedCount, unit: '명', color: 'text-green-600', onClick: () => setRowFilter('all') },
                { label: '무상 미신청', value: notSubmittedCount, unit: '명', color: notSubmittedCount ? 'text-red-500' : 'text-gray-900', onClick: () => setRowFilter('notApplied') },
                { label: '광고제품 배정', value: adNames.size, unit: '명', color: 'text-orange-600', onClick: () => setRowFilter('all') },
                { label: '전체 앰버서더', value: totalCount, unit: '명' },
              ]} />
            )}

            {/* 보기 방식 · 검색 · 필터 */}
            <div className="bg-white rounded-2xl border p-5 mb-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  <button onClick={() => setFilterMode('month')} className={`px-4 py-2 rounded-lg font-semibold ${!isRange ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>기준 월</button>
                  <button onClick={() => setFilterMode('range')} className={`px-4 py-2 rounded-lg font-semibold ${isRange ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>기간 설정</button>
                </div>
                {!isRange ? (
                  <span className="text-gray-500">상단 <b className="text-orange-600">기준 월 {monthLabel(currentMonth)}</b> 내역을 보고 있어요</span>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={input} />
                    <span className="text-gray-400">~</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={input} />
                    <button onClick={() => loadRangeData(dateFrom, dateTo)} disabled={!dateFrom || !dateTo} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-xl">조회</button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 · 인스타그램 검색" className={`${input} w-64`} />
                <button onClick={() => setRowFilter('all')} className={chip(rowFilter === 'all')}>전체</button>
                {!isRange && <button onClick={() => setRowFilter('notApplied')} className={chip(rowFilter === 'notApplied')}>무상 미신청만 {countNotApplied}</button>}
                <button onClick={() => setRowFilter('noAd')} className={chip(rowFilter === 'noAd')}>광고 미배정만 {countNoAd}</button>
                <span className="text-sm text-gray-400 ml-auto">{rows.length}명 표시</span>
              </div>
            </div>

            {(loading || rangeLoading) ? (
              <div className="text-center py-16 text-gray-400">불러오는 중...</div>
            ) : isRange && !rangeApplications.length && !(dateFrom && dateTo) ? (
              <div className="bg-white rounded-2xl border text-center py-14 text-gray-400">조회 기간을 정하고 [조회]를 눌러주세요.</div>
            ) : (
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50 text-sm">
                        <th className="px-5 py-3 text-left text-gray-500 font-semibold">앰버서더</th>
                        <th className="px-5 py-3 text-left text-gray-500 font-semibold min-w-[200px]">무상제품 1</th>
                        <th className="px-5 py-3 text-left text-gray-500 font-semibold min-w-[200px]">무상제품 2</th>
                        <th className="px-5 py-3 text-left text-orange-600 font-semibold min-w-[240px]">광고제품</th>
                        <th className="px-5 py-3 text-left text-gray-500 font-semibold">연락처</th>
                        <th className="px-5 py-3 text-left text-gray-500 font-semibold whitespace-nowrap">신청일시</th>
                        <th className="px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ name, app }) => {
                        const amb = getAmbassadorInfo(name)
                        const ads = displayAds.filter(a => a.real_name === name)
                        return (
                          <tr key={app?.id || 'x-' + name} className={`border-b last:border-b-0 ${app ? '' : 'bg-gray-50/70'}`}>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <p className={`font-semibold ${app ? 'text-gray-900' : 'text-gray-400'}`}>{name}</p>
                              {amb.instagram && <p className="text-xs text-gray-400">@{amb.instagram}</p>}
                            </td>
                            {app ? (
                              [app.product1, app.product2].map((p, j) => (
                                <td key={j} className="px-5 py-3.5 text-gray-800 text-[0.95rem] leading-snug">
                                  <div>{p?.name}</div>
                                  {p?.sku && <div className="text-xs text-gray-400 mt-0.5">{p.sku}</div>}
                                </td>
                              ))
                            ) : (
                              <td colSpan={2} className="px-5 py-3.5"><span className="text-sm font-semibold text-red-500 bg-red-50 rounded-full px-3 py-1">무상 미신청</span></td>
                            )}
                            <td className="px-5 py-3.5 text-[0.95rem] leading-snug">
                              {ads.length ? ads.map((a, j) => <div key={j} className="text-orange-700">{a.product?.name || a.product_name}{a.quantity > 1 ? ` ×${a.quantity}` : ''}</div>) : <span className="text-sm text-gray-300">-</span>}
                            </td>
                            <td className="px-5 py-3.5 text-gray-500 text-sm whitespace-nowrap">{amb.phone || '-'}</td>
                            <td className="px-5 py-3.5 text-gray-400 text-sm whitespace-nowrap">{app ? new Date(app.submitted_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</td>
                            <td className="px-5 py-3.5 text-right">
                              {app && !isRange && (
                                <button onClick={() => handleCancel(app)} className="text-sm text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 whitespace-nowrap">신청 취소</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {rows.length === 0 && (
                        <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">조건에 맞는 앰버서더가 없어요.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== 설정 탭 ===== */}
        {tab === 'settings' && (
          <div>
          <PageHeader title="설정" desc="앰버서더 신청 페이지의 신청 월·마감일과 매월 루틴" />
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">신청 마감일 설정</h3>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={deadlineInput}
                  onChange={e => setDeadlineInput(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button
                  onClick={saveDeadline}
                  disabled={savingDeadline}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  저장
                </button>
              </div>
              {deadline && <p className="mt-2 text-gray-400 text-xs">현재: {deadline}</p>}
            </div>

            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">신청 월 설정</h3>
              <p className="text-gray-500 text-xs mb-3">앰버서더 플랫폼에 표시될 신청 월을 설정합니다.</p>
              <div className="flex gap-3">
                <input
                  type="month"
                  value={newMonth}
                  onChange={e => setNewMonth(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button
                  onClick={saveMonth}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  변경
                </button>
              </div>
              {settingsMonth && <p className="mt-2 text-gray-500 text-sm">현재 신청 월: <b>{settingsMonth}</b></p>}
            </div>

            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-2">앰버서더 플랫폼 URL</h3>
              <p className="text-gray-500 text-xs mb-3">아래 URL을 앰버서더들에게 DM으로 발송하세요.</p>
              <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm text-gray-700 break-all">
                {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app'}
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📋</span>
                <h3 className="font-bold text-orange-900">매월 루틴 권장 프로세스</h3>
              </div>
              <div className="space-y-3">
                {[
                  { step: '01', title: '신청 월 변경', desc: '설정 탭에서 신청 월을 해당 월로 먼저 변경하세요. URL 발송 전에 반드시 완료해야 데이터가 정확하게 분류됩니다.', point: '⚠️ URL 발송 전 필수', pointColor: 'text-red-500' },
                  { step: '02', title: '마감일 변경', desc: '신청 마감일을 해당 월 기준으로 설정하세요. 마감일이 지나면 앰버서더 신청 페이지가 자동으로 닫힙니다.', point: '', pointColor: '' },
                  { step: '03', title: '제품 DB 업데이트', desc: '재고가 없는 제품은 숨김 처리하고, 신규 제품은 추가하세요.', point: '→ 제품 관리 탭에서 진행', pointColor: 'text-orange-600' },
                  { step: '04', title: '앰버서더 명단 업데이트', desc: '신규 앰버서더 추가 또는 제외 인원 반영 후 엑셀 재업로드하세요.', point: '→ 앰버서더 명단 탭에서 진행', pointColor: 'text-orange-600' },
                  { step: '05', title: 'URL 발송', desc: '위 설정이 모두 완료된 후, 앰버서더들에게 플랫폼 URL을 DM으로 발송하세요.', point: '', pointColor: '' },
                  { step: '06', title: '마감 후 엑셀 다운로드', desc: '마감일 이후 신청현황 탭에서 엑셀을 다운로드하세요. 전산명과 배송정보가 자동으로 매핑되어 저장됩니다.', point: '→ 신청현황 탭에서 진행', pointColor: 'text-orange-600' },
                ].map(({ step, title, desc, point, pointColor }) => (
                  <div key={step} className="flex gap-4 bg-white rounded-xl p-4 border border-orange-100">
                    <div className="w-8 h-8 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm mb-0.5">{title}</p>
                      <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                      {point && <p className={`text-xs font-medium mt-1 ${pointColor}`}>{point}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ===== 앰버서더 명단 탭 ===== */}
        {tab === 'ambassadors' && (
          <div>
            <PageHeader
              title="앰버서더 명단"
              desc={`총 ${ambassadors.length}명${lastUploaded ? ` · 최신 업데이트 ${new Date(lastUploaded).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}`}
              actions={
                <a href="/admin/ambassadors-upload" className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  엑셀로 업로드
                </a>
              }
            />
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-3 text-left text-gray-500 font-medium">본명</th>
                      <th className="px-4 py-3 text-left text-gray-500 font-medium">인스타그램</th>
                      <th className="px-4 py-3 text-left text-gray-500 font-medium">연락처</th>
                      <th className="px-4 py-3 text-left text-gray-500 font-medium">주소</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambassadors.map((amb, i) => (
                      <tr key={amb.id} className={`border-b last:border-b-0 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{amb.real_name}</td>
                        <td className="px-4 py-3 text-gray-500">@{amb.instagram || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{amb.phone || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{amb.address} {amb.address_detail}</td>
                      </tr>
                    ))}
                    {ambassadors.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">앰버서더 데이터가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
