#!/usr/bin/env bash
# 端到端全模型 Worker 验收脚本
#  discover → example → submit → wait → show → logs → result
#  每个模型的 schema、示例输入、使用参数、任务详情、日志和结果均写入
#  e2e/jobs/<model>/ 目录。

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

case "$(uname -sm)" in
  "Darwin arm64") CLI="./dist/tumbleweed-darwin-arm64" ;;
  "Darwin x86_64") CLI="./dist/tumbleweed-darwin-x64" ;;
  "Linux aarch64") CLI="./dist/tumbleweed-linux-arm64" ;;
  "Linux x86_64") CLI="./dist/tumbleweed-linux-x64" ;;
  *) CLI="./dist/tumbleweed" ;;
esac

# 如果未编译对应平台二进制，回退到源码运行（需要 bun）
if [ ! -x "$CLI" ] && command -v bun >/dev/null 2>&1; then
  CLI="bun run src/bin.ts"
fi

RUN_ID="e2e-$(date +%Y%m%d-%H%M%S)"
RUN_ROOT="e2e/jobs"
REPORT="$RUN_ROOT/$RUN_ID-report.jsonl"
MASTER_LOG="$RUN_ROOT/$RUN_ID.log"

export TUMBLEWEED_WORKER_URL="${TUMBLEWEED_WORKER_URL:-http://100.120.104.69:9050}"

mkdir -p "$RUN_ROOT"
: > "$REPORT"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$MASTER_LOG"
}

# 根据模型资源超时 + 5 分钟缓冲
wait_timeout() {
  local model=$1
  case $model in
    af3|boltz2|rfdiffusion_aa) echo 21900 ;;
    dynamicbind|flowdock|xtrimopglm) echo 11100 ;;
    autodock_vina|diffdock|genos|gnina|peptune|prott5|rfdiffusion|smina) echo 7500 ;;
    esm3|pepmlm|proteinbert|protbert|proteinmpnn) echo 3900 ;;
    *) echo 900 ;;
  esac
}

# 设置每个模型的示例输入和工程验收参数
configure_model() {
  local model=$1
  INPUTS=()
  PARAMS=()
  EXTERNAL_PDB=""
  case $model in
    af3)
      INPUTS=("af_input=af_input_example.json")
      PARAMS=("num_diffusion_samples=1" "num_recycles=1")
      ;;
    autodock_vina)
      INPUTS=("receptor=receptor_example.pdbqt" "ligand=ligand_example.pdbqt" "box_config=box_config_example.txt")
      PARAMS=("exhaustiveness=1" "num_modes=1" "seed=42")
      ;;
    boltz2)
      INPUTS=("input_yaml=input_example.yaml")
      PARAMS=("recycling_steps=1" "sampling_steps=1" "diffusion_samples=1" "max_parallel_samples=1" "num_workers=0" "preprocessing_threads=1" "sampling_steps_affinity=1" "diffusion_samples_affinity=1")
      ;;
    diffdock)
      INPUTS=("protein=protein_example.pdb" "ligand=ligand_example.sdf")
      PARAMS=("samples_per_complex=1" "inference_steps=1" "actual_steps=1" "save_visualisation=false")
      ;;
    dynamicbind)
      INPUTS=("protein=protein_example.pdb" "ligand_csv=ligands_example.csv")
      PARAMS=("samples_per_complex=1" "savings_per_complex=1" "inference_steps=1" "batch_size=1" "seed=42")
      ;;
    esm3)
      INPUTS=("sequence=sequence_example.fasta")
      PARAMS=("task=embed")
      ;;
    flowdock)
      INPUTS=("receptor=receptor_example.pdb" "ligand=ligand_example.sdf")
      PARAMS=("n_samples=1" "chunk_size=1" "num_steps=1" "use_template=true" "seed=42")
      ;;
    genos)
      INPUTS=("sequence=sequence_example.fasta")
      PARAMS=("task=embed")
      ;;
    gnina)
      INPUTS=("receptor=receptor_example.pdb" "ligand=ligand_example.sdf" "autobox_ligand=autobox_ligand_example.sdf")
      PARAMS=("mode=dock" "cnn_scoring=rescore" "exhaustiveness=1" "num_modes=1" "seed=42")
      ;;
    pepmlm)
      INPUTS=("target=target_example.fasta")
      PARAMS=("peptide_length=8" "top_k=1" "num_binders=1" "seed=42")
      ;;
    peptune)
      INPUTS=("target=target_example.txt")
      PARAMS=("mode=unconditional" "sequence_length=8" "num_sequences=1" "sampling_steps=1")
      ;;
    proteinbert)
      INPUTS=("sequence=sequence_example.fasta")
      PARAMS=("seq_len=16" "batch_size=1")
      ;;
    protbert)
      INPUTS=("sequence=sequence_example.fasta")
      PARAMS=("task=both" "pooling=mean" "batch_size=1" "max_sequence_length=1024" "output_dtype=float32")
      ;;
    proteinmpnn)
      INPUTS=("pdb=input_example.pdb")
      PARAMS=("num_seq_per_target=1" "batch_size=1" "seed=42")
      ;;
    prott5)
      INPUTS=("sequence=sequence_example.fasta")
      PARAMS=("task=both" "pooling=mean" "batch_size=1" "max_sequence_length=1000" "output_dtype=float32")
      ;;
    rfdiffusion)
      # 无条件生成，无需必填输入
      PARAMS=("contigs=[30-30]" "num_designs=1" "t_steps=15" "write_trajectory=false" "deterministic=true")
      ;;
    rfdiffusion_aa)
      # Worker 未声明示例，使用上游官方 7v11.pdb
      EXTERNAL_PDB="https://raw.githubusercontent.com/baker-laboratory/rf_diffusion_all_atom/main/input/7v11.pdb"
      EXTERNAL_PDB_SHA="ba1e3014bd83f044d7c0d82bfd3d2218427a11e337dab41d00b724db50294cb7"
      INPUTS=("pdb=7v11.pdb")
      PARAMS=("ligand=OQO" "contigs=150-150" "num_designs=1" "diffusion_steps=40" "deterministic=true")
      ;;
    smina)
      INPUTS=("receptor=receptor_example.pdb" "ligand=ligand_example.sdf" "autobox_ligand=autobox_ligand_example.sdf")
      PARAMS=("mode=dock" "scoring=vina" "exhaustiveness=1" "num_modes=1" "seed=42")
      ;;
    xtrimopglm)
      INPUTS=("sequence=sequence_example.fasta")
      PARAMS=("task=embed")
      ;;
    *)
      log "[$model] 未知模型，跳过"
      return 1
      ;;
  esac
}

