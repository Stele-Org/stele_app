// LumiCells 1007717 demo/scene; Stella changes: one-shot reveal and pausable WAAPI waits.
import type { BubbleEntry } from './bubbles';
import { flyIn, flyOut, startFloat } from './flight';
import type { DemoSceneProps, SceneAction } from './types';

type Phase = 'hidden' | 'entering' | 'idle' | 'leaving';

export type FlightRoute = {
  origin: { fx: number; fy: number };
  destination: { fx: number; fy: number };
};

const ENTER_DURATION = 920;
const ENTER_STAGGER = 48;
const LEAVE_DURATION = 640;
const RECALL_DURATION = 520;
const LEAVE_STAGGER = 28;
/** Pause between the exit and the next entrance after 'done'. */
const DONE_PAUSE = 1200;
const BACK_PAUSE = 140;

/**
 * Drives the bubble lifecycle: enter -> idle drift -> exit / recall.
 * Plain DOM code (WAAPI) so React never re-renders during motion. A transition, once started,
 * always runs to its end; a newer request only sets the wanted state and is served afterwards.
 */
export class Choreographer {
  private phase: Phase = 'hidden';
  private want = false;
  private busy = false;
  private disposed = false;
  private timers = new Set<Animation>();
  private playing = true;
  private settlements = new Set<() => void>();
  private flights = new Map<HTMLElement, Animation[]>();
  private floats = new Map<HTMLElement, Animation>();

  constructor(
    private readonly root: HTMLElement,
    private readonly entries: () => BubbleEntry[],
    private readonly hooks: () => DemoSceneProps,
    private readonly reduced: () => boolean,
    private readonly flightDurationScale = 1,
    private readonly route?: FlightRoute,
  ) {}

  /** Integration only: keep the author's entrance, drift and exit as one scenario reveal. */
  async revealOnce(holdMs: number, onDone: () => void): Promise<void> {
    if (this.busy || this.disposed || this.phase !== 'hidden') return;
    this.busy = true;
    try {
      await this.enter();
      if (this.disposed || !(await this.wait(holdMs))) return;
      await this.leave('out');
      if (!this.disposed) onDone();
    } finally { this.busy = false; }
  }

  setPlaying(playing: boolean): void {
    if (this.disposed || this.playing === playing) return;
    this.playing = playing;
    for (const a of [...this.timers, ...this.floats.values(), ...[...this.flights.values()].flat()]) {
      if (playing && a.playState === 'paused') a.play();
      else if (!playing && a.playState !== 'finished' && a.playState !== 'idle') a.pause();
    }
  }

  get state(): Phase {
    return this.phase;
  }

  setVisible(visible: boolean): void {
    this.want = visible;
    void this.pump();
  }

