# jquery-table-search

A lightweight jQuery plugin set that adds **Excel-style per-column filtering, sorting and pagination** to any HTML table styled with Bootstrap 5. Filter by text, number, date or currency, combine filters across columns, sort by clicking the header, and page through the results.

Everything works in two data modes, chosen with a single setting:

- **Client-side**: all rows are in the page and the browser filters, sorts and pages them.
- **Server-side**: the server returns one filtered, sorted page per request, so tables with very large datasets stay fast.

> Works with plain, server-rendered tables (for example ASP.NET Web Forms `GridView` or Razor output) and with JSON endpoints. No build step and no dependencies other than jQuery.

The package contains two plugins that work together or on their own:

| Plugin | Purpose | Version |
| --- | --- | --- |
| `jquery.tableSearch.js` | Per-column filtering and sorting, plus server-side data loading | 2.1 |
| `jquery.tablePager.js` | Pagination for client-side and server-side data | 2.0 |

## Features

- **Per-column filters** with a popup next to each header. Filters from several columns combine with AND (or OR, see `columnLogic`).
- **Two conditions per column**: optional second condition joined by an AND / OR choice (`showLogicOperator`).
- **Typed operators**
  - Text: contains, does not contain, equals, does not equal, starts, ends, empty, not empty
  - Number and currency: equals, does not equal, greater/less than (or equal), empty, not empty
  - Date: equals, does not equal, after, before, empty, not empty
- **Date filter** is a text field for typing dates in your own format, with a separate button to open the browser's native calendar.
- **Sorting** by clicking the header or the sort icon: ascending, descending, then back to the original order. Text sorts naturally (`item2` before `item10`), and empty cells always go last.
- **Default order**: sort by any column on load with `defaultSortColumn`.
- **Currency columns** show a configurable symbol in the cells and in the filter field (`$`, `Rs`, `PKR`, `€` ...).
- **Client or server data** by configuration (`processing: 'client' | 'server'`), for both filtering/sorting and pagination.
- **Pagination** with page-size dropdown, Prev / Next, First / Last, numbered page buttons and an info line. The controls and the info text can be bound to your own elements.
- **Server mode extras**: request merging and de-duplication, automatic cancellation of superseded requests, loading overlay, error row with Retry, and automatic jump to the last page when the data shrinks.
- **Configurable parsing**: your own date format (`DD/MM/YYYY`, `YYYY-MM-DD` ...) and your own numeric clean-up regex.
- **Responsive**: popups stay on screen and become a bottom sheet on small screens; the table scrolls horizontally in its own wrapper.
- **Fast on large tables**: values are parsed once and cached, typing is debounced, and sorting reorders the DOM in one write.
- **Accessible**: keyboard-operable icons, `Esc` closes the popup, `aria-sort`, `aria-current` and `aria-busy` are set.
- **Safe lifecycle**: `refresh`, `clearFilters`, `clearSort`, `getState` and `destroy`, plus events and callbacks.

## Demo

