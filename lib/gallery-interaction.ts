import * as T from 'three';

export const HOVER_ZOOM = 1.2;
export const CAMERA_Z = 10.4;
export const FACE_Z = .65;
export const HOVER_DEPTH = .8;
export type Viewport = {left:number;top:number;width:number;height:number};
export type Pointer = {x:number;y:number};
export type Pickable = {group:T.Group;camera:T.PerspectiveCamera;viewport:Viewport;bounds:T.Box3};

/** One small, shared cursor offset keeps rows aligned on the larger wheel. */
export function cursorTiltTarget(pointer:Pointer|null,width:number,height:number) {
  if(!pointer||width<=0||height<=0)return {x:0,y:0};
  const horizontal=T.MathUtils.clamp(pointer.x/width*2-1,-1,1);
  const vertical=T.MathUtils.clamp(pointer.y/height*2-1,-1,1);
  return {x:-vertical*.08,y:horizontal*.16};
}
const raycaster = new T.Raycaster(), inverse = new T.Matrix4(), localRay = new T.Ray();
const point = new T.Vector3(), ndc = new T.Vector2();

/** Use the same camera, viewport and model matrix as the visible WebGL object. */
export function hitObject(pointer:Pointer, view:Pickable):T.Vector3|null {
  const {viewport:v,camera,group,bounds}=view;
  ndc.set((pointer.x-v.left)/v.width*2-1,1-(pointer.y-v.top)/v.height*2);
  camera.updateMatrixWorld();group.updateMatrixWorld(true);
  raycaster.setFromCamera(ndc,camera);
  inverse.copy(group.matrixWorld).invert();
  localRay.copy(raycaster.ray).applyMatrix4(inverse);
  return localRay.intersectBox(bounds,point)?.clone() ?? null;
}

/** The foreground object keeps priority in overlap, matching draw order. */
export function pickObject(pointer:Pointer|null, views:(Pickable|null)[], active=-1) {
  if(!pointer)return null;
  if(active>=0&&views[active]){
    const point=hitObject(pointer,views[active]!);if(point)return {index:active,point};
  }
  for(let i=views.length-1;i>=0;i--){
    if(i===active||!views[i])continue;
    const point=hitObject(pointer,views[i]!);if(point)return {index:i,point};
  }
  return null;
}

/** Move forward and scale together without double-counting perspective zoom. */
export function hoverPose(restZ:number,progress:number) {
  const magnification=1+(HOVER_ZOOM-1)*progress;
  const z=restZ+HOVER_DEPTH*progress;
  const distance=CAMERA_Z-restZ;
  const scale=magnification*(CAMERA_Z-z)/(distance+FACE_Z*(magnification-1));
  return {z,scale};
}
