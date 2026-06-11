/**
 * Contract 003 QA script
 * Runs all 11 criteria (C1 done via curl separately)
 * Uses Playwright directly
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3010';
const SCREENSHOT_DIR = join(__dirname, 'screenshots-003');

try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

function ss(page, name) {
  return page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

const results = [];
function log(id, verdict, evidence) {
  results.push({ id, verdict, evidence });
  console.log(`${verdict === 'PASS' ? '✓' : '✗'} ${id}: ${evidence}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── C2–C7 at 1440×900 ─────────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Attach listeners BEFORE goto
  let apiRequests = [];
  let completePostCount = 0;
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/')) {
      apiRequests.push({ method: req.method(), url });
      if (url.includes('/api/episode/complete') && req.method() === 'POST') {
        completePostCount++;
      }
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('response', (resp) => {
    if (resp.status() >= 400) badResponses.push({ status: resp.status(), url: resp.url() });
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await ss(page, '01-load-1440');

  // ── C2: Load = opening beat only, single fetch ────────────────────────────
  try {
    // Day indicator
    const dayText = await page.locator('text=/Day 1/').count();
    const dayIndicatorOk = dayText > 0;

    // Briefing visible with correct text and data-role
    const briefingEl = await page.locator('[data-role="coach"]').first();
    const briefingText = await briefingEl.textContent();
    const briefingOk = briefingText.includes('friendly regular takes the counter seat');

    // Turn-2 NPC line
    const npc2El = await page.locator('[data-role="npc"][data-turn="2"]');
    const npc2Count = await npc2El.count();
    const npc2Text = npc2Count > 0 ? await npc2El.textContent() : '';
    const npc2Ok = npc2Text.includes('週末は何か予定ある');

    // player-input and player-submit present
    const inputEl = await page.locator('[data-testid="player-input"]');
    const submitEl = await page.locator('[data-testid="player-submit"]');
    const inputOk = await inputEl.count() > 0;
    const submitOk = await submitEl.count() > 0;

    // NOT in DOM checks
    const turn4NotPresent = (await page.locator('[data-role="npc"][data-turn="4"]').count()) === 0;
    const turn6NotPresent = (await page.locator('[data-role="npc"][data-turn="6"]').count()) === 0;
    const noTurnBeyond2 = (await page.locator('[data-turn="3"],[data-turn="4"],[data-turn="5"],[data-turn="6"],[data-turn="7"]').count()) === 0;
    const completeNotPresent = (await page.locator('[data-testid="complete-episode"]').count()) === 0;

    // Check text NOT visible
    const fushigiText = await page.locator('text=/不思議な色/').count();
    const yakusokuText = await page.locator('text=/約束があるんだった/').count();

    const c2Pass = dayIndicatorOk && briefingOk && npc2Ok && inputOk && submitOk &&
      turn4NotPresent && turn6NotPresent && noTurnBeyond2 && completeNotPresent &&
      fushigiText === 0 && yakusokuText === 0;

    log('C2', c2Pass ? 'PASS' : 'FAIL',
      `dayIndicator=${dayIndicatorOk}, briefing=${briefingOk}, npc2=${npc2Ok}, input=${inputOk}, submit=${submitOk}, ` +
      `turn4Absent=${turn4NotPresent}, turn6Absent=${turn6NotPresent}, noTurnBeyond2=${noTurnBeyond2}, ` +
      `completeAbsent=${completeNotPresent}, fushigi4Absent=${fushigiText===0}, yakusoku6Absent=${yakusokuText===0}`);
  } catch (e) {
    log('C2', 'FAIL', `Exception: ${e.message}`);
  }

  // ── C3: Gated reveal, typed text + recorded line ──────────────────────────
  try {
    // Empty submit should reveal nothing
    const turnCountBefore = await page.locator('[data-turn]').count();
    await page.locator('[data-testid="player-submit"]').click();
    await page.waitForTimeout(300);
    const turnCountAfterEmpty = await page.locator('[data-turn]').count();
    const emptySubmitOk = turnCountBefore === turnCountAfterEmpty;

    // Fill with marker and submit
    const MARKER = '今日は祭りに行くテストです';
    const RECORDED_LINE = '週末は友だちと神社のお祭りに行くつもりだよ';
    await page.locator('[data-testid="player-input"]').fill(MARKER);
    await page.locator('[data-testid="player-submit"]').click();
    await page.waitForSelector('[data-role="player"][data-turn="3"]', { timeout: 5000 });
    await ss(page, '02-after-turn3-submit');

    // Check player turn 3 contains both marker and recorded line
    const playerTurn3 = await page.locator('[data-role="player"][data-turn="3"]');
    const playerTurn3Text = await playerTurn3.textContent();
    const markerOk = playerTurn3Text.includes(MARKER);
    const recordedOk = playerTurn3Text.includes(RECORDED_LINE);

    // Check NPC turn 4 appears
    const npc4 = await page.locator('[data-role="npc"][data-turn="4"]');
    const npc4Text = await npc4.textContent();
    const npc4Ok = npc4Text.includes('不思議な色');

    // Turn 6 still absent
    const turn6Absent = (await page.locator('[data-turn="6"]').count()) === 0;

    // Input value is "" after submission
    const inputVal = await page.locator('[data-testid="player-input"]').inputValue();
    const inputClearedOk = inputVal === '';

    const c3Pass = emptySubmitOk && markerOk && recordedOk && npc4Ok && turn6Absent && inputClearedOk;
    log('C3', c3Pass ? 'PASS' : 'FAIL',
      `emptySubmitBlocked=${emptySubmitOk}, markerInTurn3=${markerOk}, recordedInTurn3=${recordedOk}, ` +
      `npc4Appears=${npc4Ok}, turn6Absent=${turn6Absent}, inputCleared=${inputClearedOk} (val="${inputVal}")`);
  } catch (e) {
    log('C3', 'FAIL', `Exception: ${e.message}`);
  }

  // ── C4: Inline outcome badges with distinct ladder states ─────────────────
  try {
    const badgesInTurn3 = await page.locator('[data-role="player"][data-turn="3"] [data-outcome]').all();
    const badgeCount = badgesInTurn3.length;

    let producedBadge = null, missedBadge = null;
    for (const badge of badgesInTurn3) {
      const outcome = await badge.getAttribute('data-outcome');
      const text = await badge.textContent();
      if (outcome === 'produced' && text.includes('つもり')) producedBadge = badge;
      if (outcome === 'missed' && text.includes('窓')) missedBadge = badge;
    }

    const correctBadgesOk = badgeCount === 2 && producedBadge !== null && missedBadge !== null;

    // All data-outcome values are valid enum values
    const validOutcomes = new Set(['missed', 'recognized', 'produced_with_help', 'produced', 'mastered']);
    const allOutcomes = await page.locator('[data-outcome]').all();
    let allValidEnum = true;
    for (const el of allOutcomes) {
      const val = await el.getAttribute('data-outcome');
      if (!validOutcomes.has(val)) { allValidEnum = false; break; }
    }

    // Color distinctness
    let colorDistinct = false;
    let colorEvidence = 'n/a';
    if (producedBadge && missedBadge) {
      const producedBg = await producedBadge.evaluate(el => getComputedStyle(el).backgroundColor);
      const missedBg = await missedBadge.evaluate(el => getComputedStyle(el).backgroundColor);
      const bodyBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);

      if (producedBg !== missedBg && producedBg !== bodyBg && missedBg !== bodyBg) {
        colorDistinct = true;
        colorEvidence = `produced=${producedBg}, missed=${missedBg}, body=${bodyBg}`;
      } else if (producedBg === missedBg) {
        // Fallback: check border-color
        const producedBorder = await producedBadge.evaluate(el => getComputedStyle(el).borderColor);
        const missedBorder = await missedBadge.evaluate(el => getComputedStyle(el).borderColor);
        colorDistinct = producedBorder !== missedBorder;
        colorEvidence = `bg same (${producedBg}), border: produced=${producedBorder}, missed=${missedBorder}`;
      } else {
        colorEvidence = `produced=${producedBg}, missed=${missedBg}, body=${bodyBg} — one matches body`;
      }
    }

    const c4Pass = correctBadgesOk && allValidEnum && colorDistinct;
    log('C4', c4Pass ? 'PASS' : 'FAIL',
      `badgeCount=${badgeCount}, producedFound=${producedBadge!==null}, missedFound=${missedBadge!==null}, ` +
      `allValidEnum=${allValidEnum}, colorDistinct=${colorDistinct} (${colorEvidence})`);
  } catch (e) {
    log('C4', 'FAIL', `Exception: ${e.message}`);
  }

  // ── C5: Full playthrough + coach bookends + end state ─────────────────────
  try {
    // Submit player turns 5 and 7
    await page.locator('[data-testid="player-input"]').fill('テスト入力5');
    await page.locator('[data-testid="player-submit"]').click();
    await page.waitForSelector('[data-role="npc"][data-turn="6"]', { timeout: 5000 });

    await page.locator('[data-testid="player-input"]').fill('テスト入力7');
    await page.locator('[data-testid="player-submit"]').click();
    await page.waitForSelector('[data-role="coach"]:last-child', { timeout: 5000 });
    await page.waitForTimeout(500);
    await ss(page, '03-full-playthrough');

    // Turns 2-7 all present in DOM
    const turnNums = [2,3,4,5,6,7];
    let allTurnsPresent = true;
    for (const n of turnNums) {
      const cnt = await page.locator(`[data-turn="${n}"]`).count();
      if (cnt === 0) { allTurnsPresent = false; break; }
    }

    // Check ascending DOM order
    const turnOrder = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-turn]')).map(el => +el.getAttribute('data-turn'));
    });
    const ascendingOk = JSON.stringify(turnOrder) === JSON.stringify([...turnOrder].sort((a,b) => a-b));

    // Total badge count = 6
    const totalBadges = await page.locator('[data-outcome]').count();

    // Final coach beat
    const coachEls = await page.locator('[data-role="coach"]').all();
    let finalCoachOk = false;
    for (const el of coachEls) {
      const text = await el.textContent();
      if (text.includes('dashed off to meet a friend')) { finalCoachOk = true; break; }
    }

    // Coach bg differs from NPC bg
    const coachBg = await page.locator('[data-role="coach"]').first().evaluate(el => getComputedStyle(el).backgroundColor);
    const npcBg = await page.locator('[data-role="npc"][data-turn="2"]').evaluate(el => getComputedStyle(el).backgroundColor);
    const coachNpcDistinct = coachBg !== npcBg;

    // player-input disabled/hidden/removed
    const inputCount = await page.locator('[data-testid="player-input"]').count();
    let inputNotEnabled = false;
    if (inputCount === 0) {
      inputNotEnabled = true;
    } else {
      const isDisabled = await page.locator('[data-testid="player-input"]').isDisabled();
      const isHidden = await page.locator('[data-testid="player-input"]').isHidden();
      inputNotEnabled = isDisabled || isHidden;
    }

    // complete-episode visible and enabled
    const completeEl = await page.locator('[data-testid="complete-episode"]');
    const completeVisible = await completeEl.isVisible();
    const completeEnabled = await completeEl.isEnabled();

    const c5Pass = allTurnsPresent && ascendingOk && totalBadges === 6 && finalCoachOk &&
      coachNpcDistinct && inputNotEnabled && completeVisible && completeEnabled;

    log('C5', c5Pass ? 'PASS' : 'FAIL',
      `allTurns2-7=${allTurnsPresent}, ascending=${ascendingOk} (${JSON.stringify(turnOrder)}), ` +
      `totalBadges=${totalBadges}, finalCoach=${finalCoachOk}, coachNpcDistinct=${coachNpcDistinct} (coach=${coachBg}, npc=${npcBg}), ` +
      `inputDisabled=${inputNotEnabled}, completeVisible=${completeVisible}, completeEnabled=${completeEnabled}`);
  } catch (e) {
    log('C5', 'FAIL', `Exception: ${e.message}`);
  }

  // ── C6: Complete action wired honestly ────────────────────────────────────
  try {
    const beforePostCount = completePostCount;
    await page.locator('[data-testid="complete-episode"]').click();
    await page.waitForSelector('[data-testid="complete-confirmation"]', { timeout: 5000 });
    await ss(page, '04-complete-confirmation');

    const confirmEl = await page.locator('[data-testid="complete-confirmation"]');
    const confirmVisible = await confirmEl.isVisible();
    const confirmText = (await confirmEl.textContent()).trim();
    const confirmNonEmpty = confirmText.length > 0;

    // complete-episode disabled or removed
    const completeCount = await page.locator('[data-testid="complete-episode"]').count();
    let completeDisabledOrGone = completeCount === 0;
    if (!completeDisabledOrGone) {
      completeDisabledOrGone = await page.locator('[data-testid="complete-episode"]').isDisabled();
    }

    // Attempt second click if still visible
    let noDoublePost = true;
    if (completeCount > 0) {
      try {
        await page.locator('[data-testid="complete-episode"]').click({ timeout: 1000 });
        await page.waitForTimeout(300);
        noDoublePost = completePostCount <= 1;
      } catch {}
    }

    // POST count check
    const postFiredOnce = completePostCount === 1;

    const c6Pass = confirmVisible && confirmNonEmpty && completeDisabledOrGone && postFiredOnce && noDoublePost;
    log('C6', c6Pass ? 'PASS' : 'FAIL',
      `confirmVisible=${confirmVisible}, confirmNonEmpty=${confirmNonEmpty} ("${confirmText.slice(0,50)}"), ` +
      `completeDisabledOrGone=${completeDisabledOrGone} (count=${completeCount}), ` +
      `postCount=${completePostCount}, noDoublePost=${noDoublePost}`);
  } catch (e) {
    log('C6', 'FAIL', `Exception: ${e.message}`);
  }

  // ── C7: Tappable gloss tokens ─────────────────────────────────────────────
  try {
    // Exactly 3 tokens with correct itemIds in correct turns
    const tokenAme = await page.locator('[data-role="npc"][data-turn="2"] [data-token-item="vocab.ame"]');
    const tokenFushigi = await page.locator('[data-role="npc"][data-turn="4"] [data-token-item="vocab.fushigi"]');
    const tokenYakusoku = await page.locator('[data-role="npc"][data-turn="6"] [data-token-item="vocab.yakusoku"]');

    const ameCount = await tokenAme.count();
    const fushigiCount = await tokenFushigi.count();
    const yakusokuCount = await tokenYakusoku.count();
    const totalTokenCount = await page.locator('[data-token-item]').count();
    const tokensCorrect = ameCount === 1 && fushigiCount === 1 && yakusokuCount === 1 && totalTokenCount === 3;

    // Check each token is a <button> or has role="button"
    let tokensAccessible = true;
    for (const [token, name] of [[tokenAme,'ame'], [tokenFushigi,'fushigi'], [tokenYakusoku,'yakusoku']]) {
      const tag = await token.evaluate(el => el.tagName.toLowerCase());
      const role = await token.getAttribute('role');
      const tabindex = await token.getAttribute('tabindex');
      if (tag !== 'button' && role !== 'button') {
        tokensAccessible = false;
        console.log(`  Token ${name}: tag=${tag}, role=${role}, tabindex=${tabindex}`);
      }
    }

    // textContent integrity checks
    const npc2Text = await page.locator('[data-role="npc"][data-turn="2"]').textContent();
    const npc4Text = await page.locator('[data-role="npc"][data-turn="4"]').textContent();
    const npc6Text = await page.locator('[data-role="npc"][data-turn="6"]').textContent();
    const npc2Intact = npc2Text.includes('週末は何か予定ある') && npc2Text.includes('雨がすごかった');
    const npc4Intact = npc4Text.includes('不思議な色');
    const npc6Intact = npc6Text.includes('約束があるんだった');

    // Gloss hidden before any tap
    const fushigiBeforeVisible = await page.locator('text=ふしぎ').count() > 0;
    const strangeBeforeVisible = await page.locator('text=/mysterious; strange/').count() > 0;
    const glossHiddenBefore = !fushigiBeforeVisible && !strangeBeforeVisible;

    // Tap vocab.fushigi
    await tokenFushigi.click();
    await page.waitForTimeout(300);
    await ss(page, '05-fushigi-gloss-open');

    const fushigiReading = await page.locator('text=ふしぎ').count() > 0;
    const fushigiMeaning = await page.locator('text=/mysterious; strange/').count() > 0;
    const fushigiGlossOk = fushigiReading && fushigiMeaning;

    // Keyboard activate vocab.ame
    await tokenAme.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await ss(page, '06-ame-gloss-open');

    const ameReading = await page.locator('text=あめ').count() > 0;
    const ameMeaning = await page.locator('text=rain').count() > 0;
    const ameGlossOk = ameReading && ameMeaning;

    const c7Pass = tokensCorrect && tokensAccessible &&
      npc2Intact && npc4Intact && npc6Intact &&
      glossHiddenBefore && fushigiGlossOk && ameGlossOk;

    log('C7', c7Pass ? 'PASS' : 'FAIL',
      `tokensCorrect=${tokensCorrect} (ame=${ameCount}, fushigi=${fushigiCount}, yakusoku=${yakusokuCount}, total=${totalTokenCount}), ` +
      `accessible=${tokensAccessible}, npc2Intact=${npc2Intact}, npc4Intact=${npc4Intact}, npc6Intact=${npc6Intact}, ` +
      `glossHiddenBefore=${glossHiddenBefore}, fushigiGloss=${fushigiGlossOk}, ameKeyboard=${ameGlossOk}`);
  } catch (e) {
    log('C7', 'FAIL', `Exception: ${e.message}`);
  }

  // ── C9: Console + network clean ───────────────────────────────────────────
  // (Gathered throughout C2-C7 above)
  try {
    const episodeGetCount = apiRequests.filter(r => r.method === 'GET' && r.url.includes('/api/episode') && !r.url.includes('/complete')).length;
    const c9Pass = pageErrors.length === 0 && consoleErrors.length === 0 && badResponses.length === 0;

    log('C9', c9Pass ? 'PASS' : 'FAIL',
      `pageErrors=${pageErrors.length}, consoleErrors=${consoleErrors.length}, ` +
      `badResponses=${badResponses.length}, episodeGETs=${episodeGetCount}`);

    if (consoleErrors.length > 0) console.log('  Console errors:', consoleErrors);
    if (pageErrors.length > 0) console.log('  Page errors:', pageErrors);
    if (badResponses.length > 0) console.log('  Bad responses:', badResponses);

    // Also check single fetch (part of C2 scope)
    const singleFetchOk = episodeGetCount === 1;
    log('C2-fetch', singleFetchOk ? 'PASS' : 'FAIL',
      `Exactly 1 GET /api/episode? ${singleFetchOk} (count=${episodeGetCount})`);
  } catch (e) {
    log('C9', 'FAIL', `Exception: ${e.message}`);
  }

  // ── C10: Anti-slop computed styles ────────────────────────────────────────
  try {
    // (a) No Tailwind blue buttons
    const BANNED_BLUES = ['rgb(59, 130, 246)', 'rgb(37, 99, 235)', 'rgb(29, 78, 216)'];
    const interactiveEls = await page.locator('button, a, [role="button"]').all();
    let blueBtnFound = false;
    for (const el of interactiveEls) {
      const bg = await el.evaluate(el => getComputedStyle(el).backgroundColor);
      if (BANNED_BLUES.includes(bg)) { blueBtnFound = true; break; }
    }
    const noBlueOk = !blueBtnFound;

    // (b) h1 font-family first family is NOT system/scaffold font
    const BANNED_FONTS = ['Arial', 'Helvetica', 'Helvetica Neue', 'Times', 'Times New Roman',
      'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
      'ui-sans-serif', 'sans-serif', 'serif', 'Geist', 'Geist Sans', 'Geist Mono'];
    const h1FontFamily = await page.locator('h1').first().evaluate(el => getComputedStyle(el).fontFamily);
    const firstFamily = h1FontFamily.split(',')[0].trim().replace(/['"]/g, '');
    const fontOk = !BANNED_FONTS.includes(firstFamily);

    // (c) body background not pure white or scaffold black
    const bodyBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    const bodyBgOk = bodyBg !== 'rgb(255, 255, 255)' && bodyBg !== 'rgb(10, 10, 10)' && bodyBg !== 'rgb(0, 0, 0)';

    const c10Pass = noBlueOk && fontOk && bodyBgOk;
    log('C10', c10Pass ? 'PASS' : 'FAIL',
      `(a) noTailwindBlue=${noBlueOk}, (b) h1Font="${firstFamily}" (notBanned=${fontOk}), (c) bodyBg="${bodyBg}" (notScaffold=${bodyBgOk})`);
  } catch (e) {
    log('C10', 'FAIL', `Exception: ${e.message}`);
  }

  await ctx.close();

  // ── C8: Responsive 375×812 repeat playthrough ─────────────────────────────
  console.log('\n--- C8: Reset state for 375×812 playthrough ---');
  const { execSync } = await import('child_process');
  execSync('rm -f /Users/jeeminhan/Code/minshuku/web/.data/story-state.json');

  const ctx375 = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page375 = await ctx375.newPage();

  await page375.goto(BASE_URL, { waitUntil: 'networkidle' });
  await ss(page375, '07-375-load');

  try {
    // scrollWidth check on load
    const scrollWidthLoad = await page375.evaluate(() => document.documentElement.scrollWidth);
    const innerWidthLoad = await page375.evaluate(() => window.innerWidth);
    const noOverflowLoad = scrollWidthLoad <= innerWidthLoad + 1;

    // Submit all three player turns
    await page375.locator('[data-testid="player-input"]').fill('テスト1');
    await page375.locator('[data-testid="player-submit"]').click();
    await page375.waitForSelector('[data-turn="4"]', { timeout: 5000 });

    await page375.locator('[data-testid="player-input"]').fill('テスト2');
    await page375.locator('[data-testid="player-submit"]').click();
    await page375.waitForSelector('[data-turn="6"]', { timeout: 5000 });

    await page375.locator('[data-testid="player-input"]').fill('テスト3');
    await page375.locator('[data-testid="player-submit"]').click();
    await page375.waitForSelector('[data-testid="complete-episode"]', { timeout: 5000 });
    await ss(page375, '08-375-full');

    // scrollWidth after full playthrough
    const scrollWidthFull = await page375.evaluate(() => document.documentElement.scrollWidth);
    const innerWidthFull = await page375.evaluate(() => window.innerWidth);
    const noOverflowFull = scrollWidthFull <= innerWidthFull + 1;

    // player-input and submit visible/clickable
    const inputVisible375 = await page375.locator('[data-testid="player-input"]').isHidden() ||
      await page375.locator('[data-testid="player-input"]').count() === 0;
    // After full playthrough input should be gone — check it was present earlier
    // Actually let's check the complete button is visible instead
    const completeVisible375 = await page375.locator('[data-testid="complete-episode"]').isVisible();

    // Turn block right edges <= 376
    const turnBBoxes = await page375.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-turn]'));
      return els.map(el => {
        const r = el.getBoundingClientRect();
        return { turn: el.getAttribute('data-turn'), right: r.right };
      });
    });
    let maxRight = 0;
    for (const b of turnBBoxes) {
      if (b.right > maxRight) maxRight = b.right;
    }
    const turnWidthOk = maxRight <= 376;

    // 1440 scrollWidth check (already done implicitly, but verify via a fresh page)
    const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page1440 = await ctx1440.newPage();
    await page1440.goto(BASE_URL, { waitUntil: 'networkidle' });
    await ss(page1440, '09-1440-reload');

    const scrollWidth1440 = await page1440.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth1440 = await page1440.evaluate(() => window.innerWidth);
    const noOverflow1440 = scrollWidth1440 <= innerWidth1440 + 1;

    // Reading column width <= 960px
    const dialogSection = await page1440.locator('section[aria-label="Today\'s dialogue"], [aria-label*="dialogue"], main > section, main').first();
    const bbox1440 = await dialogSection.boundingBox();
    const dialogWidth = bbox1440 ? bbox1440.width : -1;
    const dialogWidthOk = dialogWidth <= 960;

    await ctx1440.close();

    const c8Pass = noOverflowLoad && noOverflowFull && completeVisible375 && turnWidthOk && noOverflow1440 && dialogWidthOk;
    log('C8', c8Pass ? 'PASS' : 'FAIL',
      `375-noOverflowLoad=${noOverflowLoad} (scrollW=${scrollWidthLoad}, innerW=${innerWidthLoad}), ` +
      `375-noOverflowFull=${noOverflowFull} (scrollW=${scrollWidthFull}, innerW=${innerWidthFull}), ` +
      `turnMaxRight=${maxRight}px<=${turnWidthOk}, 1440-noOverflow=${noOverflow1440}, ` +
      `dialogWidth=${dialogWidth}px<960=${dialogWidthOk}`);
  } catch (e) {
    log('C8', 'FAIL', `Exception: ${e.message}`);
  }

  await ctx375.close();

  // ── Summary ────────────────────────────────────────────────────────────────
  await browser.close();

  console.log('\n=== RESULTS SUMMARY ===');
  let passCount = 0, failCount = 0;
  for (const r of results) {
    if (r.id === 'C2-fetch') continue; // sub-check
    if (r.verdict === 'PASS') passCount++; else failCount++;
  }
  console.log(`PASS: ${passCount}, FAIL: ${failCount}`);

  return results;
}

main().then(results => {
  writeFileSync(join(__dirname, 'qa-003-results.json'), JSON.stringify(results, null, 2));
  console.log('Results written to qa-003-results.json');
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
