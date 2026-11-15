#!/usr/bin/env python3
"""Özgün oyun havası (Hicaz, 2/4) — zurna, klarnet, bağlama, davul, darbuka tamamen sentez.
   python3 synth.py party out.wav   |   python3 synth.py chase out.wav"""
import sys, numpy as np, wave
SR = 44100
rng = np.random.default_rng(7)

def note_hz(n):
    names = {'C':-9,'C#':-8,'Db':-8,'D':-7,'D#':-6,'Eb':-6,'E':-5,'F':-4,'F#':-3,'Gb':-3,'G':-2,'G#':-1,'Ab':-1,'A':0,'A#':1,'Bb':1,'B':2}
    p, o = (n[:-1], int(n[-1]))
    return 440.0 * 2 ** ((names[p] + (o-4)*12) / 12)

def adsr(n, a, d, s, r):
    e = np.ones(n) * s; A = min(n, int(a*SR)); D = min(n-A, int(d*SR)); R = min(n, int(r*SR))
    e[:A] = np.linspace(0, 1, A, endpoint=False); e[A:A+D] = np.linspace(1, s, D, endpoint=False)
    if R: e[-R:] *= np.linspace(1, 0, R)
    return e

def reed(f, dur, bright=1.0, vib=5.5, vdep=0.012, nasal=(1300, 2600), odd=False, att=0.015, slide=0.0):
    """Çift kamış (zurna) / tek kamış (klarnet) — harmonik toplamı + formant ağırlığı + vibrato"""
    n = int(dur*SR); t = np.arange(n)/SR
    vibr = 1 + vdep*np.sin(2*np.pi*vib*t + rng.random()*6) * np.clip(t/0.12, 0, 1)
    fr = f * vibr
    if slide: fr *= 1 + slide*np.exp(-t/0.03)
    ph = 2*np.pi*np.cumsum(fr)/SR
    out = np.zeros(n)
    for k in range(1, 40):
        hk = f*k
        if hk > SR/2.3: break
        if odd and k % 2 == 0: amp = 0.12/k
        else: amp = 1.0/k**(0.85/bright)
        w = 1.0
        for fc in nasal: w += 1.6*np.exp(-((hk-fc)/(fc*0.35))**2)
        out += amp*w*np.sin(k*ph)
    out *= adsr(n, att, 0.05, 0.85, min(0.05, dur*0.3))
    breath = rng.standard_normal(n)*0.02*adsr(n, 0.01, 0.05, 0.4, 0.03)
    return out/12 + breath

def pluck(f, dur, damp=0.996):
    """Bağlama — Karplus-Strong telli + hafif tını"""
    n = int(dur*SR); N = max(2, int(SR/f)); buf = rng.uniform(-1, 1, N); out = np.zeros(n)
    buf = np.convolve(buf, [0.5, 0.5], 'same')
    for i in range(n):
        out[i] = buf[i % N]; buf[i % N] = damp*0.5*(buf[i % N] + buf[(i+1) % N])
    return out*0.5*adsr(n, 0.002, 0.1, 0.8, 0.04)

def davul_dum(dur=0.5):
    n = int(dur*SR); t = np.arange(n)/SR; f = 55 + 60*np.exp(-t/0.04)
    body = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/0.22)
    skin = rng.standard_normal(n)*np.exp(-t/0.012)*0.4
    return np.tanh(1.6*(body + skin))*0.9

def davul_tek(dur=0.12):  # çubuk (ince sopa) — kuru tak
    n = int(dur*SR); t = np.arange(n)/SR
    x = rng.standard_normal(n)*np.exp(-t/0.018); x = np.convolve(x, np.ones(3)/3, 'same')
    return (x + 0.4*np.sin(2*np.pi*420*t)*np.exp(-t/0.03))*0.45

def darbuka(kind, dur=0.25):
    n = int(dur*SR); t = np.arange(n)/SR
    if kind == 'D':  # düm
        f = 95 + 40*np.exp(-t/0.02); x = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/0.16)
        return x*0.8
    if kind == 'T':  # tek
        x = np.sin(2*np.pi*720*t)*np.exp(-t/0.05) + 0.6*np.sin(2*np.pi*1180*t)*np.exp(-t/0.03) + rng.standard_normal(n)*np.exp(-t/0.006)*0.5
        return x*0.42
    x = np.sin(2*np.pi*560*t)*np.exp(-t/0.03) + rng.standard_normal(n)*np.exp(-t/0.005)*0.4  # ka
    return x*0.3

def place(buf, x, t0, gain=1.0, pan=0.0):
    i = int(t0*SR); j = min(len(buf), i+len(x))
    if j <= i: return
    l = np.cos((pan+1)*np.pi/4); r = np.sin((pan+1)*np.pi/4)
    buf[i:j, 0] += x[:j-i]*gain*l; buf[i:j, 1] += x[:j-i]*gain*r

