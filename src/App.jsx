import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleUserRound, Clock3, FileText, FolderOpen, MessageCircle, Play, Plus, Search, Sparkles, Upload, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { seedInitialNexusData } from './nexusData'

const emptyCourse = { title: '尚未同步課程', category: '等待同步', lessonCount: 0, processedCaptionCount: 0, color: 'amber' }

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

function Inbox({ back, setPage, jobs }) {
  return <section className="app-page"><PageHeader eyebrow="Codex 處理流程" title="處理紀錄" description="課程先下載到本機，由 Codex 整理；網站只同步已完成的知識結果，不重複上傳原始影音。" back={back} />
    <div className="notice"><Check size={25} />本機資料夾處理完成後，會同步清理逐字稿、筆記、提示詞與來源時間碼。</div>
    <div className="section-row"><h2>最近處理的課程</h2><button onClick={() => setPage('courses')}>查看課程庫 <ArrowRight size={22} /></button></div>
    <div className="inbox-list">{jobs.map(item => <article key={item.id} className="inbox-item"><span className="item-icon"><FileText size={29} /></span><div><h3>{item.status}</h3><p>{item.videoCount || 0} 部影片 · {item.pdfCount || 0} 份講義 · {item.captionCount || 0} 份字幕</p></div><strong className="status">已同步</strong><button aria-label="查看處理紀錄"><ArrowRight size={25} /></button></article>)}</div>
  </section>
}

function Courses({ back, setPage, setSelectedCourse, courseList }) {
  const [active, setActive] = useState(courseList[0] || emptyCourse)
  useEffect(() => { if (courseList[0]) setActive(courseList[0]) }, [courseList])
  return <section className="app-page"><PageHeader eyebrow="你的學習地圖" title="課程庫" description="所有課程、單元、字幕、筆記與提示詞都保有清楚的來源關係。" back={back} />
    <div className="course-toolbar"><div><Search size={27} /><input placeholder="搜尋課程、概念或工具" /></div><button><Plus size={24} />新增課程</button></div>
    <div className="course-grid">{courseList.map(course => <button key={course.id} className={`course-card ${course.color || 'amber'} ${active.id === course.id ? 'selected' : ''}`} onClick={() => setActive(course)}><span>{course.category}</span><h2>{course.title}</h2><p>{course.lessonCount || 0} 部影片 · {course.processedCaptionCount || 0} 份字幕已整理</p><ArrowRight size={25} /></button>)}</div>
    <section className="course-detail"><div><span className="eyebrow">目前選取</span><h2>{active.title}</h2><p>從原始素材到可搜尋的完整逐字稿、課程筆記與可執行工作流，都集中在這裡。</p></div><div className="detail-actions"><button onClick={() => { setSelectedCourse(active); setPage('detail') }}><BookOpen size={25} />打開課程</button><button onClick={() => setPage('chat')}><Search size={25} />搜尋這門課</button></div></section>
  </section>
}

function CourseDetail({ course, back, setPage, lessons }) {
  const [unit, setUnit] = useState(lessons[0])
  const [tab, setTab] = useState('overview')
  useEffect(() => { if (lessons[0]) setUnit(lessons[0]) }, [lessons])
  useEffect(() => { if (unit && tab === 'prompt' && !unit.prompts?.length) setTab('overview') }, [unit, tab])
  if (!unit) return <section className="app-page"><PageHeader eyebrow="課程詳情" title={course.title} description="正在讀取單元資料…" back={back} /></section>
  return <section className="app-page course-detail-page"><PageHeader eyebrow="課程詳情" title={course.title} description={`${course.category} · ${course.lessonCount || 0} 部影片 · ${course.processedCaptionCount || 0} 份字幕已整理`} back={back} />
    <div className="course-detail-layout"><aside className="unit-sidebar"><div><span className="eyebrow">已處理字幕單元</span><strong>{lessons.length.toString().padStart(2, '0')}</strong></div>{lessons.map(item => <button key={item.id} onClick={() => setUnit(item)} className={unit.id === item.id ? 'selected' : ''}><span>{item.status}</span><b>{item.title}</b><small><Clock3 size={17} />{item.duration}</small></button>)}</aside>
      <article className="lesson-panel"><header><span className="eyebrow">目前閱讀</span><h2>{unit.title}</h2><div className="lesson-meta"><span><Video size={20} />影片長度 {unit.duration}</span><span><FileText size={20} />原始字幕已保留</span></div></header>
        <div className="lesson-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>重點筆記</button>{unit.prompts?.length > 0 && <button className={tab === 'prompt' ? 'active' : ''} onClick={() => setTab('prompt')}>提示詞與工作流</button>}<button className={tab === 'sources' ? 'active' : ''} onClick={() => setTab('sources')}>來源時間碼</button></div>
        <AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="lesson-content">
          {tab === 'overview' && <><h3>這一課在教什麼？</h3><p>{unit.summary || '此單元正在等待本機處理結果同步。'}</p><div className="key-points"><span>本課已整理</span><ol><li>完整繁體字幕，保留全部 {unit.captionCues?.toLocaleString() || 0} 段時間碼。</li><li>原始字幕與清理版分開保留。</li><li>內容可回到來源時間碼確認。</li></ol></div></>}
          {tab === 'prompt' && <><h3>提示詞與工作流</h3>{unit.prompts.map(item => <div className="prompt-block" key={item.title}><strong>{item.title}</strong><code>{item.content}</code></div>)}</>}
          {tab === 'sources' && <><h3>可回查來源</h3><div className="timeline">{(unit.sourceTimeRanges || []).map(time => <button key={time}><time>{time}</time><span>已同步來源時間碼</span><Play size={20} /></button>)}{!unit.sourceTimeRanges?.length && <p>此單元尚未同步可回查的時間碼。</p>}</div></>}
        </motion.div></AnimatePresence>
        <footer><button onClick={() => setPage('chat')}><Search size={23} />搜尋這一課</button></footer>
      </article>
    </div>
  </section>
}

