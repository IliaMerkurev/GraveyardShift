/** External intro files stay beside the HTML; only one orientation is requested. */
export const introSource=(width:number,height:number)=>`./media/intro-${height>width?'portrait':'landscape'}.mp4`;

export function showVideoIntro(parent:HTMLElement,prepared:Promise<()=>void>=Promise.resolve(()=>{})):Promise<void> {
  return new Promise((resolve,reject)=>{
    const overlay=document.createElement('section');overlay.className='video-intro';overlay.setAttribute('aria-label','Game introduction');
    const video=document.createElement('video');video.className='video-intro__video';video.playsInline=true;video.muted=false;video.defaultMuted=false;video.preload='auto';
    video.defaultPlaybackRate=2;video.playbackRate=2;
    // Lock the selected film for this intro. Rotation changes its fit, never downloads both films.
    video.src=introSource(window.innerWidth,window.innerHeight);
    const controls=document.createElement('div');controls.className='video-intro__controls';
    const status=document.createElement('p');status.className='video-intro__status';status.setAttribute('role','status');status.textContent='Loading intro…';
    const play=document.createElement('button');play.type='button';play.textContent='Play intro';play.hidden=true;
    const skip=document.createElement('button');skip.type='button';skip.textContent='Start game';skip.hidden=false;
    const sound=document.createElement('button');sound.type='button';sound.textContent='Sound on';sound.setAttribute('aria-label','Mute intro sound');sound.setAttribute('aria-pressed','true');
    const veil=document.createElement('div');veil.className='intro-smoke';veil.setAttribute('aria-hidden','true');controls.append(status,play,sound,skip);overlay.append(video,controls,veil);parent.append(overlay);
    let finished=false,started=false,manualPause=false,backgroundPause=false,attempt=0;
    let transitioning=false;
    const cleanup=()=>{attempt++;clearTimeout(timeout);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);video.pause();video.removeAttribute('src');video.load();overlay.remove();};
    // Attach failure handling immediately, including while autoplay awaits a gesture.
    const ready=prepared.then(begin=>({begin,error:null})).catch((error:unknown)=>({begin:null,error}));
    const finish=async()=>{
      if(finished||transitioning)return;transitioning=true;attempt++;video.pause();play.hidden=true;skip.hidden=true;sound.hidden=true;
      status.textContent='Preparing the mine…';
      const result=await ready;
      if(!result.begin){finished=true;cleanup();reject(result.error);return;}
      status.textContent='';
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
      veil.className='intro-smoke intro-smoke--cover';
      await new Promise(r=>setTimeout(r,reduced?0:400));
      video.style.visibility='hidden';controls.style.visibility='hidden';overlay.style.background='transparent';
      veil.className='intro-smoke intro-smoke--reveal';
      await new Promise(r=>setTimeout(r,reduced?0:400));
      finished=true;cleanup();result.begin();resolve();
    };
    const failure=()=>{if(finished)return;status.textContent='Intro unavailable. You can start the game.';play.hidden=true;skip.hidden=false;};
    const tryPlay=()=>{
      if(finished||transitioning||document.hidden)return;
      const ticket=++attempt;video.playbackRate=2;
      void video.play().then(()=>{if(finished||ticket!==attempt)return;started=true;play.className='';status.textContent='';play.textContent='Pause';play.hidden=false;}).catch(()=>{if(finished||ticket!==attempt)return;video.pause();if(!started)video.currentTime=0;status.textContent='Tap to enter the mine with sound';play.textContent=started?'Resume':'▶ Play with sound';play.className='video-intro__launch';play.hidden=false;skip.hidden=false;});
    };
    const suspend=()=>{if(finished||transitioning)return;backgroundPause=!manualPause;attempt++;video.pause();};
    const visibility=()=>{if(document.hidden)suspend();else if(backgroundPause&&!manualPause){backgroundPause=false;tryPlay();}};
    const blur=()=>suspend();
    const focus=()=>{if(backgroundPause&&!manualPause&&!document.hidden){backgroundPause=false;tryPlay();}};
    play.addEventListener('click',()=>{if(started&&!video.paused){manualPause=true;video.pause();play.textContent='Resume';}else{manualPause=false;if(!started){video.currentTime=0;video.muted=false;}tryPlay();}});
    sound.addEventListener('click',()=>{video.muted=!video.muted;sound.textContent=video.muted?'Sound off':'Sound on';sound.setAttribute('aria-label',video.muted?'Enable intro sound':'Mute intro sound');sound.setAttribute('aria-pressed',String(!video.muted));});
    skip.addEventListener('click',finish);video.addEventListener('ended',finish);video.addEventListener('error',failure);
    video.addEventListener('loadedmetadata',()=>{video.playbackRate=2;});
    video.addEventListener('playing',()=>{if(!finished){clearTimeout(timeout);status.textContent='';}});
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);window.addEventListener('focus',focus);
    const timeout=setTimeout(()=>{if(!finished&&!started){status.textContent='Intro is taking a while to load.';skip.hidden=false;}},12000);
    tryPlay();
  });
}
