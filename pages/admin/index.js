import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../../lib/useAdminAuth'
import Head from 'next/head'
import * as XLSX from 'xlsx'
import { groupByAmbassador, buildErpRows, makeErpSheet, fetchAdAssignments, monthsBetween } from '../../lib/erp'

export default function AdminDashboard() {
  const { session, loading: authLoading, logout } = useAdminAuth()

  const [applications, setApplications] = useState([])
  const [ambassadors, setAmbassadors] = useState([])
  const [currentMonth, setCurrentMonth] = useState('')
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

  async function loadData() {
    setLoading(true)
    const [settingsRes, ambassadorsRes] = await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('ambassadors').select('*'),
    ])

    let month = ''
    if (settingsRes.data) {
      const dl = settingsRes.data.find(r => r.key === 'deadline')?.value || ''
      month = settingsRes.data.find(r => r.key === 'current_month')?.value || ''
      const ul = settingsRes.data.find(r => r.key === 'last_ambassador_upload')?.value || ''
      if (ul) setLastUploaded(ul)
      setDeadline(dl)
      setDeadlineInput(dl)
      setCurrentMonth(month)
      setNewMonth(month)
    }

    if (ambassadorsRes.data) setAmbassadors(ambassadorsRes.data)

    if (month) {
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

    setLoading(false)
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
    setCurrentMonth(newMonth)
    await loadMonthData(newMonth)
    alert(`${newMonth}월로 변경되었습니다.`)
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

  const displayApplications = filterMode === 'range' ? rangeApplications : applications
  const submittedCount = displayApplications.length
  const totalCount = ambassadors.length
  const notSubmitted = ambassadors.filter(a => !applications.find(app => app.real_name === a.real_name))

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">로딩 중...</p></div>
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>어드민 | 삼대오백 앰버서더</title></Head>

      {/* Header */}
      <header className="bg-white border-b px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-orange-500 font-bold text-lg">삼대오백 앰버서더 허브</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-600 text-sm">어드민 대시보드</span>
        </div>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          로그아웃
        </button>
      </header>

      {/* Tab nav */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-0">
          {[['applications', '신청 현황'], ['settings', '설정'], ['ambassadors', '앰버서더 명단']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
          <Link
            href="/admin/products"
            className="px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            제품 DB 관리
          </Link>
          <Link
            href="/admin/ads"
            className="px-4 py-3 text-sm font-medium border-b-2 border-transparent text-orange-500 hover:text-orange-600 flex items-center gap-1.5 transition-colors"
          >
            광고제품 · 가이드
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ===== 신청 현황 탭 ===== */}
        {tab === 'applications' && (
          <div>
            {/* 통계 카드 */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                ['신청 완료', submittedCount, 'text-green-600'],
                ['미신청', totalCount - submittedCount, 'text-red-500'],
                ['전체 앰버서더', totalCount, 'text-gray-900'],
              ].map(([label, value, color]) => (
                <div key={label} className="bg-white rounded-xl border p-5">
                  <p className="text-gray-500 text-xs mb-1">{label}</p>
                  <p className={`text-3xl font-bold ${color}`}>{value}<span className="text-base font-normal text-gray-400 ml-1">명</span></p>
                </div>
              ))}
            </div>

            {/* 필터 모드 탭 + 엑셀 다운로드 */}
            <div className="bg-white rounded-xl border p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setFilterMode('month')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    월별
                  </button>
                  <button
                    onClick={() => setFilterMode('range')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'range' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    기간설정
                  </button>
                </div>
                <button
                  onClick={exportExcel}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  엑셀 다운로드
                </button>
              </div>

              {filterMode === 'month' && (
                <div className="flex items-center gap-2">
                  <select
                    value={currentMonth}
                    onChange={e => { setCurrentMonth(e.target.value); loadMonthData(e.target.value) }}
                    className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {Array.from({ length: 15 }, (_, i) => {
                      const d = new Date()
                      d.setMonth(d.getMonth() - 12 + i + 1)
                      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                      return <option key={val} value={val}>{val}</option>
                    }).reverse()}
                  </select>
                  <span className="text-gray-400 text-sm">기준으로 조회</span>
                </div>
              )}

              {filterMode === 'range' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <span className="text-gray-400 text-sm">~</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <button
                    onClick={() => loadRangeData(dateFrom, dateTo)}
                    disabled={!dateFrom || !dateTo}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                  >
                    조회
                  </button>
                  {rangeApplications.length > 0 && (
                    <span className="text-gray-400 text-xs">{rangeApplications.length}건 조회됨</span>
                  )}
                </div>
              )}
            </div>

            {(loading || rangeLoading) ? (
              <div className="text-center py-16 text-gray-400">불러오는 중...</div>
            ) : (
              <>
                {/* 신청 완료 목록 */}
                {filterMode === 'range' && !dateFrom && !dateTo && (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-sm">조회 기간을 설정하고 조회 버튼을 눌러주세요.</p>
                  </div>
                )}
                {(filterMode === 'month' || (filterMode === 'range' && (dateFrom || dateTo))) && (
                  <div className="bg-white rounded-xl border overflow-hidden mb-6">
                    <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
                      <h3 className="font-semibold text-gray-700 text-sm">신청 완료 ({submittedCount}명)</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50/50">
                            <th className="px-4 py-3 text-left text-gray-500 font-medium">본명</th>
                            <th className="px-4 py-3 text-left text-gray-500 font-medium">무상제품 1</th>
                            <th className="px-4 py-3 text-left text-gray-500 font-medium">무상제품 2</th>
                            <th className="px-4 py-3 text-left text-gray-500 font-medium">광고제품</th>
                            <th className="px-4 py-3 text-left text-gray-500 font-medium">연락처</th>
                            <th className="px-4 py-3 text-left text-gray-500 font-medium">신청일시</th>
                            <th className="px-4 py-3 text-left text-gray-500 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(filterMode === 'range' ? rangeApplications : applications).map((app, i) => {
                            const amb = getAmbassadorInfo(app.real_name)
                            return (
                              <tr key={app.id} className={`border-b last:border-b-0 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                <td className="px-4 py-3 font-medium text-gray-900">{app.real_name}</td>
                                <td className="px-4 py-3 text-gray-700">
                                  <div>{app.product1?.name}</div>
                                  {app.product1?.sku && <div className="text-xs text-gray-400">{app.product1.sku}</div>}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  <div>{app.product2?.name}</div>
                                  {app.product2?.sku && <div className="text-xs text-gray-400">{app.product2.sku}</div>}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {(filterMode === 'range' ? rangeAdAssignments : adAssignments).filter(a => a.real_name === app.real_name).map((a, j) => (
                                    <div key={j} className="text-orange-700">{a.product?.name || a.product_name}</div>
                                  ))}
                                </td>
                                <td className="px-4 py-3 text-gray-500">{amb.phone || '-'}</td>
                                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(app.submitted_at).toLocaleString('ko-KR')}</td>
                                <td className="px-4 py-3">
                                  <button onClick={() => handleCancel(app)} className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 transition-colors">
                                    신청 취소
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                          {(filterMode === 'range' ? rangeApplications : applications).length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">신청 내역이 없습니다.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 미신청 목록 */}
                {notSubmitted.length > 0 && (
                  <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="px-5 py-3 bg-red-50 border-b">
                      <h3 className="font-semibold text-red-600 text-sm">미신청 ({notSubmitted.length}명)</h3>
                    </div>
                    <div className="divide-y">
                      {notSubmitted.map(amb => (
                        <div key={amb.id} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-700 text-sm">{amb.real_name}</span>
                            {amb.instagram && <span className="text-gray-400 text-xs ml-2">@{amb.instagram}</span>}
                          </div>
                          <span className="text-xs text-gray-400">{amb.phone}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ===== 설정 탭 ===== */}
        {tab === 'settings' && (
          <div className="max-w-md space-y-6">
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
              {currentMonth && <p className="mt-2 text-gray-400 text-xs">현재: {currentMonth}</p>}
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
        )}

        {/* ===== 앰버서더 명단 탭 ===== */}
        {tab === 'ambassadors' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-700 text-sm font-medium">총 {ambassadors.length}명</p>
                {lastUploaded && (
                  <p className="text-gray-400 text-xs mt-0.5">최신 업데이트일: {new Date(lastUploaded).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                )}
              </div>
              <a
                href="/admin/ambassadors-upload"
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                엑셀로 업로드
              </a>
            </div>
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
                        <td className="px-4 py-3 font-medium text-gray-900">{amb.real_name}</td>
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
