#!/usr/bin/env python3
"""CMU ASF/AMC hareket verisi → bizim iskelet (male_body.glb, UE tarzı kemik adları).
Çıktı: GLB animasyonları (kemik dönüşleri + pelvis) ve kök yörüngesi JSON'u (x,z,yaw @30fps).
Yöntem: kaynak kemiklerin dünya dönüşü, dinlenme pozları çerçeve hizalamasıyla (A_b) hedefe aktarılır;
 G_t = G_s · A_b^T · TR_b . Ayna: dünya deltası S·Δ·S karşı kemiğe uygulanır."""
import numpy as np, json, struct, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = '/home/claude/vampir-koylu'
TARGET_GLB = PROJ + '/www/assets/3d/chars/male_body.glb'
UAL1 = PROJ + '/www/assets/3d/anim/ual1.glb'
UNIT = 0.0254 / 0.45
FPS = 30

# ---------------- math ----------------
def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                     [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])

def matq(m):
    t = m[0, 0]+m[1, 1]+m[2, 2]
    if t > 0:
        s = math.sqrt(t+1.0)*2; w = .25*s; x = (m[2, 1]-m[1, 2])/s; y = (m[0, 2]-m[2, 0])/s; z = (m[1, 0]-m[0, 1])/s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1+m[0, 0]-m[1, 1]-m[2, 2])*2; w = (m[2, 1]-m[1, 2])/s; x = .25*s; y = (m[0, 1]+m[1, 0])/s; z = (m[0, 2]+m[2, 0])/s
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1+m[1, 1]-m[0, 0]-m[2, 2])*2; w = (m[0, 2]-m[2, 0])/s; x = (m[0, 1]+m[1, 0])/s; y = .25*s; z = (m[1, 2]+m[2, 1])/s
    else:
        s = math.sqrt(1+m[2, 2]-m[0, 0]-m[1, 1])*2; w = (m[1, 0]-m[0, 1])/s; x = (m[0, 2]+m[2, 0])/s; y = (m[1, 2]+m[2, 1])/s; z = .25*s
    q = np.array([x, y, z, w]); return q/np.linalg.norm(q)

def rx(a): c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def ry(a): c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rz(a): c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
def euler(a, b, c): return rz(c) @ ry(b) @ rx(a)   # transforms3d 'sxyz'

def frame(p, h):
    x = p/np.linalg.norm(p); y = h-np.dot(h, x)*x; y /= np.linalg.norm(y); z = np.cross(x, y)
    return np.stack([x, y, z], 1)

def gauss_smooth(a, sigma):
    """a: (T, ...) zaman ekseninde gauss yumuşatma (kenar: yansıtma)"""
    if sigma <= 0: return a
    r = int(3*sigma)+1; k = np.exp(-0.5*(np.arange(-r, r+1)/sigma)**2); k /= k.sum()
    pad = np.concatenate([a[r:0:-1], a, a[-2:-r-2:-1]], 0) if len(a) > r+1 else np.pad(a, [(r, r)]+[(0, 0)]*(a.ndim-1), mode='edge')
    out = np.zeros_like(a, dtype=float)
    for i, w in enumerate(k): out += w*pad[i:i+len(a)]
    return out

