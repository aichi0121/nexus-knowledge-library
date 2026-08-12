import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleUserRound, Clock3, Copy, FileText, FileUp, FolderOpen, MessageCircle, Play, Plus, Search, Sparkles, Upload, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

const courses = [
  { title: '193｜（墨夏班）AI影片創作 0-1 實戰營', type: '數位工具｜AI', lessons: '123 部影片', progress: '3 份字幕已整理', color: 'amber' },
]

const inbox = [
  { name: '開營儀式.vtt', meta: '字幕檔 · 2,004 段 · 原始檔已保留', state: '已完成潤飾', icon: FileText },
  { name: 'AI 互動視頻自動獲客.vtt', meta: '字幕檔 · 3,757 段 · 原始檔已保留', state: '已完成潤飾', icon: FileText },
  { name: 'Seedance 2.5 商業化項目拆解.vtt', meta: '字幕檔 · 3,457 段 · 原始檔已保留', state: '已完成潤飾', icon: FileText },
]

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

function Home({ setPage }) {
  return <>
    <section className="hero" id="top">
      <video className="hero-image" autoPlay loop muted playsInline preload="metadata" aria-label="雲海之上的靜謐學習場景"><source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_171521_25968ba2-b594-4b32-aab7-f6b69398a6fa.mp4" type="video/mp4" /></video>
      <div className="hero-shade" />
      <nav className="top-nav" aria-label="首頁導覽"><button onClick={() => setPage('chat')}>知識搜尋</button><button onClick={() => setPage('courses')}>課程庫</button><button onClick={() => setPage('inbox')}>處理紀錄</button><button onClick={() => setPage('obsidian')}>Obsidian 知識庫</button><button className="account-button" onClick={() => setPage('account')} aria-label="登入與帳號" title="登入與帳號"><CircleUserRound size={21} /></button></nav>
      <div className="hero-content"><motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }} className="hero-title"><span>Nexus</span><sup>*</sup></motion.div><div className="hero-side"><motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 }}>一座只屬於你的跨領域學習記憶庫。把課程、字幕、講義與靈感，變成隨時找得到、用得上的理解。</motion.p><motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .5 }} className="primary-btn" onClick={() => setPage('chat')}>問問你的知識庫 <span><ArrowRight size={24} /></span></motion.button></div></div>
    </section>
    <section className="home-snapshot"><div><span className="eyebrow">今天的知識庫</span><h1>把學過的，<br /><em>變成用得上的。</em></h1></div><div className="snapshot-actions"><button onClick={() => setPage('chat')}><Search size={26} />知識搜尋 <b>快速找回</b></button><button onClick={() => setPage('courses')}><FolderOpen size={26} />課程庫 <b>1</b></button><button onClick={() => setPage('inbox')}><Clock3 size={26} />處理紀錄 <b>3</b></button><button onClick={() => setPage('obsidian')}><FileText size={26} />Obsidian 知識庫</button></div></section>
  </>
}

function PageHeader({ eyebrow, title, description, back }) { return <header className="page-header"><button className="back-button" onClick={back}><ArrowLeft size={25} />回到首頁</button><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></header> }

function Inbox({ back, setPage }) {
  return <section className="app-page"><PageHeader eyebrow="Codex 處理流程" title="處理紀錄" description="課程先下載到本機，由 Codex 整理；網站只同步已完成的知識結果，不重複上傳原始影音。" back={back} />
    <div className="notice"><Check size={25} />本機資料夾處理完成後，會同步清理逐字稿、筆記、提示詞與來源時間碼。</div>
    <div className="section-row"><h2>最近處理的課程</h2><button onClick={() => setPage('courses')}>查看課程庫 <ArrowRight size={22} /></button></div>
    <div className="inbox-list">{inbox.map(item => { const Icon = item.icon; return <article key={item.name} className="inbox-item"><span className="item-icon"><Icon size={29} /></span><div><h3>{item.name}</h3><p>{item.meta}</p></div><strong className="status">{item.state}</strong><button aria-label={`查看 ${item.name}`}><ArrowRight size={25} /></button></article> })}</div>
  </section>
}

