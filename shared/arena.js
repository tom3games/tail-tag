// 遊ぶ範囲（街の真ん中の高層ビル街）と、ワイヤーを掛けられる電柱・街灯・信号。
// 2026-11-02 本人「ワイヤーをもっと使わせたい。地面にいたらダメ。電柱とか掛けられる場所を増やして」
const K = 130 / 80
const X = x => x * K, Z = z => 40 + (z - 40) * K
export const AREA = { x0: X(-160), x1: X(160), z0: Z(360), z1: Z(520) }   // 約 520m x 260m
const XS = [-160, -80, 0, 80, 160].map(X), ZS = [360, 440, 520].map(Z)
const WIDE_X = new Set([0]), WIDE_Z = new Set()
const roadW = (axis, v) => (axis === 'x' ? WIDE_X.has(v) : WIDE_Z.has(v)) ? 28 : 18
export const POLE_H = 10.5

export function setupArena(world) {
  world.bounds = { ...AREA }
  const poles = [], spans = []
  const near = (v, lines, w) => lines.some(l => Math.abs(v - l) < w)
  const add = (x, z) => { if (x < AREA.x0 + 3 || x > AREA.x1 - 3 || z < AREA.z0 + 3 || z > AREA.z1 - 3) return null; const p = { cx: x, cz: z, yaw: 0, hw: 0.28, hl: 0.28, y0: 0, y1: POLE_H, kind: 'pole', anchorOnly: true }; poles.push(p); return p }
  // 南北の通り
  for (const x of XS) {
    const off = roadW('x', x) / 2 + 1.3
    for (const s of [-1, 1]) {
      let prev = null
      for (let z = AREA.z0 + 12; z < AREA.z1 - 6; z += 24) {
        if (near(z, ZS, 15)) { prev = null; continue }
        const p = add(x + s * off, z); if (prev && p) spans.push([prev, p]); prev = p
      }
    }
  }
  // 東西の通り
  for (const z of ZS) {
    const off = roadW('z', z) / 2 + 1.3
    for (const s of [-1, 1]) {
      let prev = null
      for (let x = AREA.x0 + 12; x < AREA.x1 - 6; x += 24) {
        if (near(x, XS, 15)) { prev = null; continue }
        const p = add(x, z + s * off); if (prev && p) spans.push([prev, p]); prev = p
      }
    }
  }
  // 街灯と信号も掛け点にする（壊せる小物なのでぶつかりはしない）
  const lamps = world.objects.filter(o => (o.type === 'lamp' || o.type === 'signal') && o.cx > AREA.x0 && o.cx < AREA.x1 && o.cz > AREA.z0 && o.cz < AREA.z1)
    .map(o => ({ cx: o.cx, cz: o.cz, yaw: 0, hw: 0.3, hl: 0.3, y0: o.y0, y1: o.y1, kind: o.type, anchorOnly: true }))
  world.poles = poles
  world.spans = spans
  world.extraAnchors = [...poles, ...lamps]
  world._anchorBoxes = null
  // 落ちているしっぽ（手ぬぐい）を下げる所: 電柱の腕木。地面からは届かない高さ
  world.tailSpots = poles.filter((p, i) => i % 3 === 0).map(p => ({ x: p.cx, y: 7.6, z: p.cz }))
  return world
}
