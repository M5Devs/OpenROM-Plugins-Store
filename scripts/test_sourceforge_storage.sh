#!/usr/bin/env bash
#
# SourceForge connectivity & storage probe for the OpenROM Plugin Store.
#
# The marketplace depends on two independent SourceForge surfaces:
#
#   1. the public HTTP mirror that serves `.orplug` bundles to end users, and
#   2. the FRS upload path that maintainers / CI push bundles to.
#
# This script verifies the first, and — when credentials and tooling are
# available — proves write access to the second by uploading a small healthcheck
# file, confirming it is readable, and removing it again. When credentials or
# tooling are absent (a local sandbox), it prints how CI/CD is expected to
# publish instead of failing the run.
#
# Usage: bash scripts/test_sourceforge_storage.sh [--help]
#
# Environment:
#   SF_USER   SourceForge account name (required for the upload probe)
#   SF_PASS   SourceForge password (optional; an SSH key is preferred)
#
# Overridable targets (defaults match the production layout):
#   SF_DOWNLOAD_PROJECT=openrom-plugins   public download endpoint project
#   SF_FRS_PROJECT=openrom-plugins        FRS project bundles are uploaded to
#   SF_FRS_SUBDIR=                        subdirectory within that FRS project
#
# Exit status: 0 when every check that could run passed, 1 otherwise.

set -uo pipefail

SF_DOWNLOAD_PROJECT="${SF_DOWNLOAD_PROJECT:-openrom-plugins}"
SF_FRS_PROJECT="${SF_FRS_PROJECT:-openrom-plugins}"
SF_FRS_SUBDIR="${SF_FRS_SUBDIR:-}"
SF_FRS_HOST="${SF_FRS_HOST:-frs.sourceforge.net}"

SF_DOWNLOAD_BASE="https://downloads.sourceforge.net/project/${SF_DOWNLOAD_PROJECT}"
SF_PROJECT_PAGE="https://sourceforge.net/projects/${SF_DOWNLOAD_PROJECT}/files/"
SF_FRS_PATH="/home/frs/project/${SF_FRS_PROJECT}/${SF_FRS_SUBDIR}"
SF_FRS_PATH="${SF_FRS_PATH%/}/"

# The probe file must NOT be a dotfile: SourceForge's FRS rejects hidden files
# ("rename ... Bad address (14)"), so a `.sf_probe` name can never be uploaded.
SF_PROBE_FILE="sf_probe_healthcheck.txt"

CURL_TIMEOUT=25
SSH_TIMEOUT=30

if [[ -t 1 ]]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
  C_OK=''; C_WARN=''; C_ERR=''; C_DIM=''; C_OFF=''
fi

FAILURES=0
ok()    { printf '  %s✔%s %s\n' "$C_OK"   "$C_OFF" "$1"; }
warn()  { printf '  %s!%s %s\n' "$C_WARN" "$C_OFF" "$1"; }
bad()   { printf '  %s✘%s %s\n' "$C_ERR"  "$C_OFF" "$1"; FAILURES=$((FAILURES + 1)); }
info()  { printf '    %s%s%s\n' "$C_DIM" "$1" "$C_OFF"; }
head2() { printf '\n%s\n' "$1"; }
have()  { command -v "$1" >/dev/null 2>&1; }

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

printf 'SourceForge storage probe\n'
printf '  download project : %s\n' "$SF_DOWNLOAD_PROJECT"
printf '  FRS upload path  : %s:%s\n' "$SF_FRS_HOST" "$SF_FRS_PATH"

# --- 1. HTTP mirror verification --------------------------------------------
head2 '1. HTTP mirror verification'
info "GET ${SF_DOWNLOAD_BASE}/"

if ! have curl; then
  bad 'curl is not installed; cannot verify the HTTP mirror.'
