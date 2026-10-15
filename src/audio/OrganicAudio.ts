import {synthesizeImpact, type ImpactKind} from './ImpactSound';
/* Original procedural tactile SFX. No samples, AI model, voice or music.
 * const sfx = createRockSnakeAudio(); sfx.play('pickup');
 * sfx.setMuted(true); sfx.isMuted(); sfx.destroy();
 * Optional second argument intensity 0..1. Only play on discrete game events.
 */
export function createRockSnakeAudio() {
  let ctx: AudioContext | null = null, master: GainNode | null = null, muted = false, dead = false, lastAny = -1;
  let paused = false, background = document.hidden;
  const active = new Set<AudioScheduledSourceNode>();
  let pending: {event: string; intensity: number; at: number} | null = null;
  const last: Record<string, number> = Object.create(null), voices: number[] = [], buffers = new Map<string, AudioBuffer>();
  const gaps: Record<string, number> = {pickup:.065,drop:.10,merge:.12,purchase:.16,hit:.12,break:.14,bonus:.20,explosion:.18,open:.10,ui:.07,defeat:1};
  const listeners = ['pointerdown','keydown','touchstart'];
  function prune(t: number) { while (voices.length && voices[0] <= t) voices.shift(); }
  function gated() { return muted || paused || background || document.hidden || dead; }
  function silence() {
    pending = null;
    voices.length = 0;
    lastAny = -10;
    for (const key of Object.keys(last)) delete last[key];
    for (const node of active) {
      try { node.stop(); node.disconnect(); } catch (_) { /* Already ended. */ }
    }
    active.clear();
  }
  function applyGate() {
    if (gated()) silence();
    if (ctx && master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(gated() ? 0 : .16, ctx.currentTime);
    }
  }
  function onBlur() { background = true; applyGate(); }
  function onFocus() { background = document.hidden; applyGate(); }
  function onVisibility() { background = document.hidden || !document.hasFocus(); applyGate(); }
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  function unlock() {
    if (dead || background || document.hidden) return;
    try {
      if (!ctx) {
        const C = window.AudioContext || (window as Window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
        if (!C) return;
        ctx = new C(); master = ctx.createGain(); master.gain.value = gated() ? 0 : .16;
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -18; limiter.knee.value = 8;
        limiter.ratio.value = 6; limiter.attack.value = .003; limiter.release.value = .08;
        master.connect(limiter); limiter.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().then(()=>{ const q=pending; pending=null; if(q && !gated() && performance.now()-q.at<180) play(q.event,q.intensity); }).catch(()=>{pending=null;});
    } catch (_) { /* Audio is optional; gameplay must survive unavailable audio. */ }
  }
  for (const name of listeners) window.addEventListener(name,unlock,{passive:true,capture:true});
  function envelope(node: OscillatorNode,start: number,dur: number,amp: number,attack=.004) {
    if(!ctx||!master)return;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0,start);
    g.gain.linearRampToValueAtTime(Math.max(.0001,amp),start+attack);
    g.gain.exponentialRampToValueAtTime(.0001,start+dur);
    g.gain.setValueAtTime(0,start+dur+.003);
    node.connect(g); g.connect(master);
    active.add(node);
    node.onended=()=>{active.delete(node);node.disconnect();g.disconnect();};
    node.start(start); node.stop(start+dur+.006);
  }
  function tone(t: number,f: number,to: number,d: number,a: number) {
    if(!ctx)return;
    const o=ctx.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(Math.max(55,to),t+d*.62);
    envelope(o,t,d,a);
  }
  function air(t: number,d: number,a: number,f=1500,q=.6,attack=.005) {
    if(!ctx||!master)return;
    // Cache one short noise buffer per context, reuse with randomized offsets.
    if (!buffers.has('noise')) {
      const b=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate), x=b.getChannelData(0);
      for(let i=0;i<x.length;i++) x[i]=Math.random()*2-1;
      buffers.set('noise',b);
    }
    const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter();
    source.buffer=buffers.get('noise')!; source.loop=true;
    filter.type='bandpass';filter.frequency.value=f;filter.Q.value=q;
    const g=ctx.createGain();g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(a,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    g.gain.setValueAtTime(0,t+d+.003);
    source.connect(filter);filter.connect(g);g.connect(master);
    active.add(source);
    source.onended=()=>{active.delete(source);source.disconnect();filter.disconnect();g.disconnect();};
    source.start(t,Math.random()*.5);source.stop(t+d+.006);
  }
  function impact(kind: ImpactKind,t: number,a: number,p: number) {
    if(!ctx||!master)return;
    if(!buffers.has(kind)) {
      const samples=synthesizeImpact(kind,ctx.sampleRate),b=ctx.createBuffer(1,samples.length,ctx.sampleRate);
      b.getChannelData(0).set(samples);buffers.set(kind,b);
    }
    const source=ctx.createBufferSource(),g=ctx.createGain();source.buffer=buffers.get(kind)!;
    source.playbackRate.value=p;g.gain.value=a;source.connect(g);g.connect(master);active.add(source);
    source.onended=()=>{active.delete(source);source.disconnect();g.disconnect();};source.start(t);
  }
  function play(event: string,intensity=1): boolean {
    const aliases: Record<string,string>={reject:"bump",bump:"drop"};
    event=aliases[event]||event; if(event==="bump")event="drop";
    // Only the trusted first gesture unlocks audio; events before it stay silent.
    if(gated()||!ctx||!(event in gaps)) return false;
    if(ctx.state!=='running'){pending={event,intensity,at:performance.now()};unlock();return false;}
    const t=ctx.currentTime;prune(t);
    if(t-(last[event]??-10)<gaps[event])return false;
    const important=['explosion','defeat','merge','purchase','bonus'].includes(event);
    if(event==='defeat'||(important&&voices.length>=4))silence();
    if(voices.length>=4 || (!important&&t-lastAny<.025))return false;
    last[event]=lastAny=t;
    const p=.94+Math.random()*.12, a=.55+.45*Math.max(0,Math.min(1,Number(intensity)||0));
    let duration=.22;
    try {
      switch(event) {
        case 'pickup':tone(t,610*p,150*p,.15,.70*a);air(t,.035,.16*a,1700);break;
        case 'drop':tone(t,170*p,115*p,.12,.65*a);tone(t,430*p,400*p,.055,.18*a);air(t,.045,.25*a,900);break;
        case 'merge':tone(t,390*p,115*p,.20,.57*a);tone(t+.055,510*p,220*p,.13,.34*a);air(t,.085,.12*a,1100);duration=.28;break;
        case 'purchase':air(t,.14,.22*a,1700,.7,.025);tone(t+.07,570*p,300*p,.13,.49*a);duration=.25;break;
        case 'hit':impact('hit',t,.85*a,p);duration=.14;break;
        case 'break':impact('break',t,1.1*a,p);duration=.38;break;
        case 'explosion':impact('explosion',t,1.65*a,p);duration=.8;break;
        case 'open':tone(t,290*p,105*p,.09,.65*a);air(t,.055,.35*a,850);tone(t+.045,510*p,185*p,.08,.3*a);duration=.16;break;
        case 'ui':tone(t,650*p,480*p,.035,.17*a);duration=.05;break;
        case 'defeat':tone(t,240,120,.22,.5*a);tone(t+.15,165,65,.28,.45*a);air(t,.37,.12*a,650);duration=.48;break;
        case 'bonus':air(t,.20,.25*a,1300,.5,.035);tone(t+.06,680*p,210*p,.17,.53*a);tone(t+.16,440*p,160*p,.12,.25*a);duration=.34;break;
      }
      voices.push(t+duration);voices.sort((a,b)=>a-b);return true;
    }catch(_){return false;}
  }
  return {
    play, unlock, isMuted: () => muted,
    setMuted(value: boolean) { muted = !!value; applyGate(); return muted; },
    setPaused(value: boolean) { paused = !!value; applyGate(); },
    destroy() {
      dead = true; applyGate();
      for (const name of listeners) window.removeEventListener(name, unlock, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (ctx) ctx.close().catch(() => {});
      buffers.clear();
    }
  };
}
