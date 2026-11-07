// 向きの再現: カメラをいろんな向きに回して、スティックを倒した時に画面のどちらへ動くか（スティック無しとの差で見る）
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const ROOT = import.meta.dirname, PORT = 5397
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'ja-JP' })
await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ttReady)
const out = await p.evaluate(() => {
  tt.start(3); tt.dbg.freezeCpu(true); tt.dbg.pause(true)
  const res = []
  const hds = [0, 1.2, Math.PI, 4.4, Math.PI * 2 + 0.5, -2.5, Math.PI * 4 + 2]
  const dirs = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }
  const run = (scen, hd, sx, sy) => {
    tt.dbg.setTime(0)
    const r = tt.me.r
    const Y = scen === 'ground' ? 0 : 25
    tt.cam.hd = hd; tt.cam.userT = performance.now()
    for (let i = 0; i < 120; i++) { tt.dbg.teleport(0, Y, 650, 0); tt.dbg.step(1) }   // その高さでカメラを落ち着かせる
    tt.dbg.teleport(0, Y, 650, 0)
    if (scen !== 'ground') { r.vz = 12; r.vx = 0; r.vy = 0; r.grounded = false }
    if (scen === 'rope') r.rope = { x: 0, y: 50, z: 658, len: Math.hypot(50 - 26.2, 8) + 0.3, t: 1 }
    tt.dbg.step(1)
    const e = tt.camera.matrixWorld.elements
    let rx = e[0], rz = e[2], fx = -e[8], fz = -e[10]; const l1 = Math.hypot(rx, rz), l2 = Math.hypot(fx, fz); rx /= l1; rz /= l1; fx /= l2; fz /= l2
    const x0 = r.x, z0 = r.z
    if (sx || sy) { tt.dbg.stick.id = 99; tt.dbg.stick.x = sx; tt.dbg.stick.y = sy }
    tt.dbg.step(36)
    tt.dbg.stick.id = null; tt.dbg.stick.x = tt.dbg.stick.y = 0
    const dx = r.x - x0, dz = r.z - z0
    return { side: dx * rx + dz * rz, fwd: dx * fx + dz * fz }
  }
  for (const scen of ['ground', 'air', 'rope']) for (const hd of hds) {
    const base = run(scen, hd, 0, 0)
    for (const [nm, [sx, sy]] of Object.entries(dirs)) {
      const m = run(scen, hd, sx, sy)
      res.push({ scen, hd: +hd.toFixed(2), nm, side: +(m.side - base.side).toFixed(2), fwd: +(m.fwd - base.fwd).toFixed(2) })
    }
  }
  return res
})
let bad = 0
for (const o of out) {
  // 倒した向きの成分が、逆向きや横より大きく出ていること
  const main = o.nm === 'left' ? -o.side : o.nm === 'right' ? o.side : o.nm === 'up' ? o.fwd : -o.fwd
  const other = o.nm === 'left' || o.nm === 'right' ? Math.abs(o.fwd) : Math.abs(o.side)
  if (!(main > 0.3 && main > other * 0.6)) { bad++; console.log('NG', JSON.stringify(o)) }
}
console.log('total', out.length, 'NG', bad)
await b.close(); srv.kill()
