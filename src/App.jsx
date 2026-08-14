import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleUserRound, Clock3, FileText, FolderOpen, LayoutGrid, List, MessageCircle, Play, Plus, Search, Sparkles, Upload, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { collection, collectionGroup, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { ensureInitialNexusData } from './nexusData'

const emptyCourse = { title: '尚未同步課程', category: '等待同步', lessonCount: 0, processedCaptionCount: 0, color: 'amber' }
const courseCategory = course => course.manualCategory || course.category || '待分類'
const courseTags = course => course.manualTags || course.tags || []
const courseState = course => course.manualInventoryState || course.inventoryState || (course.noteCount ? '有筆記' : course.processedCaptionCount ? '字幕已整理' : course.rawCaptionCount ? '待整理' : '無字幕')
const courseOrder = course => Number((course.title || '').match(/^\s*(\d+)/)?.[1] || Number.MAX_SAFE_INTEGER)
const compareCourses = (a, b) => courseOrder(a) - courseOrder(b) || (a.title || '').localeCompare(b.title || '', 'zh-Hant')
const courseQuality = course => course.quality || { totalNotes: course.noteCount || 0, verifiedNotes: course.noteCount || 0, missingTimecodes: 0, pendingReview: 0, invalidNotes: 0 }
const qualityPercent = course => { const quality = courseQuality(course); return quality.totalNotes ? Math.round((quality.verifiedNotes || 0) / quality.totalNotes * 100) : 0 }
const dateValue = value => value?.toDate?.()?.getTime?.() || value?.seconds * 1000 || 0
const lessonOrder = lesson => (lesson.title.match(/^\d+(?:-\d+)*/) || ['999'])[0].split('-').map(value => Number(value))
const compareLessons = (a, b) => { const left = lessonOrder(a); const right = lessonOrder(b); for (let index = 0; index < Math.max(left.length, right.length); index += 1) { const result = (left[index] ?? -1) - (right[index] ?? -1); if (result) return result } return a.title.localeCompare(b.title, 'zh-Hant') }

function Nav({ page, setPage }) {
  return <nav className="app-nav" aria-label="主導覽">
    <button className="brand" onClick={() => setPage('home')}>Nexus<sup>*</sup></button>
    <div className="nav-links">
      <button className={page === 'chat' ? 'active' : ''} onClick={() => setPage('chat')}>知識搜尋</button>
      <button className={page === 'courses' ? 'active' : ''} onClick={() => setPage('courses')}>課程庫</button>
      <button className={page === 'inbox' ? 'active' : ''} onClick={() => setPage('inbox')}>處理紀錄</button>
      <button className={page === 'obsidian' ? 'active' : ''} onClick={() => setPage('obsidian')}>Obsidian 知識庫</button>
    </div>
    <button className="account-button" onClick={() => setPage('account')} aria-label="登入與帳號" title="登入與帳號"><CircleUserRound size={21} /></button>
  </nav>
}

function Home({ setPage, courseCount, jobCount }) {
  return <>
    <section className="hero" id="top">
      <img className="hero-image" src={`${import.meta.env.BASE_URL}assets/nexus-hero-clouds.png`} alt="雲海之上的靜謐學習場景" />
      <div className="hero-shade" />
      <nav className="top-nav" aria-label="首頁導覽"><button onClick={() => setPage('chat')}>知識搜尋</button><button onClick={() => setPage('courses')}>課程庫</button><button onClick={() => setPage('inbox')}>處理紀錄</button><button onClick={() => setPage('obsidian')}>Obsidian 知識庫</button><button className="account-button" onClick={() => setPage('account')} aria-label="登入與帳號" title="登入與帳號"><CircleUserRound size={21} /></button></nav>
      <div className="hero-content"><motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }} className="hero-title"><span>Nexus</span><sup>*</sup></motion.div><div className="hero-side"><motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 }}>一座只屬於你的跨領域學習記憶庫。把課程、字幕、講義與靈感，變成隨時找得到、用得上的理解。</motion.p><motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .5 }} className="primary-btn" onClick={() => setPage('chat')}>問問你的知識庫 <span><ArrowRight size={24} /></span></motion.button></div></div>
    </section>
    <section className="home-snapshot"><div><span className="eyebrow">今天的知識庫</span><h1>把學過的，<br /><em>變成用得上的。</em></h1></div><div className="snapshot-actions"><button onClick={() => setPage('chat')}><Search size={26} />知識搜尋 <b>快速找回</b></button><button onClick={() => setPage('courses')}><FolderOpen size={26} />課程庫 <b>{courseCount}</b></button><button onClick={() => setPage('inbox')}><Clock3 size={26} />處理紀錄 <b>{jobCount}</b></button><button onClick={() => setPage('obsidian')}><FileText size={26} />Obsidian 知識庫</button></div></section>
  </>
}

