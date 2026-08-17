from pathlib import Path
import json, math, sys, re
ROOT=Path(__file__).resolve().parents[1]
FAIL=[];PASS=[]
def ok(name,cond,msg=''): (PASS if cond else FAIL).append((name,msg))
def load(p): return json.loads((ROOT/p).read_text(encoding='utf-8'))
def interp(rows,x):
 rows=sorted(rows,key=lambda r:r['disp'])
 if x<=rows[0]['disp']: return rows[0]['kmt']
 if x>=rows[-1]['disp']: return rows[-1]['kmt']
 for a,b in zip(rows,rows[1:]):
  if a['disp']<=x<=b['disp']:
   t=(x-a['disp'])/(b['disp']-a['disp']);return a['kmt']+t*(b['kmt']-a['kmt'])
for fn in ['data/reference-vessels/one-apus.json','data/reference-vessels/rcl-nattha-bhum.json']:
 v=load(fn);tag=v['name'];h=v['hydrostatics'];kn=v['knCrossCurves'];lc=v['loadingConditions']
 ok(tag+' hydro draft monotonic',all(h[i]['draft']<h[i+1]['draft'] for i in range(len(h)-1)))
 ok(tag+' hydro displacement monotonic',all(h[i]['disp']<h[i+1]['disp'] for i in range(len(h)-1)))
 errs=[]
 for d in sorted(set(r['disp'] for r in kn)):
  row=next((r for r in kn if r['disp']==d and r['angle']==5),None)
  if row:
   kmkn=row['kn']/math.sin(math.radians(5));kmh=interp(h,d);errs.append(abs(kmkn-kmh)/max(1e-9,abs(kmh))*100)
 ok(tag+' KN-KMT <=1%',bool(errs) and max(errs)<=1.0,f'max={max(errs) if errs else float("nan"):.6f}%')
 for c in lc:
  mass=sum(c.get(k,0) for k in ['lightshipMass','cargoMass','ballastMass','consumablesMass'])
  ok(tag+' '+c['name']+' mass closure',abs(mass-c['displacement'])<=0.01,f'err={mass-c["displacement"]:.6f} t')
  if all(k in c for k in ['draftForward','draftAft','trimForwardMinusAft']):
   err=(c['draftForward']-c['draftAft'])-c['trimForwardMinusAft'];ok(tag+' '+c['name']+' end-draft trim closure',abs(err)<=1e-5,f'err={err:.8f} m')
gf=load('data/great-fortune/workbook-condition.json')['target']
ok('GREAT FORTUNE source FWD/AFT trim closure',abs((gf['draftFwd']-gf['draftAft'])+gf['trimByStern'])<1e-8)
index=(ROOT/'index.html').read_text(encoding='utf-8');ids=re.findall(r'id="([^"]+)"',index);ok('No duplicate HTML ids',len(ids)==len(set(ids)),f'{len(ids)-len(set(ids))} duplicates')
print(f'PASS {len(PASS)} / {len(PASS)+len(FAIL)}')
for n,m in PASS: print('  ✓',n,m)
for n,m in FAIL: print('  ✕',n,m)
sys.exit(1 if FAIL else 0)
