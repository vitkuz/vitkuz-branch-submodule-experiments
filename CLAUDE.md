# Git Workflow Documentation

## Repository Overview

This repository uses a multi-environment branching strategy with git submodules to manage configuration across different deployment environments.

### Branch Structure

The repository follows a strict branch chain from lowest to highest environment:

```
dev → int → preprod → master
```

- **dev**: Development environment (base for feature branches)
- **int**: Integration/testing environment
- **preprod**: Pre-production environment
- **master**: Production environment

### Submodules

This repository contains two git submodules:

- **config**: Configuration submodule (`vitkuz-branch-submodule-experiments--config`)
- **specific**: Specific configuration submodule (`vitkuz-branch-submodule-experiments--specific`)

Both submodules follow the same branching strategy as the superproject.

---

## Workflow

### 1. Feature Development (Normal Flow)

**Process:**
1. Create a feature branch from `dev`
2. Develop and test your changes
3. Merge feature branch to `dev`
4. Promote changes through the environment chain: `dev → int → preprod → master`

**Key principles:**
- Always create feature branches from `dev`
- Use fast-forward merges for promotions between environment branches
- The script ensures both superproject and all submodules are synchronized

### 2. Hotfix Workflow (Back-sync)

**Process:**
When a hotfix is needed in an upper environment (e.g., `preprod` or `master`):
1. Create and merge the hotfix in the upper environment branch
2. Back-sync the hotfix to lower branches to maintain consistency
3. Continue normal promotion flow afterwards

**Example scenario:**
```
Hotfix in preprod → Back-sync to: preprod → int → dev
Hotfix in master → Back-sync to: master → preprod → int → dev
```

This ensures lower environments receive the hotfix and future promotions can still use fast-forward merges.

---

## Using git-env.sh Script

The `git-env.sh` script automates the workflow for both the superproject and all submodules.

### Configuration

Edit these variables in `git-env.sh`:

```bash
BRANCH_CHAIN=(dev int preprod master)
SUBMODULES=("config" "specific")
REMOTE_NAME="origin"
```

### Commands

#### 1. feature-start: Create Feature Branch

Creates a feature branch in both the superproject and all submodules.

**Syntax:**
```bash
./git-env.sh feature-start <feature-branch> [base-branch]
```

**Default base branch:** `dev`

**Example:**
```bash
./git-env.sh feature-start feature/ST090-9999-awesome-api dev
```

**What it does:**
- Fetches and checks out the base branch (default: `dev`)
- Creates the feature branch in the superproject
- Creates the same feature branch in all submodules
- Provides instructions for pushing the branches

**After creation, push your branches:**
```bash
# Push superproject feature branch
git push -u origin feature/ST090-9999-awesome-api

# Push submodule feature branches
cd config && git push -u origin feature/ST090-9999-awesome-api
cd ../specific && git push -u origin feature/ST090-9999-awesome-api
```

#### 2. promote: Fast-Forward Promotion

Promotes changes from one environment branch to the next using fast-forward merges.

**Syntax:**
```bash
./git-env.sh promote <from-branch> <to-branch>
```

**Examples:**
```bash
# Promote dev to int
./git-env.sh promote dev int

# Promote int to preprod
./git-env.sh promote int preprod

# Promote preprod to master
./git-env.sh promote preprod master
```

**What it does:**
1. **In each submodule:**
   - Checks out the target branch (`to`)
   - Merges source branch (`from`) using `--ff-only` (fast-forward only)
   - Pushes the updated target branch

2. **In superproject:**
   - Checks out the target branch
   - Updates submodule pointers to match the promoted submodule commits
   - Commits and pushes the submodule pointer updates

**Requirements:**
- Working tree must be clean (no uncommitted changes)
- Fast-forward merge must be possible (no divergent changes)

#### 3. hotfix-sync: Back-sync Hotfixes

Syncs hotfixes from an upper environment branch down to a lower branch.

**Syntax:**
```bash
./git-env.sh hotfix-sync <upper-branch> <lower-branch>
```

**Examples:**
```bash
# Hotfix was made in preprod, sync down to int
./git-env.sh hotfix-sync preprod int

# Then sync from int down to dev
./git-env.sh hotfix-sync int dev

# Hotfix in master, sync to preprod
./git-env.sh hotfix-sync master preprod
```

