import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Theme } from './projects';
import { makeWorld } from './theme-worlds';

const TAU = Math.PI * 2;
function seeded() { let seed = 76123; return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }; }
function tube(points: number[][], radius: number, steps = 24) {
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  const g = new T.TubeGeometry(curve, steps, radius, 5, false);
  const pos = g.attributes.position;
  for (let j = 0; j <= steps; j++) {
    const center = curve.getPointAt(j / steps);
    const taper = 1 - j / steps * .9;
    for (let k = 0; k < 6; k++) { const i = j * 6 + k; pos.setXYZ(i, center.x + (pos.getX(i) - center.x) * taper, center.y + (pos.getY(i) - center.y) * taper, center.z + (pos.getZ(i) - center.z) * taper); }
  }
  g.computeVertexNormals(); return g;
}
function addMesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, position = [0, 0, 0]) {
  const mesh = new T.Mesh(geometry, material); mesh.position.set(...position as [number, number, number]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function textTexture(text: string, background: string, foreground: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.font = '900 69px sans-serif';
  text.split('\n').forEach((line, i) => ctx.fillText(line, 256, 110 + i * 79));
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}

function roots(group: T.Group, animate: Array<(t: number) => void>, random: () => number) {
  const bark = new T.MeshStandardMaterial({ color: '#655039', roughness: .93 });
  const moss = new T.MeshStandardMaterial({ color: '#657d38', roughness: 1 });
  const soil = new T.MeshStandardMaterial({ color: '#3b3326', roughness: 1, flatShading: true });
  const island = addMesh(group, new T.IcosahedronGeometry(1.68, 2), soil, [0, -.43, 0]); island.scale.set(1, .44, .85);
  const cap = addMesh(group, new T.SphereGeometry(1.62, 32, 12), moss, [0, -.04, 0]); cap.scale.set(1, .16, .86);
  const stems: T.BufferGeometry[] = [tube([[0,.08,0],[-.23,.7,0],[.17,1.35,.1],[-.11,2.05,0],[.3,2.7,-.1]], .27, 32)];
  const crowns: number[][] = [];
  for (let i = 0; i < 13; i++) {
    const angle = i / 13 * TAU;
    const radius = 1.12 + random() * .58;
    const top = 1.85 + random() * .85;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius * .7;
    stems.push(tube([[0,.75+random()*.5,0],[x*.25,1.5,z*.25],[x*.67,top-.1,z*.7],[x,top,z]], .11 + random() * .035));
    crowns.push([x,top+.19,z]);
  }
  crowns.push([.15,2.9,0],[-.4,2.65,.1]);
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * TAU, r = 1.1 + random() * .45;
    stems.push(tube([[Math.cos(a)*.22,.18,Math.sin(a)*.22],[Math.cos(a)*r,-.15,Math.sin(a)*r*.8],[Math.cos(a)*(r*.88),-.95,Math.sin(a)*r*.72],[Math.cos(a+.5)*r*.57,-1.4-random()*1.05,Math.sin(a+.5)*r*.42]], .05+random()*.075));
  }
  const merged = mergeGeometries(stems); stems.forEach(g => g.dispose());
  if (merged) addMesh(group, merged, bark);
  const leafMat = new T.MeshStandardMaterial({ roughness: .88, flatShading: true });
  const foliage = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), leafMat, 470);
  foliage.castShadow = true; foliage.receiveShadow = true;
  const dummy = new T.Object3D(), color = new T.Color();
  for (let i = 0; i < 470; i++) {
    const c = crowns[i % crowns.length], a = random() * TAU, r = Math.sqrt(random()) * .73;
    dummy.position.set(c[0] + Math.cos(a)*r, c[1] + (random()-.5)*.42, c[2] + Math.sin(a)*r*.75);
    dummy.rotation.set(random(),random(),random());
    const s = .1+random()*.2; dummy.scale.set(s*1.5,s*.55,s); dummy.updateMatrix(); foliage.setMatrixAt(i,dummy.matrix);
    color.setHSL(.18 + random()*.12,.28+random()*.22,.21+random()*.23); foliage.setColorAt(i,color);
  }
  group.add(foliage);
  const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), moss, 65);
  rocks.castShadow = true;
  for (let i = 0; i < 65; i++) {
    const a = random()*TAU, r = .4+random()*1.1;
    dummy.position.set(Math.cos(a)*r,.05+random()*.12,Math.sin(a)*r*.8); dummy.rotation.set(random(),random(),random());
    const s=.04+random()*.13; dummy.scale.set(s,s*.8,s); dummy.updateMatrix(); rocks.setMatrixAt(i,dummy.matrix);
  }
  group.add(rocks);
  // Saplings and fern-like clusters at the island's edge.
  const blades = new T.InstancedMesh(new T.ConeGeometry(.045,.36,3), new T.MeshStandardMaterial({color:'#b8c369',roughness:.8}), 48);
  for (let i=0;i<48;i++) { const a=random()*TAU,r=.95+random()*.5; dummy.position.set(Math.cos(a)*r,.2,Math.sin(a)*r*.8); dummy.rotation.set((random()-.5)*.6,a,(random()-.5)*.6); dummy.scale.setScalar(.5+random()*.6); dummy.updateMatrix();blades.setMatrixAt(i,dummy.matrix); }
  group.add(blades);
  const leaves = new T.InstancedMesh(new T.SphereGeometry(1,5,3),new T.MeshStandardMaterial({color:'#bdd385',roughness:.8}),14);
  const origins = Array.from({length:14},()=>[(random()-.5)*5,random()*5-1.5,(random()-.5)*3,random()*TAU]);
  group.add(leaves);
  animate.push(t => { group.position.y = Math.sin(t*.7)*.1; foliage.rotation.z=Math.sin(t*.5)*.008; origins.forEach(([x,y,z,p],i)=>{dummy.position.set(x+Math.sin(t*.3+p)*.2,((y+3-t*.12)%6+6)%6-3,z);dummy.rotation.set(t*.3+p,t*.2+p,p);dummy.scale.set(.07,.14,.014);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);});leaves.instanceMatrix.needsUpdate=true; });
}

