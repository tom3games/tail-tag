// 通りを走る一般車（空中出前・WIRE ESCAPE の traffic.js を、遊ぶ範囲の通りだけに切ったもの）。three.js に依存しない（画面と bot で同じものが動く）
// 2026-11-03 本人「これも車を結構走らせといて欲しい。ぶつかったら2秒間混乱というか気絶というか」
// - 位置は試合の時刻だけで決まる（左側通行・対向車線にも車）。通りの端（工事の柵の外 EXT m）まで行くと反対の端から出てくる
// - 地面の近く（足が車の屋根より下）で当たると、はね飛ばされて2秒気絶。ワイヤー中・壁・屋上・空中の高い所では当たらない
import { AREA } from './arena.js?v=12'
import { hitByCar } from './runner.js?v=12'

export const CARS = {
  gap: 52,              // 車線何 m に1台（空中出前は 210m、WIRE ESCAPE は 340m。範囲が狭いので詰める）
  speed: [7, 10.5],     // m/s（人が走るのは 8m/s）
  ext: 60,              // 柵の外まで走らせる長さ（出入りが柵の外で起きる）
  halfW: 0.95, halfL: 2.3, pad: 0.35,   // 当たる箱（人の太さ pad を足す）
  roof: { sedan: 1.45, taxi: 1.45, van: 2.0 },   // 足がこれより下なら当たる
  stun: 2,              // 気絶の秒数
  hitCd: 2.8,           // 気絶が解けてから少しの間は続けて当たらない
  ride: 0.55            // 車体の原点の高さ
}
const KINDS = ['sedan', 'van', 'taxi', 'sedan', 'sedan', 'van', 'sedan', 'taxi']
const PAINT = [0xe9e9e9, 0x2b2e33, 0xb8bcc2, 0x2f5f9a, 0xd8d2c0, 0x8b0f14, 0x3f5a3a, 0x6a6e74]

