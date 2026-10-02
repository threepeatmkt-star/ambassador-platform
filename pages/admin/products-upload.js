import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../../lib/useAdminAuth'
import Head from 'next/head'
import Link from 'next/link'
import * as XLSX from 'xlsx'

export default function ProductsUpload() {
  const { session, loading: authLoading } = useAdminAuth()
  const [preview, setPreview] = useState([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')
  const [replaceAll, setReplaceAll] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const fileRef = useRef()

  function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'binary' })
      const targetSheet = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(targetSheet)
      setPreview(data)
    }
    reader.readAsBinaryString(file)
  }

  function downloadTemplate() {
    const template = [{ '카테고리': '프로틴', '제품명': 'WPI 웨이 프로틴 초코 1kg', '전산명(SKU)': '삼대오백WPI포대1kg초코', '이미지URL': '' }]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '제품DB')
    XLSX.writeFile(wb, '제품DB_업로드_템플릿.xlsx')
  }

  async function handleUpload() {
    if (!preview.length) return
    setUploading(true)

    const rows = preview.map(row => ({
      name: String(row['제품명'] || '').trim(),
      sku: String(row['전산명(SKU)'] || row['전산명'] || row['SKU'] || '').trim(),
      category1: String(row['카테고리'] || row['카테고리1'] || '').trim(),
      category2: String(row['카테고리2'] || '').trim(),
      category3: String(row['카테고리3'] || '').trim(),
      image_url: String(row['이미지URL'] || row['이미지'] || '').trim(),
      is_active: true,
    })).filter(r => r.name && r.sku && r.category1)

    if (!rows.length) {
      setResult({ success: false, message: '유효한 데이터가 없어요. 제품명/전산명/카테고리1은 필수예요.' })
      setUploading(false)
      return
    }

    if (replaceAll) {
      const { error: delError } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (delError) {
        setResult({ success: false, message: '기존 데이터 삭제 실패: ' + delError.message })
        setUploading(false)
        return
      }
    }

    const { error } = replaceAll
      ? await supabase.from('products').insert(rows)
      : await supabase.from('products').upsert(rows, { onConflict: 'sku' })

    setUploading(false)
    if (error) {
      setResult({ success: false, message: '업로드 실패: ' + error.message })
    } else {
      setResult({ success: true, count: rows.length, replaced: replaceAll })
    }
  }

  function resetAll() {
    setPreview([])
    setFileName('')
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (authLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">로딩 중...</p>
    </div>
  )
  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>제품 DB 업로드 | 삼대오백 앰버서더 허브</title></Head>

      {showGuide && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGuide(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <h3 className="font-bold text-gray-900">추천 운영 방식</h3>
              </div>
              <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              {[
                { icon: '📅', title: '매월 초', desc: '엑셀로 전체 교체 업로드', color: 'bg-orange-50 border-orange-100' },
                { icon: '✨', title: '중간에 신제품 생기면', desc: '페이지에서 개별 추가', color: 'bg-blue-50 border-blue-100' },
                { icon: '🚫', title: '재고 소진된 제품', desc: '페이지에서 숨김 처리', color: 'bg-gray-50 border-gray-100' },
              ].map(({ icon, title, desc, color }) => (
                <div key={title} className={`flex items-center gap-4 p-4 rounded-xl border ${color}`}>
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">→ {desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t">
              <p className="text-xs text-gray-400 leading-relaxed">
                💾 엑셀 파일 하나를 <span className="font-semibold text-gray-600">마스터 DB</span>로 유지하면서 변경사항 생길 때마다 엑셀에도 반영해두세요.<br/>
                매월 초에 그 파일로 전체 교체 업로드하면 가장 깔끔하게 관리됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-orange-500 font-bold text-lg">삼대오백 앰버서더 허브</Link>
          <span className="text-gray-200">|</span>
          <span className="text-gray-500 text-sm">제품 DB 일괄 업로드</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 border border-orange-300 text-orange-500 hover:bg-orange-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            💡 추천 운영방식
          </button>
          <Link href="/admin/products" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 제품 관리로
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">제품 DB 일괄 업로드</h1>
          <p className="text-gray-500">엑셀 파일로 제품을 한 번에 등록하세요.<br/>전산명(SKU) 기준으로 중복 체크되며, 같은 SKU는 덮어쓰기됩니다.</p>
        </div>

        <div className="bg-white rounded-2xl border p-6 mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">엑셀 컬럼 형식 안내</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { col: '카테고리', req: true, ex: '프로틴/탄수화물' },
              { col: '제품명', req: true, ex: 'WPI 웨이 프로틴 초코 1kg' },
              { col: '전산명(SKU)', req: true, ex: '삼대오백WPI포대1kg초코' },
              { col: '이미지URL', req: true, ex: 'https://...' },
            ].map(({ col, req, ex }) => (
              <div key={col} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm font-medium text-gray-800">{col}</span>
                  {req && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-semibold">필수</span>}
                </div>
                <p className="text-xs text-gray-400 truncate">{ex}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">💡 아래 템플릿 양식에 맞춰 작성 후 업로드하세요.</p>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              템플릿 다운로드
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-6 mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">업로드 방식 선택</p>
          <div className="flex flex-col gap-3">
            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${!replaceAll ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" checked={!replaceAll} onChange={() => setReplaceAll(false)} className="mt-0.5 accent-orange-500" />
              <div>
                <p className="font-medium text-gray-900 text-sm">추가/업데이트 (권장)</p>
                <p className="text-gray-500 text-xs mt-0.5">기존 제품은 유지하면서 새 제품 추가 · 같은 SKU는 덮어쓰기</p>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${replaceAll ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" checked={replaceAll} onChange={() => setReplaceAll(true)} className="mt-0.5 accent-red-500" />
              <div>
                <p className="font-medium text-gray-900 text-sm">전체 교체 ⚠️</p>
                <p className="text-gray-500 text-xs mt-0.5">기존 제품 전체 삭제 후 파일 내용으로 새로 등록 · 매월 DB 초기화 시 사용</p>
              </div>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-6 mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">파일 선택</p>
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${fileName ? 'border-orange-300 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            {fileName ? (
              <>
                <div className="text-4xl mb-3">📊</div>
                <p className="font-semibold text-orange-600 text-base mb-1">{fileName}</p>
                <p className="text-gray-400 text-sm">{preview.length}개 제품 인식됨 · 클릭하면 파일 변경</p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">📂</div>
                <p className="font-semibold text-gray-600 text-base mb-1">여기에 파일을 드래그하거나 클릭해서 선택</p>
                <p className="text-gray-400 text-sm">.xlsx / .xls / .csv 지원</p>
              </>
            )}
          </div>
        </div>

        {preview.length > 0 && (
          <div className="bg-white rounded-2xl border p-6 mb-5">
            <div className="mb-4">
              <p className="font-semibold text-gray-900">데이터 미리보기</p>
              <p className="text-gray-400 text-xs mt-0.5">상위 5개만 표시 · 전체 {preview.length}개 업로드 예정</p>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {Object.keys(preview[0]).map(k => (
                      <th key={k} className="px-4 py-3 text-left text-gray-500 font-medium text-xs whitespace-nowrap">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-4 py-3 text-gray-700 text-xs max-w-[160px] truncate">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                  {preview.length > 5 && (
                    <tr>
                      <td colSpan={Object.keys(preview[0]).length} className="px-4 py-3 text-center text-gray-400 text-xs">
                        ...외 {preview.length - 5}개
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className={`rounded-2xl p-6 mb-5 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {result.success ? (
              <div className="text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="font-bold text-green-700 text-lg mb-1">{result.count}개 제품 업로드 완료!</p>
                <p className="text-green-600 text-sm mb-4">{result.replaced ? '기존 제품 전체 교체 완료.' : 'SKU 기준 중복 항목은 업데이트되었습니다.'}</p>
                <div className="flex gap-3 justify-center">
                  <Link href="/admin/products" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                    제품 목록 확인
                  </Link>
                  <button onClick={resetAll} className="bg-white border border-green-300 text-green-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-green-50 transition-colors">
                    다시 업로드
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-red-600 font-medium">{result.message}</p>
            )}
          </div>
        )}

        {preview.length > 0 && !result?.success && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`w-full disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition-colors ${replaceAll ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}
          >
            {uploading ? '업로드 중...' : replaceAll ? `⚠️ 기존 제품 전체 삭제 후 ${preview.length}개 새로 등록` : `${preview.length}개 제품 업로드 실행`}
          </button>
        )}
      </div>
    </div>
  )
}
