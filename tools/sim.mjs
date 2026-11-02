// 自分の遊び方（bot）ごとに、CPU 3人と種を変えて対戦させ、順位と本数の分布を出す。node tools/sim.mjs [回数] [性格]
// 性格: skilled（上手い）/ sloppy（下手）/ ground（地面だけ走る手抜き）/ idle（何もしない）
import { createWorld } from '../shared/track.js'
import { setupArena } from '../shared/arena.js'
import { createRunner, stepRunner } from '../shared/runner.js'
import { createMatch, stepMatch, ranking, TAG } from '../shared/tag.js'
const LEVEL = process.env.LEVEL || 'normal'
if (process.env.NOLOCK) TAG.levels[LEVEL].lockR = 0
if (process.env.NOCARS) TAG.cars = false   // 車なしで比べる
import { createBot, botInput } from '../shared/tagbot.js'
export const CPU_SKILL = TAG.levels[LEVEL].cpu
const N = +(process.argv[2] || 12), only = process.argv[3]
const world = setupArena(createWorld('city'))
const dt = 1 / 60
export function spawns(b) { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; return [[cx, cz - 40, 0], [cx + 60, cz, -Math.PI / 2], [cx, cz + 50, Math.PI], [cx - 60, cz, Math.PI / 2]] }
export function play(kind, seed) {
  const sp = spawns(world.bounds)
  const rs = sp.map(([x, z, yaw], i) => createRunner({ id: 'p' + i, spawn: { x, y: 0, z, yaw } }))
  const m = createMatch(world, rs, seed, LEVEL)
  const bots = [createBot(kind, 0.6, seed * 7), ...CPU_SKILL.map((s, i) => createBot('cpu', s, seed * 13 + i))]
  let fly = 0, run = 0, flySpd = 0, runSpd = 0
  while (!m.over) {
    for (let i = 0; i < 4; i++) { const p = m.players[i]; const inp = botInput(bots[i], p, m, world, dt); p.r.events.length = 0; stepRunner(p.r, inp, dt, world) }
    stepMatch(m, dt); m.events.length = 0
    const r = rs[0], v = Math.hypot(r.vx, r.vz)
    if (r.grounded) { run++; runSpd += v } else { fly++; flySpd += v }
  }
  const rk = ranking(m)
  return { rank: rk.indexOf(m.players[0]) + 1, tails: m.players[0].tails, steals: m.players[0].steals, picks: m.players[0].picks, cpu: m.players.slice(1).map(p => p.tails), car: m.players[0].carHits, cpuCar: m.players.slice(1).reduce((a, p) => a + p.carHits, 0) / 3, ground: m.players[0].groundSum, runV: run ? runSpd / run : 0, flyV: fly ? flySpd / fly : 0 }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const k of only ? [only] : ['skilled', 'sloppy', 'human', 'beginner', 'ground', 'idle']) {
    const g = []; for (let s = 1; s <= N; s++) g.push(play(k, s))
    const avg = f => (g.reduce((a, x) => a + f(x), 0) / g.length)
    const cpuAvg = [0, 1, 2].map(i => avg(x => x.cpu[i]).toFixed(1)).join('/')
    console.log(`${k.padEnd(8)} 順位 ${avg(x => x.rank).toFixed(2)}  1位 ${g.filter(x => x.rank === 1).length}/${N}  本数 ${avg(x => x.tails).toFixed(2)}（0本 ${g.filter(x => x.tails === 0).length}回・1本も取れず ${g.filter(x => x.steals + x.picks === 0).length}回）  奪った ${avg(x => x.steals).toFixed(1)}  拾った ${avg(x => x.picks).toFixed(1)}  地面 ${avg(x => x.ground).toFixed(0)}秒  走り ${avg(x => x.runV).toFixed(1)}m/s 飛び ${avg(x => x.flyV).toFixed(1)}m/s  CPU本数 ${cpuAvg}  車 ${avg(x => x.car).toFixed(1)}回 CPU車 ${avg(x => x.cpuCar).toFixed(1)}回`)
  }
}
