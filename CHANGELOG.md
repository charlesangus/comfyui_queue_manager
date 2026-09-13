# Release Notes

## v0.6.0
_Sep 13, 2026_
### New features and enhancements
- Every queue job now has an integer priority (default `0`, user range `-100`\-`100`). Set it from the selection action bar's new **Priority** menu, with Low/Normal/High presets or a custom value. Higher priority jobs run first; jobs with equal priority keep the existing order, so **Run at front of the queue** still works as a tie-break within a priority level.
- Priority is shown as a small badge on the card (green for positive, muted blue-grey for negative), and survives archive/run as well as export/import.

### Bugfixes
- Fixed a bug where an item the extension had already prefetched into the native execution queue could silently block a legitimate front-of-queue submission; submitting or boosting a higher-priority item now correctly preempts it.

---

## v0.5.0
_Sep 13, 2026_
### New features and enhancements
- Queue cards are now selectable: click to select, Ctrl/Cmd+click to toggle, Shift+click to select a range, Ctrl/Cmd+A to select everything on the page, and Escape to clear the selection.
- Replaced the per-card Delete/Load/Archive/Run buttons with a single selection action bar above the footer, showing only the actions valid for the current selection and tab (Clear, Delete, Load, Archive, Run). Shift-click **Run** on the bar to run the selection at the front of the queue, same as the existing Run All behavior.
- Delete/Backspace now deletes the current selection from the keyboard, with a confirmation prompt when more than 5 items are selected.

---

## v0.4.0
_Sep 13, 2026_
### New features and enhancements
- Failed jobs now show up in Completed with a red **Error** badge and an expandable error message, node, and traceback, instead of looking indistinguishable from a successful completion.
- Jobs interrupted with ComfyUI's own native Stop button now stay visible in Completed with an **Interrupted** badge, instead of disappearing entirely.
- Deleting a running job from the Queue Manager's own Delete button still removes it entirely, as before.

---

## v0.3.0
_Sep 12, 2026_
### New features and enhancements
- Panel now follows the ComfyUI color palette and font, with theme switching synchronized to the ComfyUI interface.
- Queue entries are now displayed as individual cards for improved layout and interaction.
- Added the **Queue Card Info** node for displaying workflow values on queue cards.

---

## v0.2.0
_Sep 12, 2026_
### Removed
- Removed the gallery lightbox, cover/grid thumbnail modes, and associated size sliders.
- Completed jobs now show output thumbnails that open in a new browser tab.

---

## v0.1.0
_Sep 06, 2026_
### New features and enhancements
- Major update with focus on providing previews for completed jobs, gallery and UI improvements.
- A new settings panel is available in **ComfyUI Menu → Settings → Queue Manager** where you can influence certain features of the extension (#11, #17).
- From now on completed jobs will show total execution time (#3).

### Bugfixes
- Fixed: Export function did not respect the tab from which it was used.
- Light theme color fixes;

## v0.0.19
_Sep 06, 2025_
### New features and enhancements
Fixed PLAY and STOP buttons disappearing when toggling side-bar [#28]

---

## v0.0.18
_Sep 05, 2025_
### New features and enhancements
Fixed PLAY and STOP buttons for new versions of ComfyUI

---

## v0.0.17
_Dec 21, 2025_
### New features and enhancements
- Added legacy-like **Stop / Clear queue** button removed in ComfyUI 0.4.0
- Added **Delete All Pending** button (equivalent to native Stop / Clear all)
- Added **queue counter badge** to the Queue Manager tab button (required since native Queue tab removal in ComfyUI 0.4.0+) (#24)

---

## v0.0.16
_Dec 13, 2025_
### Bugfixes
- Fixed **Pause / Play button** compatibility with ComfyUI 1.33.1+ (#21)

---

## v0.0.15
_Dec 12, 2025_
### Enhancements
- Compatibility fixes for **ComfyUI 0.3.68** (#15, #16)
- Added support for **Partner Nodes**
- Improved handling of **Comfy API keys**
- Added warning regarding **lack of multi-account support**
- Troubleshooting improvements and common issue fixes

---

## v0.0.14
_Nov 25, 2025_
### Bugfixes
- Fixed **Pause / Resume button** not displaying correctly (#13)

---

## v0.0.13
_Nov 25, 2025_
### Bugfixes
- Fixed error: `this.fetchApi is not a function`

  _(Resolved issues #8, #18, and #20)_

---

## v0.0.12
_Nov 06, 2025_
### Bugfixes
- Workaround fix for **“Works for only one generation”** issue (#15)

---

## v0.0.11
_Nov 06, 2025_
### Bugfixes
- Fixed **bad asset URLs**
- Included missing build files in packaged release

---
## v0.0.9
_Nov 04, 2025_
### Enhancements
- Better handling of external jobs (#12)

---

## v0.0.8
_Oct 26, 2025_
### Bugfixes
- Fixed inability to cancel running jobs on older ComfyUI versions when using newer extension versions (#10)

---

## v.0.0.6
_Oct 20, 2025_
### Bugfixes
- Fix to the container size inside ComfyUI sidebar;

---

## v.0.0.5
_Oct 19, 2025_
### Bugfixes
- Side bar icon label fix
- Failed to load GUI on windows. (#4)
- No longer able to cancel current item in queue. (#7)

---

## v.0.0.3
_Jun 29, 2025_
### New features
- Added **Workflow Name** string node. The node emits the currently running workflow's name as a string.

---

## v.0.0.2
_Jun 25, 2025_
### Bugfixes
- addressed "missing NODE_CLASS_MAPPINGS" nag (#1)

---

## v.0.0.1 - Initial Release
_Jun 25, 2025_
- First stable draft of the project.
