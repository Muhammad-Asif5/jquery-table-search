/*
 * Demo data + an in-browser MOCK BACKEND for jquery.tableSearch / jquery.tablePager server mode.
 *
 * It registers a jQuery ajax transport for URLs starting with "mock://", so
 *     ajax: { url: 'mock://employees' }
 * behaves like a real endpoint (with latency), without any server. It is also the reference
 * implementation of the request contract a real backend has to follow:
 *
 *   POST body (JSON):
 *   {
 *     "page": 2, "pageSize": 5,                                  // 1-based page
 *     "sort": { "column": 0, "field": "name", "direction": "asc" } | null,
 *     "columnLogic": "and" | "or",                               // how filters of DIFFERENT columns combine
 *     "filters": [ {
 *         "column": 2, "field": "office", "type": "string|numeric|date",
 *         "logic": "and" | "or",                                 // how the 1-2 conditions of this column combine
 *         "conditions": [ { "operator": "contains", "value": "Tok" } ]
 *     } ]
 *   }
 *   operators: contains, not_contains, eq, neq, starts, ends, gt, gte, lt, lte, empty, not_empty
 *   date values are ISO "YYYY-MM-DD"; numeric values are numbers.
 *
 *   Response (JSON):  { "data": [ { ...row fields... } ], "total": 57 }     // total = ALL rows matching the filters
 */
(function ($) {
    'use strict';

    // ------------------------------------------------------------ data (deterministic)
    var names = ['Airi Satou', 'Angelica Ramos', 'Ashton Cox', 'Bradley Greer', 'Brenden Wagner', 'Brielle Williamson',
        'Bruno Nash', 'Caesar Vance', 'Cara Stevens', 'Cedric Kelly', 'Charde Marshall', 'Colleen Hurst', 'Dai Rios',
        'Donna Snider', 'Doris Wilder', 'Finn Camacho', 'Fiona Green', 'Garrett Winters', 'Gavin Cortez', 'Gavin Joyce',
        'Gloria Little', 'Haley Kennedy', 'Hermione Butler', 'Herrod Chandler', 'Hope Fuentes', 'Jackson Bradshaw',
        'Jena Gaines', 'Jenette Caldwell', 'Jennifer Chang', 'Jonas Alexander', 'Lael Greer', 'Martena Mccray',
        'Michael Bruce', 'Michelle House', 'Olivia Liang', 'Paul Byrd', 'Prescott Bartlett', 'Quinn Flynn',
        'Rhona Davidson', 'Sakura Yamamoto', 'Serge Baldwin', 'Shad Decker', 'Shou Itou', 'Sonya Frost', 'Suki Burks',
        'Sue Kortege', 'Tatyana Fitzpatrick', 'Thor Walton', 'Tiger Nixon', 'Timothy Mooney', 'Unity Butler',
        'Vivian Harrell', 'Yuri Berry', 'Zenaida Frank', 'Zorita Serrano', 'Ayesha Khan', 'Bilal Ahmed'];
    var positions = ['Accountant', 'Developer', 'Designer', 'Manager', 'Analyst', 'Support Engineer', 'Director', 'Sales Assistant'];
    var offices = ['Tokyo', 'London', 'New York', 'Islamabad', 'Peshawar', 'San Francisco', 'Edinburgh', 'Sydney'];

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    var ROWS = names.map(function (n, i) {
        var y = 2008 + (i * 7) % 12, m = 1 + (i * 5) % 12, d = 1 + (i * 11) % 28;
        return {
            id: i + 1,
            name: n,
            position: positions[(i * 3) % positions.length],
            office: i % 13 === 0 ? '' : offices[(i * 5) % offices.length],   // a few empty cells on purpose
            extn: 1000 + (i * 937) % 9000,
            start_date: y + '/' + pad(m) + '/' + pad(d),
            salary: 40000 + (i * 7919) % 260000
        };
    });

    // ------------------------------------------------------------ server-side logic
    function iso(s) { return String(s).replace(/\//g, '-'); }   // 2008/11/28 -> 2008-11-28

    function test(row, f, c) {
        var raw = row[f.field], v = c.value, a, b;
        var text = raw == null ? '' : String(raw);
        if (c.operator === 'empty') return text === '';
        if (c.operator === 'not_empty') return text !== '';
        if (f.type === 'numeric') { a = Number(raw); b = Number(v); }
        else if (f.type === 'date') { a = iso(text); b = String(v); }
        else { a = text.toLowerCase(); b = String(v).toLowerCase(); }
        switch (c.operator) {
            case 'contains': return a.indexOf(b) > -1;
            case 'not_contains': return a.indexOf(b) === -1;
            case 'starts': return a.lastIndexOf(b, 0) === 0;
            case 'ends': return a.length >= b.length && a.indexOf(b, a.length - b.length) !== -1;
            case 'eq': return a === b;
            case 'neq': return a !== b;
            case 'gt': return a > b;
            case 'gte': return a >= b;
            case 'lt': return a < b;
            case 'lte': return a <= b;
        }
        return true;
    }

    function query(req) {
        var rows = ROWS.slice(), filters = req.filters || [], orCols = req.columnLogic === 'or';
        if (filters.length) {
            rows = rows.filter(function (row) {
                var results = filters.map(function (f) {
                    var rs = f.conditions.map(function (c) { return test(row, f, c); });
                    return f.logic === 'or' ? rs.some(Boolean) : rs.every(Boolean);
                });
                return orCols ? results.some(Boolean) : results.every(Boolean);
            });
        }
        var s = req.sort;
        if (s && s.field) {
            var mul = s.direction === 'desc' ? -1 : 1, type = null;
            rows.sort(function (x, y) {
                var a = x[s.field], b = y[s.field], ea = a === '' || a == null, eb = b === '' || b == null;
                if (ea || eb) return ea && eb ? x.id - y.id : (ea ? 1 : -1);     // empty cells last
                if (typeof a === 'number') return (a - b) * mul || x.id - y.id;
                if (s.field === 'start_date') { a = iso(a); b = iso(b); }
                return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }) * mul || x.id - y.id;
            });
        }
        var total = rows.length, size = Math.max(1, req.pageSize | 0), page = Math.max(1, req.page | 0);
        return { data: rows.slice((page - 1) * size, page * size), total: total };
    }

    // ------------------------------------------------------------ jQuery transport for mock://
    var MockServer = window.MockServer = {
        latency: 350,        // ms
        failNext: 0,         // set to N to make the next N requests fail with HTTP 500
        requests: [],        // log of the received bodies (handy in the console)
        rows: ROWS
    };

    $.ajaxTransport('json', function (options) {
        if (!/^mock:\/\//.test(options.url)) return;
        var timer;
        return {
            send: function (headers, complete) {
                var body = {};
                try { body = options.data ? (typeof options.data === 'string' && options.data.charAt(0) === '{' ? JSON.parse(options.data) : {}) : {}; } catch (e) { }
                if (options.type === 'GET' || !body.page) {   // query-string / form requests
                    var q = new URLSearchParams(typeof options.data === 'string' && options.data.charAt(0) !== '{' ? options.data : (options.url.split('?')[1] || ''));
                    if (q.has('page')) body = { page: +q.get('page'), pageSize: +q.get('pageSize') };
                }
                MockServer.requests.push(body);
                timer = setTimeout(function () {
                    if (MockServer.failNext > 0) { MockServer.failNext--; complete(500, 'Internal Server Error', {}); return; }
                    complete(200, 'OK', { text: JSON.stringify(query(body)) });
                }, MockServer.latency);
            },
            abort: function () { clearTimeout(timer); }
        };
    });
})(window.jQuery);
