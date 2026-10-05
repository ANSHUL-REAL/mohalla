"""Launch video soundtrack: original synthesized music + voiceover + sound effects, mixed and timed.

Inputs:  public/launch/v0.wav .. v8.wav  (voiceover lines, silence-trimmed, 48 kHz)
Outputs: public/launch/mix.wav            (final soundtrack for the Launch composition)
         src/launch.json                  (scene start times and word cues, read by src/Launch.jsx)
Run: python build_audio.py   then   npm run render:launch
The music is generated here from scratch (drums, bass, chords, arpeggio), so there is no licensing to worry about.
"""
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = Path(__file__).parent
LAUNCH = ROOT / "public" / "launch"
SR = 48000
BPM = 120
BEAT = 60 / BPM
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- voiceover + timeline

def load(name):
    sr, x = wavfile.read(LAUNCH / name)
    x = x.astype(np.float32) / (32768 if x.dtype == np.int16 else 1)
    if x.ndim > 1:
        x = x.mean(axis=1)
    assert sr == SR, f"{name}: expected {SR} Hz"
    return x


def cut(x, a, b, fade=0.02):
    """Remove x[a:b] (seconds) with a short crossfade: shortens long pauses."""
    i, j, f = int(a * SR), int(b * SR), int(fade * SR)
    head, tail = x[:i].copy(), x[j:].copy()
    ramp = np.linspace(1, 0, f)
    head[-f:] *= ramp
    tail[:f] *= ramp[::-1]
    return np.concatenate([head, tail])


vo = [load(f"v{i}.wav") for i in range(9)]
vo[0] = cut(vo[0], 1.85, 3.80)   # the voice model read the "..." as gibberish (2.1-3.6 s); keep both real phrases
vo[5] = cut(vo[5], 2.25, 3.25)   # "...when they're free. [pause] Right now."
vo[7] = cut(vo[7], 0.98, 2.47)   # "On the web. [pause] And on Android."
dur = [len(v) / SR for v in vo]

DROP = 6.2                      # beat drop on "Meet Mohalla"
GAP, LEAD = 0.75, 0.3           # pause between lines; scene starts this long before its line
starts = [1.3, DROP + 0.25]
for i in range(2, 9):
    starts.append(starts[-1] + dur[i - 1] + GAP)
starts[8] += 0.2                # a beat more air before the end card
scene = [0.0, DROP] + [s - LEAD for s in starts[2:]]
END_CARD = scene[8]
TOTAL = round(starts[8] + dur[8] + 2.8, 2)

cues = {
    "problem1": starts[0], "problem2": starts[0] + 1.97,
    "chipAC": starts[2] + 3.0, "chipOpen": starts[2] + 7.59, "chipNear": starts[2] + 8.52,
    "noSpam": starts[4] + 1.79, "ever": starts[4] + 3.47,
    "rightNow": starts[5] + 2.25, "web": starts[7], "android": starts[7] + 1.26,
    "tagline": starts[8] + 1.2,
}
N = int(TOTAL * SR)


def place(track, x, at, gain=1.0):
    i = int(at * SR)
    j = min(len(track), i + len(x))
    if j > i:
        track[i:j] += x[: j - i] * gain


voice = np.zeros(N, np.float32)
for s, v in zip(starts, vo):
    place(voice, v, s)

# ---------------------------------------------------------------- synth building blocks

def tt(seconds):
    return np.arange(int(seconds * SR)) / SR


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lowpass(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "low", fs=SR, output="sos"), x)


def highpass(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def saw(f, seconds, detune_cents=0.0):
    """Band-limited sawtooth (additive), so it sounds clean rather than buzzy."""
    t = tt(seconds)
    f = f * 2 ** (detune_cents / 1200)
    out = np.zeros_like(t)
    for k in range(1, max(2, min(28, int(15000 / f)))):
        out += np.sin(2 * np.pi * k * f * t + k) / k
    return out * 0.55


def env(seconds, attack=0.005, decay=0.2):
    t = tt(seconds)
    return np.minimum(1, t / attack) * np.exp(-t / decay)


def kick(length=0.45, boom=1.0):
    t = tt(length)
    pitch = 48 + 110 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t / (0.16 * boom))
    click = highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.6 * (body + click))


