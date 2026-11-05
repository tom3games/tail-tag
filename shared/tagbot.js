// CPU のしっぽ取り（WIRE ESCAPE の runnerbot と同じ考え方: 行きたい向きの前の建物・電柱にワイヤーを掛けてつなぐ）
// 性格: cpu（skill 0〜1 で強さ）／検証用: skilled（上手い人）・sloppy（下手な人: 反応が遅く狙いが雑）・ground（地面だけ走る手抜き）・idle（何もしない）
import { findAnchor, RUN } from './runner.js?v=12'
import { TAG, lockTarget } from './tag.js?v=12'

const ang = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a }

export function createBot(kind, skill = 0.6, seed = 1) {
  let s = seed >>> 0 || 7
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  if (kind === 'skilled') skill = 0.85
  if (kind === 'sloppy') skill = 0.15
  return { kind, skill, rnd, goal: null, tgt: null, retarget: 0, wT: 0, prevW: false, prevJ: false, stuck: 0, lx: 0, lz: 0, delay: [], noise: 0, noiseT: 0, flee: 0 }
}

function pickGoal(b, p, m) {
  const r = p.r
  let best = null, bs = 1e9
  for (const o of m.players) {
    if (o === p || o.tails <= 0 || o.immune > 0 || p.cd[o.i] > 0 || o.r.wreck > 0) continue
    const d = Math.hypot(o.r.x - r.x, o.r.y - r.y, o.r.z - r.z)
    const s = d - (o.glow ? 60 : 0) - o.tails * 6 + (o.i === 0 && b.kind === 'cpu' ? 10 : 0)
    if (s < bs) { bs = s; best = { kind: 'p', o } }
  }
  for (const f of (m.mode === 'flee' ? [] : m.free)) {   // 逃げるだけでは CPU は電柱の手ぬぐいを拾わない
    const d = Math.hypot(f.x - r.x, f.y - r.y, f.z - r.z)
    const s = d - 12
    if (s < bs) { bs = s; best = { kind: 'f', f } }
  }
  return best
}

