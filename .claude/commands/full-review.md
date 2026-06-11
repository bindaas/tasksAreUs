---
description: Run the full review chain on a PR — code review, test review, requirements review, and architecture review in sequence
argument-hint: <PR number>
---

If no PR number was provided in "$ARGUMENTS", stop and tell the user: "Usage: /full-review <PR number>"

Otherwise, run all four reviews in sequence for PR #$ARGUMENTS. Each review must fully complete before the next begins (they all write to files and must not run in parallel).

1. Spawn the `code-reviewer` agent with: "Review PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."

2. Once the code review completes, fetch the review it posted to the PR and automatically apply all **Must fix** and **Should fix** items it identified. To do this:
   - Run `gh pr view $ARGUMENTS --json headRefName,changedFiles` to get the PR branch name and changed file list, then check out the branch
   - Read the review comment Dopey just posted (fetch via `gh pr view $ARGUMENTS --json reviews` or `gh api repos/:owner/:repo/pulls/$ARGUMENTS/reviews`)
   - Make the code changes directly in the working tree
   - Commit and push to the PR branch. Include `[skip deploy]` in the commit message if no backend application files were changed — consult `RULES_OF_ENGAGEMENT.MD` for which paths trigger a deploy.
   - Do NOT ask the user for approval before applying fixes — just do it. Only pause if you hit a genuine ambiguity or conflict that makes you unsure what the correct fix should be (that is the "serious kerfuffle" threshold).
   - Skip this step entirely if the code-review agent approved with no Must fix or Should fix items.

3. Once that completes, spawn the `test-reviewer` agent with: "Assess and update tests for PR #$ARGUMENTS. Use $PR=$ARGUMENTS throughout your instructions."

4. Once that completes, spawn a `general-purpose` agent with the following prompt:
   "You are Bashful, the requirements-review agent. Read the full instructions in .claude/agents/requirements-review.md before doing anything else — those are your complete operating instructions. Then carry them out for PR #$ARGUMENTS. When you are done updating PRODUCT_REQUIREMENTS_DOCUMENT.MD, commit the file to the PR branch and push it before exiting."

5. Once that completes, spawn a `general-purpose` agent with the following prompt:
   "You are Doc, the arch-review agent. Read the full instructions in .claude/agents/arch-review.md before doing anything else — those are your complete operating instructions. Then carry them out for PR #$ARGUMENTS. When you are done updating ARCHITECTURE.MD and/or DATA_MODEL_AND_API.MD, commit any changed files to the PR branch and push them before exiting."

6. Once that completes, invoke the `fewer-permission-prompts` skill to scan transcripts and update the project allowlist.

7. Once that completes, tell the user: "All reviews are complete. Please run `/compact` to compact the conversation."

After all steps finish, print a one-line summary: "Full review of PR #$ARGUMENTS complete — code, tests, requirements, and architecture all updated."
