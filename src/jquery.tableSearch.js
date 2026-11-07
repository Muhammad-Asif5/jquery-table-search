/*!
 * jQuery tableSearch 2.0
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
 * Per-column override of the icon options: <th data-sortable="false"> / <th data-filterable="false">
 * (also works as "true" to enable on a column when the global option is off).
 * Currency columns: <th data-currency> (uses the global currencySymbol) or <th data-currency="Rs"> (own symbol).
 * The column becomes numeric, its cells are shown as symbol + grouped number, and the filter field shows the symbol.
 * Per-column override of the logic radios: <th data-logic="false"> / <th data-logic="true"> turns the radios (and 2nd condition) off / on for that column.
 * Optional per-cell override for sorting/filtering: <td data-sort-value="...">.
 *
 * Events on the table: "tablesearch:filter" ({visible,total}), "tablesearch:sort" ({column,direction}).
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

        this._build();
        this._bind();
        this.refresh();
        this._applyDefaultSort();
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
            var col = {
                index: index, type: type, currency: currency, $th: $th, origHtml: $th.html(), headerText: headerText,
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

        $(window).on('resize' + ns, function () {
            if (self.openCol > -1) self._position(self.cols[self.openCol]);
        });
    };

    // ---------------------------------------------------------------- popup UI

    proto._position = function (col) {
        var $p = col.$popup;
        $p.css({ left: 'auto', right: '0' });
        var right = $p[0].getBoundingClientRect().right;
        if (right > document.documentElement.clientWidth) $p.css({ left: '0', right: 'auto' });
    };

    proto._togglePopup = function (col) {
        var wasOpen = this.openCol === col.index;
        this._closePopups();
        if (wasOpen) return;
        col.$popup.addClass('active');
        col.$filterBtn.attr('aria-expanded', 'true');
        this.openCol = col.index;
        this._position(col);
        col.$input.trigger('focus');
    };

    proto._closePopups = function () {
        $.each(this.cols, function (_, c) {
            c.$popup.removeClass('active');
            c.$filterBtn.attr('aria-expanded', 'false');
        });
        this.openCol = -1;
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

    proto.refresh = function () {
        var tbody = this.table.tBodies[0];
        var trs = tbody ? tbody.rows : [];
        var old = this.rowMap, map = new Map(), rows = [];

        for (var i = 0; i < trs.length; i++) {
            var tr = trs[i], r = old.get(tr);
            if (!r) r = { el: tr, idx: this.nextIdx++, cache: [], vis: tr.style.display !== 'none' };
            else r.cache = [];
            map.set(tr, r);
            rows.push(r);
        }
        this.rowMap = map;
        this.rows = rows;

        this._formatCurrencyCells();
        this._checkDateColumns();
        this.applyFilters();
        if (this.sort.col > -1) this._applySort();
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

        var info = { visible: visible, total: rows.length };
        this.$table.trigger('tablesearch:filter', [info]);
        if (typeof this.opts.onFilter === 'function') this.opts.onFilter.call(this.table, info);
        return this;
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
        var info = { column: ci, direction: dir };
        this.$table.trigger('tablesearch:sort', [info]);
        if (typeof this.opts.onSort === 'function') this.opts.onSort.call(this.table, info);
    };

    proto._applySort = function () {
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

    // ---------------------------------------------------------------- state / teardown

    proto.getState = function () {
        var self = this;
        return {
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
            totalRows: self.rows.length
        };
    };

    proto.destroy = function () {
        clearTimeout(this.timer);
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

    var PUBLIC_METHODS = { refresh: 1, applyFilters: 1, clearFilters: 1, clearSort: 1, getState: 1, destroy: 1 };

    $.fn.tableSearch = function (arg) {
        if (typeof arg === 'string') {
            if (!PUBLIC_METHODS[arg]) throw new Error('tableSearch: unknown method "' + arg + '"');
            var result;
            this.each(function () {
                var inst = $.data(this, DATA_KEY);
                if (!inst) return;
                var r = inst[arg]();
                if (arg === 'getState' && result === undefined) result = r;
            });
            return result === undefined ? this : result;
        }

        var options = $.extend(true, {}, $.fn.tableSearch.defaults, arg);
        if (arg && arg.debounce !== undefined && arg.debounceTime === undefined) options.debounceTime = arg.debounce;
        options.numericRegex = toGlobalRegex(options.numericRegex);
        options.debounceTime = Math.max(0, +options.debounceTime || 0);
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