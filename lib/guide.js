// 삼대오백 광고제품 콘텐츠 가이드 (마케팅팀 기존 양식 그대로)
//
// 안녕하세요, 삼대오백 마케팅팀입니다.
//
// 11월 콘텐츠 가이드 전달 드립니다!
//
// ✅11월 광고제품
// 📦제품 표시명
// 링크
//
// 📍콘텐츠 주제 (각 한 줄 요약)
// [A] 주제
// 설명
//
// 📢릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀
// 📢@samdae500_official 태그
//
// ─
// 📍제품 셀링포인트
// ✔ ...
//
// 📍해시태그
// #협찬 #삼대오백 ...

export const DEFAULT_NOTICES = '릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀\n@samdae500_official 태그'
export const DEFAULT_HASHTAGS = '#협찬 #삼대오백'
export const HASHTAG_COUNT = 5        // 최신 양식: 해시태그 5개 (#협찬 #삼대오백 + 3개)
export const MAX_SELLING_POINTS = 4   // 최신 양식: 셀링포인트 최대 4줄

/** 해시태그 정리: #협찬 #삼대오백 맨 앞, 중복 제거, 5개까지 */
export function normalizeHashtags(text, limit = HASHTAG_COUNT) {
  const tags = String(text || '').split(/\s+/).map(t => t.trim()).filter(t => t.startsWith('#') && t.length > 1)
  const rest = tags.filter(t => t !== '#협찬' && t !== '#삼대오백' && t !== '#광고')
  const out = ['#협찬', '#삼대오백', ...rest.filter((t, i) => rest.indexOf(t) === i)]
  return out.slice(0, limit).join(' ')
}

