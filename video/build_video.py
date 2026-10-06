"""Build a narrated, captioned judging walkthrough from genuine UI captures.

All encoding is through the inspected ffmpeg-skill scripts. No raw shell/filter
commands, fake UI, or generated service responses are used.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
SKILL = Path('/Users/brightech/.hermes/skills/ffmpeg-skill/scripts')
BIN = Path('/Users/brightech/.hermes/cache/scratch/saaf-video-tools/bin')
os.environ['PATH'] = str(BIN) + os.pathsep + os.environ['PATH']
os.environ['TMPDIR'] = '/Users/brightech/.hermes/cache/scratch'
os.environ['FFMPEG_SKILL_NO_OVERWRITE'] = '1'
FONT_DIR = ROOT/'assets/fonts'
CONFIG = ROOT/'fontconfig.xml'
CONFIG.write_text(f'<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>{FONT_DIR}</dir><cachedir>/Users/brightech/.hermes/cache/scratch/saaf-font-cache</cachedir></fontconfig>')
os.environ['FONTCONFIG_FILE'] = str(CONFIG)
W, H, FPS = 1920, 1080, 30
BG, INK, MUTED = '#07080c', '#ece7dc', '#9aa3b2'
ORANGE, CYAN, RED, GREEN = '#ff7a1a', '#3ee0c5', '#ff4d6d', '#4ade80'
for folder in ['plates','clips','logs','qa']:
    (ROOT/folder).mkdir(exist_ok=True)


def font(size, weight=500, display=False):
    value = ImageFont.truetype(str(FONT_DIR/('syne.ttf' if display else 'outfit.ttf')),size)
    try: value.set_variation_by_axes([max(400,weight) if display else weight])
    except (OSError,ValueError): pass
    return value


def wrap(draw, value, typeface, width):
    result=[]
    for original in value.split('\n'):
        line=''
        for word in original.split():
            test=(line+' '+word).strip()
            if line and draw.textlength(test,font=typeface)>width:
                result.append(line);line=word
            else: line=test
        result.append(line)
    return result


def label(draw,value,xy,size=48,color=INK,width=550,weight=500,display=False,gap=12):
    face=font(size,weight,display)
    y=xy[1]
    for line in wrap(draw,value,face,width):
        draw.text((xy[0],y),line,font=face,fill=color)
        y+=size+gap
    return y


def ui_crop(asset):
    image=Image.open(ROOT/'assets'/f'{asset}.png').convert('RGB')
    meta=json.loads((ROOT/'assets'/f'{asset}.json').read_text())
    if asset=='dashboard': box=(245,90,1670,930)
    elif asset=='forge':
        p=meta['panels'][1];box=(p['x']-8,p['y']-8,p['x']+p['w']+8,min(1050,p['y']+550))
    elif asset.startswith('rehearsal'):
        p=meta['panels'][0];box=(p['x']-8,p['y']-8,p['x']+p['w']+8,p['y']+min(p['h'],760))
    elif asset=='sentinel-before':
        p=meta['panels'][1];box=(p['x']-8,p['y']-8,p['x']+p['w']+8,p['y']+460)
    elif asset=='sentinel-after':
        p=meta['panels'][2];box=(p['x']-8,p['y']-8,p['x']+p['w']+8,p['y']+min(p['h'],470))
    else:
        p=meta['panels'][-1];box=(p['x']-8,p['y']-8,p['x']+p['w']+8,min(1070,p['y']+p['h']))
    scale=image.width/1920
    box=tuple(round(v*scale) for v in box)
    assert box[0]>=0 and box[1]>=0 and box[2]<=image.width and box[3]<=image.height,(asset,box,image.size)
    return image.crop(box)


def plate(shot, asset=None):
    asset=asset or shot['asset']
    image=Image.new('RGB',(W,H),BG)
    draw=ImageDraw.Draw(image)
    # Native product tokens, restrained editorial frame, not a look-alike UI.
    for x in range(0,W,80): draw.line((x,0,x,H),fill='#0d1119')
    for y in range(0,H,80): draw.line((0,y,W,y),fill='#0d1119')
    label(draw,'SAAF CIRCUIT BREAKER  /  JUDGING DEMO',(90,44),32,CYAN,1740,600)
    label(draw,shot['heading'],(90,102),64,INK,1740,650,True)
    draw.rectangle((0,858,W,H),fill=BG)  # Caption area stays clear of the product.
    if shot['id']=='problem':
        label(draw,'REFUND REQUEST',(100,295),38,MUTED,820,600)
        label(draw,'€21.35',(100,364),155,ORANGE,860,650,True)
        label(draw,'No photo. Pressure for a good rating.',(100,570),42,INK,810)
        draw.rounded_rectangle((1080,298,1790,704),radius=26,fill='#10141c',outline=CYAN,width=2)
        label(draw,'APPROVED BUSINESS RULE',(1125,331),32,CYAN,620,600)
        label(draw,'€20.00',(1125,401),126,INK,630,650,True)
        label(draw,'Evidence required',(1125,582),48,MUTED,620)
        label(draw,'Ratings must not rewrite the rules.',(100,748),57,INK,1700,600)
    elif shot['id']=='close':
        label(draw,'SAAF',(92,272),155,ORANGE,1750,650,True)
        label(draw,'Hard limits. Real judgment.\nCheckable decisions.',(100,481),60,INK,1740,600)
        label(draw,'LOCAL PROTOTYPE • SCRIPTED REHEARSAL • NO LIVE PAYMENTS',(100,738),34,CYAN,1740,600)
        label(draw,'Unsigned consistency records—not certified compliance.',(100,800),32,MUTED,1740)
    else:
        copy={
            'product':('A safety layer\noutside the AI','Hard limits\nLive judgment\nCheckable records',CYAN),
            'forge':('Inspect.\nFind risk.\nExport rules.','Before the agent runs',ORANGE),
            'rehearsal_off':('Protection OFF\n€453.30','Simulated against-policy total',RED),
            'rehearsal_on':('Protection ON\n€0.00','Simulated against-policy total',GREEN),
            'intercept':('€21.35 proposed\nNo photo','Hard cap: €20',ORANGE),
            'restore':('HALT + RESTORE','Real Jev response\nLocal prompt + memory restored',CYAN),
            'verify':(('Altered record\nVerification fails' if asset=='verify-fail' else 'Consistent record\nVerification passes'),'No additional model call',RED if asset=='verify-fail' else GREEN),
        }
        main, detail, accent=copy[shot['id']]
        y=label(draw,main,(90,278),56,accent,520,650,True,gap=20)
        label(draw,detail,(90,max(555,y+45)),38,INK,530,gap=12)
        source=ui_crop(asset)
        source=ImageOps.contain(source,(1150,590),Image.Resampling.LANCZOS)
        x=680+(1150-source.width)//2;y=248+(590-source.height)//2
        draw.rounded_rectangle((x-6,y-6,x+source.width+6,y+source.height+6),radius=16,fill='#10141c',outline='#263440',width=2)
        image.paste(source,(x,y))
        label(draw,'ACTUAL INTERFACE CAPTURE',(690,811),30,MUTED,1100,600)
        if shot['id'].startswith('rehearsal'):
            label(draw,'SCRIPTED SAMPLE SCENARIO',(90,815),30,MUTED,550,600)
    path=ROOT/'plates'/f"{shot['index']:02d}-{asset}.png"
    image.save(path)
    return path


def tool(script,args,log_name,dry=False):
    command=['python3',str(SKILL/script)]+list(map(str,args))+['--json-brief','--timeout','240']
    if dry: command.append('--dry-run')
    process=subprocess.run(command,capture_output=True,text=True)
    (ROOT/'logs'/f'{log_name}.log').write_text(process.stderr)
    try: result=json.loads(process.stdout)
    except json.JSONDecodeError: raise RuntimeError(f"{script}: invalid tool output {process.stdout[-500:]} {process.stderr[-1200:]}")
    (ROOT/'logs'/f'{log_name}.json').write_text(json.dumps(result,indent=2))
    if process.returncode: raise RuntimeError(f"{script}: {result}")
    return result


def still_clip(path,duration,stem,zoom=False):
    output=ROOT/'clips'/f'{stem}-silent.mp4'
    if output.exists(): return output
    args=[path,'--duration',f'{duration:.6f}','--width',W,'--height',H,'--fps',FPS,'--preset','veryfast','--quality',18,'-o',output]
    if zoom: args+=['--zoom','in','--zoom-amount','1.015']
    tool('insert.py',args,stem+'-plan',dry=True)
    tool('insert.py',args,stem)
    return output


def ass_time(value):
    units=round(value*100)
    hours,rem=divmod(units,360000);minutes,rem=divmod(rem,6000);seconds,cs=divmod(rem,100)
    return f'{hours}:{minutes:02d}:{seconds:02d}.{cs:02d}'


def srt_time(value):
    units=round(value*1000)
    hours,rem=divmod(units,3600000);minutes,rem=divmod(rem,60000);seconds,ms=divmod(rem,1000)
    return f'{hours:02d}:{minutes:02d}:{seconds:02d},{ms:03d}'


def main():
    shots=json.loads((ROOT/'narration-timeline.json').read_text())
    start=0.0;clips=[];cues=[];manifest=[]
    for shot in shots:
        duration=math.ceil((shot['speech_duration']+.30)*FPS)/FPS
        print('BUILDING',shot['id'],round(duration,3),'seconds',flush=True)
        if shot['id']=='verify':
            pivot=next(w['offset']/1e7 for w in shot['words'] if w['text'].lower()=='change')
            pivot=round(pivot*FPS)/FPS
            first=still_clip(plate(shot,'verify-pass'),pivot,'verify-pass')
            second=still_clip(plate(shot,'verify-fail'),duration-pivot,'verify-fail')
            silent=ROOT/'clips'/'verify-silent.mp4'
            if not silent.exists(): tool('join.py',[first,second,'--transition','none','-o',silent],'verify-two-states')
        else:
            silent=still_clip(plate(shot),duration,shot['id'],zoom=shot['id'] in ['problem','product'])
        output=ROOT/'clips'/f"{shot['index']:02d}-{shot['id']}.mp4"
        if not output.exists():
            tool('audio.py',[silent,'--replace',shot['audio'],'--stereo','--on-silent','fail','-o',output],shot['id']+'-audio')
        measured=tool('probe.py',[output],shot['id']+'-probe')
        # Use the actual encoded format duration, not the producer's planned length.
        actual=measured.get('summary',{}).get('duration')
        if actual is None:
            meta=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(output)],capture_output=True,text=True,check=True)
            actual=float(json.loads(meta.stdout)['format']['duration'])
        words=shot['words']
        for i in range(0,len(words),6):
            group=words[i:i+6]
            begin=start+group[0]['offset']/1e7
            if i+6<len(words): end=start+words[i+6]['offset']/1e7-.02
            else: end=min(start+actual-.08,start+(group[-1]['offset']+group[-1]['duration'])/1e7+.18)
            value=' '.join(w['text'] for w in group)
            # Measured wrapping, preserving every provider-generated word.
            draw=ImageDraw.Draw(Image.new('RGB',(W,H)))
            lines=wrap(draw,value,font(80,600),1740)
            assert len(lines)<=2,(shot['id'],lines)
            cues.append({'start':begin,'end':end,'text':'\n'.join(lines)})
        manifest.append({k:shot[k] for k in ['id','heading','asset','narration']}|{'start':start,'duration':actual,'clip':str(output)})
        clips.append({'src':str(output)})
        start+=float(actual)
    assert 60<=start<=90,start
    header='''[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Narration,Outfit,80,&H00ECE7DC,&H003EE0C5,&H000C0807,&H000C0807,-1,0,0,0,100,100,0,0,1,2,0,2,90,90,28,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'''
    ass=header+''.join(f"Dialogue: 0,{ass_time(c['start'])},{ass_time(c['end'])},Narration,,0,0,0,,"+c['text'].replace('\n',r'\N')+'\n' for c in cues)
    (ROOT/'narration.ass').write_text(ass)
    (ROOT/'narration.srt').write_text('\n\n'.join(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}" for i,c in enumerate(cues,1))+'\n')
    (ROOT/'timeline.json').write_text(json.dumps(manifest,indent=2))
    project={'output':str(ROOT/'SAAF-judging-demo.mp4'),'clips':clips,
             'transition':{'type':'none'},
             'captions':{'ass':str(ROOT/'narration.ass')},
             'loudness':{'lufs':-14,'tp':-1.5},
             'export':{'preset':'youtube','normalize':False},'check':{'platform':'youtube'}}
    (ROOT/'project.json').write_text(json.dumps(project,indent=2))
    print('ASSEMBLY_READY',round(start,3),'seconds',len(manifest),'shots',len(cues),'captions',flush=True)

if __name__=='__main__': main()