else
  http_code="$(curl -s -o /dev/null -w '%{http_code}' -L --max-time "$CURL_TIMEOUT" "${SF_DOWNLOAD_BASE}/" 2>/dev/null)"
  case "$http_code" in
    000)
      bad "could not reach ${SF_DOWNLOAD_BASE} (no response; check network/DNS)." ;;
    200)
      ok "mirror responded 200 for ${SF_DOWNLOAD_BASE}/" ;;
    404)
      # A directory URL on downloads.sourceforge.net always 404s — even for
      # projects that do have files — because that host serves file paths, not
      # listings. It is not a usable health signal on its own, so confirm the
      # project page instead.
      warn 'downloads host returned 404 for the directory path (expected: it serves files, not listings).'
      info 'confirming the project itself is reachable…'
      page_code="$(curl -s -o /dev/null -w '%{http_code}' -L --max-time "$CURL_TIMEOUT" "$SF_PROJECT_PAGE" 2>/dev/null)"
      if [[ "$page_code" == "200" ]]; then
        ok "project page reachable (HTTP 200): ${SF_PROJECT_PAGE}"
        info "bundles resolve at: ${SF_DOWNLOAD_BASE}/<plugin-id>-<version>.orplug"
      else
        bad "project page returned HTTP ${page_code}; project '${SF_DOWNLOAD_PROJECT}' may not exist."
      fi ;;
    *)
      warn "mirror returned HTTP ${http_code} for the directory path (not treated as a failure)." ;;
  esac
fi

# --- 2. Credential detection -------------------------------------------------
head2 '2. Credential detection'

creds_present=0
if [[ -n "${SF_USER:-}" ]]; then
  ok "SF_USER is set (account: ${SF_USER})."
  creds_present=1
else
  warn 'SF_USER is not set.'
fi

if [[ -n "${SF_PASS:-}" ]]; then
  ok "SF_PASS is set (${#SF_PASS} characters; value not printed)."
else
  info 'SF_PASS is not set.'
fi

key_found=''
for k in "$HOME/.ssh/id_ed25519" "$HOME/.ssh/id_rsa" "$HOME/.ssh/id_ecdsa"; do
  [[ -f "$k" ]] && { key_found="$k"; break; }
done
[[ -z "$key_found" && -n "${SF_SSH_KEY:-}" && -f "${SF_SSH_KEY}" ]] && key_found="$SF_SSH_KEY"
if [[ -n "$key_found" ]]; then
  ok "SSH key found: ${key_found}"
else
  info 'No SSH key found; SourceForge will use password auth (keyboard-interactive).'
fi

# --- 3. Upload & FRS connectivity check -------------------------------------
head2 '3. Upload & FRS connectivity check'
info "target: ${SF_USER:-<user>}@${SF_FRS_HOST}:${SF_FRS_PATH}"

# SourceForge's FRS host offers publickey and keyboard-interactive, and its
# password flow is keyboard-interactive — so BatchMode must NOT be set on the
# password path, or ssh refuses to prompt. The password is passed via SSHPASS so
# it never lands in argv.
ssh_common=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout="$SSH_TIMEOUT")
ssh_cmd=''
runner_note=''

if [[ "$creds_present" -eq 0 ]]; then
  warn 'Skipping the upload probe: SF_USER is not set.'
elif ! have rsync; then
  warn 'Skipping the upload probe: rsync is not installed.'
  info 'install it (apt-get install -y rsync openssh-client) to exercise uploads here.'
elif ! have ssh; then
  warn 'Skipping the upload probe: ssh is not installed.'
elif [[ -n "$key_found" ]]; then
  ssh_cmd="ssh -i ${key_found} -o BatchMode=yes ${ssh_common[*]}"
  runner_note='SSH key'
elif have sshpass && [[ -n "${SF_PASS:-}" ]]; then
  export SSHPASS="$SF_PASS"
  ssh_cmd="sshpass -e ssh -o PreferredAuthentications=keyboard-interactive -o PubkeyAuthentication=no ${ssh_common[*]}"
  runner_note='sshpass (password via SSHPASS, keyboard-interactive)'
else
  warn 'Skipping the upload probe: no SSH key, and sshpass is unavailable or SF_PASS is unset.'
fi

remote_base="${SF_USER:-<user>}@${SF_FRS_HOST}:${SF_FRS_PATH}"
uploaded=0

