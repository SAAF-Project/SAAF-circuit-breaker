"""Generate real neural narration plus provider-derived word timings."""
import asyncio
import json
import os
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent
BIN = Path('/Users/brightech/.hermes/cache/scratch/saaf-video-tools/bin')
os.environ['PATH'] = str(BIN) + os.pathsep + os.environ['PATH']

async def main():
    brief = json.loads((ROOT/'brief.json').read_text())
    folder = ROOT/'audio'
    folder.mkdir(exist_ok=True)
    timeline = []
    for index, shot in enumerate(brief['shots']):
        target = folder/f"{index:02d}-{shot['id']}.mp3"
        marks = []
        if target.exists() and target.with_suffix('.json').exists():
            marks = json.loads(target.with_suffix('.json').read_text())
        else:
            communicator = edge_tts.Communicate(shot['narration'], voice='en-US-AndrewMultilingualNeural',
                rate='-2%', boundary='WordBoundary', connect_timeout=15, receive_timeout=30)
            with target.open('wb') as audio:
                async for chunk in communicator.stream():
                    if chunk['type'] == 'audio': audio.write(chunk['data'])
                    elif chunk['type'] == 'WordBoundary':
                        marks.append({k:chunk[k] for k in ['offset','duration','text']})
            if not target.stat().st_size or not marks: raise RuntimeError(f"No real speech/timings for {shot['id']}")
            target.with_suffix('.json').write_text(json.dumps(marks,indent=2))
        probe = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(target)],capture_output=True,text=True,check=True)
        duration = float(json.loads(probe.stdout)['format']['duration'])
        timeline.append({**shot,'index':index,'audio':str(target),'speech_duration':duration,'words':marks})
        print(shot['id'],round(duration,3),'seconds',len(marks),'timed words',flush=True)
    total = sum(s['speech_duration'] for s in timeline)
    (ROOT/'narration-timeline.json').write_text(json.dumps(timeline,indent=2))
    (ROOT/'narration.txt').write_text('\n\n'.join(s['narration'] for s in timeline))
    print('TOTAL_NARRATION_SECONDS',round(total,3),flush=True)

if __name__=='__main__': asyncio.run(main())
