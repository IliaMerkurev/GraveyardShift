/** External intro files stay beside the HTML; only one orientation is requested. */
export const introSource=(width:number,height:number)=>`./media/intro-${height>width?'portrait':'landscape'}.mp4`;

export function showVideoIntro(parent:HTMLElement):Promise<void> {
  return new Promise(resolve=>{
    const overlay=document.createElement('section');overlay.className='video-intro';overlay.setAttribute('aria-label','Game introduction');
    const video=document.createElement('video');video.className='video-intro__video';video.playsInline=true;video.muted=true;video.defaultMuted=true;video.preload='auto';
    video.defaultPlaybackRate=2;video.playbackRate=2;
    // Lock the selected film for this intro. Rotation changes its fit, never downloads both films.
    video.src=introSource(window.innerWidth,window.innerHeight);
    const controls=document.createElement('div');controls.className='video-intro__controls';
    const status=document.createElement('p');status.className='video-intro__status';status.setAttribute('role','status');status.textContent='Loading intro…';
    const play=document.createElement('button');play.type='button';play.textContent='Play intro';play.hidden=true;
    const skip=document.createElement('button');skip.type='button';skip.textContent='Start game';skip.hidden=false;
    const sound=document.createElement('button');sound.type='button';sound.textContent='Sound off';sound.setAttribute('aria-label','Enable intro sound');sound.setAttribute('aria-pressed','false');
    controls.append(status,play,sound,skip);overlay.append(video,controls);parent.append(overlay);
    let finished=false,started=false,manualPause=false,backgroundPause=false,attempt=0;
    const finish=()=>{if(finished)return;finished=true;attempt++;clearTimeout(timeout);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);video.pause();video.removeAttribute('src');video.load();overlay.remove();resolve();};
    const failure=()=>{if(finished)return;status.textContent='Intro unavailable. You can start the game.';play.hidden=true;skip.hidden=false;};
    const tryPlay=()=>{
      if(finished||document.hidden)return;
      const ticket=++attempt;video.playbackRate=2;
      void video.play().then(()=>{if(finished||ticket!==attempt)return;started=true;status.textContent='';play.textContent='Pause';play.hidden=false;}).catch(()=>{if(finished||ticket!==attempt)return;status.textContent='Tap to play the intro';play.textContent='Play intro';play.hidden=false;skip.hidden=false;});
    };
    const suspend=()=>{if(finished)return;backgroundPause=!manualPause;attempt++;video.pause();};
    const visibility=()=>{if(document.hidden)suspend();else if(backgroundPause&&!manualPause){backgroundPause=false;tryPlay();}};
    const blur=()=>suspend();
    const focus=()=>{if(backgroundPause&&!manualPause&&!document.hidden){backgroundPause=false;tryPlay();}};
    play.addEventListener('click',()=>{if(started&&!video.paused){manualPause=true;video.pause();play.textContent='Resume';}else{manualPause=false;tryPlay();}});
    sound.addEventListener('click',()=>{video.muted=!video.muted;sound.textContent=video.muted?'Sound off':'Sound on';sound.setAttribute('aria-label',video.muted?'Enable intro sound':'Mute intro sound');sound.setAttribute('aria-pressed',String(!video.muted));});
    skip.addEventListener('click',finish);video.addEventListener('ended',finish);video.addEventListener('error',failure);
    video.addEventListener('loadedmetadata',()=>{video.playbackRate=2;});
    video.addEventListener('playing',()=>{if(!finished){clearTimeout(timeout);status.textContent='';}});
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);window.addEventListener('focus',focus);
    const timeout=setTimeout(()=>{if(!finished&&!started){status.textContent='Intro is taking a while to load.';skip.hidden=false;}},12000);
    tryPlay();
  });
}
