#!/bin/bash
# 全量高清转换并行调度：12 册，4 进程并行，每册分 15 页一批避免内存溢出
set -u
SRC_DIR="/Users/huangliping/Downloads/80年代小学语文课本人教版六年制1-12册"
OUT_ROOT="/Users/huangliping/WorkBuddy/80s-yuwen/pages"
NODE="/Users/huangliping/.workbuddy/binaries/node/versions/22.22.2/bin/node"
export NODE_PATH="/Users/huangliping/.workbuddy/binaries/node/workspace/node_modules"
CONV="/Users/huangliping/WorkBuddy/80s-yuwen/tools/convert-hd.js"
CHUNK=15

# 各册页数（从 PDF 提取，固定值）
declare -A PAGES=(
  [1]=61 [2]=59 [3]=83 [4]=83 [5]=72 [6]=72
  [7]=71 [8]=68 [9]=64 [10]=70 [11]=76 [12]=75
)

run_chunk() {
  local vol="$1"
  local start="$2"
  local end="$3"
  local vol2=$(printf %02d "$vol")
  local pdf="$SRC_DIR/80年代小学语文课本人教版六年制 第${vol}册.pdf"
  local out="$OUT_ROOT/v$vol2"
  echo "[$(date +%H:%M:%S)] start v${vol} p${start}-${end}"
  # 续跑模式：不加 force，已存在且 >10KB 的文件自动跳过
  "$NODE" "$CONV" "$pdf" "$out" "$start" "$end"
  echo "[$(date +%H:%M:%S)] end v${vol} p${start}-${end} (exit $?)"
}

export -f run_chunk
export SRC_DIR OUT_ROOT NODE NODE_PATH CONV CHUNK

# 生成所有 chunk 任务
TASKS=""
for vol in $(seq 1 12); do
  npages=${PAGES[$vol]}
  for s in $(seq 1 $CHUNK $npages); do
    e=$((s + CHUNK - 1))
    [ $e -gt $npages ] && e=$npages
    TASKS="${TASKS}v${vol}:${s}:${e}\n"
  done
done

echo -e "$TASKS" | grep -v '^$' | xargs -P 4 -I{} bash -c 'IFS=: read -r vol start end <<< "{}"; run_chunk "${vol#v}" "$start" "$end"'
echo "ALL DONE $(date +%H:%M:%S)"
