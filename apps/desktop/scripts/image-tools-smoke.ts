import { buildVerticalLayout, computeResizeDimensions } from '../src/renderer/src/image-tools'

function main() {
  const resized = computeResizeDimensions({ width: 2000, height: 1000 }, 800)
  const smallKept = computeResizeDimensions({ width: 400, height: 300 }, 800)
  const layout = buildVerticalLayout([
    { width: 1000, height: 600 },
    { width: 500, height: 700 },
  ])
  const output = { resized, smallKept, layout }
  console.log(JSON.stringify(output))
  const ok =
    resized.width === 800 &&
    resized.height === 400 &&
    smallKept.width === 400 &&
    smallKept.height === 300 &&
    layout.width === 1000 &&
    layout.height === 1300
  process.exit(ok ? 0 : 1)
}

void main()