function PageHeader({ eyebrow, title, description, back }) { return <header className="page-header"><button className="back-button" onClick={back}><ArrowLeft size={25} />回到首頁</button><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></header> }

function Inbox({ back, setPage, jobs, syncStatus }) {
  const syncedAt = syncStatus?.lastCompletedAt?.toDate?.()
  const syncLabel = syncedAt ? syncedAt.toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '尚未取得同步紀錄'
  return <section className="app-page"><PageHeader eyebrow="Codex 處理流程" title="處理紀錄" description="課程先下載到本機，由 Codex 整理；網站只同步已完成的知識結果，不重複上傳原始影音。" back={back} />
    <div className="notice"><Check size={25} />本機資料夾處理完成後，會同步清理逐字稿、筆記、提示詞與來源時間碼。</div>
    <section className="sync-status" aria-label="同步狀態"><div><small>同步狀態</small><strong>{syncStatus?.status || '等待首次同步'}</strong></div><div><small>最後同步時間</small><strong>{syncLabel}</strong></div><div><small>待同步步數</small><strong>{syncStatus?.pendingSteps ?? 0}</strong></div><div><small>失敗原因</small><strong>{syncStatus?.failureReason || '無'}</strong></div></section>
    <div className="section-row"><h2>最近處理的課程</h2><button onClick={() => setPage('courses')}>查看課程庫 <ArrowRight size={22} /></button></div>
    <div className="inbox-list">{jobs.map(item => <article key={item.id} className="inbox-item"><span className="item-icon"><FileText size={29} /></span><div><h3>{item.status}</h3><p>{item.videoCount || 0} 部影片 · {item.pdfCount || 0} 份講義 · {item.captionCount || 0} 份字幕</p></div><strong className="status">已同步</strong><button aria-label="查看處理紀錄"><ArrowRight size={25} /></button></article>)}</div>
  </section>
}