run_model() {
  local model=$1
  local model_dir="$RUN_ROOT/$model"
  mkdir -p "$model_dir/input" "$model_dir/result"

  log "[$model] ===== 开始 ====="

  # 1. 拉取并保存模型 schema / 参数
  log "[$model] 获取模型 schema..."
  $CLI jobs models "$model" > "$model_dir/schema.json"
  # 提取本次使用的参数说明写入 params.json
  jq --argjson params "$(printf '%s\n' "${PARAMS[@]}" | jq -R 'split("=") | {(.[0]): .[1]}' | jq -s 'add')" \
     '{model_id: .id, display_name: .display_name, params_used: $params, resources: .resources, inputs: .inputs, outputs: .outputs}' \
     "$model_dir/schema.json" > "$model_dir/params.json"

  # 2. 准备输入示例
  local input_args=()
  for entry in "${INPUTS[@]}"; do
    local name="${entry%%=*}"
    local filename="${entry#*=}"
    local local_path="$model_dir/input/$filename"
    if [[ "$model" == "rfdiffusion_aa" ]]; then
      if [[ ! -f "$local_path" ]]; then
        log "[$model] 下载外部输入 $EXTERNAL_PDB ..."
        curl -fsSL "$EXTERNAL_PDB" -o "$local_path"
        local sha
        sha=$(shasum -a 256 "$local_path" | awk '{print $1}')
        if [[ "$sha" != "$EXTERNAL_PDB_SHA" ]]; then
          log "[$model] 错误: 7v11.pdb SHA-256 校验失败 ($sha)"
          return 1
        fi
        if ! grep -q '^HETATM.* OQO ' "$local_path"; then
          log "[$model] 错误: 7v11.pdb 中未找到 OQO 配体"
          return 1
        fi
      fi
    else
      log "[$model] 下载示例输入 $name -> $filename ..."
      $CLI jobs example "$model" "$name" --output "$local_path"
    fi
    input_args+=("--input" "$name=$local_path")
  done

  # 3. 生成显式任务标识（Worker 要求 job_YYYYMMDD_HHMMSS_8hex）
  local suffix
  suffix=$(openssl rand -hex 4)
  local job_id="job_$(date -u +%Y%m%d_%H%M%S)_${suffix}"
  local idempotency_key="$RUN_ID-$model-v1"
  local job_alias="$RUN_ID-$model"

  # 4. 提交任务
  log "[$model] 提交任务 $job_id ..."
  local param_args=()
  for p in "${PARAMS[@]}"; do
    param_args+=("--param" "$p")
  done
  if ! $CLI jobs submit \
    --model "$model" \
    "${input_args[@]}" \
    "${param_args[@]}" \
    --job-id "$job_id" \
    --job-alias "$job_alias" \
    --idempotency-key "$idempotency_key" \
    > "$model_dir/submit.json"; then
    log "[$model] 提交失败，详情见 $model_dir/submit.json"
    # 仍尝试记录报告行
    jq -n \
      --arg run_id "$RUN_ID" \
      --arg model "$model" \
      --arg job_id "$job_id" \
      --arg status "SUBMIT_FAILED" \
      --arg model_dir "$model_dir" \
      --arg params "$(cat "$model_dir/params.json")" \
      '{run_id: $run_id, model: $model, job_id: $job_id, status: $status, dir: $model_dir, params: ($params | fromjson), result_files: []}' \
      >> "$REPORT"
    log "[$model] ===== 结束: SUBMIT_FAILED ====="
    return 1
  fi

  # 5. 等待终态
  local timeout
  timeout=$(wait_timeout "$model")
  log "[$model] 等待终态（timeout=${timeout}s）..."
  if ! $CLI jobs wait "$job_id" --interval 5 --timeout "$timeout" > "$model_dir/wait.json" 2>"$model_dir/wait.stderr"; then
    log "[$model] 等待终态失败或超时"
  fi

  # 6. 查看任务详情
  log "[$model] 查看任务详情..."
  $CLI jobs show "$job_id" > "$model_dir/job.json" || true

  # 7. 拉取日志
  log "[$model] 拉取日志..."
  $CLI jobs logs "$job_id" > "$model_dir/logs.json" || true

  # 8. 拉回结果
  local status="UNKNOWN"
  status=$(jq -r '.status // "UNKNOWN"' "$model_dir/job.json" 2>/dev/null || echo "UNKNOWN")
  if [[ "${status:-UNKNOWN}" == "SUCCEEDED" ]]; then
    log "[$model] 拉回结果..."
    $CLI jobs result "$job_id" --output-dir "$model_dir/result" > "$model_dir/result.json"
    find "$model_dir/result" -type f -size +0 -print > "$model_dir/result-files.txt"
  else
    log "[$model] 终态 ${status:-UNKNOWN}，跳过结果下载"
    echo '{}' > "$model_dir/result.json"
  fi

  # 9. 写入报告行
  local result_files
  result_files=$(cat "$model_dir/result-files.txt" 2>/dev/null || echo "")
  jq -n \
    --arg run_id "$RUN_ID" \
    --arg model "$model" \
    --arg job_id "$job_id" \
    --arg status "$status" \
    --arg model_dir "$model_dir" \
    --arg params "$(cat "$model_dir/params.json")" \
    --arg result_files "$result_files" \
    '{run_id: $run_id, model: $model, job_id: $job_id, status: $status, dir: $model_dir, params: ($params | fromjson), result_files: ($result_files | split("\n") | map(select(length > 0)))}' \
    >> "$REPORT"

  log "[$model] ===== 结束: $status ====="
  if [[ "$status" == "SUCCEEDED" ]]; then
    return 0
  else
    return 1
  fi
}

# ── 主流程 ────────────────────────────────────────────────────────────────
log "Run ID: $RUN_ID"
log "Worker: $TUMBLEWEED_WORKER_URL"
log "预检 Worker 健康..."
$CLI jobs health > "$RUN_ROOT/$RUN_ID-health.json"
log "预检通过"

log "发现模型列表..."
$CLI jobs models > "$RUN_ROOT/$RUN_ID-models.json"
MODELS=$(jq -r '.items[].id' "$RUN_ROOT/$RUN_ID-models.json")
log "发现 $(echo "$MODELS" | wc -l | tr -d ' ') 个模型"

PASS=0
FAIL=0
for model in $MODELS; do
  configure_model "$model" || continue
  if run_model "$model"; then
    ((PASS++)) || true
  else
    ((FAIL++)) || true
  fi
  # 模型间短暂停顿，避免集中提交
  sleep 2
done

log "================================"
log "Run ID: $RUN_ID"
log "通过: $PASS"
log "失败: $FAIL"
log "报告: $REPORT"
log "================================"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
