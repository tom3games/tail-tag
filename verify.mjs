// 空中しっぽ取りの検証。node verify.mjs（テスト中は無音: mute.mjs）
import { chromium, webkit } from 'playwright'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { createWorld } from './shared/track.js'
import { setupArena } from './shared/arena.js'
import { createRunner, stepRunner, rayHit, findAnchor, RUN } from './shared/runner.js'
import { createMatch, stepMatch, TAG } from './shared/tag.js'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5392
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
const GL = ['--use-angle=metal', '--enable-unsafe-swiftshader']
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error' && !/GL Driver|WebGL|GPU stall/.test(m.text())) p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__ttReady, null, { timeout: 20000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('.screen:not(.hidden) *, #hud:not(.hidden) *')) {
    if (el.closest('.hidden') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.closest('#arrow,#miss,#say')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('.screen:not(.hidden) button,.screen:not(.hidden) a,.screen:not(.hidden) canvas,.screen:not(.hidden) h1,#hud:not(.hidden) button,#hud:not(.hidden) .rope-bar')) {
    if (el.closest('.hidden')) continue
    const r = el.getBoundingClientRect(); if (!r.width) continue
    if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom))
  }
  // 物干し・時計・休憩・スティック・跳ぶ・タイトルの部品が重ならない
  const rs = [...document.querySelectorAll('#hud:not(.hidden) .line,#hud:not(.hidden) .clock,#hud:not(.hidden) #btnPause,#touch:not(.hidden) .tbtn,#touch:not(.hidden) .stick,.screen:not(.hidden) .go,.screen:not(.hidden) .text-btn,.screen:not(.hidden) .logo')].map(e => [e.id || e.className, e.getBoundingClientRect()])
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i][1], b = rs[j][1]; if (a.width && b.width && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) over.push('overlap ' + rs[i][0] + '×' + rs[j][0]) }
  const lg = document.querySelector('.screen:not(.hidden) .logo span'); if (lg && lg.getClientRects().length > 1) over.push('logo wraps')
  return { H, over: over.slice(0, 6) }
})

