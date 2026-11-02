// 逃げるだけモードの釣り合い。node tools/flee.mjs [回数]
import { createWorld } from '../shared/track.js?v=7'
import { setupArena } from '../shared/arena.js?v=7'
import { createRunner, stepRunner } from '../shared/runner.js?v=7'
import { createMatch, stepMatch, TAG } from '../shared/tag.js?v=7'
import { createBot, botInput } from '../shared/tagbot.js?v=7'
const N = +(process.argv[2] || 8)
const w = setupArena(createWorld('city')), b = w.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2
export function playFlee(kind, lv, seed) {
  const sp = [[cx, cz - 40, 0], [cx + 60, cz, -Math.PI / 2], [cx, cz + 50, Math.PI], [cx - 60, cz, Math.PI / 2]]
  const rs = sp.map(([x, z, yaw], i) => createRunner({ id: 'p' + i, spawn: { x, y: 0, z, yaw } }))
  const m = createMatch(w, rs, seed, lv, 'flee')
  const bots = [createBot(kind, 0.6, seed), ...TAG.levels[lv].cpu.map((s, i) => createBot('cpu', s, seed * 13 + i))]
  while (!m.over) { for (let i = 0; i < 4; i++) { const p = m.players[i]; p.r.events.length = 0; stepRunner(p.r, botInput(bots[i], p, m, w, 1 / 60), 1 / 60, w) } stepMatch(m, 1 / 60); m.events.length = 0 }
  return { t: m.t, tails: m.players[0].tails }
}
if (import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  for (const lv of ['easy', 'normal', 'hard']) for (const kind of ['flee', 'fleeSloppy', 'ground', 'idle']) {
    const res = []; for (let s = 1; s <= N; s++) res.push(playFlee(kind, lv, s))
    console.log(lv.padEnd(6), kind.padEnd(10), '逃げきり', res.filter(r => r.tails > 0).length + '/' + N, '残り', res.map(r => r.tails).join(','), '時間', res.map(r => Math.round(r.t)).join(','))
  }
}
