import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface EngineAnalysis {
  ok: boolean;
  engine: 'pikafish' | 'none';
  bestMove?: string;
  candidates?: string[];
  scoreCp?: number;
  mate?: number;
  pv?: string[];
  depth?: number;
  nodes?: number;
  nps?: number;
  error?: string;
}

export interface AnalyzeInput {
  fen: string;
  moves?: string[];
  movetime?: number;
}

export interface PikafishOptions {
  threads: number;
  multiPv: number;
  hashMb?: number;
}

export class PikafishBridge {
  private process: ChildProcessWithoutNullStreams | null = null;
  private ready = false;
  private busy = false;
  private starting: Promise<void> | null = null;
  private buffer = '';
  private exePaths: string[];

  constructor(
    appRoot: string,
    private options: PikafishOptions = { threads: 6, multiPv: 2, hashMb: 512 }
  ) {
    this.exePaths = findPikafishExecutables(appRoot);
  }

  isAvailable() {
    return this.exePaths.length > 0;
  }

  async warmup() {
    try {
      await this.ensureStarted();
      return true;
    } catch {
      return false;
    }
  }

  async analyze(input: AnalyzeInput): Promise<EngineAnalysis> {
    if (!this.isAvailable()) {
      return { ok: false, engine: 'none', error: 'Pikafish executable not found in engines/' };
    }
    if (this.busy) {
      return { ok: false, engine: 'pikafish', error: 'Engine is busy' };
    }
    this.busy = true;
    try {
      await this.ensureStarted();
      const result = await this.runSearch(input.fen, input.moves, input.movetime ?? 550);
      return { ok: true, engine: 'pikafish', ...result };
    } catch (error) {
      this.stop();
      return { ok: false, engine: 'pikafish', error: error instanceof Error ? error.message : String(error) };
    } finally {
      this.busy = false;
    }
  }

  stop() {
    this.ready = false;
    this.buffer = '';
    this.process?.kill();
    this.process = null;
  }

  private async ensureStarted() {
    if (this.process && this.ready) return;
    if (!this.starting) {
      this.starting = this.start().finally(() => {
        this.starting = null;
      });
    }
    await this.starting;
  }

  private async start() {
    let lastError: unknown = new Error('Pikafish executable missing');
    for (const exePath of this.exePaths) {
      try {
        await this.startCandidate(exePath);
        return;
      } catch (error) {
        lastError = error;
        this.stop();
      }
    }
    throw lastError;
  }

  private async startCandidate(exePath: string) {
    const proc = spawn(exePath, [], {
      cwd: path.dirname(exePath),
      windowsHide: true
    });
    this.process = proc;
    this.buffer = '';
    proc.stderr.on('data', () => {});
    proc.on('exit', () => {
      if (this.process === proc) {
        this.ready = false;
        this.process = null;
      }
    });
    proc.on('error', () => {
      if (this.process === proc) {
        this.ready = false;
        this.process = null;
      }
    });
    await this.commandUntil('uci', (line) => line === 'uciok', 8000);
    proc.stdin.write(`setoption name Threads value ${this.options.threads}\n`);
    proc.stdin.write(`setoption name Hash value ${this.options.hashMb ?? 512}\n`);
    proc.stdin.write(`setoption name MultiPV value ${this.options.multiPv}\n`);
    await this.commandUntil('isready', (line) => line === 'readyok', 8000);
    this.ready = true;
  }

