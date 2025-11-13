#!/usr/bin/env bash
set -euo pipefail

### CONFIG ###########################################################

# Your environment branch order (from lowest to highest)
BRANCH_CHAIN=(dev int preprod master)

# Submodule paths relative to superproject root
SUBMODULES=(
  "config"   # TODO: change to real path
  "specific"   # TODO: change to real path
)

REMOTE_NAME="origin"

######################################################################

log() {
  echo "[git-env] $*" >&2
}

die() {
  echo "[git-env][ERROR] $*" >&2
  exit 1
}

ensure_clean() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "Working tree not clean in $(pwd). Commit or stash first."
  fi
}

run_in_submodules() {
  local cmd="$*"
  for sm in "${SUBMODULES[@]}"; do
    log "Submodule: $sm → $cmd"
    (cd "$sm" && eval "$cmd")
  done
}

######################################################################
# feature-start: create feature branch in superproject + submodules
#
# Usage:
#   ./git-env.sh feature-start feature/ST090-9999-new-thing [base-branch]
#   default base-branch = dev
######################################################################
cmd_feature_start() {
  local feature_branch="$1"
  local base_branch="${2:-dev}"

  log "Creating feature branch '$feature_branch' from '$base_branch'"

  ensure_clean

  # Superproject
  git fetch "$REMOTE_NAME" "$base_branch"
  git checkout "$base_branch"
  git pull "$REMOTE_NAME" "$base_branch" --ff-only

  git checkout -b "$feature_branch"

  # Submodules
  for sm in "${SUBMODULES[@]}"; do
    log "Creating feature branch in submodule: $sm"
    (
      cd "$sm"
      git fetch "$REMOTE_NAME" "$base_branch"
      git checkout "$base_branch"
      git pull "$REMOTE_NAME" "$base_branch" --ff-only
      git checkout -b "$feature_branch"
    )
  done

  log "Feature branches created. You may now push them if you want:"
  log "  git push -u $REMOTE_NAME $feature_branch"
  log "and inside each submodule:"
  log "  (cd submodule && git push -u $REMOTE_NAME $feature_branch)"
}

######################################################################
# promote: promote changes between env branches using fast-forward
#
# This will:
#  1) Promote in each submodule: from -> to (fast-forward only)
#  2) Update superproject submodule pointers & promote from -> to
#
# Usage:
#   ./git-env.sh promote dev int
#   ./git-env.sh promote int preprod
#   ./git-env.sh promote preprod master
######################################################################
cmd_promote() {
  local from="$1"
  local to="$2"

  log "Promoting '$from' → '$to' (submodules + superproject, FF-only)."

  ensure_clean

  # 1) Promote branches inside submodules
  for sm in "${SUBMODULES[@]}"; do
    log "[SUBMODULE] $sm: $from → $to"
    (
      cd "$sm"

      git fetch "$REMOTE_NAME" "$from" "$to" || true

      git checkout "$to"
      git pull "$REMOTE_NAME" "$to" --ff-only || true

      # This is the key fast-forward step
      git merge --ff-only "$from"

      git push "$REMOTE_NAME" "$to"
    )
  done

  # 2) Update superproject to point to new submodule SHAs on `to`
  log "[SUPERPROJECT] Updating submodule pointers for '$to'"

  git fetch "$REMOTE_NAME" "$to" || true
  git checkout "$to"
  git pull "$REMOTE_NAME" "$to" --ff-only || true

  # ensure each submodule is on the updated `to` branch
  for sm in "${SUBMODULES[@]}"; do
    log "Aligning submodule $sm on branch '$to'"
    (
      cd "$sm"
      git checkout "$to"
      git pull "$REMOTE_NAME" "$to" --ff-only || true
    )
  done

  git add "${SUBMODULES[@]}"
  if git diff --cached --quiet; then
    log "No submodule pointer changes detected in superproject."
  else
    git commit -m "Promote $from → $to (update submodules)"
    git push "$REMOTE_NAME" "$to"
  fi

  log "Promotion $from → $to done."
}