function Courses({ back, setPage, setSelectedCourse, courseList }) {
  const [filter, setFilter] = useState('')
  const [category, setCategory] = useState('全部領域')
  const [state, setState] = useState('全部狀態')
  const [qualityFilter, setQualityFilter] = useState('全部品質')
  const [view, setView] = useState('list')
  const [sortBy, setSortBy] = useState('number')
  const [pageSize, setPageSize] = useState(25)
  const [pageNumber, setPageNumber] = useState(1)
  const categories = ['全部領域', ...new Set(courseList.map(course => courseCategory(course)).filter(Boolean))]
  const states = ['全部狀態', '有筆記', '字幕已整理', '待整理', '無字幕']
  const summary = courseList.reduce((total, course) => {
    const quality = courseQuality(course)
    total.total += quality.totalNotes || 0
    total.verified += quality.verifiedNotes || 0
    total.missing += quality.missingTimecodes || 0
    total.pending += quality.pendingReview || 0
    total.invalid += quality.invalidNotes || 0
    return total
  }, { total: 0, verified: 0, missing: 0, pending: 0, invalid: 0 })
  const qualityLabel = course => {
    const quality = courseQuality(course)
    if (quality.invalidNotes) return '內容品質不合格'
    if (quality.missingTimecodes) return '缺時間碼'
    if (quality.pendingReview) return '待人工校對'
    return quality.totalNotes ? '已完成知識筆記' : '尚無筆記'
  }
  const visibleCourses = courseList.filter(course => {
    const matchesText = `${course.title} ${courseCategory(course)} ${courseTags(course).join(' ')}`.toLowerCase().includes(filter.toLowerCase())
    const matchesQuality = qualityFilter === '全部品質' || qualityLabel(course) === qualityFilter
    return matchesText && matchesQuality && (category === '全部領域' || courseCategory(course) === category) && (state === '全部狀態' || courseState(course) === state)
  }).sort((a, b) => {
    if (sortBy === 'updated') return dateValue(b.updatedAt) - dateValue(a.updatedAt) || compareCourses(a, b)
    if (sortBy === 'state') return courseState(a).localeCompare(courseState(b), 'zh-Hant') || compareCourses(a, b)
    if (sortBy === 'quality') return qualityPercent(b) - qualityPercent(a) || compareCourses(a, b)
    return compareCourses(a, b)
  })
  const pageCount = Math.max(1, Math.ceil(visibleCourses.length / pageSize))
  const currentPage = Math.min(pageNumber, pageCount)
  const pagedCourses = visibleCourses.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const resetPage = setter => value => { setter(value); setPageNumber(1) }
  const openCourse = course => { setSelectedCourse(course); setPage('detail') }
  return <section className="app-page"><PageHeader eyebrow="你的學習地圖" title="課程庫" description="所有課程、單元、字幕、筆記與提示詞都保有清楚的來源關係。" back={back} />
    <section className="quality-dashboard" aria-label="課程品質總覽"><div><small>已完成知識筆記</small><strong>{summary.verified} / {summary.total}</strong><span>{summary.total ? `${Math.round(summary.verified / summary.total * 100)}% 已通過品質檢查` : '尚無單元筆記'}</span></div><button onClick={() => { setQualityFilter('缺時間碼'); setPageNumber(1) }}><small>缺時間碼</small><strong>{summary.missing}</strong><span>需要補上可回查來源</span></button><button onClick={() => { setQualityFilter('待人工校對'); setPageNumber(1) }}><small>待人工校對</small><strong>{summary.pending}</strong><span>已有內容，尚待確認</span></button><button onClick={() => { setQualityFilter('內容品質不合格'); setPageNumber(1) }}><small>內容品質不合格</small><strong>{summary.invalid}</strong><span>不會發布為正式筆記</span></button></section>
    <div className="course-toolbar course-toolbar-extended"><div><Search size={20} /><input value={filter} onChange={(event) => { setFilter(event.target.value); setPageNumber(1) }} placeholder="搜尋課程、標籤或工具" /></div><select value={category} onChange={event => resetPage(setCategory)(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select><select value={state} onChange={event => resetPage(setState)(event.target.value)}>{states.map(item => <option key={item}>{item}</option>)}</select><select value={qualityFilter} onChange={event => resetPage(setQualityFilter)(event.target.value)}>{['全部品質', '已完成知識筆記', '缺時間碼', '待人工校對', '內容品質不合格', '尚無筆記'].map(item => <option key={item}>{item}</option>)}</select><select aria-label="排序方式" value={sortBy} onChange={event => resetPage(setSortBy)(event.target.value)}><option value="number">依編號排序</option><option value="updated">最近更新</option><option value="state">處理狀態</option><option value="quality">筆記完成度</option></select><select aria-label="每頁筆數" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPageNumber(1) }}><option value={25}>每頁 25 門</option><option value={50}>每頁 50 門</option><option value={100}>每頁 100 門</option></select><div className="view-switch" aria-label="檢視方式"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="緊湊列表"><List size={18} />列表</button><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="卡片檢視"><LayoutGrid size={18} />卡片</button></div><span className="course-count">{visibleCourses.length} / {courseList.length} 門課</span></div>
    <div className={view === 'grid' ? 'course-grid' : 'course-list'}>{pagedCourses.map(course => view === 'grid' ? <button key={course.id} className={`course-card ${course.color || 'amber'}`} onClick={() => openCourse(course)}><span>{courseCategory(course)}</span><h2>{course.title}</h2><p>{course.lessonCount || 0} 個單元 · 原始字幕 {course.rawCaptionCount || 0} · 已整理 {course.processedCaptionCount || 0}</p><small className={`course-state ${courseState(course)}`}>{courseState(course)}</small><ArrowRight size={20} /></button> : <button key={course.id} className="course-list-row" onClick={() => openCourse(course)}><b className="course-number">{String(courseOrder(course)).padStart(3, '0')}</b><div className="course-list-title"><strong>{course.title}</strong><span>{courseCategory(course)} · {courseTags(course).slice(0, 3).join(' · ') || '未分類'}</span></div><div><small>內容筆記</small><strong>{courseQuality(course).verifiedNotes || 0} / {courseQuality(course).totalNotes || 0}</strong></div><div><small>字幕</small><strong>{course.processedCaptionCount || 0} / {course.rawCaptionCount || 0}</strong></div><div><small>品質</small><strong className={`quality-state ${qualityLabel(course)}`}>{qualityLabel(course)}</strong></div><small className={`course-state ${courseState(course)}`}>{courseState(course)}</small><ArrowRight size={19} /></button>)}{!visibleCourses.length && <p className="course-empty">沒有符合的課程。</p>}</div>
    {visibleCourses.length > pageSize && <nav className="course-pagination" aria-label="課程分頁"><button disabled={currentPage === 1} onClick={() => setPageNumber(value => value - 1)}>上一頁</button><span>第 {currentPage} / {pageCount} 頁</span><button disabled={currentPage === pageCount} onClick={() => setPageNumber(value => value + 1)}>下一頁</button></nav>}
  </section>
}

