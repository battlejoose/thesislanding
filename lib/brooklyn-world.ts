import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Animations=Array<(time:number)=>void>;
const UP=new T.Vector3(0,1,0);

// Bake the many architectural pieces into one draw per material.
function architecture(parent:T.Group) {
  const batches=new Map<T.Material,T.BufferGeometry[]>();
  const add=(material:T.Material,g:T.BufferGeometry,x=0,y=0,z=0,rotation?:T.Euler)=>{
    const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(rotation??new T.Euler()),new T.Vector3(1,1,1));
    g.applyMatrix4(matrix);const list=batches.get(material)??[];list.push(g);batches.set(material,list);
  };
  const box=(m:T.Material,w:number,h:number,d:number,x=0,y=0,z=0)=>add(m,new T.BoxGeometry(w,h,d),x,y,z);
  const beam=(m:T.Material,a:number[],b:number[],r=.025)=>{
    const start=new T.Vector3(...a),end=new T.Vector3(...b),middle=start.clone().add(end).multiplyScalar(.5);
    const g=new T.CylinderGeometry(r,r,start.distanceTo(end),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(UP,end.sub(start).normalize()));
    add(m,g,middle.x,middle.y,middle.z);
  };
  const finish=()=>batches.forEach((parts,material)=>{
    const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!geometry)return;
    const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  });
  return {add,box,beam,finish};
}
const material=(color:string,metalness=0,roughness=.85)=>new T.MeshStandardMaterial({color,metalness,roughness});

function crane(parent:T.Group,animate:Animations,x:number,y:number,z:number,size:number,phase:number) {
  const tower=new T.Group();tower.position.set(x,y,z);tower.scale.setScalar(size);parent.add(tower);
  const steel=material('#e5a632',.45,.47),dark=material('#344750',.65,.5),concrete=material('#aca795');
  const a=architecture(tower);
  for(const dx of [-.13,.13])for(const dz of [-.13,.13])a.box(steel,.035,2.5,.035,dx,1.25,dz);
  for(let level=0;level<8;level++)for(const dz of [-.13,.13]){
    a.beam(steel,[-.13,level*.31,dz],[.13,(level+1)*.31,dz],.013);
    a.beam(steel,[.13,level*.31,dz],[-.13,(level+1)*.31,dz],.013);
  }
  a.box(concrete,.5,.15,.5,0,.05,0);a.finish();
  const jib=new T.Group();jib.position.y=2.5;tower.add(jib);const b=architecture(jib);
  for(const dz of [-.12,.12]){
    b.box(steel,2.6,.038,.038,.65,0,dz);b.box(steel,2.6,.03,.03,.65,.22,dz);
    for(let i=0;i<10;i++)b.beam(steel,[-.65+i*.26,0,dz],[-.39+i*.26,.22,dz],.014);
  }
  b.box(concrete,.45,.4,.4,-.53,-.12,0);b.box(dark,.28,.26,.33,.08,-.1,0);
  b.beam(dark,[0,.48,0],[1.95,.22,0],.009);b.beam(dark,[0,.48,0],[-.65,.22,0],.009);b.finish();
  const cable=new T.Mesh(new T.CylinderGeometry(.008,.008,1,5),dark);cable.position.x=1.4;jib.add(cable);
  const hook=new T.Mesh(new T.TorusGeometry(.065,.017,5,12,Math.PI*1.6),steel);hook.position.x=1.4;jib.add(hook);
  animate.push(t=>{jib.rotation.y=-.3+Math.sin(t*.12+phase)*.45;const length=.55+(Math.sin(t*.45+phase)+1)*.23;cable.scale.y=length;cable.position.y=-length/2;hook.position.y=-length;});
}

