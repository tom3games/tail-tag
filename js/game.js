// 空中しっぽ取り。WIRE ESCAPE のワイヤーと街で、CPU 3人と腰の手ぬぐい（しっぽ）を取り合う
// 地面に居続けるとしっぽが光ってばれる。3分で昼から夜になる。終わった時の本数で順位
import * as THREE from 'three'
import { GAME } from '../shared/config.js?v=7'
import { createWorld } from '../shared/track.js?v=7'
import { setupArena, AREA, POLE_H } from '../shared/arena.js?v=7'
import { buildScene } from './scene.js?v=7'
import { FX } from './fx.js?v=7'
import { loadSky, setAniso } from './look.js?v=7'
import { Q } from './quality.js?v=7'
import { RunnerModel } from './runnermodel.js?v=7'
import { CharRunnerModel, loadCharAssets, charAssets, makeTowel } from './charmodel.js?v=7'
import { createRunner, stepRunner, findAnchor, rayHit, RUN } from '../shared/runner.js?v=7'
import { TAG, COLORS, createMatch, stepMatch, ranking, lockTarget } from '../shared/tag.js?v=7'
import { createBot, botInput } from '../shared/tagbot.js?v=7'

const $ = id => document.getElementById(id)
const STEP = GAME.step
const URL_ = 'https://tom3games.github.io/tail-tag/'
const store = { get: k => { try { return localStorage.getItem(k) } catch (e) { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} } }

// ---------------------------------------------------------------- 文言（日英）
const T = {
  ja: {
    logo: '空中しっぽ取り', sub: 'ビルの谷間で、腰の手ぬぐいを奪い合う',
    lvHead: '相手の強さ', lvEasy: 'かんたん', lvNormal: 'ふつう', lvHard: 'むずかしい',
    modeHead: 'ルール', modeTag: '取り合い', modeFlee: '逃げるだけ',
    fleeWin: '逃げきった', fleeLose: '全部取られた', fleeDown: '全部取られた…', hintFlee: '<small>こつ</small>3人とも自分を追ってくる。飛んで逃げろ',
    statLeft: '残った', statLost: '取られた', postFlee: (n, ok) => ok ? `空中しっぽ取り（逃げるだけ）で手ぬぐい${n}本残して逃げきった` : '空中しっぽ取り（逃げるだけ）で全部取られた',
    start: 'はじめる', how: '遊び方', lang: 'EN', more: 'ほかのゲーム', muteOn: '音 入', muteOff: '音 切', loading: '手ぬぐいを干しています',
    howTitle: '遊び方', ok: 'わかった',
    howItems: [
      '建物や電柱を<b>タッチ</b>か<b>大きいボタン</b>でワイヤー。もう一回で離す',
      '相手に<b>飛び込む</b>と、手ぬぐいを1本取れる',
      '地面にいると<b>光ってばれる</b>。電柱の手ぬぐいは空中でしか取れない'
    ],
    keysPc: 'PC: WASD・矢印で移動　クリックでワイヤー（E でも可）　Space でも離れる・壁を蹴る　ドラッグで見回す　壁では WASD で上下左右',
    credit: '音: Kenney, rubberduck, artisticdude, poinl, Almitory ほか（CC0）。人物: KayKit（CC0）',
    pause: '休憩', paused: '休憩中', resume: '戻る', quit: 'やめる',
    jump: '跳ぶ', tooFar: '届かない',
    hint1: '<small>こつ</small>大きいボタンかビルをタッチでワイヤー', hint1Pc: '<small>こつ</small>ビルや電柱をクリック（か E）でワイヤー',
    hint2: '<small>こつ</small>光る矢印の相手に飛び込め', hint3: '<small>こつ</small>壁ではスティックで這う。大きいボタンで離れる',
    glowMe: '地面にいると光る！', got: n => `${n}から取った`, lost: n => `${n}に取られた`, pick: '電柱の手ぬぐいを取った', freeNew: '電柱に手ぬぐいが下がった',
    cpuGot: (a, b) => `${a}が${b}から取った`, last30: 'あと30秒', last10: 'あと10秒', end: 'そこまで',
    ranks: ['優勝', '2位', '3位', '4位'], again: 'もう一回', save: '画像を保存', post: 'Xでポスト', toTitle: 'タイトル',
    tails: n => `${n}本`, resultHead: '結果発表', statSteal: '奪った', statPick: '拾った', statAir: '空にいた',
    verdict: ['空の王', 'いい飛びっぷり', 'もう少し空へ', '地面にいすぎ'],
    postText: (r, n) => `空中しっぽ取りで${r}（手ぬぐい${n}本）`
  },
  en: {
    logo: 'Tail Tag in the Sky', sub: 'Swing between towers and steal the towels tucked in their belts',
    lvHead: 'Rivals', lvEasy: 'Easy', lvNormal: 'Normal', lvHard: 'Hard',
    modeHead: 'Rules', modeTag: 'Steal', modeFlee: 'Escape',
    fleeWin: 'Escaped', fleeLose: 'All taken', fleeDown: 'All taken...', hintFlee: '<small>Tip</small>All three are after you. Fly!',
    statLeft: 'Left', statLost: 'Taken', postFlee: (n, ok) => ok ? `Escaped with ${n} towels in Tail Tag in the Sky (escape mode)` : 'Lost all my towels in Tail Tag in the Sky (escape mode)',
    start: 'Play', how: 'How to play', lang: 'JP', more: 'More games', muteOn: 'Sound on', muteOff: 'Muted', loading: 'Hanging the towels',
    howTitle: 'How to play', ok: 'Got it',
    howItems: [
      '<b>Tap</b> a building or pole, or the big button, to swing. Press again to let go',
      '<b>Fly into</b> a rival to grab one of their towels',
      'Stay on the street and <b>your towel glows</b>. Towels hanging on poles can only be grabbed in the air'
    ],
    keysPc: 'PC: WASD / arrows move · click to wire (or E) · Space also lets go / kicks off a wall · drag to look · WASD on walls',
    credit: 'Sounds: Kenney, rubberduck, artisticdude, poinl, Almitory and others (CC0). Characters: KayKit (CC0)',
    pause: 'Pause', paused: 'Paused', resume: 'Resume', quit: 'Quit',
    jump: 'Jump', tooFar: 'Too far',
    hint1: '<small>Tip</small>Tap the big button or a building to wire', hint1Pc: '<small>Tip</small>Click a building or pole (or E) to wire',
    hint2: '<small>Tip</small>Fly into the rival the arrow points at', hint3: '<small>Tip</small>Crawl with the stick. The big button lets go',
    glowMe: 'On the street, you glow!', got: n => `Grabbed from ${n}`, lost: n => `${n} took one`, pick: 'Grabbed a towel off a pole', freeNew: 'A towel is hanging on a pole',
    cpuGot: (a, b) => `${a} took one from ${b}`, last30: '30 seconds left', last10: '10 seconds left', end: 'Time!',
    ranks: ['1st', '2nd', '3rd', '4th'], again: 'Again', save: 'Save image', post: 'Post on X', toTitle: 'Title',
    tails: n => `${n}`, resultHead: 'Results', statSteal: 'Stolen', statPick: 'Picked', statAir: 'In the air',
    verdict: ['King of the sky', 'Nice swinging', 'Stay up more', 'Too much street'],
    postText: (r, n) => `I placed ${r} in Tail Tag in the Sky (${n} towels)`
  }
}
let level = ['easy', 'normal', 'hard'].includes(store.get('tt.level')) ? store.get('tt.level') : 'easy'
let gmode = store.get('tt.mode') === 'flee' ? 'flee' : 'tag'   // 取り合い／逃げるだけ
let lang = store.get('tt.lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
const t = k => T[lang][k]
const pname = i => COLORS[i].name[lang === 'ja' ? 0 : 1]
const touchMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
document.body.classList.toggle('is-touch', touchMode)
function applyLang() {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll('[data-t]')) { const v = t(el.dataset.t); if (typeof v === 'string') el.textContent = v }
  $('howList').innerHTML = t('howItems').map((s, i) => `<li><i>${i + 1}</i><span>${s}</span></li>`).join('')
  $('howKeys').textContent = touchMode ? '' : t('keysPc')
  $('btnMute').textContent = Snd.muted ? t('muteOff') : t('muteOn')
  buildLine()
}

