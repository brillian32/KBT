// gen-icons.js — 生成 Knowledge Base Tools 图标（知识网络节点风格）
// 无外部依赖，纯 Node.js RGBA PNG 生成

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// ──────────── PNG 编码工具 ────────────
function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = ((crc >>> 8) ^ table[(crc ^ byte) & 0xff]) >>> 0
  return ((crc ^ 0xffffffff) >>> 0)
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function makePNGRGBA(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6  // depth=8, colorType=RGBA

  const rowSize = 1 + size * 4
  const rawBuf = Buffer.alloc(size * rowSize)
  for (let y = 0; y < size; y++) {
    rawBuf[y * rowSize] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * rowSize + 1 + x * 4
      rawBuf[dst] = pixels[src]
      rawBuf[dst + 1] = pixels[src + 1]
      rawBuf[dst + 2] = pixels[src + 2]
      rawBuf[dst + 3] = pixels[src + 3]
    }
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(rawBuf)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ──────────── 绘图工具 ────────────
function createCanvas(size) {
  const pixels = new Uint8ClampedArray(size * size * 4)  // 全透明

  function blend(x, y, r, g, b, a) {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || x >= size || y < 0 || y >= size || a <= 0) return
    const i = (y * size + x) * 4
    const srcA = a / 255, dstA = pixels[i + 3] / 255
    const outA = srcA + dstA * (1 - srcA)
    if (outA < 1e-5) return
    pixels[i]     = Math.round((r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA)
    pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA)
    pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA)
    pixels[i + 3] = Math.round(outA * 255)
  }

  // 带抗锯齿的实心圆
  function fillCircle(cx, cy, radius, r, g, b, a = 255) {
    const r2 = radius + 0.5, r1 = radius - 0.5
    for (let y = Math.floor(cy - r2); y <= Math.ceil(cy + r2); y++) {
      for (let x = Math.floor(cx - r2); x <= Math.ceil(cx + r2); x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d <= r1) blend(x, y, r, g, b, a)
        else if (d < r2) blend(x, y, r, g, b, Math.round(a * (r2 - d)))
      }
    }
  }

  // 圆角矩形（利用距离到角圆心）
  function fillRoundedRect(x1, y1, x2, y2, rad, r, g, b, a = 255) {
    for (let y = Math.floor(y1); y <= Math.ceil(y2); y++) {
      for (let x = Math.floor(x1); x <= Math.ceil(x2); x++) {
        if (x < 0 || x >= size || y < 0 || y >= size) continue
        const cx = Math.max(x1 + rad, Math.min(x2 - rad, x))
        const cy = Math.max(y1 + rad, Math.min(y2 - rad, y))
        const d = Math.hypot(x - cx, y - cy)
        if (d <= rad - 0.5) blend(x, y, r, g, b, a)
        else if (d < rad + 0.5) blend(x, y, r, g, b, Math.round(a * (rad + 0.5 - d)))
      }
    }
  }

  // 粗线（圆头）
  function drawLine(x1, y1, x2, y2, thickness, r, g, b, a = 255) {
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 0.01) return
    const steps = Math.ceil(len * 2)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      fillCircle(x1 + dx * t, y1 + dy * t, thickness / 2, r, g, b, a)
    }
  }

  return { pixels, blend, fillCircle, fillRoundedRect, drawLine }
}

// ──────────── 图标绘制 ────────────
// 设计概念：深色圆角方形背景 + 中央"K"字母（粗线条赛博感）+ 5个节点圆（代表知识节点）
// 颜色：背景 #1a1a2e，主色 #00F0FF（霓虹青），节点 #BF5AF2（霓虹紫）
function generateIcon(size, transparentBg = false) {
  const { pixels, fillCircle, fillRoundedRect, drawLine } = createCanvas(size)

  // 将 128 坐标空间映射到 size
  const sc = (v) => v * size / 128

  if (!transparentBg) {
    // 深色圆角背景 #1a1a2e
    fillRoundedRect(sc(4), sc(4), sc(124), sc(124), sc(20), 26, 26, 46, 255)
    // 微弱边框发光（青色半透明）
    fillRoundedRect(sc(4), sc(4), sc(124), sc(124), sc(20), 0, 240, 255, 20)
  }

  const thick = Math.max(2, sc(11))   // K 字笔画粗细
  const nodeR = Math.max(1.5, sc(8))  // 节点半径

  // K 字坐标（128空间）
  const kx  = sc(44)        // 竖线 x 中心
  const ky1 = sc(24)        // 竖线顶部
  const ky2 = sc(104)       // 竖线底部
  const kjy = sc(63)        // 夹角 y（中间）
  const ktx = sc(91)        // 上臂末端 x
  const kty = sc(26)        // 上臂末端 y
  const kbx = sc(91)        // 下臂末端 x
  const kby = sc(102)       // 下臂末端 y

  // 绘制连接线（节点之间，深色细线，营造知识图谱感）
  drawLine(kx, ky1, ktx, kty, Math.max(1, sc(3)), 0, 240, 255, 60)
  drawLine(kx, ky2, kbx, kby, Math.max(1, sc(3)), 0, 240, 255, 60)

  // 绘制 K 字主笔画（霓虹青）
  drawLine(kx, ky1, kx, ky2, thick, 0, 240, 255)      // 竖线
  drawLine(kx, kjy, ktx, kty, thick * 0.88, 0, 240, 255)  // 上斜线
  drawLine(kx, kjy, kbx, kby, thick * 0.88, 0, 240, 255)  // 下斜线

  // 绘制节点（5个，霓虹紫 #BF5AF2）
  const NR = [191, 90, 242]
  fillCircle(kx,  ky1, nodeR,       ...NR)   // 竖线顶端
  fillCircle(kx,  ky2, nodeR,       ...NR)   // 竖线底端
  fillCircle(ktx, kty, nodeR,       ...NR)   // 上臂末端
  fillCircle(kbx, kby, nodeR,       ...NR)   // 下臂末端
  fillCircle(kx,  kjy, nodeR * 0.7, ...NR)   // 夹角节点（稍小）

  return pixels
}

// ──────────── 生成文件 ────────────
const buildDir  = path.join(__dirname, '..', 'build')
const extIcons  = path.join(__dirname, '..', 'chrome-extension', 'icons')
fs.mkdirSync(buildDir, { recursive: true })
fs.mkdirSync(extIcons,  { recursive: true })

// 应用主图标（带背景，256px）
;[256].forEach(size => {
  const buf = makePNGRGBA(size, generateIcon(size))
  const out = path.join(buildDir, 'icon.png')
  fs.writeFileSync(out, buf)
  console.log(`✓ build/icon.png (${size}px, ${buf.length} bytes)`)
})

// 托盘图标（透明背景，赛博青色，16px）
;[16].forEach(size => {
  const buf = makePNGRGBA(size, generateIcon(size, true))
  const out = path.join(buildDir, 'tray-icon.png')
  fs.writeFileSync(out, buf)
  console.log(`✓ build/tray-icon.png (${size}px, ${buf.length} bytes)`)
})

// Chrome 扩展图标（带背景）
for (const size of [16, 48, 128]) {
  const buf = makePNGRGBA(size, generateIcon(size))
  const out = path.join(extIcons, `icon${size}.png`)
  fs.writeFileSync(out, buf)
  console.log(`✓ chrome-extension/icons/icon${size}.png (${size}px, ${buf.length} bytes)`)
}

console.log('\n所有图标已生成完成！')
