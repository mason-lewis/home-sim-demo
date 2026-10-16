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
uniform sampler2D referenceImage;
uniform float blend;
uniform float time;
uniform float wind;
uniform vec2 scale;
uniform vec2 offset;
uniform vec2 pointer;
uniform float pointerForce;
uniform vec4 ripples[12];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec2 q=uv*scale+offset;
 vec3 masks=texture2D(motionMask,q).rgb;
 vec3 reference=texture2D(referenceImage,q).rgb;
 // Refine foliage by colour in the daylight reference, so sky and stone stay still in every scene.
 float vegetation=smoothstep(.005,.075,reference.g-reference.b*.98)*smoothstep(.69,.9,reference.g/(reference.r+.001));
 float bushes=masks.g*vegetation;
 float leaves=masks.b*vegetation;
 float water=masks.r;
 float gust=.45+wind*.7;
 float field=noise(vec2(q.x*7.-time*.25,q.y*8.+time*.1));
 float branch=sin(time*1.35+q.x*8.)*.65+sin(time*.73+q.x*14.+q.y*4.)*.35;
 float flutter=(noise(q*vec2(110.,85.)+vec2(time*.6,-time*.9))-.5);
 float localWind=branch*gust+(field-.5)*.9;
 float influence=exp(-dot((q-pointer)*vec2(1.,1.78),(q-pointer)*vec2(1.,1.78))*150.)*pointerForce;
 // Coherent, slow branch movement with independent small leaf flutter. No vertical rubber-sheet stretch.
 vec2 foliageMotion=vec2((localWind*.00155+flutter*.0012)*(bushes*.8+leaves),
                         (localWind*.00012+flutter*.0003)*(bushes+leaves));
 foliageMotion+=vec2(sin(time*3.+q.x*32.)*.0021,cos(time*2.3+q.y*23.)*.0004)*influence*max(bushes,leaves);
 // Multiple crossing capillary waves deform reflections, confined to the water surface.
 float w1=sin(q.x*210.+q.y*365.-time*2.4);
 float w2=sin(q.x*345.-q.y*226.+time*1.8);
 float w3=sin(q.x*580.+q.y*110.-time*3.2+noise(q*18.+time*.12)*3.);
 vec2 surface=vec2(w1*.00063+w2*.00042+w3*.0002,w1*.00018-w2*.00012);
 float glint=0.;
 for(int i=0;i<12;i++){
   vec4 r=ripples[i]; float age=time-r.z;
   vec2 delta=(q-r.xy)*vec2(1.,3.4);
   float distance=length(delta);
   float front=distance-age*.045;
   float envelope=exp(-front*front/0.00032)*exp(-age*.63)*step(0.,age)*r.w;
   float wave=sin(front*360.);
   vec2 direction=delta/(distance+.001);
   surface+=direction*vec2(.0011,.00025)*wave*envelope;
   glint+=wave*envelope*.008;
 }
 vec2 samplePoint=clamp(q+foliageMotion+surface*water,0.,1.);
 vec3 colour=mix(texture2D(currentImage,samplePoint).rgb,texture2D(nextImage,samplePoint).rgb,blend);
 colour+=water*(glint+(w1+w2+w3)*.0025);
 gl_FragColor=vec4(colour,1.);
}
`;
