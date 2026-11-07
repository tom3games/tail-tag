// 遊び中の FPS（スマホ相当: 390x844・CPU 4倍遅く）。node _fps2.mjs [port]。車が走る通りの上で測る
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = +(process.argv[2] || 5396)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await muteContext(ctx)
const p = await ctx.newPage()
const meas = () => p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(+(n / 5).toFixed(1)) }; requestAnimationFrame(f) }))
await p.goto('about:blank'); const blank = await meas()
const cdp = await ctx.newCDPSession(p)
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ttReady || window.__bpReady || window.__jsUp, null, { timeout: 30000 }); await p.waitForTimeout(3000)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.RATE||4) })
const out = { blank }
// 地上（通りの上・車が見える）と空中の2か所
for (const [k, setup] of [['street', () => { tt.start(3); const r = tt.me.r; Object.assign(r, { x: -130 + 4, y: 0, z: 760, vx: 0, vy: 0, vz: 0, yaw: 0 }); tt.cam.hd = 0 }], ['play', () => { tt.start(4) }]]) {
  await p.evaluate(setup); await p.waitForTimeout(1500)
  out[k] = await meas()
}
out.calls = await p.evaluate(() => tt.renderer ? tt.renderer.info.render.calls : null)
console.log(JSON.stringify(out))
await b.close(); srv.kill()
