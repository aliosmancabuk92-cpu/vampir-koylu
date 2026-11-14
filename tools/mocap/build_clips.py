#!/usr/bin/env python3
"""Seçilmiş CMU kliplerini bizim iskelete aktar → www/assets/3d/anim/mocap.glb + mocap.json"""
import json, sys, numpy as np
from cmu2glb import *

OUT_GLB = PROJ + '/www/assets/3d/anim/mocap.glb'
OUT_JSON = PROJ + '/www/assets/3d/anim/mocap_meta.json'

# ad, hareket, t0, t1, ayna, parmak, grup(çapa) , yörünge yumuşatma(s)
C = [
    # iki kişilik: A çeker, B direnir (aynı çapa)
    ('pull_A', '18_03', 0.2, 4.9, 0, 'both', 'pull', .35), ('pull_B', '19_03', 0.2, 4.9, 0, None, 'pull', .35),
    ('pullE_A', '18_05', 0.0, 99, 0, 'both', 'pullE', .35), ('pullE_B', '19_05', 0.0, 99, 0, None, 'pullE', .35),
    ('quarrel_A', '18_10', 'best', 6.0, 0, None, 'quarrel', .5), ('quarrel_B', '19_10', 'best', 6.0, 0, None, 'quarrel', .5),
    ('talk_A', '18_08', 'best', 6.0, 0, None, 'talk', .5), ('talk_B', '19_08', 'best', 6.0, 0, None, 'talk', .5),
    # tek kişilik
    ('kick_front', '74_05', 1.4, 4.2, 0, None, None, .45), ('kick_front2', '74_06', 1.4, 4.0, 0, None, None, .45),
    ('kick_door', '74_03', 2.0, 4.6, 0, None, None, .45), ('kick_run', '10_02', 0.6, 4.4, 0, None, None, .3),
    ('chop', '79_01', 0.4, 6.4, 0, 'both', None, .5),
    ('fall_face', '90_16', 1.6, 6.0, 0, None, None, .3), ('fall_back', '90_18', 0.0, 99, 0, None, None, .3),
    ('laugh1', '13_14', 'best', 4.0, 0, None, None, .5), ('laugh2', '14_17', 'best', 4.0, 0, None, None, .5),
    ('laugh3', '79_70', 'best', 4.0, 0, None, None, .5), ('laugh4', '80_44', 'best', 4.0, 0, None, None, .5),
    ('happy', '79_69', 'best', 4.0, 0, None, None, .5), ('happy2', '80_43', 'best', 4.0, 0, None, None, .5),
    ('scared', '79_73', 'best', 4.0, 0, None, None, .5), ('cry', '79_72', 'best', 4.0, 0, None, None, .5),
    ('shiver', '79_68', 'best', 4.0, 0, None, None, .5), ('argue', '80_48', 'best', 5.0, 0, None, None, .5),
    ('shrug', '111_25', 0, 99, 0, None, None, .5), ('point', '13_27', 'best', 4.0, 0, None, None, .5),
    ('walk_scared', '91_32', 'loop', 0.4, 0, None, None, .3), ('walk_drunk', '91_09', 'loop', 0, 0, None, None, .3),
    ('walk_angry', '17_01', 'loop', 0, 0, None, None, .3), ('limp', '77_19', 'loop', 0.5, 0, None, None, .3),
    ('drag_obj', '81_08', 'best', 4.0, 0, 'both', None, .35), ('pickup', '26_10', 'best', 3.0, 0, 'both', None, .4),
    ('chicken', '18_15', 'best', 6.0, 0, None, None, .5), ('noose', '79_20', 'handsup', 3.4, 0, 'both', None, .5),
    ('kneel', '23_03', 0.0, 99, 0, None, None, .4),
]
only = set(sys.argv[1:])
tgt = Target(); wr = GLBWriter(tgt); meta = {}
cache = {}
def prepare(name, mot, mir, fing, sig):
    asf, G, P = load(mot); rt = Retarget(tgt, asf); W, pel = rt.run(G, P, mirror=bool(mir))
    traj = traj_of(W, pel, tgt, sig*FPS)
    rots, pl = to_local(W, pel, tgt, traj, finger_set(fing))
    return W, pel, traj, rots, pl