export function createTraffic(world, gap = CARS.gap) {
  const lines = []
  const A = AREA, E = CARS.ext
  for (const r of world.roads || []) {
    if (r.w < 18 || r.pts.length !== 2 || r.surf !== 'road') continue
    const [[ax, az], [bx, bz]] = r.pts
    const ns = Math.abs(ax - bx) < 0.5, ew = Math.abs(az - bz) < 0.5
    if (!ns && !ew) continue
    const lanes = r.w >= 28 ? [3.6, 10] : [4.4]   // 片側の車線の中心（大通りは片側2車線）
    if (ns) {
      if (ax < A.x0 - 20 || ax > A.x1 + 20) continue
      const z0 = Math.max(Math.min(az, bz), A.z0 - E), z1 = Math.min(Math.max(az, bz), A.z1 + E)
      if (z1 - z0 < 60) continue
      for (const dir of [1, -1]) for (const lane of lanes) {
        const fx = 0, fz = dir, lx = fz, lz = -fx, x = ax + lx * lane
        if (x < A.x0 + 1.5 || x > A.x1 - 1.5) continue   // 外周の通りは柵の内側の車線だけ
        lines.push({ ax: x, az: z0, dx: 0, dz: 1, L: z1 - z0, dir })
      }
    } else {
      if (az < A.z0 - 20 || az > A.z1 + 20) continue
      const x0 = Math.max(Math.min(ax, bx), A.x0 - E), x1 = Math.min(Math.max(ax, bx), A.x1 + E)
      if (x1 - x0 < 60) continue
      for (const dir of [1, -1]) for (const lane of lanes) {
        const fx = dir, fz = 0, lx = fz, lz = -fx, z = az + lz * lane
        if (z < A.z0 + 1.5 || z > A.z1 - 1.5) continue
        lines.push({ ax: x0, az: z, dx: 1, dz: 0, L: x1 - x0, dir })
      }
    }
  }
  // 電柱が立っている車線は使わない（外周の大通りは柵側の車線にだけ電柱がある）
  const poles = world.poles || []
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i]
    if (poles.some(p => { const al = (p.cx - ln.ax) * ln.dx + (p.cz - ln.az) * ln.dz, sd = Math.abs((p.cx - ln.ax) * ln.dz - (p.cz - ln.az) * ln.dx); return al > 0 && al < ln.L && sd < 2 })) lines.splice(i, 1)
  }
  const cars = []
  lines.forEach((ln, li) => {
    const n = Math.max(1, Math.round(ln.L / gap))
    for (let k = 0; k < n; k++) {
      const h = (li * 7 + k * 3) % 8
      const kind = KINDS[(li * 3 + k) % KINDS.length]
      // 等間隔より少しばらす（同じ車線で重ならない範囲）
      const jitter = (((li * 131 + k * 71) % 97) / 97 - 0.5) * gap * 0.45
      cars.push({
        id: `t${li}_${k}`, line: ln, phase: (ln.L * k / n + jitter + ln.L * 10) % ln.L,
        speed: CARS.speed[0] + (CARS.speed[1] - CARS.speed[0]) * (h / 7),
        kind, color: kind === 'taxi' ? 0xf2c230 : PAINT[(li + k * 5) % PAINT.length],
        x: 0, y: CARS.ride, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, roll: 0, grounded: true
      })
    }
  })
  // 同じ車線の車はみな同じ速さにする（追い越し・重なりが起きない）
  for (const ln of lines) { const cs = cars.filter(c => c.line === ln); const v = cs[0].speed; for (const c of cs) c.speed = v }
  const T = {
    cars, lines, t: 0,
    update(t) {
      T.t = t
      for (const c of cars) {
        const ln = c.line
        let s = (c.phase + t * c.speed) % ln.L
        if (ln.dir < 0) s = ln.L - s
        c.x = ln.ax + ln.dx * s; c.z = ln.az + ln.dz * s
        c.vx = ln.dx * ln.dir * c.speed; c.vz = ln.dz * ln.dir * c.speed
        c.yaw = Math.atan2(ln.dx * ln.dir, ln.dz * ln.dir)
      }
    },
    // 人が車に当たるか（当たったらその車）。気絶中・続けて当たらない間・ワイヤー中・壁・高い所は当たらない
    hitTest(r) {
      if (r.carCd > 0 || r.wreck > 0 || r.rope || r.climbing) return null
      for (const c of cars) {
        const dx = r.x - c.x, dz = r.z - c.z
        if (dx * dx + dz * dz > 16) continue
        if (r.y > (CARS.roof[c.kind] || 1.45)) continue
        const s = Math.sin(c.yaw), co = Math.cos(c.yaw)
        const along = dx * s + dz * co, side = dx * co - dz * s
        if (Math.abs(along) < CARS.halfL + CARS.pad && Math.abs(side) < CARS.halfW + CARS.pad) return c
      }
      return null
    },
    // 前の dt 秒の間に、今の速さのまま進むとぶつかる車（bot がよけるのに使う）
    threat(r, horizon = 1.0) {
      if (r.rope || r.climbing || !r.grounded || r.y > 1.4) return null
      let best = null, bt = horizon
      for (const c of cars) {
        const dx = r.x - c.x, dz = r.z - c.z
        if (dx * dx + dz * dz > 30 * 30) continue
        const rvx = r.vx - c.vx, rvz = r.vz - c.vz
        const s = Math.sin(c.yaw), co = Math.cos(c.yaw)
        for (let k = 0; k <= 5; k++) {
          const tt = horizon * k / 5; if (tt >= bt) break
          const px = dx + rvx * tt, pz = dz + rvz * tt
          if (Math.abs(px * s + pz * co) < CARS.halfL + CARS.pad + 0.6 && Math.abs(px * co - pz * s) < CARS.halfW + CARS.pad + 0.6) { bt = tt; best = c; break }
        }
      }
      return best ? { car: best, t: bt } : null
    }
  }
  T.update(0)
  return T
}

// 当たった人をはね飛ばして気絶させる（hitByCar はワイヤー・壁を外して上へ飛ばす。体力は減らさない）
export function carHit(r, c) {
  const rel = Math.hypot(r.vx - c.vx, r.vz - c.vz)
  hitByCar(r, c, rel, 0)
  r.stun = CARS.stun
  r.carCd = CARS.stun + CARS.hitCd
  r.carHits = (r.carHits || 0) + 1
  return rel
}
