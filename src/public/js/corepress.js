/*
 * FILE: corepress.js
 * PURPOSE: Site-wide chrome — injects header, footer, theme toggle,
 *          country switcher, cart widget UI, back-to-top button, and the
 *          share modal. Runs on every page of the site.
 *
 * NOTE: Analytics/tracking used to live in this file. It has been moved
 * out to tracking.js — this file should stay focused on layout/UI only.
 *
 * DEPENDS ON: config.js (must load before this file).
 *
 * SECTIONS:
 *   1) Header injection (logo, search box, country dropdown, dark mode, cart icon)
 *   2) Footer injection
 *   3) Cart logic (add/remove, toast notifications)
 *   4) Back-to-top button
 *   5) Share modal
 */

// ================================================================================================
// 1. HEADER INJECTION
// ================================================================================================
(function injectAndInitializeHeader() {
    const cfg = window.ProductPage.config;
    const sel = cfg.selectors;
    // Small helper: our internal selectors are stored as CSS selectors
    // ('#foo') so they work directly with querySelector everywhere else.
    // When we need the bare id (for an id='...' HTML attribute), strip the '#'.
    const idAttr = (cssSelector) => cssSelector.replace(/^#/, '');
    const isMainDomain = window.location.hostname === 'iseekprice.com' || window.location.hostname === 'www.iseekprice.com';
    const currentCountry = cfg.country;

    const logoWrap = document.querySelector(sel.external.logoWrap);
    if (logoWrap) logoWrap.innerHTML = `<a href='/'><img alt='Logo' src='/public/assets/static/favicon.webp'/></a>`;

    const searchWrap = document.querySelector(sel.external.searchWrap);
    if (searchWrap) {
        searchWrap.innerHTML = `
            <form class='search-box-form' onsubmit='startSearch(); return false;'>
                <input autocomplete='off' class='search-box-input' id='searchInput' placeholder='ابحث عن منتج...' type='text'/> 
                <button class='search-box-button' type='submit'>بحث <svg class='icon'><use href='${cfg.endpoints.iconsSvg}#i-search'/></svg></button>
            </form>
            <div class='search-history-dropdown' id='searchHistoryDropdown'></div>`;
    }

    const actionsWrap = document.querySelector(sel.external.actionsWrap);
    if (actionsWrap) {
        const currentNameAr = cfg.currency.nameAr;
        // Country list is generated from config.countryMap — add a country
        // in config.js only, no need to touch this markup.
        const optionsHtml = Object.keys(cfg.countryMap).map(code => {
            const c = cfg.countryMap[code];
            return `<li data-value='${code}'><img alt='${code}' height='16' src='/public/assets/flags/${code}.png' width='16'/> ${c.nameAr}</li>`;
        }).join('');

        actionsWrap.innerHTML = `
            <div class='custom-dropdown' id='${idAttr(sel.internal.countryDropdown)}'>
                <div class='selected'><img alt='flag' height='16' src='/public/assets/flags/${currentCountry}.png' width='16'/> ${currentNameAr}</div>
                <ul class='options'>${optionsHtml}</ul>
            </div>
            <div class='dm-toggle'>
                <button aria-label='Dark Mode' id='${idAttr(sel.internal.darkToggler)}'><svg class='icon'><use href='${cfg.endpoints.iconsSvg}#i-moon'/></svg></button>
            </div>
            <div class='cart-widget' id='${idAttr(sel.internal.cartWidgetHeader)}'>
                <span class='cart-icon'><svg class='icon'><use href='${cfg.endpoints.iconsSvg}#i-cart'/></svg></span>
                <span id='${idAttr(sel.internal.cartCount)}'>0</span>
            </div>`;
    }

    const topBar = document.querySelector(sel.external.widgetTopbar);
    if (topBar) topBar.innerHTML = `<button id='widget-toggle-btn'>&#9776;</button><div id='widget-desktop-cats'></div>`;

    const sideBar = document.querySelector(sel.external.widgetSidebar);
    if (sideBar) {
        sideBar.innerHTML = `<div id='widget-header-bar'><span id='widget-sidebar-title'>التصنيفات</span><button id='widget-close-btn'>&#10006;</button></div><div id='widget-side-list'></div>`;
    }

    // --- Theme (dark mode) toggle ---
    const htmlEl = document.documentElement;
    const darkBtn = document.querySelector(sel.internal.darkToggler);
    function applyTheme(theme, persist) {
        const iconUse = darkBtn ? darkBtn.querySelector('use') : null;
        const iconPath = cfg.endpoints.iconsSvg;
        if (theme === 'dark') {
            htmlEl.classList.add('dm');
            htmlEl.setAttribute('data-theme', 'dark');
            if (iconUse) iconUse.setAttribute('href', iconPath + '#i-sun');
        } else {
            htmlEl.classList.remove('dm');
            htmlEl.setAttribute('data-theme', 'light');
            if (iconUse) iconUse.setAttribute('href', iconPath + '#i-moon');
        }
        if (persist) localStorage.setItem('theme', theme);
    }
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme, false);
    if (darkBtn) {
        darkBtn.addEventListener('click', e => {
            e.preventDefault();
            applyTheme(htmlEl.classList.contains('dm') ? 'light' : 'dark', true);
        });
    }

    // --- Cart count badge ---
    function updateCartWidget() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const countEl = document.querySelector(sel.internal.cartCount);
        if (countEl) {
            countEl.textContent = cart.length;
            cart.length > 0 ? countEl.classList.add('active') : countEl.classList.remove('active');
        }
    }
    updateCartWidget();
    window.addEventListener('cartUpdated', updateCartWidget);
    const cartBtn = document.querySelector(sel.internal.cartWidgetHeader);
    if (cartBtn) cartBtn.onclick = () => window.location.href = '/page/cart/';

    // --- Country dropdown open/close + navigation ---
    const dropdown = document.querySelector(sel.internal.countryDropdown);
    const selected = dropdown ? dropdown.querySelector('.selected') : null;
    const options = dropdown ? dropdown.querySelector('.options') : null;

    // --- Root domain -> geo redirect to a country subdomain ---
    // 🛟 FALLBACK, NOT THE PRIMARY MECHANISM: the main geo-redirect for
    // iseekprice.com / www.iseekprice.com happens at the edge, in the
    // Cloudflare Pages Function at /functions/[[path]].js (outside src/,
    // required by Cloudflare's routing convention — do not move it into
    // src/ or it stops being picked up as a Function). That redirect runs
    // before any HTML reaches the browser and should handle every visit
    // to the root domain.
    // This block only runs if that edge redirect somehow doesn't fire
    // (misconfiguration, edge-function outage, etc.) — it's a safety net,
    // not a duplicate to clean up. It's intentionally slower (waits for
    // JS to load) since it's the backup path, not the common path.
    if (isMainDomain) {
        fetch('/cdn-cgi/trace').then(r => r.text()).then(text => {
            const match = text.match(/loc=([A-Z]+)/);
            const loc = (match && match[1]) ? match[1].toLowerCase() : 'sa';
            const target = Object.keys(cfg.countryMap).includes(loc) ? loc : 'sa';
            window.location.replace(`https://${target}.iseekprice.com${window.location.pathname}${window.location.search}`);
        }).catch(() => {
            window.location.replace(`https://sa.iseekprice.com${window.location.pathname}${window.location.search}`);
        });
    }

    if (selected && options) {
        selected.onclick = e => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
            options.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
        };
        options.onclick = e => {
            const li = e.target.closest('li');
            if (li) {
                const newCountry = li.getAttribute('data-value').toLowerCase();
                window.location.href = `https://${newCountry}.iseekprice.com${window.location.pathname}${window.location.search}`;
            }
        };
    }
})();