function Courses({ back, setPage, setSelectedCourse }) {
  const [active, setActive] = useState(courses[0])
  return <section className="app-page"><PageHeader eyebrow="你的學習地圖" title="課程庫" description="所有課程、單元、字幕、筆記與提示詞都保有清楚的來源關係。" back={back} />
    <div className="course-toolbar"><div><Search size={27} /><input placeholder="搜尋課程、概念或工具" /></div><button><Plus size={24} />新增課程</button></div>
    <div className="course-grid">{courses.map(course => <button key={course.title} className={`course-card ${course.color} ${active.title === course.title ? 'selected' : ''}`} onClick={() => setActive(course)}><span>{course.type}</span><h2>{course.title}</h2><p>{course.lessons} · {course.progress}</p><ArrowRight size={25} /></button>)}</div>
    <section className="course-detail"><div><span className="eyebrow">目前選取</span><h2>{active.title}</h2><p>從原始素材到可搜尋的完整逐字稿、課程筆記與可執行工作流，都集中在這裡。</p></div><div className="detail-actions"><button onClick={() => { setSelectedCourse(active); setPage('detail') }}><BookOpen size={25} />打開課程</button><button onClick={() => setPage('chat')}><Search size={25} />搜尋這門課</button></div></section>
  </section>
}

const units = [
  { title: '4-0｜開營儀式', time: '64:03', status: '首輪筆記完成' },
  { title: '4-1-6｜AI 互動視頻自動獲客', time: '字幕 3,757 段', status: '字幕已潤飾' },
  { title: '4-4-4｜Seedance 2.5 商業化項目拆解', time: '字幕 3,457 段', status: '字幕已潤飾' },
]

function CourseDetail({ course, back, setPage }) {
  const [unit, setUnit] = useState(units[0])
  const [tab, setTab] = useState('overview')
  const [copied, setCopied] = useState(false)
  const prompt = '以 [角色特徵] 為核心，維持人物臉部、髮型與服裝一致；鏡頭從 [起始畫面] 緩慢推進至 [最終畫面]，自然光線，電影感質地。'
  const copyPrompt = () => { navigator.clipboard?.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1600) }
  return <section className="app-page course-detail-page"><PageHeader eyebrow="課程詳情" title={course.title} description={`${course.type} · ${course.lessons} · ${course.progress}`} back={back} />
    <div className="course-detail-layout"><aside className="unit-sidebar"><div><span className="eyebrow">已處理字幕單元</span><strong>03 / 03</strong></div>{units.map(item => <button key={item.title} onClick={() => setUnit(item)} className={unit.title === item.title ? 'selected' : ''}><span>{item.status}</span><b>{item.title}</b><small><Clock3 size={17} />{item.time}</small></button>)}</aside>
      <article className="lesson-panel"><header><span className="eyebrow">目前閱讀</span><h2>{unit.title}</h2><div className="lesson-meta"><span><Video size={20} />影片長度 {unit.time}</span><span><FileText size={20} />原始字幕已保留</span></div></header>
        <div className="lesson-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>重點筆記</button><button className={tab === 'transcript' ? 'active' : ''} onClick={() => setTab('transcript')}>清理逐字稿</button><button className={tab === 'prompt' ? 'active' : ''} onClick={() => setTab('prompt')}>提示詞</button><button className={tab === 'sources' ? 'active' : ''} onClick={() => setTab('sources')}>來源時間碼</button></div>
        <AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="lesson-content">
          {tab === 'overview' && <><h3>這一課在教什麼？</h3><p>這門開營儀式說明課程入口、資料包與學習方式，並建立 AI 影片創作、個人 IP 與商業專案三個學習脈絡。原始字幕與影片均保留，筆記中的結論都可回到時間碼確認。</p><div className="key-points"><span>本課已整理</span><ol><li>完整繁體字幕，保留全部 2,004 段時間碼。</li><li>學習流程、工具脈絡與版權提醒。</li><li>5 組可回查的來源時間範圍。</li></ol></div></>}
          {tab === 'transcript' && <><h3>清理後逐字稿</h3><p className="transcript">這個網站僅展示同步後的知識索引。完整潤飾字幕已留在 Obsidian Vault；原始 VTT 不會被覆寫。</p><p className="transcript">目前已完成 3 份可回查字幕，合計 9,218 段，內嵌字幕影片仍待後續建立本機轉錄流程。</p></>}
          {tab === 'prompt' && <><h3>本課萃取的提示詞</h3><p>開營儀式未提供可直接複製的完整提示詞。後續會從實作單元擷取提示詞，並附上課程來源時間碼。</p></>}
          {tab === 'sources' && <><h3>可回查來源</h3><div className="timeline"><button><time>00:02:25</time><span>開營定位、資料包與課程入口</span><Play size={20} /></button><button><time>00:10:00</time><span>AI 生成、提示詞與創作者參與</span><Play size={20} /></button><button><time>00:22:07</time><span>課程亮點、工具內容與商業變現</span><Play size={20} /></button><button><time>00:55:18</time><span>知識庫更新、Codex 加餐與競賽問答</span><Play size={20} /></button></div></>}
        </motion.div></AnimatePresence>
        <footer><button onClick={() => setPage('chat')}><Search size={23} />搜尋這一課</button><button><FileUp size={23} />查看原始素材</button></footer>
      </article>
    </div>
  </section>
}