  private runSearch(fen: string, moves: string[] | undefined, movetime: number) {
    return new Promise<Omit<EngineAnalysis, 'ok' | 'engine'>>((resolve, reject) => {
      const proc = this.process;
      if (!proc) {
        reject(new Error('Pikafish is not running'));
        return;
      }

      let scoreCp: number | undefined;
      let mate: number | undefined;
      let pv: string[] | undefined;
      let depth: number | undefined;
      let nodes: number | undefined;
      let nps: number | undefined;
      const candidateMoves = new Map<number, string>();
      const timeout = windowlessTimeout(() => {
        cleanup();
        reject(new Error('Pikafish search timeout'));
      }, Math.max(8000, movetime + 5000));

      const onData = (data: Buffer) => {
        this.buffer += data.toString('utf8');
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() ?? '';
        for (const line of lines) {
          const info = parseInfo(line);
          if (info) {
            if (info.pv?.[0]) candidateMoves.set(info.multipv ?? 1, info.pv[0]);
            if (!info.multipv || info.multipv === 1) {
              scoreCp = info.scoreCp ?? scoreCp;
              mate = info.mate ?? mate;
              pv = info.pv ?? pv;
              depth = info.depth ?? depth;
              nodes = info.nodes ?? nodes;
              nps = info.nps ?? nps;
            }
          }
          if (line.startsWith('bestmove ')) {
            cleanup();
            const bestMove = line.split(/\s+/)[1];
            if (bestMove) candidateMoves.set(1, bestMove);
            resolve({
              bestMove,
              candidates: [...candidateMoves.entries()]
                .sort((a, b) => a[0] - b[0])
                .map((entry) => entry[1]),
              scoreCp,
              mate,
              pv,
              depth,
              nodes,
              nps
            });
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        proc.stdout.off('data', onData);
      };

      proc.stdout.on('data', onData);
      proc.stdin.write(`${positionCommand(fen, moves)}\n`);
      proc.stdin.write(`go movetime ${movetime}\n`);
    });
  }

  private commandUntil(command: string, done: (line: string) => boolean, timeoutMs: number) {
    return new Promise<void>((resolve, reject) => {
      const proc = this.process;
      if (!proc) {
        reject(new Error('Pikafish is not running'));
        return;
      }
      const timeout = windowlessTimeout(() => {
        cleanup();
        reject(new Error(`Pikafish command timed out: ${command}`));
      }, timeoutMs);
      const onExit = () => {
        cleanup();
        reject(new Error(`Pikafish exited during command: ${command}`));
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onData = (data: Buffer) => {
        this.buffer += data.toString('utf8');
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() ?? '';
        if (lines.some(done)) {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        clearTimeout(timeout);
        proc.stdout.off('data', onData);
        proc.off('exit', onExit);
        proc.off('error', onError);
      };
      proc.stdout.on('data', onData);
      proc.once('exit', onExit);
      proc.once('error', onError);
      proc.stdin.write(`${command}\n`);
    });
  }
}

function positionCommand(fen: string, moves: string[] | undefined) {
  if (moves && moves.every((move) => /^[a-i][0-9][a-i][0-9]$/.test(move))) {
    return `position startpos${moves.length > 0 ? ` moves ${moves.join(' ')}` : ''}`;
  }
  return `position fen ${fen}`;
}

function findPikafishExecutables(appRoot: string) {
  const engines = path.join(appRoot, 'engines');
  if (!fs.existsSync(engines)) return [];
  const candidates = walk(engines).filter((file) => {
    const name = path.basename(file).toLowerCase();
    return name.endsWith('.exe') && name.includes('pikafish') && !name.includes('setup') && !name.includes('proxy');
  });
  return candidates.sort((a, b) => enginePreference(b) - enginePreference(a));
}

function enginePreference(file: string) {
  const name = path.basename(file).toLowerCase();
  if (name.includes('proxy')) return -10;
  if (name.includes('avx512')) return 50;
  if (name.includes('bmi2')) return 45;
  if (name.includes('avx2')) return 40;
  if (name.includes('sse41')) return 30;
  if (name.includes('popcnt')) return 20;
  return 10;
}

function walk(root: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    if (entry.isFile()) result.push(full);
  }
  return result;
}

function parseInfo(line: string) {
  if (!line.startsWith('info ')) return null;
  const depthMatch = line.match(/\bdepth\s+(-?\d+)/);
  const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
  const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
  const pvMatch = line.match(/\bpv\s+(.+)$/);
  const multipvMatch = line.match(/\bmultipv\s+(\d+)/);
  const nodesMatch = line.match(/\bnodes\s+(\d+)/);
  const npsMatch = line.match(/\bnps\s+(\d+)/);
  return {
    depth: depthMatch ? Number(depthMatch[1]) : undefined,
    scoreCp: cpMatch ? Number(cpMatch[1]) : undefined,
    mate: mateMatch ? Number(mateMatch[1]) : undefined,
    pv: pvMatch ? pvMatch[1].trim().split(/\s+/) : undefined,
    multipv: multipvMatch ? Number(multipvMatch[1]) : undefined,
    nodes: nodesMatch ? Number(nodesMatch[1]) : undefined,
    nps: npsMatch ? Number(npsMatch[1]) : undefined
  };
}

function windowlessTimeout(callback: () => void, ms: number) {
  return setTimeout(callback, ms);
}