// ================================================================================================
// 2. FOOTER INJECTION
// ================================================================================================
(function injectFooter() {
    const cfg = window.ProductPage.config;
    const footerInjector = document.querySelector(cfg.selectors.external.footer);
    if (!footerInjector) return;

    const sections = [
        { title: 'عن الموقع', links: [{ text: 'من نحن', url: '/page/info/about-us/' }, { text: 'سياسة الموقع', url: '/page/info/policy/' }, { text: 'اتصل بنا', url: '/page/info/contact/' }] },
        { title: 'الأكثر متابعة', links: [{ text: 'IWatch', url: '/page/iwatch/' }, { text: 'Blog', url: '/page/blog/' }] }
    ];
    const socialLinks = [
        { label: 'YouTube', icon: 'i-youtube', url: 'https://www.youtube.com/@ISeekPrice' },
        { label: 'Pinterest', icon: 'i-pinterest', url: 'https://www.pinterest.com/ISeekPrice' },
        { label: 'X', icon: 'i-x', url: 'https://x.com/ISeekPrice' },
        { label: 'Telegram', icon: 'i-telegram', url: 'https://t.me/+bmBnY0FumOwxZDQ0' }
    ];
    const sectionsHtml = sections.map(sec => `<div class='footer-links'><h3 class='footer-title'>${sec.title}</h3><ul>${sec.links.map(link => `<li><a href='${link.url}'>${link.text}</a></li>`).join('')}</ul></div>`).join('');
    const socialHtml = `<div class='footer-social-section'><h3 class='footer-title'>تابعونا علي</h3><div class='footer-social'>${socialLinks.map(soc => `<a aria-label='${soc.label}' href='${soc.url}' rel='noopener' target='_blank'><svg class='icon'><use href='${cfg.endpoints.iconsSvg}#${soc.icon}'/></svg></a>`).join('')}</div></div>`;
    footerInjector.innerHTML = `<div class='footer-container'><div class='footer-row'>${sectionsHtml}${socialHtml}</div></div><div class='footer-bottom'><p>&#169; 2024-${new Date().getFullYear()} جميع الحقوق محفوظة لموقع iseekprice.com</p></div>`;
})();

