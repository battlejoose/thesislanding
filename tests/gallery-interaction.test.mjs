import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CAMERA_Z,FACE_Z,cursorTiltTarget,hoverPose,pickObject,pointOnFace} from '../lib/gallery-interaction.ts';
import {tokenActionAt,TOKEN_SOCIALS,TOKEN_WEBSITE_X,tokenRegionAt} from '../lib/token-controls.ts';
import {brooklynCity,constructionTile} from '../lib/brooklyn-world.ts';

function view(left=100,top=80) {
  const camera=new T.PerspectiveCamera(46,400/520,.1,30);camera.position.set(0,.12,CAMERA_Z);camera.lookAt(0,.12,0);camera.updateProjectionMatrix();
  return {camera,group:new T.Group(),viewport:{left,top,width:400,height:520},bounds:new T.Box3(new T.Vector3(-2.43,-2.95,-.76),new T.Vector3(2.43,2.95,.77))};
}
function project(v,x,y,z=.65){const point=new T.Vector3(x,y,z);v.group.updateMatrixWorld();v.camera.updateMatrixWorld();point.applyMatrix4(v.group.matrixWorld).project(v.camera);return {x:v.viewport.left+(point.x+1)*v.viewport.width/2,y:v.viewport.top+(1-point.y)*v.viewport.height/2};}

test('hover adds exactly 20% apparent size, without overshoot or reversed movement',()=>{
  for(const rest of [0,-.8,-2.6]){
    let previous=1;
    for(let i=0;i<=100;i++){
      const progress=i/100,{z,scale}=hoverPose(rest,progress);
      const apparent=scale*(CAMERA_Z-rest-FACE_Z)/(CAMERA_Z-z-scale*FACE_Z);
      assert.ok(Math.abs(apparent-(1+.2*progress))<1e-12);
      assert.ok(apparent>=previous-1e-12 && apparent<=1.2+1e-12);previous=apparent;
    }
    assert.deepEqual(hoverPose(rest,0),{z:rest,scale:1});
  }
});
test('only the visible 3D object activates; empty DOM-card corners do not',()=>{
  const v=view();assert.equal(pickObject(project(v,0,0),[v])?.index,0);
  assert.equal(pickObject({x:102,y:82},[v]),null);
  assert.equal(pickObject(null,[v],0),null);
});
test('picking tracks camera zoom, scroll curvature, depth and responsive viewports',()=>{
  for(const top of [-120,80,700])for(const rotation of [-.75,0,.75]){
    const v=view(60,top);v.group.rotation.set(rotation,.13,0);v.group.position.z=-2;
    v.camera.zoom=1/1.7;v.camera.updateProjectionMatrix();
    const hit=pickObject(project(v,1,1),[v]);assert.equal(hit?.index,0);
    assert.ok(hit.point.x>0 && hit.point.y>0);
  }
});
test('leaving an enlarged tile releases it immediately and permits the next tile',()=>{
  const a=view(),b=view(520);const pose=hoverPose(0,1);a.group.position.z=pose.z;a.group.scale.setScalar(pose.scale);
  assert.equal(pickObject(project(a,0,0),[a,b],0)?.index,0);
  assert.equal(pickObject(project(b,0,0),[a,b],0)?.index,1);
  assert.equal(pickObject({x:1100,y:20},[a,b],0),null);
});
test('foreground object owns overlaps; no alternating hover from DOM mouseleave events',()=>{
  const a=view(),b=view(200),p={x:360,y:340};
  for(let i=0;i<50;i++)assert.equal(pickObject(p,[a,b],0)?.index,0);
  assert.equal(pickObject(p,[a,b],1)?.index,1);
});

