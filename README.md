# jquery-table-search

A lightweight jQuery plugin that adds **Excel-style per-column filtering and sorting** to any HTML table styled with Bootstrap 5. Filter by text, number, date or currency, combine filters across columns, and sort by clicking the header.

> Works with plain, server-rendered tables (for example ASP.NET Web Forms `GridView` or Razor output). No build step and no dependencies other than jQuery.

## Features

- **Per-column filters** with a popup next to each header. Filters from several columns combine with AND.
- **Typed operators**
  - Text: contains, does not contain, equals, does not equal, starts, ends, empty, not empty
  - Number and currency: equals, does not equal, greater/less than (or equal), empty, not empty
  - Date: equals, does not equal, after, before, empty, not empty
- **Date filter** is a text field that opens the browser's native calendar on focus. You can also type the date in your own format.
- **Sorting** by clicking the header or the sort icon: ascending, descending, then back to the original order. Text sorts naturally (`item2` before `item10`), and empty cells always go last.
- **Currency columns** show a configurable symbol in the cells and in the filter field (`$`, `Rs`, `PKR`, `€` ...).
- **Configurable parsing**: your own date format (`DD/MM/YYYY`, `YYYY-MM-DD` ...) and your own numeric clean-up regex.
- **Fast on large tables**: values are parsed once and cached, typing is debounced, and sorting reorders the DOM in one write.
- **Accessible**: keyboard-operable icons, `Esc` closes the popup, `aria-sort` and `aria-current` are set.
- **Safe lifecycle**: `refresh`, `clearFilters`, `clearSort`, `getState` and `destroy`, plus events and callbacks.

## Demo

Open [`demo`](https://muhammad-asif5.github.io/jquery-table-search/) in a browser, or enable **GitHub Pages** for this repository (Settings, then Pages, then deploy from the `main` branch) and visit `https://<your-username>.github.io/jquery-table-search/demo/`.

## Requirements

| Dependency | Version |
| --- | --- |
| jQuery | 3.x (tested with 3.7.1) |
| Bootstrap | 5.x (tested with 5.3.2), used for the popup's form controls |

A modern browser is needed (`Map`, `Intl.Collator` and `Intl.NumberFormat`). Internet Explorer is not supported. The calendar in date filters uses `showPicker()`, which is available in recent Chrome, Edge, Firefox and Safari. In browsers without it the user simply types the date.

## Installation

Download this repository, or copy the two files from `src/`:

```
src/jquery.tableSearch.js
src/jquery.tableSearch.css
```

Or load them from jsDelivr once you have created a release tag (replace `<your-username>` and the version):

```html
<link href="https://cdn.jsdelivr.net/gh/<your-username>/jquery-table-search@v2.0.0/src/jquery.tableSearch.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/gh/<your-username>/jquery-table-search@v2.0.0/src/jquery.tableSearch.js"></script>
```

## Quick start

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="src/jquery.tableSearch.css" rel="stylesheet">

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
        <tr><td>Airi Satou</td><td>5407</td><td>2008/11/28</td><td>$162,700</td></tr>
        <tr><td>Angelica Ramos</td><td>5797</td><td>2009/10/09</td><td>$1,200,000</td></tr>
    </tbody>
</table>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script src="src/jquery.tableSearch.js"></script>
<script>
    $('#myTable').tableSearch({
        showSortIcon: true,
        showFilterIcon: true,
        debounceTime: 300,
        dateFormat: 'YYYY/MM/DD',
        numericRegex: /[^0-9.-]+/g,
        currencySymbol: 'Rs',        // '$', 'Rs', 'PKR', '€' ...
        currencyPosition: 'prefix',  // or 'suffix'
        currencyFormatCells: true
    });
</script>
```

The plugin works on the **last row of `<thead>`** and the **first `<tbody>`**.

## Column attributes

Set these on the `<th>` elements.

| Attribute | Values | Description |
| --- | --- | --- |
| `data-type` | `string` (default), `numeric`, `date` | Controls the filter operators, parsing and sort order. |
| `data-currency` | none, or a symbol such as `"Rs"` | Marks a currency column. It is numeric, shows the symbol in cells and in the filter field. With no value it uses `currencySymbol`. |
| `data-sortable` | `true` / `false` | Overrides `showSortIcon` for this column. |
| `data-filterable` | `true` / `false` | Overrides `showFilterIcon` for this column. |

You can also set `data-sort-value` on a `<td>` to give the plugin a clean value to filter and sort by, regardless of what the cell displays.

## Options

```js
$('#myTable').tableSearch({ /* options */ });
```

| Option | Default | Description |
| --- | --- | --- |
| `showSortIcon` | `true` | Show the sort icon in the header and the sort items in the popup. |
| `showFilterIcon` | `true` | Show the filter (bars) icon and enable the popup. |
| `sortOnHeaderClick` | `true` | Clicking anywhere on a sortable header sorts. When `false`, only the icon sorts. |
| `debounceTime` | `150` | Milliseconds to wait after typing before filtering. `0` filters on every keystroke. The old name `debounce` still works. |
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
| `onFilter` | `null` | `function (info)` called after filtering, with `{ visible, total }`. |
| `onSort` | `null` | `function (info)` called after sorting, with `{ column, direction }`. |
| `labels` | English strings | Override any button, operator or sort label, for localisation. |

Defaults can also be changed globally through `$.fn.tableSearch.defaults`.

### Dates

Cells are read with `dateFormat`. A cell that does not match it is treated as empty, so it is left out of Equals, After and Before. If that happens, the browser console shows a warning that names the column and an example cell.

The filter field takes a date in the same format (or ISO style), or a day picked from the calendar, which is written back in your `dateFormat`.

### Currency

```html
<th data-currency>Salary</th>        <!-- uses currencySymbol -->
<th data-currency="€">Bonus</th>     <!-- this column's own symbol -->
```

Sorting and filtering use the underlying number, never the displayed text.

## Methods

```js
$('#myTable').tableSearch('refresh');        // after rows are added, removed or edited
$('#myTable').tableSearch('clearFilters');
$('#myTable').tableSearch('clearSort');
$('#myTable').tableSearch('applyFilters');
const state = $('#myTable').tableSearch('getState');
// { filters: [{ column, operator, value }], sort: { column, direction }, visibleRows, totalRows }
$('#myTable').tableSearch('destroy');        // restores headers, row order and original cell text
```

## Events

```js
$('#myTable').on('tablesearch:filter', function (e, info) { /* info.visible, info.total */ });
$('#myTable').on('tablesearch:sort',   function (e, info) { /* info.column, info.direction */ });
```

## Styling

`src/jquery.tableSearch.css` styles the header icons and the popup. The main classes are `jts-header-content`, `jts-icon-btn`, `jts-popup` (with `active` when open), `sort-active` / `sort-desc` on the sort icon, and `jts-filter-active` on the filter icon when a column has an active filter. Override them in your own stylesheet to match your theme.

## Known limitations

- One `<tbody>` and one header row are supported. Headers with `colspan` are not.
- Filtering and sorting happen in the browser on the rows already in the page, so for very large datasets use server-side paging.

## Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE) © 2026 Muhammad Asif

## Author

**Muhammad Asif**, Full Stack .NET Developer. [LinkedIn](https://www.linkedin.com/in/asifgondal/)