function Chat({ back, setPage }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([{ who: 'ai', text: '輸入關鍵字、工具名稱或課程概念，我會找出完整逐字稿、筆記、提示詞與對應來源。' }])
  const send = () => { const text = question.trim(); if (!text) return; setMessages([...messages, { who: 'me', text }, { who: 'ai', text: '目前已建立 3 份可搜尋的字幕知識：開營儀式、AI 互動視頻自動獲客，以及 Seedance 2.5 商業化項目拆解。' }]); setQuestion('') }
  return <section className="app-page chat-page"><PageHeader eyebrow="不使用 AI API" title="知識搜尋" description="以課程、逐字稿、筆記、提示詞與來源時間碼做全文搜尋；每個結果都能回到原課內容。" back={back} />
    <div className="chat-layout"><aside><span className="eyebrow">試著搜尋</span><button onClick={() => setQuestion('人物一致性 提示詞')}>人物一致性 提示詞</button><button onClick={() => setQuestion('商業思維 核心框架')}>商業思維 核心框架</button><button onClick={() => setQuestion('短影音 工作流程')}>短影音 工作流程</button><button onClick={() => setPage('inbox')}><Clock3 size={24} />查看處理紀錄</button></aside><div className="chat-window"><div className="messages">{messages.map((message, i) => <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`message ${message.who}`}>{message.who === 'ai' && <Search size={23} />}{message.text}{message.who === 'ai' && i > 0 && <small>來源：AI 影音製作全攻略 · 第 06 單元 · 00:14:20–00:18:55</small>}</motion.div>)}</div><div className="chat-composer"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="搜尋知識庫，例如：人物一致性、Runway、現金流⋯⋯" /><button onClick={send} aria-label="開始搜尋"><Search size={24} /></button></div></div></div>
  </section>
}

