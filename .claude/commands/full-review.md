---
description: Run the full review chain on a PR — code review, test review, requirements review, and architecture review in sequence
argument-hint: <PR number>
---

If no PR number was provided in "$ARGUMENTS", stop and tell the user: "Usage: /full-review <PR number>"

Otherwise, run all four reviews in sequence for PR #$ARGUMENTS. Each review must fully complete before the next begins (they all write to files and must not run in parallel).

1. Spawn the `code-reviewer` agent with: "Review PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."

2. Once that completes, spawn the `test-reviewer` agent with: "Assess and update tests for PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."

3. Once that completes, spawn the `requirements-reviewer` agent with: "Review PR #$ARGUMENTS and update PRODUCT_REQUIREMENTS_DOCUMENT.MD. Use $PR=$ARGUMENTS throughout your instructions."

4. Once that completes, spawn the `arch-reviewer` agent with: "Update architecture and data-model docs for PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."

After all four finish, print a one-line summary: "Full review of PR #$ARGUMENTS complete — code, tests, requirements, and architecture all updated."
