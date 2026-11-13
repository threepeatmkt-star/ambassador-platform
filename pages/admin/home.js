import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../../lib/useAdminAuth'
import { useAdminMonth, monthLabel } from '../../lib/useAdminMonth'
import AdminNav from '../../components/AdminNav'
import PageHeader, { StatCards } from '../../components/PageHeader'

function daysLeft(deadline) {
  if (!deadline) return null
  const end = new Date(deadline + 'T23:59:59')
  const now = new Date()
  return Math.ceil((end - now) / 86400000)
}

export default function AdminHome() {
  const { session, loading: authLoading, logout } = useAdminAuth()
  const router = useRouter()
  const [month, setMonth] = useAdminMonth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ roster: [], applied: [], items: [], assigns: [], deadline: '', settingsMonth: '' })
  const loadedFor = useRef('')

  useEffect(() => {
    if (session && month && loadedFor.current !== month) {
      loadedFor.current = month
      load(month)
    }
  }, [session, month])

  async function load(m) {
    setLoading(true)
    const [settingsRes, ambRes, appsRes, itemsRes, assignRes] = await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('ambassadors').select('real_name, instagram'),
      supabase.from('applications').select('real_name').eq('month', m),
      supabase.from('ad_items').select('id, title, sort_order').eq('month', m).order('sort_order'),
      supabase.from('ad_assignments').select('real_name, item_id').eq('month', m),
    ])
    setData({
      roster: (ambRes.data || []).map(a => a.real_name).sort((a, b) => a.localeCompare(b, 'ko')),
      applied: (appsRes.data || []).map(a => a.real_name),
      items: itemsRes.data || [],
      assigns: assignRes.data || [],
      deadline: settingsRes.data?.find(r => r.key === 'deadline')?.value || '',
      settingsMonth: settingsRes.data?.find(r => r.key === 'current_month')?.value || '',
    })
    setLoading(false)
  }

  if (authLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>
  if (!session) return null

  const { roster, applied, items, assigns, deadline, settingsMonth } = data
  const appliedSet = new Set(applied)
  const adPeople = new Set(assigns.map(a => a.real_name))
  const notApplied = roster.filter(n => !appliedSet.has(n))
  const noAd = roster.filter(n => !adPeople.has(n))
  const isOpenMonth = month === settingsMonth
  const dl = isOpenMonth ? daysLeft(deadline) : null
  const perItem = items.map(i => ({ ...i, people: new Set(assigns.filter(a => a.item_id === i.id).map(a => a.real_name)).size }))

  const go = href => router.push(href)

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>홈 | 삼대오백 앰버서더 허브</title></Head>
      <AdminNav active="home" onLogout={logout} month={month} onMonthChange={setMonth} />

      <div className="max-w-7xl mx-auto px-8 py-8">
        <PageHeader
          title={`${monthLabel(month)} 진행 현황`}
          desc="이번 달 할 일을 한눈에 확인하세요. 카드를 누르면 해당 화면으로 이동해요."
          actions={<button onClick={() => go('/admin?tab=applications')} className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl">엑셀 다운로드하러 가기</button>}
        />

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : (
          <>
            {!isOpenMonth && settingsMonth && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-6 text-amber-800">
                지금 앰버서더 신청 페이지는 <b>{monthLabel(settingsMonth)}</b> 기준이에요. 다른 달을 보고 계세요. (신청 월 변경은 설정에서)
              </div>
            )}

            <StatCards items={[
              { label: '무상제품 신청', value: `${applied.length} / ${roster.length}`, unit: '명', color: notApplied.length ? 'text-gray-900' : 'text-green-600', sub: notApplied.length ? `미신청 ${notApplied.length}명` : '모두 신청 완료', onClick: () => go('/admin?tab=applications') },
              { label: '광고제품 배정', value: `${adPeople.size} / ${roster.length}`, unit: '명', color: 'text-orange-600', sub: `광고제품 ${items.length}개`, onClick: () => go('/admin/ads?tab=assign') },
              { label: '광고 가이드', value: items.length, unit: '개', sub: items.length ? '가이드 발송 목록 보기' : '광고제품을 등록하세요', onClick: () => go(items.length ? '/admin/ads?tab=send' : '/admin/ads') },
              { label: '신청 마감', value: !isOpenMonth ? '-' : dl === null ? '미설정' : dl < 0 ? '마감' : dl === 0 ? 'D-DAY' : `D-${dl}`, color: dl !== null && dl <= 3 && dl >= 0 ? 'text-red-500' : 'text-gray-900', sub: isOpenMonth && deadline ? deadline : '설정에서 변경', onClick: () => go('/admin?tab=settings') },
            ]} />

            <div className="grid lg:grid-cols-2 gap-6">
              <section className="bg-white rounded-2xl border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">할 일</h2>
                </div>
                <div className="space-y-5">
                  <TodoRow
                    title="무상제품 미신청"
                    count={notApplied.length}
                    names={notApplied}
                    doneText="모두 신청했어요"
                    action="신청 현황 보기"
                    onAction={() => go('/admin?tab=applications&filter=notApplied')}
                  />
                  <TodoRow
                    title="광고제품 미배정"
                    count={noAd.length}
                    names={noAd}
                    doneText="모두 배정했어요"
                    action="배정하러 가기"
                    onAction={() => go('/admin/ads?tab=assign&filter=noAd')}
                    tone="orange"
                  />
                </div>
              </section>

              <section className="bg-white rounded-2xl border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">{monthLabel(month)} 광고제품</h2>
                  <button onClick={() => go('/admin/ads')} className="text-sm text-orange-600 font-semibold">관리 →</button>
                </div>
                {perItem.length === 0 ? (
                  <p className="text-gray-400 py-6 text-center">등록된 광고제품이 없어요.</p>
                ) : (
                  <div className="divide-y">
                    {perItem.map(i => (
                      <div key={i.id} className="py-3 flex items-center justify-between gap-4">
                        <p className="font-medium text-gray-800 leading-snug">📦 {i.title}</p>
                        <span className={`flex-shrink-0 text-sm font-semibold px-3 py-1 rounded-full ${i.people ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-400'}`}>{i.people}명</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TodoRow({ title, count, names, doneText, action, onAction, tone }) {
  const [open, setOpen] = useState(false)
  const shown = open ? names : names.slice(0, 12)
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-gray-800">
          {title} <span className={count ? (tone === 'orange' ? 'text-orange-600' : 'text-red-500') : 'text-green-600'}>{count}명</span>
        </p>
        {count > 0 && <button onClick={onAction} className="text-sm border rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50">{action}</button>}
      </div>
      {count === 0 ? (
        <p className="text-sm text-green-600">✓ {doneText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {shown.map(n => <span key={n} className="bg-gray-100 text-gray-700 text-sm rounded-full px-3 py-1">{n}</span>)}
          {names.length > 12 && (
            <button onClick={() => setOpen(!open)} className="text-sm text-gray-500 px-2">{open ? '접기' : `+${names.length - 12}명 더보기`}</button>
          )}
        </div>
      )}
    </div>
  )
}