function CourseDetail({ course, back, setPage, lessons, initialLessonId, user }) {
  const [unit, setUnit] = useState(lessons[0])
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ summary: '', tools: '', steps: '' })
  const [courseEditing, setCourseEditing] = useState(false)
  const [courseSaving, setCourseSaving] = useState(false)
  const [courseDraft, setCourseDraft] = useState({ category: '', tags: '', state: '' })
  const [expandedSource, setExpandedSource] = useState('')
  const [sourceContexts, setSourceContexts] = useState({})
  const [loadingSource, setLoadingSource] = useState('')
  useEffect(() => { if (lessons[0]) setUnit(lessons[0]) }, [lessons])
  useEffect(() => { if (unit) setDraft({ summary: unit.summary || '', tools: (unit.tools || []).join('\n'), steps: (unit.steps || []).join('\n') }) }, [unit])
  useEffect(() => { setCourseDraft({ category: courseCategory(course), tags: courseTags(course).join('、'), state: courseState(course) }) }, [course])
  useEffect(() => { const target = lessons.find(item => item.id === initialLessonId); if (target) setUnit(target) }, [initialLessonId, lessons])
  useEffect(() => { if (unit && tab === 'prompt' && !unit.prompts?.length) setTab('overview') }, [unit, tab])
  const openSourceContext = async reference => {
    const key = `${unit.id}:${reference.time}`
    if (expandedSource === key) { setExpandedSource(''); return }
    setExpandedSource(key)
    if (sourceContexts[key]) return
    setLoadingSource(key)
    try {
      const start = reference.time.split(/[-–—]/)[0].trim().split(':').reduce((total, value) => total * 60 + Number(value), 0)
      const snapshot = await getDocs(query(collection(db, 'courses', course.id, 'transcriptSegments'), where('lessonId', '==', unit.id)))
      const segments = snapshot.docs.map(item => item.data()).sort((a, b) => a.startSeconds - b.startSeconds)
      if (!segments.length) {
        setSourceContexts(current => ({ ...current, [key]: { error: '這個單元尚未同步可展開的字幕內容。' } }))
        return
      }
      const closest = segments.reduce((best, segment, index) => Math.abs((segment.startSeconds || 0) - start) < Math.abs((segments[best]?.startSeconds || 0) - start) ? index : best, 0)
      setSourceContexts(current => ({ ...current, [key]: { before: segments[closest - 1], focus: segments[closest], after: segments[closest + 1] } }))
    } catch {
      setSourceContexts(current => ({ ...current, [key]: { error: '暫時無法讀取此時間碼的字幕上下文。' } }))
    } finally { setLoadingSource('') }
  }
  const saveNote = async () => {
    const changes = { summary: draft.summary.trim(), tools: draft.tools.split('\n').map(item => item.trim()).filter(Boolean), steps: draft.steps.split('\n').map(item => item.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean) }
    setSaving(true)
    try { await setDoc(doc(db, 'courses', course.id, 'lessons', unit.id), { ...changes, ownerId: user.uid, webEdit: { status: 'pending', changes, requestedAt: serverTimestamp() }, updatedAt: serverTimestamp() }, { merge: true }); setEditing(false) } finally { setSaving(false) }
  }
  const saveCourse = async () => {
    setCourseSaving(true)
    try { await setDoc(doc(db, 'courses', course.id), { ownerId: user.uid, manualCategory: courseDraft.category.trim() || course.category || '待分類', manualTags: courseDraft.tags.split(/[、,，\n]/).map(item => item.trim()).filter(Boolean), manualInventoryState: courseDraft.state, manualUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }); setCourseEditing(false) } finally { setCourseSaving(false) }
  }
  const courseEditor = <div className="course-management"><button className="course-management-toggle" onClick={() => setCourseEditing(value => !value)}>{courseEditing ? '取消分類調整' : '調整分類與狀態'}</button>{courseEditing && <div className="course-editor"><label>領域<input value={courseDraft.category} onChange={event => setCourseDraft({ ...courseDraft, category: event.target.value })} placeholder="例如：命理｜人生規劃" /></label><label>標籤（以頓號或逗號分隔）<input value={courseDraft.tags} onChange={event => setCourseDraft({ ...courseDraft, tags: event.target.value })} placeholder="例如：八字、五行、人生規劃" /></label><label>處理狀態<select value={courseDraft.state} onChange={event => setCourseDraft({ ...courseDraft, state: event.target.value })}>{['有筆記', '字幕已整理', '待整理', '無字幕'].map(item => <option key={item}>{item}</option>)}</select></label><button onClick={saveCourse} disabled={courseSaving}>{courseSaving ? '儲存中…' : '儲存課程設定'}</button><small>此處的手動設定會優先於自動盤點結果，不會被後續同步覆蓋。</small></div>}</div>
  if (!unit) return <section className="app-page"><PageHeader eyebrow="課程詳情" title={course.title} description={`${courseCategory(course)} · ${courseState(course)} · 原始字幕 ${course.rawCaptionCount || 0} 份`} back={back} />{courseEditor}<div className="course-detail"><div><span className="eyebrow">等待內容筆記完成</span><h2>這門課的字幕已保留，但尚未有通過品質檢查的知識筆記。</h2><p>網站不會再把字幕片段顯示成重點。完成 Obsidian 中的課程結論、重點整理與對應時間碼後，單元會自動出現在這裡並可搜尋。</p></div><div className="detail-actions"><button onClick={() => setPage('courses')}><FolderOpen size={22} />回到課程庫</button></div></div></section>
  return <section className="app-page course-detail-page"><PageHeader eyebrow="課程詳情" title={course.title} description={`${courseCategory(course)} · ${courseState(course)} · ${course.lessonCount || 0} 部影片 · ${course.processedCaptionCount || 0} 份字幕已整理`} back={back} />{courseEditor}
    <div className="course-detail-layout"><aside className="unit-sidebar"><div><span className="eyebrow">已處理字幕單元</span><strong>{lessons.length.toString().padStart(2, '0')}</strong></div>{lessons.map(item => <button key={item.id} onClick={() => setUnit(item)} className={unit.id === item.id ? 'selected' : ''}><span>{item.status}</span><b>{item.title}</b><small><Clock3 size={17} />{item.duration}</small></button>)}</aside>
      <article className="lesson-panel"><header><span className="eyebrow">目前閱讀</span><h2>{unit.title}</h2><div className="lesson-meta"><span><Video size={20} />影片長度 {unit.duration}</span><span><FileText size={20} />原始字幕已保留</span></div></header>
        <div className="lesson-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>重點筆記</button>{(unit.concepts?.length || unit.tools?.length || unit.steps?.length) > 0 && <button className={tab === 'methods' ? 'active' : ''} onClick={() => setTab('methods')}>概念與方法</button>}{unit.prompts?.length > 0 && <button className={tab === 'prompt' ? 'active' : ''} onClick={() => setTab('prompt')}>提示詞與工作流</button>}{unit.sourceReferences?.length > 0 && <button className={tab === 'sources' ? 'active' : ''} onClick={() => setTab('sources')}>重點時間碼</button>}</div>
        <div className="lesson-edit-actions"><button onClick={() => setEditing(value => !value)}>{editing ? '取消編輯' : '編輯本課筆記'}</button></div>{editing && <div className="lesson-editor"><label>本課摘要<textarea value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} /></label><label>工具／方法（每行一項）<textarea value={draft.tools} onChange={event => setDraft({ ...draft, tools: event.target.value })} /></label><label>學習步驟（每行一項）<textarea value={draft.steps} onChange={event => setDraft({ ...draft, steps: event.target.value })} /></label><button onClick={saveNote} disabled={saving}>{saving ? '儲存中…' : '儲存並同步至 Obsidian'}</button></div>}
        <AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="lesson-content">
          {tab === 'overview' && <><h3>這一課在教什麼？</h3><p>{unit.summary || '此單元正在等待本機處理結果同步。'}</p>{unit.keyPoints?.length > 0 && <div className="key-points"><span>本課重點</span><ol>{unit.keyPoints.map(point => <li key={point}>{point}</li>)}</ol></div>}</>}
          {tab === 'methods' && <><h3>概念與方法</h3>{unit.concepts?.length > 0 && <div className="key-points"><span>本課關鍵概念</span><ol>{unit.concepts.map(concept => <li key={concept}>{concept}</li>)}</ol></div>}{unit.tools?.length > 0 && <div className="key-points"><span>實際使用的工具</span><div className="tool-chips">{unit.tools.map(tool => <b key={tool}>{tool}</b>)}</div></div>}{unit.steps?.length > 0 && <div className="key-points"><span>學習／操作方法</span><ol>{unit.steps.map(step => <li key={step}>{step}</li>)}</ol></div>}</>}
          {tab === 'prompt' && <><h3>提示詞與工作流</h3>{unit.prompts.map(item => <div className="prompt-block" key={item.title}><strong>{item.title}</strong><code>{item.content}</code></div>)}</>}
          {tab === 'sources' && <><h3>重點對應時間碼</h3><p className="source-explainer">點選時間碼即可展開前段、對應段與後段字幕；「搜尋這一課」可回到完整字幕索引。</p><div className="timeline">{(unit.sourceReferences || []).map(reference => { const key = `${unit.id}:${reference.time}`; const context = sourceContexts[key]; return <div key={reference.time} className={`timeline-item ${expandedSource === key ? 'expanded' : ''}`}><button onClick={() => openSourceContext(reference)} aria-expanded={expandedSource === key}><time>{reference.time}</time><span>{reference.note}</span><ArrowRight size={17} /></button>{expandedSource === key && <div className="source-context">{loadingSource === key ? <p>正在載入字幕上下文…</p> : context?.error ? <p>{context.error}</p> : <>{[['前段', context?.before], ['對應段', context?.focus], ['後段', context?.after]].map(([label, segment]) => <div key={label} className={label === '對應段' ? 'focus' : ''}><small>{label}{segment ? ` · ${segment.startTime}–${segment.endTime}` : ''}</small><p>{segment?.cleanText || '沒有更多相鄰字幕。'}</p></div>)}</>}</div>}</div> })}</div></>}
        </motion.div></AnimatePresence>
        <footer><button onClick={() => setPage('chat')}><Search size={23} />搜尋這一課</button></footer>
      </article>
    </div>
  </section>
}

