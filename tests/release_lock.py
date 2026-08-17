from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'RELEASE_LOCK.json').read_text(encoding='utf-8'))
fail=[]
for rel,expected in manifest['files'].items():
 p=ROOT/rel
 if not p.exists(): fail.append((rel,'MISSING')); continue
 actual=hashlib.sha256(p.read_bytes()).hexdigest()
 if actual!=expected: fail.append((rel,actual))
print(f"RELEASE LOCK {len(manifest['files'])-len(fail)} / {len(manifest['files'])} PASS")
for rel,actual in fail: print('  ✕',rel,actual)
if fail:
 print('Frozen stable files changed. If this change is intentional, run the full regression suite and regenerate RELEASE_LOCK.json under documented change control.')
sys.exit(1 if fail else 0)