export function constructionTile(group:T.Group,animate:Animations,index:number) {
  const concrete=material('#a9aaa0'),steel=material('#334e56',.65,.5),yellow=material('#e9b345',.35,.55);
  const brick=material('#9b5743'),mortar=material('#665c53'),wood=material('#9f7850'),dark=material('#25383c');
  const a=architecture(group);
  // Deep side walls, exposed concrete floors and a genuinely open top story.
  a.box(mortar,4.75,5.5,1.85,0,-.04,-.6);
  for(const y of [-2.86,-1.45,0,1.45,2.86,3.66])a.box(concrete,4.98,.13,2.1,0,y,-.6);
  for(const x of [-2.34,0,2.34])for(const z of [-1.56,.49]){
    a.box(steel,.13,6.54,.13,x,.4,z);
    a.box(steel,.025,.38,.025,x-.036,3.91,z);
    a.box(steel,.025,.31,.025,x+.036,3.88,z);
  }
  // Staggered masonry and inset side windows are visible through the scaffolding.
  for(const side of [-1,1]){
    for(let row=0;row<22;row++)for(let col=0;col<4;col++){
      if(row%6>1&&row%6<5&&(col===1||col===2))continue;
      a.box(brick,.065,.21,.41,side*2.385,-2.63+row*.245,-1.3+col*.45+(row%2)*.08);
    }
    for(const y of [-2.16,-.73,.73,2.16])a.box(dark,.045,.69,.91,side*2.41,y,-.5);
    for(const z of [-1.62,.8])a.box(steel,.043,6.45,.043,side*2.66,.24,z);
    for(const y of [-2.75,-1.36,.03,1.42,2.81]){
      a.box(wood,.63,.055,2.62,side*2.47,y,-.43);
      a.beam(steel,[side*2.66,y,-1.62],[side*2.66,y+1.37,.8],.018);
      a.beam(steel,[side*2.66,y,.8],[side*2.66,y+1.37,-1.62],.018);
      a.box(steel,.028,.028,2.42,side*2.66,y+.65,-.41);
    }
  }
  a.beam(steel,[-2.34,2.92,-1.5],[0,3.62,-1.5],.028);
  a.beam(steel,[0,3.62,-1.5],[2.34,2.92,-1.5],.028);
  // Site hoarding beneath the newspaper project placard.
  a.box(yellow,4.82,.19,.08,0,-2.72,.7);
  for(let i=0;i<20;i++)a.add(dark,new T.BoxGeometry(.09,.21,.015),-2.3+i*.24,-2.72,.751,new T.Euler(0,0,-.45));
  for(let i=0;i<5;i++)a.box(wood,.7,.06,.32,-1.5+i*.13,3.79+i*.063,-.8);
  a.finish();
  // A traveling external construction elevator, independent of hover motion.
  const lift=new T.Group();lift.position.set(2.82,-1,.13);group.add(lift);const l=architecture(lift);
  l.box(yellow,.44,.06,.63,0,-.3,0);l.box(yellow,.44,.06,.63,0,.3,0);
  for(const x of [-.2,.2])for(const z of [-.29,.29])l.box(yellow,.03,.6,.03,x,0,z);
  for(let i=0;i<5;i++)l.box(steel,.024,.53,.024,-.17+i*.085,0,.3);l.finish();
  const lampMat=new T.MeshStandardMaterial({color:'#ffe4a4',emissive:'#ffb735',emissiveIntensity:2});
  const lamp=new T.Mesh(new T.SphereGeometry(.065,8,5),lampMat);lamp.position.set(-2.5,3.15,.63);group.add(lamp);
  const tarpGeometry=new T.PlaneGeometry(1.65,.61,12,5),tarp=new T.Mesh(tarpGeometry,new T.MeshStandardMaterial({color:'#3b8c80',side:T.DoubleSide,transparent:true,opacity:.83,roughness:1}));
  tarp.position.set(-1.37,3.29,.53);group.add(tarp);const vertices=tarpGeometry.attributes.position,original=Float32Array.from(vertices.array);
  animate.push(t=>{lift.position.y=-2.12+(Math.sin(t*.3+index*.7)+1)*2.28;lampMat.emissiveIntensity=1.7+Math.sin(t*2+index)*.3;for(let i=0;i<vertices.count;i++){vertices.setZ(i,Math.sin(original[i*3]*4+t*2)*.05*(.31-original[i*3+1]));}vertices.needsUpdate=true;});
  crane(group,animate,.8,3.7,-.65,.48,index*.6);
}

