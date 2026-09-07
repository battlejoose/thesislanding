import * as T from 'three';
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Project, Theme } from './projects';
import { addTileWorldDetails } from './theme-worlds';
import { constructionTile } from './brooklyn-world';
import { CAMERA_Z, cursorTiltTarget, hoverPose, pickObject, type Pickable, type Pointer } from './gallery-interaction';
const TAU=Math.PI*2;
export const palette={volcanic:{side:'#262124',paper:'#393034',ink:'#ffdaab',trim:'#fa682d'},space:{side:'#242540',paper:'#303850',ink:'#d4efff',trim:'#6bbcea'},roots:{side:'#453826',paper:'#e7ebd4',ink:'#273c2c',trim:'#789052'},brooklyn:{side:'#653c30',paper:'#f0e6cf',ink:'#302922',trim:'#b19a75'},steampunk:{side:'#343130',paper:'#dfcaa2',ink:'#49351f',trim:'#c29656'}};
function mesh(parent:T.Object3D,g:T.BufferGeometry,m:T.Material|T.Material[],x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function rounded(w:number,h:number,r:number){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function slab(parent:T.Object3D,w:number,h:number,depth:number,color:string,metal=false){const geo=new T.ExtrudeGeometry(rounded(w,h,.12),{depth,bevelEnabled:true,bevelThickness:.05,bevelSize:.045,bevelSegments:2,steps:1,curveSegments:5});geo.translate(0,0,-depth/2);return mesh(parent,geo,new T.MeshStandardMaterial({color,roughness:metal?.36:.85,metalness:metal?.7:0}));}
function canvasTexture(w:number,h:number,paint:(ctx:CanvasRenderingContext2D)=>void){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d')!);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=2;return t;}
function printed(parent:T.Object3D,texture:T.Texture,w:number,h:number,x:number,y:number,z:number){return mesh(parent,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,transparent:true}),x,y,z);}
function label(parent:T.Object3D,font:Font,text:string,size:number,maxWidth:number,color:string,x:number,y:number,z:number,depth=.045){const geo=new TextGeometry(text,{font,size,depth,curveSegments:3,bevelEnabled:true,bevelThickness:.006,bevelSize:.003,bevelSegments:1});geo.computeBoundingBox();const width=geo.boundingBox!.max.x-geo.boundingBox!.min.x;const m=mesh(parent,geo,new T.MeshStandardMaterial({color,roughness:.52,metalness:.15}),x,y,z);if(width>maxWidth)m.scale.x=maxWidth/width;m.userData.label={size,maxWidth,depth};return m;}
function line(points:number[][],radius:number){return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),18,radius,5,false);}
function cog(parent:T.Object3D,x:number,y:number,z:number,r:number,material:T.Material){const g=new T.Group();g.position.set(x,y,z);parent.add(g);const s=new T.Shape();for(let i=0;i<=64;i++){const a=i/64*TAU,rr=r*(i%4===1||i%4===2?1:.84);if(i===0)s.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else s.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}const hole=new T.Path();hole.absarc(0,0,r*.51,0,TAU,true);s.holes.push(hole);mesh(g,new T.ExtrudeGeometry(s,{depth:.1,bevelEnabled:false,curveSegments:16}),material);mesh(g,new T.TorusGeometry(r*.18,.035,5,12),material,0,0,.06);for(let i=0;i<3;i++){const b=mesh(g,new T.BoxGeometry(r*1.3,.045,.08),material,0,0,.06);b.rotation.z=i*Math.PI/3;}return g;}

