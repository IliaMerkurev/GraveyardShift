import {attachFullscreen} from './Fullscreen';
import type {MusicAudio} from '../audio/MusicAudio';
/** External intro files stay beside the HTML; only one orientation is requested. */
export const introSource=(width:number,height:number)=>`./media/intro-${height>width?'portrait':'landscape'}.mp4`;
export type PreparedIntro=(()=>void)&{zoom?:(progress:number)=>void};
export const introZoom=(progress:number)=>Math.exp(Math.log(2.4)*(1-Math.max(0,Math.min(1,progress))));
type IntroAudio={music:MusicAudio;sounds:()=>boolean;unlockSounds?:()=>void;onStart?:()=>void;logo?:string};
export function showVideoIntro(parent:HTMLElement,prepared:Promise<PreparedIntro>=Promise.resolve(()=>{}),audio?:IntroAudio):Promise<void> {
  return new Promise((resolve,reject)=>{
    const overlay=document.createElement('section');overlay.className='video-intro';overlay.setAttribute('aria-label','Game introduction');
    const video=document.createElement('video');video.className='video-intro__video';video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.muted=!(audio?.sounds()??true);video.defaultMuted=video.muted;video.preload='none';
    video.defaultPlaybackRate=2;video.playbackRate=2;
    const controls=document.createElement('div');controls.className='video-intro__controls';
    const status=document.createElement('p');status.className='video-intro__status';status.setAttribute('role','status');status.textContent='Loading intro…';
    const skip=document.createElement('button');skip.type='button';skip.textContent='Start game';skip.hidden=true;
    const frame=document.createElement('div');frame.className='intro-film-frame';frame.hidden=true;const edge=document.createElement('div');edge.className='intro-edge-blur';edge.setAttribute('aria-hidden','true');frame.append(video,edge);controls.append(status,skip);controls.hidden=true;
    const startScreen=document.createElement('div');startScreen.className='intro-start';
    const title=document.createElement(audio?.logo?'img':'h1');title.className='intro-start__logo';
    if(audio?.logo){(title as HTMLImageElement).src=audio.logo;(title as HTMLImageElement).alt='Graveyard Shift';}else title.textContent='GRAVEYARD SHIFT';
    const launch=document.createElement('button');launch.type='button';launch.className='intro-start__button';launch.textContent='PLAY';
    const rules=document.createElement('div');rules.className='intro-rules';rules.innerHTML='<span>▣ Tap barrels</span><span>↗ Drag miners to pads</span><span>＋ Merge equal levels</span><span>⛔ Stop the snake reaching EXIT</span>';
    const hint=document.createElement('p');hint.className='intro-fullscreen-hint';hint.setAttribute('role','status');hint.hidden=true;
    const detachFullscreen=attachFullscreen(startScreen,text=>{hint.textContent=text;hint.hidden=false;});
    startScreen.append(title,rules,launch,hint);overlay.append(frame,controls,startScreen);parent.append(overlay);
    const gestures=['pointerdown','pointerup','touchend','click','keydown'];
    let finished=false,started=false,backgroundPause=false,attempt=0,transitioning=false,pending=false,policyMuted=false,requested=false;let timeout:ReturnType<typeof setTimeout>|undefined;
    const cleanup=()=>{detachFullscreen();attempt++;clearTimeout(timeout);document.removeEventListener('visibilitychange',visibility);for(const event of gestures)document.removeEventListener(event,gesture,true);video.pause();video.removeAttribute('src');video.load();overlay.remove();audio?.unlockSounds?.();void audio?.music.start().catch(()=>{});};
    const ready=prepared.then(begin=>({begin,error:null})).catch((error:unknown)=>({begin:null,error}));
    const finish=async()=>{
      if(!requested||finished||transitioning)return;transitioning=true;attempt++;video.pause();controls.hidden=true;
      const result=await ready;
      if(!result.begin){finished=true;cleanup();reject(result.error);return;}
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
      if(!reduced){
        overlay.style.background='transparent';frame.className='intro-film-frame intro-film-frame--zoom';
        // Identical logarithmic scale velocity through the video/room overlap.
        await new Promise<void>(done=>{
          let elapsed=0,last=performance.now();
          const tick=(now:number)=>{
            if(!document.hidden)elapsed+=Math.min(50,Math.max(0,now-last));last=now;
            const linear=Math.min(1,elapsed/600),p=1-(1-linear)**2,blend=Math.max(0,Math.min(1,(p-.23)/.30));
            result.begin!.zoom?.(p);
            frame.style.transform=`scale(${introZoom(p)/2.4})`;
            frame.style.opacity=String(1-blend*blend*(3-2*blend));
            const softness=Math.min(1,p*5);edge.style.opacity=String(softness);frame.style.maskImage=`radial-gradient(ellipse at center,#000 ${100-58*softness}%,transparent ${145-58*softness}%)`;
            if(p<1)requestAnimationFrame(tick);else done();
          };result.begin!.zoom?.(0);requestAnimationFrame(tick);
        });
      }
      result.begin.zoom?.(1);finished=true;cleanup();result.begin();resolve();
    };
    const failure=()=>{if(!requested||finished||transitioning)return;clearTimeout(timeout);attempt++;pending=false;video.pause();controls.hidden=false;status.textContent='Intro unavailable. You can start the game.';skip.hidden=false;};
    const tryPlay=(userGesture=false)=>{
      if(!requested||finished||transitioning||document.hidden||(!userGesture&&pending))return;
      const ticket=++attempt;pending=true;video.playbackRate=2;
      if(userGesture)policyMuted=false;
      video.muted=policyMuted||!(audio?.sounds()??true);
      // Queue play even before canplay: mobile preload may need play/gesture first.
      void audio?.music.start().catch(()=>{});
      const playing=()=>{if(finished||ticket!==attempt)return;pending=false;started=true;clearTimeout(timeout);controls.hidden=true;skip.hidden=true;};
      const blocked=(error:unknown)=>{
        if(finished||transitioning||ticket!==attempt)return;pending=false;
        if((error as {name?:string})?.name==='NotAllowedError'){
          controls.hidden=false;status.textContent='Tap to continue';skip.hidden=true;
        }else if((error as {name?:string})?.name==='NotSupportedError')failure();
        // AbortError is normally a load/visibility race; canplay or a gesture retries it.
      };
      void video.play().then(playing).catch((error:unknown)=>{
        if(finished||transitioning||ticket!==attempt)return;
        if((error as {name?:string})?.name!=='NotAllowedError'){blocked(error);return;}
        policyMuted=true;video.muted=true;
        void video.play().then(playing).catch(blocked);
      });
    };
    const gesture=(event:Event)=>{
      if(!event.isTrusted||!requested)return;
      if(finished||transitioning||document.hidden)return;
      // Retry in the real activation callback, including touch release, without seeking.
      tryPlay(true);
    };
    const visibility=()=>{if(document.hidden){if(!finished&&!transitioning){backgroundPause=true;attempt++;pending=false;video.pause();}}else if(backgroundPause){backgroundPause=false;tryPlay();}};
    skip.addEventListener('click',()=>{void audio?.music.start().catch(()=>{});void finish();});
    video.addEventListener('ended',finish);video.addEventListener('error',failure);
    video.addEventListener('loadedmetadata',()=>{video.playbackRate=2;});
    video.addEventListener('canplay',()=>{if(!started||video.paused)tryPlay();});
    document.addEventListener('visibilitychange',visibility);for(const event of gestures)document.addEventListener(event,gesture,{capture:true,passive:true});
    launch.addEventListener('click',(event)=>{
      if(!event.isTrusted||requested)return;
      requested=true;audio?.onStart?.();audio?.unlockSounds?.();detachFullscreen();startScreen.remove();frame.hidden=false;
      video.src=introSource(window.innerWidth,window.innerHeight);
      timeout=setTimeout(()=>{if(!finished&&!started)failure();},12000);
      // Stay in this trusted click: no awaited load before video/music play.
      tryPlay(true);
    });
  });
}