  /** 'done' exits and re-enters after a pause; 'back' recalls to the center and flies out again. */
  action(action: SceneAction): void {
    if (this.phase !== 'idle' || this.busy || this.disposed) return;
    this.busy = true;
    void (async () => {
      try {
        if (action === 'done') {
          await this.leave('out');
          if (await this.wait(DONE_PAUSE)) await this.enter();
        } else {
          await this.leave('center');
          if (await this.wait(BACK_PAUSE)) await this.enter();
        }
      } finally {
        this.busy = false;
      }
      void this.pump();
    })();
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.timers) timer.cancel();
    this.timers.clear();
    for (const list of this.flights.values()) for (const a of list) a.cancel();
    for (const a of this.floats.values()) a.cancel();
    this.flights.clear();
    this.floats.clear();
    for (const settle of this.settlements) settle();
    this.settlements.clear();
    for (const e of this.entries()) {
      e.resetHover();
      e.el.removeAttribute('data-shown');
      e.el.removeAttribute('data-live');
    }
    delete this.root.dataset.phase;
  }

  private async pump(): Promise<void> {
    if (this.busy || this.disposed) return;
    this.busy = true;
    try {
      while (!this.disposed) {
        if (this.want && this.phase === 'hidden') await this.enter();
        else if (!this.want && this.phase === 'idle') await this.leave('out');
        else break;
      }
    } finally {
      this.busy = false;
    }
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.root.dataset.phase = p;
  }

  private wait(ms: number): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    const timer = this.root.animate([], { duration: ms });
    this.timers.add(timer);
    if (!this.playing) timer.pause();
    return timer.finished.then(() => {
      this.timers.delete(timer);
      timer.cancel();
      return !this.disposed;
    }, () => { this.timers.delete(timer); return false; });
  }

  private at(ms: number, fn: () => void): void {
    void this.wait(ms).then(ok => { if (ok) fn(); });
  }

  private sorted(): BubbleEntry[] {
    return [...this.entries()].sort((a, b) => a.item.order - b.item.order);
  }

  private async enter(): Promise<void> {
    this.setPhase('entering');
    // give integrators a frame to bind elements before anything moves
    if (!(await this.wait(32))) return;
    const reduced = this.reduced();
    const jobs: Promise<void>[] = [];
    this.sorted().forEach((e, i) => {
      const delay = i * (reduced ? 40 : ENTER_STAGGER);
      const origin = this.route?.origin ?? { fx: .5, fy: .5 };
      const from = { dx: origin.fx - e.item.fx, dy: origin.fy - e.item.fy };
      e.el.setAttribute('data-shown', '');
      jobs.push(
        new Promise<void>((resolve) => {
          const settled = () => { this.settlements.delete(settled); resolve(); };
          this.settlements.add(settled);
          const anims = flyIn(e.el, from, { delay, duration: ENTER_DURATION * this.flightDurationScale, reduced, stream: Boolean(this.route) }, () => {
            this.flights.delete(e.el);
            if (this.disposed) return settled();
            e.el.setAttribute('data-live', '');
            if (!reduced && !this.route) {
              const float = startFloat(e.el, e.item.order + 1);
              // An infinite float is normally cancelled on exit/unmount.
              void float.finished.catch(() => {});
              if (!this.playing) float.pause();
              this.floats.set(e.el, float);
            }
            this.hooks().onFlight?.(e.el, e.info(), 'end');
            settled();
          });
          this.flights.set(e.el, anims);
          if (!this.playing) for (const a of anims) a.pause();
          this.at(delay, () => this.hooks().onFlight?.(e.el, e.info(), 'start'));
        }),
      );
    });
    await Promise.all(jobs);
    if (!this.disposed) this.setPhase('idle');
  }

  private async leave(mode: 'out' | 'center'): Promise<void> {
    this.setPhase('leaving');
    const reduced = this.reduced();
    const jobs: Promise<void>[] = [];
    const list = this.sorted();
    list.forEach((e, i) => {
      e.resetHover();
      e.el.removeAttribute('data-live');
      const dx = e.item.fx - 0.5;
      const dy = e.item.fy - 0.5;
      const len = Math.hypot(dx, dy) || 1;
      // 'out' keeps going in the direction it sits in; 'center' returns to where it came from
      const to =
        mode === 'out' && this.route
          ? { dx: this.route.destination.fx - e.item.fx, dy: this.route.destination.fy - e.item.fy }
          : mode === 'out'
          ? { dx: dx + (dx / len) * 0.5, dy: dy + (dy / len) * 0.5 }
          : { dx: -dx, dy: -dy };
      const delay = i * LEAVE_STAGGER;
      jobs.push(
        new Promise<void>((resolve) => {
          const settled = () => { this.settlements.delete(settled); resolve(); };
          this.settlements.add(settled);
          const anims = flyOut(
            e.el,
            to,
            {
              delay,
              duration: (mode === 'out' ? LEAVE_DURATION : RECALL_DURATION) * this.flightDurationScale,
              reduced,
              scale: mode === 'out' ? 0.55 : 0.18,
              stream: Boolean(this.route) && mode === 'out',
            },
            () => {
              this.flights.delete(e.el);
              if (!this.disposed) {
                e.el.removeAttribute('data-shown');
                for (const a of anims) a.cancel();
                this.floats.get(e.el)?.cancel();
                this.floats.delete(e.el);
                this.hooks().onFlight?.(e.el, e.info(), 'end');
              }
              settled();
            },
          );
          this.flights.set(e.el, anims);
          if (!this.playing) for (const a of anims) a.pause();
          this.at(delay, () => this.hooks().onFlight?.(e.el, e.info(), 'start'));
        }),
      );
    });
    await Promise.all(jobs);
    if (!this.disposed) this.setPhase('hidden');
  }
}