function brooklyn(group: T.Group, animate: Array<(t: number) => void>, random: () => number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;ctx.fillStyle='#503d33';ctx.fillRect(0,0,128,128);
  for(let row=0;row<16;row++)for(let col=-1;col<8;col++){ctx.fillStyle=['#975c45','#864c3c','#a56850','#754235'][Math.floor(random()*4)];ctx.fillRect(col*20+(row%2)*10,row*8,18,6);}
  const brickTex=new T.CanvasTexture(canvas);brickTex.colorSpace=T.SRGBColorSpace;brickTex.wrapS=brickTex.wrapT=T.RepeatWrapping;brickTex.repeat.set(2,3);
  const brick=new T.MeshStandardMaterial({map:brickTex,roughness:.98});
  const dark=new T.MeshStandardMaterial({color:'#323b3a',roughness:.8});
  const trim=new T.MeshStandardMaterial({color:'#aa8e70',roughness:.85});
  const road=new T.MeshStandardMaterial({color:'#333632',roughness:1});
  const curb=new T.MeshStandardMaterial({color:'#858477',roughness:1});
  addMesh(group,new T.BoxGeometry(5.7,.3,3.45),dark,[0,-1.7,0]);
  addMesh(group,new T.BoxGeometry(5.55,.08,1),road,[0,-1.51,1.15]);
  addMesh(group,new T.BoxGeometry(5.5,.15,.36),curb,[0,-1.45,.48]);
  const stripe=new T.MeshStandardMaterial({color:'#e5d8ad'});
  for(let i=0;i<8;i++)addMesh(group,new T.BoxGeometry(.09,.012,.5),stripe,[1.9,-1.45,.8+i*.07]);
  const glass=new T.MeshStandardMaterial({color:'#6e9fa0',emissive:'#edb45a',emissiveIntensity:.16,metalness:.45,roughness:.25});
  const windows=new T.InstancedMesh(new T.BoxGeometry(.2,.3,.035),glass,160);
  const dummy=new T.Object3D();let wi=0;
  const buildings=[[-1.85,2.35,1.02],[-.7,3.4,1.05],[.5,2.75,1.1],[1.8,3.8,1.2]];
  buildings.forEach(([x,height,width],index)=>{
    const y=-1.35+height/2;
    addMesh(group,new T.BoxGeometry(width,height,1.34),brick,[x,y,-.35]);
    addMesh(group,new T.BoxGeometry(width+.12,.12,1.46),trim,[x,-1.35+height,-.35]);
    addMesh(group,new T.BoxGeometry(width-.08,.06,1.24),dark,[x,-1.26+height,-.35]);
    for(let row=0;row<Math.floor(height/.5)-1;row++)for(let col=0;col<3;col++){
      dummy.position.set(x+(col-1)*.3,-.73+row*.5,.335);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();windows.setMatrixAt(wi,dummy.matrix);windows.setColorAt(wi++,new T.Color(random()>.55?'#ffcf80':'#507276'));
      if(index===0||index===3){dummy.position.set(x+(index===0?-1:1)*(width/2+.007),-.73+row*.5,-.72+col*.4);dummy.rotation.y=Math.PI/2;dummy.updateMatrix();windows.setMatrixAt(wi,dummy.matrix);windows.setColorAt(wi++,new T.Color('#66898a'));}
    }
    if(index===1||index===3){
      for(let y=-.6;y<height-1.4;y+=.53){addMesh(group,new T.BoxGeometry(.43,.035,.3),dark,[x+.07,y,.51]);for(let k=0;k<4;k++)addMesh(group,new T.BoxGeometry(.015,.22,.015),dark,[x-.12+k*.12,y+.1,.66]);const ladder=addMesh(group,new T.BoxGeometry(.025,.64,.025),dark,[x+.2,y-.27,.62]);ladder.rotation.z=.2;}
    }
  });
  windows.count=wi;windows.instanceMatrix.needsUpdate=true;group.add(windows);
  const wood=new T.MeshStandardMaterial({color:'#8e6841',roughness:.9});
  addMesh(group,new T.CylinderGeometry(.39,.4,.65,20),wood,[1.8,3.12,-.35]);
  addMesh(group,new T.ConeGeometry(.45,.26,20),dark,[1.8,3.57,-.35]);
  for(let i=0;i<4;i++){const a=i/4*TAU+Math.PI/4;addMesh(group,new T.CylinderGeometry(.026,.026,.55,5),dark,[1.8+Math.cos(a)*.3,2.59,-.35+Math.sin(a)*.3]);}
  const signTexture=textTexture('BUILD\nDIFFERENT.','#d9ed7d','#25302a');
  const sign=addMesh(group,new T.BoxGeometry(1.48,.76,.065),[dark,dark,dark,dark,new T.MeshBasicMaterial({map:signTexture}),dark] as unknown as T.Material,[-.7,2.6,-.13]);sign.rotation.y=-.04;
  for(const x of [-1.25,-.18])addMesh(group,new T.BoxGeometry(.04,.5,.04),dark,[x,2.1,-.13]);
  // Original graffiti artwork is applied only as a facade texture; all architecture is modeled.
  const graffiti=new T.TextureLoader().load('/art/brooklyn.webp');graffiti.colorSpace=T.SRGBColorSpace;graffiti.repeat.set(.9,.25);graffiti.offset.set(.08,.02);
  addMesh(group,new T.PlaneGeometry(1.02,.6),new T.MeshStandardMaterial({map:graffiti,roughness:1}),[-1.85,-1.02,.343]);
  const pink=new T.MeshStandardMaterial({color:'#dd7198',emissive:'#a92364',emissiveIntensity:.4});
  const tag=addMesh(group,new T.TorusGeometry(.24,.035,5,24),pink,[.5,-.95,.36]);tag.scale.y=.66;
  const lamp=new T.MeshStandardMaterial({color:'#ffdc98',emissive:'#ffc779',emissiveIntensity:2});
  for(const x of [-2.5,2.5]){addMesh(group,new T.CylinderGeometry(.025,.025,1.9,7),dark,[x,-.55,.73]);addMesh(group,new T.SphereGeometry(.09,8,6),lamp,[x,.42,.73]);}
  animate.push(t=>{group.position.y=Math.sin(t*.55)*.06;glass.emissiveIntensity=.15+Math.sin(t*.3)*.04;});
}

