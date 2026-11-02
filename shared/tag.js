// 空中しっぽ取りのきまり。three.js に依存しない（画面と検証で同じものが動く）
// - 4人（自分＋CPU3人）。みんな腰に手ぬぐい（しっぽ）を1本さして始まる
// - 相手に触れたら1本奪える。ぶつかった時は「相手に向かって速く飛び込んだ方」が取る
// - 取られた人は少しの間（immune 秒）取られない。同じ相手から続けて取れない
// - 通りの地面（屋上・壁は別）に居続けると、しっぽが光ってばれる。光っている人は取られやすい（向かう速さで負ける）
// - 電柱の上の方に、落ちているしっぽが下がっている。地面からは届かない（飛ばないと取れない）
// - 3分（時間で昼→夕方→夜）。終わった時に持っている本数で順位
import { RUN } from './runner.js?v=7'

export const TAG = {
  sec: 180,
  touchR: 2.2,          // 触れたとみなす距離（胸と胸）
  touchRMe: 3.0,        // 自分だけ少し広い（スマホで当てやすく）
  assistR: 11,          // 自分だけ: 取れる相手・落ちているしっぽがこれより近いと、空中で少し吸い寄せる
  assistAcc: 12,
  immune: 4,            // 取られた人が取られない秒数
  thiefImmune: 1.5,     // 取った人も少しだけ守られる（逃げる間）
  minApproach: 2.5,     // 相手へ向かう速さがこれ未満だと取れない（止まっている人は取れない）
  sameCd: 6,            // 同じ相手から続けて取れない秒数
  glowAfter: 1.2,       // 通りの地面にこれだけ居ると光る
  grace: 5,             // 始まってすぐは光らない
  freeMax: 4,           // 落ちているしっぽの数（同時）
  freeEvery: 9,        // 取られたあと次が下がるまで
  freeR: 2.6,
  // 難しさ（2026-11-02 本人「CPU はやれるやろうけどユーザーは難しそう」）。既定は かんたん。ふつう＝初版のまま
  //  cpu: CPU 3人の強さ / cpuSpeed: CPU の走る速さの倍率 / meTouchR: 自分が触れたとみなす距離 / meBonus: ぶつかった時、自分の「向かう速さ」に足す分
  //  meImmune: 自分が取られた後に取られない秒数 / assistR・assistAcc: 空中で取れる相手へ吸い寄せる距離と強さ / lockR: ワイヤーボタンが相手の方へ掛かる距離（0 で無し）
  levels: {
    easy:   { cpu: [0.14, 0.26, 0.4], cpuSpeed: 0.88, meTouchR: 4.0, meBonus: 3, meImmune: 6, assistR: 18, assistAcc: 20, lockR: 75 },
    normal: { cpu: [0.25, 0.45, 0.65], cpuSpeed: 1, meTouchR: 3.0, meBonus: 0, meImmune: 4, assistR: 11, assistAcc: 12, lockR: 60 },
    hard:   { cpu: [0.55, 0.75, 0.92], cpuSpeed: 1.05, meTouchR: 2.6, meBonus: -1, meImmune: 4, assistR: 0, assistAcc: 0, lockR: 0 }
  }
}

export const COLORS = [
  { id: 'me', name: ['あなた', 'You'], cloth: '#d8402c', coat: ['#f4f1ea', '#c9c6be'] },
  { id: 'c1', name: ['ハヤテ', 'Hayate'], cloth: '#2f6fd0', coat: ['#3d5b8c', '#22344f'] },
  { id: 'c2', name: ['モモ', 'Momo'], cloth: '#e8b021', coat: ['#e7d7b4', '#b8a37a'] },
  { id: 'c3', name: ['ゲン', 'Gen'], cloth: '#3f9a52', coat: ['#5e6b52', '#384030'] }
]

function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

