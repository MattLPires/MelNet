import { ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { app } from 'electron';
import { EventEmitter } from 'node:events';

export interface TunnelConfig {
  virtualIp: string;
  subnet: string;
  relayHost: string;
  relayPort: number;
  tunnelKey: string;
}

export interface TunnelPacket {
  src: string;
  data: string;
}

interface HelperMessage {
  type: string;
  virtualIp?: string;
  src?: string;
  data?: string;
  message?: string;
}

export class TunnelBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private _connected = false;
  private _virtualIp = '';

  get isConnected(): boolean { return this._connected; }
  get virtualIp(): string { return this._virtualIp; }

  private getHelperPath(): string {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const name = `tunnel-helper${ext}`;
    if (app.isPackaged) {
      return path.join(process.resourcesPath, name);
    }
    return path.join(app.getAppPath(), 'tunnel-helper', name);
  }

  async start(config: TunnelConfig): Promise<void> {
    if (this._connected) return;

    const helperPath = this.getHelperPath();

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const ok = () => { if (!settled) { settled = true; resolve(); } };
      const fail = (msg: string) => { if (!settled) { settled = true; reject(new Error(msg)); } };

      try {
        this.process = spawn(helperPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (err) {
        fail(`Failed to spawn tunnel-helper: ${err}`);
        return;
      }

      this.process.on('error', (err) => {
        this.process = null;
        fail(`tunnel-helper: ${err.message}`);
      });

      const stdout = this.process.stdout;
      const stdin = this.process.stdin;
      if (!stdout || !stdin) {
        fail('No stdio handles');
        return;
      }

      const rl = createInterface({ input: stdout });
      rl.on('line', (line) => {
        try {
          const msg: HelperMessage = JSON.parse(line);
          this.handleMessage(msg);
          if (msg.type === 'started') {
            this._connected = true;
            this._virtualIp = msg.virtualIp ?? config.virtualIp;
            ok();
          } else if (msg.type === 'error' && !this._connected) {
            fail(msg.message ?? 'Tunnel helper error');
          }
        } catch { /* ignore malformed JSON */ }
      });

      this.process.stderr?.on('data', (d: Buffer) => {
        console.log(`[tunnel-helper] ${d.toString().trim()}`);
      });

      this.process.on('exit', (code) => {
        this._connected = false;
        this.process = null;
        this.emit('disconnected', code);
        fail(`tunnel-helper exited with code ${code}`);
      });

      stdin.write(JSON.stringify({
        type: 'start',
        virtualIp: config.virtualIp,
        subnet: config.subnet,
        relayHost: config.relayHost,
        relayPort: config.relayPort,
        tunnelKey: config.tunnelKey,
      }) + '\n');
    });
  }

  stop(): void {
    if (this.process?.stdin?.writable) {
      this.process.stdin.write(JSON.stringify({ type: 'stop' }) + '\n');
    }
    setTimeout(() => {
      if (this.process) { this.process.kill(); this.process = null; }
    }, 2000);
    this._connected = false;
    this._virtualIp = '';
  }

  sendPacket(dst: string, data: Buffer): void {
    if (this.process?.stdin?.writable) {
      this.process.stdin.write(JSON.stringify({
        type: 'send', dst, data: data.toString('base64'),
      }) + '\n');
    }
  }

  private handleMessage(msg: HelperMessage): void {
    switch (msg.type) {
      case 'packet':
        this.emit('packet', { src: msg.src, data: msg.data } as TunnelPacket);
        break;
      case 'error':
        this.emit('error', new Error(msg.message ?? 'Unknown error'));
        break;
      case 'stopped':
        this._connected = false;
        this.emit('stopped');
        break;
    }
  }
}
