# Generates assets/bed.wav: a soft synth pad, sub bass, pulse and two hits, timed to the film's cuts.
import numpy as np, wave, sys
SR = 48000
DUR = 32.5
TITLE, PULSE_IN, END = 4.0, 7.5, 28.0
BEAT = 60 / 96
n = int(SR * DUR)
t = np.arange(n) / SR
L = np.zeros(n); R = np.zeros(n)

def note(m): return 440 * 2 ** ((m - 69) / 12)
def env(x, a, r, length):
    e = np.clip(x / a, 0, 1) * np.clip((length - x) / r, 0, 1)
    return e

# F - C - G - Am, 4 beats each, voiced warm and low
chords = [[53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67], [57, 60, 64, 69]]
step = 4 * BEAT
k = 0
start = 0.0
while start < DUR:
    ch = chords[k % 4]
    length = min(step + 0.6, DUR - start)
    i0 = int(start * SR); i1 = min(n, i0 + int(length * SR))
    x = t[i0:i1] - start
    e = env(x, 0.9, 0.8, length)
    for m in ch:
        f = note(m)
        for det, side in ((-0.12, 0), (0.12, 1)):
            ff = f * 2 ** (det / 12)
            s = np.sin(2 * np.pi * ff * x) + 0.35 * np.sin(4 * np.pi * ff * x) + 0.12 * np.sin(6 * np.pi * ff * x)
            (L if side == 0 else R)[i0:i1] += 0.05 * e * s
    # sub bass on the root, from the title on
    if start >= TITLE - 0.01:
        b = note(ch[0] - 12)
        L[i0:i1] += 0.16 * e * np.sin(2 * np.pi * b * x); R[i0:i1] += 0.16 * e * np.sin(2 * np.pi * b * x)
    start += step; k += 1

# soft kick on every beat from PULSE_IN to END
def kick(at, amp=0.55):
    i0 = int(at * SR); m = int(0.35 * SR); x = np.arange(m) / SR
    f = 50 + 90 * np.exp(-x * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 9) * amp
    i1 = min(n, i0 + m); L[i0:i1] += s[:i1 - i0]; R[i0:i1] += s[:i1 - i0]
b = PULSE_IN
while b < END - 0.05:
    kick(b); b += BEAT

# shimmer hats on off-beats
rng = np.random.default_rng(7)
b = PULSE_IN + BEAT / 2
while b < END - 0.05:
    i0 = int(b * SR); m = int(0.08 * SR); x = np.arange(m) / SR
    s = rng.standard_normal(m) * np.exp(-x * 60) * 0.05
    s = np.diff(np.concatenate([[0], s]))  # brighten
    i1 = min(n, i0 + m); L[i0:i1] += s[:i1 - i0]; R[i0:i1] += s[:i1 - i0] * 0.8
    b += BEAT

# riser into the end card
r0 = END - 1.6; i0 = int(r0 * SR); i1 = int(END * SR); x = t[i0:i1] - r0
noise = rng.standard_normal(i1 - i0)
sweep = np.sin(2 * np.pi * np.cumsum(200 + 1800 * (x / 1.6) ** 2) / SR)
rs = (0.04 * noise + 0.05 * sweep) * (x / 1.6) ** 2
L[i0:i1] += rs; R[i0:i1] += rs

# impacts: title logo and end card
def hit(at, amp):
    i0 = int(at * SR); m = int(2.5 * SR); x = np.arange(m) / SR
    f = 40 + 120 * np.exp(-x * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 2.2) * amp
    s += rng.standard_normal(m) * np.exp(-x * 14) * amp * 0.12
    i1 = min(n, i0 + m); L[i0:i1] += s[:i1 - i0]; R[i0:i1] += s[:i1 - i0]
hit(TITLE + 0.1, 0.6)
hit(END, 0.8)

# master fade in/out and normalize
fade = np.clip(t / 0.4, 0, 1) * np.clip((DUR - t) / 2.0, 0, 1)
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / peak * 0.89, R / peak * 0.89
out = np.stack([L, R], 1)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
