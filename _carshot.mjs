// 車が走る場面・はねられて気絶した場面を撮る。node _carshot.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 5413
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-unsafe-swiftshader'] })
for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['land', { width: 844, height: 390 }]]) {
  const ctx = await b.newContext({ viewport: vp, locale: 'ja-JP', hasTouch: true, isMobile: true }); await muteContext(ctx)
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ttReady, null, { timeout: 30000 })
  await p.evaluate(() => { tt.start(5); tt.dbg.freezeCpu(true) })
  await p.waitForTimeout(800)
  // 車が来る車線の少し前の歩道に立たせ、車の方を向く
  const info = await p.evaluate(() => {
    const T = tt.m.traffic, r = tt.me.r
    const c = T.cars.find(c => c.line.dx === 0 && Math.abs(c.x) < 300 && c.z > 640 && c.z < 840 && c.vz > 0)
    const side = c.line.ax > 0 ? 1 : -1
    tt.dbg.teleport(c.x - 7 * side, 0, c.z + 22, Math.PI)
    tt.cam.hd = Math.PI + 0.5 * side; tt.cam.pitch = 0.05
    return { car: c.id, x: c.x, z: c.z }
  })
  await p.waitForTimeout(500)
  await p.screenshot({ path: `shots/cars-${name}.png` })
  // 車線へ出て当たる
  await p.evaluate(() => { const r = tt.me.r, c = tt.m.traffic.cars.find(c => Math.hypot(c.x - r.x, c.z - r.z) < 40 && c.vz > 0); tt.dbg.teleport(c.x, 0, c.z + 6, Math.PI) })
  const hit = await p.evaluate(() => new Promise(res => { const t0 = performance.now(); const f = () => { if (tt.me.r.stun > 0) res({ stun: +tt.me.r.stun.toFixed(2), y: +tt.me.r.y.toFixed(2) }); else if (performance.now() - t0 > 4000) res(null); else requestAnimationFrame(f) }; f() }))
  await p.waitForTimeout(250); await p.screenshot({ path: `shots/carhit-air-${name}.png` })
  await p.waitForTimeout(950); await p.screenshot({ path: `shots/carhit-dizzy-${name}.png` })
  const after = await p.evaluate(() => ({ stun: +tt.me.r.stun.toFixed(2), grounded: tt.me.r.grounded, log: tt.log.filter(e => e.t === 'car').length, calls: tt.renderer.info.render.calls, carCalls: tt.carsDraw.drawCalls }))
  console.log(name, JSON.stringify({ info, hit, after, errs: [...new Set(errs)] }))
  await ctx.close()
}
await b.close(); srv.kill()
