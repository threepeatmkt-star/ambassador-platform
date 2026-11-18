import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../../lib/useAdminAuth'
import Head from 'next/head'
import Link from 'next/link'
import AdminNav from '../../components/AdminNav'
import PageHeader from '../../components/PageHeader'
import { useAdminMonth } from '../../lib/useAdminMonth'

// ── ERP 동기화 도우미 ──────────────────────────────────────
const LOW_STOCK = 50
function guessName(e) {
  let n = String(e.label || '').split('/')[0].trim()
  if (!/[가-힣]/.test(n)) n = ''
  n = (n || e.sku).replace(/^삼대오백\s*/, '').trim()
  return n || e.sku
}
function guessCategory(e) {
  const t = `${e.sku} ${e.label}`
  if (e.category[0] === '헬스용품') return '용품'
  if (/크레아/.test(t)) return '크레아틴'
  if (/EAA|BCAA|글루타민|아르기닌|시트룰린|베타알라닌/i.test(t)) return 'EAA/BCAA'
  if (/부스터|펌프|전해질|에너지|바이퍼/.test(t)) return '부스터'
  const leaf = e.category[e.category.length - 1] || ''
  if (/영양제/.test(leaf)) return '영양제'
  if (/부스터/.test(leaf)) return '부스터'
  if (/식사대용|스낵|음료/.test(leaf) || e.category.includes('간식')) return '식품'
  if (/보충제/.test(leaf)) return '프로틴/탄수화물'
  return ''
}
// 전산명이 ERP에 없을 때, 이름이 비슷한 ERP 제품 추천 (자동 변경 X, 버튼으로만)
function norm(t) { return String(t || '').replace(/삼대오백|\s|\(|\)|-|\//g, '').toLowerCase() }
function bigrams(t) { const n = norm(t); const b = new Set(); for (let i = 0; i < n.length - 1; i++) b.add(n.slice(i, i + 2)); return b }
function similar(a, b) { const A = bigrams(a), B = bigrams(b); if (!A.size || !B.size) return 0; let x = 0; for (const g of A) if (B.has(g)) x++; return x / (A.size + B.size - x) }
function suggestSku(p, items, usedSkus) {
  return items
    .filter(e => e.brand === 4 && e.type === 1 && !usedSkus.has(e.sku) && e.sellState !== 4)
    .map(e => ({ e, score: Math.max(similar(`${p.sku} ${p.name}`, `${e.sku} ${e.label}`), similar(p.name, e.label), similar(p.sku, e.sku)) + (e.sellState === 1 ? 0.02 : 0) }))
    .filter(x => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(x => x.e)
}

function erpBadge(e) {
  if (!e) return { text: 'ERP에 없음', cls: 'bg-red-50 text-red-600' }
  if (e.sellState === 4 || e.sellState === 2) return { text: e.sellStateName, cls: 'bg-red-50 text-red-600' }
  if (e.sellState === 3) return { text: '단종 예정', cls: 'bg-amber-50 text-amber-700' }
  if (e.sellState === 5) return { text: '진행 중', cls: 'bg-blue-50 text-blue-700' }
  return { text: '판매', cls: 'bg-gray-100 text-gray-600' }
}

export default function AdminProducts() {
  const { session, loading: authLoading, logout } = useAdminAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [filterCat1, setFilterCat1] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()
  const [month, setMonth] = useAdminMonth()
  const [view, setView] = useState('list') // list | card
  const [search, setSearch] = useState('')
  const [erp, setErp] = useState({ phase: 'idle' }) // idle | loading | ok | error
  const [showSync, setShowSync] = useState(false)
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    name: '', sku: '', category1: '', category2: '', category3: '', image_url: '', is_active: true
  })

  useEffect(() => {
    if (session) loadProducts()
  }, [session])

  // 화면 열면 ERP 판매상태 · 재고 자동 확인 (읽기만)
  useEffect(() => {
    if (session && products.length && erp.phase === 'idle') loadErp()
  }, [session, products.length])

  async function loadErp() {
    setErp({ phase: 'loading' })
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/erp/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token}` },
        body: JSON.stringify({ skus: products.map(p => p.sku).filter(Boolean) }),
      })
      const j = await res.json().catch(() => ({ error: '응답을 읽지 못했어요.' }))
      if (!j.ok) { setErp({ phase: 'error', error: j.error }); return }
      setErp({ phase: 'ok', map: new Map(j.items.map(i => [i.sku, i])), items: j.items, at: j.at })
    } catch (e) { setErp({ phase: 'error', error: e.message }) }
  }

  async function hideMany(list) {
    if (!list.length || !confirm(`${list.length}개 제품을 숨김 처리할까요?\n(앰버서더 신청 화면에서 안 보이게 돼요)`)) return
    setBusy(true)
    await supabase.from('products').update({ is_active: false }).in('id', list.map(p => p.id))
    setBusy(false); loadProducts()
  }

  async function addMany(list) {
    if (!list.length || !confirm(`${list.length}개 제품을 '숨김' 상태로 추가할까요?\n사진 · 제품명 확인 후 [노출]로 바꿔주세요.`)) return
    setBusy(true)
    await supabase.from('products').insert(list.map(e => ({ name: guessName(e), sku: e.sku, category1: guessCategory(e) || '미분류', category2: '', category3: '', image_url: '', is_active: false })))
    setBusy(false); loadProducts()
  }

  async function changeSku(p, sku) {
    if (!confirm(`전산명을 바꿀까요?\n\n${p.name}\n${p.sku || '(없음)'}  →  ${sku}`)) return
    setBusy(true)
    await supabase.from('products').update({ sku }).eq('id', p.id)
    setBusy(false); loadProducts()
  }

  function addOne(e) {
    setForm({ name: guessName(e), sku: e.sku, category1: guessCategory(e), category2: '', category3: '', image_url: '', is_active: true })
    setEditProduct(null)
    setShowForm(true)
  }

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('category1,category2,name')
    if (data) setProducts(data)
    setLoading(false)
  }

  async function uploadImage(file) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `products/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file)
    if (error) { alert('이미지 업로드 실패: ' + error.message); setUploading(false); return null }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    setUploading(false)
    return data.publicUrl
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('제품명을 입력해주세요.'); return }
    if (!form.category1.trim()) { alert('카테고리1을 입력해주세요.'); return }

    if (editProduct) {
      await supabase.from('products').update(form).eq('id', editProduct.id)
    } else {
      await supabase.from('products').insert(form)
    }
    setShowForm(false)
    setEditProduct(null)
    setForm({ name: '', sku: '', category1: '', category2: '', category3: '', image_url: '', is_active: true })
    loadProducts()
  }

  async function handleToggleActive(product) {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    loadProducts()
  }

  async function handleDelete(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    await supabase.from('products').delete().eq('id', id)
    loadProducts()
  }

  function openEdit(product) {
    setForm({ ...product })
    setEditProduct(product)
    setShowForm(true)
  }

  function openNew() {
    setForm({ name: '', sku: '', category1: '', category2: '', category3: '', image_url: '', is_active: true })
    setEditProduct(null)
    setShowForm(true)
  }

  if (authLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">로딩 중...</p></div>
  if (!session) return null

  const cat1List = [...new Set(products.map(p => p.category1))].filter(Boolean)
  // ERP 비교 결과
  const erpMap = erp.phase === 'ok' ? erp.map : null
  const siteSkus = new Set(products.map(p => (p.sku || '').trim()))
  const syncHide = erpMap ? products.filter(p => {
    if (!p.is_active) return false
    const e = erpMap.get((p.sku || '').trim())
    return e && (e.sellState === 4 || e.sellState === 2 || e.stock === null || e.stock <= 0)
  }) : []
  const syncMissing = erpMap ? products.filter(p => p.sku && !erpMap.has(p.sku.trim())) : []
  const syncNoSku = products.filter(p => !p.sku)
  const syncNew = erpMap ? erp.items.filter(e => e.brand === 4 && e.type === 1 && (e.sellState === 1 || e.sellState === 5) && e.stock > 0 && !siteSkus.has(e.sku)) : []
  const syncLow = erpMap ? products.filter(p => { const e = p.is_active && erpMap.get((p.sku || '').trim()); return e && e.stock !== null && e.stock > 0 && e.stock < LOW_STOCK }) : []
  const syncCount = syncHide.length + syncMissing.length + syncNoSku.length + syncNew.length
  const q = search.trim().toLowerCase()
  const filtered = products.filter(p => {
    if (filterCat1 && p.category1 !== filterCat1) return false
    if (q && !`${p.name} ${p.sku || ''} ${p.category2 || ''} ${p.category3 || ''}`.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>제품 DB 관리 | 삼대오백 앰버서더 허브</title></Head>

      <AdminNav active="products" onLogout={logout} month={month} onMonthChange={setMonth} />

      <div className="max-w-7xl mx-auto px-8 py-8">
        <PageHeader
          title="제품 DB 관리"
          desc={`전체 ${products.length}개 · 노출 ${products.filter(p => p.is_active).length}개 · 숨김 ${products.filter(p => !p.is_active).length}개`}
          actions={<>
            <Link href="/admin/products-upload" className="flex items-center gap-2 border border-orange-400 bg-white text-orange-600 hover:bg-orange-50 px-5 py-2.5 rounded-xl font-semibold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              일괄 업로드
            </Link>
            <button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-semibold">+ 제품 추가</button>
          </>}
        />

        {/* ERP 동기화 */}
        <div className="bg-white rounded-2xl border-2 border-orange-200 p-5 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">ERP 동기화 <span className="text-sm font-normal text-gray-500">판매상태 · 포항물류 재고 기준</span></p>
              <p className="text-sm text-gray-500 mt-0.5">
                {erp.phase === 'loading' && 'ERP에서 제품 정보를 불러오는 중…'}
                {erp.phase === 'error' && <span className="text-red-600">{erp.error} {/연결되지|권한/.test(erp.error || '') && <a href="/admin?tab=settings" className="underline font-semibold">설정 › ERP 연결</a>}</span>}
                {erp.phase === 'ok' && (syncCount === 0
                  ? <span className="text-green-700">✓ ERP와 맞아요 · {new Date(erp.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 확인</span>
                  : <span>확인할 것 <b className="text-orange-600">{syncCount}건</b> · {new Date(erp.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 확인</span>)}
              </p>
            </div>
            {erp.phase === 'ok' && syncCount > 0 && <button onClick={() => setShowSync(v => !v)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold">{showSync ? '접기' : '확인하기'}</button>}
            <button onClick={loadErp} disabled={erp.phase === 'loading'} className="border px-4 py-2 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">다시 불러오기</button>
          </div>

          {erp.phase === 'ok' && showSync && (
            <div className="mt-4 space-y-4">
              {syncHide.length > 0 && (
                <SyncBox title={`노출 중인데 단종 · 재고 없음 ${syncHide.length}개`} tone="red" desc="앰버서더가 골라도 보낼 수 없어요. 숨김 처리를 추천해요."
                  action={<button disabled={busy} onClick={() => hideMany(syncHide)} className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40">모두 숨김</button>}>
                  {syncHide.map(p => { const e = erpMap.get(p.sku.trim()); return <SyncRow key={p.id} name={p.name} sku={p.sku} info={`${e.sellStateName} · 재고 ${e.stock ?? '없음'}`} /> })}
                </SyncBox>
              )}
              {syncNew.length > 0 && (
                <SyncBox title={`ERP에 있는데 사이트에 없는 삼대오백 본품 ${syncNew.length}개`} tone="blue" desc="판매 · 진행 중인 제품이에요. 필요한 것만 [추가]하세요. 제품명 · 카테고리는 자동으로 채워져요. 확인 후 사진만 넣으면 돼요."
                  action={<button disabled={busy} onClick={() => addMany(syncNew)} className="border border-blue-300 text-blue-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-40">모두 숨김 상태로 추가</button>}>
                  {syncNew.map(e => <SyncRow key={e.sku} name={guessName(e)} sku={e.sku} info={`${e.sellStateName} · 재고 ${e.stock ?? '없음'} · ${e.category.slice(-1)[0] || ''}`} button={<button onClick={() => addOne(e)} className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50">추가</button>} />)}
                </SyncBox>
              )}
              {(syncMissing.length > 0 || syncNoSku.length > 0) && (
                <SyncBox title={`ERP에서 못 찾는 전산명 ${syncMissing.length + syncNoSku.length}개`} tone="amber" desc="이대로면 ERP 출고 등록이 안 돼요. [수정]에서 ERP 제품명과 똑같이 맞춰주세요.">
                  {[...syncMissing, ...syncNoSku].map(p => {
                    const sug = suggestSku(p, erp.items, siteSkus)
                    return (
                      <div key={p.id}>
                        <SyncRow name={p.name} sku={p.sku || '(전산명 없음)'} info={p.is_active ? '노출 중' : '숨김'} button={<button onClick={() => openEdit(p)} className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50">수정</button>} />
                        {sug.length > 0 && (
                          <div className="px-3 pb-2 -mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-gray-400">비슷한 ERP 제품:</span>
                            {sug.map(e => (
                              <button key={e.sku} disabled={busy} onClick={() => changeSku(p, e.sku)} className="border border-amber-300 bg-white text-amber-800 rounded-md px-2 py-0.5 hover:bg-amber-50 disabled:opacity-40" title={e.label}>
                                {e.sku} <span className="text-gray-400">({e.sellStateName} · 재고 {e.stock ?? '없음'})</span> 로 변경
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </SyncBox>
              )}
              {syncLow.length > 0 && (
                <SyncBox title={`재고 ${LOW_STOCK}개 미만 ${syncLow.length}개 (참고)`} tone="gray" desc="아직 보낼 수는 있지만 곧 떨어질 수 있어요.">
                  {syncLow.map(p => <SyncRow key={p.id} name={p.name} sku={p.sku} info={`재고 ${erpMap.get(p.sku.trim()).stock}개`} />)}
                </SyncBox>
              )}
            </div>
          )}
        </div>

        {/* 검색 · 카테고리 · 보기 방식 */}
        <div className="bg-white rounded-2xl border p-5 mb-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="제품명 · 전산명 검색" className="border rounded-xl px-4 py-2.5 w-72 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <div className="flex-1" />
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {[['list', '목록으로 보기'], ['card', '사진으로 보기']].map(([k, l]) => (
                <button key={k} onClick={() => setView(k)} className={`px-4 py-2 rounded-lg font-semibold ${view === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            <button onClick={() => setFilterCat1('')} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${!filterCat1 ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:border-orange-300'}`}>전체 {products.length}</button>
            {cat1List.map(c => (
              <button key={c} onClick={() => setFilterCat1(c)} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${filterCat1 === c ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:border-orange-300'}`}>
                {c} {products.filter(p => p.category1 === c).length}
              </button>
            ))}
          </div>
        </div>

        {!loading && view === 'list' && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 text-sm">
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold w-16"></th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">제품명</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">전산명(SKU)</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">카테고리</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">ERP</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">상태</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(product => (
                    <tr key={product.id} className={`border-b last:border-0 ${!product.is_active ? 'bg-gray-50 text-gray-400' : ''}`}>
                      <td className="px-4 py-2">
                        {product.image_url ? <img src={product.image_url} alt="" className={`w-11 h-11 rounded-lg object-cover border ${!product.is_active ? 'opacity-40' : ''}`} /> : <div className="w-11 h-11 rounded-lg bg-gray-100" />}
                      </td>
                      <td className={`px-4 py-2 font-medium ${product.is_active ? 'text-gray-900' : ''}`}>{product.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{product.sku || <span className="text-red-400">없음</span>}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{[product.category1, product.category2, product.category3].filter(Boolean).join(' > ')}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {erpMap ? (() => { const e = erpMap.get((product.sku || '').trim()); const b = erpBadge(e); return (
                          <span className="text-sm">
                            <span className={`font-semibold rounded-full px-2.5 py-0.5 ${b.cls}`}>{b.text}</span>
                            {e && <span className={`ml-2 ${e.stock === null || e.stock <= 0 ? 'text-red-500 font-semibold' : e.stock < LOW_STOCK ? 'text-amber-600 font-semibold' : 'text-gray-500'}`}>재고 {e.stock === null ? '없음' : e.stock.toLocaleString()}</span>}
                          </span>) })() : <span className="text-xs text-gray-300">{erp.phase === 'loading' ? '확인 중…' : '-'}</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-sm font-semibold rounded-full px-3 py-1 whitespace-nowrap ${product.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{product.is_active ? '노출' : '숨김'}</span>
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(product)} className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600 mr-1">수정</button>
                        <button onClick={() => handleToggleActive(product)} className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600 mr-1">{product.is_active ? '숨김' : '노출'}</button>
                        <button onClick={() => handleDelete(product.id)} className="text-sm border border-red-200 text-red-400 rounded-lg px-2.5 py-1.5 hover:bg-red-50">✕</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">조건에 맞는 제품이 없어요.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : view === 'card' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(product => (
              <div key={product.id} className={`bg-white rounded-xl border overflow-hidden ${!product.is_active ? 'opacity-50' : ''}`}>
                <div className="aspect-square bg-gray-100 relative">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">이미지 없음</div>
                  )}
                  {!product.is_active && (
                    <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
                      <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">비활성</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-orange-500 text-xs font-semibold">{[product.category1, product.category2, product.category3].filter(Boolean).join(' > ')}</p>
                  <p className="text-gray-900 text-xs font-medium mt-0.5 line-clamp-2">{product.name}</p>
                  {product.sku && <p className="text-gray-400 text-xs mt-0.5">{product.sku}</p>}
                  <div className="flex gap-1 mt-3">
                    <button onClick={() => openEdit(product)} className="flex-1 text-xs border rounded-lg py-1.5 hover:bg-gray-50 text-gray-600">수정</button>
                    <button onClick={() => handleToggleActive(product)} className="flex-1 text-xs border rounded-lg py-1.5 hover:bg-gray-50 text-gray-600">{product.is_active ? '숨김' : '활성'}</button>
                    <button onClick={() => handleDelete(product.id)} className="text-xs border border-red-200 text-red-400 rounded-lg px-2 py-1.5 hover:bg-red-50">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 제품 추가/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">{editProduct ? '제품 수정' : '제품 추가'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">제품명 *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="제품명" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">전산명 (SKU)</label>
                <input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="전산명 / SKU" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">카테고리 1 *</label>
                  <input value={form.category1} onChange={e => setForm({...form, category1: e.target.value})} placeholder="예: 단백질" className="w-full border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">카테고리 2</label>
                  <input value={form.category2} onChange={e => setForm({...form, category2: e.target.value})} placeholder="예: 웨이" className="w-full border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">카테고리 3</label>
                  <input value={form.category3} onChange={e => setForm({...form, category3: e.target.value})} placeholder="예: 초코" className="w-full border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              {/* 이미지 업로드 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">제품 이미지</label>
                {form.image_url && (
                  <img src={form.image_url} alt="" className="w-24 h-24 object-cover rounded-lg border mb-2" />
                )}
                <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files[0]
                      if (file) {
                        const url = await uploadImage(file)
                        if (url) setForm({...form, image_url: url})
                      }
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="border rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    {uploading ? '업로드 중...' : '이미지 선택'}
                  </button>
                  <input
                    value={form.image_url}
                    onChange={e => setForm({...form, image_url: e.target.value})}
                    placeholder="또는 이미지 URL 직접 입력"
                    className="flex-1 border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={e => setForm({...form, is_active: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">앰버서더에게 노출 (활성)</label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 border rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleSave} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 text-sm font-semibold">
                {editProduct ? '저장' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SyncBox({ title, desc, tone, action, children }) {
  const tones = { red: 'border-red-200 bg-red-50/40', blue: 'border-blue-200 bg-blue-50/40', amber: 'border-amber-200 bg-amber-50/40', gray: 'border-gray-200 bg-gray-50' }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.gray}`}>
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1"><p className="font-bold text-gray-900">{title}</p>{desc && <p className="text-sm text-gray-500 mt-0.5 break-keep">{desc}</p>}</div>
        {action}
      </div>
      <div className="max-h-72 overflow-y-auto divide-y bg-white rounded-lg border">{children}</div>
    </div>
  )
}

function SyncRow({ name, sku, info, button }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      <div className="flex-1 min-w-0"><span className="font-medium text-gray-900">{name}</span> <span className="text-gray-400 text-xs ml-1">{sku}</span></div>
      {info && <span className="text-gray-500 text-xs whitespace-nowrap">{info}</span>}
      {button}
    </div>
  )
}
