/*!
 * jQuery tablePager 2.0
 * Pagination for HTML tables with two data modes, chosen by configuration:
 *
 *   processing: 'client'  all rows are in the DOM; the pager shows one slice at a time.
 *                         Works with tableSearch (filter + sort) or standalone.
 *   processing: 'server'  the server returns one page at a time.
 *                         - Paired with tableSearch in server mode (recommended): the pager only drives
 *                           tableSearch (page / pageSize / reload) and renders its state, so filter + sort +
 *                           page travel in ONE request.
 *                         - Standalone (no tableSearch on the table): the pager does its own AJAX call.
 *   processing: 'auto'   (default) 'server' when tableSearch on the same table is in server mode, else 'client'.
 *                         tableSearch must be initialised first for this; otherwise set processing explicitly.
 *
 * Client mode, paired with tableSearch:
 *   $('#t').tableSearch({ dateFormat: 'YYYY/MM/DD' });
 *   $('#t').tablePager({ pageSize: 10 });
 *
 * Server mode, paired with tableSearch (one request carries page + pageSize + sort + filters):
 *   $('#t').tableSearch({ processing: 'server', pageSize: 10, ajax: { url: '/api/people' } });
 *   $('#t').tablePager({ processing: 'server', pageSize: 10 });
 *
 * Server mode, standalone (the pager sends { page, pageSize } and renders the rows from the response):
 *   $('#t').tablePager({ processing: 'server', pageSize: 10,
 *       ajax: { url: '/api/people', method: 'GET' },
 *       responseMap: { rows: 'data', total: 'total' } });          // rows are mapped through <th data-field="...">
 *
 * Public methods:
 *   $('#t').tablePager('page', 3);       // go to page 3
 *   $('#t').tablePager('page');          // -> current page number
 *   $('#t').tablePager('pageSize', 25);  // change page size (goes back to page 1)
 *   $('#t').tablePager('pageSize');      // -> current page size
 *   $('#t').tablePager('pages');         // -> total page count
 *   $('#t').tablePager('total');         // -> total rows (all matching rows, not only this page)
 *   $('#t').tablePager('refresh');       // client: re-collect rows + repaint; server: fetch the current page again
 *   $('#t').tablePager('reload');        // alias of refresh
 *   $('#t').tablePager('show');          // enable paging UI (+ row slicing in client mode)
 *   $('#t').tablePager('hide');          // client: show all rows, hide the UI; server: hides the UI only
 *   $('#t').tablePager('getState');      // -> { enabled, processing, page, pageSize, pages, total, from, to, loading }
 *   $('#t').tablePager('destroy');       // remove handlers, restore DOM
 *
 * Options (defaults):
 *   enabled: true
 *   processing: 'auto'       // 'auto' | 'client' | 'server'
 *   pageSize: null           // rows per page. null = 10 (server + tableSearch: adopt tableSearch's pageSize)
 *   pageSizes: [5,10,25,50]  // dropdown choices (the current pageSize is added if missing)
 *   pager: null              // selector / element / jQuery for the pager container; null = auto-build after the table
 *   autoBuildPager: true
 *   showPageSizeSelect: true, showInfo: true, showPageLabel: true, showFirstLast: false
 *   showPageNumbers: false   // numbered buttons (1 2 3 ... 20) between Prev and Next
 *   maxPageButtons: 7        // max numbered buttons incl. first/last/ellipses (min 5)
 *   resetPageOnFilter: true  // back to page 1 whenever the filter changes (applied to tableSearch in server mode too)
 *   resetPageOnSort: false   // keep the current page when the sort changes
 *   rowSelector: null        // client: override how pageable <tr> are found (function | selector)
 *   initialLoad: true        // standalone server mode: fetch the first page on init (false = keep the rows in the table)
 *   ajax: {                  // standalone server mode only (paired mode uses tableSearch's ajax settings)
 *       url, method: 'POST', contentType: 'json' | 'form', dataType: 'json', headers, timeout, cache,
 *       data: object | function (request, plugin) -> object, settings: {extra $.ajax settings},
 *       paramNames: { page: 'page', pageSize: 'pageSize' } }
 *   responseMap: { rows: 'data', total: 'total' }   // dot paths, or function (json) -> { rows, total }
 *   renderRow: null          // standalone server mode: function (row, index) -> <tr> | jQuery | html string
 *   labels: { info(from,to,total), page(page,pages), prev, next, first, last, loading, noData, error, retry }
 *   onChange: null           // function (info) {} after every repaint
 *   onLoad / onError: null   // standalone server mode callbacks
 *
 * Events on the table:
 *   "tablepager:change"  ({ page, pageSize, pages, total, from, to, enabled, processing, loading })
 *   "tablepager:request" (request)         standalone server mode
 *   "tablepager:error"   ({ status, error, xhr })   standalone server mode
 *
 * Rows hidden by the pager (client mode) get the class "jts-page-hidden"; the plugin injects
 * `.jts-page-hidden { display: none !important }` itself, so no extra CSS is required.
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

    var DATA_KEY = 'tablePager';
    var SEARCH_KEY = 'tableSearch';
    var HIDDEN = 'jts-page-hidden';
    var uid = 0;

    var DEFAULTS = {
        enabled: true,
        processing: 'auto',
        pageSize: null,
        pageSizes: [5, 10, 25, 50],
        pager: null,
        autoBuildPager: true,
        showPageSizeSelect: true,
        showInfo: true,
        showPageLabel: true,
        showFirstLast: false,
        showPageNumbers: false,
        maxPageButtons: 7,
        resetPageOnFilter: true,
        resetPageOnSort: false,
        rowSelector: null,
        initialLoad: true,
        ajax: {
            url: null,
            method: 'POST',
            contentType: 'json',
            dataType: 'json',
            headers: null,
            timeout: 0,
            cache: false,
            data: null,
            settings: null,
            paramNames: { page: 'page', pageSize: 'pageSize' }
        },
        responseMap: { rows: 'data', total: 'total' },
        renderRow: null,
        labels: {
            info: function (from, to, total) { return 'Showing ' + from + '-' + to + ' of ' + total; },
            page: function (page, pages) { return 'Page ' + page + ' / ' + pages; },
            prev: 'Prev',
            next: 'Next',
            first: 'First',
            last: 'Last',
            loading: 'Loading...',
            noData: 'No records found',
            error: 'Could not load data.',
            retry: 'Retry'
        },
        onChange: null,
        onLoad: null,
        onError: null
    };

    function injectStyle() {
        if (document.getElementById('jts-pager-style')) return;
        var st = document.createElement('style');
        st.id = 'jts-pager-style';
        st.textContent = '.' + HIDDEN + '{display:none !important}';
        (document.head || document.documentElement).appendChild(st);
    }

    function pick(obj, path) {
        if (obj == null || path == null || path === '') return undefined;
        var p = String(path).split('.');
        for (var i = 0; i < p.length; i++) { if (obj == null) return undefined; obj = obj[p[i]]; }
        return obj;
    }

    function TablePager(table, options) {
        this.table = table;
        this.$table = $(table);
        this.opts = options;
        this.ns = '.tablePager' + (++uid);

        this.mode = this._detectMode();
        this.enabled = !!options.enabled;

        // state. NB: underscore names, so they never shadow the public methods page() / pageSize() / pages() / total()
        var ts = this._search();
        var st = (this.mode === 'server' && ts) ? ts.getState() : null;
        this._pageSize = Math.max(1, parseInt(options.pageSize, 10) || (st && st.pageSize) || 10);
        this._page = (st && st.page) || 1;
        this._total = st ? (st.totalRows || 0) : 0;
        this._pages = 1;
        this._all = [];          // client: every pageable row
        this.visible = [];       // client: rows not hidden by the filter
        this._loading = false;
        this._flagsSynced = false;
        this._xhr = null;
        this._reqId = 0;

        this.$pager = null;
        this.built = false;
        this._ui = {};

        injectStyle();
        this._resolvePager();
        this._bind();

        if (this.mode === 'client') {
            this.refresh();
        } else {
            this._calc();
            this._attach();
            this._paint();
            if (!this._delegate()) {
                if (options.initialLoad && options.ajax && options.ajax.url) this._fetch();
                else { this._total = this._bodyRows().length; this._calc(); this._paint(); }
            }
        }
    }

    var proto = TablePager.prototype;

    /* -------------------------------------------------------------- mode + tableSearch link */

    proto._detectMode = function () {
        var p = String(this.opts.processing || 'auto').toLowerCase();
        if (p === 'client' || p === 'server') return p;
        var ts = $.data(this.table, SEARCH_KEY);
        return (ts && ts.opts && ts.opts.processing === 'server') ? 'server' : 'client';
    };

    // tableSearch instance of this table (any mode), looked up lazily so init order does not matter
    proto._search = function () { return $.data(this.table, SEARCH_KEY) || null; };

    // tableSearch instance to delegate to: only in server mode, and only if tableSearch is in server mode too
    proto._delegate = function () {
        if (this.mode !== 'server') return null;
        var ts = this._search();
        return (ts && ts.opts && ts.opts.processing === 'server') ? ts : null;
    };

    // Paired server mode: the pager owns the paging policy, and makes tableSearch use the same page size.
    proto._attach = function () {
        var ts = this._delegate();
        if (!ts || this._flagsSynced) return;
        this._flagsSynced = true;
        ts.opts.resetPageOnFilter = !!this.opts.resetPageOnFilter;
        ts.opts.resetPageOnSort = !!this.opts.resetPageOnSort;
        if (ts.getState().pageSize !== this._pageSize) ts.pageSize(this._pageSize);
    };

    /* -------------------------------------------------------------- pager container + UI */

    proto._resolvePager = function () {
        var opts = this.opts, $p;
        if (opts.pager != null) {
            $p = $(opts.pager).first();
        } else if (opts.autoBuildPager) {
            var id = 'jts-pager-' + this.ns.replace(/\W/g, '');
            $p = $('<div class="jts-pager d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2"></div>').attr('id', id);
            this.$table.after($p);
            this.built = true;
        } else {
            $p = $();
        }
        this.$pager = $p;
        if ($p.length) this._buildPagerUi();
    };

    proto._buildPagerUi = function () {
        var self = this, L = this.opts.labels, $p = this.$pager;
        $p.empty();

        this._ui.$info = $('<div class="small text-muted jts-pager-info" aria-live="polite"></div>')
            .toggle(!!this.opts.showInfo).appendTo($p);

        var $ctrl = $('<div class="d-flex flex-wrap align-items-center gap-2 jts-pager-controls" role="navigation" aria-label="Pagination"></div>').appendTo($p);

        if (this.opts.showPageSizeSelect) {
            this._ui.$size = $('<select class="form-select form-select-sm jts-pager-size" style="width:auto" aria-label="Rows per page"></select>')
                .on('change', function () { self.pageSize(parseInt(this.value, 10) || self._pageSize); });
            $ctrl.append(this._ui.$size);
        }

        var btn = function (cls, text, fn) {
            return $('<button type="button" class="btn btn-sm btn-outline-secondary"></button>')
                .addClass(cls).text(text).on('click', fn);
        };

        if (this.opts.showFirstLast) this._ui.$first = btn('jts-pager-first', L.first, function () { self.page(1); }).appendTo($ctrl);
        this._ui.$prev = btn('jts-pager-prev', L.prev, function () { self.page(self._page - 1); }).appendTo($ctrl);

        if (this.opts.showPageNumbers) {
            this._ui.$nums = $('<div class="btn-group btn-group-sm jts-pager-nums" role="group" aria-label="Pages"></div>')
                .on('click', '.jts-pager-num', function () { self.page(parseInt($(this).attr('data-page'), 10)); })
                .appendTo($ctrl);
        }
        if (this.opts.showPageLabel) this._ui.$label = $('<span class="small jts-pager-label"></span>').appendTo($ctrl);

        this._ui.$next = btn('jts-pager-next', L.next, function () { self.page(self._page + 1); }).appendTo($ctrl);
        if (this.opts.showFirstLast) this._ui.$last = btn('jts-pager-last', L.last, function () { self.page(self._pages); }).appendTo($ctrl);

        this._syncSizeOptions();
        this._syncVisibility();
    };

    proto._syncSizeOptions = function () {
        if (!this._ui.$size) return;
        var sizes = this.opts.pageSizes.slice();
        if (sizes.indexOf(this._pageSize) === -1) sizes.push(this._pageSize);
        sizes.sort(function (a, b) { return a - b; });
        var $s = this._ui.$size.empty();
        sizes.forEach(function (s) { $s.append($('<option>').val(s).text(s)); });
        $s.val(this._pageSize);
    };

    proto._syncVisibility = function () {
        if (this.$pager && this.$pager.length) this.$pager.toggle(!!this.enabled);
        if (!this.enabled && this.mode === 'client') this._unhideAll();
    };

    proto._unhideAll = function () {
        this.$table.children('tbody').children('tr.' + HIDDEN).removeClass(HIDDEN);
    };

    // Numbered buttons: 1 2 3 4 5 ... 20 | 1 ... 8 9 10 ... 20 | 1 ... 16 17 18 19 20
    proto._pageList = function () {
        var n = this._pages, c = this._page, max = Math.max(5, parseInt(this.opts.maxPageButtons, 10) || 7), out = [], i;
        if (n <= max) { for (i = 1; i <= n; i++) out.push(i); return out; }
        var head = max - 3, w = max - 4;
        if (c <= head) {
            for (i = 1; i <= max - 2; i++) out.push(i);
            out.push('...', n);
        } else if (c >= n - head + 1) {
            out.push(1, '...');
            for (i = n - (max - 2) + 1; i <= n; i++) out.push(i);
        } else {
            var start = c - Math.floor(w / 2);
            out.push(1, '...');
            for (i = start; i < start + w; i++) out.push(i);
            out.push('...', n);
        }
        return out;
    };

    /* -------------------------------------------------------------- counters */

    proto._calc = function () {
        this._pages = this._total > 0 ? Math.max(1, Math.ceil(this._total / this._pageSize)) : 1;
        if (this._page > this._pages) this._page = this._pages;
        if (this._page < 1) this._page = 1;
    };

    proto._range = function () {
        var from = this._total ? (this._page - 1) * this._pageSize + 1 : 0;
        var to = Math.min(this._page * this._pageSize, this._total);
        return { from: from, to: to };
    };

    proto._info = function () {
        var r = this._range();
        return {
            page: this._page, pageSize: this._pageSize, pages: this._pages, total: this._total,
            from: r.from, to: r.to, enabled: this.enabled, processing: this.mode, loading: this._loading
        };
    };

    /* -------------------------------------------------------------- client mode: rows */

    proto._bodyRows = function () {
        var $tbody = this.$table.children('tbody').first();
        if (!$tbody.length) return [];
        var rs = this.opts.rowSelector, $rows;
        if (typeof rs === 'function') $rows = $(rs.call(this.table));
        else if (rs) $rows = $tbody.children(rs);
        else $rows = $tbody.children('tr');
        return $rows.filter(function () { return !$(this).hasClass('jts-msg-row'); }).get();
    };

    proto._collect = function () {
        this._all = this._bodyRows();
        // Visible = not hidden by the filter (inline style). The pager hides with a CSS class, so the two never clash.
        this.visible = this._all.filter(function (tr) { return tr.style.display !== 'none'; });
        this._total = this.visible.length;
        this._calc();
    };

    /* -------------------------------------------------------------- render */

    proto._render = function () {
        if (!this.enabled) { this._syncVisibility(); return this; }
        if (this.mode === 'client') {
            var all = this._all, i;
            for (i = 0; i < all.length; i++) all[i].classList.add(HIDDEN);
            var start = (this._page - 1) * this._pageSize, end = Math.min(start + this._pageSize, this._total);
            for (i = start; i < end; i++) this.visible[i].classList.remove(HIDDEN);
        }
        this._paint();
        this._emitChange();
        return this;
    };

    proto._paint = function () {
        if (!this.$pager || !this.$pager.length) return;
        var ui = this._ui, L = this.opts.labels, r = this._range(), busy = this._loading;
        var atFirst = this._page <= 1, atLast = this._page >= this._pages;

        if (ui.$info) ui.$info.text(busy && !this._total ? L.loading : L.info(r.from, r.to, this._total));
        if (ui.$label) ui.$label.text(L.page(this._page, this._pages));
        if (ui.$prev) ui.$prev.prop('disabled', busy || atFirst);
        if (ui.$next) ui.$next.prop('disabled', busy || atLast);
        if (ui.$first) ui.$first.prop('disabled', busy || atFirst);
        if (ui.$last) ui.$last.prop('disabled', busy || atLast);
        if (ui.$size) ui.$size.prop('disabled', busy);
        this.$pager.attr('aria-busy', busy ? 'true' : 'false');

        if (ui.$nums) {
            var $n = ui.$nums.empty(), cur = this._page;
            $.each(this._pageList(), function (_, p) {
                if (p === '...') {
                    $('<button type="button" class="btn btn-sm btn-outline-secondary" disabled></button>').text('\u2026').appendTo($n);
                    return;
                }
                $('<button type="button" class="btn btn-sm jts-pager-num"></button>')
                    .addClass(p === cur ? 'btn-primary active' : 'btn-outline-secondary')
                    .attr('data-page', p).attr(p === cur ? { 'aria-current': 'page' } : {})
                    .prop('disabled', busy).text(p).appendTo($n);
            });
        }
    };

    proto._emitChange = function () {
        var info = this._info();
        this.$table.trigger('tablepager:change', [info]);
        if (typeof this.opts.onChange === 'function') this.opts.onChange.call(this.table, info);
    };

    /* -------------------------------------------------------------- events */

    proto._bind = function () {
        var self = this, ns = this.ns;

        if (this.mode === 'client') {
            this.$table
                .on('tablesearch:filter' + ns, function () {
                    if (self.opts.resetPageOnFilter) self._page = 1;
                    self.refresh();
                })
                .on('tablesearch:sort' + ns, function () {
                    if (self.opts.resetPageOnSort) self._page = 1;
                    self.refresh();
                });
            return;
        }

        // server mode + tableSearch: mirror its state
        this.$table
            .on('tablesearch:request' + ns, function () {
                if (!self._delegate()) return;
                self._attach();
                self._loading = true;
                self._paint();
            })
            .on('tablesearch:load' + ns, function (e, info) {
                if (!self._delegate()) return;
                self._loading = false;
                self._page = info.page; self._pageSize = info.pageSize; self._total = info.total;
                self._calc();
                self._syncSizeOptions();
                self._render();
            })
            .on('tablesearch:error' + ns + ' tablesearch:abort' + ns, function () {
                if (!self._delegate()) return;
                self._loading = false;
                self._paint();
                self._emitChange();
            });

        // standalone server mode: retry link of the error row
        this.$table.on('click' + ns, '.jts-pager-retry', function (e) {
            e.preventDefault();
            if (!self._delegate()) self._fetch();
        });
    };

    /* -------------------------------------------------------------- standalone server mode (own AJAX) */

    proto._setLoading = function (on) {
        this._loading = !!on;
        this.$table.toggleClass('jts-loading', this._loading);
        if (this._loading) this.$table.attr('aria-busy', 'true'); else this.$table.removeAttr('aria-busy');
        this._paint();
    };

    proto._fetch = function () {
        var self = this, cfg = this.opts.ajax || {}, pn = cfg.paramNames || {};
        if (!cfg.url) throw new Error('tablePager: processing "server" without tableSearch requires ajax.url');

        var req = {};
        req[pn.page || 'page'] = this._page;
        req[pn.pageSize || 'pageSize'] = this._pageSize;
        var d = cfg.data;
        if (typeof d === 'function') { var r = d.call(this.table, req, this); if (r && typeof r === 'object') req = r; }
        else if (d && typeof d === 'object') req = $.extend({}, req, d);

        var method = String(cfg.method || 'POST').toUpperCase();
        var asJson = method !== 'GET' && String(cfg.contentType).toLowerCase() !== 'form';
        var id = ++this._reqId;
        if (this._xhr) { var old = this._xhr; this._xhr = null; old.abort(); }

        var settings = $.extend({}, cfg.settings, {
            url: typeof cfg.url === 'function' ? cfg.url(req) : cfg.url,
            type: method,
            dataType: cfg.dataType || 'json',
            headers: cfg.headers || undefined,
            timeout: cfg.timeout || 0,
            cache: !!cfg.cache,
            data: asJson ? JSON.stringify(req) : req
        });
        if (asJson) settings.contentType = 'application/json; charset=utf-8';

        this._setLoading(true);
        this.$table.trigger('tablepager:request', [req]);

        var xhr = this._xhr = $.ajax(settings);
        xhr.done(function (json) {
            if (id !== self._reqId) return;
            self._xhr = null;
            self._onLoad(json, xhr);
            if (id === self._reqId) self._setLoading(false);
        }).fail(function (jq, status, err) {
            if (id !== self._reqId || status === 'abort') return;
            self._xhr = null;
            self._onFetchError(jq, status, err);
            self._setLoading(false);
        });
    };

    proto._mapResponse = function (json) {
        var m = this.opts.responseMap, r;
        if (typeof m === 'function') r = m.call(this.table, json, this) || {};
        else r = { rows: pick(json, m && m.rows), total: pick(json, m && m.total) };
        if (r.rows === undefined && Array.isArray(json)) r.rows = json;
        return r;
    };

    proto._columns = function () {
        return this.$table.children('thead').find('tr').last().children('th').map(function () {
            return $(this).attr('data-field') || null;
        }).get();
    };

    proto._toRow = function (row, i, fields) {
        var out;
        if (typeof this.opts.renderRow === 'function') {
            out = this.opts.renderRow.call(this.table, row, i, this);
            if (typeof out === 'string') out = $('<tbody></tbody>').html(out).children('tr')[0];
            else if (out && out.jquery) out = out[0];
            if (!out || out.nodeType !== 1) throw new Error('tablePager: renderRow must return a <tr>');
            return out;
        }
        out = document.createElement('tr');
        for (var c = 0; c < fields.length; c++) {
            var v = Array.isArray(row) ? row[c] : (fields[c] ? pick(row, fields[c]) : undefined);
            var td = document.createElement('td');
            td.textContent = v == null ? '' : String(v);
            out.appendChild(td);
        }
        return out;
    };

    proto._msgRow = function (text, cls, retry) {
        var tr = document.createElement('tr'), td = document.createElement('td');
        tr.className = 'jts-msg-row ' + cls;
        td.colSpan = Math.max(1, this._columns().length);
        td.className = 'jts-msg-cell text-center text-muted py-4';
        td.textContent = text;
        if (retry) {
            var a = document.createElement('a');
            a.href = '#'; a.className = 'jts-pager-retry'; a.textContent = this.opts.labels.retry;
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
    };

    proto._onLoad = function (json, xhr) {
        var rows, total, nodes = [], fields = this._columns(), i;
        try {
            var m = this._mapResponse(json);
            rows = m.rows;
            if (!Array.isArray(rows)) throw new Error('tablePager: response has no rows array (check responseMap)');
            total = m.total == null ? NaN : +m.total;
            if (total !== total) total = (this._page - 1) * this._pageSize + rows.length;
            if (!rows.length && total > 0 && this._page > 1) {    // page past the end: go to the last one
                var last = Math.max(1, Math.ceil(total / this._pageSize));
                if (last < this._page) { this._page = last; this._total = total; this._fetch(); return; }
            }
            for (i = 0; i < rows.length; i++) nodes.push(this._toRow(rows[i], i, fields));
            if (!nodes.length) nodes.push(this._msgRow(this.opts.labels.noData, 'jts-empty-row'));
            this._total = total;
            this._setBody(nodes);
        } catch (e) {
            this._onFetchError(xhr, 'parsererror', e.message);
            return;
        }
        this._calc();
        this._loading = false;
        this._render();
        if (typeof this.opts.onLoad === 'function') this.opts.onLoad.call(this.table, { rows: rows.length, total: total, page: this._page, pageSize: this._pageSize, pages: this._pages, response: json });
    };

    proto._onFetchError = function (xhr, status, err) {
        this._total = 0;
        this._calc();
        this._setBody([this._msgRow(this.opts.labels.error, 'jts-error-row', true)]);
        this._paint();
        var info = { status: status, error: err, xhr: xhr };
        this.$table.trigger('tablepager:error', [info]);
        if (typeof this.opts.onError === 'function') this.opts.onError.call(this.table, info);
    };

    /* -------------------------------------------------------------- public */

    proto.refresh = function () {
        if (this.mode === 'client') { this._collect(); return this._render(); }
        var ts = this._delegate();
        if (ts) ts.reload(); else this._fetch();
        return this;
    };
    proto.reload = proto.refresh;

    proto.page = function (n) {
        if (n === undefined) return this._page;
        if (!this.enabled) return this;
        n = Math.max(1, parseInt(n, 10) || 1);
        if (this._total > 0 && n > this._pages) n = this._pages;
        if (n === this._page && this.mode === 'client') return this;

        if (this.mode === 'client') { this._page = n; return this._render(); }
        if (this._loading && n === this._page) return this;
        this._page = n;
        var ts = this._delegate();
        if (ts) ts.page(n); else this._fetch();
        return this;
    };

    proto.pageSize = function (n) {
        if (n === undefined) return this._pageSize;
        n = Math.max(1, parseInt(n, 10) || this._pageSize);
        if (n === this._pageSize) return this;
        this._pageSize = n;
        this._page = 1;
        this._syncSizeOptions();

        if (this.mode === 'client') { this._calc(); return this._render(); }
        var ts = this._delegate();
        if (ts) ts.pageSize(n); else this._fetch();
        return this;
    };

    proto.pages = function () { if (this.mode === 'client') this._collect(); return this._pages; };
    proto.total = function () { if (this.mode === 'client') this._collect(); return this._total; };

    proto.show = function () {
        if (this.enabled) return this;
        this.enabled = true;
        this._syncVisibility();
        this._page = 1;
        return this.mode === 'client' ? this.refresh() : (this._paint(), this._emitChange(), this);
    };

    proto.hide = function () {
        if (!this.enabled) return this;
        this.enabled = false;
        this._syncVisibility();
        this._emitChange();
        return this;
    };

    proto.getState = function () {
        if (this.mode === 'client') this._collect();
        var i = this._info();
        return { enabled: i.enabled, processing: i.processing, page: i.page, pageSize: i.pageSize, pages: i.pages, total: i.total, from: i.from, to: i.to, loading: i.loading };
    };

    proto.destroy = function () {
        this._reqId++;
        if (this._xhr) { var x = this._xhr; this._xhr = null; x.abort(); }
        this.$table.off(this.ns).removeClass('jts-loading').removeAttr('aria-busy');
        this._unhideAll();
        if (this.built && this.$pager && this.$pager.length) this.$pager.remove();
        else if (this.$pager && this.$pager.length) this.$pager.empty();
        this.$pager = null;
        this._ui = {};
        this.built = false;
        this._all = [];
        this.visible = [];
        this._total = 0;
        this._pages = 1;
        this.$table.removeData(DATA_KEY);
    };

    /* -------------------------------------------------------------- plugin entry */

    var METHODS = {
        refresh: 1, reload: 1,
        page: 1, pageSize: 1, pages: 1, total: 1,
        show: 1, hide: 1,
        getState: 1, destroy: 1
    };
    var GETTERS = { page: 1, pageSize: 1, pages: 1, total: 1, getState: 1 };

    $.fn.tablePager = function (arg) {
        if (typeof arg === 'string') {
            if (!METHODS[arg]) throw new Error('tablePager: unknown method "' + arg + '"');
            var args = Array.prototype.slice.call(arguments, 1);
            var result;
            this.each(function () {
                var inst = $.data(this, DATA_KEY);
                if (!inst) return;
                var r = inst[arg].apply(inst, args);
                if (GETTERS[arg] && (arg === 'getState' || !args.length) && result === undefined) result = r;
            });
            return result === undefined ? this : result;
        }

        var options = $.extend(true, {}, $.fn.tablePager.defaults, arg);
        if (arg && arg.pageSizes) options.pageSizes = arg.pageSizes.slice();   // arrays replace, never merge
        if (!Array.isArray(options.pageSizes)) options.pageSizes = DEFAULTS.pageSizes.slice();
        options.pageSizes = options.pageSizes.map(function (n) { return parseInt(n, 10); }).filter(function (n) { return n > 0; });

        return this.each(function () {
            if (this.tagName !== 'TABLE' || $.data(this, DATA_KEY)) return;
            $.data(this, DATA_KEY, new TablePager(this, options));
        });
    };

    $.fn.tablePager.defaults = DEFAULTS;

    return $;
});