test('Construction opens only its title or a supplied footer link, including while tilted and zoomed',()=>{
  const p={kind:'token',dataState:'ready',tokenUrl:'https://pump.fun/coin/token',x:'https://x.com/token',telegram:null,discord:'https://discord.gg/token',github:'https://github.com/team/token',website:'https://example.com'};
  for(const angle of [-.7,0,.7])for(const progress of [0,1]){
    const v=view(),pose=hoverPose(-.8,progress);v.camera.zoom=.9/1.7;v.camera.updateProjectionMatrix();v.group.rotation.set(angle,.14,0);v.group.position.z=pose.z;v.group.scale.setScalar(pose.scale);
    const action=(x,y)=>tokenActionAt(p,pointOnFace(project(v,x,y,FACE_Z),v));
    assert.equal(action(0,-.36),'title');
    assert.equal(action(-1.7,-.4),null);assert.equal(action(0,-.73),null);
    assert.equal(action(0,1.4),null);assert.equal(action(-1.5,-1.9),null);assert.equal(action(0,-2.7),null);
    assert.equal(action(TOKEN_WEBSITE_X,-2.35),'website');
    for(const s of TOKEN_SOCIALS)assert.equal(action(s.x,-2.31),p[s.key]?s.key:null);
  }
  assert.equal(tokenActionAt({...p,kind:'soon',dataState:undefined,tokenUrl:undefined,x:null,discord:null,github:null,website:null},{x:0,y:-.4}),null);
  assert.equal(tokenActionAt({...p,dataState:'error'},{x:0,y:1.1}),'retry');
  assert.equal(tokenRegionAt({x:-1.5,y:-1.9}),'cap');
});

test('Construction tiles are 10% smaller at rest and on hover, with matching picking',()=>{
  for(const progress of [0,.5,1]){
    const v=view(),pose=hoverPose(-.8,progress);
    v.group.rotation.set(.35*(1-progress),.13,0);v.group.position.z=pose.z;v.group.scale.setScalar(pose.scale);
    const originalLeft=project(v,-2,0),originalRight=project(v,2,0);
    v.camera.zoom=.9;v.camera.updateProjectionMatrix();
    const smallerLeft=project(v,-2,0),smallerRight=project(v,2,0);
    assert.ok(Math.abs((smallerRight.x-smallerLeft.x)/(originalRight.x-originalLeft.x)-.9)<1e-12);
    assert.equal(pickObject(project(v,1.8,1),[v])?.index,0);
    assert.equal(pickObject(project(v,2.8,1),[v]),null);
  }
});

test('cursor tilt follows both axes, stays subtle, and resets without a mouse',()=>{
  const left=cursorTiltTarget({x:0,y:300},1200,600),right=cursorTiltTarget({x:1200,y:300},1200,600);
  const top=cursorTiltTarget({x:600,y:0},1200,600),bottom=cursorTiltTarget({x:600,y:600},1200,600);
  assert.ok(left.y<0 && right.y>0 && top.x>0 && bottom.x<0);
  assert.deepEqual(cursorTiltTarget(null,1200,600),{x:0,y:0});
  const extreme=cursorTiltTarget({x:9000,y:-9000},1200,600);
  assert.ok(Math.abs(extreme.x)<=.08 && Math.abs(extreme.y)<=.16);
  // The same additive offset applies regardless of each row's wheel rotation.
  for(const wheel of [-.9,0,.9])assert.ok(Math.abs((wheel+right.x)-wheel)<1e-12);
});
test('Brooklyn architecture has valid geometry and keeps animating independently of tilt',()=>{
  const tile=new T.Group(),animations=[];constructionTile(tile,animations,2);
  tile.rotation.set(0,0,0);const before=tile.children.map(o=>o.position.y);
  animations.forEach(fn=>fn(3));assert.deepEqual(tile.rotation.toArray(),[0,0,0,'XYZ']);
  assert.ok(tile.children.some((o,i)=>o.position.y!==before[i]));
  let seed=76123;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  const city=new T.Group(),cityAnimations=[];brooklynCity(city,cityAnimations,random);cityAnimations.forEach(fn=>fn(20));
  for(const root of [tile,city])root.traverse(o=>{
    if(o.geometry){for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));}
    if(o.isInstancedMesh)assert.ok(o.count<=o.instanceMatrix.count);
  });
});