function Chat({ back, setPage, courseList, openResult }) {
  const [question, setQuestion] = useState('')
  const [searching, setSearching] = useState(false)
  const [domain, setDomain] = useState('全部領域')
  const [courseId, setCourseId] = useState('全部課程')
  const [sourceType, setSourceType] = useState('全部資料')
  const [messages, setMessages] = useState([{ who: 'ai', text: '輸入關鍵字、工具名稱或課程概念，我會找出完整逐字稿、筆記、提示詞與對應來源。' }])
  const searchTokens = text => [...new Set(text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).flatMap(token => token.length > 1 ? [token, ...[...token].filter(char => /[\p{Script=Han}]/u.test(char))] : []))]
  const send = async () => {
    const text = question.trim()
    if (!text) return
    setSearching(true)
    const terms = searchTokens(text)
    try {
      const ownerId = courseList[0]?.ownerId
      const primaryTerm = terms.find(term => /[\p{Script=Han}]/u.test(term))?.match(/[\p{Script=Han}]/u)?.[0] || terms[0]
      if (!ownerId || !primaryTerm) throw new Error('索引尚未建立')
      const selectedCourses = courseList.filter(course => (domain === '全部領域' || courseCategory(course) === domain) && (courseId === '全部課程' || course.id === courseId))
      const allowedCourses = new Set(selectedCourses.map(course => course.id))
      const wantsNotes = sourceType !== '字幕'
      const wantsCaptions = sourceType !== '筆記'
      const [noteSnapshot, transcriptSnapshot] = await Promise.all([
        wantsNotes ? getDocs(query(collection(db, 'searchIndex'), where('ownerId', '==', ownerId), where('searchTokens', 'array-contains', primaryTerm), limit(60))) : Promise.resolve({ docs: [] }),
        wantsCaptions ? getDocs(query(collectionGroup(db, 'transcriptSegments'), where('ownerId', '==', ownerId), where('searchTokens', 'array-contains', primaryTerm), limit(60))) : Promise.resolve({ docs: [] }),
      ])
      const includesTerms = item => terms.every(term => (item.searchTokens || []).includes(term) || (item.cleanText || item.summary || item.title || '').toLowerCase().includes(term))
      const lessonMatches = noteSnapshot.docs.map(item => item.data()).filter(item => allowedCourses.has(item.courseId) && includesTerms(item)).map(item => ({ type: '單元筆記', title: item.title, detail: item.summary || '已建立知識筆記', source: `${courseList.find(course => course.id === item.courseId)?.title || '課程'} · ${item.sourceTime || '單元筆記'}`, courseId: item.courseId, lessonId: item.lessonId }))
      const transcriptMatches = transcriptSnapshot.docs.map(item => item.data()).filter(item => allowedCourses.has(item.courseId) && includesTerms(item)).slice(0, 6).map(item => ({ type: '逐字稿片段', title: `${item.startTime}–${item.endTime}`, detail: item.cleanText.length > 150 ? `${item.cleanText.slice(0, 150)}…` : item.cleanText, source: `${courseList.find(course => course.id === item.courseId)?.title || '課程'} · ${item.startTime}`, courseId: item.courseId, lessonId: item.lessonId, sourceTime: item.startTime }))
      const matches = [...lessonMatches, ...transcriptMatches].slice(0, 8)
      const answer = matches.length ? `已搜尋全部 ${courseList.length} 門已入庫課程，找到 ${matches.length} 筆相關資料：\n${matches.map(item => `・${item.type}｜${item.title}\n  ${item.detail}`).join('\n')}` : '已搜尋全部已入庫課程，但找不到完全相符的索引。可改用課程名稱、概念、工具或字幕中的關鍵字。'
      setMessages(current => [...current, { who: 'me', text }, { who: 'ai', text: answer, source: matches.map(item => item.source).join(' · '), results: matches }])
      setQuestion('')
    } catch {
      setMessages(current => [...current, { who: 'me', text }, { who: 'ai', text: '跨課程搜尋暫時無法讀取索引，請重新整理後再試。' }])
    } finally { setSearching(false) }
  }
  return <section className="app-page chat-page"><PageHeader eyebrow="跨課程全文搜尋" title="知識搜尋" description="使用同步搜尋索引查詢筆記與字幕；每個結果都能回到對應課程與單元。" back={back} />
    <div className="chat-layout"><aside><span className="eyebrow">搜尋範圍</span><label>領域<select value={domain} onChange={event => setDomain(event.target.value)}><option>全部領域</option>{[...new Set(courseList.map(course => courseCategory(course)))].map(item => <option key={item}>{item}</option>)}</select></label><label>課程<select value={courseId} onChange={event => setCourseId(event.target.value)}><option value="全部課程">全部課程</option>{courseList.filter(course => domain === '全部領域' || courseCategory(course) === domain).map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>資料類型<select value={sourceType} onChange={event => setSourceType(event.target.value)}><option value="全部資料">筆記＋字幕</option><option value="筆記">筆記</option><option value="字幕">字幕／時間碼</option></select></label><span className="eyebrow">試著搜尋</span><button onClick={() => setQuestion('AI 影片')}>AI 影片</button><button onClick={() => setQuestion('Seedance')}>Seedance</button><button onClick={() => setQuestion('八字')}>八字</button><button onClick={() => setPage('inbox')}><Clock3 size={24} />查看處理紀錄</button></aside><div className="chat-window"><div className="messages">{messages.map((message, i) => <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1 }} key={i} className={`message ${message.who}`}>{message.who === 'ai' && <Search size={23} />}<span style={{ whiteSpace: 'pre-line' }}>{message.text}</span>{message.results?.map(result => <button className="search-result" key={`${result.type}-${result.title}-${result.source}`} onClick={() => openResult(result)}><span>{result.type}</span><b>{result.title}</b><small>{result.source}</small><ArrowRight size={17} /></button>)}{message.who === 'ai' && i > 0 && <small>來源：{message.source || '知識庫索引'}</small>}</motion.div>)}</div><div className="chat-composer"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="搜尋所有課程的筆記、概念、工具或逐字稿內容⋯⋯" /><button onClick={send} disabled={searching} aria-label="開始搜尋"><Search size={24} /></button></div></div></div>
  </section>
}

