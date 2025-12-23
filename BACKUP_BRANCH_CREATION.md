# Main Branch Backup - main-backup-2

## Overview
This document describes the process for creating the `main-backup-2` branch that contains an exact copy of all files from the `main` branch.

## Purpose
To create a backup of the main branch that preserves all files in their exact current state, maintaining all functionality without any modifications.

## Implementation

### Method: GitHub Actions Workflow
A GitHub Actions workflow has been created at `.github/workflows/create-main-backup-2.yml` that will:
1. Checkout the `main` branch with full history
2. Create a new branch called `main-backup-2` from the current state of `main`
3. Push the new branch to the remote repository

### How to Execute

#### Option 1: Run the Shell Script (Fastest)
A bash script `create-backup-branch.sh` is provided for quick execution:

```bash
# Make sure you're in the repository root
cd /path/to/secretaryAI

# Run the script (requires push permissions)
./create-backup-branch.sh
```

The script will:
- Fetch the latest changes from remote
- Check if the branch already exists (with option to recreate)
- Create main-backup-2 from origin/main
- Push the new branch to remote
- Verify the operation was successful

#### Option 2: Manual Trigger via GitHub Actions (Recommended)
1. Go to the GitHub repository
2. Navigate to **Actions** tab
3. Select **"Create main-backup-2 Branch"** workflow
4. Click **"Run workflow"** button
5. Select the branch to run from (typically `main` or the PR branch)
6. Click **"Run workflow"** to execute

#### Option 3: Manual Git Commands
If you prefer to run git commands directly, you can also execute:

```bash
git fetch origin
git branch main-backup-2 origin/main
git push origin main-backup-2
```

#### Note on Workflow Availability
Once this PR is merged to main, the workflow file will be available in the repository and can be triggered manually as described in Option 2.

## Verification
After the workflow runs successfully, you can verify the branch was created correctly:

```bash
# List all branches including the new backup branch
git fetch --all
git branch -a | grep backup

# Verify the branch contains all files from main
git diff main main-backup-2

# Count files in both branches (should be identical)
git ls-tree -r --name-only main | wc -l
git ls-tree -r --name-only main-backup-2 | wc -l
```

## Notes
- The `main-backup-2` branch will be an exact copy of `main` at the time the workflow is executed
- No files are modified - this is a pure copy operation
- All 125 files from the main branch will be preserved in the backup branch
- The backup branch will maintain the complete git history from main
