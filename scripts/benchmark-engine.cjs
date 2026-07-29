const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const initialFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
const positions = [
  [],
  ['h2e2', 'h7e7'],
  ['h2e2', 'h7e7', 'h0g2', 'h9g7'],
  ['b2e2', 'b7e7', 'b0c2', 'b9c7'],
  ['h2e2', 'h7e7', 'h0g2', 'h9g7', 'e3e4', 'e6e5'],
  ['b2e2', 'b7e7', 'b0c2', 'b9c7', 'c3c4', 'c6c5']
];

async function measure(engine, movetime) {
  await engine.warmup();
  const results = [];
  for (const moves of positions) {
    const started = performance.now();
    const result = await engine.analyze({ fen: initialFen, moves, movetime });
    if (!result.ok) throw new Error(result.error ?? 'Pikafish benchmark failed');
    results.push({
      moves: moves.length,
      ms: Math.round(performance.now() - started),
      depth: result.depth ?? 0,
      nodes: result.nodes ?? 0,
      bestMove: result.bestMove ?? ''
    });
  }
  return results;
}

function average(results, key) {
  return results.reduce((sum, result) => sum + result[key], 0) / results.length;
}

async function main() {
  const { PikafishBridge } = await import(pathToFileURL(path.join(root, 'dist-electron/engine/pikafish.js')));
  const baselineEngine = new PikafishBridge(root, { threads: 8, multiPv: 5, hashMb: 512 });
  const optimizedEngine = new PikafishBridge(root, { threads: 6, multiPv: 2, hashMb: 512 });
  try {
    const baseline = await measure(baselineEngine, 2200);
    const optimized = await measure(optimizedEngine, 1400);
    const rows = positions.map((_, index) => ({
      position: index + 1,
      baselineMs: baseline[index].ms,
      baselineDepth: baseline[index].depth,
      optimizedMs: optimized[index].ms,
      optimizedDepth: optimized[index].depth,
      sameBestMove: baseline[index].bestMove === optimized[index].bestMove
    }));
    console.table(rows);

    const baselineDepth = average(baseline, 'depth');
    const optimizedDepth = average(optimized, 'depth');
    const optimizedMs = average(optimized, 'ms');
    console.log(`baseline avg depth: ${baselineDepth.toFixed(2)}`);
    console.log(`optimized avg depth: ${optimizedDepth.toFixed(2)}`);
    console.log(`optimized avg latency: ${Math.round(optimizedMs)}ms`);

    if (optimizedDepth < baselineDepth) throw new Error('Optimized search depth is below baseline');
    if (optimizedMs > 1700) throw new Error('Optimized average latency exceeds 1700ms');
  } finally {
    baselineEngine.stop();
    optimizedEngine.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