**What it does:**
1. **In each submodule:**
   - Checks out the lower branch
   - Merges the upper branch (allows non-fast-forward)
   - Pushes the updated lower branch

2. **In superproject:**
   - Checks out the lower branch
   - Updates submodule pointers
   - Merges the upper branch
   - Pushes the updated lower branch

**When to use:**
- After making a hotfix in production (`master`) or pre-production (`preprod`)
- To ensure lower environments receive critical fixes
- To maintain fast-forward-able promotion chain

---

## Complete Workflow Examples

### Example 1: Normal Feature Development

```bash
# 1. Create feature branch from dev
./git-env.sh feature-start feature/ST090-9999-new-api dev

# 2. Make your changes in superproject and submodules
# ... code, test, commit ...

# 3. Push feature branches (if not done earlier)
git push -u origin feature/ST090-9999-new-api
cd config && git push -u origin feature/ST090-9999-new-api
cd ../specific && git push -u origin feature/ST090-9999-new-api
cd ..

# 4. Merge feature to dev (via PR or locally)
git checkout dev
git merge feature/ST090-9999-new-api
git push origin dev

# Same for submodules
cd config
git checkout dev
git merge feature/ST090-9999-new-api
git push origin dev
cd ..

# (repeat for specific submodule)

# 5. Promote through environments
./git-env.sh promote dev int
./git-env.sh promote int preprod
./git-env.sh promote preprod master
```

### Example 2: Hotfix in Production

```bash
# 1. Hotfix was made directly in master branch
git checkout master
# ... make critical fix, commit, push ...

# 2. Back-sync the hotfix to all lower environments
./git-env.sh hotfix-sync master preprod
./git-env.sh hotfix-sync preprod int
./git-env.sh hotfix-sync int dev

# 3. Now all branches have the hotfix
# Future promotions will work with --ff-only again
```

### Example 3: Hotfix in Preprod

```bash
# 1. Hotfix was made in preprod
git checkout preprod
# ... make fix, commit, push ...

# 2. Back-sync to lower environments
./git-env.sh hotfix-sync preprod int
./git-env.sh hotfix-sync int dev

# 3. When ready, promote to production
./git-env.sh promote preprod master
```

---

## Best Practices

1. **Always keep working tree clean**
   - Commit or stash changes before running git-env.sh commands
   - The script will fail if there are uncommitted changes

2. **Use fast-forward for normal promotions**
   - Keep the promotion chain clean: dev → int → preprod → master
   - Avoid making direct changes in upper environments (int, preprod, master)

3. **Feature branches always from dev**
   - Never branch from int, preprod, or master for features
   - Only hotfixes should be made directly in upper branches

4. **Synchronize submodules**
   - The script handles submodule synchronization automatically
   - Always use the script for promotions and hotfix syncs

5. **Document hotfixes**
   - When making a hotfix in upper branches, document why
   - Immediately back-sync to maintain consistency

6. **Test in lower environments first**
   - Features should be tested in dev, then int, before reaching preprod
   - Only emergency fixes should bypass this flow

---

## Troubleshooting

### Merge Conflicts

If you encounter merge conflicts during promotion or hotfix-sync:
1. The script will stop and show an error
2. Resolve conflicts manually in the affected repository (superproject or submodule)
3. Complete the merge: `git add . && git commit`
4. Re-run the script command

### Fast-Forward Fails

If `promote` fails with "cannot fast-forward":
- Check if there are direct commits in the target branch
- If it's a hotfix, use `hotfix-sync` from upper to lower branch first
- Verify branch history: `git log --oneline --graph`

### Submodule Out of Sync

If submodule pointers are out of sync:
```bash
# Update submodules to match current pointers
git submodule update --init --recursive

# Or manually check out the correct branch in each submodule
cd config && git checkout <branch>
cd ../specific && git checkout <branch>
```

---

## SSH Configuration

This repository uses a personal SSH key for authentication.

**SSH config** (`~/.ssh/config`):
```
Host github-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
```

**Remote URL format:**
```
git@github-personal:vitkuz/vitkuz-branch-submodule-experiments.git
```

---

## Summary

- **Branch chain**: dev → int → preprod → master
- **Feature flow**: Branch from dev → merge to dev → promote up the chain
- **Hotfix flow**: Fix in upper branch → back-sync to lower branches
- **Automation**: Use `git-env.sh` for all branch operations
- **Submodules**: Automatically synchronized by the script