// ---------------------------------------------------------------- 仕組み（node だけ）
const world = setupArena(createWorld('city'))
const B = world.bounds, CX = (B.x0 + B.x1) / 2
const step = (r, inp, n = 1) => { for (let i = 0; i < n; i++) { r.events.length = 0; stepRunner(r, inp, 1 / 60, world) } }
await t('ワイヤー: 届く距離は70m。遠い所は×で外れ、別の所にも勝手に掛からない', () => {
  const r = createRunner({ id: 'a', spawn: { x: 0, y: 0, z: 690, yaw: 0 } })
  step(r, { wire: true, wireAt: { x: 18, y: 40, z: 790 } })
  const miss = r.events.find(e => e.t === 'wireMiss')
  expect(!r.rope && miss && miss.far, JSON.stringify(r.events))
  const r2 = createRunner({ id: 'b', spawn: { x: 0, y: 0, z: 690, yaw: 0 } })
  step(r2, { wire: true, wireAt: { x: 18, y: 30, z: 740 } })
  expect(r2.rope, 'near not attached'); return { far: Math.round(miss.d), nearLen: +r2.rope.len.toFixed(1), range: RUN.wireRange }
})
await t('巻取ボタンは無い（boost を押しても何も変わらない）', () => {
  const mk = () => { const r = createRunner({ id: 'a', spawn: { x: 0, y: 12, z: 700, yaw: 0 } }); r.grounded = false; r.vz = 12; r.rope = { x: 0, y: 30, z: 712, len: 21, t: 0 }; return r }
  const a = mk(), b = mk()
  step(a, { boost: true }, 40); step(b, {}, 40)
  expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) < 1e-9, 'differs'); return true
})
await t('掛けた瞬間に位置が飛ばない（瞬間移動しない）・地面から掛けても振り子で浮く', () => {
  const r = createRunner({ id: 'a', spawn: { x: 0, y: 0, z: 690, yaw: 0 } })
  const a = findAnchor(world, r); expect(a, 'no anchor')
  const x0 = r.x, z0 = r.z
  step(r, { wire: true, wireAt: { x: a.x, y: a.y, z: a.z } })
  const jump1 = Math.hypot(r.x - x0, r.z - z0)
  let maxY = 0, landed = false, maxStep = 0, px = r.x, py = r.y, pz = r.z
  for (let i = 0; i < 90; i++) { step(r, { throttle: 1 }); if (r.events.some(e => e.t === 'land')) landed = true; maxY = Math.max(maxY, r.y); maxStep = Math.max(maxStep, Math.hypot(r.x - px, r.y - py, r.z - pz)); px = r.x; py = r.y; pz = r.z }
  expect(jump1 < 0.5 && maxStep < 0.7 && !landed && maxY > 3, JSON.stringify({ jump1, maxStep, landed, maxY })); return { firstStep: +jump1.toFixed(2), maxStepPerFrame: +maxStep.toFixed(2), maxY: +maxY.toFixed(1) }
})
await t('自動の巻き取り: 振り子のまま少しずつ縮む（重力は残る＝下へ落ちる時がある）', () => {
  const r = createRunner({ id: 'a', spawn: { x: 0, y: 14, z: 700, yaw: 0 } }); r.grounded = false; r.vz = 10; r.rope = { x: 0, y: 40, z: 712, len: 28, t: 0 }
  let minVy = 0; const L0 = r.rope.len
  for (let i = 0; i < 60 && r.rope; i++) { step(r, {}); minVy = Math.min(minVy, r.vy) }
  expect(r.rope && r.rope.len < L0 - 0.8 && r.rope.len > L0 - 8 && minVy < -1, JSON.stringify({ len: r.rope && r.rope.len, minVy })); return { L0, L1: +r.rope.len.toFixed(1), minVy: +minVy.toFixed(1) }
})
await t('飛ぶ方が走るより速い', () => {
  const r = createRunner({ id: 'a', spawn: { x: 0, y: 0, z: 600, yaw: 0 } })
  let run = 0; for (let i = 0; i < 120; i++) { step(r, { throttle: 1 }); run = Math.max(run, Math.hypot(r.vx, r.vz)) }
  const s = createRunner({ id: 'b', spawn: { x: 0, y: 0, z: 600, yaw: 0 } })
  let fly = 0, w = false
  for (let i = 0; i < 600; i++) { const inp = { throttle: 1, wire: false }; if (!s.rope && (s.grounded || s.vy < -2) && !w) { inp.wire = true; w = true } else w = false; step(s, inp); if (!s.grounded) fly = Math.max(fly, Math.hypot(s.vx, s.vz)) }
  expect(fly > run * 1.6, JSON.stringify({ run, fly })); return { run: +run.toFixed(1), fly: +fly.toFixed(1) }
})
await t('壁に張り付いたら上下左右に這える・何も押さなければ止まる・跳ぶで離れる', () => {
  const o = world.colliders.find(c => c.kind === 'building' && c.cx > B.x0 + 20 && c.cx < B.x1 - 20 && c.cz > B.z0 + 20 && c.cz < B.z1 - 20 && c.y1 > 40 && c.hw > 8)
  const r = createRunner({ id: 'a', spawn: { x: o.cx, y: 0, z: o.cz - o.hl - 1.5, yaw: 0 } })
  step(r, { throttle: 1 }, 30)
  expect(r.climbing, 'not climbing')
  const y0 = r.y; step(r, { climbY: 1, climbX: 0 }, 60); const up = r.y - y0
  const x0 = r.x; step(r, { climbY: 0, climbX: 1 }, 60); const side = r.x - x0
  const y1 = r.y; step(r, { climbY: 0, climbX: 0 }, 60); const still = Math.abs(r.y - y1)
  const y2 = r.y; step(r, { climbY: -1, climbX: 0 }, 30); const down = y2 - r.y
  const x1 = r.x; step(r, { climbY: 0, climbX: -1 }, 30); const left = Math.abs(x1 - r.x)
  expect(up > 4 && Math.abs(side) > 3 && still < 0.05 && down > 2 && left > 1.5 && r.climbing, JSON.stringify({ up, side, still, down, left, cl: !!r.climbing }))
  step(r, { jump: true }); expect(!r.climbing, 'jump did not leave')
  return { up: +up.toFixed(1), side: +side.toFixed(1), down: +down.toFixed(1) }
})
await t('電柱・街灯にもワイヤーが掛かる（狙いが少しずれても吸いつく）', () => {
  const p = world.poles[10]
  const ox = p.cx + 14, oy = 1.5, oz = p.cz + 6
  const dx = p.cx + 0.9 - ox, dy = p.y1 - 1 - oy, dz = p.cz - oz, L = Math.hypot(dx, dy, dz)
  const h = rayHit(world, ox, oy, oz, dx / L, dy / L, dz / L, 400)
  expect(h && h.pole && h.x === p.cx && h.z === p.cz, JSON.stringify(h))
  return { poles: world.poles.length, lampsSignals: world.extraAnchors.length - world.poles.length }
})
await t('しっぽ: 飛び込んだ方が取る・止まっている人は取れない・続けて取り返せない', () => {
  const rs = [0, 1, 2, 3].map(i => createRunner({ id: 'p' + i, spawn: { x: CX + i * 60, y: 0, z: 700 } }))
  const m = createMatch(world, rs, 1); m.t = 10
  for (const r of rs) { r.y = 8; r.grounded = false }
  rs[1].x = CX; rs[1].z = 702; rs[1].vz = -12
  stepMatch(m, 1 / 60)
  const ev = m.events.find(e => e.t === 'steal'); m.events.length = 0
  expect(ev && ev.by === 1 && ev.from === 0 && m.players[0].tails === 0 && m.players[1].tails === 2, JSON.stringify(ev))
  rs[2].x = CX + 100; rs[3].x = CX + 101; rs[2].z = rs[3].z = 700; rs[2].vx = rs[3].vx = rs[2].vz = rs[3].vz = 0; rs[2].vy = rs[3].vy = 0
  stepMatch(m, 1 / 60)
  const ev2 = m.events.find(e => e.t === 'steal' && e.by >= 2); m.events.length = 0
  rs[0].vz = 12; rs[1].vz = 0; rs[1].x = CX; rs[1].z = 701.5; stepMatch(m, 1 / 60)
  const ev3 = m.events.find(e => e.t === 'steal')
  expect(!ev2 && !ev3, JSON.stringify({ ev2, ev3 })); return { immune: TAG.immune, sameCd: TAG.sameCd }
})
await t('通りの地面に居続けると光る（屋上は光らない・始まって5秒は光らない）', () => {
  const rs = [0, 1, 2, 3].map(i => createRunner({ id: 'p' + i, spawn: { x: CX + i * 60, y: 0, z: 700 } }))
  const m = createMatch(world, rs, 1)
  for (let i = 0; i < 60 * 4; i++) stepMatch(m, 1 / 60)
  const early = m.players[0].glow
  for (let i = 0; i < 60 * 3; i++) stepMatch(m, 1 / 60)
  const late = m.players[0].glow
  rs[1].onRoof = true; rs[1].y = 40; m.players[1].groundT = 0
  for (let i = 0; i < 60 * 3; i++) stepMatch(m, 1 / 60)
  expect(!early && late && !m.players[1].glow, JSON.stringify({ early, late, roof: m.players[1].glow })); return true
})
await t('電柱の手ぬぐいは地面から跳んでも届かない', () => {
  const r = createRunner({ id: 'a', spawn: { x: 0, y: 0, z: 600 } })
  step(r, { jump: true }); let top = 0; for (let i = 0; i < 90; i++) { step(r, {}); top = Math.max(top, r.y) }
  const chest = top + 1.1, need = world.tailSpots[0].y - TAG.freeR
  expect(chest < need, JSON.stringify({ chest, need })); return { reach: +chest.toFixed(1), need: +need.toFixed(1) }
})
await t('bot: 上手い人が一番強く、地面だけ・何もしないは勝てない。下手な人も毎回1本は取る（12試合ずつ）', () => {
  const out = execFileSync(process.execPath, ['tools/sim.mjs', '12'], { cwd: ROOT, encoding: 'utf8', timeout: 600000 })
  const get = k => { const l = out.split('\n').find(s => s.startsWith(k)); return { rank: +l.match(/順位 ([\d.]+)/)[1], wins: +l.match(/1位 (\d+)/)[1], none: +l.match(/1本も取れず (\d+)/)[1], tails: +l.match(/本数 ([\d.]+)/)[1] } }
  const r = { skilled: get('skilled'), sloppy: get('sloppy'), ground: get('ground'), idle: get('idle') }
  expect(r.skilled.rank < r.sloppy.rank && r.sloppy.rank < r.ground.rank && r.ground.wins === 0 && r.idle.wins === 0 && r.sloppy.none === 0 && r.skilled.rank <= 2.3, JSON.stringify(r))
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, `順位${v.rank} 1位${v.wins} 本数${v.tails}`]))
})
await t('AI臭さチェック NG 0', () => {
  const out = execFileSync(process.execPath, [process.env.HOME + '/Desktop/claudecode/_shared/ai_tells.mjs', ROOT, '--json'], { encoding: 'utf8' })
  const j = JSON.parse(out); expect(j.ng === 0, JSON.stringify(j.items)); return j.items.map(i => i.key)
})

