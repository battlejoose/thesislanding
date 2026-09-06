'use client';
import { useEffect, useRef } from 'react';
export default function SpatialTypography({motion}:{motion:boolean}){
  const host=useRef<HTMLDivElement>(null),motionRef=useRef(motion);
  useEffect(()=>{motionRef.current=motion;},[motion]);
  useEffect(()=>{
    const container=host.current;if(!container)return;let disposed=false;let cleanup=()=>{};
    void Promise.all([import('three'),import('three/addons/loaders/FontLoader.js'),import('three/addons/geometries/TextGeometry.js')]).then(async([T,{FontLoader},{TextGeometry}])=>{
      const font=await new FontLoader().loadAsync('/fonts/helvetiker.json');if(disposed)return;
      const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;container.appendChild(renderer.domElement);
      const scene=new T.Scene(),camera=new T.OrthographicCamera(0,window.innerWidth,window.innerHeight,0,-600,600);camera.position.z=200;
      scene.add(new T.HemisphereLight('#fff5dc','#48534b',2.4));const light=new T.DirectionalLight('#ffffff',3);light.position.set(-200,400,300);scene.add(light);
      type LetterObject={element:HTMLElement;mesh:InstanceType<typeof T.Mesh>;heading:boolean;offset:number;panel?:boolean;};let objects:LetterObject[]=[];let frame=0,start=performance.now(),rebuildFrame=0;
      const disposeObjects=()=>{objects.forEach(o=>{scene.remove(o.mesh);o.mesh.geometry.dispose();(Array.isArray(o.mesh.material)?o.mesh.material:[o.mesh.material]).forEach(m=>m.dispose());});objects=[];};
      function rebuild(){
        if(disposed)return;disposeObjects();const root=document.querySelector('.showcase');if(!root)return;const rootStyle=getComputedStyle(root);
        const fg=rootStyle.getPropertyValue('--foreground').trim()||'#eff0df',accent=rootStyle.getPropertyValue('--accent').trim()||'#d7e8a1',bg=rootStyle.getPropertyValue('--background').trim()||'#10251d';
        document.querySelectorAll<HTMLElement>('[data-spatial-text]').forEach((element,i)=>{
          const text=(element.textContent??'').trim();if(!text)return;const style=getComputedStyle(element),size=parseFloat(style.fontSize),heading=element.dataset.spatialText==='heading';
          const geometry=new TextGeometry(text,{font,size,depth:heading?Math.max(4,size*.13):Math.max(1,size*.07),curveSegments:heading?4:2,bevelEnabled:heading,bevelThickness:heading?.35:0,bevelSize:heading?.2:0,bevelSegments:1});geometry.computeBoundingBox();
          const active=element.closest('[data-active]');const color=element.dataset.spatialTone==='accent'?accent:element.dataset.spatialTone==='muted'?'#bac5b3':active?bg:fg;
          const face=new T.MeshStandardMaterial({color,metalness:.18,roughness:.4,emissive:'#000000',emissiveIntensity:.12});const side=new T.MeshStandardMaterial({color:new T.Color(color).lerp(new T.Color(bg),.57),metalness:.4,roughness:.48});
          const mesh=new T.Mesh(geometry,[face,side]);mesh.userData.originalWidth=geometry.boundingBox!.max.x-geometry.boundingBox!.min.x;mesh.userData.originalHeight=geometry.boundingBox!.max.y-geometry.boundingBox!.min.y;mesh.userData.bottom=geometry.boundingBox!.min.y;scene.add(mesh);objects.push({element,mesh,heading,offset:i*.09});
        });
        document.querySelectorAll<HTMLElement>('[data-spatial-panel]').forEach(element=>{const shape=new T.Shape();shape.moveTo(-.3,-.5);shape.lineTo(.3,-.5);shape.quadraticCurveTo(.5,-.5,.5,-.3);shape.lineTo(.5,.3);shape.quadraticCurveTo(.5,.5,.3,.5);shape.lineTo(-.3,.5);shape.quadraticCurveTo(-.5,.5,-.5,.3);shape.lineTo(-.5,-.3);shape.quadraticCurveTo(-.5,-.5,-.3,-.5);const geometry=new T.ExtrudeGeometry(shape,{depth:4,bevelEnabled:false,curveSegments:8});const active=element.hasAttribute('data-active');const baseColor=active?accent:rootStyle.getPropertyValue('--muted').trim()||bg;const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color:baseColor,metalness:.35,roughness:.45}));scene.add(mesh);objects.push({element,mesh,heading:false,offset:0,panel:true});});
        root.setAttribute('data-typography-ready','true');start=performance.now();wake();
      }
      function queue(){cancelAnimationFrame(rebuildFrame);rebuildFrame=requestAnimationFrame(rebuild);}
      function render(now:number){frame=0;if(disposed||document.hidden)return;const t=(now-start)/1000;const height=window.innerHeight;
        let visible=false;objects.forEach(({element,mesh,heading,offset,panel})=>{const r=element.getBoundingClientRect();mesh.visible=r.width>0&&r.height>0&&r.bottom>0&&r.top<height;if(!mesh.visible)return;visible=true;if(panel){mesh.scale.set(r.width,r.height,1);mesh.position.set(r.left+r.width/2,height-r.top-r.height/2,-5);mesh.rotation.x=.05;return;}const glyphHeight=r.height*(heading?.82:.72),sx=r.width/mesh.userData.originalWidth,sy=glyphHeight/mesh.userData.originalHeight;mesh.scale.set(sx,sy,1);const intro=motionRef.current?Math.max(0,1-(t-offset)*2.1):0;
          mesh.position.set(r.left,height-r.bottom+(r.height-glyphHeight)*.5-mesh.userData.bottom*sy+(heading&&motionRef.current?Math.sin(t*.8+offset)*1.2:0),0);mesh.rotation.y=heading?-.09-intro*.2:0;mesh.rotation.x=heading?.065:0;mesh.position.z=intro*30;});renderer.render(scene,camera);if(visible&&motionRef.current)frame=requestAnimationFrame(render);
      }
      function wake(){cancelAnimationFrame(frame);frame=requestAnimationFrame(render);}
      function resize(){camera.right=window.innerWidth;camera.top=window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight,false);queue();}
      const observer=new MutationObserver(queue);observer.observe(document.querySelector('.showcase')!,{childList:true,characterData:true,subtree:true});
      const ro=new ResizeObserver(resize);ro.observe(document.documentElement);window.addEventListener('scroll',wake,{passive:true});window.addEventListener('resize',resize);document.addEventListener('visibilitychange',wake);
      const lost=(e:Event)=>{e.preventDefault();document.querySelector('.showcase')?.removeAttribute('data-typography-ready');cancelAnimationFrame(frame);};renderer.domElement.addEventListener('webglcontextlost',lost);
      resize();rebuild();cleanup=()=>{cancelAnimationFrame(frame);cancelAnimationFrame(rebuildFrame);observer.disconnect();ro.disconnect();window.removeEventListener('scroll',wake);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',wake);renderer.domElement.removeEventListener('webglcontextlost',lost);disposeObjects();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();document.querySelector('.showcase')?.removeAttribute('data-typography-ready');};
    }).catch(()=>{document.querySelector('.showcase')?.removeAttribute('data-typography-ready');});
    return()=>{disposed=true;cleanup();};
  },[]);
  return <div ref={host} className="spatial-typography" aria-hidden="true"/>;
}
