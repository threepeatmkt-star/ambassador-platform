import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../../lib/useAdminAuth'
import { formatGuide, parseGuide, toLatestFormat, emptyItem, guideWarnings, monthNumber, normalizeHashtags, countHashtags, HASHTAG_COUNT, MAX_SELLING_POINTS } from '../../lib/guide'
import Head from 'next/head'
import Link from 'next/link'
import AdminNav from '../../components/AdminNav'
import * as XLSX from 'xlsx'

function monthOptions() {
  return Array.from({ length: 15 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - 12 + i + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }).reverse()
}

function prevMonth(month) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const ITEM_SELECT = 'id, month, title, pick_mode, links, topics, notices, selling_points, hashtags, sort_order, ad_item_products(product_id, quantity, sort_order, product:products(id, name, sku, is_active))'

function normalizeItem(row) {
  const products = (row.ad_item_products || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter(ip => ip.product)
    .map(ip => ({ ...ip.product, quantity: ip.quantity || 1 }))
  return { ...row, topics: Array.isArray(row.topics) ? row.topics : [], products }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

export default function AdminAds() {
  const { session, loading: authLoading, logout } = useAdminAuth()
  const [month, setMonth] = useState('')
  const [tab, setTab] = useState('items') // items | assign | send
  const [products, setProducts] = useState([])
  const [ambassadors, setAmbassadors] = useState([])
  const [appliedNames, setAppliedNames] = useState(new Set())
  const [freeByName, setFreeByName] = useState({}) // 이번 달 무상 신청 제품
  const [saveState, setSaveState] = useState('') // '' | saving | saved | error
  const saveQueue = useRef(Promise.resolve())
  const [items, setItems] = useState([])
  const [assign, setAssign] = useState({}) // `${name}|${itemId}` -> productId (one) | true (all)
  const [savedAssign, setSavedAssign] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editor, setEditor] = useState(null) // { id?, ...item, products: [] }
  const [nameFilter, setNameFilter] = useState('')
  const [library, setLibrary] = useState([]) // 전체 월의 지난 가이드 (보관함)

  const initRef = useRef(false)
  useEffect(() => {
    // 로그인 토큰이 갱신돼도 다시 불러오지 않음 (작성 중인 배정이 지워지지 않도록)
    if (session && !initRef.current) {
      initRef.current = true
      init()
    }
  }, [session])

  async function init() {
    const [settingsRes, productsRes, ambRes] = await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('products').select('id, name, sku, category1, category2, is_active').order('category1,category2,name'),
      supabase.from('ambassadors').select('real_name, instagram'),
    ])
    setProducts(productsRes.data || [])
    setAmbassadors((ambRes.data || []).sort((a, b) => a.real_name.localeCompare(b.real_name, 'ko')))
    const m = settingsRes.data?.find(r => r.key === 'current_month')?.value || monthOptions()[2]
    setMonth(m)
    await loadMonth(m)
  }

  async function loadMonth(m) {
    setLoading(true)
    setMsg('')
    const [itemsRes, assignRes, appsRes] = await Promise.all([
      supabase.from('ad_items').select(ITEM_SELECT).eq('month', m).order('sort_order').order('created_at'),
      supabase.from('ad_assignments').select('real_name, item_id, product_id').eq('month', m),
      supabase.from('applications').select('real_name, product1:products!applications_product1_id_fkey(name), product2:products!applications_product2_id_fkey(name)').eq('month', m),
    ])
    if (itemsRes.error) {
      setMsg('광고제품 테이블을 불러오지 못했어요. SQL(20261113000001_ad_products.sql)을 먼저 실행해주세요. (' + itemsRes.error.message + ')')
    }
    const list = (itemsRes.data || []).map(normalizeItem)
    const modeById = Object.fromEntries(list.map(i => [i.id, i.pick_mode]))
    const a = {}
    for (const r of assignRes.data || []) {
      const key = `${r.real_name}|${r.item_id}`
      a[key] = modeById[r.item_id] === 'all' ? true : r.product_id
    }
    const { data: lib } = await supabase.from('ad_items').select(ITEM_SELECT).order('month', { ascending: false }).order('sort_order')
    setLibrary((lib || []).map(normalizeItem))
    setItems(list)
    setAssign(a)
    setSavedAssign(a)
    setAppliedNames(new Set((appsRes.data || []).map(r => r.real_name)))
    setFreeByName(Object.fromEntries((appsRes.data || []).map(r => [r.real_name, [r.product1?.name, r.product2?.name].filter(Boolean)])))
    setLoading(false)
  }

  const dirty = false // 배정은 고르는 즉시 자동 저장

  function changeMonth(m) {
    if (dirty && !confirm('저장하지 않은 배정 변경사항이 있어요. 이동할까요?')) return
    setMonth(m)
    loadMonth(m)
  }

  // ───────── 광고제품(가이드) 편집 ─────────
  function openNew() {
    setEditor({ ...emptyItem(month), products: [], paste: '' })
  }

  function openEdit(item) {
    setEditor({ ...item, topics: item.topics.length ? item.topics : [{ title: '', body: '' }], products: [...item.products], paste: '' })
  }

  async function saveItem() {
    const e = editor
    if (!e.title.trim()) { alert('📦 제품 표시명을 입력해주세요.'); return }
    if (!e.products.length) { alert('연결할 제품을 1개 이상 선택해주세요. (출고 파일에 들어갈 제품)'); return }
    setSaving(true)
    const payload = {
      month,
      title: e.title.trim(),
      pick_mode: e.pick_mode,
      links: e.links,
      topics: e.topics.filter(t => t.title.trim() || t.body.trim()),
      notices: e.notices,
      selling_points: e.selling_points,
      hashtags: e.hashtags,
      sort_order: e.id ? e.sort_order : items.length,
      updated_at: new Date().toISOString(),
    }
    const res = e.id
      ? await supabase.from('ad_items').update(payload).eq('id', e.id).select().single()
      : await supabase.from('ad_items').insert(payload).select().single()
    if (res.error) { setSaving(false); alert('저장 실패: ' + res.error.message); return }
    const itemId = res.data.id

    await supabase.from('ad_item_products').delete().eq('item_id', itemId)
    const { error: linkErr } = await supabase.from('ad_item_products').insert(
      e.products.map((p, i) => ({ item_id: itemId, product_id: p.id, quantity: Math.max(1, Number(p.quantity) || 1), sort_order: i }))
    )
    if (linkErr) { setSaving(false); alert('제품 연결 저장 실패: ' + linkErr.message); return }

    // 기존 배정 정리: 연결 제품이 바뀐 경우 반영
    if (e.id) await resyncItemAssignments({ ...res.data, products: e.products })

    setSaving(false)
    setEditor(null)
    await loadMonth(month)
    setMsg(`'${payload.title}' 저장 완료`)
  }

  async function resyncItemAssignments(item) {
    const { data: rows } = await supabase.from('ad_assignments').select('id, real_name, product_id').eq('item_id', item.id)
    if (!rows?.length) return
    const ids = item.products.map(p => p.id)
    if (item.pick_mode === 'one') {
      // 사람당 1개만 남기고, 연결이 끊긴 제품 배정은 삭제
      const keep = new Set()
      const del = []
      for (const r of rows) {
        if (!ids.includes(r.product_id) || keep.has(r.real_name)) del.push(r.id)
        else keep.add(r.real_name)
      }
      if (del.length) await supabase.from('ad_assignments').delete().in('id', del)
    } else {
      // 전부 발송: 배정된 사람에게 연결 제품 전체를 다시 배정
      const names = [...new Set(rows.map(r => r.real_name))]
      await supabase.from('ad_assignments').delete().eq('item_id', item.id)
      await supabase.from('ad_assignments').insert(names.flatMap(n => item.products.map(p => ({
        month: item.month, real_name: n, item_id: item.id, product_id: p.id, product_name: p.name, sku: (p.sku || '').trim(), quantity: Math.max(1, Number(p.quantity) || 1),
      }))))
    }
  }

  async function deleteItem(item) {
    const count = Object.keys(savedAssign).filter(k => k.endsWith(`|${item.id}`)).length
    if (!confirm(`'${item.title}'을(를) 삭제할까요?${count ? `\n배정된 ${count}명의 광고제품 배정도 함께 삭제됩니다.` : ''}`)) return
    const { error } = await supabase.from('ad_items').delete().eq('id', item.id)
    if (error) { alert('삭제 실패: ' + error.message); return }
    await loadMonth(month)
  }

  async function moveItem(item, dir) {
    const idx = items.findIndex(i => i.id === item.id)
    const other = items[idx + dir]
    if (!other) return
    await Promise.all([
      supabase.from('ad_items').update({ sort_order: idx + dir }).eq('id', item.id),
      supabase.from('ad_items').update({ sort_order: idx }).eq('id', other.id),
    ])
    await loadMonth(month)
  }

  async function copyPrevMonth() {
    const pm = prevMonth(month)
    const { data, error } = await supabase.from('ad_items').select(ITEM_SELECT).eq('month', pm).order('sort_order')
    if (error || !data?.length) { alert(`${pm}에 등록된 광고제품이 없어요.`); return }
    const existing = new Set(items.map(i => i.title))
    const src = data.map(normalizeItem).filter(i => !existing.has(i.title))
    if (!src.length) { alert('이미 모두 불러와져 있어요.'); return }
    if (!confirm(`${pm} 광고제품 ${src.length}개(가이드 포함)를 ${month}로 복사할까요?\n사람별 배정은 복사되지 않습니다.`)) return
    for (const [i, it] of src.entries()) {
      const { data: ins, error: e1 } = await supabase.from('ad_items').insert({
        month, title: it.title, pick_mode: it.pick_mode, links: it.links, topics: it.topics,
        notices: it.notices, selling_points: it.selling_points, hashtags: it.hashtags, sort_order: items.length + i,
      }).select().single()
      if (e1) { alert('복사 실패: ' + e1.message); break }
      if (it.products.length) {
        await supabase.from('ad_item_products').insert(it.products.map((p, j) => ({ item_id: ins.id, product_id: p.id, quantity: p.quantity || 1, sort_order: j })))
      }
    }
    await loadMonth(month)
    setMsg(`${pm} 광고제품을 불러왔어요. 가이드 내용(월, 주제 등)을 확인해주세요.`)
  }

  // ───────── 사람별 배정 ─────────
  const rosterNames = new Set(ambassadors.map(a => a.real_name))
  const extraNames = [...new Set(Object.keys(assign).map(k => k.split('|')[0]))].filter(n => !rosterNames.has(n))
  const people = [...ambassadors.map(a => a.real_name), ...extraNames]
  const visiblePeople = people.filter(n => !nameFilter || n.includes(nameFilter.trim()))

  // 칸을 바꾸면 그 사람·그 광고제품 배정을 즉시 DB에 저장
  function rowsFor(name, item, value) {
    if (!value) return []
    const prods = value === true ? item.products : item.products.filter(p => p.id === value)
    return prods.map(p => ({ month, real_name: name, item_id: item.id, product_id: p.id, product_name: p.name, sku: (p.sku || '').trim(), quantity: p.quantity || 1 }))
  }

  function persist(changes) {
    // changes: [{ name, item, value }] — 순서대로 저장(큐)해서 빠르게 여러 번 눌러도 꼬이지 않게
    setSaveState('saving')
    saveQueue.current = saveQueue.current.then(async () => {
      for (const { name, item, value } of changes) {
        const { error: delErr } = await supabase.from('ad_assignments').delete().eq('item_id', item.id).eq('real_name', name)
        if (delErr) throw delErr
        const rows = rowsFor(name, item, value)
        if (rows.length) {
          const { error } = await supabase.from('ad_assignments').insert(rows)
          if (error) throw error
        }
      }
    }).then(() => {
      setSavedAssign(prev => {
        const next = { ...prev }
        changes.forEach(({ name, item, value }) => {
          const key = `${name}|${item.id}`
          if (value) next[key] = value
          else delete next[key]
        })
        return next
      })
      setSaveState('saved')
    }).catch(err => {
      setSaveState('error')
      alert('배정 저장 실패: ' + (err?.message || err) + '\n화면을 새로고침해 주세요.')
    })
  }

  function setCell(name, item, value) {
    const key = `${name}|${item.id}`
    setAssign(prev => {
      const next = { ...prev }
      if (!value) delete next[key]
      else next[key] = value
      return next
    })
    persist([{ name, item, value }])
  }

  function bulkColumn(item, value) {
    const label = value === null ? '해제' : value === true ? '전체 배정' : item.products.find(p => p.id === value)?.name
    if (!confirm(`보이는 ${visiblePeople.length}명 모두 [${item.title}] → ${label} 로 바꿀까요?`)) return
    setAssign(prev => {
      const next = { ...prev }
      visiblePeople.forEach(n => {
        const key = `${n}|${item.id}`
        if (value) next[key] = value
        else delete next[key]
      })
      return next
    })
    persist(visiblePeople.map(n => ({ name: n, item, value })))
  }

  function personCount(name) {
    return items.filter(i => assign[`${name}|${i.id}`]).length
  }

  function assignmentRows(a = assign) {
    const rows = []
    for (const [key, val] of Object.entries(a)) {
      const [name, itemId] = key.split('|')
      const item = items.find(i => i.id === itemId)
      if (!item) continue
      const prods = val === true ? item.products : item.products.filter(p => p.id === val)
      prods.forEach(p => rows.push({ month, real_name: name, item_id: itemId, product_id: p.id, product_name: p.name, sku: (p.sku || '').trim(), quantity: p.quantity || 1 }))
    }
    return rows
  }

  async function saveAssignments() {
    setSaving(true)
    const rows = assignmentRows()
    const { error: delErr } = await supabase.from('ad_assignments').delete().eq('month', month)
    if (delErr) { setSaving(false); alert('저장 실패: ' + delErr.message); return }
    if (rows.length) {
      const { error } = await supabase.from('ad_assignments').insert(rows)
      if (error) { setSaving(false); alert('저장 실패: ' + error.message + '\n새로고침 후 다시 저장해주세요.'); return }
    }
    setSavedAssign(assign)
    setSaving(false)
    const peopleCount = new Set(rows.map(r => r.real_name)).size
    setMsg(`배정 저장 완료: ${peopleCount}명 · 광고제품 ${rows.length}개`)
  }

  // ───────── 발송 목록 ─────────
  const instaOf = name => ambassadors.find(a => a.real_name === name)?.instagram || ''
  const recipientsByItem = useMemo(() => items.map(item => ({
    item,
    names: people.filter(n => savedAssign[`${n}|${item.id}`]),
  })), [items, savedAssign, ambassadors])

  function downloadAssignmentSheet() {
    const rows = []
    people.forEach(n => {
      items.forEach(item => {
        const v = savedAssign[`${n}|${item.id}`]
        if (!v) return
        const prods = v === true ? item.products : item.products.filter(p => p.id === v)
        prods.forEach(p => rows.push({
          '본명': n,
          '인스타그램': instaOf(n) ? `@${instaOf(n)}` : '',
          '무상 신청': appliedNames.has(n) ? 'O' : '미신청',
          '광고 가이드': item.title,
          '광고제품': p.name,
          '전산명': (p.sku || '').trim(),
          '수량': p.quantity || 1,
        }))
      })
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '광고제품 배정')
    XLSX.writeFile(wb, `삼대오백_광고제품배정_${month}.xlsx`)
  }

  if (authLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">로딩 중...</p></div>
  if (!session) return null

  const input = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>광고제품 · 가이드 | 삼대오백 앰버서더 허브</title></Head>

      <AdminNav active="ads" onLogout={logout} />

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* 월 선택 + 탭 */}
        <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap items-center gap-3">
          <select value={month} onChange={e => changeMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400">
            {monthOptions().map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[['items', `광고제품 · 가이드 (${items.length})`], ['assign', '사람별 배정'], ['send', '가이드 발송 목록']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-md text-sm font-medium ${tab === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{l}</button>
            ))}
          </div>
          <div className="flex-1" />
          {msg && <span className="text-xs text-gray-500 max-w-md">{msg}</span>}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : (
          <>
            {/* ===== 광고제품 · 가이드 ===== */}
            {tab === 'items' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">{monthNumber(month)}월 광고제품을 등록하고 가이드를 작성하세요. 가이드 1개 = 광고제품 1개(또는 세트)입니다.</p>
                  <div className="flex gap-2">
                    <button onClick={copyPrevMonth} className="border rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">지난달 광고제품 불러오기</button>
                    <button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">+ 광고제품 추가</button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="bg-white rounded-xl border p-12 text-center text-gray-400 text-sm">
                    {monthNumber(month)}월 광고제품이 없어요. [+ 광고제품 추가]를 누르거나 지난달 것을 불러오세요.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {items.map((item, idx) => {
                      const warns = guideWarnings(item)
                      const count = people.filter(n => savedAssign[`${n}|${item.id}`]).length
                      return (
                        <div key={item.id} className="bg-white rounded-xl border p-5 flex flex-col">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-semibold text-gray-900 text-sm leading-snug">📦 {item.title}</p>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => moveItem(item, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-1">▲</button>
                              <button onClick={() => moveItem(item, 1)} disabled={idx === items.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-1">▼</button>
                            </div>
                          </div>
                          <p className="text-xs text-orange-600 mb-2">{item.pick_mode === 'one' ? '사람별로 1개 선택' : '연결 제품 모두 발송'} · 배정 {count}명</p>
                          <div className="space-y-0.5 mb-3">
                            {item.products.map(p => (
                              <p key={p.id} className={`text-xs ${p.is_active ? 'text-gray-600' : 'text-gray-400'}`}>· {p.name}{p.quantity > 1 && <b className="text-orange-600"> ×{p.quantity}</b>}{!p.is_active && ' (숨김 제품)'} <span className="text-gray-400">({(p.sku || '').trim() || '전산명 없음'})</span></p>
                            ))}
                          </div>
                          {warns.length > 0 && <p className="text-xs text-amber-600 mb-3">⚠️ {warns.join(' · ')}</p>}
                          <div className="flex gap-2 mt-auto">
                            <button onClick={async () => setMsg(await copyText(formatGuide(item, month)) ? `'${item.title}' 가이드를 복사했어요.` : '복사 실패')} className="flex-1 bg-gray-900 hover:bg-gray-700 text-white rounded-lg py-2 text-xs font-semibold">가이드 복사</button>
                            <button onClick={() => openEdit(item)} className="flex-1 border rounded-lg py-2 text-xs text-gray-600 hover:bg-gray-50">수정</button>
                            <button onClick={() => deleteItem(item)} className="border border-red-200 text-red-400 rounded-lg px-3 py-2 text-xs hover:bg-red-50">삭제</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===== 사람별 배정 ===== */}
            {tab === 'assign' && (
              <div>
                {items.length === 0 ? (
                  <div className="bg-white rounded-xl border p-12 text-center text-gray-400 text-sm">먼저 [광고제품 · 가이드] 탭에서 광고제품을 등록해주세요.</div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <input value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="이름 검색" className="border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      <p className="text-xs text-gray-400">칸마다 광고제품을 고르면 바로 저장되고 [가이드 발송 목록]·[신청 현황 엑셀]에 반영돼요.</p>
                      <div className="flex-1" />
                      <span className={`text-xs font-medium px-3 py-1.5 rounded-lg ${saveState === 'error' ? 'bg-red-50 text-red-600' : saveState === 'saving' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-700'}`}>
                        {saveState === 'saving' ? '저장 중…' : saveState === 'error' ? '저장 실패 - 새로고침 필요' : '✓ 고르는 즉시 자동 저장'}
                      </span>
                    </div>
                    <div className="bg-white rounded-xl border overflow-hidden">
                      <div className="overflow-auto max-h-[72vh]">
                        <table className="text-sm min-w-full">
                          <thead className="sticky top-0 z-10 bg-gray-50">
                            <tr className="border-b">
                              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-[110px]">본명</th>
                              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">무상제품 (앰버서더 신청)</th>
                              {items.map(item => (
                                <th key={item.id} className="px-3 py-2 text-left align-top min-w-[190px]">
                                  <p className="text-xs text-gray-800 font-semibold leading-snug line-clamp-2">{item.title}</p>
                                  <div className="mt-1">
                                    {item.pick_mode === 'one' ? (
                                      <select value="" onChange={e => e.target.value && bulkColumn(item, e.target.value === '__none' ? null : e.target.value)} className="border rounded px-1 py-0.5 text-xs text-gray-500 w-full font-normal">
                                        <option value="">일괄 지정…</option>
                                        {item.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        <option value="__none">전체 해제</option>
                                      </select>
                                    ) : (
                                      <div className="flex gap-1">
                                        <button onClick={() => bulkColumn(item, true)} className="border rounded px-2 py-0.5 text-xs text-gray-500 font-normal hover:bg-white">전체 배정</button>
                                        <button onClick={() => bulkColumn(item, null)} className="border rounded px-2 py-0.5 text-xs text-gray-500 font-normal hover:bg-white">전체 해제</button>
                                      </div>
                                    )}
                                  </div>
                                </th>
                              ))}
                              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">광고</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visiblePeople.map(n => {
                              const notInRoster = !rosterNames.has(n)
                              return (
                                <tr key={n} className="border-b last:border-0 hover:bg-orange-50/30">
                                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white">
                                    {n}
                                    {notInRoster && <span className="block text-xs text-red-500">명단에 없음</span>}
                                  </td>
                                  <td className="px-3 py-2 text-xs min-w-[150px]">{appliedNames.has(n) ? <span className="text-green-700">{(freeByName[n] || []).join(', ') || '신청'}</span> : <span className="text-gray-400">미신청</span>}</td>
                                  {items.map(item => {
                                    const v = assign[`${n}|${item.id}`]
                                    return (
                                      <td key={item.id} className={`px-3 py-2 ${v ? 'bg-orange-50' : ''}`}>
                                        {item.pick_mode === 'one' ? (
                                          <select value={v || ''} onChange={e => setCell(n, item, e.target.value || null)} className={`border rounded-md px-2 py-1 text-xs w-full ${v ? 'border-orange-300 text-gray-900' : 'text-gray-400'}`}>
                                            <option value="">—</option>
                                            {item.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                          </select>
                                        ) : (
                                          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                            <input type="checkbox" checked={!!v} onChange={e => setCell(n, item, e.target.checked ? true : null)} className="accent-orange-500" />
                                            {v ? `${item.products.length}개 발송` : ''}
                                          </label>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td className="px-3 py-2 text-xs text-gray-500">{personCount(n) || ''}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ===== 가이드 발송 목록 ===== */}
            {tab === 'send' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">가이드별로 받을 사람을 확인하고, 가이드를 복사해 DM으로 보내세요. (사람별 배정 탭에서 고르면 바로 반영)</p>
                  <button onClick={downloadAssignmentSheet} className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg text-sm">배정표 엑셀</button>
                </div>
                                <div className="grid lg:grid-cols-2 gap-4">
                  {recipientsByItem.map(({ item, names }) => (
                    <div key={item.id} className="bg-white rounded-xl border p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">📦 {item.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">받는 사람 {names.length}명</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={async () => setMsg(await copyText(formatGuide(item, month)) ? `'${item.title}' 가이드 복사됨` : '복사 실패')} className="bg-gray-900 hover:bg-gray-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold">가이드 복사</button>
                          <button onClick={async () => setMsg(await copyText(names.map(n => instaOf(n) ? `@${instaOf(n)}` : n).join('\n')) ? '계정 목록 복사됨' : '복사 실패')} disabled={!names.length} className="border rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">계정 복사</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {names.map(n => {
                          const v = savedAssign[`${n}|${item.id}`]
                          const pick = item.pick_mode === 'one' ? item.products.find(p => p.id === v)?.name : null
                          return (
                            <span key={n} className="bg-gray-100 text-gray-700 text-xs rounded-full px-2.5 py-1">
                              {n}{instaOf(n) && <span className="text-gray-400"> @{instaOf(n)}</span>}{pick && <span className="text-orange-600"> · {pick}</span>}
                            </span>
                          )
                        })}
                        {!names.length && <span className="text-xs text-gray-400">아직 배정된 사람이 없어요.</span>}
                      </div>
                      <details>
                        <summary className="text-xs text-gray-400 cursor-pointer">가이드 미리보기</summary>
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">{formatGuide(item, month)}</pre>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editor && (
        <ItemEditor
          editor={editor}
          setEditor={setEditor}
          products={products}
          library={library}
          month={month}
          saving={saving}
          onSave={saveItem}
          input={input}
        />
      )}
    </div>
  )
}

function ItemEditor({ editor, setEditor, products, library, month, saving, onSave, input }) {
  const [search, setSearch] = useState('')
  const e = editor
  const set = patch => setEditor({ ...e, ...patch })
  const preview = formatGuide(e, month)
  const warns = guideWarnings(e)

  const found = search.trim()
    ? products.filter(p => `${p.name} ${p.sku} ${p.category1} ${p.category2}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 30)
    : []

  function addProduct(p) {
    if (e.products.find(x => x.id === p.id)) return
    set({ products: [...e.products, { ...p, quantity: 1 }] })
  }

  function applyPaste() {
    if (!e.paste.trim()) return
    const item = toLatestFormat(parseGuide(e.paste))
    set({ ...item, paste: '' })
  }

  function loadFromLibrary(id) {
    const src = library.find(i => i.id === id)
    if (!src) return
    if ((e.title || e.selling_points) && !confirm(`'${src.title}' (${src.month}) 가이드 내용으로 채울까요?`)) return
    set({
      title: src.title, pick_mode: src.pick_mode, links: src.links,
      topics: src.topics.length ? src.topics.map(t => ({ ...t })) : [{ title: '', body: '' }],
      notices: src.notices, selling_points: src.selling_points, hashtags: src.hashtags,
      products: src.products.filter(p => products.some(x => x.id === p.id)).map(p => ({ ...p })),
    })
  }

  const pointCount = String(e.selling_points || '').split('\n').filter(l => l.trim()).length
  const tagCount = countHashtags(e.hashtags)

  function setTopic(i, patch) {
    set({ topics: e.topics.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-gray-900">{e.id ? '광고제품 수정' : '광고제품 추가'} <span className="text-gray-400 font-normal text-sm">· {month}</span></h3>
          <button onClick={() => setEditor(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto grid lg:grid-cols-2 gap-6 p-6">
          {/* 입력 */}
          <div className="space-y-4">
            {library.filter(i => i.id !== e.id).length > 0 && (
              <div className="bg-gray-50 border rounded-xl p-3">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">지난 가이드 보관함에서 불러오기</label>
                <select value="" onChange={ev => loadFromLibrary(ev.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-xs text-gray-700">
                  <option value="">월 · 제품 선택…</option>
                  {library.filter(i => i.id !== e.id).map(i => <option key={i.id} value={i.id}>{i.month} · {i.title}</option>)}
                </select>
              </div>
            )}
            <details className="bg-orange-50 border border-orange-100 rounded-xl p-3">
              <summary className="text-xs font-semibold text-orange-700 cursor-pointer">기존 가이드 텍스트 붙여넣어 자동 채우기</summary>
              <textarea value={e.paste} onChange={ev => set({ paste: ev.target.value })} rows={6} placeholder="안녕하세요, 삼대오백 마케팅팀입니다. ... 전체를 붙여넣으세요" className={`${input} mt-2 text-xs`} />
              <button onClick={applyPaste} className="mt-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">항목별로 채우기</button>
            </details>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">📦 제품 표시명 (가이드에 보이는 이름)</label>
              <input value={e.title} onChange={ev => set({ title: ev.target.value })} placeholder="예: 게이너 1kg (맛 2개중 선택 씨리얼, 쿠키 크럼블)" className={input} />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">연결 제품 (출고 파일에 들어갈 실제 제품 · ×숫자 = 1인당 수량)</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {e.products.map(p => (
                  <span key={p.id} className="bg-orange-100 text-orange-700 text-xs rounded-full pl-2.5 pr-1 py-1 flex items-center gap-1">
                    {p.name}
                    <span className="text-orange-400">×</span>
                    <input type="number" min={1} value={p.quantity || 1} title="1인당 수량" onChange={ev => set({ products: e.products.map(x => x.id === p.id ? { ...x, quantity: Math.max(1, Number(ev.target.value) || 1) } : x) })} className="w-10 bg-white/70 rounded px-1 text-xs text-gray-800" />
                    <button onClick={() => set({ products: e.products.filter(x => x.id !== p.id) })} className="w-4 h-4 rounded-full hover:bg-orange-200 text-xs">✕</button>
                  </span>
                ))}
                {!e.products.length && <span className="text-xs text-gray-400">아래에서 검색해 추가하세요.</span>}
              </div>
              <input value={search} onChange={ev => setSearch(ev.target.value)} placeholder="제품명 / 전산명 검색" className={input} />
              {found.length > 0 && (
                <div className="border rounded-lg mt-1 max-h-48 overflow-y-auto divide-y">
                  {found.map(p => (
                    <button key={p.id} onClick={() => addProduct(p)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50 flex justify-between gap-2">
                      <span className={p.is_active ? 'text-gray-800' : 'text-gray-400'}>{p.name}{!p.is_active && ' (숨김)'}</span>
                      <span className="text-gray-400 truncate">{(p.sku || '').trim()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">배정 방식</label>
              <div className="grid grid-cols-2 gap-2">
                {[['one', '사람별로 1개 선택', '맛·사이즈 중 하나 (예: 게이너)'], ['all', '연결 제품 모두 발송', '세트 구성 (예: 핫크림 2종)']].map(([k, l, d]) => (
                  <label key={k} className={`border-2 rounded-xl p-3 cursor-pointer ${e.pick_mode === k ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
                    <input type="radio" checked={e.pick_mode === k} onChange={() => set({ pick_mode: k })} className="mr-1.5 accent-orange-500" />
                    <span className="text-sm font-medium text-gray-800">{l}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{d}</p>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">제품 링크 (한 줄에 하나)</label>
              <textarea value={e.links} onChange={ev => set({ links: ev.target.value })} rows={2} placeholder="https://samdae500.com/surl/p/..." className={input} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">📍 콘텐츠 주제</label>
                <button onClick={() => set({ topics: [...e.topics, { title: '', body: '' }] })} className="text-xs text-orange-600">+ 주제 추가</button>
              </div>
              <div className="space-y-2">
                {e.topics.map((t, i) => (
                  <div key={i} className="border rounded-lg p-2">
                    <div className="flex gap-2 items-center mb-1">
                      <span className="text-xs font-bold text-gray-500">[{'ABCDEFGHIJ'[i] || i + 1}]</span>
                      <input value={t.title} onChange={ev => setTopic(i, { title: ev.target.value })} placeholder="주제 한 줄 요약" className="flex-1 border rounded-md px-2 py-1 text-sm" />
                      {e.topics.length > 1 && <button onClick={() => set({ topics: e.topics.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-500 text-xs">삭제</button>}
                    </div>
                    <textarea value={t.body} onChange={ev => setTopic(i, { body: ev.target.value })} rows={2} placeholder="설명 (여러 줄 가능)" className="w-full border rounded-md px-2 py-1 text-xs" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">📢 안내 (한 줄에 하나)</label>
              <textarea value={e.notices} onChange={ev => set({ notices: ev.target.value })} rows={2} className={input} />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">✔ 제품 셀링포인트 (한 줄에 하나, 최대 {MAX_SELLING_POINTS}줄) <span className={pointCount > MAX_SELLING_POINTS ? 'text-red-500' : 'text-gray-400'}>· {pointCount}줄</span></label>
              <textarea value={e.selling_points} onChange={ev => set({ selling_points: ev.target.value })} rows={4} placeholder="[검증된 성분] ..." className={input} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">📍 해시태그 ({HASHTAG_COUNT}개: #협찬 #삼대오백 + 3개) <span className={tagCount !== HASHTAG_COUNT ? 'text-red-500' : 'text-gray-400'}>· {tagCount}개</span></label>
                <button onClick={() => set({ hashtags: normalizeHashtags(e.hashtags) })} className="text-xs text-orange-600">5개로 정리</button>
              </div>
              <input value={e.hashtags} onChange={ev => set({ hashtags: ev.target.value })} placeholder="#협찬 #삼대오백 # # #" className={input} />
            </div>
          </div>

          {/* 미리보기 */}
          <div className="lg:sticky lg:top-0 self-start">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500">가이드 미리보기</p>
              <button onClick={() => copyText(preview)} className="text-xs border rounded-lg px-3 py-1 text-gray-600 hover:bg-gray-50">복사</button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-gray-50 border rounded-xl p-4 leading-relaxed max-h-[65vh] overflow-y-auto">{preview}</pre>
            {warns.length > 0 && <p className="text-xs text-amber-600 mt-2">⚠️ {warns.join(' · ')}</p>}
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t">
          <button onClick={() => setEditor(null)} className="flex-1 border rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={onSave} disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold">{saving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}
