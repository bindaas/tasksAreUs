
PR #39 merged into main (b6f781d). Task links are now live: backend, web, and mobile all shipped, with the sync per-item validation fix included.

Open items still worth a look (left as PR comments, not blockers):
- Mobile link-chip vs. drag-gesture — flagged for manual on-device verification
- TaskLink.id allows empty/duplicate values — minor validation gap
- validate_task_links() in schemas.py is now dead code — cleanup nit

******

Drop "Show done/show pending"  link on the Web/Mobile.
If there is API added specifically for this feature - it is probably not getting used anymore. Drop that code too

We need to drop the "chat feature altogether. For now cleanup the UI - mobile and web. We will do the APi and beyond in a later PR

Focussed view - change the default to be Today , and High and all boards. Keep everything else teh same, but remove the ability to edit from the UI. It remains in the database though

Add a new view "Today" this shows all the boards and only tasks which are due today.
Thsi view will also be designed similar to Fiocussed view. Thsi too is not editable from Settings

On simialr lines - create a biew Tomorrow whhich is identical to Today except it shows tasks from Tomorrow

We now have 4 tabs Focusses. Today.Tomorrow. All (detailed to be remaned as All)
The default view is Focussed.

We will drop the drop-down navigation of Boards from left nav. and instead create similar  tabbed buttons for boards right below the view buttons.
the board buttons will appear only if the View selected in All
The application name "taskAreUs" on left top corner needs to be removed.

The header on top "My Tasks" to be renamed as "Tasks Are Us - <View name>>" or "Tasks Are Us - <Board anme name>>" . Latter is when the view selected in All.
When a task is edited , and I come back to Task list screen, I should get teh same view/board 

I have given the feedback on Web interface mostly. Do a simailr flow on Mobile.




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