function Obsidian({ back, setPage }) {
  return <section className="app-page"><PageHeader eyebrow="自動生成的 Markdown" title="Obsidian 知識庫" description="Codex 完成課程整理後，系統會把可攜、可離線閱讀的 Markdown 筆記同步到你的 Obsidian Vault。" back={back} />
    <div className="course-detail"><div><span className="eyebrow">同步原則</span><h2>網站管理，Obsidian 留存。</h2><p>原始影音封存在 MEGA 與硬碟；清理後逐字稿、課程筆記、提示詞與來源時間碼會生成為 `.md`，方便你日後改用任何工具。</p></div><div className="detail-actions"><button onClick={() => setPage('courses')}><FolderOpen size={25} />查看已同步課程</button></div></div>
    <div className="section-row"><h2>最近同步</h2><button onClick={() => setPage('inbox')}>查看處理紀錄 <ArrowRight size={22} /></button></div>
    <div className="inbox-list"><article className="inbox-item"><span className="item-icon"><FileText size={29} /></span><div><h3>193｜AI影片創作 0-1 實戰營／開營儀式.md</h3><p>首輪筆記 · 完整逐字稿 · 5 組來源時間碼</p></div><strong className="status">已同步至 Vault</strong><button aria-label="查看 Obsidian 筆記"><ArrowRight size={25} /></button></article><article className="inbox-item"><span className="item-icon"><FileText size={29} /></span><div><h3>AI 互動視頻、Seedance 2.5／字幕潤飾版.vtt</h3><p>7,214 段字幕 · 原始檔完整保留</p></div><strong className="status">已產出</strong><button aria-label="查看字幕處理紀錄"><ArrowRight size={25} /></button></article></div>
  </section>
}

function Account({ back, user }) {
  const [busy, setBusy] = useState(false)
  const signIn = async () => { setBusy(true); try { const result = await signInWithPopup(auth, new GoogleAuthProvider()); await setDoc(doc(db, 'users', result.user.uid), { displayName: result.user.displayName || 'Nexus 使用者', email: result.user.email || '', createdAt: serverTimestamp() }, { merge: true }) } finally { setBusy(false) } }
  return <section className="app-page"><PageHeader eyebrow="私人知識庫" title="登入與帳號" description="正式上線後，這裡會使用你的帳號保護課程索引、處理紀錄與知識搜尋結果。" back={back} />
    <div className="course-detail"><div><span className="eyebrow">{user ? '已登入' : 'Firebase 已連線'}</span><h2>{user ? `歡迎回來，${user.displayName || 'Nexus 使用者'}。` : '建立你的私人入口。'}</h2><p>{user ? '你的課程、處理紀錄與搜尋資料會以此帳號隔離。' : '使用 Google 登入後，網站才會讀取或建立屬於你的知識庫資料。'}</p></div><div className="detail-actions"><button onClick={user ? () => signOut(auth) : signIn} disabled={busy}><CircleUserRound size={25} />{busy ? '登入中…' : user ? '登出' : '使用 Google 登入'}</button></div></div>
  </section>
}

export function App() {
  // Initialising these clients keeps the prototype connected to the dedicated
  // Nexus Firebase project. Data access stays blocked until Authentication and
  // owner-based Firestore rules are enabled.
  void auth
  void db
  const [page, setPage] = useState('home')
  const [user, setUser] = useState(null)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  const [selectedCourse, setSelectedCourse] = useState(courses[0])
  return <main className="site-shell"><AnimatePresence mode="wait">{page === 'home' ? <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Home setPage={setPage} /></motion.div> : <motion.div key={page} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .25 }}><Nav page={page} setPage={setPage} />{page === 'inbox' && <Inbox back={() => setPage('home')} setPage={setPage} />}{page === 'courses' && <Courses back={() => setPage('home')} setPage={setPage} setSelectedCourse={setSelectedCourse} />}{page === 'chat' && <Chat back={() => setPage('home')} setPage={setPage} />}{page === 'obsidian' && <Obsidian back={() => setPage('home')} setPage={setPage} />}{page === 'account' && <Account back={() => setPage('home')} user={user} />}{page === 'detail' && <CourseDetail course={selectedCourse} back={() => setPage('courses')} setPage={setPage} />}</motion.div>}</AnimatePresence></main>
}