# ---------------- glb ----------------
def read_glb(path):
    b = open(path, 'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20+jl]); off = 20+jl; bl = struct.unpack_from('<I', b, off)[0]
    return j, b[off+8:off+8+bl]

def accessor(j, binb, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5122: np.int16, 5121: np.uint8, 5120: np.int8}[a['componentType']]
    off = bv.get('byteOffset', 0)+a.get('byteOffset', 0)
    arr = np.frombuffer(binb, dtype=dt, count=a['count']*n, offset=off).reshape(a['count'], n).astype(float)
    if a.get('normalized'):
        arr /= {np.int16: 32767., np.uint16: 65535., np.int8: 127., np.uint8: 255.}[dt]
    return arr

class Target:
    def __init__(self, path=TARGET_GLB):
        j, _ = read_glb(path)
        self.j = j; nodes = j['nodes']
        self.parent = {}
        for i, n in enumerate(nodes):
            for c in n.get('children', []): self.parent[c] = i
        self.idx = {n.get('name'): i for i, n in enumerate(nodes)}
        skin = j['skins'][0]; self.joints = [nodes[i]['name'] for i in skin['joints']]
        self.jset = set(self.joints)
        self.Lrot = {}; self.Lpos = {}
        for i, n in enumerate(nodes):
            self.Lrot[n.get('name')] = qmat(n.get('rotation', [0, 0, 0, 1]))
            self.Lpos[n.get('name')] = np.array(n.get('translation', [0, 0, 0]), float)
        self.pname = {nodes[c].get('name'): nodes[p].get('name') for c, p in self.parent.items()}
        # dünya (Armature ve üstü birim kabul; root dönüşü dahil)
        self.WR = {}; self.WP = {}
        for name in self.order():
            p = self.pname.get(name)
            if p is None or p not in self.jset:
                base_R, base_P = self.chainR(p), self.chainP(p)
                self.WR[name] = base_R @ self.Lrot[name]; self.WP[name] = base_P + base_R @ self.Lpos[name]
            else:
                self.WR[name] = self.WR[p] @ self.Lrot[name]; self.WP[name] = self.WP[p] + self.WR[p] @ self.Lpos[name]

    def chainR(self, name):
        R = np.eye(3)
        while name is not None:
            R = self.Lrot[name] @ R; name = self.pname.get(name)
        return R

    def chainP(self, name):
        if name is None: return np.zeros(3)
        p = self.pname.get(name)
        return self.chainP(p) + self.chainR(p) @ self.Lpos[name]

    def order(self):
        out = []; seen = set()
        def visit(n):
            if n in seen: return
            p = self.pname.get(n)
            if p in self.jset: visit(p)
            seen.add(n); out.append(n)
        for n in self.joints: visit(n)
        return out

# ---------------- ASF/AMC ----------------
class ASF:
    def __init__(self, path):
        txt = open(path).read().split('\n'); self.bones = {}; self.children = {}; sec = None; cur = None
        for line in txt:
            s = line.strip()
            if not s or s.startswith('#'): continue
            if s.startswith(':'):
                sec = s.split()[0]; continue
            if sec == ':bonedata':
                t = s.split()
                if t[0] == 'begin': cur = {'dof': []}
                elif t[0] == 'end': self.bones[cur['name']] = cur
                elif t[0] == 'name': cur['name'] = t[1]
                elif t[0] == 'direction': cur['dir'] = np.array([float(v) for v in t[1:4]])
                elif t[0] == 'length': cur['len'] = float(t[1])
                elif t[0] == 'axis': cur['axis'] = [float(v) for v in t[1:4]]
                elif t[0] == 'dof': cur['dof'] = t[1:]
            elif sec == ':hierarchy':
                t = s.split()
                if t[0] in ('begin', 'end'): continue
                self.children[t[0]] = t[1:]
        self.parent = {c: p for p, cs in self.children.items() for c in cs}
        for b in self.bones.values():
            a = np.radians(b['axis']); b['C'] = euler(*a); b['Ci'] = b['C'].T
        self.order = []
        def visit(n):
            self.order.append(n)
            for c in self.children.get(n, []): visit(c)
        visit('root')

def read_amc(path):
    frames = []; cur = None
    for line in open(path):
        s = line.strip()
        if not s or s[0] in '#:': continue
        t = s.split()
        if len(t) == 1 and t[0].isdigit():
            cur = {}; frames.append(cur); continue
        cur[t[0]] = [float(v) for v in t[1:]]
    return frames

def fk_source(asf, frames, src_fps, mirror=False):
    """→ G: {bone: (T,3,3)} global dönüş (dinlenmeye göre), P: {bone: (T,3)} kemik uç konumu (m)."""
    step = max(1, round(src_fps/FPS)); frames = frames[::step]
    T = len(frames); G = {b: np.zeros((T, 3, 3)) for b in asf.order}; P = {b: np.zeros((T, 3)) for b in asf.order}
    for i, f in enumerate(frames):
        r = f['root']; G['root'][i] = euler(*np.radians(r[3:6])); P['root'][i] = np.array(r[:3])*UNIT
        for b in asf.order[1:]:
            bd = asf.bones[b]; p = asf.parent[b]; rot = [0., 0., 0.]
            vals = f.get(b, [])
            for k, d in enumerate(bd['dof']):
                if k < len(vals): rot['xyz'.index(d[1])] = vals[k]
            G[b][i] = G[p][i] @ bd['C'] @ euler(*np.radians(rot)) @ bd['Ci']
            P[b][i] = P[p][i] + bd['len']*UNIT*(G[b][i] @ bd['dir'])
    return G, P

# ---------------- eşleme ----------------
SIDE = ['l', 'r']
MAP = {'pelvis': ('root', 'X'), 'spine_01': ('lowerback', 'X'), 'spine_02': ('upperback', 'X'), 'spine_03': ('thorax', 'X'),
       'neck_01': ('upperneck', 'X'), 'Head': ('head', 'X')}
for s in SIDE:
    MAP.update({f'clavicle_{s}': (f'{s}clavicle', 'Z'), f'upperarm_{s}': (f'{s}humerus', 'Z'), f'lowerarm_{s}': (f'{s}radius', 'Z'),
                f'hand_{s}': (f'{s}hand', 'Z'), f'thigh_{s}': (f'{s}femur', 'Z'), f'calf_{s}': (f'{s}tibia', 'Z'),
                f'foot_{s}': (f'{s}foot', 'X'), f'ball_{s}': (f'{s}toes', 'X')})
HINT = {'X': np.array([1., 0, 0]), 'Z': np.array([0, 0, 1.])}
def counterpart(n):
    if n.endswith('_l'): return n[:-2]+'_r'
    if n.endswith('_r'): return n[:-2]+'_l'
    return n

class Retarget:
    def __init__(self, tgt, asf):
        self.t = tgt; self.asf = asf; self.A = {}
        for tb, (sb, h) in MAP.items():
            pt = tgt.WR[tb][:, 1]                       # hedef kemik yönü = yerel +Y
            ps = asf.bones['lowerback']['dir'] if sb == 'root' else asf.bones[sb]['dir']
            self.A[tb] = frame(pt, HINT[h]) @ frame(ps, HINT[h]).T
        # ölçek: bacak uzunluğu
        Lt = np.linalg.norm(tgt.WP['calf_l']-tgt.WP['thigh_l'])+np.linalg.norm(tgt.WP['foot_l']-tgt.WP['calf_l'])
        Ls = (asf.bones['lfemur']['len']+asf.bones['ltibia']['len'])*UNIT
        self.scale = Lt/Ls
        self.hipc_rest = 0.5*(tgt.WP['thigh_l']+tgt.WP['thigh_r'])

    def run(self, G, P, mirror=False):
        t = self.t; T = len(G['root']); W = {}
        for tb, (sb, _) in MAP.items():
            W[tb] = G[sb] @ self.A[tb].T @ t.WR[tb]          # (T,3,3)
        hipc_s = 0.5*(P['lhipjoint']+P['rhipjoint'])
        dP = W['pelvis'] @ np.linalg.inv(t.WR['pelvis'])        # pelvis dünya deltası
        pel = self.scale*hipc_s - np.einsum('tij,j->ti', dP, self.hipc_rest-t.WP['pelvis'])
        if mirror:
            S = np.diag([-1., 1, 1]); W2 = {}
            for tb in W:
                cb = counterpart(tb)
                D = W[tb] @ t.WR[tb].T
                W2[cb] = S @ D @ S @ t.WR[cb]
            W = W2; pel = pel*np.array([-1, 1, 1])
        return W, pel

# ---------------- poz → yerel izler ----------------
def traj_of(W, pel, tgt, sigma):
    left = W['pelvis'] @ (tgt.WR['pelvis'].T @ np.array([1., 0, 0]))
    fwd = W['pelvis'] @ (tgt.WR['pelvis'].T @ np.array([0, 0, 1.]))
    # yatay izdüşüm ağırlıklı: yerde yatarken ileri vektörü dikleşir, kalça ekseni güvenilir kalır
    ex = fwd[:, 0]-left[:, 2]; ez = fwd[:, 2]+left[:, 0]
    yaw = np.unwrap(np.arctan2(ex, ez))
    x = gauss_smooth(pel[:, 0], sigma); z = gauss_smooth(pel[:, 2], sigma); yaw = gauss_smooth(yaw, sigma)
    return np.stack([x, z, yaw], 1)

def to_local(W, pel, tgt, traj, fingers=None):
    """dünya pozu → yörünge uzayı → yerel dönüşler. fingers: {kemik: quat} sabit."""
    T = len(pel); out = {}
    Ry = np.stack([ry(-a) for a in traj[:, 2]])                     # dünya→nesne
    off = np.stack([traj[:, 0], np.zeros(T), traj[:, 1]], 1)
    Wo = {b: Ry @ W[b] for b in W}
    pel_o = np.einsum('tij,tj->ti', Ry, pel-off)
    Rroot = tgt.chainR('root')
    Gfull = {}
    for name in tgt.order():
        p = tgt.pname.get(name)
        if name in Wo: Gfull[name] = Wo[name]
        elif p in Gfull: Gfull[name] = Gfull[p] @ (qmat(fingers[name]) if fingers and name in fingers else tgt.Lrot[name])
        else: Gfull[name] = np.repeat(tgt.chainR(name)[None], T, 0)
    for name in tgt.order():
        if name not in Wo and not (fingers and name in fingers): continue
        p = tgt.pname.get(name)
        PR = Gfull[p] if p in Gfull else np.repeat(tgt.chainR(p)[None], T, 0)
        loc = np.einsum('tji,tjk->tik', PR, Gfull[name])
        q = np.stack([matq(m) for m in loc])
        for i in range(1, T):
            if np.dot(q[i], q[i-1]) < 0: q[i] = -q[i]
        out[name] = q
    pel_local = (Rroot.T @ (pel_o - tgt.chainP('root')).T).T
    return out, pel_local

# ---------------- parmak pozları (UAL'dan) ----------------
_UALP = None
def ual_pose(clip, frame_i=0):
    global _UALP
    if _UALP is None: _UALP = json.load(open(f'{HERE}/ual_poses.json'))
    return {k: np.array(v[frame_i]) for k, v in _UALP[clip].items() if any(f in k for f in ('index', 'middle', 'pinky', 'ring', 'thumb'))}

def finger_set(mode):
    relax = ual_pose('Idle_Loop')
    if not mode: return relax
    grip = ual_pose('Idle_Torch_Loop')   # sağ el meşaleyi kavrıyor
    res = dict(relax)
    for k, v in grip.items():
        if k.endswith('_r') and mode in ('r', 'both'): res[k] = v
        if k.endswith('_r') and mode in ('l', 'both'):
            # sol el: sağın aynası (yerel ayna: x,-y,-z,w Blender simetrik iskeletinde)
            res[k[:-2]+'_l'] = np.array([v[0], -v[1], -v[2], v[3]])
    return res

# ---------------- glb yaz ----------------
class GLBWriter:
    def __init__(self, tgt):
        self.tgt = tgt; self.bin = bytearray(); self.acc = []; self.bv = []; self.anims = []
        # düğümler: Armature > root > ... (yalnız iskelet)
        names = ['Armature']+tgt.order(); self.ni = {n: i for i, n in enumerate(names)}
        nodes = []
        for n in names:
            d = {'name': n}
            if n != 'Armature':
                d['rotation'] = [float(v) for v in matq(tgt.Lrot[n])]; t = tgt.Lpos[n]
                if np.any(t): d['translation'] = [float(v) for v in t]
            ch = [self.ni[c] for c in names if tgt.pname.get(c) == n] if n != 'Armature' else [self.ni['root']]
            if ch: d['children'] = ch
            nodes.append(d)
        self.nodes = nodes

    def add(self, arr, typ, minmax=False, q16=False):
        arr = np.ascontiguousarray(np.round(np.clip(arr, -1, 1)*32767), dtype=np.int16) if q16 else np.ascontiguousarray(arr, dtype=np.float32)
        while len(self.bin) % 4: self.bin.append(0)
        off = len(self.bin); self.bin += arr.tobytes()
        self.bv.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes})
        a = {'bufferView': len(self.bv)-1, 'componentType': 5122 if q16 else 5126, 'count': len(arr), 'type': typ}
        if q16: a['normalized'] = True
        if minmax: a['min'] = [float(arr.min())]; a['max'] = [float(arr.max())]
        self.acc.append(a); return len(self.acc)-1

    def clip(self, name, rots, pel):
        T = len(pel); times = np.arange(T, dtype=np.float32)/FPS
        ti = self.add(times.reshape(-1, 1), 'SCALAR', True); samplers = []; chans = []
        ti2 = None
        def put(node, path, data, typ):
            nonlocal ti2
            const = typ == 'VEC4' and np.allclose(data, data[:1], atol=1e-4)
            if const:
                if ti2 is None: ti2 = self.add(np.array([[0.], [times[-1]]]), 'SCALAR', True)
                data = data[[0, -1]]
            o = self.add(data, typ, q16=(typ == 'VEC4')); samplers.append({'input': ti2 if const else ti, 'output': o, 'interpolation': 'LINEAR'})
            chans.append({'sampler': len(samplers)-1, 'target': {'node': self.ni[node], 'path': path}})
        put('pelvis', 'translation', pel, 'VEC3')
        for b, q in rots.items(): put(b, 'rotation', q, 'VEC4')
        self.anims.append({'name': name, 'samplers': samplers, 'channels': chans})

    def write(self, path):
        while len(self.bin) % 4: self.bin.append(0)
        j = {'asset': {'version': '2.0', 'generator': 'vk-cmu2glb'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': self.nodes,
             'animations': self.anims, 'accessors': self.acc, 'bufferViews': self.bv, 'buffers': [{'byteLength': len(self.bin)}]}
        js = json.dumps(j, separators=(',', ':')).encode()
        while len(js) % 4: js += b' '
        tot = 12+8+len(js)+8+len(self.bin)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, tot)); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack('<II', len(self.bin), 0x004E4942)); f.write(self.bin)

