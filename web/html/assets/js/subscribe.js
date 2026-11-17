/*
 * subscribe.js  (added for kubernetesproject2)
 * - Shows whether the API can reach MySQL (badge under the "Never miss any update" form)
 * - Sends the subscribe form to POST /api/subscribers, which stores the email in MySQL
 * The site works fine without MySQL: the badge just turns grey/red and the form explains why.
 */
(function () {
    var badge = document.getElementById('db-status');
    var countEl = document.getElementById('subscriber-count');
    var msg = document.getElementById('subscribe-msg');
    var form = document.getElementById('mc-form');
    var input = document.getElementById('mc-email');

    var COLORS = { connected: '#2e9e5b', 'not configured': '#6c757d', unreachable: '#c0392b', 'api offline': '#c0392b' };

    function setBadge(state, text) {
        if (!badge) return;
        badge.style.background = COLORS[state] || '#555';
        badge.textContent = text;
    }

    function refreshStatus() {
        fetch('/api/health')
            .then(function (r) { return r.json(); })
            .then(function (h) {
                if (h.database === 'connected') {
                    setBadge('connected', 'MySQL connected');
                    return fetch('/api/subscribers/count').then(function (r) { return r.json(); }).then(function (c) {
                        if (countEl) countEl.textContent = c.count + ' email(s) saved in MySQL';
                    });
                }
                if (countEl) countEl.textContent = '';
                if (h.database === 'not configured') setBadge('not configured', 'Running without MySQL (static mode)');
                else setBadge('unreachable', 'MySQL configured but unreachable');
            })
            .catch(function () {
                setBadge('api offline', 'API offline - static site only');
                if (countEl) countEl.textContent = '';
            });
    }

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = (input && input.value || '').trim();
            if (!email) { msg.textContent = 'Please enter your email.'; return; }
            msg.textContent = 'Saving...';
            fetch('/api/subscribers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            })
                .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
                .then(function (res) {
                    msg.textContent = res.body.message || (res.ok ? 'Saved!' : 'Something went wrong.');
                    if (res.ok && input) input.value = '';
                    refreshStatus();
                })
                .catch(function () { msg.textContent = 'API offline - cannot save right now.'; });
        });
    }

    refreshStatus();
    setInterval(refreshStatus, 10000);
})();
