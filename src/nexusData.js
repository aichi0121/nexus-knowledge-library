import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'

export async function ensureInitialNexusData(db, user) {
  const courses = await getDocs(query(collection(db, 'courses'), where('ownerId', '==', user.uid)))
  const existingCourse = courses.docs.find(item => item.id === 'ai-video-creation-193')
  if (existingCourse?.data().schemaVersion >= 2) return

  const courseRef = doc(db, 'courses', 'ai-video-creation-193')
  const batch = writeBatch(db)
  const base = { ownerId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }

  batch.set(courseRef, {
    ...base,
    title: '193｜（墨夏班）AI影片創作 0-1 實戰營',
    category: '數位工具｜AI',
    tags: ['AI 影片', '短影音', 'Seedance', '內容創作'],
    status: '已完成現有外掛字幕潤飾',
    lessonCount: 123,
    processedCaptionCount: 3,
    captionCueCount: 9218,
    obsidianPath: '02-課程庫/193｜（墨夏班）AI影片創作0-1實戰營',
    schemaVersion: 2,
  }, { merge: true })

  const lessons = [
    { id: 'opening', sequence: 1, title: '4-0｜開營儀式', duration: '64:03', status: '首輪筆記完成', captionCues: 2004, summary: '說明課程入口、資料包與學習方式，建立 AI 影片創作、個人 IP 與商業專案三個學習脈絡。', tools: ['課程資料包', 'Obsidian Vault'], steps: ['先確認課程入口、資料包與單元安排。', '以單元為最小處理單位，保留原始來源與時間碼。', '把已整理的知識同步到網站與 Obsidian。'], sourceTimeRanges: ['00:02:25', '00:10:00', '00:22:07', '00:55:18'] },
    { id: 'interactive-video', sequence: 2, title: '4-1-6｜AI 互動視頻自動獲客', duration: '字幕 3,757 段', status: '字幕已潤飾', captionCues: 3757, summary: '已保留可回查的完整字幕；後續可從單元筆記萃取工具、步驟與提示詞。', tools: ['AI 互動影片工具'], steps: ['確認內容目標與互動情境。', '依單元字幕回查方法與實作細節。'], sourceTimeRanges: [] },
    { id: 'seedance', sequence: 3, title: '4-4-4｜Seedance 2.5 商業化項目拆解', duration: '字幕 3,457 段', status: '字幕已潤飾', captionCues: 3457, summary: '已保留可回查的完整字幕；後續可從單元筆記萃取商業化流程與提示詞。', tools: ['Seedance 2.5'], steps: ['拆解商業化專案的需求、產出與交付方式。', '以來源時間碼回查每個實作決策。'], sourceTimeRanges: [] },
  ]
  lessons.forEach(({ id, ...lesson }) => batch.set(doc(courseRef, 'lessons', id), { ...base, ...lesson }, { merge: true }))

  batch.set(doc(db, 'processingJobs', 'ai-video-creation-193'), {
    ...base,
    courseId: courseRef.id,
    status: '已完成現有外掛字幕潤飾',
    videoCount: 123,
    pdfCount: 2,
    captionCount: 3,
    warnings: ['內嵌字幕影片待建立本機轉錄流程'],
  })
  batch.set(doc(db, 'obsidianSync', 'ai-video-creation-193'), {
    ...base,
    courseId: courseRef.id,
    status: '已同步至 Vault',
    markdownPaths: ['00｜課程總覽.md', '01｜單元筆記', '02｜清理逐字稿', '99｜處理紀錄.md'],
  })
  await batch.commit()
}