export function botInput(b, p, m, world, dt) {
  const r = p.r
  const inp = { throttle: 0, steer: 0 }
  if (b.kind === 'idle' || m.over) return inp
  if (b.kind === 'human' || b.kind === 'beginner') return humanInput(b, p, m, world, dt)
  b.retarget -= dt
  if (b.retarget <= 0 || !b.tgt || (b.tgt.kind === 'f' && !m.free.includes(b.tgt.f)) || (b.tgt.kind === 'p' && (b.tgt.o.tails <= 0 || b.tgt.o.immune > 0 || p.cd[b.tgt.o.i] > 0))) {
    b.tgt = pickGoal(b, p, m); b.retarget = 1.0 + (1 - b.skill) * 1.2
  }
  // 逃げる: 2本以上持っていて、近くの誰かが速く向かってくる
  let gx, gy, gz
  // 逃げる bot（逃げるだけモードの検証用）: 近い追手ほど強く避ける向きへ、高い所へ。fleeSloppy は反応が遅くぶれる
  if (b.kind === 'flee' || b.kind === 'fleeSloppy') {
    let ax = 0, az = 0
    for (const o of m.players) { if (o === p) continue; const dx = r.x - o.r.x, dz = r.z - o.r.z, d = Math.hypot(dx, dz) || 1; const w = 1 / Math.max(8, d) ** 2; ax += dx / d * w; az += dz / d * w }
    // 端に追い込まれないよう真ん中へ少し寄せる
    const B = world.bounds, mx = (B.x0 + B.x1) / 2 - r.x, mz = (B.z0 + B.z1) / 2 - r.z, ml = Math.hypot(mx, mz) || 1
    ax += mx / ml * 0.0006; az += mz / ml * 0.0006
    const al = Math.hypot(ax, az) || 1
    gx = r.x + ax / al * 45; gz = r.z + az / al * 45; gy = r.y + 6
    if (b.kind === 'fleeSloppy') { b.delay.push([gx, gy, gz]); if (b.delay.length > 30) [gx, gy, gz] = b.delay.shift(); b.noiseT -= dt; if (b.noiseT <= 0) { b.noise = (b.rnd() - 0.5) * 1.6; b.noiseT = 0.6 + b.rnd() } }
  } else {
  const chaser = p.tails >= 2 && m.players.find(o => o !== p && Math.hypot(o.r.x - r.x, o.r.z - r.z) < 16 && ((r.x - o.r.x) * o.r.vx + (r.z - o.r.z) * o.r.vz) / Math.max(1, Math.hypot(r.x - o.r.x, r.z - o.r.z)) > 7)
  if (chaser && b.skill > 0.3) { gx = r.x + (r.x - chaser.r.x) * 3; gz = r.z + (r.z - chaser.r.z) * 3; gy = r.y + 8 }
  else if (b.tgt && b.tgt.kind === 'p') {
    const o = b.tgt.o.r, d = Math.hypot(o.x - r.x, o.z - r.z)
    const lead = Math.min(1.2, d / 22) * b.skill   // 先回り
    gx = o.x + o.vx * lead; gz = o.z + o.vz * lead; gy = o.y + o.vy * lead * 0.5
  } else if (b.tgt) { gx = b.tgt.f.x; gz = b.tgt.f.z; gy = b.tgt.f.y - 1.1 }
  else { gx = (world.bounds.x0 + world.bounds.x1) / 2; gz = (world.bounds.z0 + world.bounds.z1) / 2; gy = 0 }
  }
  // 下手な人: 反応が遅い（0.35秒前の目標を追う）・ぶれる
  if (b.kind === 'sloppy') {
    b.delay.push([gx, gy, gz]); if (b.delay.length > 21) [gx, gy, gz] = b.delay.shift()
    b.noiseT -= dt; if (b.noiseT <= 0) { b.noise = (b.rnd() - 0.5) * 1.4; b.noiseT = 0.6 + b.rnd() }
  }
  b.goal = { x: gx, y: gy, z: gz }
  const dh = Math.hypot(gx - r.x, gz - r.z)
  const want = Math.atan2(gx - r.x, gz - r.z) + (b.kind === 'sloppy' || b.kind === 'fleeSloppy' ? b.noise : 0)
  const diff = ang(want - r.yaw)
  inp.steer = Math.max(-1, Math.min(1, -diff * 2.5))
  inp.throttle = Math.abs(diff) > 1.8 && r.grounded ? 0.35 : 1
  // 壁: 目標の高さへ這う。目標が遠ければ壁を蹴って離れる
  if (r.climbing) {
    const cl = r.climbing, tx = -cl.nz, tz = cl.nx
    inp.climbY = gy > r.y + 1 ? 1 : gy < r.y - 2 ? -1 : 0
    inp.climbX = Math.max(-1, Math.min(1, ((gx - r.x) * tx + (gz - r.z) * tz) / 6))
    const away = (gx - r.x) * cl.nx + (gz - r.z) * cl.nz > 4
    if (b.kind !== 'ground' && (away || (inp.climbY === 0 && dh > 10))) { inp.jump = !b.prevJ; b.prevJ = inp.jump; return inp }
  }
  // 車: 地面で前から来る車に気づいたら跳んでよける。気づくかは強さしだい（弱い CPU はたまにはねられる）
  if (m.traffic && r.grounded && (b.kind === 'cpu' || b.kind === 'skilled' || b.kind === 'flee')) {
    b.carT = (b.carT || 0) - dt
    if (b.carT <= 0) {
      b.carT = 0.15
      const th = m.traffic.threat(r, 0.9)
      if (th && th.car.id !== b.seenCar) { b.seenCar = th.car.id; b.dodge = b.rnd() < 0.45 + 0.5 * b.skill }
    }
    if (b.dodge) { b.dodge = false; inp.jump = true; b.prevJ = true; return inp }
  }
  // 地面にいる相手のそばでは、ワイヤーで飛び越さずに降りて走って詰める（地面で待てば安全、にしない）
  const tgR = b.tgt && b.tgt.kind === 'p' ? b.tgt.o.r : null
  const groundChase = b.kind === 'cpu' && m.mode === 'flee' && tgR && tgR.grounded && dh < 22
  if (groundChase) {
    if (r.rope && !b.prevW) { inp.wire = true; b.prevW = true; return inp }
    b.prevW = false
    b.stuck = Math.hypot(r.x - b.lx, r.z - b.lz) < 0.04 && !r.climbing ? b.stuck + dt : 0
    b.lx = r.x; b.lz = r.z
    if (b.stuck > 0.8) { inp.jump = !b.prevJ; b.prevJ = inp.jump; b.stuck = 0 } else b.prevJ = false
    return inp
  }
  // ワイヤー
  b.wT += dt
  const gap = b.kind === 'sloppy' ? 1.3 : 0.25 + (1 - b.skill) * 0.7
  let wire = false
  if (b.kind !== 'ground' && !r.rope && !r.climbing && b.wT > gap && (r.grounded || r.vy < -1) && (dh > 8 || gy > r.y + 4)) {
    if (b.kind !== 'sloppy' || b.rnd() < 0.7) {
      const v = Math.max(8, Math.hypot(r.vx, r.vz))
      const a = findAnchor(world, { ...r, yaw: want, vx: Math.sin(want) * v, vz: Math.cos(want) * v })
      if (a) { wire = true; b.aim = a }
    }
    b.wT = 0
  }
  // ワイヤー中: 目標を通り過ぎた・真上に来たら外す
  if (r.rope && b.kind !== 'sloppy') {
    const past = (gx - r.x) * r.vx + (gz - r.z) * r.vz < 0 && dh < 30
    if ((past && r.vy > 0) || (dh < 6 && r.y > gy + 1)) wire = true
  }
  inp.wire = wire && !b.prevW; b.prevW = wire
  if (inp.wire && !r.rope && b.aim) inp.wireAt = b.aim
  b.aim = null
  // 詰まったら跳ぶ
  b.stuck = Math.hypot(r.x - b.lx, r.z - b.lz) < 0.04 && !r.climbing ? b.stuck + dt : 0
  b.lx = r.x; b.lz = r.z
  let jump = false
  if (b.stuck > 1.0) { jump = true; b.stuck = 0 }
  if (!inp.jump) { inp.jump = jump && !b.prevJ; b.prevJ = jump }
  return inp
}

