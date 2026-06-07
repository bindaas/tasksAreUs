---
description: Run the full review chain on a PR — code review, test review, requirements review, and architecture review in sequence
argument-hint: <PR number>
---

If no PR number was provided in "$ARGUMENTS", stop and tell the user: "Usage: /full-review <PR number>"

Otherwise, run all four reviews in sequence for PR #$ARGUMENTS. Each review must fully complete before the next begins (they all write to files and must not run in parallel).

1. Spawn the `code-review` agent with: "Review PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."

2. Once the code review completes, fetch the review it posted to the PR and automatically apply all **Must fix** and **Should fix** items it identified. To do this:
   - Run `gh pr view $ARGUMENTS --json headRefName` to get the PR branch name, then check it out
   - Read the review comment Dopey just posted (fetch via `gh pr view $ARGUMENTS --json reviews` or `gh api repos/:owner/:repo/pulls/$ARGUMENTS/reviews`)
   - Make the code changes directly in the working tree
   - Commit and push to the PR branch
   - Do NOT ask the user for approval before applying fixes — just do it. Only pause if you hit a genuine ambiguity or conflict that makes you unsure what the correct fix should be (that is the "serious kerfuffle" threshold).
   - Skip this step entirely if the code-review agent approved with no Must fix or Should fix items.

3. Once that completes, spawn the `test-review` agent with: "Assess and update tests for PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."

4. Once that completes, spawn the `requirements-review` agent with: "Review PR #$ARGUMENTS and update PRODUCT_REQUIREMENTS_DOCUMENT.MD. Use $PR=$ARGUMENTS throughout your instructions."

5. Once that completes, spawn the `arch-review` agent with: "Update architecture and data-model docs for PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."

6. Once that completes, invoke the `fewer-permission-prompts` skill to scan transcripts and update the project allowlist.

After all steps finish, print a one-line summary: "Full review of PR #$ARGUMENTS complete — code, tests, requirements, and architecture all updated."
