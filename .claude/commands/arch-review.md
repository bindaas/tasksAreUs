---
description: Keep ARCHITECTURE.MD and DATA_MODEL_AND_API.MD up to date — reads a merged or open PR, updates both docs to reflect what shipped, and posts a summary comment to the PR
argument-hint: <PR number>
---

If no PR number was provided in "$ARGUMENTS", stop and tell the user: "Usage: /arch-review <PR number>"

Otherwise, spawn the `arch-reviewer` agent with this prompt:

"Update architecture and data-model docs for PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."
