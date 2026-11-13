import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const KEY = 'samdae_admin_month'
let memMonth = '' // 같은 창에서 화면 이동 시 유지

export function monthOptions() {
  return Array.from({ length: 15 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - 12 + i + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }).reverse()
}

export function monthLabel(m) {
  const [y, mm] = String(m || '').split('-')
  return y && mm ? `${y}년 ${Number(mm)}월` : ''
}

// 관리자 전체 화면이 같이 쓰는 '기준 월'
// 처음엔 설정의 신청 월(current_month), 상단에서 바꾸면 이 브라우저 창이 닫힐 때까지 유지
export function useAdminMonth() {
  const [month, setMonthState] = useState('')

  useEffect(() => {
    let saved = memMonth
    try { saved = sessionStorage.getItem(KEY) || saved } catch {}
    if (saved) { setMonthState(saved); return }
    supabase.from('settings').select('key,value').then(({ data }) => {
      const m = data?.find(r => r.key === 'current_month')?.value || monthOptions()[2]
      memMonth = memMonth || m
      setMonthState(memMonth)
    })
  }, [])

  function setMonth(m) {
    setMonthState(m)
    memMonth = m
    try { sessionStorage.setItem(KEY, m) } catch {}
  }

  return [month, setMonth]
}