if [[ -n "$ssh_cmd" ]]; then
  info "auth: ${runner_note}"

  probe_dir="$(mktemp -d)"
  printf 'OpenROM Plugin Store connectivity test: %s\n' "$(date -u)" > "${probe_dir}/${SF_PROBE_FILE}"

  # 3a. Write test.
  if rsync -q --timeout="$SSH_TIMEOUT" -e "$ssh_cmd" \
       "${probe_dir}/${SF_PROBE_FILE}" "$remote_base" 2>/dev/null; then
    uploaded=1
    ok "uploaded ${SF_PROBE_FILE} to ${SF_FRS_PATH}"
  else
    bad "rsync upload failed (check SF_USER/credentials and that ${SF_FRS_PATH} exists)."
  fi

  # 3b. Confirm the file is actually there, by listing the directory.
  if [[ "$uploaded" -eq 1 ]]; then
    if rsync -n -v --timeout="$SSH_TIMEOUT" -e "$ssh_cmd" "$remote_base" 2>/dev/null \
         | grep -qF "$SF_PROBE_FILE"; then
      ok 'confirmed the uploaded file is present on the remote.'
    else
      warn 'could not confirm the file remotely (upload reported success).'
    fi

    # 3c. Confirm the public mirror serves it.
    sleep 5
    pub_code="$(curl -s -o /dev/null -w '%{http_code}' -L --max-time "$CURL_TIMEOUT" \
      "${SF_DOWNLOAD_BASE}/${SF_PROBE_FILE}" 2>/dev/null)"
    if [[ "$pub_code" == "200" ]]; then
      ok "public mirror serves the uploaded file (HTTP 200)."
    else
      warn "public mirror returned HTTP ${pub_code} (propagation can lag; not fatal)."
    fi

    # 3d. Clean up. `--delete-missing-args` deletes exactly the named path and
    # nothing else — never use `--delete-excluded`, which removes excluded
    # siblings too.
    rm -f "${probe_dir}/${SF_PROBE_FILE}"
    if rsync -q --delete-missing-args --ignore-missing-args --timeout="$SSH_TIMEOUT" \
         -e "$ssh_cmd" "${probe_dir}/${SF_PROBE_FILE}" "$remote_base" 2>/dev/null; then
      ok 'removed the probe file (no leftovers).'
    else
      warn "could not remove ${SF_PROBE_FILE}; delete it manually."
    fi
  fi

  rm -rf "$probe_dir"
fi

# --- 4. How CI/CD publishes --------------------------------------------------
if [[ -z "$ssh_cmd" ]]; then
  head2 '4. How CI/CD publishes bundles'
  cat <<EOF
  The upload probe did not run here, but the deployment environment publishes
  bundles the same way it would:

    1. Provide SF_USER and SF_PASS as CI secrets (an SSH key is preferred).
    2. Upload the built bundle over rsync/SSH:

         rsync -av -e ssh \\
           "./<plugin-id>-<version>.orplug" \\
           "\${SF_USER}@${SF_FRS_HOST}:${SF_FRS_PATH}"

    3. The file is then served from the public download endpoint:

         ${SF_DOWNLOAD_BASE}/<plugin-id>-<version>.orplug

    4. Record the bundle's SHA-256 in the D1 \`plugins\` row so the storefront
       verifies the download before listing it.

  Note: SourceForge FRS rejects hidden files (dotfiles), so bundles must be
  uploaded under a normal filename such as '<plugin-id>-<version>.orplug'.
EOF
fi

# --- Summary -----------------------------------------------------------------
head2 'Summary'
if [[ "$FAILURES" -eq 0 ]]; then
  printf '  %sAll checks that could run passed.%s\n' "$C_OK" "$C_OFF"
  if [[ "$uploaded" -eq 1 ]]; then
    printf '  %sSourceForge is reachable, writable, and ready for .orplug hosting.%s\n' "$C_OK" "$C_OFF"
  else
    printf '  %sSourceForge is reachable; write access was not exercised here.%s\n' "$C_WARN" "$C_OFF"
  fi
  exit 0
fi
printf '  %s%d check(s) failed.%s\n' "$C_ERR" "$FAILURES" "$C_OFF"
exit 1
