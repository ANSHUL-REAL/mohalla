"""
encode.py - turn the screencast frames recorded by record.mjs into clean 30 fps H.264 clips.

  python encode.py            # encodes every frames/<clip>.json -> public/clips/<clip>.mp4
  python encode.py 07_owner   # only that clip

Frames arrive with variable timing (Chrome only sends a frame when the page repaints), so each JPEG is
held for exactly as long as it was on screen; paused sections (page loads) are cut out. Also writes
src/clips.json (clip -> duration in seconds) which the Remotion composition reads.
"""
import json, os, subprocess, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
FR = os.path.join(HERE, 'frames')
OUT = os.path.join(HERE, 'public', 'clips')
os.makedirs(OUT, exist_ok=True)
manifest_path = os.path.join(HERE, 'src', 'clips.json')
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}

want = sys.argv[1:]
for meta_path in sorted(glob.glob(os.path.join(FR, '*.json'))):
    clip = os.path.splitext(os.path.basename(meta_path))[0]
    if want and clip not in want:
        continue
    m = json.load(open(meta_path))
    frames, cuts = m['frames'], m.get('cuts', [])
    if not frames:
        print('no frames', clip); continue

    def cut_between(a, b):
        return sum(max(0, min(b, ce) - max(a, cs)) for cs, ce in cuts)

    lines, total = [], 0.0
    for i, f in enumerate(frames):
        t_next = frames[i + 1]['t'] if i + 1 < len(frames) else m['end']
        d = max(0.001, t_next - f['t'] - cut_between(f['t'], t_next))
        total += d
        lines.append(f"file '{os.path.join(FR, clip, f['f']).replace(os.sep, '/')}'\nduration {d:.4f}")
    lines.append(f"file '{os.path.join(FR, clip, frames[-1]['f']).replace(os.sep, '/')}'")
    lst = os.path.join(FR, clip + '.txt')
    open(lst, 'w').write('\n'.join(lines) + '\n')
    size = '780:1688' if m.get('mobile') else '1920:1080'
    out = os.path.join(OUT, clip + '.mp4')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
           '-vf', f'scale={size}:flags=lanczos,fps=30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
           '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    manifest[clip] = round(total, 2)
    print(f'{clip}: {total:.1f}s -> {out}')

json.dump(dict(sorted(manifest.items())), open(manifest_path, 'w'), indent=2)
