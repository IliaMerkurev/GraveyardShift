type FullscreenDocument=Document&{webkitFullscreenEnabled?:boolean;webkitFullscreenElement?:Element|null;webkitExitFullscreen?:()=>void|Promise<void>};
type FullscreenElement=HTMLElement&{webkitRequestFullscreen?:()=>void|Promise<void>};
export function attachFullscreen(bar:Element,message:(text:string)=>void){
  const doc=document as FullscreenDocument,root=doc.documentElement as FullscreenElement,button=doc.createElement('button');
  button.className='icon-button fullscreen-button';button.type='button';
  const active=()=>!!(doc.fullscreenElement||doc.webkitFullscreenElement);
  const sync=()=>{const on=active();button.innerHTML=`<span aria-hidden="true">${on?'⊡':'⛶'}</span>`;button.title=on?'Exit fullscreen':'Enter fullscreen';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(on));};
  const failed=()=>{sync();message('Fullscreen unavailable. Safari: Share → Add to Home Screen → Open as Web App, if offered.');};
  button.addEventListener('click',()=>{
    const on=active(),standard=doc.fullscreenElement||(!on&&doc.fullscreenEnabled);
    const leave=standard?doc.exitFullscreen:doc.webkitExitFullscreen;
    const enter=standard?root.requestFullscreen:doc.webkitFullscreenEnabled?root.webkitRequestFullscreen:undefined;
    const operation=on?leave:enter;
    if(typeof operation!=='function'||typeof leave!=='function'){failed();return;}
    try{Promise.resolve(operation.call(on?doc:root)).then(sync,failed);}catch{failed();}
  });
  for(const event of ['fullscreenchange','webkitfullscreenchange'])doc.addEventListener(event,sync);
  for(const event of ['fullscreenerror','webkitfullscreenerror'])doc.addEventListener(event,failed);
  sync();bar.append(button);
}