function Obsidian({ back, setPage }) {
  return <section className="app-page"><PageHeader eyebrow="自動生成的 Markdown" title="Obsidian 知識庫" description="Codex 完成課程整理後，系統會把可攜、可離線閱讀的 Markdown 筆記同步到你的 Obsidian Vault。" back={back} />
    <div className="course-detail"><div><span className="eyebrow">同步原則</span><h2>網站管理，Obsidian 留存。</h2><p>原始影音封存在 MEGA 與硬碟；清理後逐字稿、課程筆記、提示詞與來源時間碼會生成為 `.md`，方便你日後改用任何工具。</p></div><div className="detail-actions"><button onClick={() => setPage('courses')}><FolderOpen size={25} />查看已同步課程</button></div></div>
    <div className="section-row"><h2>最近同步</h2><button onClick={() => setPage('inbox')}>查看處理紀錄 <ArrowRight size={22} /></button></div>
    <div className="inbox-list"><article className="inbox-item"><span className="item-icon"><FileText size={29} /></span><div><h3>193｜AI影片創作 0-1 實戰營／開營儀式.md</h3><p>首輪筆記 · 完整逐字稿 · 5 組來源時間碼</p></div><strong className="status">已同步至 Vault</strong><button aria-label="查看 Obsidian 筆記"><ArrowRight size={25} /></button></article><article className="inbox-item"><span className="item-icon"><FileText size={29} /></span><div><h3>AI 互動視頻、Seedance 2.5／字幕潤飾版.vtt</h3><p>7,214 段字幕 · 原始檔完整保留</p></div><strong className="status">已產出</strong><button aria-label="查看字幕處理紀錄"><ArrowRight size={25} /></button></article></div>
  </section>
}

