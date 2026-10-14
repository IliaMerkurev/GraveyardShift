import type { GameEvent } from '../game/GameState';
/** One foreground cue per frame; mass destruction never becomes an audio storm. */
export function soundForEvents(events:readonly GameEvent[]):string|null {
  const types=new Set(events.map(e=>e.type));
  if(['bomb','tailBlast','rewind','slow','brake','halfSpeed'].some(t=>types.has(t as GameEvent['type'])))return 'bonus';
  if(types.has('merge'))return 'merge';
  if(types.has('purchase'))return 'purchase';
  if(types.has('open'))return 'open';
  if(types.has('destroy'))return 'break';
  if(types.has('discard'))return 'drop';
  if(types.has('hit'))return 'hit';
  return null;
}
