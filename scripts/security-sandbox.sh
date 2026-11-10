#!/usr/bin/env bash
# Linux-only, fail-closed offline validation of a sanitized disposable source copy.
# Requires preinstalled dependencies, user/mount/network/PID namespaces and chroot.
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$PWD"
command -v unshare >/dev/null
command -v setpriv >/dev/null
# Fail closed if the surrounding OS does not supply a resident-memory cap.
cgroup=$(awk -F: '$1 == "0" { print $3 }' /proc/self/cgroup)
memory_file="/sys/fs/cgroup${cgroup}/memory.max"
[[ -r "$memory_file" ]]
memory_max=$(cat "$memory_file")
[[ "$memory_max" =~ ^[0-9]+$ && "$memory_max" -le 4294967296 ]]
[[ -d node_modules && -d saaf-circuit-breaker/.venv/lib/python3.11/site-packages ]]
root=$(mktemp -d "${TMPDIR:-/home/user}/saaf-isolation-XXXXXX")
trap 'rm -rf -- "$root"' EXIT
mkdir -p "$root/seed" "$root/rootfs"
# Parent-controlled export: never copy git config, env files, symlinks or dependencies.
python3 - "$root/seed" <<'PY'
from pathlib import Path
import subprocess,sys
seed=Path(sys.argv[1])
files=subprocess.check_output(['git','ls-files','-c','-o','--exclude-standard','-z']).decode().split('\0')
for name in files:
    if not name: continue
    p=Path(name)
    if p.is_absolute() or '..' in p.parts or any(x.startswith('.') and x not in ('.env.example',) for x in p.parts): continue
    if p.name.startswith('.env'): continue
    if p.is_symlink() or any(parent.is_symlink() for parent in p.parents): raise SystemExit('Symlinks are not allowed in export')
    if not p.is_file(): continue
    if p.stat().st_size > 8*1024*1024: raise SystemExit('Oversize export file')
    dest=seed/p
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(p.read_bytes())
PY
# The outer Arena cgroup supplies an OS-enforced ~4GB resident-memory cap.
# Also bound virtual memory, processes, file sizes, CPU, disk, and wall time below.
timeout --kill-after=5s 240s env -i PATH=/usr/local/bin:/usr/bin:/bin unshare --user --map-root-user --mount --net --pid --fork --kill-child=KILL /bin/bash -euc '
  root=$1; seed=$2; node_deps=$3; python_deps=$4
  mount --make-rprivate /
  ip link set lo up  # isolated loopback only, needed by the build worker IPC
  mkdir -p "$root"/{usr,proc,dev,etc,scratch,target,deps/node_modules,deps/python}
  mount --bind /usr "$root/usr"; mount -o remount,bind,ro "$root/usr"
  for name in bin sbin lib lib64; do ln -s "usr/$name" "$root/$name"; done
  mount -t proc proc "$root/proc" -o nosuid,nodev,noexec
  for dev in null zero random urandom; do touch "$root/dev/$dev"; mount --bind "/dev/$dev" "$root/dev/$dev"; done
  printf "root:x:0:0:root:/scratch/home:/bin/sh\n" > "$root/etc/passwd"
  printf "root:x:0:\n" > "$root/etc/group"
  mount --bind "$seed" "$root/target"; mount -o remount,bind,ro "$root/target"
  mount --bind "$node_deps" "$root/deps/node_modules"; mount -o remount,bind,ro "$root/deps/node_modules"
  mount --bind "$python_deps" "$root/deps/python"; mount -o remount,bind,ro "$root/deps/python"
  mount -t tmpfs -o size=768m,nosuid,nodev tmpfs "$root/scratch"
  mkdir -p "$root/scratch"/{project,home,tmp,cache}
  cp -r "$root/target/." "$root/scratch/project/"
  mkdir -p "$root/scratch/project/node_modules"
  mount --bind "$root/deps/node_modules" "$root/scratch/project/node_modules"
  mount -o remount,bind,ro "$root/scratch/project/node_modules"
  ln -s scratch/tmp "$root/tmp"
  # Linux RLIMIT_AS in KiB; Node/PGlite reserve substantial virtual address space.
  ulimit -v 67108864 -t 180 -u 256 -f 131072 -n 1024
  mount --rbind "$root" "$root"
  mount -o remount,bind,ro "$root"
  exec /usr/sbin/chroot "$root" /usr/bin/setpriv --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/scratch/home TMPDIR=/scratch/tmp XDG_CACHE_HOME=/scratch/cache npm_config_cache=/scratch/cache NEXT_TELEMETRY_DISABLED=1 NODE_ENV=test PYTHONPATH=/scratch/project/saaf-circuit-breaker:/deps/python/lib/python3.11/site-packages /bin/bash -euc "
    cd /scratch/project
    npm test
    npm run typecheck
    npm run lint
    NODE_ENV=production npm run build
    python3 -m pytest -p no:cacheprovider saaf-circuit-breaker/tests -q
  "
' sandbox "$root/rootfs" "$root/seed" "$repo/node_modules" "$repo/saaf-circuit-breaker/.venv"
