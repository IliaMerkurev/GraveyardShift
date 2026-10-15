import type { GameEvent } from '../game/GameState';
/** One foreground cue per frame; mass destruction never becomes an audio storm. */
export function soundForEvents(events:readonly GameEvent[]):string|null {
  const types=new Set(events.map(e=>e.type));
  if(types.has('gameover'))return 'defeat';
  if(types.has('tailBlast'))return 'tailBlast';
  if(types.has('bomb'))return 'explosion';
  for(const type of ['rewind','slow','brake','halfSpeed'] as const)if(types.has(type))return type==='slow'?'freeze':type;
  if(types.has('merge'))return 'merge';
  if(types.has('purchase'))return 'purchase';
  if(types.has('open'))return 'open';
  if(types.has('destroy'))return 'break';
  if(types.has('discard'))return 'discard';
  if(types.has('hit'))return 'hit';
  return null;
}