function gear(radius:number, teeth:number, material:T.Material) {
  const g=new T.Group(),shape=new T.Shape();
  for(let j=0;j<=teeth*4;j++){const a=j/(teeth*4)*TAU,r=radius*((j%4===1||j%4===2)?1:.89);if(j===0)shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);else shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
  const hole=new T.Path();hole.absarc(0,0,radius*.64,0,TAU,true);shape.holes.push(hole);
  addMesh(g,new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:1,curveSegments:28}),material);
  addMesh(g,new T.TorusGeometry(radius*.22,radius*.08,7,22),material,[0,0,.06]);
  for(let j=0;j<6;j++){const spoke=addMesh(g,new T.BoxGeometry(radius*1.42,.045,.07),material,[0,0,.06]);spoke.rotation.z=j*Math.PI/6;}
  return g;
}
function steampunk(group:T.Group,animate:Array<(t:number)=>void>,random:()=>number){
  const brass=new T.MeshStandardMaterial({color:'#bd9252',metalness:.78,roughness:.29});
  const copper=new T.MeshStandardMaterial({color:'#975333',metalness:.7,roughness:.36});
  const black=new T.MeshStandardMaterial({color:'#343330',metalness:.65,roughness:.36});
  const glow=new T.MeshStandardMaterial({color:'#ffd393',emissive:'#f2a944',emissiveIntensity:1.8});
  addMesh(group,new T.CylinderGeometry(1.85,1.98,.28,48),black,[0,-1.45,0]);
  addMesh(group,new T.CylinderGeometry(1.82,1.82,.08,48),brass,[0,-1.27,0]);
  addMesh(group,new T.CylinderGeometry(.48,.7,.75,28),copper,[0,-.9,0]);
  addMesh(group,new T.CylinderGeometry(.65,.65,.14,32),brass,[0,-.48,0]);
  const core=new T.Group();core.position.y=.9;group.add(core);
  addMesh(core,new T.IcosahedronGeometry(.81,1),new T.MeshStandardMaterial({color:'#78592b',metalness:.9,roughness:.3,wireframe:true}));
  addMesh(core,new T.SphereGeometry(.69,24,16),new T.MeshStandardMaterial({color:'#172729',metalness:.78,roughness:.27}));
  const latitudes=new T.Group();core.add(latitudes);
  for(let i=0;i<6;i++){const ring=addMesh(latitudes,new T.TorusGeometry(.85,.012,5,64),glow);ring.rotation.y=i*Math.PI/6;}
  const rings:T.Mesh[]=[];
  for(let i=0;i<3;i++){const ring=addMesh(core,new T.TorusGeometry(1.12+i*.19,.033+i*.008,8,80),i===1?copper:brass);ring.rotation.set(.4+i*.8,.3+i*.5,0);rings.push(ring);}
  const gs:T.Group[]=[];
  [[-1.42,-.55,.6,.78],[1.5,-.5,.24,.67],[-1.1,.65,-.65,.5],[.9,1.9,-.7,.37],[.25,-1.12,1.1,.41]].forEach(([x,y,z,r],i)=>{const g=gear(r,Math.round(18*r+8),i%2?copper:brass);g.position.set(x,y,z);g.rotation.y=i%2?.3:-.12;group.add(g);gs.push(g);});
  for(let i=0;i<7;i++){const a=i/7*TAU;const x=Math.cos(a)*1.47,z=Math.sin(a)*1.47;addMesh(group,new T.CylinderGeometry(.08,.08,.75+random()*.3,10),copper,[x,-.75,z]);addMesh(group,new T.SphereGeometry(.085,8,6),glow,[x,-.2,z]);}
  for(let i=0;i<18;i++){const a=i/18*TAU;addMesh(group,new T.SphereGeometry(.055,6,5),brass,[Math.cos(a)*1.73,-1.2,Math.sin(a)*1.73]);}
  animate.push(t=>{group.position.y=Math.sin(t*.5)*.06;latitudes.rotation.y=t*.12;rings.forEach((r,i)=>{r.rotation.x=t*(i===1?-.14:.1)+i;r.rotation.y=t*.06+i*.7;});gs.forEach((g,i)=>{g.rotation.z=t*(i%2?-.2:.17);});glow.emissiveIntensity=1.5+Math.sin(t*1.2)*.25;});
}

