import * as T from 'three';
import { roots, brooklyn, steampunk, gear } from './three-world';
import type { Theme } from './projects';
const TAU=Math.PI*2;
function add(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0){const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
export function makeWorld(theme:Theme){
  const group=new T.Group(),animate:Array<(t:number)=>void>=[];let seed=743;const rnd=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  if(theme==='roots')roots(group,animate,rnd);else if(theme==='brooklyn')brooklyn(group,animate,rnd);else if(theme==='steampunk'){steampunk(group,animate,rnd);populateWorkshop(group,animate,rnd);}
  else if(theme==='volcanic'){
    const basalt=new T.MeshStandardMaterial({color:'#282328',roughness:1,flatShading:true});
    const lava=new T.MeshStandardMaterial({color:'#ff831e',emissive:'#ff4816',emissiveIntensity:2.5,roughness:.35});
    add(group,new T.CylinderGeometry(2.4,2.1,.35,28),basalt,0,-1.5,0);
    const cone=new T.CylinderGeometry(.48,2,2.5,20,6,true);const positions=cone.attributes.position;
    for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setXYZ(i,x+(rnd()-.5)*.13,positions.getY(i)+(rnd()-.5)*.11,z+(rnd()-.5)*.13);}cone.computeVertexNormals();add(group,cone,basalt,0,-.05,0);
    add(group,new T.TorusGeometry(.48,.12,8,32),basalt,0,1.19,0).rotation.x=Math.PI/2;
    add(group,new T.CircleGeometry(.42,32),lava,0,1.13,0).rotation.x=-Math.PI/2;
    for(let i=0;i<8;i++){const a=i/8*TAU;const curve=new T.CatmullRomCurve3([new T.Vector3(Math.cos(a)*.46,1.2,Math.sin(a)*.46),new T.Vector3(Math.cos(a+.07)*.85,.6,Math.sin(a+.07)*.85),new T.Vector3(Math.cos(a-.1)*1.4,-.45,Math.sin(a-.1)*1.4),new T.Vector3(Math.cos(a)*2,-1.3,Math.sin(a)*2)]);add(group,new T.TubeGeometry(curve,28,.04+rnd()*.03,5,false),lava);}
    const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),lava,42),dummy=new T.Object3D();group.add(rocks);const bursts=Array.from({length:42},()=>[rnd()*TAU,rnd()*3,.4+rnd()*.8,.035+rnd()*.055]);
    animate.push(t=>{bursts.forEach(([a,power,speed,s],i)=>{const age=(t*speed+power)%2.4;dummy.position.set(Math.cos(a)*age*.7,1.2+age*2.7-age*age*1.7,Math.sin(a)*age*.7);dummy.rotation.set(t*speed,a,t);dummy.scale.setScalar(s);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);});rocks.instanceMatrix.needsUpdate=true;lava.emissiveIntensity=2+Math.sin(t*2)*.7;});
    const glow=new T.PointLight('#ff5924',25,9,2);glow.position.y=1.6;group.add(glow);
  }else{
    populateNebula(group,animate,rnd);
  }
  return {group,animate};
}
export function addTileWorldDetails(group:T.Group,theme:Theme,animate:Array<(t:number)=>void>,index:number){
  if(theme==='volcanic'){
    const rock=new T.MeshStandardMaterial({color:'#27222b',flatShading:true,roughness:.95}),glow=new T.MeshStandardMaterial({color:'#ffb346',emissive:'#f74b17',emissiveIntensity:1.5,roughness:.4});
    for(let i=0;i<22;i++){const side=i%2?1:-1;const stone=add(group,new T.DodecahedronGeometry(.22+(i%3)*.035,0),rock,side*2.45,-2.7+Math.floor(i/2)*.54,.43);stone.scale.set(.75,1.3,1);stone.rotation.set(i*.2,i*.3,i*.1);}
    for(const side of [-1,1]){const curve=new T.CatmullRomCurve3([new T.Vector3(side*2.35,2.9,.55),new T.Vector3(side*2.46,1.4,.68),new T.Vector3(side*2.33,.2,.61),new T.Vector3(side*2.43,-1.5,.59),new T.Vector3(side*2.27,-2.9,.5)]);add(group,new T.TubeGeometry(curve,36,.04,5,false),glow);}
    const peak=add(group,new T.ConeGeometry(.47,.8,9),rock,-1.7,3.18,.08);peak.rotation.z=.15;
    const ember=add(group,new T.IcosahedronGeometry(.09,0),glow,-1.7,3.55,.1);
    animate.push(t=>{glow.emissiveIntensity=1.4+Math.sin(t*1.7+index)*.6;ember.position.y=3.5+((t*.65+index)%1.4);ember.scale.setScalar(1-((t*.65+index)%1.4)/1.4);});
  }
  if(theme==='space'){
    const chrome=new T.MeshStandardMaterial({color:'#739ebc',metalness:.8,roughness:.25}),glow=new T.MeshStandardMaterial({color:'#c0eaff',emissive:'#467ad1',emissiveIntensity:1.6});
    for(const x of [-2.4,2.4])add(group,new T.BoxGeometry(.045,5.65,.05),glow,x,0,.62);
    for(const y of [-2.9,2.9])add(group,new T.BoxGeometry(4.72,.045,.05),glow,0,y,.62);
    for(const x of [-2.36,2.36])for(const y of [-2.75,2.75])add(group,new T.IcosahedronGeometry(.21,1),chrome,x,y,.58);
    const orbit=add(group,new T.TorusGeometry(.52,.021,6,40),glow,1.6,3.07,.05);orbit.rotation.x=.6;
    const satellite=add(group,new T.IcosahedronGeometry(.13,1),chrome,0,0,0);animate.push(t=>{orbit.rotation.y=t*.25;satellite.position.set(1.6+Math.cos(t*.65+index)*.62,3.07+Math.sin(t*.65+index)*.34,.05+Math.sin(t*.65+index)*.4);glow.emissiveIntensity=1.3+Math.sin(t+index)*.3;});
  }
}