// ================================================================================================
// 3. CART LOGIC
// ================================================================================================
function showCartToast(message, type = 'success') {
    const cfg = window.ProductPage.config;
    const t = cfg.behavior.toast;
    const host = document.createElement('div');
    document.body.prepend(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const div = document.createElement('div');
    div.textContent = message;
    shadow.appendChild(div);
    const style = document.createElement('style');
    style.textContent = `div{position:fixed;top:20px;right:20px;min-width:220px;max-width:320px;background:${type === 'error' ? '#e74c3c' : '#2ecc71'};color:#fff;font-family:sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;box-shadow:0 4px 12px rgb(0 0 0 / .2);opacity:0;transform:translateX(120%);transition:all 0.4s ease;z-index:1000000}div.show{opacity:1;transform:translateX(0)}`;
    shadow.appendChild(style);
    setTimeout(() => div.classList.add('show'), t.fadeInMs);
    setTimeout(() => {
        div.classList.remove('show');
        setTimeout(() => host.remove(), t.fadeOutMs);
    }, t.durationMs);
}

function addToCart(id) {
    if (!id) {
        showCartToast('عذراً، لم يتم العثور على معرف المنتج!', 'error');
        return;
    }
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.some(i => i.id === id)) {
        showCartToast('المنتج موجود بالفعل في المفضلة! ❤️', 'error');
        return;
    }
    cart.push({ id, timestamp: new Date().getTime() });
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
    showCartToast('تمت الإضافة للمفضلة ❤️', 'success');
}

document.addEventListener('click', function (e) {
    const sel = window.ProductPage.config.selectors.internal;
    const extSel = window.ProductPage.config.selectors.external;
    const cartBtn = e.target.closest(sel.cartButton);
    if (cartBtn) {
        e.preventDefault();
        e.stopPropagation();
        const card = e.target.closest(sel.productCard);
        const id = card ? card.querySelector(extSel.uidElement)?.textContent.trim() : null;
        addToCart(id);
    }
    const addBtn = e.target.closest(extSel.addToCartButton);
    if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        const uid = document.querySelector(extSel.uidElement);
        addToCart(uid ? uid.textContent.trim() : null);
    }
});

