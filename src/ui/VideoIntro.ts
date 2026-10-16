import type {MusicAudio} from '../audio/MusicAudio';
/** External intro files stay beside the HTML; only one orientation is requested. */
export const introSource=(width:number,height:number)=>`./media/intro-${height>width?'portrait':'landscape'}.mp4`;
export type PreparedIntro=(()=>void)&{zoom?:(progress:number)=>void};
export const introZoom=(progress:number)=>Math.exp(Math.log(2.4)*(1-Math.max(0,Math.min(1,progress))));
type IntroAudio={music:MusicAudio;sounds:()=>boolean;unlockSounds?:()=>void};
export function showVideoIntro(parent:HTMLElement,prepared:Promise<PreparedIntro>=Promise.resolve(()=>{}),audio?:IntroAudio):Promise<void> {
  return new Promise((resolve,reject)=>{
    const overlay=document.createElement('section');overlay.className='video-intro';overlay.setAttribute('aria-label','Game introduction');
    const video=document.createElement('video');video.className='video-intro__video';video.playsInline=true;video.muted=!(audio?.sounds()??true);video.defaultMuted=video.muted;video.preload='auto';
    video.defaultPlaybackRate=2;video.playbackRate=2;video.src=introSource(window.innerWidth,window.innerHeight);
    const controls=document.createElement('div');controls.className='video-intro__controls';
    const status=document.createElement('p');status.className='video-intro__status';status.setAttribute('role','status');status.textContent='Loading intro…';
    const skip=document.createElement('button');skip.type='button';skip.textContent='Start game';skip.hidden=true;
    const frame=document.createElement('div');frame.className='intro-film-frame';const edge=document.createElement('div');edge.className='intro-edge-blur';edge.setAttribute('aria-hidden','true');frame.append(video,edge);controls.append(status,skip);overlay.append(frame,controls);parent.append(overlay);
    let finished=false,started=false,backgroundPause=false,attempt=0,transitioning=false;
    const cleanup=()=>{attempt++;clearTimeout(timeout);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointerdown',gesture);document.removeEventListener('keydown',gesture);video.pause();video.removeAttribute('src');video.load();overlay.remove();};
    const ready=prepared.then(begin=>({begin,error:null})).catch((error:unknown)=>({begin:null,error}));
    const finish=async()=>{
      if(finished||transitioning)return;transitioning=true;attempt++;video.pause();controls.hidden=true;
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
    const failure=()=>{if(finished||transitioning)return;clearTimeout(timeout);attempt++;video.pause();controls.hidden=false;status.textContent='Intro unavailable. You can start the game.';skip.hidden=false;};
    const tryPlay=()=>{
      if(finished||transitioning||document.hidden)return;
      if(video.readyState<3){controls.hidden=false;status.textContent='Loading intro…';return;}
      const ticket=++attempt;video.playbackRate=2;video.muted=!(audio?.sounds()??true);controls.hidden=true;
      // Audio rejection must never block or rewind the film.
      void audio?.music.start().catch(()=>{});
      const playing=()=>{if(finished||ticket!==attempt)return;started=true;clearTimeout(timeout);controls.hidden=true;};
      void video.play().then(playing).catch(()=>{
        if(finished||transitioning||ticket!==attempt)return;
        video.muted=true;
        void video.play().then(playing).catch(()=>{if(ticket===attempt)failure();});
      });
    };
    const gesture=()=>{
      if(finished||transitioning||document.hidden)return;
      video.muted=!(audio?.sounds()??true);
      // Unmute in place: keep currentTime and the already running zoom untouched.
      if(video.paused&&video.readyState>=3)tryPlay();
    };
    const visibility=()=>{if(document.hidden){if(!finished&&!transitioning){backgroundPause=started||!video.paused;attempt++;video.pause();}}else if(backgroundPause){backgroundPause=false;tryPlay();}};
    skip.addEventListener('click',()=>{void audio?.music.start().catch(()=>{});void finish();});
    video.addEventListener('ended',finish);video.addEventListener('error',failure);
    video.addEventListener('loadedmetadata',()=>{video.playbackRate=2;});
    video.addEventListener('canplay',()=>{if(!started&&skip.hidden)tryPlay();});
    document.addEventListener('visibilitychange',visibility);document.addEventListener('pointerdown',gesture);document.addEventListener('keydown',gesture);
    const timeout=setTimeout(()=>{if(!finished&&!started)failure();},12000);
    tryPlay();
  });
}
