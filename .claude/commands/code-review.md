---
description: Independent code review of a GitHub PR — posts the review directly to the PR
argument-hint: <PR number>
---

If no PR number was provided in "$ARGUMENTS", stop and tell the user: "Usage: /code-review <PR number>"

Otherwise, spawn the `code-reviewer` agent with this prompt:

"Review PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."
