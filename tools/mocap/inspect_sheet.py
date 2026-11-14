#!/usr/bin/env python3
"""Kontrol sayfası: python3 inspect_sheet.py 18_03,19_03 out.png [n] [t0] [t1] [mirror_flags]"""
import sys, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from cmu2glb import *

motions = sys.argv[1].split(','); out = sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 10
t0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0
t1 = float(sys.argv[5]) if len(sys.argv) > 5 else None
mir = (sys.argv[6].split(',') if len(sys.argv) > 6 else ['0']*len(motions))
tgt = Target()
EDGES = [('pelvis', 'spine_01'), ('spine_01', 'spine_02'), ('spine_02', 'spine_03'), ('spine_03', 'neck_01'), ('neck_01', 'Head')]
for s in 'lr':
    EDGES += [('spine_03', f'clavicle_{s}'), (f'clavicle_{s}', f'upperarm_{s}'), (f'upperarm_{s}', f'lowerarm_{s}'), (f'lowerarm_{s}', f'hand_{s}'),
              (f'hand_{s}', f'middle_01_{s}'), ('pelvis', f'thigh_{s}'), (f'thigh_{s}', f'calf_{s}'), (f'calf_{s}', f'foot_{s}'), (f'foot_{s}', f'ball_{s}')]
subs = []; anchor = None
for m, mf in zip(motions, mir):
    asf, G, P = load(m); rt = Retarget(tgt, asf); W, pel = rt.run(G, P, mirror=mf == '1')
    traj = traj_of(W, pel, tgt, 0.25*FPS)
    rots, pl = to_local(W, pel, tgt, traj, finger_set(None))
    pos = fk_target(tgt, rots, pl, traj)
    subs.append(pos)
T = min(len(s['pelvis']) for s in subs)
i0 = int(t0*FPS); i1 = int(t1*FPS) if t1 else T-1; i1 = min(i1, T-1)
idx = np.linspace(i0, i1, n).astype(int)
allp = np.concatenate([np.concatenate([v[i0:i1+1] for v in s.values()]) for s in subs])
lo, hi = allp.min(0), allp.max(0); c = (lo+hi)/2; r = max(hi-lo)/2+0.1
cols = min(n, 5); rows = (n+cols-1)//cols
fig = plt.figure(figsize=(3.2*cols, 3.6*rows))
colors = ['#c0392b', '#2471a3', '#27ae60', '#8e44ad']
for k, i in enumerate(idx):
    ax = fig.add_subplot(rows, cols, k+1, projection='3d')
    for si, s in enumerate(subs):
        for a, b in EDGES:
            pa, pb = s[a][i], s[b][i]
            ax.plot([pa[0], pb[0]], [pa[2], pb[2]], [pa[1], pb[1]], color=colors[si], lw=2)
        h = s['Head'][i]; ax.scatter([h[0]], [h[2]], [h[1]+0.08], color=colors[si], s=30)
    ax.set_xlim(c[0]-r, c[0]+r); ax.set_ylim(c[2]-r, c[2]+r); ax.set_zlim(0, 2*r)
    ax.view_init(elev=12, azim=-60); ax.set_title(f'{i/FPS:.1f}s', fontsize=9)
    ax.set_xticks([]); ax.set_yticks([]); ax.set_zticks([])
    xx, zz = np.meshgrid([c[0]-r, c[0]+r], [c[2]-r, c[2]+r]); ax.plot_surface(xx, zz, np.zeros_like(xx), alpha=0.1, color='gray')
plt.suptitle(f'{",".join(motions)}  dur={T/FPS:.1f}s', fontsize=10); plt.tight_layout(); plt.savefig(out, dpi=70)
print('T', T/FPS, 'pel y range', round(float(subs[0]['pelvis'][:, 1].min()), 3), round(float(subs[0]['pelvis'][:, 1].max()), 3),
      'min foot y', round(float(min(subs[0]['ball_l'][:, 1].min(), subs[0]['ball_r'][:, 1].min())), 3))