function populateWorkshop(group:T.Group,animate:Array<(t:number)=>void>,rnd:()=>number){
 const iron=new T.MeshStandardMaterial({color:'#27241f',metalness:.55,roughness:.58}),brass=new T.MeshStandardMaterial({color:'#987347',metalness:.72,roughness:.4}),copper=new T.MeshStandardMaterial({color:'#764630',metalness:.65,roughness:.48}),wood=new T.MeshStandardMaterial({color:'#39281e',roughness:.9}),lamp=new T.MeshStandardMaterial({color:'#ffcb78',emissive:'#ee973c',emissiveIntensity:2.2});
 add(group,new T.BoxGeometry(25,.25,20),wood,0,-2.35,-3);
 add(group,new T.BoxGeometry(24,12,.35),iron,0,3,-7);
 for(let i=0;i<13;i++){add(group,new T.BoxGeometry(.11,11,.15),brass,-11+i*1.8,3,-6.74);add(group,new T.BoxGeometry(24,.08,.12),copper,0,-1.8+i*.82,-6.72);}
 const bgGears:T.Group[]=[];
 [[-6,2.8,2.25],[-3.35,4.25,1.35],[5.9,3.2,1.9],[3.45,4.3,1.13],[-7.8,5.4,.9]].forEach(([x,y,r],i)=>{const g=gear(r,Math.round(r*13+12),i%2?copper:brass);g.position.set(x,y,-6.23);group.add(g);bgGears.push(g);});
 // Two deep workbenches, shelves of instruments, and immense pressure boilers.
 for(const side of [-1,1]){
  add(group,new T.BoxGeometry(5,.27,2.5),wood,side*5.4,-.8,-2.6);
  for(const x of [side*3.4,side*7.4])for(const z of [-3.4,-1.8])add(group,new T.BoxGeometry(.15,1.5,.15),iron,x,-1.6,z);
  add(group,new T.CylinderGeometry(.82,.88,3.8,24),copper,side*8.8,-.15,-4.5);
  for(const y of [-1.7,-.25,1.35])add(group,new T.TorusGeometry(.88,.065,7,40),brass,side*8.8,y,-4.5).rotation.x=Math.PI/2;
  add(group,new T.SphereGeometry(.86,24,12,0,TAU,0,Math.PI/2),copper,side*8.8,1.75,-4.5);
  const route=[new T.Vector3(side*8.8,2.5,-4.5),new T.Vector3(side*8.8,5.8,-4.5),new T.Vector3(side*5.7,6.2,-4.8),new T.Vector3(side*3.2,5.5,-6.3)];add(group,new T.TubeGeometry(new T.CatmullRomCurve3(route),40,.12,8,false),brass);
  for(let shelf=0;shelf<3;shelf++){add(group,new T.BoxGeometry(4.5,.12,.85),wood,side*4.8,.4+shelf*1.1,-5.9);for(let j=0;j<5;j++){const x=side*3.2+side*j*.73,h=.3+rnd()*.5;add(group,new T.CylinderGeometry(.13,.17,h,10),j%2?copper:brass,x,.6+shelf*1.1+h/2,-5.85);add(group,new T.SphereGeometry(.095,8,6),lamp,x,.7+shelf*1.1+h,-5.85);}}
  for(let j=0;j<4;j++){const x=side*(3.5+j*.9);add(group,new T.CylinderGeometry(.11,.11,.7+j*.07,10),brass,x,-.32,-2.4);add(group,new T.SphereGeometry(.13,10,8),lamp,x,.1+j*.08,-2.4);}
 }
 const gauges:T.Mesh[]=[];
 for(let i=0;i<4;i++){const x=-1.8+i*1.2;add(group,new T.CylinderGeometry(.25,.25,.12,24),brass,x,3.9,-6.23).rotation.x=Math.PI/2;add(group,new T.CircleGeometry(.2,24),new T.MeshBasicMaterial({color:'#d7c092'}),x,3.9,-6.14);const needle=add(group,new T.BoxGeometry(.018,.19,.025),iron,x,3.95,-6.1);gauges.push(needle);}
 for(let i=0;i<5;i++){const x=-8+i*4;add(group,new T.CylinderGeometry(.012,.012,2.3,5),iron,x,6.35,-2);add(group,new T.ConeGeometry(.36,.28,18,1,true),brass,x,5.2,-2);add(group,new T.SphereGeometry(.11,10,8),lamp,x,5.07,-2);}
 const workshopLight=new T.PointLight('#f1a052',28,17,2);workshopLight.position.set(-5,3,-2);group.add(workshopLight);
 const smokePositions=new Float32Array(160*3);for(let i=0;i<160;i++){smokePositions[i*3]=(i%2?1:-1)*8.8+(rnd()-.5)*.9;smokePositions[i*3+1]=rnd()*5+2;smokePositions[i*3+2]=-4.5+(rnd()-.5)*.9;}
 const smokeGeometry=new T.BufferGeometry();smokeGeometry.setAttribute('position',new T.BufferAttribute(smokePositions,3));
 const steam=new T.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,vertexShader:'uniform float time;varying float a;void main(){vec3 p=position;p.y=2.+mod(position.y+time*.45,5.);p.x+=sin(p.y+time*.3)*.14;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(160./-mv.z,1.,22.);a=(7.-p.y)/5.;}',fragmentShader:'varying float a;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.68,.61,.5,(1.-smoothstep(0.,.5,d))*.07*a);}'});group.add(new T.Points(smokeGeometry,steam));
 animate.push(t=>{bgGears.forEach((g,i)=>g.rotation.z=t*(i%2?-.025:.017));gauges.forEach((g,i)=>g.rotation.z=Math.sin(t*.65+i)*1.1);steam.uniforms.time.value=t;workshopLight.intensity=27+Math.sin(t*.7)*1.5;});
}

