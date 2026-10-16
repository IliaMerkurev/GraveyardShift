import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  // Three's bundled shader literals retain indentation after JS minification.
  // Preserve every GLSL token and newline (including preprocessor directives).
  plugins: [{name:'compact-shader-indent',enforce:'pre',transform(code,id){
    if(!id.endsWith('/three/build/three.module.js'))return;
    return code.replace(/^(const|var) ([\w$]+) = ("(?:[^"\\]|\\.)*");$/gm,(line,kind,name,literal)=>{
      const shader:string=JSON.parse(literal);
      if(!shader.includes('\n')||!/(?:vec[234]|float |#include|uniform )/.test(shader))return line;
      return `${kind} ${name} = ${JSON.stringify(shader.replace(/^[\t ]+/gm,'').split('\n').map(line=>line.startsWith('#')?line:line.replace(/[\t ]*([{}();,])[\t ]*/g,'$1')).join('\n'))};`;
    });
  }}],
  build: { target: 'es2022', outDir: 'dist/raw', assetsInlineLimit: 1000000, sourcemap: false, cssCodeSplit: false,
    rolldownOptions: { output: { codeSplitting: false } } }
});
