import type {MusicAudio} from '../audio/MusicAudio';
/** External intro files stay beside the HTML; only one orientation is requested. */
export const introSource=(width:number,height:number)=>`./media/intro-${height>width?'portrait':'landscape'}.mp4`;
type IntroAudio={music:MusicAudio;sounds:()=>boolean};
export function showVideoIntro(parent:HTMLElement,prepared:Promise<()=>void>=Promise.resolve(()=>{}),audio?:IntroAudio):Promise<void> {
  return new Promise((resolve,reject)=>{
    const overlay=document.createElement('section');overlay.className='video-intro';overlay.setAttribute('aria-label','Game introduction');
    const video=document.createElement('video');video.className='video-intro__video';video.playsInline=true;video.muted=!(audio?.sounds()??true);video.defaultMuted=video.muted;video.preload='auto';
    video.defaultPlaybackRate=2;video.playbackRate=2;video.src=introSource(window.innerWidth,window.innerHeight);
    const controls=document.createElement('div');controls.className='video-intro__controls';
    const status=document.createElement('p');status.className='video-intro__status';status.setAttribute('role','status');status.textContent='Loading intro…';
    const play=document.createElement('button');play.type='button';play.textContent='▶ Нажми, чтобы начать';play.className='video-intro__launch';play.hidden=true;
    const skip=document.createElement('button');skip.type='button';skip.textContent='Start game';skip.hidden=true;
    const veil=document.createElement('div');veil.className='intro-smoke';veil.setAttribute('aria-hidden','true');controls.append(status,play,skip);overlay.append(video,controls,veil);parent.append(overlay);
    let finished=false,started=false,backgroundPause=false,attempt=0,transitioning=false;
    const cleanup=()=>{attempt++;clearTimeout(timeout);document.removeEventListener('visibilitychange',visibility);video.pause();video.removeAttribute('src');video.load();overlay.remove();};
    const ready=prepared.then(begin=>({begin,error:null})).catch((error:unknown)=>({begin:null,error}));
    const finish=async()=>{
      if(finished||transitioning)return;transitioning=true;attempt++;video.pause();controls.hidden=true;
      const result=await ready;
      if(!result.begin){finished=true;cleanup();reject(result.error);return;}
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
      veil.className='intro-smoke intro-smoke--cover';await new Promise(r=>setTimeout(r,reduced?0:400));
      video.style.visibility='hidden';overlay.style.background='transparent';
      veil.className='intro-smoke intro-smoke--reveal';await new Promise(r=>setTimeout(r,reduced?0:400));
      finished=true;cleanup();result.begin();resolve();
    };
    const failure=()=>{if(finished||transitioning)return;clearTimeout(timeout);attempt++;video.pause();controls.hidden=false;status.textContent='Intro unavailable. You can start the game.';play.hidden=true;skip.hidden=false;};
    const tryPlay=()=>{
      if(finished||transitioning||document.hidden)return;
      // Do not let the music run ahead while the film is still buffering.
      if(video.readyState<3){controls.hidden=false;status.textContent='Loading intro…';play.hidden=true;return;}
      const ticket=++attempt;video.playbackRate=2;video.muted=!(audio?.sounds()??true);controls.hidden=true;
      // Both play calls happen in the same gesture, before awaiting either promise.
      void Promise.all([video.play(),audio?.music.start()??Promise.resolve()]).then(()=>{
        if(finished||ticket!==attempt)return;started=true;clearTimeout(timeout);controls.hidden=true;
      }).catch(()=>{
        if(finished||ticket!==attempt)return;clearTimeout(timeout);video.pause();if(!started){video.currentTime=0;audio?.music.cancelStart();}
        controls.hidden=false;status.textContent='';play.textContent=started?'▶ Продолжить':'▶ Нажми, чтобы начать';play.hidden=false;skip.hidden=true;
      });
    };
    const visibility=()=>{if(document.hidden){if(!finished&&!transitioning){backgroundPause=started||!video.paused;attempt++;video.pause();}}else if(backgroundPause){backgroundPause=false;tryPlay();}};
    play.addEventListener('click',tryPlay);
    skip.addEventListener('click',()=>{void audio?.music.start().catch(()=>{});void finish();});
    video.addEventListener('ended',finish);video.addEventListener('error',failure);
    video.addEventListener('loadedmetadata',()=>{video.playbackRate=2;});
    video.addEventListener('canplay',()=>{if(!started&&play.hidden&&skip.hidden)tryPlay();});
    document.addEventListener('visibilitychange',visibility);
    const timeout=setTimeout(()=>{if(!finished&&!started)failure();},12000);
    tryPlay();
  });
}