// ---------------------------------------------------------------- ブラウザ
const browser = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, ...GL] })
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
})
await t('OGP 一式がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('タイトルの後ろで CPU 4人が飛んでいる', async () => {
  const a = await p.evaluate(() => tt.m.players.map(q => [q.r.x, q.r.z]))
  await p.waitForTimeout(2000)
  const b = await p.evaluate(() => tt.m.players.map(q => [q.r.x, q.r.z]))
  const moved = a.filter((v, i) => Math.hypot(v[0] - b[i][0], v[1] - b[i][1]) > 2).length
  expect(moved >= 3, moved); return { moved }
})
await t('始める: 物干しに4人の手ぬぐいが1本ずつ・時計が3:00', async () => {
  await p.click('#btnStart'); await p.evaluate(() => tt.dbg.pause(true)); await p.evaluate(() => tt.dbg.step(3))
  const r = await p.evaluate(() => ({ pegs: [...document.querySelectorAll('.peg')].map(e => e.querySelectorAll('.towels i').length), clock: document.getElementById('clockT').textContent, mode: tt.mode }))
  expect(r.mode === 'play' && r.pegs.join() === '1,1,1,1' && /^(3:00|2:59)$/.test(r.clock), JSON.stringify(r)); return r
})
await t('画面タッチ: ビルに掛かる／遠すぎると×が出て掛からない', async () => {
  const r = await p.evaluate(() => {
    const me = tt.me.r
    tt.dbg.freezeCpu(true)
    tt.dbg.teleport(0, 0, 690, 0); tt.dbg.step(30)
    const cam = tt.camera
    const toScreen = (x, y, z) => { const V = new cam.position.constructor(x, y, z).project(cam); return { sx: (V.x * 0.5 + 0.5) * innerWidth, sy: (-V.y * 0.5 + 0.5) * innerHeight } }
    for (let sy = 200; sy < 600 && !me.rope; sy += 40) for (let sx = 40; sx < 360 && !me.rope; sx += 40) { tt.log.length = 0; tt.dbg.pressWire(sx, sy); tt.dbg.step(1) }
    const gotNear = !!me.rope, lenNear = me.rope ? Math.hypot(me.rope.x - me.x, me.rope.y - me.y, me.rope.z - me.z) : 0
    tt.dbg.teleport(0, 0, 690, 0); tt.dbg.step(30)
    // 画面の中で、当たる建物が 80m より遠い所を探してタッチする
    let far = null
    const V = cam.position.constructor
    for (let sy = 90; sy < 500 && !far; sy += 12) for (let sx = 20; sx < 370 && !far; sx += 12) {
      const v = new V((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize()
      const h = tt.rayHit(tt.world, cam.position.x, cam.position.y, cam.position.z, v.x, v.y, v.z, 400)
      if (h && Math.hypot(h.x - me.x, h.y - me.y, h.z - me.z) > 80) far = { sx, sy, d: Math.hypot(h.x - me.x, h.y - me.y, h.z - me.z) }
    }
    tt.log.length = 0
    tt.dbg.pressWire(far.sx, far.sy); tt.dbg.step(2)
    const miss = tt.log.find(e => e.t === 'wireMiss')
    return { gotNear, lenNear: Math.round(lenNear), farD: far && Math.round(far.d), farRope: !!me.rope, miss: !!(miss && miss.far), missShown: !document.getElementById('miss').classList.contains('hidden') }
  })
  expect(r.gotNear && r.lenNear <= 72 && !r.farRope && r.miss && r.missShown, JSON.stringify(r)); return r
})
await t('相手に飛び込むと手ぬぐいを取る（物干しの本数と文字が変わる）', async () => {
  const r = await p.evaluate(() => {
    const P = tt.m.players; tt.log.length = 0; tt.m.t = 10
    tt.dbg.teleport(0, 10, 700, 0); const me = P[0].r; me.grounded = false; me.vz = 14
    Object.assign(P[1].r, { x: 0, y: 10, z: 701.8, vx: 0, vy: 0, vz: 0, grounded: false, rope: null, climbing: null })
    tt.dbg.step(2)
    const ev = tt.log.find(e => e.t === 'steal')
    return { ev, pegs: [...document.querySelectorAll('.peg')].map(e => e.querySelectorAll('.towels i').length), say: document.getElementById('say').textContent, model: tt.dbg.models[0].tails }
  })
  expect(r.ev && r.ev.by === 0 && r.pegs[0] === 2 && r.pegs[1] === 0 && /取った|Grabbed/.test(r.say) && r.model === 2, JSON.stringify(r)); return { say: r.say, pegs: r.pegs }
})
await t('通りに居続けると手ぬぐいが光り、注意が出る', async () => {
  const r = await p.evaluate(() => { tt.m.t = 20; tt.dbg.teleport(0, 0, 640, 0); tt.dbg.step(120); return { glow: tt.me.glow, warn: !document.getElementById('glowWarn').classList.contains('hidden'), peg: document.querySelector('.peg[data-i="0"]').classList.contains('glow') } })
  expect(r.glow && r.warn && r.peg, JSON.stringify(r)); return r
})
await t('時間で暗くなる（昼→夕方→夜）', async () => {
  const shots = []
  for (const f of [0.05, 0.6, 0.97]) {
    await p.evaluate(f => { tt.dbg.setTime(f); tt.dbg.teleport(0, 30, 650, 0); tt.dbg.step(2) }, f)
    await p.screenshot({ path: `${ROOT}/shots/time-${Math.round(f * 100)}.png` })
    shots.push(await p.evaluate(() => { const c = document.querySelector('#view canvas'), x = document.createElement('canvas'); x.width = 40; x.height = 80; const g = x.getContext('2d'); g.drawImage(c, 0, 0, 40, 80); const d = g.getImageData(0, 0, 40, 80).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return Math.round(s / (d.length / 4) / 3) }))
  }
  expect(shots[0] > shots[1] && shots[1] > shots[2] && shots[2] > 12, JSON.stringify(shots)); return { brightness: shots }
})
await t('3分たつと順位発表（表彰台・順位・Xのリンク）', async () => {
  await p.evaluate(() => { tt.dbg.setTime(0.999); tt.dbg.step(120) }); await p.evaluate(() => tt.dbg.pause(false)); await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ mode: tt.mode, shown: !document.getElementById('result').classList.contains('hidden'), w: document.getElementById('podium').width, rank: document.getElementById('rankBig').textContent, post: document.getElementById('btnPost').href }))
  expect(r.mode === 'result' && r.shown && r.w === 720 && r.rank.length > 0 && /twitter\.com\/intent/.test(r.post), JSON.stringify(r)); return { rank: r.rank }
})
await t('何もしない3分は最下位', async () => {
  await p.click('#btnAgain'); await p.evaluate(() => tt.dbg.pause(true))
  await p.evaluate(() => { tt.dbg.teleport(0, 0, 640); tt.dbg.step(60 * 182) }); await p.evaluate(() => tt.dbg.pause(false)); await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ mode: tt.mode, rank: window.__lastRank, tails: tt.me.tails }))
  expect(r.mode === 'result' && r.rank === 4, JSON.stringify(r)); return r
})
await t('音: 鳴らした回数が数えられ、テスト中は実際に無音', async () => {
  const r = await p.evaluate(() => ({ calls: window.__soundCalls, played: Object.keys(Snd.played).length, ok: window.__muteOk() }))
  expect(r.calls > 0 && r.played >= 5 && r.ok, JSON.stringify(r)); return r
})
await t('英語に切り替わる', async () => {
  await p.click('#btnTitle'); await p.click('#btnLang')
  const r = await p.evaluate(() => ({ start: document.getElementById('btnStart').textContent, logo: document.querySelector('.logo').textContent, lang: document.documentElement.lang }))
  expect(r.start === 'Play' && r.lang === 'en' && /Tail Tag/.test(r.logo), JSON.stringify(r))
  await p.click('#btnLang')
})
await t('エラーが出ていない（通しのあと）', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---------------------------------------------------------------- 6サイズ × 全画面
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [844, 390, 'land'], [667, 375, 'land-se'], [768, 1024, 'tab'], [1440, 900, 'pc']]
for (const [w, h, name] of SIZES) {
  const touch = name !== 'pc'
  const q = await open(browser, { viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && name !== 'tab' })
  const views = {}
  await q.waitForTimeout(600)
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#btnHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await q.click('[data-close]')
  await q.click('#btnStart'); await q.waitForTimeout(900); views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await q.click('#btnPause'); views.pause = await fit(q); await q.click('#btnResume')
  await q.evaluate(() => tt.showResult()); await q.waitForTimeout(900); views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる・重ならない ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
await browser.close()

// ---------------------------------------------------------------- WebKit（iPhone 相当）
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始まってスマホ操作が出る（巻取ボタンは無い）・実際には無音', async () => {
  await wp.tap('#btnStart'); await wp.waitForTimeout(1200)
  const r = await wp.evaluate(() => ({ mode: tt.mode, touch: !document.getElementById('touch').classList.contains('hidden'), btns: [...document.querySelectorAll('.tbtn')].map(b => b.dataset.k), mute: window.__muteOk(), calls: window.__soundCalls }))
  expect(r.mode === 'play' && r.touch && r.btns.join() === 'jump' && r.mute, JSON.stringify(r)); return r
})
await t('WebKit: スティックで走る', async () => {
  const box = await wp.locator('#stick').boundingBox()
  const x0 = await wp.evaluate(() => [tt.me.r.x, tt.me.r.z])
  await wp.evaluate(({ x, y }) => {
    const el = document.getElementById('stick')
    const ev = (type, cx, cy) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: cx, clientY: cy, bubbles: true, pointerType: 'touch' }))
    ev('pointerdown', x, y); ev('pointermove', x, y - 50)
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  await wp.waitForTimeout(1200)
  const x1 = await wp.evaluate(() => [tt.me.r.x, tt.me.r.z])
  const d = Math.hypot(x1[0] - x0[0], x1[1] - x0[1])
  expect(d > 3, d); return { moved: +d.toFixed(1) }
})
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
