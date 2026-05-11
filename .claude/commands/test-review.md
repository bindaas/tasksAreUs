---
description: QE review of a GitHub PR — updates test_api.py and posts a summary comment to the PR
argument-hint: <PR number>
---

If no PR number was provided in "$ARGUMENTS", stop and tell the user: "Usage: /test-review <PR number>"

Otherwise, spawn the `test-reviewer` agent with this prompt:

"Assess and update tests for PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."
