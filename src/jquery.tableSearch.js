/*!
 * jQuery tableSearch 2.1
 * Per-column filtering and single-column sorting for HTML tables.
 * Each column popup can hold two conditions joined by an AND / OR radio choice (option showLogicOperator, off by default;
 * when on, the radios and 2nd condition stay hidden until the 1st field is filled in);
 * filters of different columns are combined with AND or OR (option columnLogic).
 *
 * Usage:
 *   $('#myTable').tableSearch({ dateOrder: 'dmy', debounce: 150 });
 *   $('#myTable').tableSearch('refresh');        // after rows are added/removed/edited
 *   $('#myTable').tableSearch('clearFilters');
 *   $('#myTable').tableSearch('clearSort');
 *   $('#myTable').tableSearch('getState');
 *   $('#myTable').tableSearch('destroy');
 *
 * Column types via <th data-type="string|numeric|date"> (default: string).
 * Per-column override by configuration: columns / disableSort / disableFilter (index, header text or data-field).
 * Per-column override of the icon options: <th data-sortable="false"> / <th data-filterable="false">
 * (also works as "true" to enable on a column when the global option is off).
 * Currency columns: <th data-currency> (uses the global currencySymbol) or <th data-currency="Rs"> (own symbol).
 * The column becomes numeric, its cells are shown as symbol + grouped number, and the filter field shows the symbol.
 * Per-column override of the logic radios: <th data-logic="false"> / <th data-logic="true"> turns the radios (and 2nd condition) off / on for that column.
 * Optional per-cell override for sorting/filtering: <td data-sort-value="...">.
 *
 * Events on the table: "tablesearch:filter" ({visible,total}), "tablesearch:sort" ({column,direction}).
 *
 * Server mode (option processing: 'server'; default is 'client'):
 *   $('#t').tableSearch({ processing: 'server', pageSize: 25,
 *       ajax: { url: '/api/people', method: 'POST' },          // sends page, pageSize, sort, filters, columnLogic
 *       responseMap: { rows: 'data', total: 'total' } });      // or a function (json) -> { rows, total }
 *   Map columns to row fields with <th data-field="name"> (dot paths allowed) or give a renderRow(row, i) -> <tr>.
 *   Extra methods: .tableSearch('page', 2), .tableSearch('page'), .tableSearch('pageSize', 50), .tableSearch('reload'), .tableSearch('abort').
 *   Extra events: "tablesearch:request" (request), "tablesearch:load" ({rows,total,page,pageSize,pages,response}),
 *   "tablesearch:error" ({status,error,xhr}), "tablesearch:abort". "tablesearch:filter" fires after each load with {visible: rows on page, total: matching rows}.
 */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('jquery'));
    } else {
        factory(window.jQuery);
    }
})(function ($) {
    'use strict';

    var DATA_KEY = 'tableSearch';
    var uid = 0;

    var ICONS = {
        sortHeader: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 4-4 4 4"></path><path d="m11 16-4 4-4-4"></path><path d="M7 4v16"></path><path d="M15 8h6"></path><path d="M15 16h6"></path><path d="M13 12h8"></path></svg>',
        bars: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>',
        // shown instead of the bars icon while the column has an active filter
        filterActive: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>',
        equal: '<svg viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line></svg>',
        search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
        close: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        sortAsc: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 4-4 4 4"></path><path d="M7 4v16"></path><path d="M11 12h4"></path><path d="M11 16h7"></path><path d="M11 20h10"></path></svg>',
        sortDesc: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4"></path><path d="M7 20V4"></path><path d="M11 4h10"></path><path d="M11 8h7"></path><path d="M11 12h4"></path></svg>',
        clearSort: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-8-8"></path><path d="M3 4h12"></path><path d="M3 8h9"></path><path d="M3 12h6"></path><path d="m13 21 8-8"></path></svg>',

        // ---- operator icons (corrected mapping) ----
        // contains            → box [ ] (bracket frame)
        op_contains:     '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3h4v18h-4z"></path><path d="M18 8h3v9h-3"></path><path d="M6 17H3V8h3"></path></svg>',
                // not_contains        → box + slash
        op_not_contains: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4 9 20"></path><path d="M3 8h18v9H3z"></path></svg>',
        // eq / equals         → two horizontal lines
        op_eq:           '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" x2="19" y1="9" y2="9"></line><line x1="5" x2="19" y1="15" y2="15"></line></svg>',
        // neq                 → lines + slash
        op_neq:          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14"></path><path d="M5 15h14"></path><path d="M15 5 9 19"></path></svg>',
        // starts              → left bar + box
        op_starts:       '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h4v18H3z"></path><path d="M11 8h10v9H11"></path></svg>',
        // ends                → right bar + box
        op_ends:         '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3h-4v18h4z"></path><path d="M13 8H3v9h10"></path></svg>',
        // gt / after          → chevron-right
        op_gt:           '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg>',
        // gte                 → double chevron-right
        op_gte:          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 16 6-6-6-6"></path><path d="m9 21 6-6"></path></svg>',
        // lt / before         → chevron-left
        op_lt:           '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"></path></svg>',
        // lte                 → double chevron-left
        op_lte:          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 16-6-6 6-6"></path><path d="m15 21-6-6"></path></svg>',
        // empty               → circle
        op_empty:        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>',
        // not_empty           → circle + slash
        op_not_empty:    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="9" x2="15" y1="15" y2="9"></line></svg>'
    };

    var CHECK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';

    var OPERATORS = {
        string: ['contains', 'not_contains', 'eq', 'neq', 'starts', 'ends', 'empty', 'not_empty'],
        numeric: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'empty', 'not_empty'],
        date: ['eq', 'neq', 'gt', 'lt', 'empty', 'not_empty']
    };

    var DEFAULTS = {
showSortIcon: true,            // show the sort icon in headers (and sort items in the popup)
        showFilterIcon: true,          // show the filter (bars) icon in headers and enable the filter popup
        sortOnHeaderClick: true,       // clicking anywhere on a sortable header (not just the icon) cycles asc -> desc -> off
        debounceTime: 150,             // ms delay while typing in a filter input (legacy alias: debounce)
        dateFormat: 'auto',            // how date cells are parsed: tokens YYYY, YY, MM, M, DD, D, e.g. 'YYYY-MM-DD', 'DD/MM/YYYY'; 'auto' = guess
        dateOrder: 'dmy',              // only for dateFormat 'auto' with non-ISO dates like 28/11/2008: 'dmy' or 'mdy'
        numericRegex: /[^0-9.-]+/g,    // characters removed from numeric cells/inputs before parsing (currency, commas, spaces...)
        decimalSeparator: '.',         // '.' or ',' for numeric columns (applied before numericRegex)
        currencySymbol: '$',           // symbol for columns marked with data-currency, e.g. '$', 'Rs', 'PKR', '€'
        currencyPosition: 'prefix',    // 'prefix' ($1,200) or 'suffix' (1,200 PKR)
        currencyFormatCells: true,     // rewrite currency cells as symbol + grouped number (original text restored on destroy)
        currencyLocale: null,          // number formatting locale; null = en-US ('.' decimal) or de-DE (',' decimal)
        emptyLast: true,               // empty cells always sort to the bottom
        locale: undefined,             // passed to Intl.Collator
        collator: { numeric: true, sensitivity: 'base' },
        onFilter: null,                // function (info) {}
        onSort: null,                  // function (info) {}
        defaultSortColumn: null,    // index (number) or header text (string) to sort by on init
        defaultSortDirection: 'asc', // 'asc' | 'desc'
        showLogicOperator: false,      // true = a 2nd condition + AND / OR radios appear in a column popup once the 1st field has a value
        defaultLogic: 'and',           // initially selected radio: 'and' | 'or'
        columnLogic: 'and',            // how the filters of DIFFERENT columns combine: 'and' | 'or'
        responsive: true,              // viewport-aware popups (fixed, clamped to the screen; bottom sheet on small screens)
        responsiveWrap: true,          // wrap the table in a horizontally scrollable .jts-scroll div (skipped inside .table-responsive / .jts-scroll)
        mobileSheet: false,            // true = popups become a bottom sheet on small screens; false = popup stays anchored to the header
        processing: 'client',          // 'client' (default: filter/sort the DOM rows) | 'server' (rows come from the server via AJAX)
        pageSize: 10,                  // server mode: rows per page (sent as request.pageSize)
        resetPageOnFilter: true,       // server mode: go back to page 1 when the filters change (tablePager overrides this)
        resetPageOnSort: true,         // server mode: go back to page 1 when the sort changes (tablePager overrides this)
        columns: null,                 // per-column overrides: { 'Actions': { sortable: false, filterable: false }, 3: { filterable: false } }
        disableSort: null,             // shortcut: columns without sorting, e.g. ['Actions', 4]
        disableFilter: null,           // shortcut: columns without filtering, e.g. ['Actions', 'extn']
        showNoData: true,              // client mode: show the "No records found" row when every row is filtered out
        initialLoad: true,             // server mode: fetch the first page on init (false = keep the rows already in the table)
        requestDebounce: 100,          // server mode: ms used to merge rapid filter/sort changes into one request
        ajax: {                        // server mode request settings
            url: null,                 // string, or function (request) -> string (required in server mode)
            method: 'POST',            // 'GET' | 'POST' | ...
            contentType: 'json',       // 'json' (JSON body) | 'form' (urlencoded); GET always uses the query string
            dataType: 'json',
            headers: null,             // e.g. { 'X-CSRF-Token': '...' }
            timeout: 0,                // ms, 0 = none
            cache: false,
            data: null,                // object (merged into the request) or function (request, plugin) -> object that replaces it
            settings: null,            // extra $.ajax settings (xhrFields, beforeSend, ...)
            paramNames: { page: 'page', pageSize: 'pageSize', sort: 'sort', filters: 'filters', columnLogic: 'columnLogic' }
        },
        responseMap: { rows: 'data', total: 'total' },   // dot paths into the JSON, or function (json) -> { rows, total }
        renderRow: null,               // server mode: function (row, index) -> <tr> element / jQuery / HTML string (default: built from th data-field)
        onLoad: null,                  // function (info) {}  server mode
        onError: null,                 // function (info) {}  server mode
        mobileBreakpoint: 575,         // px; viewport width at or below which the bottom sheet is used (only when mobileSheet is true)
        labels: {
            sort: 'Sort',
            filter: 'Filter',
            filtered: 'Filtered - click to edit',
            clear: 'Clear',
            datePicker: 'Choose date',
            sortAsc: 'Sort Ascending',
            sortDesc: 'Sort Descending',
            clearSort: 'Clear sort',
            and: 'AND',
            or: 'OR',
            logic: 'Logical operator',
            loading: 'Loading...',
            noData: 'No records found',
            error: 'Could not load data.',
            retry: 'Retry',
            operators: {
                contains: 'Contains', not_contains: 'Does not contain',
                eq: 'Equals', neq: 'Does not equal',
                starts: 'Starts', ends: 'Ends',
                gt: 'Greater than', gte: 'Greater or equal',
                lt: 'Less than', lte: 'Less or equal',
                empty: 'Empty', not_empty: 'Not Empty'
            },
            dateOperators: { gt: 'After', lt: 'Before' }
        }
    };

    // ---------------------------------------------------------------- parsing

    function toGlobalRegex(rx) {
        // toString check instead of instanceof, so regexes from other frames/realms work too
        if (Object.prototype.toString.call(rx) === '[object RegExp]') return rx.global ? rx : new RegExp(rx.source, rx.flags + 'g');
        return new RegExp(String(rx), 'g');
    }

    function parseNumber(text, decimal, regex) {
        var s = String(text == null ? '' : text).trim();
        if (!s) return NaN;
        var paren = /^\(.*\)$/.test(s);
        if (decimal === ',') s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
        s = s.replace(regex || DEFAULTS.numericRegex, '');
        var n = parseFloat(s);
        if (isNaN(n)) return NaN;
        return paren ? -Math.abs(n) : n;
    }

    // Compiles a format such as 'DD/MM/YYYY' into function(text) -> UTC-midnight timestamp or NaN.
    function compileDateFormat(format) {
        var parts = [];
        // Tokens become capture groups; any of / - . in the format matches any of / - . in the cell;
        // every other character is matched literally.
        var src = String(format).replace(/YYYY|YY|MM|M|DD|D|[\/\-.]|[\s\S]/g, function (tok) {
            if (tok === 'YYYY') { parts.push('Y'); return '(\\d{4})'; }
            if (tok === 'YY') { parts.push('Y'); return '(\\d{2})'; }
            if (tok === 'MM' || tok === 'M') { parts.push('M'); return '(\\d{1,2})'; }
            if (tok === 'DD' || tok === 'D') { parts.push('D'); return '(\\d{1,2})'; }
            if (/[\/\-.]/.test(tok)) return '[\\/\\-.]';
            return tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        });
        var tokens = String(format).match(/YYYY|YY|MM|M|DD|D/g) || [];
        var hasY = /Y/.test(parts.join('')), hasM = parts.indexOf('M') > -1, hasD = parts.indexOf('D') > -1;
        if (!hasY || !hasM || !hasD) throw new Error('tableSearch: dateFormat "' + format + '" must contain year (YYYY/YY), month (MM/M) and day (DD/D)');
        var re = new RegExp('^' + src + '$');
        return function (text) {
            var m = re.exec(String(text == null ? '' : text).trim());
            if (!m) return NaN;
            var y, mo, d;
            for (var i = 0; i < tokens.length; i++) {
                var v = parseInt(m[i + 1], 10);
                if (tokens[i] === 'YYYY') y = v;
                else if (tokens[i] === 'YY') y = v < 70 ? 2000 + v : 1900 + v;
                else if (tokens[i].charAt(0) === 'M') mo = v;
                else d = v;
            }
            var t = Date.UTC(y, mo - 1, d), dt = new Date(t);
            return (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) ? t : NaN;
        };
    }

    function formatCurrency(n, symbol, position, nf) {
        var str = nf.format(Math.abs(n));
        var gap = /[A-Za-z]$/.test(symbol) ? ' ' : '';
        var body = position === 'suffix' ? str + gap + symbol : symbol + gap + str;
        return (n < 0 ? '-' : '') + body;
    }

    // Formats a UTC-midnight timestamp using the same tokens as dateFormat.
    function formatDate(ts, fmt) {
        var d = new Date(ts), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
        function pad(n, len) { n = String(n); while (n.length < len) n = '0' + n; return n; }
        return String(fmt).replace(/YYYY|YY|MM|M|DD|D/g, function (t) {
            switch (t) {
                case 'YYYY': return pad(y, 4);
                case 'YY': return pad(y % 100, 2);
                case 'MM': return pad(m, 2);
                case 'M': return m;
                case 'DD': return pad(day, 2);
                default: return day;
            }
        });
    }

    // Returns UTC-midnight timestamp, or NaN.
    function parseDate(text, order) {
        var s = String(text == null ? '' : text).trim();
        if (!s) return NaN;
        var m = /^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/.exec(s);
        if (m) {
            var y, mo, d, a = +m[1], b = +m[2], c = +m[3];
            if (m[1].length === 4) { y = a; mo = b; d = c; }
            else if (m[3].length === 4) { y = c; if (order === 'mdy') { mo = a; d = b; } else { d = a; mo = b; } }
            else return NaN;
            var t = Date.UTC(y, mo - 1, d), dt = new Date(t);
            return (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) ? t : NaN;
        }
        var p = Date.parse(s);
        if (isNaN(p)) return NaN;
        var l = new Date(p);
        return Date.UTC(l.getFullYear(), l.getMonth(), l.getDate());
    }

    // ---------------------------------------------------------------- class

    function TableSearch(table, options) {
        this.table = table;
        this.$table = $(table);
        this.opts = options;
        this.ns = '.tableSearch' + (++uid);
        this.collator = new Intl.Collator(options.locale, options.collator);
        var self = this, fmt = options.dateFormat;
        this.parseCellDate = (fmt && String(fmt).toLowerCase() !== 'auto')
            ? compileDateFormat(fmt)
            : function (t) { return parseDate(t, self.opts.dateOrder); };
        var curLocale = options.currencyLocale || (options.decimalSeparator === ',' ? 'de-DE' : 'en-US');
        this._nfCache = {};
        this._curLocale = curLocale;
        this.displayDateFormat = (fmt && String(fmt).toLowerCase() !== 'auto') ? fmt : 'YYYY-MM-DD';
        this.cols = [];
        this.rows = [];
        this.rowMap = new Map();
        this.nextIdx = 0;
        this.sort = { col: -1, dir: null };
        this.openCol = -1;
        this.timer = null;
        this.raf = null;
        this.$backdrop = null;
        this.wrapped = false;
        this._onScroll = null;
        // server mode state
        if (options.processing === 'server' && !(options.ajax && options.ajax.url)) {
            throw new Error('tableSearch: processing "server" requires ajax.url');
        }
        this._page = 1;
        this._pageSize = options.pageSize;
        this._total = 0;
        this.xhr = null;
        this.reqId = 0;
        this.reqTimer = null;
        this._lastSig = null;      // signature of the last request sent (duplicate prevention)
        this._fsig = null;         // signature of the filters last applied (page resets to 1 only when they change)
        this.loading = false;
        this._hold = true;         // no requests while initialising

        this._setupResponsive();
        this._build();
        this._bind();
        this.refresh();
        this._applyDefaultSort();
        this._hold = false;
        if (this._server() && options.initialLoad) this._queue(true);
    }

    var proto = TableSearch.prototype;

    proto._opLabel = function (type, op) {
        var L = this.opts.labels;
        if (type === 'date' && L.dateOperators && L.dateOperators[op]) return L.dateOperators[op];
        return L.operators[op] || op;
    };

    proto._opIconStyle = function (op) {
        var svg = ICONS['op_' + op];
        if (!svg) return '';
        var enc = encodeURIComponent(svg.replace(/currentColor/g, '#000'));
        return 'background-image:url("data:image/svg+xml,' + enc + '");' +
               'background-repeat:no-repeat;background-position:left 8px center;' +
               'background-size:16px 16px;padding-left:30px;';
    };

    proto._opIconHtml = function (op) {
        return ICONS['op_' + op] || ICONS.equal;
    };

    // ---------------------------------------------------------------- responsive helpers

    proto._setupResponsive = function () {
        if (!this.opts.responsive) return;
        this.$table.addClass('jts-table');
        if (this.opts.responsiveWrap && !this.$table.parent().is('.jts-scroll, .table-responsive')) {
            this.$table.wrap('<div class="jts-scroll"></div>');
            this.wrapped = true;
        }
    };

    proto._isMobile = function () {
        return !!(this.opts.responsive && this.opts.mobileSheet && document.documentElement.clientWidth <= this.opts.mobileBreakpoint);
    };

    proto._showBackdrop = function () {
        if (!this.$backdrop) this.$backdrop = $('<div class="jts-backdrop"></div>').appendTo(document.body);
    };

    proto._hideBackdrop = function () {
        if (this.$backdrop) { this.$backdrop.remove(); this.$backdrop = null; }
    };

    // Scrolling anywhere (window, table wrapper, page containers) re-anchors the open popup.
    // Bound only while a popup is open; removed on close and destroy.
    proto._bindOpen = function () {
        var self = this;
        if (this._onScroll) return;
        this._onScroll = function (e) {
            if (self.openCol < 0) return;
            if ($(e.target).closest('.jts-popup').length) return; // scrolling inside the popup itself
            self._schedulePosition();
        };
        document.addEventListener('scroll', this._onScroll, true);
    };

    proto._unbindOpen = function () {
        if (this._onScroll) { document.removeEventListener('scroll', this._onScroll, true); this._onScroll = null; }
    };

    proto._schedulePosition = function () {
        var self = this;
        if (self.raf !== null) return;
        var run = function () {
            self.raf = null;
            if (self.openCol > -1) self._position(self.cols[self.openCol]);
        };
        self.raf = window.requestAnimationFrame ? window.requestAnimationFrame(run) : setTimeout(run, 16);
    };

    proto._cancelPosition = function () {
        if (this.raf === null) return;
        if (window.cancelAnimationFrame) window.cancelAnimationFrame(this.raf); else clearTimeout(this.raf);
        this.raf = null;
    };

    // Per-column configuration. A column is matched by index (0-based), header text (case-insensitive) or data-field.
    proto._colConfig = function (index, headerText, field) {
        var o = this.opts, out = {};
        var norm = function (v) { return String(v).toLowerCase().replace(/^\s+|\s+$/g, ''); };
        var hit = function (key) {
            if (typeof key === 'number' || /^\d+$/.test(String(key))) return +key === index;
            var k = norm(key);
            return k === norm(headerText) || (field && k === norm(field));
        };
        $.each(o.columns || {}, function (key, cfg) {
            if (cfg && hit(key)) $.extend(out, { sortable: cfg.sortable, filterable: cfg.filterable });
        });
        $.each([].concat(o.disableSort || []), function (_, key) { if (hit(key)) out.sortable = false; });
        $.each([].concat(o.disableFilter || []), function (_, key) { if (hit(key)) out.filterable = false; });
        return out;
    };

    proto._build = function () {
        var self = this, L = this.opts.labels;
        var $headRow = this.$table.children('thead').find('tr').last();

        $headRow.children('th').each(function (index) {
            var $th = $(this);
            var type = String($th.data('type') || 'string').toLowerCase();
            if (!OPERATORS[type]) type = 'string';
            var dCur = $th.data('currency'), currency = null;
            if (dCur !== undefined && dCur !== false && String(dCur).toLowerCase() !== 'false') {
                var custom = (typeof dCur === 'string' && dCur !== '' && dCur.toLowerCase() !== 'true') ? dCur : '';
                currency = custom || self.opts.currencySymbol || '$';
                type = 'numeric';
            }
            var headerText = $.trim($th.text());
            var dSort = $th.data('sortable'), dFilter = $th.data('filterable');
            var sortable = dSort === undefined ? !!self.opts.showSortIcon : !!dSort;
            var filterable = dFilter === undefined ? !!self.opts.showFilterIcon : !!dFilter;
            // Configuration wins over the data-* attributes: columns / disableSort / disableFilter
            var cc = self._colConfig(index, headerText, $th.attr('data-field'));
            if (cc.sortable !== undefined) sortable = !!cc.sortable;
            if (cc.filterable !== undefined) filterable = !!cc.filterable;
            var col = {
                index: index, type: type, currency: currency, field: $th.attr('data-field') || null, $th: $th, origHtml: $th.html(), headerText: headerText,
                sortable: sortable, filterable: filterable,
                $sortBtn: $(), $filterBtn: $(), $popup: $(), $select: $(), $input: $(), $clear: $(),
                $valueGroup: $(), $picker: $(), $opIcon: $()
            };

            var $content = $('<div class="jts-header-content"></div>');
            if (sortable && self.opts.sortOnHeaderClick) $content.css({ cursor: 'pointer', userSelect: 'none' });
            $content.append($('<span></span>').text(headerText));
            var $icons = (sortable || filterable) ? $('<div class="jts-header-icons"></div>').appendTo($content) : $();

            if (sortable) {
                col.$sortBtn = $('<span class="jts-icon-btn jts-sort-header-btn" role="button" tabindex="0"></span>')
                    .attr({ title: L.sort, 'aria-label': L.sort + ': ' + headerText }).html(ICONS.sortHeader).appendTo($icons);
            }

            if (!filterable) {
                $th.empty().append($content);
                self.cols.push(col);
                return;
            }

            col.$filterBtn = $('<span class="jts-icon-btn jts-bars-btn" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false"></span>')
                .attr({ title: L.filter, 'aria-label': L.filter + ': ' + headerText }).html(ICONS.bars).appendTo($icons);

            var dLogic = $th.data('logic');
            col.showLogic = dLogic === undefined ? !!self.opts.showLogicOperator : !!dLogic;
            col.conds = [];

            var $popup = $(
                '<div class="jts-popup" role="dialog">' +
                '<div class="p-3 border-bottom jts-conditions"></div>' +
                '</div>'
            ).attr('aria-label', L.filter + ': ' + headerText);
            var $box = $popup.children('.jts-conditions');

            col.conds.push(self._buildCond(col, 0, $box));
            if (col.showLogic) {
                col.$logic = self._buildLogic(col, $box);
                col.conds.push(self._buildCond(col, 1, $box));
            }

            if (sortable) {
                var $items = $('<div class="py-1"></div>').appendTo($popup);
                $.each([['asc', ICONS.sortAsc, L.sortAsc], ['desc', ICONS.sortDesc, L.sortDesc], ['clear', ICONS.clearSort, L.clearSort]], function (_, a) {
                    var $item = $('<a href="#" class="jts-sort-item"></a>').attr('data-action', a[0])
                        .append(a[1]).append(document.createTextNode(' ' + a[2])).appendTo($items);
                    if (a[0] !== 'clear') {
                        $('<span class="jts-sort-check" aria-hidden="true"></span>').html(CHECK_ICON)
                            .css({ display: 'none', 'float': 'right', marginLeft: 'auto' }).appendTo($item);
                    }
                });
            } else {
                $popup.children('.p-3').removeClass('border-bottom');
            }

            // first condition is also exposed on the column (used by older code paths)
            var c0 = col.conds[0];
            col.$select = c0.$select; col.$input = c0.$input; col.$clear = c0.$clear;
            col.$valueGroup = c0.$valueGroup; col.$picker = c0.$picker; col.$opIcon = c0.$opIcon;
            col.$popup = $popup;
            $th.empty().append($content, $popup);
            self.cols.push(col);
        });
    };

    // Builds one condition (operator select + value input) and appends it to the popup box.
    proto._buildCond = function (col, n, $box) {
        var self = this, L = this.opts.labels, type = col.type, currency = col.currency, headerText = col.headerText;
        var $select = $('<select class="form-select jts-select"></select>').attr('aria-label', L.filter + ' operator');
        $.each(OPERATORS[type], function (_, op) {
            var $opt = $('<option></option>').val(op).text(self._opLabel(type, op));
            var style = self._opIconStyle(op);
            if (style) $opt.attr('style', style);
            $select.append($opt);
        });

        (function paint() {
            var first = $select[0].options[$select[0].selectedIndex];
            if (first) $select[0].style.backgroundImage = first.style.backgroundImage || '';
        })();

        var $input = $('<input class="form-control jts-input" placeholder="">')
            .attr({ type: 'text', autocomplete: 'off', 'aria-label': headerText + ' ' + L.filter + (n ? ' 2' : '') });
        if (type === 'numeric') $input.attr('inputmode', 'decimal');
        if (type === 'date') $input.attr('placeholder', self.displayDateFormat);

        var $clear = $('<span class="jts-clear-btn" role="button" tabindex="0"></span>')
            .attr({ title: L.clear, 'aria-label': L.clear }).html(ICONS.close);

        var $opGroup = $('<div class="input-group input-group-sm mb-2"><span class="input-group-text jts-input-group-text jts-op-icon">' + ICONS.equal + '</span></div>')
            .attr('data-cond', n).toggleClass('jts-logic-extra d-none', n > 0).appendTo($box).append($select);
        var $valueGroup = $('<div class="input-group input-group-sm position-relative jts-value-group"><span class="input-group-text jts-input-group-text">' + ICONS.search + '</span></div>')
            .attr('data-cond', n).toggleClass('jts-logic-extra d-none', n > 0).appendTo($box).append($input, $clear);

        var cond = {
            index: n, type: type, $select: $select, $input: $input, $clear: $clear,
            $valueGroup: $valueGroup, $opIcon: $opGroup.find('.jts-op-icon'), $picker: $(), $datePickerBtn: $()
        };
        cond.$opIcon.html(self._opIconHtml($select.val()));

        if (currency) $valueGroup.children('.input-group-text').empty().text(currency).attr('title', currency);

        if (type === 'date') {
            $valueGroup.addClass('jts-date-group');
            cond.$datePickerBtn = $('<button type="button" class="btn btn-outline-secondary jts-date-picker-btn"></button>')
                .attr('aria-label', L.datePicker)
                .html('<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>')
                .appendTo($valueGroup);
            cond.$picker = $('<input type="date" class="jts-date-picker" tabindex="-1" aria-hidden="true">')
                .css({ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '1px', padding: 0, border: 0, opacity: 0, pointerEvents: 'none' })
                .appendTo($valueGroup);
        }
        return cond;
    };

    proto._defaultLogic = function () {
        return String(this.opts.defaultLogic).toLowerCase() === 'or' ? 'or' : 'and';
    };

    // AND / OR radio pair between the two conditions of a column.
    proto._buildLogic = function (col, $box) {
        var L = this.opts.labels, def = this._defaultLogic();
        var name = 'jts-logic-' + this.ns.replace(/\W/g, '') + '-' + col.index;
        var $row = $('<div class="jts-logic jts-logic-extra mb-1 mt-1 text-center d-none" role="radiogroup"></div>').attr('aria-label', L.logic).appendTo($box);
        $.each(['and', 'or'], function (_, v) {
            var id = name + '-' + v;
            var $d = $('<div class="form-check form-check-inline"></div>').appendTo($row);
            if (v === 'or') $d.css('margin-right', 0); // keeps the pair optically centered
            $('<input class="form-check-input jts-logic-radio" type="radio">')
                .attr({ name: name, id: id, value: v }).prop('checked', v === def).appendTo($d);
            $('<label class="form-check-label"></label>').attr('for', id).text(L[v] || v.toUpperCase()).appendTo($d);
        });
        return $row;
    };

    // Reveals the AND/OR radios and 2nd condition once the 1st condition (or the 2nd) is in use.
    proto._condActive = function (cond) {
        var op = cond.$select.val();
        return $.trim(cond.$input.val()) !== '' || op === 'empty' || op === 'not_empty';
    };

    proto._updateLogicVisibility = function (col) {
        if (!col.showLogic || !col.conds || col.conds.length < 2) return;
        var show = this._condActive(col.conds[0]) || this._condActive(col.conds[1]);
        col.$popup.find('.jts-logic-extra').toggleClass('d-none', !show);
    };

    proto._logicOf = function (col) {
        var v = col.$logic && col.$logic.find('input:checked').val();
        return v === 'or' ? 'or' : (v === 'and' ? 'and' : this._defaultLogic());
    };

    proto._setLogic = function (col, v) {
        if (col.$logic) col.$logic.find('input[value="' + v + '"]').prop('checked', true);
    };

    // Resolves {col, cond} for an element inside a popup.
    proto._ctx = function (el) {
        var col = this._colOf(el); if (!col || !col.conds) return null;
        var n = +$(el).closest('[data-cond]').attr('data-cond') || 0;
        var cond = col.conds[n];
        return cond ? { col: col, cond: cond } : null;
    };

    proto._colOf = function (el) {
        var th = $(el).closest('th')[0];
        return th ? this.cols[$(th).index()] : null;
    };

    proto._bind = function () {
        var self = this, ns = this.ns;
        var $t = this.$table;

        $t.on('click' + ns, '.jts-bars-btn', function () {
            var col = self._colOf(this); if (col) self._togglePopup(col);
        });

        // One handler for the whole header cell (label + sort icon). The filter icon is excluded.
        $t.on('click' + ns, '.jts-header-content', function (e) {
            var $tgt = $(e.target);
            if ($tgt.closest('.jts-bars-btn').length) return;
            if (!self.opts.sortOnHeaderClick && !$tgt.closest('.jts-sort-header-btn').length) return;
            var col = self._colOf(this); if (!col || !col.sortable) return;
            if (self.sort.col !== col.index) self._setSort(col.index, 'asc');
            else if (self.sort.dir === 'asc') self._setSort(col.index, 'desc');
            else self._setSort(-1, null);
        });

        $t.on('click' + ns, '.jts-sort-item', function (e) {
            e.preventDefault();
            var col = self._colOf(this); if (!col) return;
            var action = $(this).data('action');
            if (action === 'clear') self._setSort(-1, null); else self._setSort(col.index, action);
        });

        $t.on('input' + ns + ' change' + ns, '.jts-input', function () {
            var x = self._ctx(this); if (!x) return;
            self._updateClearIcon(x.cond);
            self._updateLogicVisibility(x.col);
            if (x.cond.type === 'date') self._syncPicker(x.cond);
            clearTimeout(self.timer);
            self.timer = setTimeout(function () { self.applyFilters(); }, self.opts.debounceTime);
        });

        // Keep typing in the date field uninterrupted; open the native calendar on explicit request.
        $t.on('click' + ns, '.jts-date-picker-btn', function () {
            var x = self._ctx(this);
            if (x && x.cond.type === 'date') self._openPicker(x.cond);
        });

        // A day picked in the calendar is written into the text field using dateFormat
        $t.on('change' + ns, '.jts-date-picker', function () {
            var x = self._ctx(this); if (!x) return;
            var ts = parseDate(this.value, 'dmy'); // native value is always YYYY-MM-DD
            x.cond.$input.val(isNaN(ts) ? '' : formatDate(ts, self.displayDateFormat));
            self._updateClearIcon(x.cond);
            clearTimeout(self.timer);
            self.applyFilters();
        });

        $t.on('change' + ns, '.jts-select', function () {
            var x = self._ctx(this); if (!x) return;
            var opt = this.options[this.selectedIndex];
            if (opt) this.style.backgroundImage = opt.style.backgroundImage || '';
            if (x.cond.$opIcon.length) x.cond.$opIcon.html(self._opIconHtml(this.value));
            self._updateValueVisibility(x.cond);
            self._updateLogicVisibility(x.col);
            clearTimeout(self.timer);
            self.applyFilters();
        });

        $t.on('keyup' + ns, '.jts-select', function () {
            var x = self._ctx(this); if (!x) return;
            if (x.cond.$opIcon.length) x.cond.$opIcon.html(self._opIconHtml(this.value));
        });

        $t.on('click' + ns, '.jts-clear-btn', function (e) {
            e.preventDefault();
            var x = self._ctx(this); if (!x) return;
            x.cond.$input.val('');
            x.cond.$picker.val('');
            self._updateClearIcon(x.cond);
            clearTimeout(self.timer);
            self.applyFilters();
            if (x.cond.type !== 'date') x.cond.$input.trigger('focus');
        });

        // AND / OR radios
        $t.on('change' + ns, '.jts-logic-radio', function () {
            clearTimeout(self.timer);
            self.applyFilters();
        });

        // Keyboard activation for the span "buttons"
        $t.on('keydown' + ns, '.jts-icon-btn, .jts-clear-btn', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $(this).trigger('click'); }
        });

        // Retry link in the error row (server mode)
        $t.on('click' + ns, '.jts-retry', function (e) {
            e.preventDefault();
            self.reload();
        });

        // Escape closes the popup and returns focus to its trigger
        $t.on('keydown' + ns, function (e) {
            if (e.key === 'Escape' && self.openCol > -1) {
                var col = self.cols[self.openCol];
                self._closePopups();
                if (col) col.$filterBtn.trigger('focus');
            }
        });

        // Any click outside the popup (including the header text and sort icon) closes this table's popups;
        // the filter icon is excluded because its own handler toggles the popup
        $(document).on('click' + ns, function (e) {
            if (self.openCol === -1) return;
            var $tgt = $(e.target);
            if (!$tgt.closest('.jts-popup, .jts-bars-btn', self.table).length) self._closePopups();
        });

        // resize + orientation change: throttled with rAF, one namespaced handler per instance (removed in destroy)
        $(window).on('resize' + ns + ' orientationchange' + ns, function () {
            if (self.openCol > -1) self._schedulePosition();
        });
    };

    // ---------------------------------------------------------------- popup UI

    proto._position = function (col) {
        var $p = col.$popup;
        if (this.opts.responsive) return this._positionResponsive(col);
        $p.css({ left: 'auto', right: '0' });
        var right = $p[0].getBoundingClientRect().right;
        if (right > document.documentElement.clientWidth) $p.css({ left: '0', right: 'auto' });
    };

    // Fixed positioning escapes the scroll wrapper's clipping; the popup is clamped to the viewport.
    // Small screens: bottom sheet (layout comes from CSS class jts-popup-sheet).
    proto._positionResponsive = function (col) {
        var $p = col.$popup, p = $p[0], m = 8;
        var mobile = this._isMobile();
        $p.toggleClass('jts-popup-sheet', mobile);
        if (mobile) {
            $p.css({ position: '', top: '', left: '', right: '', width: '', maxHeight: '' });
            this._showBackdrop();
            return;
        }
        this._hideBackdrop();
        var vw = document.documentElement.clientWidth, vh = window.innerHeight || document.documentElement.clientHeight;
        var r = col.$th[0].getBoundingClientRect();
        $p.css({ position: 'fixed', left: 0, top: 0, right: 'auto', maxHeight: (vh - 2 * m) + 'px' });
        var w = Math.min(p.offsetWidth, vw - 2 * m), h = p.offsetHeight;
        var left = Math.max(m, Math.min(r.right - w, vw - w - m));      // right-aligned to the header, kept on screen
        var top = r.bottom;                                                   // the popup's own 4px margin-top adds the gap
        if (top + h > vh - m) {                                          // no room below: flip above, else pin inside the viewport
            var above = r.top - h - 4;
            top = above >= m ? above : Math.max(m, vh - h - m);
        }
        $p.css({ left: left + 'px', top: top + 'px' });
    };

    proto._togglePopup = function (col) {
        var wasOpen = this.openCol === col.index;
        this._closePopups();
        if (wasOpen) return;
        col.$popup.addClass('active');
        col.$filterBtn.attr('aria-expanded', 'true');
        this.openCol = col.index;
        this._position(col);
        this._bindOpen();
        // touch devices: skip auto-focus so the on-screen keyboard doesn't pop up and cover the table
        var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        if (!touch && !this._isMobile()) col.$input.trigger('focus');
    };

    proto._closePopups = function () {
        $.each(this.cols, function (_, c) {
            c.$popup.removeClass('active');
            c.$filterBtn.attr('aria-expanded', 'false');
        });
        this.openCol = -1;
        this._unbindOpen();
        this._cancelPosition();
        this._hideBackdrop();
    };

    proto._openPicker = function (col) {
        var p = col.$picker[0], now = Date.now();
        if (!p || typeof p.showPicker !== 'function') return;
        if (col.pickerAt && now - col.pickerAt < 400) return;
        col.pickerAt = now;
        try { p.showPicker(); } catch (e) { /* needs user activation / already open */ }
    };

    // Keep the calendar's selected day in step with what the user typed.
    proto._syncPicker = function (col) {
        var raw = $.trim(col.$input.val()), ts = raw ? this._parseSearchDate(raw) : NaN;
        col.$picker.val(isNaN(ts) ? '' : new Date(ts).toISOString().slice(0, 10));
    };

    // Typed search dates follow dateFormat; ISO-style input is accepted as a fallback.
    proto._parseSearchDate = function (raw) {
        var t = this.parseCellDate(raw);
        return isNaN(t) ? parseDate(raw, this.opts.dateOrder) : t;
    };

    proto._updateClearIcon = function (col) {
        if (col.$input.val() !== '') col.$clear.css('display', 'flex'); else col.$clear.hide();
    };

    proto._updateValueVisibility = function (col) {
        var op = col.$select.val();
        col.$valueGroup.toggle(!(op === 'empty' || op === 'not_empty'));
    };

    // ---------------------------------------------------------------- data

    // Maps the table body rows to internal row records (message rows of server mode are ignored).
    proto._syncRows = function () {
        var tbody = this.table.tBodies[0];
        var trs = tbody ? tbody.rows : [];
        var old = this.rowMap, map = new Map(), rows = [];

        for (var i = 0; i < trs.length; i++) {
            var tr = trs[i];
            if (tr.className.indexOf('jts-msg-row') > -1) continue;
            var r = old.get(tr);
            if (!r) r = { el: tr, idx: this.nextIdx++, cache: [], vis: tr.style.display !== 'none' };
            else r.cache = [];
            map.set(tr, r);
            rows.push(r);
        }
        this.rowMap = map;
        this.rows = rows;
    };

    proto.refresh = function () {
        if (this._server()) {
            if (this._hold) {                       // during init: adopt the rows already in the table
                this._syncRows();
                this._formatCurrencyCells();
                this._total = this.rows.length;
                return this;
            }
            return this.reload();                   // later: fetch the current page again
        }
        this._syncRows();
        this._formatCurrencyCells();
        this._checkDateColumns();
        if (this.sort.col > -1) this._applySort();   // sort first: the filter event below must see the final row order
        this.applyFilters();
        return this;
    };

    proto._numberFormat = function (decimals) {
        return this._nfCache[decimals] || (this._nfCache[decimals] =
            new Intl.NumberFormat(this._curLocale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
    };

    // Shows currency cells as symbol + grouped number. The numeric value is kept in data-sort-value so
    // sorting/filtering never depend on the display text; destroy() puts the original text back.
    proto._formatCurrencyCells = function () {
        if (!this.opts.currencyFormatCells) return;
        var o = this.opts;
        for (var ci = 0; ci < this.cols.length; ci++) {
            var col = this.cols[ci];
            if (!col.currency) continue;
            for (var i = 0; i < this.rows.length; i++) {
                var cell = this.rows[i].el.cells[ci];
                if (!cell || cell.children.length) continue;
                var cur = $.trim(cell.textContent);
                if (cur === '' || cell.getAttribute('data-jts-fmt') === cur) continue;
                var ours = cell.hasAttribute('data-jts-fmt');
                var userSv = cell.hasAttribute('data-sort-value') && !ours;
                var n = parseNumber(userSv ? cell.getAttribute('data-sort-value') : cur, o.decimalSeparator, o.numericRegex);
                if (n !== n) continue;
                var dec = (String(Math.abs(n)).split('.')[1] || '').length;
                var text = formatCurrency(n, col.currency, o.currencyPosition, this._numberFormat(dec > 0 ? Math.max(2, dec) : 0));
                cell.setAttribute('data-jts-orig', cur);
                cell.setAttribute('data-jts-fmt', text);
                if (!userSv) { cell.setAttribute('data-sort-value', String(n)); cell.setAttribute('data-jts-sv', '1'); }
                cell.textContent = text;
            }
        }
    };

    // Dev aid: warn when date cells don't match dateFormat (they'd silently be treated as empty).
    proto._checkDateColumns = function () {
        if (typeof console === 'undefined' || !console.warn) return;
        for (var ci = 0; ci < this.cols.length; ci++) {
            if (this.cols[ci].type !== 'date') continue;
            var bad = 0, sample = '';
            for (var i = 0; i < this.rows.length; i++) {
                var k = this._key(this.rows[i], ci);
                if (k.text !== '' && k.date !== k.date) { bad++; if (!sample) sample = k.text; }
            }
            if (bad) console.warn('tableSearch: ' + bad + ' cell(s) in date column "' + this.cols[ci].headerText +
                '" do not match dateFormat "' + this.opts.dateFormat + '" (e.g. "' + sample + '") and are treated as empty.');
        }
    };

    // Lazily parsed, cached per row/column.
    proto._key = function (row, ci) {
        var k = row.cache[ci];
        if (k) return k;
        var cell = row.el.cells[ci], type = this.cols[ci].type;
        var text = cell ? $.trim(cell.textContent) : '';
        var attr = cell ? cell.getAttribute('data-sort-value') : null;
        var src = attr !== null ? attr : text;
        k = row.cache[ci] = {
            text: text,
            lower: text.toLowerCase(),
            src: src,
            num: type === 'numeric' ? parseNumber(src, this.opts.decimalSeparator, this.opts.numericRegex) : NaN,
            date: type === 'date' ? this.parseCellDate(src) : NaN
        };
        return k;
    };

    // ---------------------------------------------------------------- filtering

    // Combined predicate of a column: its 1st and 2nd condition joined by the AND / OR radio.
    proto._predicate = function (col) {
        if (!col.filterable) return null;
        var preds = [];
        for (var i = 0; i < col.conds.length; i++) {
            var fn = this._condPredicate(col, col.conds[i]);
            if (fn) preds.push(fn);
        }
        if (!preds.length) return null;
        if (preds.length === 1) return preds[0];
        var p0 = preds[0], p1 = preds[1];
        if (this._logicOf(col) === 'or') return function (k) { return p0(k) || p1(k); };
        return function (k) { return p0(k) && p1(k); };
    };

    proto._condPredicate = function (col, cond) {
        var op = cond.$select.val(), raw = $.trim(cond.$input.val());
        if (op === 'empty') return function (k) { return k.text === ''; };
        if (op === 'not_empty') return function (k) { return k.text !== ''; };
        if (!raw) return null;

        var t, get;
        if (col.type === 'numeric') { t = parseNumber(raw, this.opts.decimalSeparator, this.opts.numericRegex); get = function (k) { return k.num; }; }
        else if (col.type === 'date') { t = this._parseSearchDate(raw); get = function (k) { return k.date; }; }
        else { t = raw.toLowerCase(); get = function (k) { return k.lower; }; }
        if (typeof t === 'number' && isNaN(t)) return null;

        switch (op) {
            case 'contains': return function (k) { return get(k).indexOf(t) > -1; };
            case 'not_contains': return function (k) { return get(k).indexOf(t) === -1; };
            case 'starts': return function (k) { return get(k).lastIndexOf(t, 0) === 0; };
            case 'ends': return function (k) { var v = get(k); return v.length >= t.length && v.indexOf(t, v.length - t.length) !== -1; };
            case 'eq': return function (k) { return get(k) === t; };
            case 'neq': return function (k) { return get(k) !== t; };
            case 'gt': return function (k) { return get(k) > t; };
            case 'gte': return function (k) { return get(k) >= t; };
            case 'lt': return function (k) { return get(k) < t; };
            case 'lte': return function (k) { return get(k) <= t; };
        }
        return null;
    };

    // Visible "this column is filtered" indicator: filled funnel icon in the accent colour (inline styles,
    // so it works without extra CSS), plus a class on the <th> for custom styling.
    proto._markFiltered = function (col, active) {
        if (!col.$filterBtn.length || col.filtered === active) return;
        col.filtered = active;
        col.$filterBtn.html(active ? ICONS.filterActive : ICONS.bars)
            // .css('color', active ? 'var(--bs-primary, #0d6efd)' : '')
            .attr('title', active ? this.opts.labels.filtered : this.opts.labels.filter);
        col.$th.toggleClass('jts-col-filtered', active);
    };

    proto.applyFilters = function () {
        var preds = [], i, j;
        for (i = 0; i < this.cols.length; i++) {
            var col = this.cols[i], fn = this._predicate(col);
            col.$filterBtn.toggleClass('jts-filter-active', !!fn);
            this._markFiltered(col, !!fn);
            this._updateLogicVisibility(col);
            if (fn) preds.push({ ci: i, fn: fn });
        }

        if (this._server()) {                       // server mode: the server does the filtering
            var fs = JSON.stringify(this._serverFilters());
            if (fs !== this._fsig) { this._fsig = fs; if (this.opts.resetPageOnFilter !== false) this._page = 1; }
            this._queue();
            return this;
        }

        var visible = 0, rows = this.rows;
        var orCols = String(this.opts.columnLogic).toLowerCase() === 'or';
        for (i = 0; i < rows.length; i++) {
            var row = rows[i], show = true;
            if (preds.length && orCols) {
                show = false;
                for (j = 0; j < preds.length; j++) {
                    if (preds[j].fn(this._key(row, preds[j].ci))) { show = true; break; }
                }
            } else {
                for (j = 0; j < preds.length; j++) {
                    if (!preds[j].fn(this._key(row, preds[j].ci))) { show = false; break; }
                }
            }
            if (row.vis !== show) { row.el.style.display = show ? '' : 'none'; row.vis = show; }
            if (show) visible++;
        }

        this._toggleNoData(rows.length > 0 && visible === 0);
        var info = { visible: visible, total: rows.length };
        this.$table.trigger('tablesearch:filter', [info]);
        if (typeof this.opts.onFilter === 'function') this.opts.onFilter.call(this.table, info);
        return this;
    };

    // Client mode: a "No records found" row while every row is filtered out.
    proto._toggleNoData = function (show) {
        var tb = this.table.tBodies[0];
        if (!tb) return;
        var $tb = $(tb);
        if (!show || !this.opts.showNoData) { $tb.children('.jts-empty-row').remove(); return; }
        if ($tb.children('.jts-empty-row').length) return;
        $tb.prepend(this._msgRow(this.opts.labels.noData, 'jts-empty-row'));
    };

    proto.clearFilters = function () {
        var self = this;
        $.each(this.cols, function (_, c) {
            if (!c.filterable) return;
            $.each(c.conds, function (_, k) {
                k.$select.prop('selectedIndex', 0);
                k.$input.val('');
                k.$picker.val('');
                var first = k.$select[0].options[0];
                k.$select[0].style.backgroundImage = first ? (first.style.backgroundImage || '') : '';
                if (k.$opIcon.length) k.$opIcon.html(self._opIconHtml(k.$select.val()));
                self._updateClearIcon(k);
                self._updateValueVisibility(k);
            });
            self._setLogic(c, self._defaultLogic());
        });
        clearTimeout(this.timer);
        return this.applyFilters();
    };

    // ---------------------------------------------------------------- sorting

    proto._setSort = function (ci, dir) {
        this.sort = { col: ci, dir: dir };
        $.each(this.cols, function (_, c) {
            c.$sortBtn.removeClass('sort-active sort-desc').html(ICONS.sortHeader);
            c.$th.removeAttr('aria-sort');
            c.$popup.find('.jts-sort-check').hide();
            c.$popup.find('.jts-sort-item').removeAttr('aria-current');
        });
        if (ci > -1) {
            var c = this.cols[ci];
            c.$sortBtn.addClass('sort-active').toggleClass('sort-desc', dir === 'desc')
                .html(dir === 'desc' ? ICONS.sortDesc : ICONS.sortAsc);
            c.$th.attr('aria-sort', dir === 'desc' ? 'descending' : 'ascending');
            var $active = c.$popup.find('.jts-sort-item[data-action="' + dir + '"]').attr('aria-current', 'true');
            $active.find('.jts-sort-check').css('display', 'inline-flex');
        }
        this._applySort();
        if (this._server()) { if (this.opts.resetPageOnSort !== false) this._page = 1; this._queue(); }
        var info = { column: ci, direction: dir };
        this.$table.trigger('tablesearch:sort', [info]);
        if (typeof this.opts.onSort === 'function') this.opts.onSort.call(this.table, info);
    };

    proto._applySort = function () {
        if (this._server()) return;                 // server mode: the server returns the rows already sorted
        var tbody = this.table.tBodies[0];
        if (!tbody) return;
        var ci = this.sort.col, rows = this.rows.slice(), self = this;

        if (ci < 0) {
            rows.sort(function (a, b) { return a.idx - b.idx; });
        } else {
            var type = this.cols[ci].type, mul = this.sort.dir === 'desc' ? -1 : 1;
            var emptyLast = this.opts.emptyLast, collator = this.collator;
            rows.sort(function (a, b) {
                var ka = self._key(a, ci), kb = self._key(b, ci), va, vb, ea, eb, res;
                if (type === 'string') { va = ka.src; vb = kb.src; ea = va === ''; eb = vb === ''; }
                else {
                    va = type === 'numeric' ? ka.num : ka.date;
                    vb = type === 'numeric' ? kb.num : kb.date;
                    ea = va !== va; eb = vb !== vb;
                }
                if (ea || eb) {
                    if (ea && eb) return a.idx - b.idx;
                    res = ea ? 1 : -1;
                    return emptyLast ? res : -res * mul;
                }
                res = (type === 'string' ? collator.compare(va, vb) : va - vb) * mul;
                return res || a.idx - b.idx;
            });
        }

        var frag = tbody.ownerDocument.createDocumentFragment();
        for (var i = 0; i < rows.length; i++) frag.appendChild(rows[i].el);
        tbody.appendChild(frag);
    };

    proto.clearSort = function () { this._setSort(-1, null); return this; };

    // ---------------------------------------------------------------- server mode

    function pick(obj, path) {
        if (obj == null || path == null || path === '') return undefined;
        var p = String(path).split('.');
        for (var i = 0; i < p.length; i++) { if (obj == null) return undefined; obj = obj[p[i]]; }
        return obj;
    }

    proto._server = function () { return this.opts.processing === 'server'; };

    proto._pages = function () {
        return this._total > 0 ? Math.max(1, Math.ceil(this._total / this._pageSize)) : 1;
    };

    // Filters as a structured list: one entry per column with 1-2 conditions and the AND/OR joining them.
    proto._serverFilters = function () {
        var out = [], self = this, o = this.opts;
        $.each(this.cols, function (_, c) {
            if (!c.filterable || !c.conds) return;
            var conds = [];
            $.each(c.conds, function (_, k) {
                var op = k.$select.val(), raw = $.trim(k.$input.val()), v;
                if (op === 'empty' || op === 'not_empty') { conds.push({ operator: op, value: null }); return; }
                if (!raw) return;
                if (c.type === 'numeric') { v = parseNumber(raw, o.decimalSeparator, o.numericRegex); if (v !== v) return; }
                else if (c.type === 'date') { var t = self._parseSearchDate(raw); if (t !== t) return; v = new Date(t).toISOString().slice(0, 10); }
                else v = raw;
                conds.push({ operator: op, value: v });
            });
            if (!conds.length) return;
            out.push({ column: c.index, field: c.field, type: c.type, logic: conds.length > 1 ? self._logicOf(c) : 'and', conditions: conds });
        });
        return out;
    };

    proto._buildRequest = function () {
        var c = this.sort.col > -1 ? this.cols[this.sort.col] : null;
        return {
            page: this._page,
            pageSize: this._pageSize,
            sort: c ? { column: c.index, field: c.field, direction: this.sort.dir } : null,
            columnLogic: String(this.opts.columnLogic).toLowerCase() === 'or' ? 'or' : 'and',
            filters: this._serverFilters()
        };
    };

    // Applies ajax.paramNames and ajax.data to the internal request.
    proto._shape = function (req, asJson) {
        var cfg = this.opts.ajax, pn = cfg.paramNames || {}, out = {}, d = cfg.data;
        out[pn.page || 'page'] = req.page;
        out[pn.pageSize || 'pageSize'] = req.pageSize;
        if (req.sort || asJson) out[pn.sort || 'sort'] = req.sort;
        out[pn.columnLogic || 'columnLogic'] = req.columnLogic;
        out[pn.filters || 'filters'] = req.filters;
        if (typeof d === 'function') { var r = d.call(this.table, out, this); if (r && typeof r === 'object') out = r; }
        else if (d && typeof d === 'object') out = $.extend({}, out, d);
        return out;
    };

    // Schedules a request. Rapid calls are merged (requestDebounce); now = true sends immediately.
    proto._queue = function (now) {
        if (this._hold || !this._server()) return;
        var self = this;
        clearTimeout(this.reqTimer);
        var run = function () { self.reqTimer = null; self._send(); };
        if (now || !this.opts.requestDebounce) { this.reqTimer = null; run(); }
        else this.reqTimer = setTimeout(run, this.opts.requestDebounce);
    };

    proto._send = function () {
        var self = this, cfg = this.opts.ajax, req = this._buildRequest(), sig = JSON.stringify(req);
        if (sig === this._lastSig) return;                       // identical to the request already sent / loaded
        this._lastSig = sig;

        var id = ++this.reqId;                                   // bump first: the aborted request's callbacks become stale
        if (this.xhr) { var old = this.xhr; this.xhr = null; old.abort(); }

        var method = String(cfg.method || 'POST').toUpperCase();
        var asJson = method !== 'GET' && String(cfg.contentType).toLowerCase() !== 'form';
        var payload = this._shape(req, asJson);
        var settings = $.extend({}, cfg.settings, {
            url: typeof cfg.url === 'function' ? cfg.url(req) : cfg.url,
            type: method,
            dataType: cfg.dataType || 'json',
            headers: cfg.headers || undefined,
            timeout: cfg.timeout || 0,
            cache: !!cfg.cache,
            data: asJson ? JSON.stringify(payload) : payload
        });
        if (asJson) settings.contentType = 'application/json; charset=utf-8';

        this._setLoading(true);
        this.$table.trigger('tablesearch:request', [req]);

        var xhr = this.xhr = $.ajax(settings);
        xhr.done(function (json) {
            if (id !== self.reqId) return;
            self.xhr = null;
            self._onLoad(json, xhr);
            if (id === self.reqId) self._setLoading(false);   // a follow-up request (page clamp) keeps the loading state
        }).fail(function (jq, status, err) {
            if (id !== self.reqId || status === 'abort') return;
            self.xhr = null;
            self._lastSig = null;                                // allow an identical retry
            self._onError(jq, status, err);
            self._setLoading(false);
        });
    };

    proto._mapResponse = function (json) {
        var m = this.opts.responseMap, r;
        if (typeof m === 'function') r = m.call(this.table, json, this) || {};
        else r = { rows: pick(json, m && m.rows), total: pick(json, m && m.total) };
        if (r.rows === undefined && Array.isArray(json)) r.rows = json;   // bare array response
        return r;
    };

    proto._onLoad = function (json, xhr) {
        var rows, total, nodes = [], i;
        try {
            var m = this._mapResponse(json);
            rows = m.rows;
            if (!Array.isArray(rows)) throw new Error('tableSearch: response has no rows array (check responseMap)');
            for (i = 0; i < rows.length; i++) nodes.push(this._toRow(rows[i], i));
            total = m.total == null ? NaN : +m.total;
            if (total !== total) total = (this._page - 1) * this._pageSize + rows.length;
            if (!rows.length && total > 0 && this._page > 1) {      // page is past the end (data shrank): jump to the last page
                var last = Math.max(1, Math.ceil(total / this._pageSize));
                if (last < this._page) { this._page = last; this._lastSig = null; this._total = total; this._queue(true); return; }
            }
            if (!nodes.length) nodes.push(this._msgRow(this.opts.labels.noData, 'jts-empty-row'));
            this._total = total;
            this._setBody(nodes);
        } catch (e) {
            this._onError(xhr, 'parsererror', e.message);
            return;
        }
        var info = { rows: rows.length, total: total, page: this._page, pageSize: this._pageSize, pages: this._pages(), response: json };
        this.$table.trigger('tablesearch:load', [info]);
        if (typeof this.opts.onLoad === 'function') this.opts.onLoad.call(this.table, info);
        var fi = { visible: rows.length, total: total };
        this.$table.trigger('tablesearch:filter', [fi]);
        if (typeof this.opts.onFilter === 'function') this.opts.onFilter.call(this.table, fi);
    };

    proto._onError = function (xhr, status, err) {
        this._lastSig = null;
        this._total = 0;
        this._setBody([this._msgRow(this.opts.labels.error, 'jts-error-row', true)]);
        var info = { status: status, error: err, xhr: xhr };
        this.$table.trigger('tablesearch:error', [info]);
        if (typeof this.opts.onError === 'function') this.opts.onError.call(this.table, info);
    };

    proto._defaultRow = function (row) {
        var tr = document.createElement('tr');
        for (var i = 0; i < this.cols.length; i++) {
            var f = this.cols[i].field;
            var v = Array.isArray(row) ? row[i] : (f ? pick(row, f) : undefined);
            var td = document.createElement('td');
            td.textContent = v == null ? '' : String(v);
            tr.appendChild(td);
        }
        return tr;
    };

    proto._toRow = function (row, i) {
        var out = typeof this.opts.renderRow === 'function' ? this.opts.renderRow.call(this.table, row, i, this) : this._defaultRow(row, i);
        if (typeof out === 'string') out = $('<tbody></tbody>').html(out).children('tr')[0];
        else if (out && out.jquery) out = out[0];
        if (!out || out.nodeType !== 1) throw new Error('tableSearch: renderRow must return a <tr>');
        return out;
    };

    proto._msgRow = function (text, cls, retry) {
        var tr = document.createElement('tr'), td = document.createElement('td');
        tr.className = 'jts-msg-row ' + cls;
        td.colSpan = Math.max(1, this.cols.length);
        td.className = 'jts-msg-cell text-center text-muted py-4';
        td.textContent = text;
        if (retry) {
            var a = document.createElement('a');
            a.href = '#'; a.className = 'jts-retry'; a.textContent = this.opts.labels.retry;
            td.appendChild(document.createTextNode(' '));
            td.appendChild(a);
        }
        tr.appendChild(td);
        return tr;
    };

    proto._setBody = function (nodes) {
        var tb = this.table.tBodies[0] || this.table.appendChild(document.createElement('tbody'));
        var frag = document.createDocumentFragment();
        for (var i = 0; i < nodes.length; i++) frag.appendChild(nodes[i]);
        $(tb).empty();
        tb.appendChild(frag);
        this._syncRows();
        this._formatCurrencyCells();
    };

    proto._setLoading = function (on) {
        this.loading = !!on;
        var $w = this.$table.parent('.jts-scroll');
        this.$table.toggleClass('jts-loading', this.loading);
        if (this.loading) this.$table.attr('aria-busy', 'true'); else this.$table.removeAttr('aria-busy');
        if ($w.length) {
            if (!this.$overlay) {
                this.$overlay = $('<div class="jts-loading-overlay" role="status" aria-live="polite"><span class="jts-spinner" aria-hidden="true"></span><span class="jts-loading-text"></span></div>');
                this.$overlay.find('.jts-loading-text').text(this.opts.labels.loading);
                $w.append(this.$overlay);
            }
            $w.toggleClass('jts-loading', this.loading);
        }
    };

    proto._removeOverlay = function () {
        if (this.$overlay) { this.$overlay.remove(); this.$overlay = null; }
        this.$table.parent('.jts-scroll').removeClass('jts-loading');
        this.$table.removeClass('jts-loading').removeAttr('aria-busy');
    };

    // ---- public (server mode); harmless in client mode

    proto.page = function (n) {
        if (n === undefined) return this._server() ? this._page : 1;
        if (!this._server()) return this;
        n = Math.max(1, parseInt(n, 10) || 1);
        if (this._total > 0) n = Math.min(n, this._pages());
        this._page = n;
        this._queue(true);
        return this;
    };

    proto.pageSize = function (n) {
        if (n === undefined) return this._pageSize;
        n = Math.max(1, parseInt(n, 10) || this._pageSize);
        this._pageSize = n;
        if (this._server()) { this._page = 1; this._queue(true); }
        return this;
    };

    // Server mode: fetch the current page again (even if nothing changed). Client mode: same as refresh().
    proto.reload = function () {
        if (!this._server()) return this.refresh();
        this._lastSig = null;
        this._queue(true);
        return this;
    };

    // Cancels a pending / running request.
    proto.abort = function () {
        clearTimeout(this.reqTimer);
        this.reqTimer = null;
        this.reqId++;
        if (this.xhr) { var x = this.xhr; this.xhr = null; x.abort(); }
        this._lastSig = null;
        if (this.loading) { this._setLoading(false); this.$table.trigger('tablesearch:abort'); }
        return this;
    };

    // ---------------------------------------------------------------- state / teardown

    proto.getState = function () {
        var self = this;
        var st = {
            filters: $.map(this.cols, function (c) {
                if (!c.filterable) return null;
                var act = [];
                $.each(c.conds, function (_, k) {
                    var v = $.trim(k.$input.val()), op = k.$select.val();
                    if (v || op === 'empty' || op === 'not_empty') act.push({ operator: op, value: v });
                });
                if (!act.length) return null;
                var f = { column: c.index, operator: act[0].operator, value: act[0].value };
                if (act.length > 1) { f.logic = self._logicOf(c); f.operator2 = act[1].operator; f.value2 = act[1].value; }
                return f;
            }),
            sort: { column: this.sort.col, direction: this.sort.dir },
            visibleRows: $.grep(self.rows, function (r) { return r.vis; }).length,
            totalRows: self._server() ? self._total : self.rows.length,
            processing: self.opts.processing
        };
        if (self._server()) {
            st.page = self._page; st.pageSize = self._pageSize; st.pages = self._pages(); st.loading = self.loading;
        }
        return st;
    };

    proto.destroy = function () {
        clearTimeout(this.timer);
        this.abort();
        $(this.table.tBodies[0]).children('.jts-msg-row').remove();
        this._removeOverlay();
        this._unbindOpen();
        this._cancelPosition();
        this._hideBackdrop();
        this.$table.off(this.ns);
        $(document).off(this.ns);
        $(window).off(this.ns);

        $.each(this.cols, function (_, c) { c.$th.removeAttr('aria-sort').html(c.origHtml); });

        for (var r = 0; r < this.rows.length; r++) {
            var cells = this.rows[r].el.cells;
            for (var k = 0; k < cells.length; k++) {
                var cell = cells[k];
                if (!cell.hasAttribute('data-jts-fmt')) continue;
                if ($.trim(cell.textContent) === cell.getAttribute('data-jts-fmt')) cell.textContent = cell.getAttribute('data-jts-orig');
                if (cell.hasAttribute('data-jts-sv')) cell.removeAttribute('data-sort-value');
                cell.removeAttribute('data-jts-fmt'); cell.removeAttribute('data-jts-orig'); cell.removeAttribute('data-jts-sv');
            }
        }

        this.sort = { col: -1, dir: null };
        for (var i = 0; i < this.rows.length; i++) { this.rows[i].el.style.display = ''; this.rows[i].vis = true; }
        this._applySort();

        // undo responsive additions (wrapper + class)
        if (this.wrapped && this.$table.parent().is('.jts-scroll')) this.$table.unwrap();
        this.wrapped = false;
        this.$table.removeClass('jts-table');

        this.$table.removeData(DATA_KEY);
    };

    // Resolves opts.defaultSortColumn (index or header text) and applies the initial sort.
    proto._applyDefaultSort = function () {
        var target = this.opts.defaultSortColumn;
        if (target === null || target === undefined || target === '') return;

        var ci = -1, i;

        if (typeof target === 'number') {
            ci = target;
        } else {
            // Match by header text (case-insensitive), first match wins
            var needle = String(target).trim().toLowerCase();
            for (i = 0; i < this.cols.length; i++) {
                if (this.cols[i].headerText.toLowerCase() === needle) { ci = i; break; }
            }
        }

        // Validate: column must exist and be sortable
        if (ci < 0 || ci >= this.cols.length || !this.cols[ci].sortable) return;

        var dir = String(this.opts.defaultSortDirection || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
        this._setSort(ci, dir);
    };

    // ---------------------------------------------------------------- plugin entry

    var PUBLIC_METHODS = { refresh: 1, applyFilters: 1, clearFilters: 1, clearSort: 1, getState: 1, destroy: 1, page: 1, pageSize: 1, reload: 1, abort: 1 };
    var GETTERS = { getState: 1, page: 1, pageSize: 1 };   // return a value (page / pageSize only when called without arguments)

    $.fn.tableSearch = function (arg) {
        if (typeof arg === 'string') {
            if (!PUBLIC_METHODS[arg]) throw new Error('tableSearch: unknown method "' + arg + '"');
            var result, args = Array.prototype.slice.call(arguments, 1);
            this.each(function () {
                var inst = $.data(this, DATA_KEY);
                if (!inst) return;
                var r = inst[arg].apply(inst, args);
                if (GETTERS[arg] && (arg === 'getState' || !args.length) && result === undefined) result = r;
            });
            return result === undefined ? this : result;
        }

        var options = $.extend(true, {}, $.fn.tableSearch.defaults, arg);
        if (arg && arg.debounce !== undefined && arg.debounceTime === undefined) options.debounceTime = arg.debounce;
        options.numericRegex = toGlobalRegex(options.numericRegex);
        options.debounceTime = Math.max(0, +options.debounceTime || 0);
        options.processing = String(options.processing).toLowerCase() === 'server' ? 'server' : 'client';
        options.pageSize = Math.max(1, parseInt(options.pageSize, 10) || 10);
        options.requestDebounce = Math.max(0, +options.requestDebounce || 0);
        return this.each(function () {
            if (this.tagName !== 'TABLE' || $.data(this, DATA_KEY)) return;
            $.data(this, DATA_KEY, new TableSearch(this, options));
        });
    };

    $.fn.tableSearch.defaults = DEFAULTS;
    $.fn.tableSearch.parseNumber = parseNumber;
    $.fn.tableSearch.parseDate = parseDate;
    $.fn.tableSearch.compileDateFormat = compileDateFormat;
    $.fn.tableSearch.formatDate = formatDate;

    return $;
});