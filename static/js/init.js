document.querySelectorAll('.toast-item').forEach(t => {
    setTimeout(() => {
        t.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => t.remove(), 300);
    }, 5000);
});

window._showRouteIcons = tmPref('showRouteIcons');
_tmAdoptLocalPrefs();
_tmSyncViewIcons();
document.addEventListener('mousedown', e => { _backdropMd = e.target; });

['appModal','mwModal'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('click', function(e) { _onBackdropClick(e, () => this.style.display = 'none'); });
});

document.addEventListener('click', () => _closeRouteMenu());

document.addEventListener('click', e => {
    if (!e.target.closest('.live-dd')) {
        document.querySelectorAll('.live-dd-menu.open').forEach(m => m.classList.remove('open'));
        document.querySelectorAll('.live-dd-btn-inner.open').forEach(b => b.classList.remove('open'));
    }
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (_closeTopModal()) return;
        closeRouteDetail();
        closeMwDetail();
        closeSvcDetail();
        closePluginDetail();
        if (_shortcutsPanelOpen) { _shortcutsPanelOpen = false; document.getElementById('shortcutsPanel')?.classList.remove('open'); const b = document.getElementById('shortcutsBellBtn'); if (b) b.style.color = ''; }
    }
    if (_isTyping() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.shiftKey) {
        switch (e.key) {
            case 'N': e.preventDefault(); openModal(); break;
            case 'M': e.preventDefault(); openMwModal(); break;
            case 'F': {
                const el = document.querySelector('.tab-content.active input[type="search"], .tab-content.active input[type="text"]');
                if (el) { e.preventDefault(); el.focus(); }
                break;
            }
            case 'R': e.preventDefault(); switchTab('services'); break;
            case 'W': e.preventDefault(); switchTab('middlewares'); break;
            case 'S': e.preventDefault(); switchTab('live'); break;
            case 'L': e.preventDefault(); switchTab('logs'); break;
            case 'X': e.preventDefault(); openStaticYamlPopoutFromShortcut(); break;
            case 'P': e.preventDefault(); openSettingsModal(); break;
            case 'D': {
                const b = document.getElementById('btn-dashboard');
                if (b && b.offsetParent !== null) { e.preventDefault(); switchTab('dashboard'); }
                break;
            }
            case 'A': {
                if (!_agentList.length) break;
                e.preventDefault();
                const order = [null, ..._agentList.map(a => a.id)];
                const cur   = _activeAgent ? order.indexOf(_activeAgent.id) : 0;
                switchServer(order[(cur + 1) % order.length]);
                break;
            }
            case '?': e.preventDefault(); toggleShortcutsPanel(); break;
        }
    }
});

document.addEventListener('click', e => {
    if (_shortcutsPanelOpen && !e.target.closest('#shortcutsPanel') && !e.target.closest('.shortcuts-btn-wrap')) {
        _shortcutsPanelOpen = false;
        document.getElementById('shortcutsPanel')?.classList.remove('open');
        const b = document.getElementById('shortcutsBellBtn');
        if (b) b.style.color = '';
    }
});

(function() {
    const saved = localStorage.getItem('tm-theme') || window.TM_DEFAULT_THEME || 'dark';
    applyTheme(saved);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if ((localStorage.getItem('tm-theme') || window.TM_DEFAULT_THEME) === 'system') applyTheme('system');
    });
})();

document.addEventListener('click', e => {
    const menu = document.getElementById('mobileMenu');
    const btn = document.getElementById('hamburgerBtn');
    if (menu.classList.contains('open') && !menu.contains(e.target) && !btn.contains(e.target)) {
        closeMobileMenu();
    }
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _initAutofillGuard);
else _initAutofillGuard();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.warn('SW registration failed:', err));
    });
}

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _pwaInstallPrompt = e;
    document.getElementById('pwaInstallBtn')?.classList.remove('hidden');
    document.getElementById('pwaInstallBtnMobile')?.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
    _pwaInstallPrompt = null;
    document.getElementById('pwaInstallBtn')?.classList.add('hidden');
    document.getElementById('pwaInstallBtnMobile')?.classList.add('hidden');
    showToast('Traefik Manager installed as app!', 'success');
});

(async () => {
    try {
        const res  = await fetch('/api/settings');
        const data = await res.json();
        const tabs = data.visible_tabs || {};
        _localTabsCache = tabs;
        applyTabVisibility(tabs);
        if (tabs.dashboard) switchTab('dashboard');
    } catch(e) {
        applyTabVisibility({});
    }
    _refreshStaticAvailability();
    if (typeof applyUiPrefs === 'function') applyUiPrefs();
    if (typeof _applyDocsLinkVisibility === 'function') _applyDocsLinkVisibility();
    _initMobileFilterBars();
    const _storedAgentId = localStorage.getItem('tm_active_agent');
    if (!_storedAgentId) refreshRoutes();
    loadOverviewStats();
    checkManagerVersion();
    fetchNotifications();
    fetch('/api/agents').then(r => r.json()).then(d => {
        const agents = d.agents || [];
        _updateServerSwitcherList(agents);
        if (_storedAgentId && agents.some(a => a.id === _storedAgentId)) {
            switchServer(_storedAgentId);
        } else if (_storedAgentId) {
            localStorage.removeItem('tm_active_agent');
            refreshRoutes();
        }
    }).catch(() => { if (_storedAgentId) refreshRoutes(); });
    setInterval(fetchNotifications, 60000);
})();

document.addEventListener('click', e => {
    if (_notifPanelOpen && !e.target.closest('#notifBellWrap') && !e.target.closest('#notifBellWrapMobile')) {
        _notifPanelOpen = false;
        document.getElementById('notifPanel')?.classList.remove('open');
        const btn  = document.getElementById('notifBellBtn');
        const btnM = document.getElementById('notifBellBtnMobile');
        if (btn)  btn.style.color  = '';
        if (btnM) btnM.style.color = '';
        markNotifsRead();
    }
});

if (document.getElementById('toastContainer') && document.getElementById('toastContainer').children.length > 0) {
    setTimeout(loadOverviewStats, 2000);
    setTimeout(loadOverviewStats, 5000);
}

placeStatCards();

watchTabBarForSideNav();
buildSideNav();

(() => {
    const nav = document.querySelector('nav');
    if (nav) document.documentElement.style.setProperty('--tm-nav-h', nav.offsetHeight + 'px');
})();
