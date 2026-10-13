import {describe,it,expect} from 'vitest';
import {inlineScript,inlineStyle} from '../../scripts/inline-source';
describe('standalone source inlining',()=>{
 it('does not expand replacement tokens inside JavaScript',()=>{const tag='<script src="bundle.js"></script>',source='const pattern = `^value$`; const a="$&"; const b="$\'";';const html=`<!doctype html><head></head><body>${tag}</body>`;expect(inlineScript(html,tag,source)).toBe(`<!doctype html><head></head><body><script type="module">${source}</script></body>`);});
 it('escapes HTML script terminators without corrupting JS',()=>{expect(inlineScript('TAG','TAG','const x="</SCRIPT>";')).toBe('<script type="module">const x="<\\/SCRIPT>";</script>');});
 it('inlines CSS without replacement-token interpolation',()=>{const css='a::before{content:"$& $` $\'"}';expect(inlineStyle('before TAG after','TAG',css)).toBe(`before <style>${css}</style> after`);});
});
