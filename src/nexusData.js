import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'

export async function seedInitialNexusData(db, user) {
  const courses = await getDocs(query(collection(db, 'courses'), where('ownerId', '==', user.uid)))
  if (!courses.empty) return

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
  })

  const lessons = [
    { id: 'opening', sequence: 1, title: '4-0｜開營儀式', duration: '64:03', status: '首輪筆記完成', captionCues: 2004, summary: '說明課程入口、資料包與學習方式，建立 AI 影片創作、個人 IP 與商業專案三個學習脈絡。', sourceTimeRanges: ['00:02:25', '00:10:00', '00:22:07', '00:55:18'] },
    { id: 'interactive-video', sequence: 2, title: '4-1-6｜AI 互動視頻自動獲客', duration: '字幕 3,757 段', status: '字幕已潤飾', captionCues: 3757, summary: '已保留可回查的完整字幕；後續可從單元筆記萃取工具、步驟與提示詞。', sourceTimeRanges: [] },
    { id: 'seedance', sequence: 3, title: '4-4-4｜Seedance 2.5 商業化項目拆解', duration: '字幕 3,457 段', status: '字幕已潤飾', captionCues: 3457, summary: '已保留可回查的完整字幕；後續可從單元筆記萃取商業化流程與提示詞。', sourceTimeRanges: [] },
  ]
  lessons.forEach(({ id, ...lesson }) => batch.set(doc(courseRef, 'lessons', id), { ...base, ...lesson }))

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
