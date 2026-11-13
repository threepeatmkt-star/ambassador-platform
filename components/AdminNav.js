import Link from 'next/link'
import { monthOptions } from '../lib/useAdminMonth'

// 관리자 공통 상단 메뉴: 홈 > 광고제품 · 가이드 > 신청 현황 > 앰버서더 명단 > 제품 DB 관리 > 설정
export const ADMIN_MENU = [
  { key: 'home', href: '/admin/home', label: '홈' },
  { key: 'ads', href: '/admin/ads', label: '광고제품 · 가이드' },
  { key: 'applications', href: '/admin?tab=applications', label: '신청 현황' },
  { key: 'ambassadors', href: '/admin?tab=ambassadors', label: '앰버서더 명단' },
  { key: 'products', href: '/admin/products', label: '제품 DB 관리' },
  { key: 'settings', href: '/admin?tab=settings', label: '설정' },
]

export default function AdminNav({ active, onLogout, month, onMonthChange }) {
  return (
    <div className="bg-white border-b sticky top-0 z-40">
      <div className="px-8 pt-5 pb-1 flex items-center justify-between gap-4">
        <Link href="/admin/home" className="flex items-center gap-3">
          <span className="text-orange-500 font-extrabold text-2xl tracking-tight">삼대오백 앰버서더 허브</span>
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-md px-2 py-1">ADMIN</span>
        </Link>
        <div className="flex items-center gap-3">
          {onMonthChange && (
            <label className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl pl-4 pr-2 py-1.5">
              <span className="text-sm font-semibold text-orange-700">기준 월</span>
              <select
                value={month || ''}
                onChange={e => onMonthChange(e.target.value)}
                className="bg-white border border-orange-200 rounded-lg px-3 py-1.5 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {month && !monthOptions().includes(month) && <option value={month}>{month}</option>}
                {monthOptions().map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          )}
          {onLogout && (
            <button onClick={onLogout} className="text-gray-400 hover:text-gray-700 text-sm font-medium border rounded-lg px-4 py-2">
              로그아웃
            </button>
          )}
        </div>
      </div>
      <nav className="px-6 flex gap-1 overflow-x-auto">
        {ADMIN_MENU.map(m => (
          <Link
            key={m.key}
            href={m.href}
            className={`px-5 py-4 text-base font-semibold border-b-[3px] whitespace-nowrap transition-colors ${active === m.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
          >
            {m.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
