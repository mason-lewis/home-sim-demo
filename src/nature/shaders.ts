export const vertexShader = `
attribute vec2 position;
varying vec2 uv;
void main(){uv=vec2((position.x+1.)*.5,(1.-position.y)*.5);gl_Position=vec4(position,0.,1.);}
`;
export const fragmentShader = `
precision highp float;
varying vec2 uv;
uniform sampler2D currentImage;
uniform sampler2D nextImage;
uniform sampler2D motionMask;
uniform float blend;
uniform float time;
uniform float wind;
uniform vec3 sway;
uniform vec2 scale;
uniform vec2 offset;
uniform vec2 pointer;
uniform float pointerForce;
uniform vec4 ripples[12];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
vec3 scene(vec2 p){return mix(texture2D(currentImage,p).rgb,texture2D(nextImage,p).rgb,blend);}
float plantingPermission(vec4 mask){return clamp((mask.a*255.-128.)/127.,0.,1.);}
void main(){
 vec2 q=uv*scale+offset;
 vec4 masks=texture2D(motionMask,q);
 // Nearby plants share the wind direction, with a delayed response along the garden.
 float phase=noise(vec2(q.x*4.,.37));
 float pressure=noise(vec2(q.x*5.-time*.18,q.y*2.))-.5;
 float branch=mix(sway.x,sway.z,phase*.5)+pressure*.12;
 float stem=mix(sway.y,sway.z,phase*.65)+pressure*.12;
 // Anchored stems bend progressively toward their tips; trunks and ground stay fixed.
 // Close shrubs are rooted below the photograph, not at its lower edge.
 float foreground=smoothstep(.78,.89,q.y);
 float rootY=mix(.91,1.2,foreground);
 float height=mix(.29,.36,foreground);
 float stemFlex=pow(clamp((rootY-q.y)/height,0.,1.),1.35);
 float branchFlex=pow(clamp(length((q-vec2(.94,.035))*vec2(1.,.7))/.55,0.,1.),.8);
 float flutter=sin(time*4.2+q.x*38.+q.y*29.)*.55+sin(time*5.7-q.x*51.+q.y*19.)*.25;
 float influence=exp(-dot((q-pointer)*vec2(1.,1.78),(q-pointer)*vec2(1.,1.78))*150.)*pointerForce;
 vec2 bushMotion=vec2(stem*mix(.012,.018,foreground),stem*.0011)*stemFlex;
 bushMotion+=vec2(flutter*.0005,flutter*.00016)*stemFlex;
 vec2 leafMotion=vec2(branch*.011,branch*.003)*branchFlex;
 leafMotion+=vec2(flutter*.00055,flutter*.00028)*branchFlex;
 vec2 contact=vec2(sin(time*2.9+q.x*20.)*.0015,cos(time*2.1+q.y*17.)*.00035)*influence;
 bushMotion+=contact*stemFlex;leafMotion+=contact*branchFlex;
 // Crossing wind waves perturb reflections continuously, even without pointer input.
 float w1=sin(q.x*210.+q.y*365.-time*2.4);
 float w2=sin(q.x*345.-q.y*226.+time*1.8);
 float w3=sin(q.x*580.+q.y*110.-time*3.2+noise(q*18.+time*.12)*3.);
 vec2 surface=vec2(w1*.00105+w2*.00065+w3*.0003,w1*.00028-w2*.00018)*(.85+wind*.35);
 float glint=0.;
 for(int i=0;i<12;i++){
   vec4 r=ripples[i];float age=time-r.z;
   vec2 delta=(q-r.xy)*vec2(1.,3.4);
   float distance=length(delta);
   float front=distance-age*.045;
   float envelope=exp(-front*front/.00032)*exp(-age*.63)*step(0.,age)*r.w;
   float wave=sin(front*360.);
   vec2 direction=delta/(distance+.001);
   surface+=direction*vec2(.00145,.00033)*wave*envelope;
   glint+=wave*envelope*.009;
 }
 // Attenuate any displacement that would sample coping outside the pool.
 surface*=masks.r*texture2D(motionMask,clamp(q+surface,0.,1.)).r;
 vec3 colour=scene(clamp(q+surface,0.,1.));
 colour+=masks.r*(glint+(w1+w2+w3)*.0032);
 // Leaf detail can move within the garden, but both ends of a sample must
 // respect the separate hard exclusions for concrete, rocks, and architecture.
 vec2 bushPoint=clamp(q+bushMotion,0.,1.);
 vec4 bushMask=texture2D(motionMask,bushPoint);
 float bushAlpha=max(masks.g,bushMask.g)*min(plantingPermission(masks),plantingPermission(bushMask));
 colour=mix(colour,scene(bushPoint),bushAlpha);
 vec2 leafPoint=clamp(q+leafMotion,0.,1.);
 vec4 leafMask=texture2D(motionMask,leafPoint);
 float leafAlpha=max(masks.b,leafMask.b)*min(plantingPermission(masks),plantingPermission(leafMask));
 colour=mix(colour,scene(leafPoint),leafAlpha);
 gl_FragColor=vec4(colour,1.);
}
`;
