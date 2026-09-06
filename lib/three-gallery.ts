import * as T from 'three';
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import type { Project } from './projects';
import { constructionTile } from './brooklyn-world';
import { CAMERA_Z, hoverPose, pickObject, type Pickable, type Pointer } from './gallery-interaction';
const TAU=Math.PI*2;
export const palette={side:'#653c30',paper:'#f0e6cf',ink:'#302922',trim:'#b19a75'};
// Placeholder builds sit back from the finished one: greyer paper, softer ink.
export const mutedPalette={side:'#4a4643',paper:'#cdc9c0',ink:'#6d6963',trim:'#8f8a82'};
function mesh(parent:T.Object3D,g:T.BufferGeometry,m:T.Material|T.Material[],x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function rounded(w:number,h:number,r:number){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function slab(parent:T.Object3D,w:number,h:number,depth:number,color:string,metal=false){const geo=new T.ExtrudeGeometry(rounded(w,h,.12),{depth,bevelEnabled:true,bevelThickness:.05,bevelSize:.045,bevelSegments:2,steps:1,curveSegments:5});geo.translate(0,0,-depth/2);return mesh(parent,geo,new T.MeshStandardMaterial({color,roughness:metal?.36:.85,metalness:metal?.7:0}));}
function canvasTexture(w:number,h:number,paint:(ctx:CanvasRenderingContext2D)=>void){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d')!);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=2;return t;}
function blurredTexture(src:string,wake:()=>void){
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=405;
  const ctx=canvas.getContext('2d')!;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;
  const image=new Image();
  // Draw past the edges so the blur does not bleed transparent borders inward.
  image.onload=()=>{ctx.filter='blur(17px)';ctx.drawImage(image,-26,-26,canvas.width+52,canvas.height+52);ctx.filter='none';texture.needsUpdate=true;wake();};
  image.src=src;return texture;
}
function printed(parent:T.Object3D,texture:T.Texture,w:number,h:number,x:number,y:number,z:number){return mesh(parent,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,transparent:true}),x,y,z);}
function label(parent:T.Object3D,font:Font,text:string,size:number,maxWidth:number,color:string,x:number,y:number,z:number,depth=.045){const geo=new TextGeometry(text,{font,size,depth,curveSegments:3,bevelEnabled:true,bevelThickness:.006,bevelSize:.003,bevelSegments:1});geo.computeBoundingBox();const width=geo.boundingBox!.max.x-geo.boundingBox!.min.x;const m=mesh(parent,geo,new T.MeshStandardMaterial({color,roughness:.52,metalness:.15}),x,y,z);if(width>maxWidth)m.scale.x=maxWidth/width;return m;}
export interface Tile {scene:T.Scene;camera:T.PerspectiveCamera;group:T.Group;article:HTMLElement;project:Project;imageMaterial:T.MeshBasicMaterial;imageTexture:T.Texture;statusTexture:T.Texture;statusMaterial:T.MeshBasicMaterial;capLabel:T.Mesh|null;changeLabel:T.Mesh|null;animate:Array<(t:number)=>void>;hover:boolean;hoverProgress:number;baseY:number;bounds:T.Box3;}
export function makeTile(article:HTMLElement,p:Project,index:number,font:Font,wake:()=>void):Tile{
  const colors=p.comingSoon?mutedPalette:palette,scene=new T.Scene(),camera=new T.PerspectiveCamera(46,1,.1,30);camera.position.set(0,.12,10.4);camera.lookAt(0,.12,0);
  scene.add(new T.HemisphereLight('#fff7e5','#5d625c',2.4));const light=new T.DirectionalLight('#ffe6ba',3);light.position.set(-3,5,6);scene.add(light);const rim=new T.DirectionalLight('#e1f3ed',1.9);rim.position.set(4,-1,2);scene.add(rim);
  const group=new T.Group();scene.add(group);const animate:Array<(t:number)=>void>=[];
  const face=slab(group,4.5,5.5,.1,colors.paper);face.position.z=.47;
  // Four raised rails make the screen visibly inset in a solid front frame.
  const railMat=new T.MeshStandardMaterial({color:colors.trim,roughness:.8,metalness:0});
  for(const x of [-2.22,2.22])mesh(group,new T.BoxGeometry(.09,2.7,.17),railMat,x,1.27,.57);
  for(const y of [-.07,2.61])mesh(group,new T.BoxGeometry(4.52,.09,.17),railMat,0,y,.57);
  const imageTexture=p.comingSoon?blurredTexture(p.image,wake):new T.TextureLoader().load(p.image,()=>wake());imageTexture.colorSpace=T.SRGBColorSpace;
  const imageMaterial=new T.MeshBasicMaterial({map:imageTexture,color:p.comingSoon?'#8f8f8f':'#ffffff'});mesh(group,new T.PlaneGeometry(4.35,2.57),imageMaterial,0,1.27,.585).name='media-screen';
  // All printed details sit on the model's face. Titles and caps are separately extruded.
  const info=canvasTexture(1024,610,ctx=>{
    ctx.fillStyle=colors.paper;ctx.fillRect(0,0,1024,610);ctx.fillStyle=colors.ink;
    ctx.font='500 26px sans-serif';ctx.globalAlpha=.67;ctx.fillText('$'+p.ticker,207,156);ctx.globalAlpha=1;
    ctx.font='32px Georgia';
    const words=p.description.split(' ');let lineText='',y=232;for(const word of words){const test=lineText+word+' ';if(ctx.measureText(test).width>905){ctx.fillText(lineText,40,y);lineText=word+' ';y+=41;}else lineText=test;}ctx.fillText(lineText,40,y);
    ctx.strokeStyle='#b2baa3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(40,346);ctx.lineTo(984,346);ctx.stroke();
    if(!p.comingSoon){
      ctx.globalAlpha=.7;ctx.font='27px sans-serif';ctx.fillText('MARKET CAP',40,400);ctx.globalAlpha=1;
      ctx.fillStyle='#4c784f';ctx.font='500 28px sans-serif';ctx.fillText('↗ '+p.change,412,496);ctx.font='23px sans-serif';ctx.globalAlpha=.6;ctx.fillText('24h',412,530);ctx.globalAlpha=1;
      ctx.fillStyle=colors.ink;ctx.strokeStyle='#8f9b8766';
      for(const x of [807,934]){ctx.beginPath();ctx.arc(x,480,40,0,TAU);ctx.stroke();}
      ctx.font='36px sans-serif';ctx.textAlign='center';ctx.fillText('𝕏',807,493);ctx.font='33px sans-serif';ctx.fillText('➤',934,492);ctx.textAlign='left';
    }
    ctx.globalAlpha=.09;ctx.fillStyle='#43361c';for(let y=0;y<610;y+=5)ctx.fillRect(0,y,1024,1);
  });printed(group,info,4.35,2.59,0,-1.42,.588).name='info-face';
  const medallion=mesh(group,new T.CylinderGeometry(.32,.32,.11,12),new T.MeshStandardMaterial({color:p.color,roughness:.5,metalness:.2}),-1.67,-.51,.66);medallion.rotation.x=Math.PI/2;
  const symbol=canvasTexture(128,128,ctx=>{ctx.fillStyle=colors.ink;ctx.font='80px sans-serif';ctx.textAlign='center';ctx.fillText(p.icon,64,94);});printed(group,symbol,.5,.5,-1.67,-.51,.725).name='symbol-face';
  label(group,font,p.name,.265,3.2,colors.ink,-1.14,-.5,.63,.055);
  const capLabel=p.comingSoon?null:label(group,font,p.cap,.32,1.42,colors.ink,-2,-2.42,.64,.06);
  const chip=canvasTexture(768,94,ctx=>{ctx.fillStyle=p.comingSoon?'#9a9d8c':'#dcec83';ctx.fillRect(0,0,768,94);ctx.fillStyle='#283628';ctx.font='27px sans-serif';ctx.fillText(p.category.toUpperCase(),25,61);if(p.featured){ctx.textAlign='right';ctx.fillText('↗ FEATURED',740,61);}});printed(group,chip,4.18,.51,0,2.24,.62).name='category-face';
  const makeStatus=(status:string)=>canvasTexture(768,80,ctx=>{ctx.fillStyle='#14271edf';ctx.fillRect(0,0,768,80);ctx.fillStyle='#eaf0df';ctx.font='26px sans-serif';ctx.fillText(status,24,53);ctx.textAlign='right';ctx.fillText('↗',740,53);});
  const statusTexture=makeStatus('COMING SOON');const statusMaterial=new T.MeshBasicMaterial({map:statusTexture,transparent:true});const statusFace=mesh(group,new T.PlaneGeometry(4.18,.435),statusMaterial,0,.232,.625);statusFace.name='status-face';statusFace.visible=!!p.comingSoon;
  // Every visible word is now extruded geometry, including the small captions.
  const infoFace=group.getObjectByName('info-face') as T.Mesh;
  infoFace.material=new T.MeshStandardMaterial({color:colors.paper,roughness:.82});
  const symbolFace=group.getObjectByName('symbol-face');if(symbolFace)symbolFace.visible=false;
  const markMaterial=new T.MeshStandardMaterial({color:colors.ink,roughness:.55});
  const mark=mesh(group,new T.TorusGeometry(.15,.022,5,20),markMaterial,-1.67,-.51,.74);
  if(index%2)mark.scale.y=.55;
  const markBar=mesh(group,new T.BoxGeometry(.3,.026,.025),markMaterial,-1.67,-.51,.745);markBar.rotation.z=index*Math.PI/5;
  label(group,font,'$'+p.ticker,.12,2.9,colors.ink,-1.14,-.77,.64,.02);
  const words=p.description.split(' ');let lineText='',lineIndex=0;
  for(const word of words){if((lineText+word).length>38){label(group,font,lineText.trim(),.155,4.0,colors.ink,-2,-1.11-lineIndex*.24,.63,.019);lineText=word+' ';lineIndex++;}else lineText+=word+' ';}
  if(lineText)label(group,font,lineText.trim(),.155,4.0,colors.ink,-2,-1.11-lineIndex*.24,.63,.019);
  mesh(group,new T.BoxGeometry(4.03,.008,.016),railMat,0,-1.72,.64);
  let changeLabel:T.Mesh|null=null;
  if(!p.comingSoon){
    label(group,font,'MARKET CAP',.10,2,colors.ink,-2,-2.02,.64,.024);
    changeLabel=label(group,font,p.change,.155,1.05,'#51734b',-.28,-2.40,.66,.03);
    label(group,font,'24h',.095,.6,colors.ink,-.28,-2.62,.64,.019);
    for(const x of [1.23,1.78])mesh(group,new T.TorusGeometry(.175,.007,4,24),markMaterial,x,-2.29,.66);
    for(const angle of [-Math.PI/4,Math.PI/4])mesh(group,new T.BoxGeometry(.21,.022,.028),markMaterial,1.23,-2.29,.67).rotation.z=angle;
    const sendShape=new T.Shape();sendShape.moveTo(-.11,.055);sendShape.lineTo(.12,.1);sendShape.lineTo(.04,-.11);sendShape.lineTo(-.015,-.025);sendShape.closePath();mesh(group,new T.ExtrudeGeometry(sendShape,{depth:.024,bevelEnabled:false}),markMaterial,1.78,-2.29,.66);
  }
  const categoryFace=group.getObjectByName('category-face') as T.Mesh;categoryFace.material=new T.MeshStandardMaterial({color:'#24382a',roughness:.7});
  label(group,font,p.category.toUpperCase(),.112,2.75,'#e6efdb',-1.95,2.20,.66,.025);
  if(p.featured)label(group,font,'FEATURED',.105,1,'#e4e5a4',1.07,2.20,.66,.025);
  statusMaterial.map=null;statusMaterial.color.set('#182b24');statusMaterial.needsUpdate=true;
  if(p.comingSoon)label(group,font,'COMING SOON',.12,3.9,'#e7efdc',-1.96,.19,.665,.024);
  constructionTile(group,animate,index);
  label(group,font,'SITE / 0'+(index+1),.13,1.7,'#e9bd69',.12,3.13,.62,.035);
  // A live site keeps a beacon burning, so the running build reads at a glance.
  if(!p.comingSoon){
    const glass=new T.MeshStandardMaterial({color:'#ff7a55',emissive:'#ff2d12',emissiveIntensity:2.2,roughness:.35});
    const beacon=mesh(group,new T.SphereGeometry(.115,14,12),glass,-1.95,3.13,.66);
    const halo=new T.Mesh(new T.SphereGeometry(.24,14,12),new T.MeshBasicMaterial({color:'#ff7043',transparent:true,opacity:.2,depthWrite:false}));
    halo.position.copy(beacon.position);halo.castShadow=false;group.add(halo);
    mesh(group,new T.CylinderGeometry(.055,.075,.12,10),railMat,-1.95,3.02,.66);
    label(group,font,'LIVE',.1,.9,'#ffb59c',-1.78,3.07,.66,.022);
    animate.push(t=>{
      const pulse=(Math.sin(t*3.2)+1)/2;
      glass.emissiveIntensity=.35+pulse*3.3;
      halo.scale.setScalar(.8+pulse*.75);
      (halo.material as T.MeshBasicMaterial).opacity=.05+pulse*.28;
    });
  }
  const shadowTex=canvasTexture(128,128,ctx=>{const grad=ctx.createRadialGradient(64,64,10,64,64,64);grad.addColorStop(0,'#0008');grad.addColorStop(1,'#0000');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);});const shadow=printed(scene,shadowTex,6.4,7.5,.2,-.26,-1.1);shadow.castShadow=false;shadow.name='drop-shadow';(shadow.material as T.Material).depthWrite=false;
  const bounds=new T.Box3(new T.Vector3(-2.43,-2.95,-1.66),new T.Vector3(2.43,3.72,.77));
  const baseY=.13;group.rotation.set(.09,baseY,0);
  return {scene,camera,group,article,project:p,imageMaterial,imageTexture,statusTexture,statusMaterial,capLabel,changeLabel,animate,hover:false,hoverProgress:0,baseY,bounds};
}
function retext(target:T.Mesh,font:Font,text:string,size:number,maxWidth:number,depth:number){
  target.geometry.dispose();
  const geometry=new TextGeometry(text,{font,size,depth,curveSegments:3,bevelEnabled:true,bevelThickness:.006,bevelSize:.003,bevelSegments:1});
  geometry.computeBoundingBox();
  const width=geometry.boundingBox!.max.x-geometry.boundingBox!.min.x;
  target.geometry=geometry;target.scale.x=width>maxWidth?maxWidth/width:1;
}
export async function createGallery(container:HTMLDivElement,articles:HTMLElement[],projects:Project[],onReady:()=>void,onHover?:(id:string|null)=>void){
  const font=await new FontLoader().loadAsync('/fonts/helvetiker.json');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio,window.innerWidth<650?1.1:1.4));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.setClearColor(0,0);renderer.autoClear=false;container.appendChild(renderer.domElement);
  let frame=0,elapsed=0,last=0,motion=true,disposed=false,hovered:string|null=null;const tiles:Tile[]=[];const cleanups:Array<()=>void>=[];
  function wake(){if(disposed||frame)return;frame=requestAnimationFrame(render);}
  articles.forEach((article,index)=>tiles.push(makeTile(article,projects[index],index,font,wake)));
  let pointer:Pointer|null=null, active=-1, keyboard=-1;
  let views:(Pickable|null)[]=tiles.map(()=>null);
  const blocked=(target:EventTarget|null)=>target instanceof Element && !!target.closest('button,a,[role="tab"],[data-slot="tooltip-content"]') && !target.closest('[data-project-id]');
  const move=(event:PointerEvent)=>{
    if(event.pointerType!=='mouse'){pointer=null;active=keyboard=-1;wake();return;}
    keyboard=-1;pointer=blocked(event.target)?null:{x:event.clientX,y:event.clientY};wake();
  };
  const clearPointer=()=>{pointer=null;active=-1;wake();};
  const focus=()=>{
    const focused=document.activeElement;
    keyboard=focused instanceof HTMLElement&&focused.matches(':focus-visible')?tiles.findIndex(tile=>tile.article.contains(focused)):-1;
    wake();
  };
  const exitFocus=()=>queueMicrotask(focus);
  const select=(event:MouseEvent)=>{
    // Native keyboard and programmatic activation keep their existing semantics.
    if(event.detail===0||blocked(event.target))return;
    const hit=pickObject({x:event.clientX,y:event.clientY},views,active);if(!hit)return;
    event.preventDefault();event.stopImmediatePropagation();
    const article=tiles[hit.index].article;
    const social=hit.point.y < -1.98 && hit.point.y > -2.61 && hit.point.x > .99;
    if(!social)return;
    article.querySelectorAll<HTMLElement>('.social-links a,.social-links button')[hit.point.x>1.5?1:0]?.click();
  };
  const down=(event:PointerEvent)=>{
    if(blocked(event.target))return;
    if(pickObject({x:event.clientX,y:event.clientY},views,active))event.stopPropagation();
  };
  document.addEventListener('pointermove',move,{passive:true});
  document.documentElement.addEventListener('pointerleave',clearPointer);
  window.addEventListener('blur',clearPointer);
  document.addEventListener('pointerdown',down,true);
  document.addEventListener('click',select,true);
  document.addEventListener('focusin',focus);document.addEventListener('focusout',exitFocus);
  cleanups.push(()=>{
    document.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',clearPointer);window.removeEventListener('blur',clearPointer);
    document.removeEventListener('pointerdown',down,true);document.removeEventListener('click',select,true);
    document.removeEventListener('focusin',focus);document.removeEventListener('focusout',exitFocus);
    document.body.style.removeProperty('cursor');
    tiles.forEach(tile=>delete tile.article.dataset.hovered);
  });
  let visibleCount=0;
  function render(now:number){frame=0;if(disposed||document.hidden)return;const dt=Math.min((now-last)/1000,.04);last=now;if(motion)elapsed+=dt;const width=window.innerWidth,height=window.innerHeight;const rects=tiles.map(t=>t.article.getBoundingClientRect());renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);visibleCount=0;let settling=false;
    views=tiles.map((tile,index)=>{
      const r=rects[index];
      if(r.bottom < -r.height*.4 || r.top > height+r.height*.4)return null;
      const angle=T.MathUtils.clamp((r.top+r.height/2-height*.58)/(height*.88),-1.1,1.1);
      const expansion=1.7,bend=(Math.sin(angle)*height*.88-(r.top+r.height/2-height*.58))*.7;
      const viewport={left:r.left-r.width*(expansion-1)/2,top:r.top-r.height*(expansion-1)/2+bend,width:r.width*expansion,height:r.height*expansion};
      tile.camera.aspect=r.width/r.height;tile.camera.zoom=1/expansion;tile.camera.updateProjectionMatrix();
      return {group:tile.group,camera:tile.camera,viewport,bounds:tile.bounds};
    });
    active=keyboard>=0?keyboard:(pickObject(pointer,views,active)?.index??-1);
    document.body.style.cursor=active>=0?'pointer':'';
    tiles.forEach((tile,index)=>{tile.hover=index===active;tile.article.dataset.hovered=String(tile.hover);});
    const overId=active>=0?tiles[active].project.id:null;
    if(overId!==hovered){hovered=overId;onHover?.(overId);}
    const order=tiles.map((tile,index)=>({tile,index})).sort((a,b)=>Number(a.tile.hover)-Number(b.tile.hover));order.forEach(({tile,index})=>{
      const r=rects[index],view=views[index];if(!view)return;
      tile.article.dataset.wheelActive='true';tile.article.inert=false;visibleCount++;

      const scrollAngle=T.MathUtils.clamp((r.top+r.height/2-height*.58)/(height*.88),-1.1,1.1);
      const ease=1-Math.exp(-dt*13),target=tile.hover?1:0;
      tile.hoverProgress+=(target-tile.hoverProgress)*ease;
      if(Math.abs(target-tile.hoverProgress)<.0001)tile.hoverProgress=target;
      const progress=tile.hoverProgress,restZ=-(1-Math.cos(scrollAngle))*4.8;
      const pose=hoverPose(restZ,progress);
      const tx=scrollAngle*.88*(1-progress),ty=tile.baseY*(1-progress);
      if(Math.abs(target-progress)>.0001||Math.abs(tile.group.rotation.x-tx)>.001)settling=true;
      tile.group.rotation.set(tx,ty,0);tile.group.position.set(0,0,pose.z);tile.group.scale.setScalar(pose.scale);
      tile.animate.forEach(fn=>fn(elapsed));tile.camera.position.set(0,.12,CAMERA_Z);tile.camera.lookAt(0,.12,0);
      const expanded=view.viewport,right=expanded.left+expanded.width,bottom=expanded.top+expanded.height;
      renderer.setViewport(expanded.left,height-expanded.top-expanded.height,expanded.width,expanded.height);
      renderer.setScissor(Math.max(0,expanded.left),Math.max(0,height-bottom),Math.max(0,Math.min(right,width)-Math.max(0,expanded.left)),Math.max(0,Math.min(bottom,height)-Math.max(0,expanded.top)));
      renderer.clearDepth();renderer.render(tile.scene,tile.camera);
    });
    if(visibleCount&&(motion||settling))frame=requestAnimationFrame(render);
  }
  function resize(){renderer.setSize(window.innerWidth,window.innerHeight,false);wake();}
  const observer=new ResizeObserver(resize);articles.forEach(a=>observer.observe(a));window.addEventListener('scroll',wake,{passive:true});window.addEventListener('resize',resize);document.addEventListener('visibilitychange',wake);
  const changes=new MutationObserver(wake);articles.forEach(a=>changes.observe(a,{childList:true,subtree:true}));
  const contextLost=(event:Event)=>{event.preventDefault();container.dispatchEvent(new CustomEvent('gallery-error'));};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  resize();render(performance.now());onReady();
  return {setMotion(value:boolean){motion=value;wake();},
    setStats(id:string,stats:{cap:string;change:string;up:boolean}){
      const tile=tiles.find(t=>t.project.id===id);if(!tile)return;
      if(tile.capLabel)retext(tile.capLabel,font,stats.cap,.32,1.42,.06);
      if(tile.changeLabel){
        retext(tile.changeLabel,font,stats.change,.155,1.05,.03);
        (tile.changeLabel.material as T.MeshStandardMaterial).color.set(stats.up?'#51734b':'#9c4a3c');
      }
      wake();
    },
    dispose(){disposed=true;cancelAnimationFrame(frame);cleanups.forEach(f=>f());observer.disconnect();changes.disconnect();window.removeEventListener('scroll',wake);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',wake);renderer.domElement.removeEventListener('webglcontextlost',contextLost);const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();tiles.forEach(tile=>{textures.add(tile.imageTexture);textures.add(tile.statusTexture);tile.scene.traverse(o=>{const m=o as T.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>{materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);});});});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