Open the [live demo](https://muhammad-asif5.github.io/jquery-table-search/) in a browser, or enable **GitHub Pages** for this repository (Settings, then Pages, then deploy from the `main` branch) and visit `https://<your-username>.github.io/jquery-table-search/demo/`.

The demo page has a **Client-side data / Server-side data** switch (`?mode=client` or `?mode=server`). Server mode talks to an in-browser mock endpoint (`demo-server.js`, URL `mock://employees`), so no backend is needed to try it. The mock also serves as a reference implementation of the [request and response format](#server-side-mode).

## Requirements

| Dependency | Version |
| --- | --- |
| jQuery | 3.x (tested with 3.7.1) |
| Bootstrap | 5.x (tested with 5.3.2), used for the popup's form controls and the pager markup |

A modern browser is needed (`Map`, `Intl.Collator` and `Intl.NumberFormat`). Internet Explorer is not supported. The calendar in date filters uses `showPicker()`, which is available in recent Chrome, Edge, Firefox and Safari. In browsers without it the user simply types the date.

## Installation

Download this repository, or copy the files from `src/`:

```
src/jquery.tableSearch.js
src/jquery.tablePager.js          (only if you want pagination)
src/jquery.tableSearch.bundle.css
src/jquery.tableSearch.responsive.css
src/jquery.tablePager.bundle.css
```

The pager injects the one CSS rule it needs (`.jts-page-hidden`) by itself, so it works even without a pager stylesheet.

Or load them from jsDelivr once you have created a release tag (replace `<your-username>` and the version):

```html
<script src="https://cdn.jsdelivr.net/gh/<your-username>/jquery-table-search@v2.1.0/src/jquery.tableSearch.js"></script>
<script src="https://cdn.jsdelivr.net/gh/<your-username>/jquery-table-search@v2.1.0/src/jquery.tablePager.js"></script>
```

## Quick start (client-side data)

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="src/jquery.tableSearch.bundle.css" rel="stylesheet">
<link href="src/jquery.tableSearch.responsive.css" rel="stylesheet">

<table class="table table-bordered table-hover" id="myTable">
    <thead>
        <tr>
            <th data-type="string">Name</th>
            <th data-type="numeric">Extn.</th>
            <th data-type="date">Start date</th>
            <th data-currency>Salary</th>
        </tr>
    </thead>
    <tbody>
        <tr><td>Airi Satou</td><td>5407</td><td>2008/11/28</td><td>162700</td></tr>
        <tr><td>Angelica Ramos</td><td>5797</td><td>2009/10/09</td><td>1200000</td></tr>
    </tbody>
</table>

<span id="pageInfo"></span>
<span id="pagger"></span>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script src="src/jquery.tableSearch.js"></script>
<script src="src/jquery.tablePager.js"></script>
<script>
    $('#myTable').tableSearch({
        processing: 'client',        // 'client' (default) | 'server'
        showSortIcon: true,
        showFilterIcon: true,
        debounceTime: 300,
        dateFormat: 'YYYY/MM/DD',
        numericRegex: /[^0-9.-]+/g,
        currencySymbol: 'Rs',        // '$', 'Rs', 'PKR', '€' ...
        currencyPosition: 'prefix',  // or 'suffix'
        currencyFormatCells: true
    });

    $('#myTable').tablePager({
        processing: 'client',
        pageSize: 10,
        pager: '#pagger',            // optional: put the controls here
        info: '#pageInfo'            // optional: put "Showing 1-10 of 57" here
    });
</script>
```

The plugin works on the **last row of `<thead>`** and the **first `<tbody>`**. Initialise `tableSearch` first, then `tablePager`.

## Quick start (server-side data)

Switch both plugins to `server` and point `tableSearch` at your endpoint. The pager then drives `tableSearch`, so page, page size, sort and filters travel to the server in **one request**.

```html
<table class="table table-bordered table-hover" id="myTable">
    <thead>
        <tr>
            <th data-type="string"  data-field="name">Name</th>
            <th data-type="numeric" data-field="extn">Extn.</th>
            <th data-type="date"    data-field="start_date">Start date</th>
            <th data-currency       data-field="salary">Salary</th>
        </tr>
    </thead>
    <tbody></tbody>
</table>

<script>
    $('#myTable').tableSearch({
        processing: 'server',
        pageSize: 10,
        dateFormat: 'YYYY/MM/DD',
        currencySymbol: 'Rs',
        ajax: { url: '/api/employees', method: 'POST' },
        responseMap: { rows: 'data', total: 'total' }
    });

    $('#myTable').tablePager({
        processing: 'server',
        pageSize: 10
    });
</script>
```

## Column attributes

Set these on the `<th>` elements.

| Attribute | Values | Description |
| --- | --- | --- |
| `data-type` | `string` (default), `numeric`, `date` | Controls the filter operators, parsing and sort order. |
| `data-currency` | none, or a symbol such as `"Rs"` | Marks a currency column. It is numeric, shows the symbol in cells and in the filter field. With no value it uses `currencySymbol`. |
| `data-sortable` | `true` / `false` | Overrides `showSortIcon` for this column. |
| `data-filterable` | `true` / `false` | Overrides `showFilterIcon` for this column. |
| `data-logic` | `true` / `false` | Overrides `showLogicOperator` for this column (second condition and AND / OR choice). |
| `data-field` | property name, dot paths allowed (`user.name`) | Server mode: which property of each JSON row is shown in this column, and the `field` name sent to the server for sorting and filtering. |

You can also set `data-sort-value` on a `<td>` to give the plugin a clean value to filter and sort by, regardless of what the cell displays (client mode).

## tableSearch options

```js
$('#myTable').tableSearch({ /* options */ });
```

### General

| Option | Default | Description |
| --- | --- | --- |
| `processing` | `'client'` | `'client'` filters and sorts the rows in the DOM. `'server'` loads rows from the server. See [Server-side mode](#server-side-mode). |
| `showSortIcon` | `true` | Show the sort icon in the header and the sort items in the popup. |
| `showFilterIcon` | `true` | Show the filter (bars) icon and enable the popup. |
| `sortOnHeaderClick` | `true` | Clicking anywhere on a sortable header sorts. When `false`, only the icon sorts. |
| `defaultSortColumn` | `null` | Column to sort by on load: an index or the header text (case-insensitive). |
| `defaultSortDirection` | `'asc'` | `'asc'` or `'desc'`. |
| `debounceTime` | `150` | Milliseconds to wait after typing before filtering. `0` filters on every keystroke. The old name `debounce` still works. |
| `showLogicOperator` | `false` | A second condition and AND / OR radios appear in the popup once the first field has a value. |
| `defaultLogic` | `'and'` | Initially selected radio: `'and'` or `'or'`. |
| `columnLogic` | `'and'` | How filters of different columns combine: `'and'` or `'or'`. |
| `showNoData` | `true` | Client mode: show the "No records found" row when every row is filtered out. |
| `onFilter` | `null` | `function (info)` called after filtering, with `{ visible, total }`. |
| `onSort` | `null` | `function (info)` called after sorting, with `{ column, direction }`. |
| `labels` | English strings | Override any button, operator, sort or status label (`loading`, `noData`, `error`, `retry`, ...), for localisation. |

### Parsing and formatting

| Option | Default | Description |
| --- | --- | --- |
| `dateFormat` | `'auto'` | How date cells are parsed. Tokens: `YYYY`, `YY`, `MM`, `M`, `DD`, `D`. The separators `/`, `-` and `.` are interchangeable. `'auto'` guesses. |
| `dateOrder` | `'dmy'` | Only for `dateFormat: 'auto'` with non-ISO dates such as `28/11/2008`: `'dmy'` or `'mdy'`. |
| `numericRegex` | `/[^0-9.-]+/g` | Characters removed from numeric cells and inputs before parsing (currency signs, spaces and so on). |
| `decimalSeparator` | `'.'` | `'.'` or `','`. Applied before `numericRegex`. |
| `currencySymbol` | `'$'` | Symbol for `data-currency` columns. |
| `currencyPosition` | `'prefix'` | `'prefix'` (`$1,200`) or `'suffix'` (`1,200 PKR`). |
| `currencyFormatCells` | `true` | Rewrite currency cells as symbol plus grouped number. The original text is restored on `destroy`. |
| `currencyLocale` | `null` | Number-format locale. `null` means `en-US`, or `de-DE` when `decimalSeparator` is `','`. |
| `emptyLast` | `true` | Empty cells always sort to the bottom. |
| `locale` | `undefined` | Locale for text sorting (`Intl.Collator`). |
| `collator` | `{ numeric: true, sensitivity: 'base' }` | Options for `Intl.Collator`. |

### Responsive

| Option | Default | Description |
| --- | --- | --- |
| `responsive` | `true` | Viewport-aware popups: fixed position, clamped to the screen. |
| `responsiveWrap` | `true` | Wrap the table in a horizontally scrollable `.jts-scroll` div (skipped inside `.table-responsive` / `.jts-scroll`). Also hosts the server-mode loading overlay. |
| `mobileSheet` | `false` | Popups become a bottom sheet on small screens. |
| `mobileBreakpoint` | `575` | Viewport width in px at or below which the bottom sheet is used. |

### Server mode

| Option | Default | Description |
| --- | --- | --- |
| `pageSize` | `10` | Rows per page (sent as `pageSize`). |
| `initialLoad` | `true` | Fetch the first page on init. `false` keeps the rows already in the table. |
| `requestDebounce` | `100` | Milliseconds used to merge rapid filter and sort changes into one request. |
| `resetPageOnFilter` | `true` | Go back to page 1 when the filters change. |
| `resetPageOnSort` | `true` | Go back to page 1 when the sort changes. |
| `ajax` | see below | Request settings. |
| `responseMap` | `{ rows: 'data', total: 'total' }` | Where the rows and the total are in the JSON: dot paths, or `function (json) -> { rows, total }`. A bare array response is also accepted. |
| `renderRow` | `null` | `function (row, index)` returning a `<tr>` element, jQuery object or HTML string. Default: built from the `data-field` of each `<th>`. |
| `onLoad` | `null` | `function (info)` after each successful load. |
| `onError` | `null` | `function (info)` after a failed load. |

`ajax` settings:

| Setting | Default | Description |
| --- | --- | --- |
| `url` | `null` | String, or `function (request) -> string`. Required in server mode. |
| `method` | `'POST'` | `'GET'`, `'POST'`, ... |
| `contentType` | `'json'` | `'json'` (JSON body) or `'form'` (urlencoded). `GET` always uses the query string. |
| `dataType` | `'json'` | Response type. |
| `headers` | `null` | For example `{ 'X-CSRF-Token': '...' }`. |
| `timeout` | `0` | Milliseconds, `0` means none. |
| `cache` | `false` | Allow cached GET responses. |
| `data` | `null` | Object merged into the request, or `function (request, plugin) -> object` that replaces it. |
| `settings` | `null` | Extra `$.ajax` settings (`xhrFields`, `beforeSend`, ...). |
| `paramNames` | `{ page, pageSize, sort, filters, columnLogic }` | Rename the request properties. |

Defaults can also be changed globally through `$.fn.tableSearch.defaults`.

### Dates

Cells are read with `dateFormat`. A cell that does not match it is treated as empty, so it is left out of Equals, After and Before. If that happens, the browser console shows a warning that names the column and an example cell.

The filter field takes a date in the same format (or ISO style). Focus the field to type without opening the calendar; use the calendar button to pick a day, which is written back in your `dateFormat`.

### Currency

```html
<th data-currency>Salary</th>        <!-- uses currencySymbol -->
<th data-currency="€">Bonus</th>     <!-- this column's own symbol -->
```

Sorting and filtering use the underlying number, never the displayed text. In server mode the server sends plain numbers and the plugin formats them.

## Server-side mode

With `processing: 'server'` the plugin sends one request whenever the filters, the sort, the page or the page size change, and renders the rows from the response. Typing is debounced, rapid changes are merged into one request, identical requests are skipped, and a request that is superseded by a newer one is cancelled.

### Request

The default is a JSON `POST` body:

```json
{
  "page": 2,
  "pageSize": 10,
  "sort": { "column": 0, "field": "name", "direction": "asc" },
  "columnLogic": "and",
  "filters": [
    {
      "column": 2,
      "field": "office",
      "type": "string",
      "logic": "and",
      "conditions": [ { "operator": "contains", "value": "Tok" } ]
    }
  ]
}
```

- `page` is 1-based. `sort` is `null` when no sort is active.
- `columnLogic` says how filters of different columns combine; `logic` says how the one or two `conditions` of a column combine.
- `type` is `string`, `numeric` or `date`. Numeric values are numbers. **Date values are ISO `YYYY-MM-DD`** whatever the display `dateFormat` is.
- `operator` is one of: `contains`, `not_contains`, `eq`, `neq`, `starts`, `ends`, `gt`, `gte`, `lt`, `lte`, `empty`, `not_empty` (`value` is `null` for the last two).
- `field` comes from `data-field` on the `<th>`.

### Response

```json
{
  "data": [ { "name": "Airi Satou", "office": "Tokyo", "extn": 5407, "start_date": "2008/11/28", "salary": 162700 } ],
  "total": 57
}
```

`total` is the number of rows that match the filters across **all** pages, not the number of rows in this response. If `total` is missing it is estimated from the current page.

If a page no longer exists (for example the data shrank), the plugin jumps to the last page automatically.

### Server-side example

```js
$('#myTable').tableSearch({
    processing: 'server',
    pageSize: 25,
    ajax: {
        url: '/api/employees',
        method: 'POST',
        headers: { 'X-CSRF-Token': token },
        timeout: 15000
    },
    responseMap: function (json) { return { rows: json.items, total: json.count }; },
    renderRow: function (row) {
        return '<tr><td>' + row.name + '</td><td>' + row.extn + '</td><td>' + row.start + '</td><td>' + row.salary + '</td></tr>';
    }
});
```

`renderRow` receives data from your server: encode it yourself if you build HTML strings, or leave `renderRow` out so the plugin writes cell text safely from `data-field`.

## Pagination (tablePager)

```js
$('#myTable').tablePager({ /* options */ });
```

### Data modes

| `processing` | Behaviour |
| --- | --- |
| `'client'` | All rows are in the DOM; the pager shows one slice at a time. Works with `tableSearch` (filtered and sorted rows are paged) or standalone. |
| `'server'` with `tableSearch` in server mode | The pager drives `tableSearch` (`page`, `pageSize`, `reload`) and renders its state. One request carries page, page size, sort and filters. |
| `'server'` without `tableSearch` | The pager makes its own AJAX call (`ajax`, `responseMap`, `renderRow`) and sends `{ page, pageSize }`. Rows are mapped through `<th data-field>`. |
| `'auto'` (default) | `'server'` when `tableSearch` on the same table is in server mode, otherwise `'client'`. Initialise `tableSearch` first, or set `processing` explicitly. |

Standalone server example:

```js
$('#myTable').tablePager({
    processing: 'server',
    pageSize: 10,
    ajax: { url: '/api/employees', method: 'GET' },
    responseMap: { rows: 'data', total: 'total' }
});
```

### Binding the controls to your own elements

By default the pager builds its markup in a `<div>` right after the table. To place it yourself, add two elements and pass their selectors:

```html
<span id="pageInfo"></span>
<span id="pagger"></span>
```

```js
$('#myTable').tablePager({
    pager: '#pagger',    // Prev / numbers / Next / page-size dropdown are built here
    info: '#pageInfo'    // "Showing 1-10 of 57" is written here
});
```

If `info` is omitted, the info text is built inside the `pager` container.

### Pager options

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | Master switch. |
| `processing` | `'auto'` | `'auto'`, `'client'` or `'server'`. |
| `pageSize` | `null` | Rows per page. `null` means `10`, or the `tableSearch` page size when paired in server mode. |
| `pageSizes` | `[5, 10, 25, 50]` | Dropdown choices. The current page size is added if missing. |
| `pager` | `null` | Selector, element or jQuery object for the controls. `null` builds the pager after the table. |
| `info` | `null` | Selector, element or jQuery object that receives the info text. |
| `autoBuildPager` | `true` | Build the pager automatically when `pager` is `null`. |
| `showPageSizeSelect` | `true` | Rows-per-page dropdown. |
| `showInfo` | `true` | The "Showing x-y of z" text. |
| `showPageLabel` | `true` | The "Page x / y" label. |
| `showFirstLast` | `false` | First and Last buttons. |
| `showPageNumbers` | `false` | Numbered buttons (`1 2 3 ... 20`). |
| `maxPageButtons` | `7` | Most numbered buttons shown, including first, last and ellipses (minimum 5). |
| `resetPageOnFilter` | `true` | Back to page 1 when the filter changes. Applied to `tableSearch` in server mode too. |
| `resetPageOnSort` | `false` | Keep the current page when the sort changes. Applied to `tableSearch` in server mode too. |
| `rowSelector` | `null` | Client mode: function or selector to find the pageable `<tr>`. |
| `initialLoad` | `true` | Standalone server mode: fetch the first page on init. |
| `ajax` | see `tableSearch` | Standalone server mode only: `url`, `method`, `contentType`, `dataType`, `headers`, `timeout`, `cache`, `data`, `settings`, and `paramNames: { page, pageSize }`. |
| `responseMap` | `{ rows: 'data', total: 'total' }` | Standalone server mode. |
| `renderRow` | `null` | Standalone server mode. |
| `labels` | English strings | `info(from, to, total)`, `page(page, pages)`, `prev`, `next`, `first`, `last`, `loading`, `noData`, `error`, `retry`. |
| `onChange` | `null` | `function (info)` after every repaint. |
| `onLoad`, `onError` | `null` | Standalone server mode callbacks. |

### Pager methods

```js
$('#myTable').tablePager('page', 3);         // go to page 3
$('#myTable').tablePager('page');            // -> current page
$('#myTable').tablePager('pageSize', 25);    // change page size (back to page 1)
$('#myTable').tablePager('pageSize');        // -> current page size
$('#myTable').tablePager('pages');           // -> total page count
$('#myTable').tablePager('total');           // -> total rows (all matching rows, not just this page)
$('#myTable').tablePager('refresh');         // client: re-collect rows; server: fetch the current page again
$('#myTable').tablePager('reload');          // alias of refresh
$('#myTable').tablePager('show');            // enable paging
$('#myTable').tablePager('hide');            // client: show all rows and hide the controls; server: hides the controls only
$('#myTable').tablePager('getState');        // { enabled, processing, page, pageSize, pages, total, from, to, loading }
$('#myTable').tablePager('destroy');         // remove handlers and the built markup
```

In server mode the server keeps paging even after `hide`, because only the controls are hidden.

### Pager events

```js
$('#myTable').on('tablepager:change', function (e, info) {
    // info: { page, pageSize, pages, total, from, to, enabled, processing, loading }
});
$('#myTable').on('tablepager:request', function (e, request) { /* standalone server mode */ });
$('#myTable').on('tablepager:error',   function (e, info)    { /* standalone server mode: { status, error, xhr } */ });
```

In client mode, rows hidden by the pager get the class `jts-page-hidden`.

## tableSearch methods

```js
$('#myTable').tableSearch('refresh');        // client: after rows are added, removed or edited. Server: reloads the current page
$('#myTable').tableSearch('clearFilters');
$('#myTable').tableSearch('clearSort');
$('#myTable').tableSearch('applyFilters');
$('#myTable').tableSearch('destroy');        // restores headers, row order and original cell text

const state = $('#myTable').tableSearch('getState');
// { filters: [{ column, operator, value }], sort: { column, direction }, visibleRows, totalRows, processing }
// server mode adds: page, pageSize, pages, loading
```

Server mode only:

```js
$('#myTable').tableSearch('page', 2);        // go to page 2
$('#myTable').tableSearch('page');           // -> current page
$('#myTable').tableSearch('pageSize', 50);   // change page size
$('#myTable').tableSearch('reload');         // fetch the current page again
$('#myTable').tableSearch('abort');          // cancel a pending or running request
```

## tableSearch events

```js
$('#myTable').on('tablesearch:filter', function (e, info) { /* info.visible, info.total */ });
$('#myTable').on('tablesearch:sort',   function (e, info) { /* info.column, info.direction */ });
```

In server mode, `tablesearch:filter` fires after each load with `visible` (rows on this page) and `total` (rows matching the filters). These extra events are available:

```js
$('#myTable').on('tablesearch:request', function (e, request) { /* the request about to be sent */ });
$('#myTable').on('tablesearch:load',    function (e, info)    { /* { rows, total, page, pageSize, pages, response } */ });
$('#myTable').on('tablesearch:error',   function (e, info)    { /* { status, error, xhr } */ });
$('#myTable').on('tablesearch:abort',   function ()           { /* a request was cancelled with 'abort' */ });
```

## Styling

`jquery.tableSearch.bundle.css` and `jquery.tableSearch.responsive.css` style the header icons, the popup and the loading overlay. The main classes are `jts-header-content`, `jts-icon-btn`, `jts-popup` (with `active` when open), `sort-active` / `sort-desc` on the sort icon, `jts-filter-active` on the filter icon when a column has an active filter, `jts-msg-row` for the "No records" and error rows, and `jts-loading` while a server request runs.

The pager uses Bootstrap 5 classes (`btn`, `btn-group`, `form-select`) and the hooks `jts-pager`, `jts-pager-info`, `jts-pager-controls`, `jts-pager-size`, `jts-pager-prev`, `jts-pager-next`, `jts-pager-first`, `jts-pager-last` and `jts-pager-num`. Override them in your own stylesheet to match your theme.

## Known limitations

- One `<tbody>` and one header row are supported. Headers with `colspan` are not.
- In client mode, filtering, sorting and paging happen in the browser on the rows already in the page. For very large datasets use server mode.
- In server mode the server must do the filtering, sorting and paging; the plugin only sends the request and renders the response. The mock in `demo-server.js` shows the expected behaviour.
- `tableSearch` and `tablePager` must use the same data mode. A client-mode `tableSearch` with a server-mode `tablePager` is not supported.
- Server mode requests are sent as JSON by default. If your endpoint expects a form post, set `ajax.contentType: 'form'`; nested `filters` then follow jQuery's `$.param` encoding.

## Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE) © 2026 Muhammad Asif

## Author

**Muhammad Asif**, Full Stack .NET Developer. [LinkedIn](https://www.linkedin.com/in/asifgondal/)