// ---------------------------------------------------------------- 音（録音素材だけ）
Snd.muted = store.get('tt.mute') === '1'
Snd.def({
  wire: ['snd/swish-1.mp3', 'snd/swish-2.mp3', 'snd/swish-3.mp3'], hook: ['snd/metalClick.mp3', 'snd/metal_02.mp3'],
  land: ['snd/footstep_01.mp3', 'snd/footstep_02.mp3'], bonk: ['snd/thwack-01.mp3', 'snd/thwack-03.mp3'],
  grab: ['snd/cloth1.mp3', 'snd/cloth2.mp3', 'snd/cloth4.mp3'], lost: ['snd/grunt_01.mp3', 'snd/grunt_02.mp3', 'snd/grunt_03.mp3', 'snd/grunt_04.mp3'],
  pick: 'snd/coin_drop.mp3', ding: 'snd/bell_ding1.mp3', glow: 'snd/error_004.mp3', free: 'snd/confirmation_002.mp3',
  click: 'snd/click_001.mp3', tick: 'snd/tick_002.mp3', whoosh: 'snd/swish-5.mp3', clap: 'snd/applause.mp3',
  win: 'snd/jingles_SAX01.mp3', mid: 'snd/jingles_SAX10.mp3', meh: 'snd/jingles_SAX03.mp3', lose: 'snd/jingles_PIZZA07.mp3'
})
const sfx = (n, o) => Snd.play(n, o)

// ---------------------------------------------------------------- 描画の土台
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
renderer.setPixelRatio(Q.pixelRatio)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
setAniso(renderer)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0xc9d6e2, 0.0022)
scene.background = new THREE.Color(0xa9c4e0)
const sun = new THREE.DirectionalLight(0xfff1dc, 3.0)
sun.userData.dir = new THREE.Vector3(-0.45, 0.62, -0.64).normalize()
sun.castShadow = true
sun.shadow.mapSize.set(Q.shadow, Q.shadow)
Object.assign(sun.shadow.camera, { left: -Q.shadowRange, right: Q.shadowRange, top: Q.shadowRange, bottom: -Q.shadowRange, near: 1, far: 400 })
sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0004
scene.add(sun, sun.target)
const hemi = new THREE.HemisphereLight(0xc4d8ff, 0x6a5a48, 1.8)
scene.add(hemi)
let skyReady = false
loadSky(renderer, scene, sun, () => { hemi.intensity = 0.4; skyReady = true })
const camera = new THREE.PerspectiveCamera(64, 1, 0.3, 2400)
const world = setupArena(createWorld('city'))
const built = buildScene(scene, world)
for (const g of built.gates) g.grp.visible = false
const fx = new FX(scene, world)

// 夜に明るくする窓（建物の発光の強さを覚えておく）
const glowMats = []
scene.traverse(o => { if (o.material && o.material.emissiveMap) glowMats.push({ m: o.material, base: o.material.emissiveIntensity }) })

// ---------------------------------------------------------------- 電柱と電線
{
  const P = world.poles, n = P.length
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.85 })
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.2, POLE_H, 8).translate(0, POLE_H / 2, 0), concrete, n)
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.12, 0.12).translate(0, POLE_H - 0.9, 0), new THREE.MeshStandardMaterial({ color: 0x5b5952, roughness: 0.8 }), n)
  const trans = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 10).translate(0.42, POLE_H - 2.2, 0), new THREE.MeshStandardMaterial({ color: 0x7d8380, roughness: 0.6, metalness: 0.3 }), n)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3()
  P.forEach((o, i) => {
    // 腕木は電線の向き（通りに沿う）に直角
    const alongX = world.spans.some(([a, b]) => (a === o || b === o) && Math.abs(a.cz - b.cz) < 0.1)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), alongX ? Math.PI / 2 : 0)
    m4.compose(p.set(o.cx, 0, o.cz), q, one)
    pole.setMatrixAt(i, m4); arm.setMatrixAt(i, m4)
    trans.setMatrixAt(i, i % 4 === 0 ? m4 : new THREE.Matrix4().makeScale(0, 0, 0))
  })
  pole.castShadow = true
  scene.add(pole, arm, trans)
  // 電線（たるませる）
  const pts = []
  for (const [a, b] of world.spans) for (const off of [-0.7, 0.7]) {
    const alongX = Math.abs(a.cz - b.cz) < 0.1
    const ox = alongX ? 0 : off, oz = alongX ? off : 0
    const N = 8
    for (let k = 0; k < N; k++) {
      const f0 = k / N, f1 = (k + 1) / N, sag = f => 0.9 * 4 * f * (1 - f)
      pts.push(a.cx + (b.cx - a.cx) * f0 + ox, POLE_H - 0.95 - sag(f0), a.cz + (b.cz - a.cz) * f0 + oz)
      pts.push(a.cx + (b.cx - a.cx) * f1 + ox, POLE_H - 0.95 - sag(f1), a.cz + (b.cz - a.cz) * f1 + oz)
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x222222 })))
}
// 遊ぶ範囲の端: 工事用の柵（縞）
{
  const c = document.createElement('canvas'); c.width = 128; c.height = 32
  const x = c.getContext('2d'); x.fillStyle = '#f4c21b'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#1c1c1c'
  for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 16, 32); x.lineTo(i * 16 + 8, 32); x.lineTo(i * 16 + 20, 0); x.lineTo(i * 16 + 12, 0); x.fill() }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = THREE.RepeatWrapping
  const mat = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 })
  const B = AREA
  const segs = [[B.x0, B.z0, B.x1, B.z0], [B.x1, B.z0, B.x1, B.z1], [B.x1, B.z1, B.x0, B.z1], [B.x0, B.z1, B.x0, B.z0]]
  for (const [ax, az, bx, bz] of segs) {
    const L = Math.hypot(bx - ax, bz - az)
    const t2 = tx.clone(); t2.repeat.set(L / 2.4, 1); t2.needsUpdate = true
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.5, 0.15), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.7 }))
    m.position.set((ax + bx) / 2, 1.0, (az + bz) / 2); m.rotation.y = -Math.atan2(bz - az, bx - ax)
    scene.add(m)
  }
}
// 夜の街灯の明かり（点の光）
const lampPts = (() => {
  const L = world.extraAnchors.filter(o => o.kind === 'lamp'), pos = []
  for (const o of L) pos.push(o.cx, o.y1 - 0.4, o.cz)
  for (const o of world.poles.filter((_, i) => i % 2 === 0)) pos.push(o.cx, POLE_H - 1.6, o.cz)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  const c = document.createElement('canvas'); c.width = c.height = 64
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(0.25, 'rgba(255,210,140,.6)'); gr.addColorStop(1, 'rgba(255,200,120,0)')
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64)
  const m = new THREE.PointsMaterial({ size: 3.2, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
  const p = new THREE.Points(g, m); scene.add(p); return p
})()

// ---------------------------------------------------------------- 落ちている手ぬぐい（電柱に下がる）
const freeMeshes = []
function freeMesh(i) {
  if (!freeMeshes[i]) {
    const g = new THREE.Group()
    const tw = makeTowel('#f2efe6', 0.5, 1.2); tw.material.emissive.set(0xffe9a8)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.7, depthWrite: false }))
    ring.position.y = -0.6
    g.add(tw, ring); g.userData = { tw, ring }
    scene.add(g); freeMeshes[i] = g
  }
  return freeMeshes[i]
}

