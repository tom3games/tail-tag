import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のIDは公開物に書かない。手元の gh から取って照らし合わせる
const ME = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim() } catch (e) { return '' } })()
const URL0 = 'https://tom3games.github.io/tail-tag/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? { ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal'] } : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__ttReady, null, { timeout: 15000 })
  // 遊びの通し: 始める → 相手に飛び込んで取る → 3分 → 順位発表
  if (opts.hasTouch) await p.tap('#btnStart'); else await p.click('#btnStart')
  await p.waitForTimeout(800)
  const flow = await p.evaluate(() => {
    tt.dbg.pause(true); tt.dbg.step(2); tt.m.t = 10
    const P = tt.m.players; tt.dbg.teleport(0, 10, 700, 0); Object.assign(P[0].r, { grounded: false, vz: 14 })
    Object.assign(P[1].r, { x: 0, y: 10, z: 701.8, vx: 0, vy: 0, vz: 0, grounded: false, rope: null, climbing: null })
    tt.dbg.step(2)
    const stole = tt.log.some(e => e.t === 'steal' && e.by === 0)
    tt.dbg.step(60 * 182); tt.dbg.pause(false)
    return { stole }
  })
  await p.waitForTimeout(2500)
  const res = await p.evaluate(() => ({ mode: tt.mode, rank: window.__lastRank, mute: window.__muteOk() }))
  out.push(`${name}: flow=${JSON.stringify(flow)} result=${JSON.stringify(res)}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/tail-tag', 'https://github.com/tom3games/tail-tag/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} personalId=${ME && (await p.content()).toLowerCase().includes(ME.toLowerCase()) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
