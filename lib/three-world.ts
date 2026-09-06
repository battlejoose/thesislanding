import * as T from 'three';
import { brooklynCity } from './brooklyn-world';

function seeded() { let seed = 76123; return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }; }

export function createWorld(container:HTMLDivElement,onReady:()=>void){
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  const mobile=window.innerWidth<650;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,mobile?1.25:1.5));
  renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.domElement.setAttribute('aria-label','Brooklyn interactive 3D scene');
  container.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(58,1,.1,180);
  camera.position.set(1.5,3.6,19);camera.lookAt(0,1,-15);scene.fog=new T.FogExp2('#585566',.018);
  scene.add(new T.HemisphereLight('#f9e1bd','#424649',2.5));
  const sun=new T.DirectionalLight('#ffdda3',4);sun.position.set(-3,7,5);sun.castShadow=!mobile;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=6;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.05;scene.add(sun);
  const rim=new T.DirectionalLight('#9dcdda',3);rim.position.set(4,2,-4);scene.add(rim);
  const world=new T.Group();scene.add(world);
  const animate:Array<(t:number)=>void>=[],random=seeded();
  brooklynCity(world,animate,random);
  let frame=0,elapsed=0,last=0,motion=true,visible=true,disposed=false,targetY=0,targetX=0,dragging=false,downX=0,downY=0,baseY=0,baseX=0;
  function render(now:number){frame=0;if(disposed||!visible||document.hidden)return;const dt=Math.min((now-last)/1000,.04);last=now;if(motion)elapsed+=dt;world.rotation.y+=(targetY-world.rotation.y)*.075;world.rotation.x+=(targetX-world.rotation.x)*.075;animate.forEach(fn=>fn(elapsed));renderer.render(scene,camera);if(motion||dragging||Math.abs(world.rotation.y-targetY)>.001||Math.abs(world.rotation.x-targetX)>.001)frame=requestAnimationFrame(render);}
  function wake(){cancelAnimationFrame(frame);frame=requestAnimationFrame(render);}
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);wake();}
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