function tileImage(p:Project,wake:()=>void):T.Texture {
  if(!p.kind)return new T.TextureLoader().load(p.image,wake);
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=426;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#29393d';ctx.fillRect(0,0,720,426);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const image=new Image();image.crossOrigin='anonymous';
  const obscured=p.kind==='soon'||p.dataState==='loading'||p.dataState==='error'||p.imageAvailable===false;
  image.onload=()=>{
    ctx.fillStyle='#253138';ctx.fillRect(0,0,720,426);
    const scale=(obscured?Math.max(720/image.width,426/image.height)*1.15:Math.min(720/image.width,426/image.height));
    ctx.filter=obscured?'blur(22px)':'none';ctx.drawImage(image,(720-image.width*scale)/2,(426-image.height*scale)/2,image.width*scale,image.height*scale);ctx.filter='none';
    if(obscured){ctx.fillStyle='#101e2866';ctx.fillRect(0,0,720,426);}texture.needsUpdate=true;wake();
  };
  image.onerror=()=>{texture.userData={failed:true};ctx.fillStyle='#34454c';ctx.fillRect(0,0,720,426);texture.needsUpdate=true;wake();};image.src=p.image;
  return texture;
}
function tokenOverlay(p:Project){return p.kind==='soon'?'SOON':p.dataState==='loading'?'LOADING':p.dataState==='error'?'RETRY':p.imageAvailable===false?'N/A':'';}
function centerOverlay(m:T.Mesh){m.geometry.computeBoundingBox();const box=m.geometry.boundingBox!;m.position.x=-(box.max.x-box.min.x)*m.scale.x/2;}
function changeLabel(parent:T.Group,name:string,text:string,font:Font,color?:string){
  const m=parent.getObjectByName(name) as T.Mesh|undefined;if(!m)return;
  const {size,maxWidth,depth}=m.userData.label;
  m.geometry.dispose();m.geometry=new TextGeometry(text||' ',{font,size,depth,curveSegments:3,bevelEnabled:true,bevelThickness:.006,bevelSize:.003,bevelSegments:1});m.geometry.computeBoundingBox();
  const box=m.geometry.boundingBox!;m.scale.x=Math.min(1,maxWidth/Math.max(.001,box.max.x-box.min.x));
  if(color)(m.material as T.MeshStandardMaterial).color.set(color);
}
function renderDescription(parent:T.Group,text:string,font:Font,color:string){
  let group=parent.getObjectByName('project-description') as T.Group|undefined;
  if(!group){group=new T.Group();group.name='project-description';parent.add(group);}
  group.children.slice().forEach(child=>{const m=child as T.Mesh;m.geometry.dispose();(m.material as T.Material).dispose();group!.remove(child);});
  const lines:string[]=[];let current='';
  for(const word of text.split(' ')){if((current+word).length>38&&current){lines.push(current.trim());current='';}current+=word+' ';}
  if(current.trim())lines.push(current.trim());
  lines.slice(0,3).forEach((line,i)=>label(group!,font,line,.155,4,color,-2,-1.11-i*.24,.63,.019));
}
function updateTile(tile:Tile,p:Project,font:Font,theme:Theme,wake:()=>void){
  const old=tile.project,ink=palette[theme].ink;
  for(const [key,text] of Object.entries({'project-name':p.name,'project-cap':p.cap,'project-ticker':p.ticker==='N/A'?'N/A':'$'+p.ticker,'project-change':p.change,'project-category':p.category.toUpperCase(),'project-roof-ticker':p.ticker,'project-price':p.price??'N/A','project-volume':p.volume??'N/A'}))changeLabel(tile.group,key,text,font,key==='project-change'?(p.change.startsWith('-')?'#a34137':p.change==='N/A'?ink:'#51734b'):undefined);
  if(!p.kind&&p.description!==old.description)renderDescription(tile.group,p.description,font,ink);
  if(p.image!==old.image||tokenOverlay(p)!==tokenOverlay(old)||tile.imageTexture.userData.failed){
    tile.imageTexture.dispose();tile.imageTexture=tileImage(p,wake);tile.imageMaterial.map=tile.imageTexture;
  }
  changeLabel(tile.group,'token-overlay',tokenOverlay(p)||'N/A',font);
  const overlay=tile.group.getObjectByName('token-overlay') as T.Mesh|undefined;if(overlay){overlay.visible=!!tokenOverlay(p);centerOverlay(overlay);}
  tile.group.children.forEach(child=>{
    if(child.name==='social-x-icon')child.visible=!p.kind||!!p.x;
    if(child.name==='social-telegram-icon')child.visible=!p.kind||!!p.telegram;
    if(child.name==='social-x-na')child.visible=!p.x;
    if(child.name==='social-telegram-na')child.visible=!p.telegram;
    if(child.name==='project-website')child.visible=!!p.website;
  });
  tile.project=p;wake();
}
export interface Tile {scene:T.Scene;camera:T.PerspectiveCamera;group:T.Group;article:HTMLElement;project:Project;imageMaterial:T.MeshBasicMaterial;imageTexture:T.Texture;videoTexture:T.VideoTexture|null;video:HTMLVideoElement|null;statusTexture:T.Texture;statusMaterial:T.MeshBasicMaterial;status:string;statusLabel:T.Mesh;animate:Array<(t:number)=>void>;hover:boolean;hoverProgress:number;baseY:number;bounds:T.Box3;}
export function makeTile(article:HTMLElement,p:Project,index:number,theme:Theme,font:Font,wake:()=>void):Tile{
  const colors=palette[theme],scene=new T.Scene(),camera=new T.PerspectiveCamera(46,1,.1,30);camera.position.set(0,.12,10.4);camera.lookAt(0,.12,0);
  scene.add(new T.HemisphereLight('#fff7e5','#5d625c',2.4));const light=new T.DirectionalLight('#ffe6ba',3);light.position.set(-3,5,6);scene.add(light);const rim=new T.DirectionalLight('#e1f3ed',1.9);rim.position.set(4,-1,2);scene.add(rim);
  const group=new T.Group();scene.add(group);const animate:Array<(t:number)=>void>=[];
  if(theme!=='brooklyn'){const board=slab(group,4.8,5.8,theme==='steampunk'?1.06:1.12,colors.side,theme==='steampunk');board.position.z=-.15;}
  const face=slab(group,4.5,5.5,.1,colors.paper);face.position.z=.47;
  // Four raised rails make the screen visibly inset in a solid front frame.
  const railMat=new T.MeshStandardMaterial({color:colors.trim,roughness:theme==='steampunk'?.34:.8,metalness:theme==='steampunk'?.65:0});
  for(const x of [-2.22,2.22])mesh(group,new T.BoxGeometry(.09,2.7,.17),railMat,x,1.27,.57);
  for(const y of [-.07,2.61])mesh(group,new T.BoxGeometry(4.52,.09,.17),railMat,0,y,.57);
  const imageTexture=tileImage(p,wake);imageTexture.colorSpace=T.SRGBColorSpace;
  const imageMaterial=new T.MeshBasicMaterial({map:imageTexture});mesh(group,new T.PlaneGeometry(4.35,2.57),imageMaterial,0,1.27,.585).name='media-screen';
  // All printed details sit on the model's face. Titles and caps are separately extruded.
  const info=canvasTexture(1024,610,ctx=>{
    ctx.fillStyle=colors.paper;ctx.fillRect(0,0,1024,610);ctx.fillStyle=colors.ink;
    ctx.font='500 26px sans-serif';ctx.globalAlpha=.67;ctx.fillText('$'+p.ticker,207,156);ctx.globalAlpha=1;
    ctx.font=theme==='brooklyn'?'32px Georgia':'29px sans-serif';
    const words=p.description.split(' ');let lineText='',y=232;for(const word of words){const test=lineText+word+' ';if(ctx.measureText(test).width>905){ctx.fillText(lineText,40,y);lineText=word+' ';y+=41;}else lineText=test;}ctx.fillText(lineText,40,y);
    ctx.strokeStyle=theme==='steampunk'?'#a98b58':'#b2baa3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(40,346);ctx.lineTo(984,346);ctx.stroke();
    ctx.globalAlpha=.7;ctx.font='27px sans-serif';ctx.fillText('MARKET CAP',40,400);ctx.globalAlpha=1;
    ctx.fillStyle=theme==='steampunk'?'#567047':'#4c784f';ctx.font='500 28px sans-serif';ctx.fillText('↗ '+p.change,374,496);ctx.font='23px sans-serif';ctx.globalAlpha=.6;ctx.fillText('24h',374,530);ctx.globalAlpha=1;
    ctx.fillStyle=colors.ink;ctx.strokeStyle='#8f9b8766';
    for(const x of [807,934]){ctx.beginPath();ctx.arc(x,480,40,0,TAU);ctx.stroke();}
    ctx.font='36px sans-serif';ctx.textAlign='center';ctx.fillText('𝕏',807,493);ctx.font='33px sans-serif';ctx.fillText('➤',934,492);
    if(theme==='brooklyn'){ctx.globalAlpha=.09;ctx.fillStyle='#43361c';for(let y=0;y<610;y+=5)ctx.fillRect(0,y,1024,1);}
  });printed(group,info,4.35,2.59,0,-1.42,.588).name='info-face';
  const medallion=mesh(group,new T.CylinderGeometry(.32,.32,.11,theme==='steampunk'?32:12),new T.MeshStandardMaterial({color:p.color,roughness:.5,metalness:.2}),-1.67,-.51,.66);medallion.rotation.x=Math.PI/2;
  const symbol=canvasTexture(128,128,ctx=>{ctx.fillStyle=colors.ink;ctx.font='80px sans-serif';ctx.textAlign='center';ctx.fillText(p.icon,64,94);});printed(group,symbol,.5,.5,-1.67,-.51,.725).name='symbol-face';
  label(group,font,p.name,p.kind?.23:.265,p.kind?3.02:3.2,colors.ink,-1.14,-.5,.63,.055).name='project-name';
  label(group,font,p.cap,p.kind?.30:.36,p.kind?1.92:1.55,colors.ink,-2,p.kind?-2.04:-2.34,.64,.065).name='project-cap';
  const chip=canvasTexture(768,94,ctx=>{ctx.fillStyle=theme==='brooklyn'?'#dcec83':'#15261fea';ctx.fillRect(0,0,768,94);ctx.fillStyle=theme==='brooklyn'?'#283628':'#e9efda';ctx.font='27px sans-serif';ctx.fillText(p.category.toUpperCase(),25,61);if(p.featured){ctx.textAlign='right';ctx.fillText('↗ FEATURED',740,61);}});printed(group,chip,4.18,.51,0,2.24,.62).name='category-face';
  const makeStatus=(status:string)=>canvasTexture(768,80,ctx=>{ctx.fillStyle='#14271edf';ctx.fillRect(0,0,768,80);ctx.fillStyle='#eaf0df';ctx.font='26px sans-serif';ctx.fillText(status,24,53);ctx.textAlign='right';ctx.fillText('↗',740,53);});
  const statusTexture=makeStatus('▷  DISCOVER '+p.name.toUpperCase());const statusMaterial=new T.MeshBasicMaterial({map:statusTexture,transparent:true});mesh(group,new T.PlaneGeometry(4.18,.435),statusMaterial,0,.232,.625).name='status-face';
  // Every visible word is now extruded geometry, including the small captions.
  const infoFace=group.getObjectByName('info-face') as T.Mesh;
  infoFace.material=new T.MeshStandardMaterial({color:colors.paper,roughness:.82});
  const symbolFace=group.getObjectByName('symbol-face');if(symbolFace)symbolFace.visible=false;
  const markMaterial=new T.MeshStandardMaterial({color:colors.ink,roughness:.55});
  const mark=mesh(group,new T.TorusGeometry(.15,.022,5,20),markMaterial,-1.67,-.51,.74);
  if(index%2)mark.scale.y=.55;
  const markBar=mesh(group,new T.BoxGeometry(.3,.026,.025),markMaterial,-1.67,-.51,.745);markBar.rotation.z=index*Math.PI/5;
  label(group,font,p.ticker==='N/A'?'N/A':'$'+p.ticker,.12,2.9,colors.ink,-1.14,-.77,.64,.02).name='project-ticker';
  if(p.kind){
    // Two aligned metric columns reserve a separate footer above the site hoarding.
    label(group,font,'PRICE',.105,1.9,colors.ink,-2,-.98,.64,.024);
    label(group,font,p.price??'N/A',.17,1.92,colors.ink,-2,-1.22,.64,.03).name='project-price';
    label(group,font,'VOLUME / 24H',.105,1.68,colors.ink,.30,-.98,.64,.024);
    label(group,font,p.volume??'N/A',.17,1.68,colors.ink,.30,-1.22,.64,.03).name='project-volume';
  }else renderDescription(group,p.description,font,colors.ink);
  mesh(group,new T.BoxGeometry(4.03,.008,.016),railMat,0,p.kind?-1.40:-1.72,.64);
  label(group,font,'MARKET CAP',.105,2,colors.ink,-2,p.kind?-1.63:-1.96,.64,.024);
  label(group,font,p.change,p.kind?.23:.17,p.kind?1.68:1.35,p.change.startsWith('-')?'#a34137':p.change==='N/A'?colors.ink:theme==='volcanic'?'#ffc38c':theme==='space'?'#9feac9':'#51734b',p.kind?.30:-.45,p.kind?-2.01:-2.29,.66,.03).name='project-change';
  label(group,font,p.kind?'CHANGE / 24H':'24h',p.kind?.105:.10,p.kind?1.68:.6,colors.ink,p.kind?.30:-.45,p.kind?-1.63:-2.51,.64,.019);
  const socialY=p.kind?-2.35:-2.29;
  for(const x of [1.23,1.78])mesh(group,new T.TorusGeometry(p.kind?.145:.175,.007,4,24),markMaterial,x,socialY,.66);
  for(const angle of [-Math.PI/4,Math.PI/4]){const icon=mesh(group,new T.BoxGeometry(.21,.022,.028),markMaterial,1.23,socialY,.67);icon.rotation.z=angle;icon.name='social-x-icon';icon.visible=!p.kind||!!p.x;}
  const sendShape=new T.Shape();sendShape.moveTo(-.11,.055);sendShape.lineTo(.12,.1);sendShape.lineTo(.04,-.11);sendShape.lineTo(-.015,-.025);sendShape.closePath();const sendIcon=mesh(group,new T.ExtrudeGeometry(sendShape,{depth:.024,bevelEnabled:false}),markMaterial,1.78,socialY,.66);sendIcon.name='social-telegram-icon';sendIcon.visible=!p.kind||!!p.telegram;
  const categoryFace=group.getObjectByName('category-face') as T.Mesh;categoryFace.material=new T.MeshStandardMaterial({color:theme==='volcanic'?'#482726':theme==='space'?'#263954':'#24382a',roughness:.7});
  label(group,font,p.category.toUpperCase(),.112,2.75,'#e6efdb',-1.95,2.20,.66,.025).name='project-category';
  if(p.featured)label(group,font,'FEATURED',.105,1,'#e4e5a4',1.07,2.20,.66,.025);
  statusMaterial.map=null;statusMaterial.color.set('#182b24');statusMaterial.needsUpdate=true;
  const statusLabel=label(group,font,'PLAY PREVIEW',.12,3.9,'#e7efdc',-1.96,.19,.665,.024);
  const dummy=new T.Object3D();let seed=782+index;const rnd=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  if(theme==='roots'){
    const bark=new T.MeshStandardMaterial({color:'#746347',roughness:.92});const gs:T.BufferGeometry[]=[];
    for(const side of [-1,1]){
      gs.push(line([[side*2.07,-3.24,-.05],[side*2.53,-2.2,.2],[side*2.34,-.7,.59],[side*2.5,.8,.35],[side*2.18,2.45,.5],[side*1.6,2.91,.15]],.1));
      gs.push(line([[side*2.32,.1,.4],[side*2.6,-1.45,.55],[side*2.08,-2.5,.5],[side*1.3,-3.15,.3],[side*1.06,-3.52,.17]],.05));
      gs.push(line([[side*2.37,1.2,.4],[side*2.07,2.25,.62],[side*.9,2.8,.4],[0,2.99,.07]],.067));
    }
    for(let i=0;i<7;i++){const x=-1.5+i*.5;gs.push(line([[x,-2.8,.2],[x+.2,-3.08,.06],[x-.1,-3.45,.13],[x+.18,-3.72+rnd()*.3,-.03]],.028+rnd()*.025));}
    const merged=mergeGeometries(gs);gs.forEach(g=>g.dispose());if(merged)mesh(group,merged,bark);
    const foliage=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({roughness:.9}),64);const c=new T.Color();
    for(let i=0;i<64;i++){const side=i%2?1:-1;dummy.position.set(side*(1.8+rnd()*.8),2.45+rnd()*.65,.12+rnd()*.5);dummy.rotation.set(rnd(),rnd(),rnd());const scale=.12+rnd()*.15;dummy.scale.set(scale*1.4,scale*.48,scale);dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix);c.setHSL(.19+rnd()*.1,.3+rnd()*.25,.25+rnd()*.2);foliage.setColorAt(i,c);}group.add(foliage);
    const leaves=new T.InstancedMesh(new T.SphereGeometry(1,5,3),new T.MeshStandardMaterial({color:'#c9db8b'}),5);group.add(leaves);const origins=Array.from({length:5},()=>[(rnd()-.5)*5.2,rnd()*6-3,rnd()*.5+.6,rnd()*TAU]);animate.push(t=>{foliage.rotation.z=Math.sin(t*.7+index)*.008;origins.forEach(([x,y,z,p],i)=>{dummy.position.set(x+Math.sin(t*.3+p)*.1,((y+3.4-t*.12)%6.8+6.8)%6.8-3.4,z);dummy.rotation.set(t*.4+p,t*.2+p,p);dummy.scale.set(.07,.14,.015);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);});leaves.instanceMatrix.needsUpdate=true;});
  }else if(theme==='brooklyn'){
    constructionTile(group,animate,index);
    label(group,font,'SITE / 0'+(index+1),.13,1.7,'#e9bd69',.12,3.13,.62,.035);
    if(!p.kind)label(group,font,p.ticker,.20,1.8,colors.ink,-1.96,-2.63,.68,.045).name='project-roof-ticker';
  }else if(theme==='steampunk'){
    const brass=new T.MeshStandardMaterial({color:'#d1a56a',metalness:.75,roughness:.31});const copper=new T.MeshStandardMaterial({color:'#966440',metalness:.7,roughness:.4});
    for(const x of [-2.38,2.38])mesh(group,new T.CylinderGeometry(.065,.065,5.5,10),copper,x,0,.58);
    for(const y of [-2.87,2.87]){const pipe=mesh(group,new T.CylinderGeometry(.066,.066,4.65,10),brass,0,y,.57);pipe.rotation.z=Math.PI/2;}
    const bolts=new T.InstancedMesh(new T.SphereGeometry(.06,6,5),brass,32);let n=0;
    for(let i=0;i<8;i++)for(const side of [-1,1]){dummy.position.set(side*2.33,-2.53+i*.72,.7);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,.55);dummy.updateMatrix();bolts.setMatrixAt(n++,dummy.matrix);}
    for(let i=0;i<8;i++)for(const side of [-1,1]){dummy.position.set(-2.06+i*.59,side*2.81,.7);dummy.updateMatrix();bolts.setMatrixAt(n++,dummy.matrix);}group.add(bolts);
    const gears=[cog(group,-2.4,2.76,.54,.47,brass),cog(group,2.35,-2.64,.57,.46,brass),cog(group,-1.79,3.05,.5,.29,copper)];
    const needle=mesh(group,new T.BoxGeometry(.025,.22,.025),copper,2.35,-2.62,.83);const gauge=mesh(group,new T.CircleGeometry(.22,24),new T.MeshBasicMaterial({color:'#e6d8ab'}),2.35,-2.64,.75);gauge.castShadow=false;
    for(const x of [-2.45,2.45]){mesh(group,new T.CylinderGeometry(.115,.115,.7,12),copper,x,3.02,-.04);mesh(group,new T.TorusGeometry(.14,.04,6,16),brass,x,3.33,-.04).rotation.x=Math.PI/2;}
    animate.push(t=>{gears.forEach((g,i)=>g.rotation.z=t*(i%2?-.21:.17)+index);needle.rotation.z=Math.sin(t*.8+index)*.7;});
  }
  if(p.kind){
    const overlay=label(group,font,tokenOverlay(p)||'N/A',.46,3.6,'#fff0d5',-1.45,1.10,.75,.07);overlay.name='token-overlay';overlay.visible=!!tokenOverlay(p);centerOverlay(overlay);
    for(const [kind,x,available] of [['x',1.23,p.x],['telegram',1.78,p.telegram]] as const){const na=label(group,font,'N/A',.075,.24,colors.ink,x-.12,socialY-.025,.70,.02);na.name='social-'+kind+'-na';na.visible=!available;}
    const website=label(group,font,'WEBSITE',.12,1.3,colors.ink,-2,-2.39,.72,.025);website.name='project-website';website.visible=!!p.website;
  }
  addTileWorldDetails(group,theme,animate,index);
  const shadowTex=canvasTexture(128,128,ctx=>{const grad=ctx.createRadialGradient(64,64,10,64,64,64);grad.addColorStop(0,'#0008');grad.addColorStop(1,'#0000');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);});const shadow=printed(scene,shadowTex,6.4,7.5,.2,-.26,-1.1);shadow.castShadow=false;shadow.name='drop-shadow';(shadow.material as T.Material).depthWrite=false;
  const bounds=new T.Box3(new T.Vector3(-2.43,-2.95,theme==='brooklyn'?-1.66:-.76),new T.Vector3(2.43,theme==='brooklyn'?3.72:2.95,.77));
  const baseY=.13;group.rotation.set(.09,baseY,0);
  return {scene,camera,group,article,project:p,imageMaterial,imageTexture,videoTexture:null,video:null,statusTexture,statusMaterial,status:'',statusLabel,animate,hover:false,hoverProgress:0,baseY,bounds};
}
export async function createGallery(container:HTMLDivElement,articles:HTMLElement[],projects:Project[],theme:Theme,onReady:()=>void,{displayScale=1,cursorTilt=false}:{displayScale?:number;cursorTilt?:boolean}={}){
  const font=await new FontLoader().loadAsync('/fonts/helvetiker.json');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio,window.innerWidth<650?1.1:1.4));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.setClearColor(0,0);renderer.autoClear=false;container.appendChild(renderer.domElement);
  let frame=0,elapsed=0,last=0,motion=true,disposed=false;const tiles:Tile[]=[];const cleanups:Array<()=>void>=[];
  function wake(){if(disposed||frame)return;frame=requestAnimationFrame(render);}
  articles.forEach((article,index)=>tiles.push(makeTile(article,projects[index],index,theme,font,wake)));
  let pointer:Pointer|null=null, active=-1, keyboard=-1;
  let cursorX=0,cursorY=0;
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
    const token=!!tiles[hit.index].project.kind;
    const footer=hit.point.y < -2.14 && hit.point.y > -2.57;
    const website=tiles[hit.index].project.website && footer && hit.point.x > -2.08 && hit.point.x < -.55;
    if(website){article.querySelector<HTMLElement>('.token-website')?.click();return;}
    const social=(token?footer:hit.point.y < -1.98 && hit.point.y > -2.61) && hit.point.x > .99;
    const control=social?article.querySelectorAll<HTMLElement>('.social-links a,.social-links button')[hit.point.x>1.5?1:0]:article.querySelector<HTMLElement>('.project-media');
    control?.click();
  };
  const down=(event:PointerEvent)=>{
    if(event.pointerType!=='mouse'){pointer=null;active=keyboard=-1;wake();}
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
  function render(now:number){frame=0;if(disposed||document.hidden)return;const dt=Math.min((now-last)/1000,.04);last=now;if(motion)elapsed+=dt;const width=window.innerWidth,height=window.innerHeight;const rects=tiles.map(t=>t.article.getBoundingClientRect());renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);visibleCount=0;let activeVideo=false,settling=false;
    const cursorTarget=cursorTiltTarget(cursorTilt&&motion?pointer:null,width,height);
    const cursorEase=1-Math.exp(-dt*8);
    cursorX+=(cursorTarget.x-cursorX)*cursorEase;cursorY+=(cursorTarget.y-cursorY)*cursorEase;
    if(Math.abs(cursorTarget.x-cursorX)>.0001||Math.abs(cursorTarget.y-cursorY)>.0001)settling=true;
    views=tiles.map((tile,index)=>{
      const r=rects[index];
      if(r.bottom < -r.height*.4 || r.top > height+r.height*.4)return null;
      const angle=T.MathUtils.clamp((r.top+r.height/2-height*.58)/(height*.88),-1.1,1.1);
      const expansion=1.7,bend=(Math.sin(angle)*height*.88-(r.top+r.height/2-height*.58))*.7;
      const viewport={left:r.left-r.width*(expansion-1)/2,top:r.top-r.height*(expansion-1)/2+bend,width:r.width*expansion,height:r.height*expansion};
      tile.camera.aspect=r.width/r.height;tile.camera.zoom=displayScale/expansion;tile.camera.updateProjectionMatrix();
      return {group:tile.group,camera:tile.camera,viewport,bounds:tile.bounds};
    });
    active=keyboard>=0?keyboard:(pickObject(pointer,views,active)?.index??-1);
    document.body.style.cursor=active>=0?'pointer':'';
    tiles.forEach((tile,index)=>{tile.hover=index===active;tile.article.dataset.hovered=String(tile.hover);});
    const order=tiles.map((tile,index)=>({tile,index})).sort((a,b)=>Number(a.tile.hover)-Number(b.tile.hover));order.forEach(({tile,index})=>{
      const r=rects[index],view=views[index];if(!view)return;
      tile.article.dataset.wheelActive='true';tile.article.inert=false;visibleCount++;
      const video=tile.article.querySelector('video');if(video!==tile.video){tile.videoTexture?.dispose();tile.videoTexture=null;tile.video=video;if(video){tile.videoTexture=new T.VideoTexture(video);tile.videoTexture.colorSpace=T.SRGBColorSpace;}}
      const videoReady=tile.video&&tile.video.readyState>=2&&!tile.video.error&&tile.article.dataset.videoError!=='true';tile.imageMaterial.map=videoReady?tile.videoTexture:tile.imageTexture;
      if(tile.video&&!tile.video.paused)activeVideo=true;
      const p=tile.project;const overlay=tile.group.getObjectByName('token-overlay') as T.Mesh|undefined;if(overlay){overlay.visible=!!tokenOverlay(p)||tile.article.dataset.imageError==='true';}
      const state=p.kind?(p.kind==='soon'?'SOON':p.dataState==='loading'?'LOADING TOKEN DATA':p.dataState==='error'?'RETRY TOKEN DATA':p.dataState==='stale'?'VIEW ON PUMP.FUN / CACHED':'VIEW ON PUMP.FUN'):tile.article.dataset.videoError==='true'?'↻ PREVIEW UNAVAILABLE · RETRY':tile.article.dataset.busy==='true'?'◌ OPENING A NEW PERSPECTIVE':videoReady?'Ⅱ PLAYING PREVIEW · TAP TO STOP':'▷ DISCOVER '+tile.project.name.toUpperCase();
      if(state!==tile.status){tile.status=state;tile.statusLabel.geometry.dispose();const text=state.replace('↻','RETRY').replace('◌','...').replace('Ⅱ','II').replace('▷','PLAY').replace('·','/');const geometry=new TextGeometry(text,{font,size:.115,depth:.024,curveSegments:2,bevelEnabled:false});geometry.computeBoundingBox();tile.statusLabel.geometry=geometry;tile.statusLabel.scale.x=Math.min(1,3.96/(geometry.boundingBox!.max.x-geometry.boundingBox!.min.x));}

      const scrollAngle=T.MathUtils.clamp((r.top+r.height/2-height*.58)/(height*.88),-1.1,1.1);
      const ease=1-Math.exp(-dt*13),target=tile.hover?1:0;
      tile.hoverProgress+=(target-tile.hoverProgress)*ease;
      if(Math.abs(target-tile.hoverProgress)<.0001)tile.hoverProgress=target;
      const progress=tile.hoverProgress,restZ=-(1-Math.cos(scrollAngle))*4.8;
      const pose=hoverPose(restZ,progress);
      const tx=scrollAngle*.88*(1-progress)+cursorX,ty=tile.baseY*(1-progress)+cursorY;
      if(Math.abs(target-progress)>.0001||Math.abs(tile.group.rotation.x-tx)>.001)settling=true;
      tile.group.rotation.set(tx,ty,0);tile.group.position.set(0,0,pose.z);tile.group.scale.setScalar(pose.scale);
      tile.animate.forEach(fn=>fn(elapsed));tile.camera.position.set(0,.12,CAMERA_Z);tile.camera.lookAt(0,.12,0);
      const expanded=view.viewport,right=expanded.left+expanded.width,bottom=expanded.top+expanded.height;
      renderer.setViewport(expanded.left,height-expanded.top-expanded.height,expanded.width,expanded.height);
      renderer.setScissor(Math.max(0,expanded.left),Math.max(0,height-bottom),Math.max(0,Math.min(right,width)-Math.max(0,expanded.left)),Math.max(0,Math.min(bottom,height)-Math.max(0,expanded.top)));
      renderer.clearDepth();renderer.render(tile.scene,tile.camera);
    });
    if(visibleCount&&(motion||activeVideo||settling))frame=requestAnimationFrame(render);
  }
  function resize(){renderer.setSize(window.innerWidth,window.innerHeight,false);wake();}
  const observer=new ResizeObserver(resize);articles.forEach(a=>observer.observe(a));window.addEventListener('scroll',wake,{passive:true});window.addEventListener('resize',resize);document.addEventListener('visibilitychange',wake);
  const changes=new MutationObserver(wake);articles.forEach(a=>changes.observe(a,{attributes:true,attributeFilter:['data-selected','data-busy','data-video-error','data-image-error'],childList:true,subtree:true}));
  const contextLost=(event:Event)=>{event.preventDefault();container.dispatchEvent(new CustomEvent('gallery-error'));};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  resize();render(performance.now());onReady();
  return {setProjects(next:Project[]){if(disposed)return;tiles.forEach(tile=>{const p=next.find(p=>p.id===tile.project.id);if(p&&p!==tile.project)updateTile(tile,p,font,theme,wake);});wake();},setMotion(value:boolean){motion=value;wake();},dispose(){disposed=true;cancelAnimationFrame(frame);cleanups.forEach(f=>f());observer.disconnect();changes.disconnect();window.removeEventListener('scroll',wake);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',wake);renderer.domElement.removeEventListener('webglcontextlost',contextLost);const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();tiles.forEach(tile=>{tile.videoTexture?.dispose();textures.add(tile.imageTexture);textures.add(tile.statusTexture);tile.scene.traverse(o=>{const m=o as T.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>{materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);});});});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