anchors = {}
for name, mot, t0, t1, mir, fing, grp, sig in C:
    if only and name not in only and (grp is None or not any(o.startswith(grp+'_') for o in only)): continue
    W, pel, traj, rots, pl = prepare(name, mot, mir, fing, sig)
    T = len(pl); loopclip = False
    if t0 == 'best':
        e = np.zeros(T)
        for b in ('spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'clavicle_l', 'clavicle_r'):
            q = rots[b]; d = np.abs(np.sum(q[1:]*q[:-1], 1)); e[1:] += 2*np.arccos(np.clip(d, 0, 1))
        win = int(t1*FPS); cs = np.r_[0, np.cumsum(e)]; best = int(np.argmax(cs[win:]-cs[:-win])) if T > win else 0
        i0, i1 = best, min(T, best+win)
    elif t0 == 'handsup':
        hy = fk_target(tgt, rots, pl, traj)['hand_r'][:, 1]; m = int(np.argmax(hy)); win = int(t1*FPS)
        i0 = max(0, m-int(win*0.55)); i1 = min(T, i0+win)
    elif t0 == 'loop':
        names = [b for b in rots if not any(f in b for f in ('index', 'middle', 'pinky', 'ring', 'thumb'))]
        Q = np.stack([rots[b] for b in names], 1)                       # T,B,4
        vmin = t1 or 0.7
        while True:
            best = (1e9, 0, 0)
            for i in range(0, T-int(1.6*FPS), 2):
                for L in range(int(0.95*FPS), int(1.45*FPS)):
                    j = i+L
                    if j+1 >= T: break
                    dyaw = abs(traj[j, 2]-traj[i, 2]); spd = math.hypot(traj[j, 0]-traj[i, 0], traj[j, 1]-traj[i, 1])/(L/FPS)
                    if dyaw > math.radians(14) or spd < vmin: continue
                    d = np.sum(1-np.abs(np.sum(Q[i]*Q[j], 1))) + 2*abs(pl[i, 2]-pl[j, 2]) + 0.5*np.sum(1-np.abs(np.sum(Q[i+1]*Q[j+1], 1)))
                    if d < best[0]: best = (d, i, j)
            if best[0] < 1e9 or vmin < 0.2: break
            vmin -= 0.1
        _, i0, i1 = best; i1 += 1; loopclip = True
        seg = traj[i0:i1]; natural = math.hypot(seg[-1, 0]-seg[0, 0], seg[-1, 1]-seg[0, 1])/((i1-1-i0)/FPS)
    else:
        i0 = max(0, int(round(t0*FPS))); i1 = min(T, int(round(t1*FPS))+1)
    traj = traj[i0:i1]; rots = {k: v[i0:i1] for k, v in rots.items()}; pl = pl[i0:i1]
    key = grp or name
    if key not in anchors: anchors[key] = traj[0].copy()
    a = anchors[key]; c, s = math.cos(-a[2]), math.sin(-a[2])
    dx, dz = traj[:, 0]-a[0], traj[:, 1]-a[1]
    rel = np.stack([c*dx+s*dz, -s*dx+c*dz, traj[:, 2]-a[2]], 1)   # R_y(-yaw0)·d : x'=cos·dx+sin·dz, z'=-sin·dx+cos·dz
    # olaylar
    pos = fk_target(tgt, rots, pl, np.stack([rel[:, 0], rel[:, 1], rel[:, 2]], 1))
    ev = {}
    def speed(j): return np.r_[0, np.linalg.norm(np.diff(pos[j], axis=0), axis=1)*FPS]
    if name.startswith('kick'):
        sr, sl = speed('ball_r'), speed('ball_l'); foot = 'r' if sr.max() >= sl.max() else 'l'
        sp = sr if foot == 'r' else sl; hi = int(np.argmax(sp)); fp = pos['ball_'+foot][hi]
        ev = {'hit': round(hi/FPS, 3), 'foot': foot, 'hitPos': [round(float(v), 3) for v in fp]}
    if name in ('chop', 'hammer', 'smash'):
        h = pos['hand_r'][:, 1]; hits = []
        for i in range(3, len(h)-3):
            if h[i] == h[max(0, i-8):i+9].min() and h[max(0, i-20):i].max()-h[i] > 0.35: hits.append(round(i/FPS, 3))
        tops = [round(i/FPS, 3) for i in range(3, len(h)-3) if h[i] == h[max(0, i-8):i+9].max() and h[i] > 1.6]
        hm = 0.5*(pos['hand_l']+pos['hand_r'])
        ev = {'hits': hits, 'tops': tops, 'hitPos': [[round(float(v), 3) for v in hm[int(round(t*FPS))]] for t in hits], 'topPos': [[round(float(v), 3) for v in hm[int(round(t*FPS))]] for t in tops]}
    if name.startswith('fall'):
        py = pos['pelvis'][:, 1]; i = int(np.argmax(py < 0.4)) if (py < 0.4).any() else len(py)-1
        ev = {'impact': round(i/FPS, 3)}
    if loopclip:
        rots = {k: np.concatenate([v[:-1], v[:1]]) for k, v in rots.items()}   # son kare = ilk kare (kesintisiz döngü)
        pl = pl.copy(); pl[-1] = pl[0]; ev = {'loop': 1, 'speed': round(natural, 3)}
        rel = np.zeros_like(rel)                                                  # yerinde döngü
    meta[name] = {'n': len(pl), 'fps': FPS, 'dur': round((len(pl)-1)/FPS, 3), 'traj': [round(float(v), 3) for v in rel.reshape(-1)], 'ev': ev}
    wr.clip(name, rots, pl)
    print(f'{name:12s} {mot:7s} {meta[name]["dur"]:5.2f}s  yol=({rel[-1,0]:+.2f},{rel[-1,1]:+.2f}) yaw={math.degrees(rel[-1,2]):+.0f}  {ev}')
if not only:
    wr.write(OUT_GLB); json.dump(meta, open(OUT_JSON, 'w'), separators=(',', ':'))
    import os; print('glb', os.path.getsize(OUT_GLB)//1024, 'KB  json', os.path.getsize(OUT_JSON)//1024, 'KB')