export function createWorld(container:HTMLDivElement,theme:Theme,onReady:()=>void){
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  const mobile=window.innerWidth<650;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,mobile?1.25:1.5));
  renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label',`${theme} interactive 3D scene`);
  container.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,50);
  camera.position.set(6.7,3.5,9.3);camera.lookAt(0,.3,0);if(theme==='space'){camera.position.set(0,0,15);camera.lookAt(0,0,0);}
  scene.add(new T.HemisphereLight(theme==='roots'?'#e4f2c9':'#f9e1bd',theme==='roots'?'#3b574c':'#424649',2.5));
  const sun=new T.DirectionalLight('#ffdda3',4);sun.position.set(-3,7,5);sun.castShadow=!mobile;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=6;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.05;scene.add(sun);
  const rim=new T.DirectionalLight(theme==='roots'?'#b9e8d7':theme==='brooklyn'?'#9dcdda':'#f58c4a',3);rim.position.set(4,2,-4);scene.add(rim);
  const world=new T.Group();world.rotation.y=-.35;scene.add(world);
  const animate:Array<(t:number)=>void>=[],random=seeded();
  if(theme==='roots')roots(world,animate,random);else if(theme==='brooklyn')brooklyn(world,animate,random);else {const extra=makeWorld(theme);world.add(extra.group);animate.push(...extra.animate);}
  const ground=new T.Mesh(new T.CircleGeometry(4.3,64),new T.ShadowMaterial({opacity:.16}));ground.rotation.x=-Math.PI/2;ground.position.y=-2.7;ground.receiveShadow=true;scene.add(ground);
  const orbit=new T.Mesh(new T.TorusGeometry(3.2,.007,4,100),new T.MeshBasicMaterial({color:theme==='roots'?'#b7d893':theme==='brooklyn'?'#dcef7a':'#d3a264',transparent:true,opacity:.23}));orbit.rotation.x=Math.PI/2;orbit.position.y=-2.35;scene.add(orbit);
  const dotCount=mobile?65:120,positions=new Float32Array(dotCount*3);
  for(let i=0;i<dotCount;i++){positions[i*3]=(random()-.5)*9;positions[i*3+1]=(random()-.5)*6;positions[i*3+2]=(random()-.5)*6;}
  const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(positions,3));
  const pm=new T.ShaderMaterial({uniforms:{time:{value:0},density:{value:renderer.getPixelRatio()},tint:{value:new T.Color(theme==='roots'?'#e6f6b1':theme==='space'?'#b7d8ff':theme==='volcanic'?'#ff864f':'#ffcf8b')}},vertexShader:`uniform float time; uniform float density;varying float a;void main(){vec3 p=position;p.y=mod(p.y+3.+time*.09,6.)-3.;p.x+=sin(time*.4+position.z)*.09;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(25.*density/-mv.z,1.,5.);a=.25+.5*(sin(time+position.x*3.)*.5+.5);}`,fragmentShader:`uniform vec3 tint;varying float a;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(tint,(1.-smoothstep(.05,.5,d))*a);}`,transparent:true,depthWrite:false,blending:T.AdditiveBlending});scene.add(new T.Points(pg,pm));
  let frame=0,elapsed=0,last=0,motion=true,visible=true,disposed=false,targetY=-.35,targetX=0,dragging=false,downX=0,downY=0,baseY=0,baseX=0;
  function render(now:number){frame=0;if(disposed||!visible||document.hidden)return;const dt=Math.min((now-last)/1000,.04);last=now;if(motion){elapsed+=dt;if(!dragging)targetY+=dt*(theme==='space'?.006:theme==='steampunk'?0:.075);}world.rotation.y+=(targetY-world.rotation.y)*.075;world.rotation.x+=(targetX-world.rotation.x)*.075;animate.forEach(fn=>fn(elapsed));pm.uniforms.time.value=elapsed;renderer.render(scene,camera);if(motion||dragging||Math.abs(world.rotation.y-targetY)>.001||Math.abs(world.rotation.x-targetX)>.001)frame=requestAnimationFrame(render);}
  function wake(){cancelAnimationFrame(frame);frame=requestAnimationFrame(render);}
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.fov=theme==='space'?54:w/h<1.2?48:40;camera.updateProjectionMatrix();renderer.setSize(w,h,false);wake();}
  const ro=new ResizeObserver(resize);ro.observe(container);
  const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible)wake();else cancelAnimationFrame(frame);});io.observe(container);
  const down=(e:PointerEvent)=>{dragging=true;downX=e.clientX;downY=e.clientY;baseY=targetY;baseX=targetX;if(e.pointerType==='mouse')container.setPointerCapture(e.pointerId);container.classList.add('is-dragging');wake();};
  const move=(e:PointerEvent)=>{if(!dragging)return;targetY=baseY+(e.clientX-downX)*.008;targetX=T.MathUtils.clamp(baseX+(e.clientY-downY)*.003,-.2,.24);wake();};
  const up=()=>{dragging=false;container.classList.remove('is-dragging');wake();};
  const lost=(e:Event)=>{e.preventDefault();cancelAnimationFrame(frame);container.dispatchEvent(new CustomEvent('scene-error'));};
  container.addEventListener('pointerdown',down);container.addEventListener('pointermove',move);container.addEventListener('pointerup',up);container.addEventListener('pointercancel',up);container.addEventListener('lostpointercapture',up);renderer.domElement.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',wake);
  resize();animate.forEach(fn=>fn(0));renderer.render(scene,camera);onReady();
  return {setMotion(value:boolean){motion=value;wake();},rotate(direction:number){targetY+=direction*.35;wake();},dispose(){disposed=true;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();document.removeEventListener('visibilitychange',wake);container.removeEventListener('pointerdown',down);container.removeEventListener('pointermove',move);container.removeEventListener('pointerup',up);container.removeEventListener('pointercancel',up);container.removeEventListener('lostpointercapture',up);renderer.domElement.removeEventListener('webglcontextlost',lost);const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{const m=o as T.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>{materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);});});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}

export { roots, brooklyn, steampunk, gear };