// mode: 'tag'（取り合い）／'flee'（逃げるだけ。2026-11-03 本人「一方的に逃げるだけのモード。しっぽが4つぐらいあって逃げるだけ」）
//   flee: 自分だけ4本、CPU 3人は0本で自分だけを追う。CPU が取ったしっぽは消える（CPU は持たない）。電柱の手ぬぐいは自分だけ拾える。0本になるか時間で終わり
export const FLEE = { tails: 4, maxTails: 6 }
export function createMatch(world, runners, seed = 1, level = 'normal', mode = 'tag') {
  const r = rng(seed)
  const lv = TAG.levels[level] || TAG.levels.normal
  runners.forEach((rn, i) => { if (i > 0) rn.speedMul = lv.cpuSpeed })
  const flee = mode === 'flee'
  const players = runners.map((rn, i) => ({ i, id: COLORS[i].id, r: rn, tails: flee ? (i === 0 ? FLEE.tails : 0) : 1, steals: 0, lost: 0, picks: 0, groundT: 0, glow: false, immune: 0, cd: {}, airT: 0, groundSum: 0 }))
  const m = { t: 0, over: false, players, free: [], freeT: 3, events: [], rnd: r, world, seed, level, lv, mode }
  return m
}

const chest = p => ({ x: p.r.x, y: p.r.y + 1.1, z: p.r.z })

function onStreet(rn) { return rn.grounded && !rn.onRoof && !rn.climbing && rn.y < 1.2 }

export function stepMatch(m, dt) {
  if (m.over) return
  m.t += dt
  const P = m.players
  for (const p of P) {
    const st = onStreet(p.r) && m.t > TAG.grace
    p.groundT = st ? p.groundT + dt : Math.max(0, p.groundT - dt * 2.5)
    if (st) p.groundSum += dt; else p.airT += dt
    const g = p.groundT > TAG.glowAfter
    if (g && !p.glow) m.events.push({ t: 'glow', who: p.i })
    p.glow = g
    p.immune = Math.max(0, p.immune - dt)
    for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt)
  }
  // 自分だけ: 空中で近くの取れる相手・しっぽへ少し吸い寄せる（初めての人でも当たるように）
  const me = P[0]
  if (me && !me.r.grounded && !me.r.climbing) {
    const c0 = chest(me); let tg = null, td = m.lv.assistR
    for (const o of P) if (o !== me && o.tails > 0 && o.immune <= 0 && !(me.cd[o.i] > 0)) { const c = chest(o), d = Math.hypot(c.x - c0.x, c.y - c0.y, c.z - c0.z); if (d < td) { td = d; tg = c } }
    for (const f of m.free) { const d = Math.hypot(f.x - c0.x, f.y - c0.y, f.z - c0.z); if (d < td) { td = d; tg = f } }
    if (tg && td > 0.5) { const k = m.lv.assistAcc * dt / td; me.r.vx += (tg.x - c0.x) * k; me.r.vy += (tg.y - c0.y) * k; me.r.vz += (tg.z - c0.z) * k }
  }
  // 触れたら奪う
  for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
    const A = P[a], B = P[b]
    if (A.r.wreck > 0 || B.r.wreck > 0) continue
    const ca = chest(A), cb = chest(B)
    const dx = cb.x - ca.x, dy = cb.y - ca.y, dz = cb.z - ca.z, d = Math.hypot(dx, dy, dz)
    const R = (A.i === 0 || B.i === 0) ? m.lv.meTouchR : TAG.touchR
    if (d > R || d < 1e-4) continue
    const nx = dx / d, ny = dy / d, nz = dz / d
    // 相手へ向かう速さ。光っている人は 6m/s ぶん不利
    // 自分の上乗せ（meBonus）は、自分から向かっている時だけ（地面で待っていて相手が来ても取れない）
    let sa = A.r.vx * nx + A.r.vy * ny + A.r.vz * nz, sb = -(B.r.vx * nx + B.r.vy * ny + B.r.vz * nz)
    if (A.i === 0 && sa > 2) sa += m.lv.meBonus
    if (B.i === 0 && sb > 2) sb += m.lv.meBonus
    sa -= A.glow ? 6 : 0; sb -= B.glow ? 6 : 0
    let thief = sa >= sb ? A : B, victim = thief === A ? B : A
    if (m.mode === 'flee') { if (A.i === 0) { thief = B; victim = A } else if (B.i === 0) { thief = A; victim = B } else continue }
    const sv = Math.max(sa, sb)
    // 逃げるだけ: 追手は自分に触れたら止まっていても取る（地面で立ち止まれば安全、にしない）
    const grab = m.mode === 'flee' && victim.i === 0 && thief.i !== 0
    if ((!grab && sv < TAG.minApproach) || victim.tails <= 0 || victim.immune > 0 || thief.cd[victim.i] > 0) continue
    victim.tails--; victim.lost++; victim.immune = victim.i === 0 ? m.lv.meImmune : TAG.immune
    if (m.mode !== 'flee') thief.tails++   // 逃げるだけでは CPU は取ったしっぽを持たない（ずっと追い続ける）
    thief.steals++; thief.cd[victim.i] = TAG.sameCd; thief.immune = Math.max(thief.immune, TAG.thiefImmune)
    // 取られた方は少しはじかれる（同じ所でもみ合わない）
    victim.r.vx += (victim === B ? nx : -nx) * 5; victim.r.vz += (victim === B ? nz : -nz) * 5; victim.r.vy += 2
    m.events.push({ t: 'steal', by: thief.i, from: victim.i, x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2, z: (ca.z + cb.z) / 2 })
  }
  // 落ちているしっぽ
  m.freeT -= dt
  if (m.freeT <= 0 && m.free.length < TAG.freeMax && m.world.tailSpots.length) {
    m.freeT = TAG.freeEvery * 0.5
    // 誰からも遠い所を選ぶ
    let best = null, bs = -1
    for (let k = 0; k < 8; k++) {
      const s = m.world.tailSpots[Math.floor(m.rnd() * m.world.tailSpots.length)]
      if (m.free.some(f => f.x === s.x && f.z === s.z)) continue
      const dmin = Math.min(...P.map(p => Math.hypot(p.r.x - s.x, p.r.z - s.z)))
      const sc = Math.min(dmin, 90) + m.rnd() * 20
      if (sc > bs) { bs = sc; best = s }
    }
    if (best) { m.free.push({ ...best, t: 0 }); m.events.push({ t: 'freeNew', x: best.x, y: best.y, z: best.z }) }
  }
  for (const f of m.free) f.t += dt
  for (let k = m.free.length - 1; k >= 0; k--) {
    const f = m.free[k]
    for (const p of P) {
      const c = chest(p)
      if (m.mode === 'flee' && (p.i !== 0 || p.tails >= FLEE.maxTails)) continue   // 逃げるだけ: 拾えるのは自分だけ
      if (Math.hypot(c.x - f.x, c.y - f.y, c.z - f.z) < TAG.freeR) {
        p.tails++; p.picks++
        m.free.splice(k, 1); m.freeT = TAG.freeEvery
        m.events.push({ t: 'pick', by: p.i, x: f.x, y: f.y, z: f.z })
        break
      }
    }
  }
  if (m.mode === 'flee' && P[0].tails <= 0) { m.over = true; m.events.push({ t: 'end', down: true }); return }
  if (m.t >= TAG.sec) { m.over = true; m.events.push({ t: 'end', escaped: m.mode === 'flee' }) }
}

