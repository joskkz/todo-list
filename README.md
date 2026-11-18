# Tasks — To-Do List Application

A to-do list app built with **Next.js (App Router) + TypeScript + Ant Design**. All data is stored locally in the browser using **IndexedDB** (through Dexie.js), so tasks survive page reloads and browser restarts without a server.


## Getting started

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

On first run the list is empty. Click **Load sample tasks** to try the app with demo data. In ```data/```, there are .xlsx files for you to test the import function. 

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Run the unit tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Features

| Requirement | Where |
| --- | --- |
| List, add, edit, delete, mark complete/incomplete | List view; Add/Edit dialog; delete asks for confirmation and offers **Undo** |
| Due date per task | Date picker; "Today" / "Tomorrow" labels; yellow **!** when due within 2 days, red **▲!** when past due |
| Categories (Work, Personal, Urgent) | Radio choice in the form; one colour per category everywhere |
| Pagination | 5 / 10 / 15 / 20 per page, Previous / Next / page numbers, "Page X of Y · N tasks" |
| Search, status filter, sort by due date | Toolbar; search covers title and description; undated tasks always sort last |
| Persistent local storage | IndexedDB (see below) |
| Import CSV / Excel | **Import** → upload `.csv`, `.xlsx` or `.xls` → review each row (errors and duplicates shown) → import. A template can be downloaded. |
| Export to Excel | **Export Excel** → `todos-YYYY-MM-DD.xlsx` with a *Tasks* sheet (real Excel dates, filters) and a *Summary* sheet. When a search or filter is active you can export the current view or everything. |
| Calendar view (extra) | `/calendar`: month grid, tasks coloured by category, side panel for the selected day, "Add task on this day" |
| Drag-and-drop reordering (extra) | Drag the handle (mouse or keyboard: focus it, Space, arrow keys). Enabled in **Manual order** with no search or filter, so the visible order is the stored order. Row menu also has *Move to top / bottom*. |

Search, filters, sort, page and page size are kept in the URL (e.g. `/?q=report&status=active&sort=due_asc`), so the view survives a reload and can be shared.

On phones the table becomes a list of cards and the calendar shows coloured dots per day.

## Why IndexedDB

| Option | Verdict |
| --- | --- |
| `localStorage` | Works, but ~5 MB, synchronous (blocks the UI) and stores one big string |
| `sessionStorage` | Cleared when the tab closes — fails the requirement |
| Cookies | ~4 KB and sent with every request |
| **IndexedDB** | Large quota, asynchronous, transactional, indexed — **chosen** |

Dexie's `useLiveQuery` re-renders the UI whenever the data changes, including changes made in another tab. A bulk import is a single transaction (all rows saved or none). On first load the app calls `navigator.storage.persist()` to ask the browser not to evict the data. Exporting to Excel doubles as a backup.

## Import format

The first sheet is read; the header row is matched loosely (e.g. *Title* or *Task*, *Due Date* or *Due*).

| Column | Required | Accepted values |
| --- | --- | --- |
| Title | Yes | Up to 200 characters |
| Description | No | Up to 2000 characters |
| Category | Yes | Work, Personal, Urgent (any case) |
| Due Date | No | Excel date cells, `YYYY-MM-DD`, `DD/MM/YYYY`, `3 Dec 2026` |
| Completed | No | Yes/No, Done/Open, True/False, 1/0 |

Day-first is assumed for numeric dates (`03/12/2026` is 3 December). Rows matching an existing task (same title and due date) are flagged as duplicates and skipped by default.

## Project structure

```
src/
├── app/                      # Next.js routes (required by the App Router)
│   ├── layout.tsx            # antd registry, providers, <App>
│   ├── page.tsx              # List view → <TodoList />
│   └── calendar/page.tsx     # Calendar view → <Calendar />
├── components/
│   ├── TodoList.tsx          # list page: summary, filters, table, pagination, empty states
│   ├── TodoItem.tsx          # one task: row pieces (drag handle, checkbox, actions) and phone card
│   ├── Calendar.tsx          # month calendar with tasks per day
│   ├── AddTodo.tsx           # "New task" dialog
│   ├── EditTodo.tsx          # "Edit task" dialog
│   ├── TodoForm.tsx          # form fields shared by AddTodo and EditTodo
│   ├── Filters.tsx           # search, status, category, sort
│   ├── TodoActions.tsx       # shared data + add/edit/import dialogs (context)
│   ├── ImportModal.tsx       # upload → review → done
│   ├── Providers.tsx         # antd config + TodoActions provider
│   └── TaskBits.tsx          # category tag, due-date icons, completed icon
├── App.tsx                   # app shell: header, view switch, import, export, add
├── hooks/
│   ├── useTodos.ts           # live task list from IndexedDB
│   └── useTodoQuery.ts       # view state synced with the URL
└── lib/
    ├── todo.ts               # types, categories, Zod validation
    ├── db.ts                 # Dexie database + schema version
    ├── todoRepository.ts     # the only module that touches storage
    ├── query.ts              # filter → sort → paginate (pure functions)
    ├── ordering.ts           # fractional order keys for drag-and-drop
    ├── dates.ts              # due-soon / overdue rules, labels
    ├── importTodos.ts        # CSV/Excel parsing and row validation
    ├── exportTodos.ts        # Excel report + import template
    └── __tests__/            # unit tests
```

UI components never call IndexedDB directly; they go through `todoRepository.ts`. Moving to a server API later means replacing that one module.

## Notes

- **Drag-and-drop library:** the brief suggests `react-beautiful-dnd`, which is deprecated and does not support React 18 StrictMode or React 19. This app uses **dnd-kit** instead (maintained, accessible, keyboard support).
- **SheetJS** is installed from the official SheetJS CDN (`cdn.sheetjs.com`), because the `xlsx` package on the public npm registry is outdated and has known vulnerabilities.
- **Drag ordering** uses fractional keys: a move writes only the moved task; keys are renumbered only if they get too close together.
- Dates are stored as `YYYY-MM-DD` (no time), so a due date never shifts between time zones.
