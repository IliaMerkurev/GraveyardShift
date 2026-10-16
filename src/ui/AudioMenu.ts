import type {AudioSettings} from '../audio/AudioSettings';
/** Native checkboxes retain keyboard/touch accessibility without a custom menu role. */
export function attachAudioMenu(button:HTMLButtonElement,settings:AudioSettings){
  const panel=document.createElement('div');panel.className='audio-menu';panel.hidden=true;panel.id='audio-settings';panel.setAttribute('role','group');panel.setAttribute('aria-label','Настройки звука');
  button.after(panel);button.title='Настройки звука';button.setAttribute('aria-label','Настройки звука');button.removeAttribute('aria-pressed');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',panel.id);
  const boxes=new Map<string,HTMLInputElement>();
  for(const [key,label] of [['sounds','Звуки'],['music','Музыка']] as const){const row=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=settings.value[key];box.addEventListener('change',()=>settings.set(key,box.checked));row.append(box,document.createTextNode(label));panel.append(row);boxes.set(key,box);}
  const close=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false');};
  button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));});
  document.addEventListener('pointerdown',event=>{if(!panel.contains(event.target as Node)&&!button.contains(event.target as Node))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){close();button.focus();}});
  settings.subscribe(value=>{for(const key of ['sounds','music'] as const)boxes.get(key)!.checked=value[key];button.textContent=value.sounds||value.music?'♪':'♪̸';button.dataset.muted=String(!value.sounds&&!value.music);});
}