// ================================================================================================
// 4. BACK-TO-TOP BUTTON
// ================================================================================================
(function () {
    const cfg = window.ProductPage.config;
    const btn = document.createElement('div');
    btn.id = 'back-to-top';
    btn.innerHTML = `<a aria-label='Back to Top' href='#top'><svg class='icon'><use xlink:href='${cfg.endpoints.iconsSvg}#i-arrow-t'/></svg></a>`;
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => {
        btn.classList.toggle('show', window.scrollY > cfg.behavior.backToTop.showAfterScrollPx);
    }, { passive: true });
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

// ================================================================================================
// 5. SHARE MODAL
// ================================================================================================
document.addEventListener('DOMContentLoaded', function () {
    const cfg = window.ProductPage.config;
    const sel = cfg.selectors;
    const pageUrl = encodeURIComponent(window.location.href);
    const pageTitle = encodeURIComponent(document.title);
    const idAttr = (cssSelector) => cssSelector.replace(/^#/, '');
    const modalHTML = `
    <div class='sh-overlay' id='${idAttr(sel.internal.shareModal)}' style='display:none;'>
        <div class='sh-box'>
            <span class='sh-close' id='shareCloseBtn'>&times;</span>
            <h3 class='sh-title'>مشاركة مع الأصدقاء</h3>
            <div class='sh-grid'>
                <a class='sh-btn sh-fb' href="https://www.facebook.com/sharer/sharer.php?u=${pageUrl}" target='_blank'>
                    <svg class="icon"><use href='${cfg.endpoints.iconsSvg}#i-facebook'/></svg>
                    <span>فيسبوك</span>
                </a>
                <a class='sh-btn sh-x' href="https://twitter.com/intent/tweet?text=${pageTitle}&url=${pageUrl}" target='_blank'>
                    <svg class="icon"><use href='${cfg.endpoints.iconsSvg}#i-x'/></svg>
                    <span>إكس</span>
                </a>
                <a class='sh-btn sh-wa' href="https://api.whatsapp.com/send?text=${pageTitle}%20${pageUrl}" target='_blank'>
                    <svg class="icon"><use href='${cfg.endpoints.iconsSvg}#i-whatsapp'/></svg>
                    <span>واتساب</span>
                </a>
                <a class='sh-btn sh-tg' href="https://t.me/share/url?url=${pageUrl}&text=${pageTitle}" target='_blank'>
                    <svg class="icon"><use href='${cfg.endpoints.iconsSvg}#i-telegram'/></svg>
                    <span>تليجرام</span>
                </a>
                <a class='sh-btn sh-pin' href="https://pinterest.com/pin/create/button/?url=${pageUrl}&description=${pageTitle}" target='_blank'>
                    <svg class="icon"><use href='${cfg.endpoints.iconsSvg}#i-pinterest'/></svg>
                    <span>بينترست</span>
                </a>
                <a class='sh-btn sh-rd' href="https://reddit.com/submit?url=${pageUrl}&title=${pageTitle}" target='_blank'>
                    <svg class="icon"><use href='${cfg.endpoints.iconsSvg}#i-reddit'/></svg>
                    <span>ريديت</span>
                </a>
                <a class='sh-btn sh-em' href="mailto:?subject=${pageTitle}&body=${pageUrl}">
                    <svg class="icon"><use href='${cfg.endpoints.iconsSvg}#i-email'/></svg>
                    <span>بريد إلكتروني</span>
                </a>
                <a class='sh-btn sh-copy' id='copyLinkBtn' href="javascript:void(0);" rel="nofollow">
                    <svg class="icon"><use href='${cfg.endpoints.iconsSvg}#i-copy'/></svg>
                    <span>نسخ الرابط</span>
                </a>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.querySelector(sel.internal.shareModal);
    const openBtn = document.querySelector(sel.external.shareOpenBtn);
    const closeBtn = document.getElementById('shareCloseBtn');
    const copyBtn = document.getElementById('copyLinkBtn');
    const closeModal = () => { modal.style.display = 'none'; document.body.style.overflow = 'auto'; };

    if (openBtn) openBtn.onclick = () => { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; };
    if (closeBtn) closeBtn.onclick = closeModal;
    window.onclick = e => { if (e.target === modal) closeModal(); };
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(window.location.href)
                .then(() => alert('تم نسخ الرابط بنجاح!'))
                .catch(e => console.error(e));
        };
    }
    document.querySelectorAll('.sh-btn').forEach(b => {
        if (!b.classList.contains('sh-em') && !b.classList.contains('sh-wa') && b.id !== 'copyLinkBtn') {
            b.onclick = function (e) {
                e.preventDefault();
                window.open(this.href, 'share-dialog', 'width=600,height=400');
            };
        }
    });
});
