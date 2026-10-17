"""Build a private side-by-side review from actual inspection outputs.

Run with the bundled Python (Pillow required) and a private evidence directory.
This composes evidence; it does not generate or retouch architectural content.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,csv,sys,html,math
root=Path(sys.argv[1]).resolve();font_path='/System/Library/Fonts/Supplemental/Arial.ttf'
def font(size):return ImageFont.truetype(font_path,size)
def pair(left,right,destination,title,labels,footer='',size=(1280,720)):
 w,h=size;canvas=Image.new('RGB',(w*2,h+140),'#f6f5f1');draw=ImageDraw.Draw(canvas);draw.text((24,12),title,font=font(28),fill='#172520')
 for x,file,label in [(0,left,labels[0]),(w,right,labels[1])]:
  draw.text((x+24,54),label,font=font(22),fill='#294f42');im=Image.open(file).convert('RGB');assert im.size==(w,h),(file,im.size,size);canvas.paste(im,(x,90))
 draw.text((24,h+105),footer,font=font(17),fill='#444444');canvas.save(root/destination)
def contact(files,name,columns=4,width=420):
 files=list(files);height=round(width*9/16)+30;out=Image.new('RGB',(width*columns,height*math.ceil(len(files)/columns)),'white');draw=ImageDraw.Draw(out)
 for i,path in enumerate(files):
  im=Image.open(path).convert('RGB');im.thumbnail((width,height-30));x=(i%columns)*width;y=(i//columns)*height;out.paste(im,(x,y));draw.text((x+5,y+height-24),path.stem.replace('orbit-browser-',''),font=font(13),fill='black')
 out.save(root/name)
views=['gable','entry','utility','band','front','right','rear','left','roof']
for view in views:
 pair(root/f'browser-before-{view}.jpg',root/f'browser-after-final-{view}.jpg',f'compare-before-after-{view}.png',view.title()+' | browser before / after',('Preserved original geometry / current renderer','Repaired geometry / same current renderer'),'Same preset camera, 38-degree vertical field of view; original files retained.')
 pair(root/f'blender-final-neutral-{view}.png',root/f'browser-after-neutral-{view}.jpg',f'compare-blender-browser-{view}.png',view.title()+' | authoring / delivered geometry',('Saved Blender source: solid geometry','Exact compressed browser asset: neutral geometry'),'Same camera and field of view; different render engines. Glass is opaque in neutral inspection.')
# Source rasters remain at their original scale. Only crop translation is used.
# Anchors: foyer slab line and shared roof ridge / stair wall plan datum.
ppm=1.5*18/.3048;model_zero_y=600+5.25*ppm
registration={
 'front':{'page':5,'crop_x':1296.08*1.5-(800+(6.6167-6.05155)*ppm),'datum_y':1133.26*1.5},
 'right':{'page':6,'crop_x':1133.66*1.5-(800+(7.9248-8.2296)*ppm),'datum_y':1177.48*1.5},
 'rear':{'page':7,'crop_x':1254.41*1.5-(800-(6.6167-6.05155)*ppm),'datum_y':1181.02*1.5},
 'left':{'page':8,'crop_x':1448.27*1.5-(800+(8.2296-5.4864)*ppm),'datum_y':1246.24*1.5},
}
for view,r in registration.items():
 x=round(r['crop_x']);y=round(r['datum_y']-model_zero_y);r['crop_pixels']=[x,y,x+1600,y+1200]
 ref=Image.open(root/f'plan-page-{r["page"]}.png').convert('RGB').crop(r['crop_pixels']);model=Image.open(root/f'elevation-model-{view}.png').convert('RGB')
 for im in [ref,model]:
  draw=ImageDraw.Draw(im)
  for z,label in [(0,'Foyer 0.000 m'),(2.95275,'F2 2.95275 m'),(6.2103,'F3 6.21030 m')]:
   line=round(model_zero_y-z*ppm);draw.line((0,line,1600,line),fill='#2c8a9e',width=1);draw.text((5,line-19),label,font=font(15),fill='#16748a')
 ref.save(root/f'elevation-reference-{view}.png');model.save(root/f'elevation-datums-{view}.png')
 pair(root/f'elevation-reference-{view}.png',root/f'elevation-datums-{view}.png',f'compare-reference-{view}.png',view.title()+' | architectural reference / actual model',(f'A2.{r["page"]-5}: drawing crop, original scale','Saved model: orthographic, same scale'),'88.5827 px/m from stated 1/4 in = 1 ft scale. Translation only; no best-fit stretching.',(1600,1200))
(root/'reference-registration.json').write_text(json.dumps(registration,indent=2))
for mode in ['final','neutral','materials']:contact(sorted(root.glob(f'orbit-browser-{mode}-*.jpg')),f'contact-orbit-browser-{mode}.jpg')
for key in ['gable','entry','utility','band']:
 contact(sorted(root.glob(f'motion-{key}-*.jpg')),f'contact-motion-{key}.jpg')
 frames=[Image.open(p).convert('RGB') for p in sorted(root.glob(f'motion-{key}-*.jpg'))]
 if frames:frames[0].save(root/f'motion-{key}.gif',save_all=True,append_images=frames[1:],duration=150,loop=0)
for label,mode in [('source','neutral'),('viewer','material')]:contact(sorted(root.glob(f'blender-orbit-{label}-{mode}-orbit-*.png')),f'contact-orbit-blender-{label}.jpg')
contact([root/f'browser-after-final-{v}.jpg' for v in views],'contact-browser-details.jpg',3,600)
measure=json.loads((root/'measurements.json').read_text());rows=measure['rows']
with (root/'measurements.csv').open('w',newline='') as file:
 writer=csv.DictWriter(file,fieldnames=sorted({k for r in rows for k in r}));writer.writeheader();writer.writerows(rows)
chosen=[r for r in rows if r['feature'] in [f'{id} aperture {dim}' for id in ['D1_entry','D1_golf_side','D1_garage_left','N3_vanity','N2_front1'] for dim in ['width','height']]]
chosen+=[next(r for r in rows if key in r['feature']) for key in ['F1 overall slab footprint width','F1 overall slab footprint depth','SL1_house plan width','SL1_house plan depth','SL1_garage plan width','SL2_house floor datum','SL3_house floor datum','W1_east batten pitch','W1_east full batten width','W1_east band height','W2_east band height','W1_east baseband height','Upper roof weather ridge datum','RF_main_gable pitch']]
canvas=Image.new('RGB',(1800,170+len(chosen)*54),'#f6f5f1');draw=ImageDraw.Draw(canvas);draw.text((25,20),'Dimension comparison | reference / saved Blender / delivered GLB',font=font(31),fill='#172520')
draw.text((25,65),f'{len(rows)} comparisons; {len(measure["critical_defects"])} failed. Metres unless rise/run. Full aperture positions and rows in CSV.',font=font(21),fill='#444')
for x,label in [(25,'Feature'),(700,'Drawing / binding'),(1000,'Blender'),(1240,'Browser GLB'),(1510,'Delta / status')]:draw.text((x,115),label,font=font(22),fill='#294f42')
for i,r in enumerate(chosen):
 y=155+i*54
 if i%2==0:draw.rectangle((15,y-4,1785,y+45),fill='#e6ebe5')
 unit=r.get('unit','m');values=[r['reference_m'],r['blender_m'],r['browser_m']]
 draw.text((25,y),r['feature'],font=font(20),fill='#18251f')
 for x,v in zip([700,1000,1240],values):draw.text((x,y),f'{v:.6f}'+(' ratio' if unit=='ratio' else ''),font=font(22),fill='#172520')
 delta=f'{r["max_delta_ratio"]:.2g} ratio' if unit=='ratio' else f'{r["max_delta_mm"]:.4f} mm'
 draw.text((1510,y),delta+' '+r['status'],font=font(19),fill='#17633d')
canvas.save(root/'compare-measurements.png')
def image_block(file,label):return f'<figure><a href="{file}"><img loading="lazy" src="{file}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>'
body='<h1>Exterior repair: visual and dimensional review</h1><p>Architectural drawings control this review. The rejected rendering is excluded. All files stay local.</p><nav><a href="#reference">Reference / actual</a> · <a href="#dimensions">Dimensions</a> · <a href="#before">Before / after</a> · <a href="#transfer">Blender / browser</a> · <a href="#orbit">Orbits</a></nav>'
body+='<h2 id="reference">All four elevations: reference beside actual geometry</h2><p>Same stated paper scale, orthographic projection, shared floor datums. Source crops are translated only. These drawings contain unresolved height conflicts; visual similarity is not a construction certification.</p>'
for v in ['front','right','rear','left']:body+=image_block(f'compare-reference-{v}.png',v.title()+' elevation')
body+='<h2 id="dimensions">Measured dimensions beside reference targets</h2><p>Actual saved structural faces and decoded GLB triangles were intersected at aperture midwidth and midheight. Floor-level apertures use measured slab datums. This verifies preservation of reviewed nominal coordinates; manufacturer rough openings remain unverified.</p>'+image_block('compare-measurements.png','Key dimensional comparisons')+'<p><a href="measurements.csv">All measurements CSV</a> · <a href="measurements.json">Methods, targets, measurements and limitations JSON</a></p><details><summary>All '+str(len(rows))+' measured comparisons</summary><table><tr><th>Feature</th><th>Reference</th><th>Blender</th><th>GLB</th><th>Status</th></tr>'
for r in rows:body+='<tr>'+''.join('<td>'+html.escape(str(r[k]))+'</td>' for k in ['feature','reference_m','blender_m','browser_m','status'])+'</tr>'
body+='</table></details><h2 id="before">Matching browser before / after</h2>'
for v in views:body+=image_block(f'compare-before-after-{v}.png',v.title())
body+='<h2 id="transfer">Saved Blender geometry beside delivered browser geometry</h2>'
for v in views:body+=image_block(f'compare-blender-browser-{v}.png',v.title())
body+='<h2 id="orbit">Full exterior orbit inspection</h2><p>Browser: 24 steps per shading mode. Blender: 12 solid-source and 12 physical-material demo views. Contact sheets link to individual frames below.</p>'
for mode in ['final','neutral','materials']:body+=image_block(f'contact-orbit-browser-{mode}.jpg','Browser '+mode)
for label in ['source','viewer']:body+=image_block(f'contact-orbit-blender-{label}.jpg','Blender '+label)
for key in ['gable','entry','utility','band']:body+=image_block(f'contact-motion-{key}.jpg','Close motion: '+key)+f'<p><a href="motion-{key}.gif">Animated 0.5-degree camera sequence</a></p>'
body+='<h2>Dark proposed finish and grazing sun</h2>'
for name in ['dark-gable.jpg','dark-utility.jpg','dark-band.jpg','dark-right.jpg','dark-golden-gable.jpg','door-customization.jpg']:body+=image_block(name,name)
body+='<details><summary>Individual orbit frames</summary>'
for p in sorted(root.glob('orbit-browser-*.jpg')):body+=f'<a href="{p.name}">{p.stem}</a> · '
body+='</details><h2>Unresolved source information</h2><ul>'
for item in measure['limitations']:body+='<li>'+html.escape(item)+'</li>'
body+='</ul><p>See <a href="change-record.json">change record</a> and <a href="visual-review.json">visual review</a> for exact files, edited objects, verification scope, and remaining limitations.</p>'
(root/'review.html').write_text('<!doctype html><meta charset="utf-8"><title>Local exterior repair review</title><style>body{font:17px Arial;line-height:1.5;margin:30px auto;max-width:1500px;padding:0 20px;background:#f6f5f1;color:#172520}img{width:100%;height:auto}figure{margin:25px 0}nav{position:sticky;top:0;background:#edf2ea;padding:12px}a{color:#236e62}table{border-collapse:collapse;width:100%;font:13px monospace}td,th{padding:6px;border-bottom:1px solid #ccc;text-align:left}h2{margin-top:50px}</style>'+body)
print('Built reference, before/after, transfer, orbit, and measurement comparisons in',root)