// ワイヤー（4人ぶん）
const ropes = COLORS.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0x2b2b2b })); m.visible = false; scene.add(m); return m })
// 狙い（PC の E で掛かる所）
const aimMark = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }))
aimMark.renderOrder = 5; aimMark.visible = false; scene.add(aimMark)

// ---------------------------------------------------------------- 状態
let mode = 'title'        // title | play | result
let m = null, bots = [], models = []
let paused = false, dbgPause = false, endAt = 0
let hitStop = 0, fovKick = 0, flashA = 0   // 取った瞬間に少し止める・視野を一瞬動かす・光る
const cam = { hd: 0, pitch: 0.15, userT: -1e9, pos: new THREE.Vector3(), off: new THREE.Vector3(-6, 3, 0), look: new THREE.Vector3(), lookOff: new THREE.Vector3(), fov: 64 }
const _v = new THREE.Vector3(), _w = new THREE.Vector3()
// ワイヤーボタンが向かう相手の目印（頭の上の輪）
const lockRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }))
lockRing.renderOrder = 10; lockRing.visible = false; scene.add(lockRing)
const me = () => m && m.players[0]

function spawnPoints() { const b = world.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; return [[cx, cz - 40, 0], [cx + 60, cz, -Math.PI / 2], [cx, cz + 50, Math.PI], [cx - 60, cz, Math.PI / 2]] }
function newMatch(seed, demo) {
  const sp = spawnPoints()
  const rs = sp.map(([x, z, yaw], i) => createRunner({ id: COLORS[i].id, spawn: { x, y: 0, z, yaw } }))
  const lv = demo ? 'normal' : level
  m = createMatch(world, rs, seed, lv, demo ? 'tag' : gmode)
  bots = [demo ? createBot('cpu', 0.6, seed) : null, ...TAG.levels[lv].cpu.map((s, i) => createBot('cpu', s, seed * 13 + i))]
  rebuildModels()
}
function rebuildModels() {
  for (const md of models) { scene.remove(md.group); md.dispose() }
  models = COLORS.map(c => { const md = charAssets.ready ? new CharRunnerModel(c) : new RunnerModel(); scene.add(md.group); return md })
}
loadCharAssets().then(() => { if (charAssets.ready && models.length && !(models[0] instanceof CharRunnerModel)) rebuildModels() })

