Editable Task details-
Make the task details editable from the Focussed , Today and tomorrow view as well. Just like its in the "all" view

Sticky Boards and view
If I navigate out  to reports, settings , task details, when I come back I want the same view and board selected

Task details
Labels appear twice in task details. Remove the read-only ones
Move the Add Link right below notes
Make the Notes section bigger

Board tabs- positioning
Make them right aligned. Right below the view buttons


Settings- 
Settings page to be board neutral.
For the board specific sections  add a dropdown to select the board

Reports -
To be board neutral.
The results should show across all boards


******





Good — backend API is on port 8000. Let's start the Vite dev server for the frontend.

  Ran 7 shell commands

Now it's up. Let's verify health and check the frontend container too (it's likely already running our source via bind mount):

  Ran 1 shell command

Both backend API and the dockerized Vite dev server (bind-mounted to my source) are up on port 5173. Let's open it in the browser.

  Called claude-in-chrome

Browser extension isn't connected in this environment, so I can't drive it visually. Let me at least smoke-test the API and do a thorough static sweep for stale references before reporting back.

  Ran 4 shell commands

Now the day-view route exists (401 auth error is expected). Backend is current. Let's check the frontend dev server is proxying correctly and get a screenshot via a non-extension approach — actually, let's retry the browser extension connection once more since it may just need a retry.

  Called claude-in-chrome, ran 3 shell commands

Real Firebase config is present, so anonymous sign-in should work against the dev server. Let's write a quick Playwright script to drive the actual app.

⏺ Write(/private/tmp/claude-501/-Users-bindaas-projects-tasksAreUs/0655829c-3c62-4d66-951f-100b220dc9f2/scratchpad/verify.mjs)
Wrote 46 lines

⏺ Running 3 shell commands…
  ⎿  $ cd /private/tmp/claude-501/-Users-bindaas-projects-tasksAreUs/0655829c-3c62-4d66-951f-100b220dc9f2/scratchpad && node verify.mjs 2>&1 | tail -100 (50s)
     (ctrl+b to run in background)

✶ Run frontend typecheck/build/tests, manual browser verification… (11m 4s · ↓ 54.3k tokens)
◼ Run frontend typecheck/build/tests, manual browser verification
✔ api/tasks.ts: add board_id, fix createTask override bug
✔ New api/dayView.ts
✔ Trim api/focusedView.ts (remove config functions)
✔ Extract BoardGroupedTasks.tsx from FocusedView.tsx
 … +10 completed


 *************



PR #39 merged into main (b6f781d). Task links are now live: backend, web, and mobile all shipped, with the sync per-item validation fix included.

Open items still worth a look (left as PR comments, not blockers):
- Mobile link-chip vs. drag-gesture — flagged for manual on-device verification
- TaskLink.id allows empty/duplicate values — minor validation gap
- validate_task_links() in schemas.py is now dead code — cleanup nit

******

Drop "Show done/show pending"  link on the Web/Mobile.
If there is API added specifically for this feature - it is probably not getting used anymore. Drop that code too

We need to drop the "chat feature altogether. For now cleanup the UI - mobile and web. We will do the APi and databse and LLM  in a later PR

Focussed view - change the default to be Today , and High and all boards. Keep everything else the same, but remove the ability to edit from the UI. It remains in the database though

Add a new view "Today" this shows all the boards and only tasks which are due today.
Thsi view will also be designed similar to Fiocussed view. This too is not editable from Settings

On simialr lines - create a view Tomorrow whhich is identical to Today except it shows tasks from Tomorrow instead of Today

We now have 4 views -  Focused. Today.Tomorrow. All (detailed to be remaned as All)
These should appear in the above mentioned order
The default view is Focussed.

We will drop the drop-down navigation of Boards from left nav. and instead create similar  tabbed buttons for boards right below the view buttons.
the board buttons will appear only if the View selected in All
The application name "taskAreUs" on left top corner needs to be removed.

The header on top "My Tasks" to be renamed as "Tasks Are Us - <View name>>" or "Tasks Are Us - <Board anme name>>" . Latter is when the view selected in All.
When a task is edited , and I come back to Task list screen, I should get teh same view/board 

I have given the feedback on Web interface mostly. Do a simailr flow on Mobile.

Ask clarifying questions - one at a time
Once done, create a plan for Sleepy to review




******

Web and Mobile
Do not allow drag-drop to Upcoming Tasks

The tasks should be ordered by last updated date-time. Most recent at the top. If the task is newly created its last_updated should be same as created date-time (Note- High priority tasks will be at the top ; they too shoukd follow the chonological rule within themselves though)


Mobile only:
If label are selected on Task screen , when I go to new task screen - it should auto select the lables from the Task screen (This behavior already exisist in the Web)
Labels on the Task list should display in consistent order - same order as web

High priority tasks should be on the top. (this is how its on broweser as well)
On task list - Swiping the Task detail  to left should open a menu which has an option to toggle the high priority field

Web only
Task details - Notes section should be bigger to allow ease of text

******
Each task details to have max of 3 links - each is a pair - link and short description.
These 3 will appear on the task card in task list as links and will open the link in theg browser ( different atb for browser)

******
On task list , add an option of "focus view"
Thsi should show only the High priority tasks for today
This should change teh view entirely - showing the tasks cards in two column display

*******



Install androod emulator and test

****
Track user usage. Last logged in
****
Delete anonymous users ?