function Account({ back, user, allowed }) {
  const [busy, setBusy] = useState(false)
  const signIn = async () => { setBusy(true); try { const result = await signInWithPopup(auth, new GoogleAuthProvider()); await setDoc(doc(db, 'users', result.user.uid), { displayName: result.user.displayName || 'Nexus 使用者', email: result.user.email || '', createdAt: serverTimestamp() }, { merge: true }) } finally { setBusy(false) } }
  return <section className="app-page"><PageHeader eyebrow="私人知識庫" title="登入與帳號" description="正式上線後，這裡會使用你的帳號保護課程索引、處理紀錄與知識搜尋結果。" back={back} />
    <div className="course-detail"><div><span className="eyebrow">{user && allowed ? '已登入' : 'Firebase 已連線'}</span><h2>{user && allowed ? `歡迎回來，${user.displayName || 'Nexus 使用者'}。` : '建立你的私人入口。'}</h2><p>{user && !allowed ? '這個 Google 帳號尚未獲得 Nexus 的存取權。請改用已授權的帳號登入。' : user ? '你的課程、處理紀錄與搜尋資料會以此帳號隔離。' : '使用 Google 登入後，網站才會讀取或建立屬於你的知識庫資料。'}</p></div><div className="detail-actions"><button onClick={user ? () => signOut(auth) : signIn} disabled={busy}><CircleUserRound size={25} />{busy ? '登入中…' : user ? '登出並切換帳號' : '使用 Google 登入'}</button></div></div>
  </section>
}

