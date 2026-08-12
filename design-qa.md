# Design QA

## Comparison target

- Source visual truth: `/var/folders/7n/lnsjl4p13p56gb0xr_gdwjw40000gn/T/codex-clipboard-1df41a26-269f-4d7e-8402-0a52eb1f7ded.png`
- Implementation screenshot: `implementation-hero.png`
- Comparison composite: `hero-comparison.png`
- Source dimensions: 455 × 800 px
- Implementation dimensions: 443 × 811 px
- Viewport/state: narrow responsive browser view, initial home hero at page top; source and implementation scaled to 800 px height for the composite.

## Evidence checked

- Full-view, side-by-side visual comparison in `hero-comparison.png`.
- Main interaction: entering a knowledge question and submitting displays a source-aware answer preview.
- Navigation: hero navigation and content-section links scroll to their target areas.
- Console: no warnings or errors captured.

## Required fidelity surfaces

- **Fonts and typography:** The hero keeps an English display wordmark in a clean geometric sans face, with Chinese reserved for supporting UI copy. Chinese body copy uses a dedicated Traditional Chinese font rather than falling back to a Latin typeface. The oversized wordmark, small top navigation, and cream-on-black hierarchy closely follow the source’s editorial rhythm.
- **Spacing and layout rhythm:** Both use a dark page with an inset rounded cinematic hero, top-centered hanging navigation, bottom-aligned oversized title, a restrained detail column, a centered dark editorial statement, and a four-part feature treatment. The implementation adapts that composition to a narrow responsive viewport.
- **Colors and tokens:** The page uses black and charcoal foundations, cream primary type and buttons, muted gray detail copy, and a warm amber cinematic image. No bright beige or floral visual system remains.
- **Image quality and asset fidelity:** The hero uses an original generated cloudscape asset, with matching low-light, warm-amber cinematic direction rather than a copied source image. UI icons are from the icon library.
- **Copy and app-specific content:** Source’s creative-studio copy is replaced with concise, relevant knowledge-base functions: private cross-domain learning memory, source-backed answers, transcript retention, and import of course materials.

## Findings

- No actionable P0, P1, or P2 mismatches for the intended adaptation. The implementation intentionally changes the original brand name and copy to support the personal knowledge-base product.

## Follow-up polish

- P3: Replace the working title `Nexus` once the final product name is chosen.
- P3: Add a second cinematic visual asset for the first feature panel in a later content pass.

## Comparison history

1. Initial full-page capture was not an aligned hero comparison. Fixed by returning the page to the first screen and capturing the responsive hero at the source’s portrait-like scale.
2. Final comparison used the aligned hero capture and found no actionable P0/P1/P2 issues.
3. Annotation update: replaced the still hero with the supplied cinematic MP4, switched the display wordmark to an italic editorial face, embedded the supplied 辰宇落雁體 2.0 font for Traditional Chinese UI text, and replaced generic feature claims with recent knowledge-base content. The updated mobile hero is captured in `updated-hero.png`; the new content cards use 18 px rounded corners.
4. Built and checked the 收集箱, 課程庫, and AI 問答 interior pages. `chat-page.png` captures a submitted question, generated source-cited answer, suggestion panel, and composer. `chat-style-comparison.png` verifies that the new functional page retains the source’s black, cream, cinematic visual language. Because no separate interior-page visual reference was supplied, this is a style-system consistency check rather than a layout clone.

## Interior-page checks

- 收集箱, 課程庫, and AI 問答 navigation each opened their matching page.
- AI 問答 accepts and displays a submitted question and an answer with an example course/time-range citation.
- No browser console errors or warnings were captured.

## Latest refinement

- Replaced the handwritten Chinese face with jf open 粉圓 2.1 for sustained reading.
- Reduced everyday interface text to a compact 14–19 px range while preserving the editorial display scale for primary headings.
- Captured the refined 收集箱 page in `compact-inbox.png`; it retains the dark, cream, rounded-panel visual language with a more practical information density.

## Course detail page

- Added a course detail page with a selectable unit list, four content views (重點筆記、清理逐字稿、提示詞、來源時間碼), prompt copying, and source-time entries.
- Tested the path 課程庫 → 打開課程 → 提示詞. The target tab rendered successfully without console errors.
- Captured the resulting screen in `course-detail.png`.

## Persistent navigation

- Replaced the centred rounded navigation pill with a full-width black top bar.
- The home navigation remains fixed at the top while scrolling.
- On small screens it changes to a clear two-column, two-row menu so all four destinations remain visible and easy to tap.

## Compact phone adjustment

- Refined the phone breakpoint after reviewing the iPhone 15 Pro preview: the four destination links now use one compact row, rather than taking two rows of the hero.

final result: passed
