#!/usr/bin/env bash
# 手动端到端测试：Worker 走 Tailscale，但 MinIO presign URL 里的内网 IP 手动替换为 Tailscale IP
set -euo pipefail

CLI="./dist/tumbleweed-darwin-arm64"
WORKER="http://100.120.104.69:9050"
MINIO_PUBLIC_HOST="100.120.104.69:9000"
MINIO_INTERNAL_HOST="10.39.13.209:9000"

export TUMBLEWEED_WORKER_URL="$WORKER"
MODEL="esm3"
INPUT_NAME="sequence"
TMP_DIR="/tmp/tw-tailscale-test-$$"
JOB_ID="job_$(date -u +%Y%m%d_%H%M%S)_$(openssl rand -hex 4)"

echo "== 手动 Tailscale E2E 测试 =="
echo "Job ID: $JOB_ID"

mkdir -p "$TMP_DIR"

# 1. 下载示例输入
echo "[1/6] 下载示例输入..."
$CLI jobs example "$MODEL" "$INPUT_NAME" --output "$TMP_DIR/seq.fa"

# 2. 申请 presign URL，并替换 host
echo "[2/6] 申请 presign URL..."
PRESIGN_RESP=$(curl -s -X POST "$WORKER/uploads/presign" \
  -H "Content-Type: application/json" \
  -d "{\"model_id\":\"$MODEL\",\"input_name\":\"$INPUT_NAME\",\"filename\":\"seq.fa\",\"content_type\":\"text/plain\",\"job_id\":\"$JOB_ID\",\"size_bytes\":$(stat -f%z "$TMP_DIR/seq.fa")}")

echo "Presign response: $PRESIGN_RESP"
UPLOAD_URL=$(echo "$PRESIGN_RESP" | jq -r '.url' | sed "s/$MINIO_INTERNAL_HOST/$MINIO_PUBLIC_HOST/")
OBJECT_KEY=$(echo "$PRESIGN_RESP" | jq -r '.object_key')
echo "Rewritten upload URL: $UPLOAD_URL"

# 3. 手动上传文件到 MinIO（使用替换后的 Tailscale 地址）
echo "[3/6] 手动上传文件到 MinIO..."
curl -f -X PUT "$UPLOAD_URL" -H "Content-Type: text/plain" --data-binary "@$TMP_DIR/seq.fa"
echo "上传成功"

# 4. 通过 CLI 提交任务（跳过上传，直接传 object_key）
echo "[4/6] 提交任务..."
$CLI jobs submit \
  --model "$MODEL" \
  --input-key "$INPUT_NAME=$OBJECT_KEY" \
  --param task=embed \
  --job-id "$JOB_ID" \
  --job-alias "manual-tailscale-test" \
  --idempotency-key "manual-tailscale-test-v1"

# 5. 等待终态
echo "[5/6] 等待终态..."
$CLI jobs wait "$JOB_ID" --interval 5 --timeout 600

# 6. 获取结果 presign URL，替换 host 后下载
echo "[6/6] 拉回结果..."
RESULT_RESP=$($CLI jobs result "$JOB_ID")
RESULT_URL=$(echo "$RESULT_RESP" | jq -r '.url' | sed "s/$MINIO_INTERNAL_HOST/$MINIO_PUBLIC_HOST/")
echo "Rewritten result URL: $RESULT_URL"
curl -f -L "$RESULT_URL" -o "$TMP_DIR/result.zip"
echo "结果下载到: $TMP_DIR/result.zip"
ls -lh "$TMP_DIR/result.zip"

echo "== 测试完成 =="