function populateNebula(group:T.Group,animate:Array<(t:number)=>void>,rnd:()=>number){
 const count=4200,positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),color=new T.Color();
 for(let i=0;i<count;i++){
  const arm=i%3,a=rnd()*Math.PI*3.6+arm*2.1,r=.8+(a-arm*2.1)/(Math.PI*3.6)*9.5+(rnd()-.5)*1.8,spread=(rnd()-.5)*(1.5+r*.16);
  positions[i*3]=Math.cos(a)*r+spread;positions[i*3+1]=Math.sin(a)*r*.58+spread*.7;positions[i*3+2]=-2.5+Math.sin(a*1.6)*1.6+(rnd()-.5)*3;
  const hue=arm===0?.56+rnd()*.07:arm===1?.71+rnd()*.08:.86+rnd()*.055;color.setHSL(hue,.5+rnd()*.3,.35+rnd()*.25);colors.set([color.r,color.g,color.b],i*3);sizes[i]=.5+rnd()*1.5;
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setAttribute('cloudSize',new T.BufferAttribute(sizes,1));
 const material=new T.ShaderMaterial({uniforms:{time:{value:0}},vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:'attribute float cloudSize;uniform float time;varying vec3 c;varying float a;void main(){c=color;vec3 p=position;p.x+=sin(time*.07+p.z)*.2;p.y+=cos(time*.09+p.x*.3)*.12;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(460.*cloudSize/-mv.z,3.,72.);a=.072+sin(position.x*2.+position.y)*.028;}',fragmentShader:'varying vec3 c;varying float a;void main(){float d=length(gl_PointCoord-.5);float glow=exp(-d*d*14.);gl_FragColor=vec4(c,glow*a);}'});
 const nebula=new T.Points(geometry,material);nebula.rotation.z=-.25;group.add(nebula);
 const starCount=2400,starPositions=new Float32Array(starCount*3),starColors=new Float32Array(starCount*3),starSizes=new Float32Array(starCount);
 for(let i=0;i<starCount;i++){starPositions[i*3]=(rnd()-.5)*48;starPositions[i*3+1]=(rnd()-.5)*28;starPositions[i*3+2]=-12+rnd()*18;starSizes[i]=rnd()>.985?5.5:.7+rnd()*1.5;color.setHSL(.52+rnd()*.15,.15+rnd()*.3,.7+rnd()*.3);starColors.set([color.r,color.g,color.b],i*3);}
 const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(starPositions,3));sg.setAttribute('color',new T.BufferAttribute(starColors,3));sg.setAttribute('starSize',new T.BufferAttribute(starSizes,1));
 const sm=new T.ShaderMaterial({uniforms:{time:{value:0}},vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:'attribute float starSize;uniform float time;varying vec3 c;varying float a;void main(){c=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(24.*starSize/-mv.z,1.,15.);a=.6+.4*sin(time*.7+position.x*2.);}',fragmentShader:'varying vec3 c;varying float a;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float core=exp(-d*d*32.);float flare=exp(-abs(p.x)*75.)*exp(-abs(p.y)*8.)+exp(-abs(p.y)*75.)*exp(-abs(p.x)*8.);gl_FragColor=vec4(c,(core+flare*.25)*a);}'});group.add(new T.Points(sg,sm));
 const heads=new T.InstancedMesh(new T.IcosahedronGeometry(.035,0),new T.MeshBasicMaterial({color:'#e7f1ff'}),28);
 const trails=new T.InstancedMesh(new T.ConeGeometry(.023,1.4,4),new T.MeshBasicMaterial({color:'#94b6ff',transparent:true,opacity:.38,depthWrite:false}),28);group.add(heads,trails);const dummy=new T.Object3D();const meteors=Array.from({length:28},()=>[rnd()*24,rnd()*18-8,rnd()*13-7,.2+rnd()*.7,rnd()*12]);
 animate.push(t=>{material.uniforms.time.value=t;sm.uniforms.time.value=t;nebula.rotation.y=Math.sin(t*.025)*.08;meteors.forEach(([x,y,z,speed,phase],i)=>{const progress=(t*speed+phase)%18;const px=13-progress*1.7+x*.12,py=y+6-progress*.9;const scale=Math.sin(progress/18*Math.PI)*(.5+speed);dummy.position.set(px,py,z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(scale);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);dummy.position.set(px+.5*scale,py+.27*scale,z);dummy.rotation.z=-1.06;dummy.scale.set(scale,scale,scale);dummy.updateMatrix();trails.setMatrixAt(i,dummy.matrix);});heads.instanceMatrix.needsUpdate=true;trails.instanceMatrix.needsUpdate=true;});
}