function Chat({ back, setPage, courseList, lessons }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([{ who: 'ai', text: '輸入關鍵字、工具名稱或課程概念，我會找出完整逐字稿、筆記、提示詞與對應來源。' }])
  const send = () => {
    const text = question.trim()
    if (!text) return
    const terms = text.toLowerCase().split(/\s+/).filter(Boolean)
    const matches = [
      ...courseList.map(course => ({ type: '課程', title: course.title, detail: [course.category, ...(course.tags || [])].join(' · '), source: '課程總覽' })),
      ...lessons.map(lesson => ({ type: '單元', title: lesson.title, detail: lesson.summary || lesson.status, source: lesson.sourceTimeRanges?.[0] || '單元筆記' })),
    ].filter(item => terms.every(term => `${item.title} ${item.detail}`.toLowerCase().includes(term))).slice(0, 6)
    const answer = matches.length
      ? `找到 ${matches.length} 筆相關資料：\n${matches.map(item => `・${item.type}｜${item.title}\n  ${item.detail}`).join('\n')}`
      : '目前找不到完全相符的索引。可以改用課程名稱、工具名稱、標籤或單元名稱搜尋；完整逐字稿片段會在下一階段同步後加入搜尋。'
    setMessages(current => [...current, { who: 'me', text }, { who: 'ai', text: answer, source: matches.map(item => item.source).join(' · ') }])
    setQuestion('')
  }
  return <section className="app-page chat-page"><PageHeader eyebrow="不使用 AI API" title="知識搜尋" description="以課程、逐字稿、筆記、提示詞與來源時間碼做全文搜尋；每個結果都能回到原課內容。" back={back} />
    <div className="chat-layout"><aside><span className="eyebrow">試著搜尋</span><button onClick={() => setQuestion('AI 影片')}>AI 影片</button><button onClick={() => setQuestion('Seedance')}>Seedance</button><button onClick={() => setQuestion('互動視頻')}>互動視頻</button><button onClick={() => setPage('inbox')}><Clock3 size={24} />查看處理紀錄</button></aside><div className="chat-window"><div className="messages">{messages.map((message, i) => <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1 }} key={i} className={`message ${message.who}`}>{message.who === 'ai' && <Search size={23} />}<span style={{ whiteSpace: 'pre-line' }}>{message.text}</span>{message.who === 'ai' && i > 0 && <small>來源：{message.source || '知識庫索引'}</small>}</motion.div>)}</div><div className="chat-composer"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="搜尋課程、標籤、工具或單元名稱⋯⋯" /><button onClick={send} aria-label="開始搜尋"><Search size={24} /></button></div></div></div>
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
  const [lessons, setLessons] = useState([])
  const signIn = async () => { const result = await signInWithPopup(auth, new GoogleAuthProvider()); await setDoc(doc(db, 'users', result.user.uid), { displayName: result.user.displayName || 'Nexus 使用者', email: result.user.email || '', createdAt: serverTimestamp() }, { merge: true }) }
  useEffect(() => {
    if (!allowed) { setCourseList([]); setJobs([]); return }
    const ownCourses = query(collection(db, 'courses'), where('ownerId', '==', user.uid))
    const ownJobs = query(collection(db, 'processingJobs'), where('ownerId', '==', user.uid))
    const stopCourses = onSnapshot(ownCourses, async (snapshot) => {
      if (snapshot.empty) { await seedInitialNexusData(db, user); return }
      const nextCourses = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
      setCourseList(nextCourses)
      setSelectedCourse(current => current && nextCourses.some(item => item.id === current.id) ? current : nextCourses[0])
    })
    const stopJobs = onSnapshot(ownJobs, snapshot => setJobs(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))))
    return () => { stopCourses(); stopJobs() }
  }, [allowed, user])
  useEffect(() => {
    if (!selectedCourse?.id) { setLessons([]); return }
    return onSnapshot(collection(db, 'courses', selectedCourse.id, 'lessons'), snapshot => {
      setLessons(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (a.sequence || 0) - (b.sequence || 0)))
    })
  }, [selectedCourse?.id])
  if (!allowed) return <LoginGate user={user} ready={authReady} allowed={allowed} signIn={signIn} />
  return <main className="site-shell"><AnimatePresence mode="wait">{page === 'home' ? <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Home setPage={setPage} courseCount={courseList.length} jobCount={jobs.length} /></motion.div> : <motion.div key={page} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .25 }}><Nav page={page} setPage={setPage} />{page === 'inbox' && <Inbox back={() => setPage('home')} setPage={setPage} jobs={jobs} />}{page === 'courses' && <Courses back={() => setPage('home')} setPage={setPage} setSelectedCourse={setSelectedCourse} courseList={courseList} />}{page === 'chat' && <Chat back={() => setPage('home')} setPage={setPage} courseList={courseList} lessons={lessons} />}{page === 'obsidian' && <Obsidian back={() => setPage('home')} setPage={setPage} />}{page === 'account' && <Account back={() => setPage('home')} user={user} allowed={allowed} />}{page === 'detail' && selectedCourse && <CourseDetail course={selectedCourse} lessons={lessons} back={() => setPage('courses')} setPage={setPage} />}</motion.div>}</AnimatePresence></main>
}
