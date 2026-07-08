
If any of the following needs a database change , flag it. We will exclude that from the list

This feedback is applicable to both Web UI and Mobile, though it is possible it was observed in one of the twop interfaces.

If I navigate to Edit Task from a focussed view and try to change the board in the drop down- that doesnt work. The page refreshes and comes back to the origina board

If the board has a no tasks, the New task button should be in the middle of the grid
Rename from + to "New Task". This is for all boards, not just new board.

Create a new view - Overdue.
This will be designed similar to Focussed.
Its criteria is - when dude date is in the past (target or must d o by)
The tab will show to the right of Focussed.
If there are overdue tasks, this will be the default view otherwise Focussed


Focussed and other non-all views - why are the edit/check/cross on the bottom ? All haave them at the top. Arent we using the same component ?

All views -
Need an option to toggle High on -off from the card
Need an option to change the date
Show High priority  first . rest of the tasks to be sorted by last updated on

Edit Task
If there are 0 links,  Keep one set of description/link text field visible to be filled in. 
For saved and un-saved links, show an icon to the right of the box which will open in a new tab

From what i can tell the boards have color assigned to them.
These colors shoudl be chnagable in settinngs.
Hard coded color options is fine. 
The board tab button under the All view - should be on the same color. 
When that board is chosen, the same color should be used to draw the kanban board
In Focussed/overdude/today/tomorrow - same color should be used to draw the bopundaries for cards- this is happening already 

Mobile specific
The view tabs on the right top corner are getting truncated. All doesnt even show up.
maybe show the view tabs below the header ?
Move some or all actions to - slide i.e. when the user slides the card to left or right , action links/buttons should show up


*****



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