function LoginGate({ user, ready, allowed, signIn }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const start = async () => {
    setBusy(true)
    setError('')
    try { await signIn() } catch (err) { setError(err?.code === 'auth/unauthorized-domain' ? '這個網站網址尚未加入 Firebase 的授權網域。' : '登入沒有完成，請再試一次。') } finally { setBusy(false) }
  }
  if (!ready) return <main className="login-gate"><span className="eyebrow">Nexus</span><h1>正在確認你的私人入口…</h1></main>
  return <main className="login-gate"><span className="eyebrow">Nexus 個人跨領域知識庫</span><h1>{user && !allowed ? '這個帳號尚未獲得存取權' : '你的知識庫，只開給你。'}</h1><p>{user && !allowed ? '請登出後，使用已授權的 Google 帳號登入。' : '請先使用已授權的 Google 帳號登入，再查看課程、逐字稿與學習紀錄。'}</p><button className="primary-btn" onClick={user ? () => signOut(auth) : start} disabled={busy}><CircleUserRound size={23} />{busy ? '登入中…' : user ? '登出並切換帳號' : '使用 Google 登入'}</button>{error && <small className="login-error">{error}</small>}</main>
}

export function App() {
  // Initialising these clients keeps the prototype connected to the dedicated
  // Nexus Firebase project. Data access stays blocked until Authentication and
  // owner-based Firestore rules are enabled.
  void auth
  void db
  const [page, setPage] = useState('home')
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const allowedEmail = 'aichi0121@gmail.com'
  const allowed = user?.email?.toLowerCase() === allowedEmail
  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthReady(true) }), [])
  const [courseList, setCourseList] = useState([])
  const [jobs, setJobs] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [selectedLessonId, setSelectedLessonId] = useState(null)
  const [lessons, setLessons] = useState([])
  const [syncStatus, setSyncStatus] = useState(null)
  const signIn = async () => { const result = await signInWithPopup(auth, new GoogleAuthProvider()); await setDoc(doc(db, 'users', result.user.uid), { displayName: result.user.displayName || 'Nexus 使用者', email: result.user.email || '', createdAt: serverTimestamp() }, { merge: true }) }
  useEffect(() => {
    if (!allowed) { setCourseList([]); setJobs([]); setSyncStatus(null); return }
    const ownCourses = query(collection(db, 'courses'), where('ownerId', '==', user.uid))
    const ownJobs = query(collection(db, 'processingJobs'), where('ownerId', '==', user.uid))
    const stopCourses = onSnapshot(ownCourses, async (snapshot) => {
      await ensureInitialNexusData(db, user)
      if (snapshot.empty) return
      const nextCourses = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort(compareCourses)
      setCourseList(nextCourses)
      setSelectedCourse(current => current ? nextCourses.find(item => item.id === current.id) || nextCourses[0] : nextCourses[0])
    })
    const stopJobs = onSnapshot(ownJobs, snapshot => setJobs(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))))
    const stopStatus = onSnapshot(doc(db, 'syncStatus', 'nexus'), snapshot => setSyncStatus(snapshot.exists() ? snapshot.data() : null))
    return () => { stopCourses(); stopJobs(); stopStatus() }
  }, [allowed, user])
  useEffect(() => {
    if (!selectedCourse?.id) { setLessons([]); return }
    return onSnapshot(collection(db, 'courses', selectedCourse.id, 'lessons'), snapshot => {
      setLessons(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => item.isPublished !== false).sort(compareLessons))
    })
  }, [selectedCourse?.id])
  const openSearchResult = (result) => {
    const course = courseList.find(item => item.id === result.courseId) || selectedCourse
    if (course) setSelectedCourse(course)
    setSelectedLessonId(result.lessonId || null)
    setPage('detail')
  }
  if (!allowed) return <LoginGate user={user} ready={authReady} allowed={allowed} signIn={signIn} />
  return <main className="site-shell"><AnimatePresence mode="wait">{page === 'home' ? <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Home setPage={setPage} courseCount={courseList.length} jobCount={jobs.length} /></motion.div> : <motion.div key={page} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .25 }}><Nav page={page} setPage={setPage} />{page === 'inbox' && <Inbox back={() => setPage('home')} setPage={setPage} jobs={jobs} syncStatus={syncStatus} />}{page === 'courses' && <Courses back={() => setPage('home')} setPage={setPage} setSelectedCourse={setSelectedCourse} courseList={courseList} />}{page === 'chat' && <Chat back={() => setPage('home')} setPage={setPage} courseList={courseList} openResult={openSearchResult} />}{page === 'obsidian' && <Obsidian back={() => setPage('home')} setPage={setPage} />}{page === 'account' && <Account back={() => setPage('home')} user={user} allowed={allowed} />}{page === 'detail' && selectedCourse && <CourseDetail course={selectedCourse} lessons={lessons} initialLessonId={selectedLessonId} back={() => setPage('courses')} setPage={setPage} user={user} />}</motion.div>}</AnimatePresence></main>
}