def clap():
    n = rng.standard_normal(int(0.3 * SR))
    e = np.zeros_like(n)
    for off in (0.0, 0.011, 0.022):
        e += np.roll(env(0.3, 0.001, 0.012), int(off * SR))
    e += np.roll(env(0.3, 0.001, 0.09), int(0.03 * SR)) * 0.6
    return bandpass(n, 900, 5000) * e * 0.7


def hat(open_=False):
    d = 0.22 if open_ else 0.035
    n = highpass(rng.standard_normal(int((d * 4) * SR)), 7000, 4)
    return n * env(d * 4, 0.001, d) * (0.35 if open_ else 0.45)


def stab(notes, length=0.32):
    x = sum(saw(hz(m), length, c) for m in notes for c in (-7, 0, 7))
    return lowpass(x, 3200) * env(length, 0.004, 0.11) * 0.22


def pad(notes, seconds, cutoff=1400):
    x = sum(saw(hz(m), seconds, c) for m in notes for c in (-9, 4))
    a = np.minimum(1, tt(seconds) / 0.35) * np.minimum(1, (seconds - tt(seconds)) / 0.3)
    return lowpass(x, cutoff, 2) * a * 0.09


def bell(m, length=0.28):
    t = tt(length)
    f = hz(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3.01 * f * t)
    return x * env(length, 0.002, 0.09) * 0.16


def bass(m, length):
    t = tt(length)
    f = hz(m)
    x = np.sin(2 * np.pi * f * t) + 0.25 * lowpass(saw(f, length), 700)
    return np.tanh(1.4 * x) * env(length, 0.004, 0.16) * 0.42


def reverb(x, seconds=1.4, mix=0.25):
    ir_t = tt(seconds)
    ir = lowpass(rng.standard_normal(len(ir_t)), 5000) * np.exp(-ir_t / (seconds / 5))
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(x, ir)[: len(x)]
    return x * (1 - mix) + wet * mix


def riser(seconds):
    t = tt(seconds)
    noise = rng.standard_normal(len(t))
    y = np.zeros_like(noise)
    acc = 0.0
    cut_hz = 300 * (8000 / 300) ** (t / seconds)          # one-pole low-pass sweeping up
    alpha = 1 - np.exp(-2 * np.pi * cut_hz / SR)
    for i in range(len(noise)):
        acc += alpha[i] * (noise[i] - acc)
        y[i] = acc
    sweep = np.sin(2 * np.pi * np.cumsum(220 * 4 ** (t / seconds)) / SR) * 0.15
    return (y * 0.5 + sweep) * (t / seconds) ** 2


def impact():
    t = tt(2.2)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.55)
    crash = highpass(rng.standard_normal(len(t)), 4000) * np.exp(-t / 0.6) * 0.25
    return np.tanh(1.3 * boom) * 0.9 + crash


def whoosh(seconds=0.42):
    t = tt(seconds)
    n = rng.standard_normal(len(t))
    shape = np.sin(np.pi * t / seconds) ** 2
    return (bandpass(n, 400, 2500) * 0.6 + highpass(n, 3000) * 0.3) * shape * 0.35


def pop():
    t = tt(0.12)
    f = 700 + 900 * np.minimum(1, t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.12, 0.001, 0.035) * 0.5


# ---------------------------------------------------------------- arrangement

drums = np.zeros(N)
music = np.zeros(N)       # chords, bass, arps (side-chained by the kick)
fx = np.zeros(N)

CHORDS = [  # A minor: Am - F - C - G, one bar (4 beats) each
    ([57, 60, 64], 45, [69, 72, 76, 81]),
    ([53, 57, 60], 41, [65, 69, 72, 77]),
    ([55, 60, 64], 48, [67, 72, 76, 79]),
    ([55, 59, 62], 43, [67, 71, 74, 79]),
]
BAR = 4 * BEAT