# ---------------- yardımcı: tam ileri kinematik (doğrulama) ----------------
def fk_target(tgt, rots, pel, traj):
    T = len(pel); pos = {}; R = {}
    for name in tgt.order():
        p = tgt.pname.get(name)
        L = np.stack([qmat(q) for q in rots[name]]) if name in rots else np.repeat(tgt.Lrot[name][None], T, 0)
        lp = pel if name == 'pelvis' else np.repeat(tgt.Lpos[name][None], T, 0)
        if p in R:
            R[name] = R[p] @ L; pos[name] = pos[p]+np.einsum('tij,tj->ti', R[p], lp)
        else:
            base = tgt.chainR(p); bp = tgt.chainP(p)
            R[name] = base @ L; pos[name] = bp+np.einsum('ij,tj->ti', base, lp)
    Ry = np.stack([ry(a) for a in traj[:, 2]]); off = np.stack([traj[:, 0], np.zeros(T), traj[:, 1]], 1)
    return {n: np.einsum('tij,tj->ti', Ry, v)+off for n, v in pos.items()}

def load(motion, mirror=False):
    subj = int(motion.split('_')[0]); asf = ASF(f'{HERE}/amc/{subj}.asf')
    frames = read_amc(f'{HERE}/amc/{motion}.amc'); fps = SRC_FPS.get(motion, 120)
    G, P = fk_source(asf, frames, fps)
    return asf, G, P

SRC_FPS = {}
for line in open(f'{HERE}/list.txt'):
    m, fr, _ = line.rstrip('\n').split('\t', 2); SRC_FPS[m] = int(fr)
