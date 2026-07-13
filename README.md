# tumbleweed-scientific-cli

CLI client for [tumbleweed-scientific-worker](../tumbleweed-scientific-worker) — submit, monitor, and retrieve AI model inference jobs.

Designed primarily for **AI Agent** consumption (JSON output by default), with optional human-readable mode.

## Install

### Pre-built binary (recommended for Agent environments)

Download the latest release for your platform from [GitHub Releases](../../releases):

```bash
# macOS Apple Silicon
curl -Lo tumbleweed https://github.com/<org>/tumbleweed-scientific-cli/releases/latest/download/tumbleweed-darwin-arm64
chmod +x tumbleweed
sudo mv tumbleweed /usr/local/bin/
```

### From source

```bash
bun install
bun run src/index.ts --help
```

## Configuration

```bash
# Option 1: Environment variable (highest priority)
export TW_API_URL=http://your-worker:8080

# Option 2: Config file
tumbleweed config set api_url http://your-worker:8080
tumbleweed config set job_owner my_lab

# Show current config with sources
tumbleweed config show
```

Config file location: `~/.config/tumbleweed/config.json`

## Usage

All commands output JSON by default. Add `--human` for colored, human-readable output.

### List available models

```bash
tumbleweed models list
tumbleweed models list --detail    # full model specs
```

### Upload input files

```bash
tumbleweed upload input.fa --model esm3 --input-name sequence
tumbleweed upload input.fa --model esm3 --input-name sequence --job-id job_20260708_143012_a1b2c3d4
```

### Submit a job

```bash
tumbleweed jobs submit --model esm3 \
  --input-key sequence=jobs/xxx/input/sequence/input.fa

tumbleweed jobs submit --model rfdiffusion \
  --param num_designs=4 \
  --param contigs=100
```

### Monitor jobs

```bash
tumbleweed jobs list
tumbleweed jobs status <job_id>
tumbleweed jobs logs <job_id>
```

### Wait for completion (Agent workflow)

```bash
tumbleweed jobs wait <job_id> --timeout 600 --interval 5
```

### Download results

```bash
tumbleweed jobs result <job_id>                      # get download URL
tumbleweed jobs result <job_id> --output-dir ./out   # download to local
```

### Cancel a job

```bash
tumbleweed jobs cancel <job_id>
```

### Health check

```bash
tumbleweed health
tumbleweed health --ready   # also check registry/database/storage
```

## Agent Integration

All commands default to machine-readable JSON on stdout, errors on stderr, and conventional exit codes:

| Exit code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | Business error (job not found, validation failed, etc.) |
| 2 | Infrastructure error (network, configuration) |

Typical Agent workflow:

```bash
# 1. Upload input
UPLOAD=$(tumbleweed upload input.fa --model esm3 --input-name sequence)
KEY=$(echo "$UPLOAD" | jq -r '.objectKey')

# 2. Submit job
JOB=$(tumbleweed jobs submit --model esm3 --input-key sequence="$KEY")
JOB_ID=$(echo "$JOB" | jq -r '.id')

# 3. Wait for completion
tumbleweed jobs wait "$JOB_ID" --timeout 600

# 4. Download result
tumbleweed jobs result "$JOB_ID" --output-dir ./results
```

## Build

```bash
# Build for current platform
bun run build

# Build for all platforms (requires respective OS runners in CI)
bun run build:all
```

## Tech Stack

See [docs/STACKS.md](docs/STACKS.md) for technology stack decisions.