def reverb(x, wet=0.18):
    out = x.copy()
    for d, g in ((0.029, .5), (0.037, .45), (0.041, .4), (0.053, .35), (0.067, .3), (0.083, .25)):
        k = int(d*SR)
        for c in range(2):
            y = np.zeros(len(x)); y[k:] = x[:-k, c]*g
            for _ in range(3): y[k:] += y[:-k]*0.45
            out[:, c] += wet*y*(0.6 if c == (k % 2) else 0.4)
    return out

def parse(seq):
    """'A4:1 Bb4:1 C#5:2 -:1' — süre sekizlik cinsinden; '~' = süsleme (trill)"""
    out = []
    for tok in seq.split():
        n, d = tok.split(':'); out.append((n, float(d)))
    return out

PARTY_A = "A4:1 Bb4:1 C#5:1 D5:1 E5:1 E5:1 D5:1 C#5:1 D5:1 E5:1 F5:1 E5:1 D5:1 C#5:1 Bb4:1 A4:1 " \
          "A4:1 Bb4:1 C#5:1 D5:1 E5:1 F5:1 G5:1 F5:1 E5:1 D5:1 C#5:1 Bb4:1 A4:2 A4:2"
PARTY_B = "E5:1 E5:1 F5:1 E5:1 D5:1 D5:1 E5:1 D5:1 C#5:1 C#5:1 D5:1 C#5:1 Bb4:1 Bb4:1 A4:2 " \
          "A5:1 G5:1 F5:1 E5:1 F5:1 E5:1 D5:1 C#5:1 D5:1 C#5:1 Bb4:1 C#5:1 A4:2 A4:2"
PARTY_C = "A4:0.5 A4:0.5 A4:1 C#5:0.5 C#5:0.5 C#5:1 E5:0.5 E5:0.5 E5:1 A5:2 G5:1 F5:1 E5:1 D5:1 C#5:2 A4:2 " \
          "Bb4:0.5 C#5:0.5 D5:0.5 E5:0.5 F5:1 E5:1 D5:0.5 E5:0.5 F5:0.5 G5:0.5 A5:2 G5:0.5 F5:0.5 E5:0.5 D5:0.5 C#5:1 Bb4:1 A4:2 -:2"

def render(kind):
    bpm = 138 if kind == 'party' else 168
    e8 = 60/bpm/2
    form = [PARTY_A, PARTY_A, PARTY_B, PARTY_B, PARTY_C, PARTY_A, PARTY_B] if kind == 'party' else [PARTY_C, PARTY_C, PARTY_A, PARTY_C]
    notes = []
    for ph in form: notes += parse(ph)
    total = sum(d for _, d in notes)*e8 + 1.5
    intro = 8*e8 if kind == 'party' else 4*e8                # davul girişi
    buf = np.zeros((int((total+intro)*SR)+SR, 2))
    t = intro; prev = None
    for i, (n, d) in enumerate(notes):
        dur = d*e8
        if n != '-':
            f = note_hz(n)
            # zurna: süslemeli (kısa çarpma notası)
            if d >= 1 and rng.random() < 0.28 and prev:
                g = reed(f*2**(1/12), e8*0.22, bright=1.3, nasal=(1400, 2900)); place(buf, g, t, 0.5, -0.12)
                place(buf, reed(f, dur*0.92-e8*0.18, bright=1.3, nasal=(1400, 2900), slide=0.01), t+e8*0.18, 0.8, -0.12)
            else:
                place(buf, reed(f, dur*0.92, bright=1.3, nasal=(1400, 2900), slide=0.012), t, 0.8, -0.12)
            # klarnet: bir oktav aşağı, B ve C bölümlerinde
            if (i // 32) % 2 == 1 or kind == 'chase':
                place(buf, reed(f/2, dur*0.95, bright=0.8, vib=4.8, vdep=0.006, nasal=(900, 1800), odd=True, att=0.03), t+0.006, 0.42, 0.25)
            # bağlama: vuruşlarda telli
            place(buf, pluck(f/2, max(0.18, dur)), t, 0.32, 0.35)
            prev = n
        t += dur
    # ritim
    beats = int((total+intro)/(2*e8))
    for b in range(beats):
        t0 = b*2*e8; bar_pos = b % 2
        if bar_pos == 0: place(buf, davul_dum(), t0, 0.5, 0)
        else: place(buf, davul_dum(0.35), t0, 0.3, 0)
        place(buf, davul_tek(), t0+e8, 0.5, 0.15)
        if kind == 'chase' or b % 4 == 3: place(buf, davul_tek(), t0+e8*1.5, 0.35, 0.15)
        # darbuka: D-T-K-T / D-K-T-K
        pat = 'DTKT' if bar_pos == 0 else 'DKTK'
        for k, c in enumerate(pat): place(buf, darbuka(c), t0+k*e8/2, 0.55 if c != 'K' else 0.35, -0.3)
    out = reverb(buf, 0.16)
    out = np.tanh(out*1.2)/1.1
    out /= np.max(np.abs(out))*1.05
    end = int((t+0.5)*SR); out = out[:end]
    fade = int(0.4*SR); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return out

if __name__ == '__main__':
    kind, path = sys.argv[1], sys.argv[2]
    x = render(kind); x16 = (x*32000).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(x16.tobytes())
    print(path, round(len(x)/SR, 1), 's')
