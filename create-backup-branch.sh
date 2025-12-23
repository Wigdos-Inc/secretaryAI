#!/bin/bash
# Script to create main-backup-2 branch from main branch
# This script should be run by someone with push permissions to the repository

set -e  # Exit on any error

echo "=================================================="
echo "Creating main-backup-2 branch from main"
echo "=================================================="
echo

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "Error: This script must be run from the root of the git repository"
    exit 1
fi

# Fetch latest changes from remote
echo "Fetching latest changes from remote..."
git fetch origin

# Check if main-backup-2 branch already exists on remote
if git ls-remote --heads origin main-backup-2 | grep -q main-backup-2; then
    echo "Warning: main-backup-2 branch already exists on remote"
    echo "Do you want to delete and recreate it? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "Deleting existing main-backup-2 branch..."
        git push origin --delete main-backup-2
    else
        echo "Aborted."
        exit 0
    fi
fi

# Check if main-backup-2 branch exists locally
if git show-ref --verify --quiet refs/heads/main-backup-2; then
    echo "Deleting existing local main-backup-2 branch..."
    git branch -D main-backup-2
fi

# Create main-backup-2 branch from origin/main
echo "Creating main-backup-2 branch from origin/main..."
git branch main-backup-2 origin/main

# Verify the branch was created
if git show-ref --verify --quiet refs/heads/main-backup-2; then
    echo "✓ Local main-backup-2 branch created successfully"
else
    echo "Error: Failed to create main-backup-2 branch"
    exit 1
fi

# Push the branch to remote
echo "Pushing main-backup-2 branch to remote..."
git push origin main-backup-2

# Verify branch was pushed
if git ls-remote --heads origin main-backup-2 | grep -q main-backup-2; then
    echo
    echo "=================================================="
    echo "✓ SUCCESS!"
    echo "=================================================="
    echo "main-backup-2 branch has been created from main"
    echo
    
    # Show stats
    file_count=$(git ls-tree -r --name-only main-backup-2 | wc -l)
    echo "Total files in main-backup-2: $file_count"
    
    # Verify no differences with main
    if git diff --quiet origin/main main-backup-2; then
        echo "✓ Verified: main-backup-2 is identical to main"
    else
        echo "⚠ Warning: There are differences between main and main-backup-2"
        echo "Run 'git diff origin/main main-backup-2' to see differences"
    fi
else
    echo "Error: Failed to push main-backup-2 branch to remote"
    exit 1
fi

echo
echo "You can verify the branch with:"
echo "  git ls-remote --heads origin main-backup-2"
echo "  git diff origin/main origin/main-backup-2"