# Intro (problem): dark pad, ticking hats, riser into the drop
place(music, pad([57, 60, 64], DROP - 0.1, 900), 0.05, 0.9)
place(music, pad([45, 52], DROP - 0.1, 500), 0.05, 1.2)
for k in range(int(DROP / BEAT * 2)):
    place(drums, hat(), k * BEAT / 2, 0.35 if k % 2 else 0.6)
place(fx, riser(1.6), DROP - 1.6, 0.55)
place(fx, impact(), DROP, 0.8)

# Groove: from the drop to the end card
side = np.ones(N)
t = DROP
bar = 0
while t < END_CARD - 0.01:
    notes, root, arp = CHORDS[bar % 4]
    bar_len = min(BAR, END_CARD - t)
    place(music, pad(notes, bar_len + 0.05, 1800), t, 0.8)
    for b in range(4):
        bt = t + b * BEAT
        if bt >= END_CARD:
            break
        place(drums, kick(), bt, 0.95)
        i = int(bt * SR)
        d = int(0.22 * SR)
        side[i:i + d] = np.minimum(side[i:i + d], 0.35 + 0.65 * np.linspace(0, 1, len(side[i:i + d])) ** 0.6)
        if b in (1, 3):
            place(drums, clap(), bt, 0.55)
        place(drums, hat(open_=True), bt + BEAT / 2, 0.5)
        place(music, stab(notes), bt + BEAT / 2, 1.0)
        place(music, bass(root, BEAT / 2 * 0.95), bt + BEAT / 2, 1.0)
        for s in range(4):
            place(drums, hat(), bt + s * BEAT / 4, 0.25 + (0.15 if s == 2 else 0))
            if bar >= 2:                       # arpeggio joins after the logo reveal
                place(music, bell(arp[(b * 4 + s) % 4] + (12 if s == 3 else 0)), bt + s * BEAT / 4, 0.9)
    t += BAR
    bar += 1

music *= side
music = reverb(music, 1.6, 0.22)
drums = reverb(drums, 0.8, 0.08)

# End card: final hit and a ringing chord, fading out
place(fx, impact(), END_CARD, 0.9)
place(drums, kick(0.9, 2.5), END_CARD, 1.0)
outro = reverb(np.concatenate([pad([57, 60, 64, 69], TOTAL - END_CARD - 0.2, 2200), np.zeros(SR)]), 2.5, 0.35)
place(music, outro, END_CARD, 1.4)
for k, m in enumerate([69, 72, 76, 81, 84]):
    place(music, reverb(np.concatenate([bell(m, 0.6), np.zeros(SR)]), 2.0, 0.4), END_CARD + 0.18 * k, 1.6)

# Sound effects on scene changes and pop-ups
for s in scene[2:]:
    place(fx, whoosh(), s - 0.2, 0.9)
for key in ("chipAC", "chipOpen", "chipNear", "noSpam", "ever", "rightNow", "web", "android"):
    place(fx, pop(), cues[key], 0.55)

# ---------------------------------------------------------------- mix

bed = drums * 0.55 + music * 0.75 + fx * 0.7
bed /= np.max(np.abs(bed)) + 1e-9

# Duck the music while the narrator speaks (smoothed envelope of the voice)
level = np.abs(voice)
win = int(0.12 * SR)
level = np.convolve(level, np.ones(win) / win, mode="same")
speaking = np.clip(level / 0.02, 0, 1)
release = int(0.35 * SR)
duck = 1 - 0.55 * np.convolve(speaking, np.ones(release) / release, mode="same")

fade = np.ones(N)
fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR))
mix = (bed * 0.42 * duck + voice * 1.0) * fade
mix = np.tanh(mix * 1.1) / np.tanh(1.1)          # gentle limiter
mix /= np.max(np.abs(mix)) / 0.89

stereo = np.stack([mix, mix], axis=1)
wavfile.write(LAUNCH / "mix.wav", SR, (stereo * 32767).astype(np.int16))

json.dump({"total": TOTAL, "scene": [round(s, 3) for s in scene], "vo": [round(s, 3) for s in starts],
           "cues": {k: round(v, 3) for k, v in cues.items()}},
          open(ROOT / "src" / "launch.json", "w"), indent=2)
print(f"mix.wav written: {TOTAL:.1f} s; scenes at", [round(s, 2) for s in scene])