export function countHashtags(text) {
  return String(text || '').split(/\s+/).filter(t => t.startsWith('#') && t.length > 1).length
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function monthNumber(month) {
  const m = String(month || '').split('-')[1]
  return m ? String(Number(m)) : ''
}

function splitLines(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').split('\n')
}

function nonEmptyLines(text) {
  return splitLines(text).map(s => s.replace(/\s+$/, '')).filter(s => s.trim() !== '')
}

export function emptyItem(month) {
  return {
    month,
    title: '',
    pick_mode: 'one',
    links: '',
    topics: [{ title: '', body: '' }, { title: '', body: '' }],
    notices: DEFAULT_NOTICES,
    selling_points: '',
    hashtags: DEFAULT_HASHTAGS,
  }
}

/** 광고 아이템 1개 → 가이드 원문 */
export function formatGuide(item, month) {
  const m = monthNumber(month || item.month)
  const out = []
  out.push('안녕하세요, 삼대오백 마케팅팀입니다.')
  out.push('')
  out.push(`${m}월 콘텐츠 가이드 전달 드립니다!`)
  out.push(' ')
  out.push(`✅${m}월 광고제품`)
  out.push(`📦${String(item.title || '').trim()}`)
  nonEmptyLines(item.links).forEach(l => out.push(l.trim()))
  out.push('')

  const topics = (item.topics || []).filter(t => String(t.title || '').trim() || String(t.body || '').trim())
  if (topics.length) {
    out.push('📍콘텐츠 주제 (각 한 줄 요약)')
    topics.forEach((t, i) => {
      out.push(`[${LETTERS[i] || i + 1}] ${String(t.title || '').trim()}`)
      nonEmptyLines(t.body).forEach(l => out.push(l))
      out.push('')
    })
  }

  const notices = nonEmptyLines(item.notices)
  if (notices.length) {
    notices.forEach(n => out.push(n.startsWith('📢') ? n : `📢${n}`))
    out.push('')
  }

  out.push('─')
  const points = nonEmptyLines(item.selling_points)
  if (points.length) {
    out.push('📍제품 셀링포인트')
    points.forEach(p => out.push(p.startsWith('✔') ? p : `✔ ${p}`))
    out.push('')
  }

  const tags = nonEmptyLines(item.hashtags)
  if (tags.length) {
    out.push('📍해시태그')
    tags.forEach(t => out.push(t))
  }

  while (out.length && out[out.length - 1].trim() === '') out.pop()
  return out.join('\n')
}

const STD_NOTICE_REELS = '릴스로 권장드리며, 짧게 제작해주셔도 좋습니다😀'
const STD_NOTICE_TAG = '@samdae500_official 태그'

/**
 * 기존 가이드 원문(텍스트)을 항목별로 분해
 * 최신 양식뿐 아니라 이전 양식(1️⃣ 광고제품, ✔ 안내, 참고용) 셀링포인트, - 글머리, 업로드 주기,
 * 무상제품 안내, 여러 줄 해시태그 등)도 읽습니다.
 * @returns { item, month, dropped: [버려진 줄], descriptions: [→ 설명 줄] }
 */
export function parseGuide(text) {
  const lines = splitLines(String(text ?? '').replace(/^\uFEFF/, ''))
  const item = { title: '', links: '', topics: [], notices: '', selling_points: '', hashtags: '' }
  let month = ''
  let section = 'head'
  let topic = null
  const names = [], links = [], notices = [], points = [], tags = [], dropped = [], descriptions = []

  const isHeader = t => /^(✅|📍|1️⃣|2️⃣|3️⃣|-\s*광고제품)/.test(t)

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    const t = line.trim()
    if (!t) { if (section === 'topics') topic = null; continue }

    const mm = t.match(/(\d{1,2})월\s*(콘텐츠|광고제품)/)
    if (mm && !month) month = mm[1]

    // 섹션 머리말
    if (/광고제품/.test(t) && isHeader(t)) { section = 'product'; continue }
    if (/무상제품/.test(t) && isHeader(t)) { section = 'skip'; dropped.push(t); continue }
    if (/콘텐츠\s*주제/.test(t)) { section = 'topics'; topic = null; continue }
    if (/셀링포인트/.test(t)) { section = 'points'; continue }
    if (/해시태그/.test(t)) { section = 'tags'; continue }
    if (/업로드\s*주기/.test(t)) { section = 'skip'; dropped.push(t); continue }
    if (/^[─—]+$/.test(t)) { section = section === 'tags' ? 'skip' : 'sep'; topic = null; continue }
    if (/^안녕하세요|가이드 전달/.test(t)) continue

    // 안내 문구 (📢, 또는 주제 영역의 ✔)
    if (t.startsWith('📢') || (t.startsWith('✔') && (section === 'topics' || section === 'sep') && /릴스|태그|@samdae500|필수|공동작업자/.test(t))) {
      notices.push(t.replace(/^(📢|✔)\s*/, ''))
      continue
    }

    if (section === 'product') {
      if (/https?:\/\//.test(t)) { links.push(t.match(/https?:\/\/\S+/)[0]); continue }
      if (t.startsWith('→')) { descriptions.push(t.replace(/^→\s*/, '')); continue }
      const name = t.replace(/^📦\s*/, '').replace(/^◾\s*/, '')
      if (/^\(.*\)$/.test(name) && names.length) names[names.length - 1] += ' ' + name
      else names.push(name)
    } else if (section === 'topics') {
      const tm = t.match(/^\[([A-Z0-9]+)\]\s*(.*)$/)
      if (tm) { topic = { title: tm[2], body: '' }; item.topics.push(topic); continue }
      const body = t.replace(/^[-•·]\s*/, '')
      if (!topic) { topic = { title: body, body: '' }; item.topics.push(topic); continue }
      topic.body = topic.body ? `${topic.body}\n${body}` : body
    } else if (section === 'points') {
      if (t.startsWith('✔')) points.push(t.replace(/^✔\s*/, ''))
      else if (/^[-•·]/.test(t) && points.length && pointsHaveCheck(lines)) {
        points[points.length - 1] += ` (${t.replace(/^[-•·]\s*/, '')})`
      } else points.push(t.replace(/^[-•·]\s*/, ''))
    } else if (section === 'tags') {
      t.split(/\s+/).filter(x => x.startsWith('#')).forEach(x => tags.push(x))
    } else if (section === 'skip') {
      dropped.push(t)
    }
  }

  item.title = names.join(' & ')
  item.links = links.join('\n')
  item.notices = notices.join('\n')
  item.selling_points = points.join('\n')
  item.hashtags = tags.join(' ')
  if (item.topics.length === 0) item.topics = [{ title: '', body: '' }]
  return { item, month, dropped, descriptions }
}

function pointsHaveCheck(lines) {
  // 셀링포인트에 ✔ 줄이 있으면 '-' 줄은 바로 위 ✔ 줄의 보충 설명으로 합침
  let inPoints = false
  for (const l of lines) {
    const t = l.trim()
    if (/셀링포인트/.test(t)) { inPoints = true; continue }
    if (inPoints && /해시태그/.test(t)) break
    if (inPoints && t.startsWith('✔')) return true
  }
  return false
}

/** 분해한 가이드를 최신 양식 규칙으로 정리 */
export function toLatestFormat(parsed) {
  const { item, descriptions = [] } = parsed
  const notices = nonEmptyLines(item.notices).map(n => {
    if (/릴스/.test(n) && /권장/.test(n)) return STD_NOTICE_REELS
    if (/@samdae500_official/.test(n) && /태그/.test(n) && !/필수/.test(n)) return STD_NOTICE_TAG
    return n.replace(/\s+/g, ' ')
  })
  if (!notices.includes(STD_NOTICE_REELS)) notices.unshift(STD_NOTICE_REELS)
  if (!notices.some(n => /@samdae500_official/.test(n))) notices.push(STD_NOTICE_TAG)
  const points = [...descriptions, ...nonEmptyLines(item.selling_points)]
    .map(p => p.replace(/^✔\s*/, '').trim())
    .filter((p, i, arr) => p && arr.indexOf(p) === i)
    .map(p => `✔ ${p}`)
  return {
    ...item,
    topics: (item.topics || []).map(t => ({ title: String(t.title || '').trim(), body: nonEmptyLines(t.body).map(l => l.trim()).join('\n') })),
    notices: [...new Set(notices)].join('\n'),
    selling_points: points.join('\n'),
    hashtags: normalizeHashtags(item.hashtags),
  }
}

/** 가이드에서 빠진 항목 체크 */
export function guideWarnings(item) {
  const w = []
  if (!String(item.title || '').trim()) w.push('📦 제품 표시명 없음')
  if (nonEmptyLines(item.links).length === 0) w.push('제품 링크 없음')
  if (!(item.topics || []).some(t => String(t.title || '').trim())) w.push('콘텐츠 주제 없음')
  const pts = nonEmptyLines(item.selling_points).length
  if (pts === 0) w.push('셀링포인트 없음')
  else if (pts > MAX_SELLING_POINTS) w.push(`셀링포인트 ${pts}줄 (최대 ${MAX_SELLING_POINTS}줄)`)
  const tags = String(item.hashtags || '').trim()
  if (!tags.startsWith('#협찬 #삼대오백')) w.push('해시태그는 #협찬 #삼대오백 으로 시작')
  const n = countHashtags(tags)
  if (n !== HASHTAG_COUNT) w.push(`해시태그 ${n}개 (${HASHTAG_COUNT}개로 맞추기)`)
  return w
}