export function brooklynCity(group:T.Group,animate:Animations,random:()=>number) {
  const a=architecture(group),dark=material('#1c2936'),roof=material('#53555d'),trim=material('#927e6b'),wood=material('#936a51');
  const brickColors=['#765251','#845348','#4b4b59','#5c6268','#985e4d'].map(c=>material(c));
  const windows=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:'#ffffff',toneMapped:false}),7500);
  const dummy=new T.Object3D(),color=new T.Color();let n=0;
  const window=(x:number,y:number,z:number,w:number,h:number,side=false)=>{
    dummy.position.set(x,y,z);dummy.rotation.set(0,side?Math.PI/2:0,0);dummy.scale.set(w,h,1);dummy.updateMatrix();windows.setMatrixAt(n,dummy.matrix);
    color.set(random()>.42?['#ebaa68','#f0ce9b','#ce8463'][Math.floor(random()*3)]:'#273b50');windows.setColorAt(n++,color);
  };
  // A broad, layered city fills the frame, with perspective streets between blocks.
  a.box(dark,94,.28,65,0,-4.25,-18);
  for(let row=0;row<5;row++)for(let col=-8;col<=8;col++){
    const x=col*4.65+(row%2)*1.4,z=-3-row*7.6,w=2.2+random()*1.55,d=2.6+random()*1.4;
    const h=row===0?2.2+random()*4.9:4+random()*(6+row*1.8),top=-4+h;
    a.box(brickColors[(row+col+10)%5],w,h,d,x,-4+h/2,z);
    a.box(trim,w+.18,.15,d+.18,x,top,z);a.box(roof,w-.14,.1,d-.14,x,top+.1,z);
    for(let y=-3.4;y<top-.45;y+=.72)for(let c=-1;c<=1;c++){
      window(x+c*w*.26,y,z+d/2+.014,.3,.42);
      window(x+w/2+.014,y,z+c*d*.27,.3,.42,true);
    }
    if(row<2){
      for(let y=-3.15;y<top-.5;y+=.74){
        a.box(dark,.67,.04,.42,x+.3,y,z+d/2+.23);
        a.box(dark,.025,.3,.025,x,y+.17,z+d/2+.45);a.box(dark,.025,.3,.025,x+.62,y+.17,z+d/2+.45);
        a.box(dark,.64,.025,.025,x+.31,y+.32,z+d/2+.45);
        a.beam(dark,[x+.1,y,z+d/2+.42],[x+.53,y-.74,z+d/2+.42],.017);
      }
      if(col%3===0){
        for(const dx of [-.25,.25])a.box(dark,.035,.48,.035,x+dx,top+.33,z);
        a.add(wood,new T.CylinderGeometry(.4,.43,.64,12),x,top+.85,z);
        a.add(roof,new T.ConeGeometry(.47,.23,12),x,top+1.28,z);
      }
    }
    if(row===2&&col%4===0)crane(group,animate,x,top,z,1.15,Math.abs(col));
  }
  windows.count=n;windows.instanceMatrix.needsUpdate=true;group.add(windows);
  // Foreground avenues and elevated industrial structure.
  const road=material('#222c39'),paint=material('#c7b38b'),steel=material('#3d5360',.45);
  a.box(road,95,.025,3.5,0,-4.08,1.5);
  for(let x=-43;x<44;x+=2.1)a.box(paint,.87,.012,.065,x,-4.06,1.6);
  for(let x=-25;x<28;x+=3.5){a.box(steel,.13,2.25,.13,x,-2.96,-.9);a.beam(steel,[x,-1.86,-.9],[x+3.5,-1.86,-.9],.09);}
  a.box(steel,57,.16,.35,0,-1.8,-.9);a.finish();
  const headlight=new T.MeshBasicMaterial({color:'#ffe4ad',toneMapped:false}),taillight=new T.MeshBasicMaterial({color:'#ff7257',toneMapped:false});
  const cars=new T.InstancedMesh(new T.BoxGeometry(.11,.075,.06),headlight,48),tails=new T.InstancedMesh(new T.BoxGeometry(.09,.06,.05),taillight,48);group.add(cars,tails);
  animate.push(t=>{for(let i=0;i<24;i++){const x=((i*4.2+t*(i%2?1.1:-1.35)+60)%110+110)%110-55;for(let k=0;k<2;k++){dummy.position.set(x,-3.89,.8+(i%2)*1.4+k*.2);dummy.rotation.set(0,Math.PI/2,0);dummy.scale.set(1,1,1);dummy.updateMatrix();cars.setMatrixAt(i*2+k,dummy.matrix);dummy.position.x+=i%2?-.54:.54;dummy.updateMatrix();tails.setMatrixAt(i*2+k,dummy.matrix);}}cars.instanceMatrix.needsUpdate=true;tails.instanceMatrix.needsUpdate=true;});
  // Low-cost atmospheric sunset dome; the haze comes from real scene depth.
  const sky=new T.Mesh(new T.SphereGeometry(95,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 direction;void main(){vec3 d=normalize(direction);float h=smoothstep(-.12,.52,d.y);vec3 c=mix(vec3(.43,.22,.22),vec3(.065,.11,.21),h);float sunset=pow(max(0.,dot(d,normalize(vec3(-.5,.08,-1.)))),30.);c+=vec3(.38,.18,.075)*sunset;gl_FragColor=vec4(c,1.);}`}));sky.renderOrder=-10;group.add(sky);
  const sun=new T.Mesh(new T.CircleGeometry(2.3,40),new T.MeshBasicMaterial({color:'#f4ad75',fog:false,toneMapped:false}));sun.position.set(-23,8,-65);group.add(sun);
}
