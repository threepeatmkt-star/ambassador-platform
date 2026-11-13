import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../../lib/useAdminAuth'
import Head from 'next/head'
import Link from 'next/link'
import AdminNav from '../../components/AdminNav'
import PageHeader from '../../components/PageHeader'
import { useAdminMonth } from '../../lib/useAdminMonth'

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

  const [form, setForm] = useState({
    name: '', sku: '', category1: '', category2: '', category3: '', image_url: '', is_active: true
  })

  useEffect(() => {
    if (session) loadProducts()
  }, [session])

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
                  {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">조건에 맞는 제품이 없어요.</td></tr>}
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