######################################################################
# hotfix-sync: bring a hotfix from an upper env branch down to a lower
#
# Typical use case:
#   - You hotfix on preprod or master
#   - You want lower envs (int/dev) to also have that commit
#   - So that future promotions still can use --ff-only
#
# Strategy:
#   - In each repo (submodules + superproject):
#       git checkout <lower>
#       git merge <upper>          # allows non-FF to pull hotfix down
#
# Later, when you promote lower → upper, you can use `promote` (FF-only).
#
# Usage:
#   ./git-env.sh hotfix-sync preprod int
#   ./git-env.sh hotfix-sync int dev
#   ./git-env.sh hotfix-sync master preprod
######################################################################
cmd_hotfix_sync() {
  local upper="$1" # where hotfix was done (e.g. preprod)
  local lower="$2" # where we want to sync it down (e.g. int)

  log "Hotfix sync: '$upper' → '$lower' (submodules + superproject)."

  ensure_clean

  # 1) Sync inside submodules
  for sm in "${SUBMODULES[@]}"; do
    log "[SUBMODULE] $sm: merging $upper into $lower"
    (
      cd "$sm"

      git fetch "$REMOTE_NAME" "$upper" "$lower" || true

      git checkout "$lower"
      git pull "$REMOTE_NAME" "$lower" || true

      # Allow non-FF merge here – this is where divergence happens by design
      git merge "$upper" || die "Merge conflict in submodule $sm ($upper → $lower). Resolve manually."

      git push "$REMOTE_NAME" "$lower"
    )
  done

  # 2) Sync in superproject
  log "[SUPERPROJECT] merging $upper into $lower"

  git fetch "$REMOTE_NAME" "$upper" "$lower" || true

  git checkout "$lower"
  git pull "$REMOTE_NAME" "$lower" || true

  # make sure submodules on `lower` branch are current
  for sm in "${SUBMODULES[@]}"; do
    log "Aligning submodule $sm on '$lower' (after hotfix merge)"
    (
      cd "$sm"
      git checkout "$lower"
      git pull "$REMOTE_NAME" "$lower" || true
    )
  done

  git add "${SUBMODULES[@]}"
  git commit -am "Hotfix sync: merge $upper → $lower (including submodules)" || true

  # merge upper into lower in superproject as well
  git merge "$upper" || die "Merge conflict in superproject ($upper → $lower). Resolve manually."

  git push "$REMOTE_NAME" "$lower"

  log "Hotfix sync $upper → $lower completed."
  log "Now '$lower' contains hotfix commits; next time you promote '$lower' → '$upper' you can use '--ff-only' again."
}

######################################################################
# CLI dispatcher
######################################################################

usage() {
  cat <<EOF
Usage:
  $(basename "$0") feature-start <feature-branch> [base-branch]
  $(basename "$0") promote <from-branch> <to-branch>
  $(basename "$0") hotfix-sync <upper-branch> <lower-branch>

Examples:
  # Create feature branch in superproject + submodules
  $(basename "$0") feature-start feature/ST090-9999-awesome-api dev

  # Normal promotion chain (FF-only)
  $(basename "$0") promote dev int
  $(basename "$0") promote int preprod
  $(basename "$0") promote preprod master

  # Hotfix sync (upper → lower)
  # hotfix on preprod → sync to int
  $(basename "$0") hotfix-sync preprod int
  # then sync to dev
  $(basename "$0") hotfix-sync int dev
EOF
}

main() {
  local cmd="${1-}"
  shift || true

  case "$cmd" in
    feature-start)
      [ $# -ge 1 ] || die "feature-start: missing <feature-branch>"
      cmd_feature_start "$@"
      ;;
    promote)
      [ $# -eq 2 ] || die "promote: need <from-branch> <to-branch>"
      cmd_promote "$@"
      ;;
    hotfix-sync)
      [ $# -eq 2 ] || die "hotfix-sync: need <upper-branch> <lower-branch>"
      cmd_hotfix_sync "$@"
      ;;
    ""|-h|--help|help)
      usage
      ;;
    *)
      die "Unknown command: $cmd"
      ;;
  esac
}

main "$@"