// ワイヤーボタンの狙い（自分と、人のまねをする bot が使う）: 届く距離の中で一番近い「取れる相手」か落ちている手ぬぐい。無ければ null
export function lockTarget(m, p) {
  const R = m.lv.lockR; if (!R) return null
  const r = p.r; let best = null, bd = R
  for (const o of m.players) {
    if (o === p || o.tails <= 0 || o.immune > 0 || p.cd[o.i] > 0 || o.r.wreck > 0) continue
    const d = Math.hypot(o.r.x - r.x, o.r.y - r.y, o.r.z - r.z)
    if (d < bd) { bd = d; best = { x: o.r.x + o.r.vx * 0.35, y: o.r.y + 1.1, z: o.r.z + o.r.vz * 0.35, who: o.i, d } }
  }
  for (const f of m.free) { const d = Math.hypot(f.x - r.x, f.y - r.y, f.z - r.z) - 8; if (d < bd) { bd = d; best = { x: f.x, y: f.y, z: f.z, free: true, d: d + 8 } } }
  return best
}

// 順位（本数、同じなら奪った数、それも同じなら取られた数が少ない方）
export function ranking(m) {
  return [...m.players].sort((a, b) => b.tails - a.tails || b.steals - a.steals || a.lost - b.lost || a.i - b.i)
}

export { RUN }
