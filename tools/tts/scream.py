"""Yedek: formant sentezi ile uzun, komik "AAAAAAA AAAAAAAAA" çığlığı (iki nefes).
python scream.py out.wav [tohum] [uzunluk_katsayısı]"""
import sys, numpy as np, wave
sr = 24000
rng = np.random.default_rng(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
L = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0

def seg(dur, f_start, f_peak, f_end, peak_at=0.3, crack=False):
    n = int(dur*sr); t = np.arange(n)/sr; u = t/dur
    f0 = np.where(u < peak_at, f_start+(f_peak-f_start)*np.sin(u/peak_at*np.pi/2), f_peak+(f_end-f_peak)*((u-peak_at)/(1-peak_at))**1.3)
    f0 = f0*(1+0.035*np.sin(2*np.pi*6.3*t+rng.uniform(0, 6)))*(1+0.012*rng.standard_normal(n).cumsum()/np.sqrt(np.arange(1, n+1)))
    if crack: f0[int(n*0.82):] *= np.linspace(1, 1.35, n-int(n*0.82))  # sesin çatlaması (komik)
    ph = 2*np.pi*np.cumsum(f0)/sr
    src = np.zeros(n)
    for k in range(1, 28):
        amp = (1/k**0.75)*(f0*k < 5200)
        src += amp*np.sin(k*ph)
    src += 0.18*rng.standard_normal(n)
    env = np.minimum(1, t/0.06)*np.minimum(1, (dur-t)/0.16)*(0.85+0.15*np.sin(2*np.pi*3.1*t))
    return src*env

def reson(x, f, bw):
    r = np.exp(-np.pi*bw/sr); th = 2*np.pi*f/sr
    a1, a2 = -2*r*np.cos(th), r*r; y = np.zeros_like(x); y1 = y2 = 0.0; g = 1-r
    for i in range(len(x)):
        v = g*x[i]-a1*y1-a2*y2; y[i] = v; y2 = y1; y1 = v
    return y

a = seg(1.35*L, 300, 470, 430, 0.22)
gap = 0.0*np.zeros(int(0.2*sr))
b = seg(2.05*L, 360, 560, 360, 0.3, crack=True)
x = np.concatenate([a, gap, b])
y = 1.0*reson(x, 880, 130)+0.75*reson(x, 1380, 170)+0.45*reson(x, 2650, 240)+0.25*reson(x, 3500, 320)
y = np.tanh(2.2*y/np.max(np.abs(y)))
breath = rng.standard_normal(len(gap))*np.hanning(len(gap))*0.08
y[len(a):len(a)+len(gap)] += breath
y = y/np.max(np.abs(y))*0.9
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((y*32767).astype(np.int16).tobytes())
print('ok', round(len(y)/sr, 2), 's')
