import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

interface HelpItem { key: string; desc: string; }
interface HelpSection {
  title: string;
  icon: string;
  color: string;
  intro: string;
  items: HelpItem[];
}

@Component({
  selector: 'app-help-modal',
  imports: [],
  templateUrl: './help-modal.html',
  styleUrl: './help-modal.scss',
})
export class HelpModal {
  private readonly dialogRef = inject(MatDialogRef<HelpModal>);
 
  activeIdx = 0;
 
  readonly sections: HelpSection[] = [
    {
      title: 'Getting Started',
      icon: '◈',
      color: '#3b82f6',
      intro: 'The fastest ways to go from an empty canvas to a working dashboard.',
      items: [
        { key: '⊟ Templates',     desc: 'Click Templates in the topbar or the sidebar to open the template picker. Choose from EPX Clinical, Accounting, Prescriptions, Aggregation Functions, Filter Operations, Patient Roster, Appointment Quality, or Site Performance — each loads a fully wired layout with live queryConfig data you can customise immediately.' },
        { key: '⚡ Demo',          desc: 'Click the green Demo button in the topbar to instantly populate the canvas with a sample dashboard containing all widget types. Great for exploring the builder before building your own.' },
        { key: '+ Add Widget',    desc: 'Click the blue + Add Widget button in the topbar, or click any widget type in the left sidebar. This opens the 3-step wizard: (1) Choose type → (2) Select fields → (3) Configure & preview. You can only add it to the canvas on the final step.' },
        { key: '⬆ Import',        desc: 'Click Import in the topbar to load a previously exported .json file. Drag-and-drop the file or click to browse. This restores your entire layout including widget titles, fields, and colours. Note: importing replaces the current canvas.' },
        { key: '⬇ Export',        desc: 'Click Export in the topbar to download your current dashboard as a .json file named after your dashboard title. You can import this file later to restore the exact same layout.' },
        { key: 'Dashboard title', desc: 'Click the title text next to the logo in the topbar to rename your dashboard. Press Enter or click elsewhere to save. The title is included in your exported JSON filename.' },
      ],
    },
    {
      title: 'Moving & Resizing',
      icon: '⟐',
      color: '#22c55e',
      intro: 'Widgets snap to a 12-column grid. Dragging and resizing both have collision detection to prevent overlap.',
      items: [
        { key: 'Drag to move',       desc: 'Click and hold any widget\'s header bar (the dark title row), then drag it to a new position. The widget snaps to the nearest grid cell. Any widget in the way automatically shifts downward to make room — the layout resolves itself live as you drag. Only locked widgets cannot be displaced.' },
        { key: 'Resize — right edge', desc: 'Hover the right edge of a widget. A blue highlight appears. Drag it left or right to change the number of columns the widget occupies (minimum 1, maximum 12).' },
        { key: 'Resize — bottom edge', desc: 'Hover the bottom edge and drag it up or down to change the widget\'s row height (minimum 1 row).' },
        { key: 'Resize — corner',     desc: 'Drag the small triangle in the bottom-right corner to resize width and height simultaneously.' },
        { key: 'Arrow key nudge',     desc: 'Click a widget once to select it (its border turns blue). Then use the keyboard arrow keys ↑ ↓ ← → to nudge it one grid cell in that direction. Collision detection still applies.' },
        { key: '⊕ Pack layout',       desc: 'Click Pack in the topbar to automatically collapse all empty row gaps. Every widget moves up as high as it can go without overlapping others. Useful after deleting or rearranging widgets.' },
        { key: 'Auto-push',           desc: 'The grid uses a push layout — dragging or resizing a widget into occupied space automatically displaces other widgets downward to make room. The only exception is locked widgets, which cannot be displaced.' },
      ],
    },
    {
      title: 'Editing Widgets',
      icon: '✎',
      color: '#f59e0b',
      intro: 'Every widget is fully customisable. Hover to reveal action buttons, or right-click for the context menu.',
      items: [
        { key: 'Hover to reveal actions', desc: 'Move your mouse over any widget to reveal action buttons in the top-right corner: Duplicate (⊞), Edit (✎), Lock (🔓/🔒), Bring to front (↑), and Delete (✕).' },
        { key: 'Right-click context menu', desc: 'Right-click any widget to open a floating context menu with all actions in one place. The menu closes when you click outside it, select an action, or press Escape.' },
        { key: '✎ Edit — Fields tab',     desc: 'The Fields tab shows all available data fields for this widget type. Tick or untick fields to control what appears. Selecting a KPI field instantly auto-fills the value, trend percentage, accent colour, and sparkline.' },
        { key: '✎ Edit — Configure tab',  desc: 'Fine-tune the widget\'s appearance: change the title, accent colour, chart orientation, area fill, smooth curves, grid lines, legend, inner radius, table stripes, compact mode, and more. The right panel shows a live preview.' },
        { key: '🔒 Lock / unlock',         desc: 'Clicking the lock button prevents a widget from being dragged, resized, or deleted until you unlock it. Locked widgets show an amber badge and a not-allowed cursor.' },
        { key: '⊞ Duplicate',             desc: 'Creates a full copy of the widget and places it below all existing widgets. The duplicate is auto-selected and the canvas scrolls to it.' },
        { key: '↑ Bring to front',         desc: 'Raises the widget\'s z-index above all others. Useful when widgets visually overlap. The raised widget shows a purple badge in its header.' },
        { key: '✕ Delete',                 desc: 'Removes the widget permanently. This action is added to the undo history — press Ctrl+Z immediately to restore it.' },
      ],
    },
    {
      title: 'View Controls',
      icon: '⊡',
      color: '#a78bfa',
      intro: 'Tools to navigate and orient yourself on large dashboards.',
      items: [
        { key: 'Zoom in / out',     desc: 'Use the − and + buttons in the zoom cluster in the topbar. The zoom range is 40%–150%. You can also hold Ctrl and scroll the mouse wheel over the canvas to zoom.' },
        { key: 'Reset zoom to 100%', desc: 'Click the percentage badge (e.g. "75%") in the middle of the zoom cluster to snap back to exactly 100%. When you\'re not at 100%, the badge glows blue as a reminder.' },
        { key: 'Minimap',           desc: 'A thumbnail in the bottom-right corner shows all widgets as coloured rectangles and highlights the current viewport. Click anywhere on the minimap to jump the scroll to that position. Toggle it on/off with the sidebar button.' },
        { key: 'Column snap guides', desc: 'While dragging or resizing, faint vertical dashed lines show the 12-column grid boundaries. These disappear when you release the mouse.' },
        { key: 'Dashboard title',   desc: 'The editable title in the topbar helps you identify your layout. It is included in the JSON export filename so your files stay organised.' },
      ],
    },
    {
      title: 'Keyboard Shortcuts',
      icon: '⌨',
      color: '#06b6d4',
      intro: 'All shortcuts work when focus is on the canvas — not when typing inside an input or text field.',
      items: [
        { key: 'Ctrl + Z',           desc: 'Undo the last action. Works for adding, deleting, moving, resizing, and editing widgets.' },
        { key: 'Ctrl + Y',           desc: 'Redo — reapply the last undone action. Also works with Ctrl + Shift + Z.' },
        { key: 'Ctrl + D',           desc: 'Duplicate the currently selected widget. Click a widget once to select it (blue border), then press Ctrl+D.' },
        { key: 'Ctrl + 1 … 9',       desc: 'Open the Add Widget wizard pre-set to a specific type. 1=Stat, 2=Analytics, 3=Bar, 4=Line, 5=Donut, 6=Table, 7=Progress, 8=Note, 9=Section.' },
        { key: 'Delete / Backspace', desc: 'Delete the currently selected widget. The deletion is undoable with Ctrl+Z.' },
        { key: 'L',                  desc: 'Toggle lock on the selected widget. Locked widgets cannot be moved, resized, or deleted.' },
        { key: '↑  ↓  ←  →',        desc: 'Nudge the selected widget one grid cell in that direction. Collision detection prevents moving into occupied cells.' },
        { key: 'Escape',             desc: 'Deselects the current widget, or closes any open modal or context menu.' },
        { key: 'Ctrl + scroll',      desc: 'Zoom the canvas in or out. Hold Ctrl and roll the mouse wheel.' },
      ],
    },
  ];
 
  readonly quickRef = [
    { key: 'Ctrl+Z', desc: 'Undo' },
    { key: 'Ctrl+D', desc: 'Duplicate' },
    { key: 'Del',    desc: 'Delete' },
    { key: 'L',      desc: 'Lock' },
    { key: 'Esc',    desc: 'Close' },
  ];
 
  get activeSection(): HelpSection { return this.sections[this.activeIdx]; }
  get totalSections(): number      { return this.sections.length; }
  get totalTopics(): number        { return this.sections.reduce((a, s) => a + s.items.length, 0); }
 
  get prevLabel(): string { return this.activeIdx > 0 ? this.sections[this.activeIdx - 1].title : 'Previous'; }
  get nextLabel(): string { return this.activeIdx < this.totalSections - 1 ? this.sections[this.activeIdx + 1].title : 'Next'; }
 
  prev(): void { if (this.activeIdx > 0) this.activeIdx--; }
  next(): void { if (this.activeIdx < this.totalSections - 1) this.activeIdx++; }
 
  close(): void { this.dialogRef.close(); }
}
