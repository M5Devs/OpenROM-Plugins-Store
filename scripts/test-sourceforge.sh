#!/usr/bin/env bash
# Convenience alias. The implementation lives in test_sourceforge_storage.sh
# (the name referenced by the task's verification step).
set -euo pipefail
exec bash "$(dirname "$0")/test_sourceforge_storage.sh" "$@"
