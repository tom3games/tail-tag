// SNS 用の画像 og.png（1200x630）。ビルの谷間で、ワイヤーで飛び込んで相手の手ぬぐいに手を伸ばす瞬間＋タイトル。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { muteContext, MUTE_LAUNCH } from './mute.mjs'
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: '5395' } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 1200, height: 630 } }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message))
await p.goto('http://localhost:5395/'); await p.waitForFunction(() => window.__ttReady, null, { timeout: 20000 })
await p.waitForTimeout(2500)
await p.evaluate(() => tt.start(5)); await p.waitForTimeout(1200)
await p.evaluate(() => {
  tt.dbg.pause(true); tt.dbg.freezeCpu(true)
  const P = tt.m.players, me = P[0].r, A = P[1].r
  tt.dbg.setTime(0.58)   // 夕方
  // 自分（赤）が右から振り下ろして、青の相手へ手を伸ばす
  Object.assign(me, { x: 2.6, y: 12.2, z: 700, vx: -12, vy: -1, vz: 3, grounded: false, yaw: -1.35, climbing: null })
  me.rope = { x: 16, y: 32, z: 706, len: 24, t: 0.5 }
  Object.assign(A, { x: -0.4, y: 12.0, z: 701.2, vx: -5, vy: 1, vz: 3, grounded: false, yaw: -0.9, climbing: null })
  A.rope = { x: -16, y: 34, z: 712, len: 26, t: 0.5 }
  Object.assign(P[2].r, { x: -9, y: 20, z: 722, grounded: false, yaw: 0.6, rope: { x: -16, y: 44, z: 736, len: 26, t: 0.5 } })
  P[0].tails = 2; P[1].tails = 2
  tt.dbg.step(1)
  window.__freeze = true
  const c = tt.camera
  c.position.set(me.x + 2.2, me.y + 1.9, me.z - 6.2); c.lookAt(me.x + 0.6, me.y + 1.0, me.z + 2.4); c.fov = 48; c.updateProjectionMatrix()
  tt.dbg.step(1)
  for (const id of ['hud', 'pause', 'title']) document.getElementById(id).classList.add('hidden')
  const d = document.createElement('div')
  d.innerHTML = `<div style="position:fixed;left:48px;top:44px;z-index:30;color:#fff">
    <div style="font-family:'Rampart One',sans-serif;font-size:96px;line-height:1.05;transform:rotate(-2.5deg);transform-origin:0 100%;text-shadow:0 4px 0 rgba(0,0,0,.3)">空中<br>しっぽ取り</div>
    <div style="font-family:'Zen Kaku Gothic New',sans-serif;font-weight:900;font-size:34px;margin-top:22px;line-height:1.4;text-shadow:0 2px 10px rgba(0,0,0,.85)">ワイヤーで飛んで<br>腰の手ぬぐいを奪い合う</div></div>`
  document.body.appendChild(d)
})
await p.waitForTimeout(900)
await p.screenshot({ path: 'og.png' })
await b.close(); srv.kill()
console.log('og.png')