// 人のまね（スマホで初めて遊ぶ人）: スティックとワイヤーボタンだけ。反応は 0.35 秒遅れ、向きはぶれる。
// ワイヤーはボタン（自動の狙い＝画面と同じ lockTarget かスティックの向き）。掛ける点を自分で選ばない・先回りしない
function humanInput(b, p, m, world, dt) {
  const r = p.r, inp = { throttle: 1, steer: 0 }
  // 目標は画面の矢印と同じ（一番近い取れる相手か落ちている手ぬぐい）
  let g = lockTarget(m, p)
  if (!g) { let bd = 1e9; for (const o of m.players) if (o !== p && o.tails > 0 && o.immune <= 0) { const d = Math.hypot(o.r.x - r.x, o.r.z - r.z); if (d < bd) { bd = d; g = { x: o.r.x, y: o.r.y + 1.1, z: o.r.z } } } }
  if (!g) g = { x: (world.bounds.x0 + world.bounds.x1) / 2, y: 0, z: (world.bounds.z0 + world.bounds.z1) / 2 }
  // beginner（もっと不慣れな人）: 反応 0.6 秒遅れ・ぶれ大・ボタンを押すのも遅い
  const beg = b.kind === 'beginner'
  b.delay.push([g.x, g.y, g.z]); let [gx, gy, gz] = b.delay.length > (beg ? 36 : 21) ? b.delay.shift() : b.delay[0]
  b.noiseT -= dt; if (b.noiseT <= 0) { b.noise = (b.rnd() - 0.5) * (beg ? 1.8 : 1.0); b.noiseT = 0.5 + b.rnd() * 0.8 }
  const yaw = Math.atan2(gx - r.x, gz - r.z) + b.noise
  inp.moveDir = { x: Math.sin(yaw), z: Math.cos(yaw) }
  const dh = Math.hypot(gx - r.x, gz - r.z)
  if (r.climbing) {
    inp.climbY = gy > r.y + 1 ? 1 : gy < r.y - 2 ? -1 : 0
    inp.climbX = 0
  }
  b.wT += dt
  let wire = false
  if (r.climbing) { if (inp.climbY === 0 || dh > 12) { b.cl = (b.cl || 0) + dt; if (b.cl > 0.8) { wire = true; b.cl = 0 } } }
  else if (!r.rope) { if (b.wT > (beg ? 1.6 : 0.9) && (r.grounded || r.vy < -1) && (dh > 6 || gy > r.y + 3) && b.rnd() < 0.75 * dt * 60 / 20) { wire = true; b.wT = 0 } }
  else {
    // 離す: 目標を通り過ぎて上がり始めたら（人なので少し遅れる）、か長く振れていたら
    b.ropeT = (b.ropeT || 0) + dt
    const past = (gx - r.x) * r.vx + (gz - r.z) * r.vz < 0
    if ((past && r.vy > 0 && b.ropeT > 0.6) || b.ropeT > 2.2 + b.rnd() * 0.02) { wire = true; b.ropeT = 0 }
  }
  if (!r.rope) b.ropeT = 0
  inp.wire = wire && !b.prevW; b.prevW = wire
  if (inp.wire) { const lt = lockTarget(m, p); inp.wireYaw = lt ? Math.atan2(lt.x - r.x, lt.z - r.z) : yaw }
  return inp
}

export { TAG, RUN }
