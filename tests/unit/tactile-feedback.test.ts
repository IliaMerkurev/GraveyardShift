import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TactileMotion, tactilePose, impulseDuration } from '../../src/render/TactileMotion';
import { soundForEvents } from '../../src/audio/eventSounds';
import { createRockSnakeAudio } from '../../src/audio/OrganicAudio';
import type { GameEvent } from '../../src/game/GameState';

beforeEach(()=>vi.stubGlobal('document',{hidden:false,hasFocus:()=>true,addEventListener(){},removeEventListener(){}}));
afterEach(()=>vi.unstubAllGlobals());
describe('tactile feedback',()=>{
  it('bounds every impulse and settles exactly with no accumulated drift',()=>{
    for(const kind of Object.keys(impulseDuration) as (keyof typeof impulseDuration)[]){
      for(let age=0;age<1;age+=.005){const p=tactilePose(kind,age);expect(p.x).toBeGreaterThan(.8);expect(p.x).toBeLessThan(1.2);expect(p.y).toBeGreaterThan(.7);expect(p.y).toBeLessThan(1.3);expect(p.lift).toBeGreaterThanOrEqual(0);}
      expect(tactilePose(kind,1)).toEqual({x:1,y:1,lift:0,tilt:0});
    }
    const motion=new TactileMotion();for(let i=0;i<100;i++)motion.trigger('worker','merge');motion.tick(1);expect(motion.kind('worker')).toBeUndefined();expect(motion.pose('worker').y).toBe(1);
  });
  it('reduced motion removes squash, hops and wiggles while impulses remain identifiable',()=>{
    const motion=new TactileMotion();motion.trigger('worker','merge');expect(motion.kind('worker')).toBe('merge');expect(motion.pose('worker',true)).toEqual({x:1,y:1,lift:0,tilt:0});motion.clear();expect(motion.kind('worker')).toBeUndefined();
  });
  it('mass bonuses and merges win over ambient mining audio',()=>{
    const event=(type:GameEvent['type']):GameEvent=>({type,x:0,z:0});
    expect(soundForEvents([event('hit'),...Array.from({length:100},()=>event('destroy')),event('tailBlast')])).toBe('bonus');
    expect(soundForEvents([event('hit'),event('coins'),event('merge')])).toBe('merge');
    expect(soundForEvents([event('coins')])).toBeNull();
  });
  it('audio unavailable or blocked cannot break input and mute stays operable',()=>{
    const listeners=new Map<string,()=>void>();vi.stubGlobal('window',{addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn),removeEventListener:vi.fn()});
    const audio=createRockSnakeAudio();expect(audio.play('pickup')).toBe(false);expect(()=>listeners.get('pointerdown')?.()).not.toThrow();expect(audio.setMuted(true)).toBe(true);expect(audio.isMuted()).toBe(true);expect(()=>audio.destroy()).not.toThrow();
  });
});

describe('tactile audio limits',()=>{
  it('caps concurrent events, rate limits mining, and preserves mute',()=>{
    const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
    const node=()=>({gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){},start(){},stop(){}});
    class Context {
      currentTime=1;sampleRate=8000;state='running';destination={};
      createGain(){return node();}createOscillator(){return node();}createBufferSource(){return node();}createBiquadFilter(){return node();}
      createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
      createBuffer(){return {getChannelData:()=>new Float32Array(8000)};}close(){return Promise.resolve();}resume(){return Promise.resolve();}
    }
    let ctx:Context;vi.stubGlobal('window',{AudioContext:class extends Context{constructor(){super();ctx=this;}},addEventListener(){},removeEventListener(){}});
    const audio=createRockSnakeAudio();expect(audio.play('hit')).toBe(false);audio.unlock();
    expect(audio.play('hit')).toBe(true);ctx!.currentTime+=.03;expect(audio.play('hit')).toBe(false);
    expect(audio.play('pickup')).toBe(true);ctx!.currentTime+=.03;expect(audio.play('merge')).toBe(true);ctx!.currentTime+=.03;expect(audio.play('bonus')).toBe(true);
    ctx!.currentTime+=.03;expect(audio.play('purchase')).toBe(true);ctx!.currentTime+=.03;expect(audio.play('drop')).toBe(false);
    ctx!.currentTime+=1;audio.setPaused(true);expect(audio.play('merge')).toBe(false);audio.setMuted(true);audio.setPaused(false);expect(audio.isMuted()).toBe(true);expect(audio.play('merge')).toBe(false);audio.setMuted(false);expect(audio.play('merge')).toBe(true);audio.destroy();
  });
});
