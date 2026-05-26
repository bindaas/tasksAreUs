---
description: Reconcile PRODUCT_REQUIREMENTS_DOCUMENT.MD against a merged or open PR — marks aspirational items and posts a summary comment to the PR
argument-hint: <PR number>
---

If no PR number was provided in "$ARGUMENTS", stop and tell the user: "Usage: /requirements-review <PR number>"

Otherwise, spawn the `requirements-reviewer` agent with this prompt:

"Review PR #$ARGUMENTS and update PRODUCT_REQUIREMENTS_DOCUMENT.MD. Use $PR=$ARGUMENTS throughout your instructions."
