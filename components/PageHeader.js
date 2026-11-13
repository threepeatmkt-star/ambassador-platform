// 모든 관리자 화면 공통 제목 영역: 왼쪽 제목·설명, 오른쪽 주요 버튼
export default function PageHeader({ title, desc, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {desc && <p className="text-gray-500 mt-1">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// 공통 요약 숫자 카드
export function StatCards({ items }) {
  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(it => {
        const Tag = it.onClick ? 'button' : 'div'
        return (
          <Tag key={it.label} onClick={it.onClick} className={`text-left bg-white rounded-2xl border p-5 ${it.onClick ? 'hover:border-orange-300 hover:shadow-sm transition' : ''}`}>
            <p className="text-gray-500 text-sm mb-1">{it.label}</p>
            <p className={`text-3xl font-bold tracking-tight ${it.color || 'text-gray-900'}`}>
              {it.value}{it.unit && <span className="text-base font-normal text-gray-400 ml-1">{it.unit}</span>}
            </p>
            {it.sub && <p className="text-xs text-gray-400 mt-1">{it.sub}</p>}
          </Tag>
        )
      })}
    </div>
  )
}
