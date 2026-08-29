#!/bin/bash
# 全量高清转换并行调度：12 册，4 进程并行
set -u
SRC_DIR="/Users/huangliping/Downloads/80年代小学语文课本人教版六年制1-12册"
OUT_ROOT="/Users/huangliping/WorkBuddy/80s-yuwen/pages"
NODE="/Users/huangliping/.workbuddy/binaries/node/versions/22.22.2/bin/node"
export NODE_PATH="/Users/huangliping/.workbuddy/binaries/node/workspace/node_modules"
CONV="/Users/huangliping/WorkBuddy/80s-yuwen/tools/convert-hd.js"

run_one() {
  local vol="$1"
  local vol2=$(printf %02d "$vol")
  local pdf="$SRC_DIR/80年代小学语文课本人教版六年制 第${vol}册.pdf"
  local out="$OUT_ROOT/v$vol2"
  echo "[$(date +%H:%M:%S)] start vol $vol"
  "$NODE" "$CONV" "$pdf" "$out" 2 force
  echo "[$(date +%H:%M:%S)] end vol $vol (exit $?)"
}

export -f run_one
export SRC_DIR OUT_ROOT NODE NODE_PATH CONV

# 第 2-12 册，4 进程并行
seq 2 12 | xargs -P 4 -I{} bash -c 'run_one {}'
echo "ALL DONE $(date +%H:%M:%S)"