// ---------------------------------------------------------------- 入力
const keys = new Set()
const press = { jump: false }
let pendingWire = null
addEventListener('keydown', e => {
  if (mode !== 'play') return
  if (e.repeat) return
  keys.add(e.code)
  if (e.code === 'KeyE') pendingWire = { at: null, key: true }
  if (e.code === 'Space') { press.jump = true; e.preventDefault() }
  if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused)
})
addEventListener('keyup', e => keys.delete(e.code))
const gest = new Map()
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
renderer.domElement.addEventListener('pointerdown', e => {
  Snd.init()
  if (mode !== 'play' || paused) return
  gest.set(e.pointerId, { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false })
})
addEventListener('pointermove', e => {
  const g = gest.get(e.pointerId); if (!g) return
  const dx = e.clientX - g.lx, dy = e.clientY - g.ly; g.lx = e.clientX; g.ly = e.clientY
  if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) g.moved = true
  if (!g.moved) return
  cam.hd -= dx * 0.006; cam.pitch = Math.max(-0.35, Math.min(1, cam.pitch + dy * 0.004)); cam.userT = performance.now()
})
addEventListener('pointerup', e => {
  const g = gest.get(e.pointerId); if (!g) return
  gest.delete(e.pointerId)
  if (!g.moved && performance.now() - g.t < 450 && mode === 'play' && !paused) aimAt(e.clientX, e.clientY)
})
addEventListener('pointercancel', e => gest.delete(e.pointerId))
function aimAt(cx, cy) {
  const rc = renderer.domElement.getBoundingClientRect()
  ndc.set((cx - rc.left) / rc.width * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const o = ray.ray.origin, d = ray.ray.direction
  // ワイヤー中でも狙った所があれば掛け直す（つなぎ）。何も無い所なら外すだけ
  pendingWire = { at: rayHit(world, o.x, o.y, o.z, d.x, d.y, d.z, 400), sx: cx, sy: cy }
}
const stick = { x: 0, y: 0, id: null }
{
  // 左の広い範囲のどこを触ってもスティックが出る（空中出前・空中キャッチと同じ）
  const zone = $('stickZone'), el = $('stick'), knob = el.querySelector('.knob')
  let ox = 0, oy = 0
  const R = () => el.getBoundingClientRect().width / 2
  const upd = e => {
    let dx = (e.clientX - ox) / R(), dy = (e.clientY - oy) / R()
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l }
    stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`
  }
  zone.addEventListener('pointerdown', e => {
    Snd.init(); if (stick.id != null) return
    stick.id = e.pointerId; try { zone.setPointerCapture(e.pointerId) } catch (er) {}
    const zr = zone.getBoundingClientRect(); ox = e.clientX; oy = e.clientY
    el.style.left = (ox - zr.left) + 'px'; el.style.top = (oy - zr.top) + 'px'; el.classList.add('held'); upd(e)
  })
  zone.addEventListener('pointermove', e => { if (e.pointerId === stick.id) upd(e) })
  const end = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; el.classList.remove('held'); el.style.left = el.style.top = '' }
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end)
  // 大きいボタン: 前の上へ自動でワイヤー（相手は追わない）。ワイヤー中なら離す、壁に張り付き中なら壁から離れる。跳ぶボタンは無い（2026-11-02 本人）
  for (const b of document.querySelectorAll('.tbtn')) b.addEventListener('pointerdown', e => { e.preventDefault(); Snd.init(); if (b.dataset.k === 'wire') pendingWire = { at: null, key: true } })
}
function gather(r) {
  let thr = 0, brk = 0, steer = 0, cx = 0, cy = 0
  if (keys.has('KeyW') || keys.has('ArrowUp')) { thr = 1; cy += 1 }
  if (keys.has('KeyS') || keys.has('ArrowDown')) { brk = 1; cy -= 1 }
  if (keys.has('KeyA') || keys.has('ArrowLeft')) { steer -= 1; cx -= 1 }
  if (keys.has('KeyD') || keys.has('ArrowRight')) { steer += 1; cx += 1 }
  // 画面の右と前（カメラの実際の向きから取る。cam.hd の計算に頼らない）
  const e = camera.matrixWorld.elements
  let rgx = e[0], rgz = e[2], fwx = -e[8], fwz = -e[10]
  { const l1 = Math.hypot(rgx, rgz) || 1, l2 = Math.hypot(fwx, fwz) || 1; rgx /= l1; rgz /= l1; fwx /= l2; fwz /= l2 }
  let moveDir = null
  if (stick.id != null) {
    const mag = Math.min(1, Math.hypot(stick.x, stick.y))
    if (mag > 0.15) {
      // 倒した向き（画面から見て）へ動く。少し倒すだけで全力
      const dx = rgx * stick.x - fwx * stick.y, dz = rgz * stick.x - fwz * stick.y, l = Math.hypot(dx, dz) || 1
      moveDir = { x: dx / l, z: dz / l }
      thr = Math.max(thr, Math.min(1, mag * 1.3)); steer = 0
      cy = -stick.y; cx = stick.x
    }
  }
  const inp = { throttle: thr, brake: brk, steer, jump: press.jump, wire: false, moveDir }
  // ワイヤーボタンの自動狙い: 近くに取れる相手（光る輪の相手）がいればその方へ（かんたん・ふつう）。いなければスティックの向き、スマホでは画面の前
  const lt = m && mode === 'play' ? lockTarget(m, me()) : null
  inp.wireYaw = lt ? Math.atan2(lt.x - r.x, lt.z - r.z) : moveDir ? Math.atan2(moveDir.x, moveDir.z) : touchMode ? Math.atan2(fwx, fwz) : undefined
  // 壁: スティックの上下＝上下、左右＝画面の左右（カメラから見て）
  if (r.climbing) {
    const cl = r.climbing, tx = -cl.nz, tz = cl.nx
    const side = Math.sign(rgx * tx + rgz * tz) || 1   // 画面の右と壁沿いの向きをそろえる（カメラの実際の向きから）
    inp.climbY = Math.abs(cy) > 0.25 ? Math.sign(cy) * Math.min(1, Math.abs(cy) * 1.3) : 0
    inp.climbX = Math.abs(cx) > 0.25 ? Math.sign(cx) * Math.min(1, Math.abs(cx) * 1.3) * side : 0
  }
  if (pendingWire) { inp.wire = true; if (pendingWire.at) inp.wireAt = pendingWire.at; r._tap = pendingWire; pendingWire = null }
  press.jump = false
  return inp
}

// ---------------------------------------------------------------- 画面の切り替え
function show(id) { for (const s of ['title', 'how', 'pause', 'result']) $(s).classList.toggle('hidden', s !== id); $('hud').classList.toggle('hidden', mode !== 'play') }
function toTitle() {
  mode = 'title'; paused = false
  newMatch(Math.floor(Math.random() * 1e6), true)
  cam.hd = 0; show('title'); $('touch').classList.add('hidden')
  Snd.loop('bgm', 'snd/bgm_title.mp3', 0.2); Snd.loop('amb', 'snd/loop_highway.mp3', 0.12); Snd.loop('wind', null)
}
let hints = []
function startMatch(seed = Math.floor(Math.random() * 1e6)) {
  Snd.init(); sfx('click')
  mode = 'play'; paused = false; endAt = 0; warned = {}
  newMatch(seed, false); m.seed = seed
  cam.hd = me().r.yaw; cam.pitch = 0.15; cam.userT = -1e9
  show(null); $('touch').classList.toggle('hidden', !touchMode)
  Snd.loop('bgm', 'snd/bgm_play.mp3', 0.15); Snd.loop('amb', 'snd/loop_highway.mp3', 0.14); Snd.loop('wind', 'snd/air_01.mp3', 0.0001)
  const seen = store.get('tt.tut') === '1'
  hints = seen ? [[1.0, touchMode ? 'hint1' : 'hint1Pc']] : [[1.0, touchMode ? 'hint1' : 'hint1Pc'], [7, gmode === 'flee' ? 'hintFlee' : 'hint2'], [16, 'hint3']]
  if (seen && gmode === 'flee') hints.push([5, 'hintFlee'])
  store.set('tt.tut', '1')
  buildLine()
}
let warned = {}
function setPause(p) { if (mode !== 'play') return; paused = p; $('pause').classList.toggle('hidden', !p) }

// ---------------------------------------------------------------- 画面の文字
let sayT = 0
function say(html, sec = 1.8, cls = '') { const el = $('say'); el.className = 'say ' + cls; el.innerHTML = html; sayT = sec }
function fmt(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
// 物干しロープ: 4人の手ぬぐいを本数ぶん干す（点数表）
function buildLine() {
  const el = $('line'); if (!el) return
  el.innerHTML = COLORS.map((c, i) => `<div class="peg" data-i="${i}" style="--c:${c.cloth}"><div class="towels"></div><b>${pname(i)}</b></div>`).join('')
}
let lineKey = ''
function updateHud(dt) {
  const P = m.players
  const key = P.map(p => p.tails + (p.glow ? 'g' : '')).join(',')
  if (key !== lineKey) {
    lineKey = key
    for (const p of P) {
      const peg = document.querySelector(`.peg[data-i="${p.i}"]`); if (!peg) continue
      const n = p.tails, tw = peg.querySelector('.towels')
      tw.innerHTML = n > 4 ? '<i></i><i></i><i></i><span>×' + n + '</span>' : '<i></i>'.repeat(n) || '<em></em>'
      peg.classList.toggle('glow', p.glow)
    }
  }
  const left = TAG.sec - m.t
  $('clockT').textContent = fmt(left)
  $('clockHand').setAttribute('transform', `rotate(${(m.t / TAG.sec) * 360} 20 20)`)
  if (sayT > 0) { sayT -= dt; $('say').classList.toggle('hidden', sayT <= 0) }
  $('glowWarn').classList.toggle('hidden', !me().glow)
  // 狙う相手（取れる相手か落ちている手ぬぐい）へ矢印
  const r = me().r
  let goal = null, gd = 1e9, gc = '#fff'
  for (const p of P) if (p !== me() && p.tails > 0 && p.immune <= 0) { const d = Math.hypot(p.r.x - r.x, p.r.z - r.z) - (p.glow ? 80 : 0); if (d < gd) { gd = d; goal = _w.set(p.r.x, p.r.y + 2.6, p.r.z); gc = COLORS[p.i].cloth } }
  for (const f of m.free) { const d = Math.hypot(f.x - r.x, f.z - r.z) - 10; if (d < gd) { gd = d; goal = _w.set(f.x, f.y + 1.2, f.z); gc = '#f2efe6' } }
  // ワイヤーボタンが向かう相手（届く距離の中）には、頭の上に輪を出す。矢印も同じ相手を指す
  const lt = lockTarget(m, me())
  if (lt) { goal = _w.set(lt.x, lt.y + 1.5, lt.z); gc = lt.free ? '#f2efe6' : COLORS[lt.who].cloth }
  lockRing.visible = !!lt
  if (lt) { lockRing.position.set(lt.x, lt.y + (lt.free ? 1.6 : 2.2), lt.z); lockRing.material.color.set(gc); const k = performance.now() / 1000; lockRing.rotation.set(Math.PI / 2, 0, k * 2); lockRing.scale.setScalar(1 + Math.sin(k * 6) * 0.08) }
  const ar = $('arrow')
  if (!goal) { ar.classList.add('hidden'); return }
  if (onScreen(goal.x, goal.y, goal.z)) { ar.classList.add('hidden'); return }   // 見えている時は出さない
  ar.classList.remove('hidden'); ar.style.setProperty('--c', gc)
  $('arrowD').textContent = Math.round(Math.hypot(goal.x - r.x, goal.z - r.z)) + 'm'
  placeCompass(ar, compassAngle(goal.x, goal.z, r))
}
// 矢印は方角だけ（2026-11-03 本人「高さを表すと分かりづらい。方角だけでいい」）: カメラの前を上として、目標の水平の向きへ回す。画面の上の真ん中に固定
function compassAngle(tx, tz, r) {
  const e = camera.matrixWorld.elements
  let rx = e[0], rz = e[2], fx = -e[8], fz = -e[10]; const a = Math.hypot(rx, rz) || 1, b = Math.hypot(fx, fz) || 1; rx /= a; rz /= a; fx /= b; fz /= b
  const dx = tx - r.x, dz = tz - r.z
  return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)
}
function onScreen(x, y, z) { const p = _v.set(x, y, z).project(camera), W = innerWidth, H = innerHeight; const sx = (p.x * 0.5 + 0.5) * W, sy = (-p.y * 0.5 + 0.5) * H; return p.z < 1 && sx > 30 && sx < W - 30 && sy > 70 && sy < H - 30 }
function placeCompass(el, ang) { el.style.left = '50%'; el.style.top = ''; el.querySelector('svg').style.transform = `rotate(${ang}rad)`; window.__compass = window.__compass || {}; window.__compass[el.id] = ang }


// ---------------------------------------------------------------- 出来事
const log = []
function onRunnerEvent(e) {
  log.push({ src: 'r', ...e, at: +m.t.toFixed(2) })
  if (e.t === 'wire') { sfx('wire', { vol: 0.7 }); sfx('hook', { vol: 0.5, delay: 0.06 }) }
  else if (e.t === 'wireMiss') {
    sfx('wire', { vol: 0.4, rate: 1.3 })
    const tp = me().r._tap
    if (e.far && tp && tp.sx != null) { const el = $('miss'); el.style.left = tp.sx + 'px'; el.style.top = tp.sy + 'px'; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 800) }
  } else if (e.t === 'land') { sfx('land', { vol: Math.min(1, 0.3 + e.impact / 20) }); if (e.impact > 14) { sfx('bonk', { vol: 0.5 }); fx.addShake(Math.min(0.6, e.impact / 40)) } }
  else if (e.t === 'bonk') { sfx('bonk', { vol: 0.8 }); fx.addShake(0.4) }
  else if (e.t === 'unwire' && !e.auto) { const r = me().r, v = Math.hypot(r.vx, r.vy, r.vz); if (v > 16) { sfx('whoosh', { vol: Math.min(0.8, v / 50), rate: 0.9 + Math.random() * 0.2 }); fovKick = Math.min(6, (v - 16) * 0.3) } }   // 速く離すと風を切る
}
function onMatchEvent(e) {
  log.push({ src: 'm', ...e, at: +m.t.toFixed(2) })
  const near = (x, z) => Math.max(0.15, 1 - Math.hypot(x - me().r.x, z - me().r.z) / 120)
  if (e.t === 'steal') {
    const col = new THREE.Color(COLORS[e.from].cloth).getHex()
    fx.debrisAt(e.x, e.y, e.z, 10, col, { speed: 4, up: 3, size: 0.1 })
    if (e.by === 0) { sfx('grab', { vol: 1 }); sfx('ding', { vol: 0.6, delay: 0.12 }); say(t('got')(pname(e.from)), 1.6, 'good'); fx.addShake(0.6); bump(0); hitStop = 0.09; fovKick = -7; flashA = 1; fx.debrisAt(e.x, e.y, e.z, 16, col, { speed: 9, up: 5, size: 0.12 }) }
    else if (e.from === 0) { sfx('grab', { vol: 0.8 }); sfx('lost', { vol: 0.9 }); say(t('lost')(pname(e.by)), 1.6, 'bad'); fx.addShake(0.5); bump(e.by); hitStop = 0.06 }
    else { sfx('grab', { vol: 0.5 * near(e.x, e.z) }); if (sayT <= 0) say(t('cpuGot')(pname(e.by), pname(e.from)), 1.2, 'small'); bump(e.by) }
  } else if (e.t === 'pick') {
    if (e.by === 0) { sfx('pick', { vol: 0.8 }); sfx('grab'); say(t('pick'), 1.6, 'good'); bump(0) } else bump(e.by)
    fx.debrisAt(e.x, e.y, e.z, 12, 0xf2efe6, { speed: 3, up: 3, size: 0.12 })
  } else if (e.t === 'freeNew') { sfx('free', { vol: 0.45 }) }
  else if (e.t === 'glow' && e.who === 0) { sfx('glow', { vol: 0.6 }) }
  else if (e.t === 'end') { sfx('whoosh'); say(e.down ? t('fleeDown') : t('end'), 1.8, 'big'); endAt = 1.8 }
}
function bump(i) { const peg = document.querySelector(`.peg[data-i="${i}"]`); if (!peg) return; peg.classList.remove('bump'); void peg.offsetWidth; peg.classList.add('bump') }

// ---------------------------------------------------------------- 結果（順位発表）
let photo = null
function showResult() {
  mode = 'result'
  Snd.loop('wind', null); Snd.loop('bgm', null)
  if (m.mode === 'flee') return showFleeResult()
  const rk = ranking(m), myRank = rk.indexOf(me()) + 1
  drawPodium($('podium'), rk, myRank)
  const R = T[lang]
  $('rankBig').textContent = R.ranks[myRank - 1]
  $('rankBig').className = 'rank-big r' + myRank
  const air = Math.round(me().airT / Math.max(1, m.t) * 100)
  $('stats').innerHTML = `<span>${R.statSteal} <b>${me().steals}</b></span><span>${R.statPick} <b>${me().picks}</b></span><span>${R.statAir} <b>${air}%</b></span>`
  $('verdict').textContent = R.verdict[air > 85 ? 0 : air > 65 ? 1 : air > 40 ? 2 : 3]
  sfx(myRank === 1 ? 'win' : myRank === 2 ? 'mid' : myRank === 3 ? 'meh' : 'lose', { vol: 0.8 })
  if (myRank === 1) sfx('clap', { vol: 0.6, delay: 0.4 })
  $('btnPost').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t('postText')(R.ranks[myRank - 1], me().tails)) + '&url=' + encodeURIComponent(URL_)
  $('touch').classList.add('hidden')
  show('result')
  $('result').classList.remove('play'); void $('result').offsetWidth; $('result').classList.add('play')
  window.__lastRank = myRank
}
// 逃げるだけの結果: 残った本数が主役
function showFleeResult() {
  const R = T[lang], p = me(), ok = p.tails > 0
  drawPodium($('podium'), ranking(m), 1)
  $('rankBig').textContent = ok ? R.fleeWin : R.fleeLose
  $('rankBig').className = 'rank-big ' + (ok ? 'r1' : 'r4')
  const air = Math.round(p.airT / Math.max(1, m.t) * 100)
  $('stats').innerHTML = `<span>${R.statLeft} <b>${R.tails(p.tails)}</b></span><span>${R.statLost} <b>${p.lost}</b></span><span>${R.statAir} <b>${air}%</b></span>`
  $('verdict').textContent = R.verdict[air > 85 ? 0 : air > 65 ? 1 : air > 40 ? 2 : 3]
  sfx(ok ? (p.tails >= 3 ? 'win' : 'mid') : 'lose', { vol: 0.8 }); if (ok && p.tails >= 3) sfx('clap', { vol: 0.6, delay: 0.4 })
  $('btnPost').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(R.postFlee(p.tails, ok)) + '&url=' + encodeURIComponent(URL_)
  $('touch').classList.add('hidden')
  show('result')
  $('result').classList.remove('play'); void $('result').offsetWidth; $('result').classList.add('play')
  window.__lastRank = ok ? 1 : 4; window.__lastTails = p.tails
}
// 表彰台（保存用の画像も同じ絵）。台の上の物干し竿に、手ぬぐいを本数ぶん干す
function drawPodium(cv, rk, myRank) {
  const W = 720, H = 560
  cv.width = W; cv.height = H
  const x = cv.getContext('2d')
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f1630'); g.addColorStop(0.6, '#2b2d52'); g.addColorStop(1, '#4a3a4e'); x.fillStyle = g; x.fillRect(0, 0, W, H)
  if (photo) { x.globalAlpha = 0.3; const k = Math.max(W / photo.width, H / photo.height); x.drawImage(photo, (W - photo.width * k) / 2, (H - photo.height * k) / 2, photo.width * k, photo.height * k); x.globalAlpha = 1 }
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  x.fillStyle = 'rgba(16,20,36,.85)'
  for (let i = 0; i < 18; i++) { const bw = 30 + rnd() * 50, bh = 80 + rnd() * 200; x.fillRect(i * 42 - 10, H - 120 - bh, bw, bh + 120) }
  x.fillStyle = 'rgba(255,214,140,.5)'
  for (let i = 0; i < 160; i++) x.fillRect(rnd() * W, H - 120 - rnd() * 260, 3, 4)
  const font = '"Zen Kaku Gothic New", sans-serif'
  x.textAlign = 'center'
  const order = [1, 0, 2, 3], hs = [190, 250, 140, 95], xs = [116, 286, 456, 620], bw = 150
  order.forEach((ri, k) => {
    const p = rk[ri]; if (!p) return
    const cx = xs[k], by = H - 30 - hs[ri]
    x.fillStyle = ri === 0 ? '#c9a24a' : '#8d8f96'; x.fillRect(cx - bw / 2, by, bw, hs[ri] + 30)
    x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(cx + bw / 2 - 16, by, 16, hs[ri] + 30)
    x.fillStyle = '#1b1b1b'; x.font = `900 64px ${font}`; x.fillText(String(ri + 1), cx - 6, by + 72)
    x.font = `900 30px ${font}`; x.fillStyle = 'rgba(0,0,0,.65)'; x.fillText(T[lang].tails(p.tails), cx - 6, by + 112)
    // 竿と手ぬぐい
    const ly = by - 74
    x.strokeStyle = '#e8e2d2'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - bw / 2 + 4, ly); x.quadraticCurveTo(cx, ly + 12, cx + bw / 2 - 4, ly); x.stroke()
    const n = p.tails, shown = Math.min(n, 5)
    for (let j = 0; j < shown; j++) {
      const tx = cx - (shown - 1) * 13 + j * 26 - 10, ty = ly + 4
      x.fillStyle = COLORS[p.i].cloth; x.fillRect(tx, ty, 20, 58); x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(tx, ty + 8, 20, 4); x.fillRect(tx, ty + 46, 20, 4)
    }
    // 名前（自分は赤い札）
    x.font = `900 30px ${font}`
    const nm = pname(p.i), tw = x.measureText(nm).width
    if (p.i === 0) { x.fillStyle = COLORS[0].cloth; x.fillRect(cx - tw / 2 - 12, ly - 52, tw + 24, 40) }
    x.fillStyle = '#fff'; x.fillText(nm, cx, ly - 21)
  })
  x.font = `700 18px ${font}`; x.fillStyle = 'rgba(255,255,255,.7)'
  x.textAlign = 'left'; x.fillText(T[lang].logo, 18, 30)
  x.textAlign = 'right'; x.fillText('tom3games.github.io/tail-tag', W - 18, 30)
}
$('btnSave').onclick = () => { $('podium').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'tail-tag-result.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }) }
$('btnStart').onclick = () => startMatch()
// 相手の強さ（既定は かんたん）
function applyLevel() { for (const b of document.querySelectorAll('#level button')) { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(b.dataset.lv === level)) } for (const b of document.querySelectorAll('#modeSel button')) { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(b.dataset.md === gmode)) } }
for (const b of document.querySelectorAll('#modeSel button')) b.onclick = () => { gmode = b.dataset.md; store.set('tt.mode', gmode); applyLevel() }
for (const b of document.querySelectorAll('#level button')) b.onclick = () => { level = b.dataset.lv; store.set('tt.level', level); applyLevel() }
applyLevel()
$('btnAgain').onclick = () => startMatch()
$('btnTitle').onclick = () => toTitle()
$('btnHow').onclick = () => { Snd.init(); show('how') }
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => show('title')
$('btnLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('tt.lang', lang); applyLang() }
$('btnMute').onclick = () => { Snd.init(); Snd.setMute(!Snd.muted); store.set('tt.mute', Snd.muted ? '1' : '0'); applyLang() }
$('btnPause').onclick = () => setPause(true)
$('btnResume').onclick = () => setPause(false)
$('btnQuit').onclick = () => { setPause(false); toTitle() }

// ---------------------------------------------------------------- カメラ
const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k }
function updateCamera(dt, c, md) {
  if (window.__freeze) return
  const pos = md.group.position
  const v = Math.hypot(c.vx, c.vz)
  let hx = Math.sin(c.yaw), hz = Math.cos(c.yaw)
  if (v > 8 && !c.climbing) { const k = c.grounded ? 0.25 : 0.45; hx = hx * (1 - k) + (c.vx / v) * k; hz = hz * (1 - k) + (c.vz / v) * k; const l = Math.hypot(hx, hz); hx /= l; hz /= l }
  const manual = touchMode || performance.now() - cam.userT < 1800   // スマホはカメラが勝手に追いかけない（空中出前と同じ）
  if (!manual) { cam.hd = lerpAngle(cam.hd, Math.atan2(hx, hz), 1 - Math.exp(-dt * (touchMode ? 2.2 : 5))); cam.pitch += ((c.climbing ? 0.35 : 0.15) - cam.pitch) * (1 - Math.exp(-dt * 1.5)) }
  hx = Math.sin(cam.hd); hz = Math.cos(cam.hd)
  let back = 5.2 + Math.min(2.4, v * 0.07), up = 2.1
  if (camera.aspect < 1) { back += 0.6; up += 0.5 }
  up += cam.pitch * 4.2; back *= 1 - Math.max(0, cam.pitch) * 0.15
  let tx = pos.x - hx * back, tz = pos.z - hz * back, ty = pos.y + up
  for (let i = 1; i <= 6; i++) {
    const f = i / 6, px = pos.x + (tx - pos.x) * f, pz = pos.z + (tz - pos.z) * f, py = pos.y + (ty - pos.y) * f
    let hit = false
    for (const o of world.nearby(px, pz)) {
      if (o.slab || o.kind === 'bound' || o.y0 == null || py < o.y0 || py > o.y1) continue
      const cs = Math.cos(o.yaw || 0), sn = Math.sin(o.yaw || 0), dx = px - o.cx, dz = pz - o.cz
      if (Math.abs(dx * cs - dz * sn) < o.hw + 0.4 && Math.abs(dx * sn + dz * cs) < o.hl + 0.4) { hit = true; break }
    }
    if (hit) { const ff = Math.max(0.25, (i - 1) / 6); tx = pos.x + (tx - pos.x) * ff; tz = pos.z + (tz - pos.z) * ff; ty = pos.y + up * 0.8 + (1 - ff) * 2; break }
  }
  const gy = world.groundAt(tx, tz, ty).h + 0.8
  if (ty < gy) ty = gy
  cam.off.lerp(_v.set(tx - pos.x, ty - pos.y, tz - pos.z), 1 - Math.exp(-dt * 10))
  cam.pos.set(pos.x + cam.off.x, pos.y + cam.off.y, pos.z + cam.off.z)
  cam.lookOff.lerp(_v.set(hx * 10, (camera.aspect < 1 ? 0.4 : 1.1) + 1.3 - cam.pitch * 1.2, hz * 10), 1 - Math.exp(-dt * 12))
  cam.look.set(pos.x + cam.lookOff.x, pos.y + cam.lookOff.y, pos.z + cam.lookOff.z)
  camera.position.copy(cam.pos)
  const sh_ = fx.shake
  if (sh_ > 0) camera.position.add(_v.set((Math.random() - 0.5) * sh_, (Math.random() - 0.5) * sh_ * 0.7, (Math.random() - 0.5) * sh_))
  camera.lookAt(cam.look)
  const asp = camera.aspect
  const base = asp >= 1 ? 60 : Math.min(84, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(37)) / asp) * 180 / Math.PI)
  const fov = base + Math.min(18, Math.max(0, Math.hypot(c.vx, c.vy, c.vz) - 6) * 0.5)   // 速いほど広く（12→18）
  cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 4))
  fovKick *= Math.exp(-dt * 6)
  camera.fov = cam.fov + fovKick; camera.updateProjectionMatrix()
  // 振り子の向きに少しだけ体ごと傾く（横へ流れる速さから）
  const me_ = camera.matrixWorld.elements, rl = Math.hypot(me_[0], me_[2]) || 1, lat = (c.vx * me_[0] + c.vz * me_[2]) / rl   // 画面の右向きの速さ
  cam.bank = (cam.bank || 0) + (Math.max(-0.1, Math.min(0.1, (c.rope ? lat : 0) * -0.004)) - (cam.bank || 0)) * (1 - Math.exp(-dt * 3))
  camera.rotateZ(cam.bank)
}

// ---------------------------------------------------------------- 昼→夕方→夜
const C = (h) => new THREE.Color(h)
const KEYS = [
  { f: 0, sun: C(0xfff1dc), si: 3.0, hemiS: C(0xc4d8ff), hi: 0.4, fog: C(0xc9d6e2), bg: 1.0, env: 1.0, exp: 1.0, win: 1, lamp: 0 },
  { f: 0.5, sun: C(0xffb070), si: 2.2, hemiS: C(0xffc7a0), hi: 0.45, fog: C(0xe0a888), bg: 0.75, env: 0.8, exp: 1.0, win: 1.6, lamp: 0.2 },
  { f: 0.75, sun: C(0xff7a48), si: 1.1, hemiS: C(0x9a7aa8), hi: 0.45, fog: C(0x8a6a86), bg: 0.42, env: 0.5, exp: 1.08, win: 3.0, lamp: 0.7 },
  { f: 1, sun: C(0x6f86c8), si: 0.35, hemiS: C(0x4a5a90), hi: 0.6, fog: C(0x232a48), bg: 0.18, env: 0.32, exp: 1.2, win: 4.2, lamp: 1 }
]
const _c1 = new THREE.Color()
function setTime(f) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1]
  for (let i = 0; i < KEYS.length - 1; i++) if (f >= KEYS[i].f && f <= KEYS[i + 1].f) { a = KEYS[i]; b = KEYS[i + 1]; break }
  const k = (f - a.f) / Math.max(1e-6, b.f - a.f), L = (p, q) => p + (q - p) * k
  sun.color.copy(a.sun).lerp(b.sun, k); sun.intensity = L(a.si, b.si)
  hemi.color.copy(a.hemiS).lerp(b.hemiS, k); if (skyReady) hemi.intensity = L(a.hi, b.hi)
  scene.fog.color.copy(a.fog).lerp(b.fog, k)
  if (skyReady) { scene.backgroundIntensity = L(a.bg, b.bg); scene.environmentIntensity = L(a.env, b.env) }
  else if (scene.background && scene.background.isColor) scene.background.copy(_c1.copy(a.fog).lerp(b.fog, k))
  renderer.toneMappingExposure = L(a.exp, b.exp)
  const w = L(a.win, b.win); for (const g of glowMats) g.m.emissiveIntensity = g.base * w
  lampPts.material.opacity = L(a.lamp, b.lamp)
  window.__timeF = f
}

// ---------------------------------------------------------------- ループ
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fx.setScale && fx.setScale(h) }
addEventListener('resize', resize); resize()
let last = performance.now(), acc = 0, frameN = 0, snapAt = 0
function stepOnce() {
  if (!m || mode === 'result') return
  if (mode === 'play' && (paused || m.over)) return
  const demo = mode !== 'play'
  for (let i = 0; i < 4; i++) {
    const p = m.players[i]
    const inp = i === 0 && !demo ? gather(p.r) : botInput(bots[i], p, m, world, STEP)
    p.r.events.length = 0
    stepRunner(p.r, inp, STEP, world)
    if (i === 0 && !demo) for (const e of p.r.events) onRunnerEvent(e)
  }
  stepMatch(m, STEP)
  if (!demo) for (const e of m.events) onMatchEvent(e)
  m.events.length = 0
  if (demo && m.over) newMatch(Math.floor(Math.random() * 1e6), true)
}
function frame() {
  requestAnimationFrame(frame)
  const now = performance.now()
  let dt = Math.min(0.1, (now - last) / 1000); last = now
  if (hitStop > 0) { hitStop -= dt; acc = 0 }   // ヒットストップ: ほんの一瞬だけ止める
  else if (!dbgPause) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { stepOnce(); acc -= STEP; n++ } if (n >= 6) acc = 0 }
  else dt = 0
  render(dt || 0.016)
}
// 速さの線: 画面のふちから中心へ流れる白い線。速いほど多く濃く（20m/s から）
const spd = document.getElementById('speedfx'), sctx = spd.getContext('2d'), hf = document.getElementById('hitflash')
const lines = Array.from({ length: 46 }, () => ({ a: Math.random() * Math.PI * 2, p: Math.random(), s: 0.6 + Math.random() * 0.8, w: 1 + Math.random() * 2 }))
let spdOn = false
function drawSpeed(v, dt) {
  flashA = Math.max(0, flashA - dt * 5); hf.style.opacity = flashA.toFixed(2)
  const k = Math.max(0, Math.min(1, (v - 20) / 18))
  window.__speedK = k
  if (k <= 0) { if (spdOn) { sctx.clearRect(0, 0, spd.width, spd.height); spdOn = false } return }
  spdOn = true
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1)
  if (spd.width !== Math.round(W * dpr) || spd.height !== Math.round(H * dpr)) { spd.width = Math.round(W * dpr); spd.height = Math.round(H * dpr) }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H * 0.45, R = Math.hypot(W, H) * 0.55
  sctx.lineCap = 'round'
  const n = Math.round(lines.length * (0.35 + 0.65 * k))
  for (let i = 0; i < n; i++) {
    const L = lines[i]
    L.p += dt * L.s * (1.6 + k * 2.4); if (L.p > 1) { L.p -= 1; L.a = Math.random() * Math.PI * 2 }
    const r1 = R * (1.05 - L.p * 0.45), r0 = r1 - R * (0.12 + 0.2 * k) * L.s
    const ca = Math.cos(L.a), sa = Math.sin(L.a)
    sctx.strokeStyle = `rgba(255,255,255,${(0.1 + 0.32 * k) * Math.min(1, L.p * 4)})`; sctx.lineWidth = L.w
    sctx.beginPath(); sctx.moveTo(cx + ca * r0, cy + sa * r0); sctx.lineTo(cx + ca * r1, cy + sa * r1); sctx.stroke()
  }
}
function render(dt) {
  if (!m) return
  const focus = mode === 'title' ? m.players[1] : m.players[0]
  m.players.forEach((p, i) => {
    const md = models[i]; if (!md) return
    md.tails = p.tails; md.glow = p.glow
    md.update(p.r, dt)
    const rp = ropes[i]
    if (p.r.rope) { const h = md.handWorld && md.handWorld.lengthSq() ? md.handWorld : _v.set(p.r.x, p.r.y + 1.4, p.r.z); rp.visible = true; rp.position.copy(h); rp.lookAt(p.r.rope.x, p.r.rope.y, p.r.rope.z); rp.scale.set(1, 1, Math.max(0.1, h.distanceTo(_w.set(p.r.rope.x, p.r.rope.y, p.r.rope.z)))) }
    else rp.visible = false
    // 取られた直後は点滅
    md.group.visible = !(p.immune > 0 && Math.floor(performance.now() / 90) % 2 === 0 && p.immune < TAG.immune - 0.2)
  })
  const fm = models[focus.i]
  if (fm) {
    updateCamera(dt, focus.r, fm)
    const d = sun.userData.dir, c = focus.r; sun.position.set(c.x + d.x * 150, c.y + d.y * 150, c.z + d.z * 150); sun.target.position.set(c.x, c.y, c.z)
  }
  // 落ちている手ぬぐい
  const k = performance.now() / 1000
  freeMeshes.forEach(g => g.visible = false)
  m.free.forEach((f, i) => { const g = freeMesh(i); g.visible = true; g.position.set(f.x, f.y + 0.6, f.z); g.userData.tw.rotation.set(Math.sin(k * 2 + i) * 0.15, k * 0.8 + i, 0); g.userData.ring.rotation.x = Math.PI / 2; g.userData.ring.scale.setScalar(1 + Math.sin(k * 4 + i) * 0.12); g.userData.tw.material.emissiveIntensity = 0.35 + Math.sin(k * 5) * 0.2 })
  // 時間（タイトルは夕方の手前で止めておく）
  setTime(mode === 'title' ? 0.35 : Math.min(1, m.t / TAG.sec))
  // PC の狙い
  aimMark.visible = false
  const r0 = m.players[0].r
  if (mode === 'play' && !touchMode && frameN % 4 === 0) aimMark.userData.p = findAnchor(world, r0)
  if (mode === 'play' && !touchMode && aimMark.userData.p) { const p = aimMark.userData.p; aimMark.visible = true; aimMark.position.set(p.x, p.y, p.z); aimMark.lookAt(camera.position) }
  if (mode === 'play') { const v3 = Math.hypot(r0.vx, r0.vy, r0.vz); const wl = Snd.loops.wind; if (wl && wl.g) wl.g.gain.value = Math.min(0.75, Math.max(0, (v3 - 6) / 32)) }
  fx.update(dt)
  fx.shake = Math.max(0, fx.shake - dt * 2.5)
  drawSpeed(mode === 'play' ? Math.hypot(r0.vx, r0.vy, r0.vz) : 0, dt)
  if (mode === 'play') {
    const tt = m.t
    if (hints.length && tt >= hints[0][0] && sayT <= 0) { say(t(hints[0][1]), 3.2); hints.shift() }   // ほかの知らせを上書きしない
    const left = TAG.sec - tt
    if (left < 30 && !warned[30]) { warned[30] = 1; say(t('last30'), 1.6, 'big'); sfx('tick') }
    if (left < 10 && !warned[10]) { warned[10] = 1; say(t('last10'), 1.6, 'big'); sfx('tick') }
    if (left < 5 && Math.floor(left) !== warned.tk) { warned.tk = Math.floor(left); sfx('tick', { vol: 0.5 }) }
    updateHud(dt)
    if (endAt > 0) { endAt -= dt; if (endAt <= 0) showResult() }
    snapAt -= dt
  }
  if (mode !== 'play') lockRing.visible = false
  renderer.render(scene, camera)
  // 結果の背景にする写真（一番本数が多かった瞬間）
  if (mode === 'play' && snapAt <= 0 && me().tails >= (photo && photo._n || 0)) { snapAt = 4; const c2 = document.createElement('canvas'); c2.width = 480; c2.height = Math.round(480 * innerHeight / innerWidth); c2.getContext('2d').drawImage(renderer.domElement, 0, 0, c2.width, c2.height); c2._n = me().tails; photo = c2 }
  frameN++
}

// ---------------------------------------------------------------- 検証用の窓口
window.tt = {
  get mode() { return mode }, log, get m() { return m }, get me() { return me() }, TAG, RUN, world, camera, touchMode, COLORS, rayHit, cam, get level() { return level }, setLevel: l => { level = l; applyLevel() }, get gmode() { return gmode }, setMode: md => { gmode = md; applyLevel() }, lockTarget: () => m && lockTarget(m, me()),
  start: seed => startMatch(seed), toTitle, showResult, setLang: l => { lang = l; applyLang() }, get lang() { return lang },
  dbg: {
    pause: on => { dbgPause = on }, step: n => { for (let i = 0; i < n; i++) stepOnce(); render(STEP) },
    teleport: (x, y, z, yaw) => { const r = me().r; Object.assign(r, { x, y, z, vx: 0, vy: 0, vz: 0, rope: null, climbing: null, grounded: y < 0.1 }); if (yaw != null) r.yaw = yaw },
    pressWire: (sx, sy) => aimAt(sx, sy), pressJump: () => { press.jump = true }, wireAuto: () => { pendingWire = { at: null, key: true } },
    keys, stick, say, setTime: f => { m.t = f * TAG.sec }, get models() { return models }, freezeCpu: on => { for (let i = 1; i < 4; i++) bots[i] = on ? createBot('idle') : createBot('cpu', TAG.levels[m.level].cpu[i - 1], i) }
  }
}
applyLang()
toTitle()
requestAnimationFrame(frame)
window.__jsUp = true
// ロード画面: 本物の読み込み（人物・空・質感）に合わせて進み、全部そろったら消す。遅い回線でも12秒で必ず消す
{
  let shown = 0, done = false
  const set = p => { shown = Math.max(shown, Math.min(1, p)); $('boot').style.setProperty('--p', shown.toFixed(3)) }
  THREE.DefaultLoadingManager.onProgress = (u, l, n) => set(0.1 + 0.85 * l / Math.max(1, n))
  const finish = () => { if (done) return; done = true; set(1); setTimeout(() => { $('boot').classList.add('out'); setTimeout(() => $('boot').classList.add('hidden'), 360); window.__ttReady = true }, 220) }
  set(0.06)
  const skyP = new Promise(ok => { const k = setInterval(() => { if (skyReady) { clearInterval(k); ok() } }, 60) })
  Promise.all([loadCharAssets().catch(() => {}), skyP]).then(finish)
  setTimeout(finish, 12000)
}
