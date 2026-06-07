

*****
Do we really need the device_id in users table ? what functionality would be lost if we removed it ?
Having device_id in addition to user_id seems to open the possibility of a user having two identities with same gmail account. That doesnt make sense.


****

⏺ Test review done. Now spawning requirements review.
         
⏺ requirements-review(Requirements review PR #15)
  ⎿  Initializing…
  ⎿  Error: Agent type 'requirements-review' not found. Available agents: claude-code-guide, code-reviewer, Explore, general-purpose, Plan, statusline-setup, test-reviewer

⏺ Skill(/requirements-review)
  ⎿  Successfully loaded skill

⏺ requirements-review(Requirements review PR #15)
  ⎿  Initializing…
  ⎿  Error: Agent type 'requirements-review' not found. Available agents: claude-code-guide, code-reviewer, Explore, general-purpose, Plan, statusline-setup, test-reviewer

⏺ The requirements-review subagent isn't a registered agent type — it lives as a project command. Let me run it directly:


Agents
port to golbal repo
Changes to full-review-
Just like we auto-fix code review 
Auto fix the test-review feedback , we shoudl auto-fix and bugs found during test-review.
The bug should be reported on the PR itself as an individual comment something like "BUG-1"

That should trigger changes to the code in the same branch.
And code-review will trigger again and then back to test-review again

Arch review should do the review of the architetcure, data model - look for design smells


*****


We need to build iphone app.
What changes are needed in firebase ?
will we re-use the existing frontend or have a new folder  for UI ?

Looking ahead - we will need to support Android too.
Same questions - what will we need to add in Firebase ?
I am quite sure - iphone code and android code will be the same

