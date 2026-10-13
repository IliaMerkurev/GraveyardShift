/** Browser-only v0.1 adapter. It is deliberately not an MRAID/ExitAPI integration. */
export class PlayableBridge {
  state:'loading'|'running'|'paused'|'ended'='loading';
  ready(){this.state='running';}
  start(){this.state='running';}
  pause(){this.state='paused';}
  resume(){this.state='running';}
  end(){this.state='ended';}
  cta(showLocalNotice:(text:string)=>void){showLocalNotice('Preview only. Store link will be added after ad-network integration.');}
}
