/*
 * FILE: make.js
 * PURPOSE: Builds the interactive parts of a single PRODUCT page:
 *          image gallery + lightbox, tabs, SKU/variant picker, promo
 *          coupon banner, price-history chart, and the Telegram
 *          price-alert widget.
 *
 * DEPENDS ON: config.js (must load before this file, non-deferred).
 * Chart.js is loaded separately via CDN for section 6.
 *
 * PUBLIC API: every function here is exposed under
 * window.ProductPage.functions.* — that is the only supported way for
 * other scripts (or this file's own runtime-generated markup) to call
 * them. The single exception is window.openModal, kept as a bare alias
 * because it is written directly, unqualified, into the static HTML of
 * every already-published product page (<img ... onclick="openModal()">).
 *
 * SECTIONS:
 *   0) Shared utility: HTML escaping
 *   1) Image gallery + lightbox modal
 *   2) Tabs
 *   3) SKU hub (variant picker) + price/rating injection
 *   4) Promo coupon banner
 *   5) Price-history chart (Chart.js)
 *   6) Chart image export (download / share)
 *   7) Telegram price-alert widget
 */

window.ProductPage = window.ProductPage || {};
window.ProductPage.functions = window.ProductPage.functions || {};

// ================================================================================================
// 0. SHARED UTILITY: HTML ESCAPING
// ================================================================================================
// 🛡️ Store names, SKU variant labels, and coupon codes come from
// third-party sellers via the binary feed — we don't control their
// content. Escape them before inserting into innerHTML so a seller
// field can't inject markup/scripts into the page.
(function () {
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>'"]/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[c]));
    }
    window.ProductPage.functions.escapeHtml = escapeHtml;
})();

// ================================================================================================
// 1. IMAGE GALLERY + LIGHTBOX MODAL
// ================================================================================================
(function () {
    const cfg = window.ProductPage.config;
    const sel = cfg.selectors;
    const idAttr = (cssSelector) => cssSelector.replace(/^#/, '');

    const thumbContainer = document.querySelector(sel.external.thumbTrack);
    const thumbSlider = document.querySelector(sel.external.thumbSlider);
    const mainImg = document.querySelector(sel.external.mainImage);
    let currentIndex = 0;
    const scrollAmount = cfg.behavior.gallery.thumbScrollPx;

    function getThumbnails() {
        return [...document.querySelectorAll(`${sel.external.thumbTrack} img`)];
    }

    function applyImageStyle(img) {
        if (!img) return;
        Object.assign(img.style, { objectFit: 'contain', backgroundColor: 'black', width: '100%', height: '100%' });
    }

    function changeImage(index) {
        const thumbnails = getThumbnails();
        const selectedThumb = thumbnails[index];
        if (!selectedThumb) return;
        currentIndex = index;
        mainImg.src = selectedThumb.src;
        applyImageStyle(mainImg);
        if (selectedThumb._skuData) {
            if (typeof window.ProductPage?.functions?.updateSKUPrice === 'function') window.ProductPage.functions.updateSKUPrice(selectedThumb._skuData);
        } else {
            if (typeof window.ProductPage?.functions?.resetToInitialData === 'function') window.ProductPage.functions.resetToInitialData();
        }
        thumbnails.forEach((img, i) => img.classList.toggle('active-thumb', i === index));
        scrollThumbnailIntoView(index);
    }

    function scrollThumbnailIntoView(index) {
        const thumbnails = getThumbnails();
        const thumb = thumbnails[index];
        if (!thumb || !thumbContainer) return;
        const cRect = thumbContainer.getBoundingClientRect();
        const tRect = thumb.getBoundingClientRect();
        const isRTL = getComputedStyle(thumbContainer).direction === 'rtl';
        const offset = tRect.left < cRect.left ? tRect.left - cRect.left - 10 : tRect.right > cRect.right ? tRect.right - cRect.right + 10 : 0;
        thumbContainer.scrollLeft += isRTL ? offset : -offset;
    }

    document.getElementById('thumbsRight')?.addEventListener('click', () => thumbContainer.scrollLeft -= scrollAmount);
    document.getElementById('thumbsLeft')?.addEventListener('click', () => thumbContainer.scrollLeft += scrollAmount);
    document.getElementById('mainImageRightArrow')?.addEventListener('click', () => {
        const thumbnails = getThumbnails();
        if (thumbnails.length > 0) changeImage((currentIndex + 1) % thumbnails.length);
    });
    document.getElementById('mainImageLeftArrow')?.addEventListener('click', () => {
        const thumbnails = getThumbnails();
        if (thumbnails.length > 0) changeImage((currentIndex - 1 + thumbnails.length) % thumbnails.length);
    });
    thumbSlider?.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            const thumbnails = getThumbnails();
            const index = thumbnails.indexOf(e.target);
            if (index !== -1) changeImage(index);
        }
    });
    if (getThumbnails().length > 0) changeImage(0);

    function createModal() {
        if (document.querySelector(sel.internal.imageModal)) return;
        document.body.insertAdjacentHTML('beforeend', `
      <div id="${idAttr(sel.internal.imageModal)}" class="modal">
        <span class="close" onclick="window.ProductPage.functions.closeModal()">&times;</span>
        <img class="modal-content" id="${idAttr(sel.internal.modalImage)}" />
        <span class="arrow left" onclick="window.ProductPage.functions.navigateModal('prev')"></span>
        <span class="arrow right" onclick="window.ProductPage.functions.navigateModal('next')"></span>
      </div>
    `);
    }
    createModal();
    const modal = document.querySelector(sel.internal.imageModal);
    const modalImage = document.querySelector(sel.internal.modalImage);

    function openModal(index) {
        const thumbnails = getThumbnails();
        const targetIndex = (typeof index === 'number') ? index : currentIndex;
        if (!thumbnails[targetIndex]) return;
        modal.style.display = 'flex';
        modalImage.src = thumbnails[targetIndex].src;
        applyImageStyle(modalImage);
        currentIndex = targetIndex;
    }
    function closeModal() {
        modal.style.display = 'none';
    }
    function navigateModal(direction) {
        const thumbnails = getThumbnails();
        if (thumbnails.length === 0) return;
        currentIndex = direction === 'next' ? (currentIndex + 1) % thumbnails.length : (currentIndex - 1 + thumbnails.length) % thumbnails.length;
        modalImage.src = thumbnails[currentIndex].src;
        applyImageStyle(modalImage);
    }

    Object.assign(window.ProductPage.functions, { changeImage, openModal, closeModal, navigateModal });
    // Required backward-compat: every already-published product page has
    // <img ... onclick="openModal()"> baked directly into its static HTML.
    window.openModal = openModal;
})();

// ================================================================================================
// 2. TABS
// ================================================================================================
(function () {
    const cfg = window.ProductPage.config;
    let enableInitialScroll = false;

    function showTab(id, btn, forceScroll = false) {
        document.querySelectorAll('[id^="tab"]').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.tab-buttons button').forEach(b => b.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) {
            target.style.display = 'block';
            const targetTop = target.getBoundingClientRect().top + window.scrollY;
            const stickyHeight = document.querySelector('.tab-buttons')?.offsetHeight || 0;
            setTimeout(() => {
                if (enableInitialScroll || forceScroll) {
                    window.scrollTo({ top: targetTop - stickyHeight - 10, behavior: 'smooth' });
                }
            }, 100);
        }
        if (btn) btn.classList.add('active');
    }

    const TAB_LABELS = {
        tab1: 'التفاصيل',
        tab2: 'المزايا',
        tab3: 'الخصائص الفنية',
        tab4: 'تحليل الأسعار'
    };

    function buildTabButtonsIfMissing() {
        if (document.querySelector('.tab-buttons')) return false;
        const firstTabId = Object.keys(TAB_LABELS).find(id => document.getElementById(id));
        if (!firstTabId) return false;

        const wrapper = document.createElement('div');
        wrapper.className = 'tab-buttons';
        wrapper.innerHTML = Object.entries(TAB_LABELS)
            .filter(([id]) => document.getElementById(id))
            .map(([id, label]) => `<button data-tab="${id}">${label}</button>`)
            .join('');

        const firstTabEl = document.getElementById(firstTabId);
        firstTabEl.parentNode.insertBefore(wrapper, firstTabEl);

        const buttons = [...wrapper.querySelectorAll('button')];
        buttons.forEach(btn => {
            btn.addEventListener('click', () => showTab(btn.dataset.tab, btn, true));
        });
        if (buttons[0]) showTab(buttons[0].dataset.tab, buttons[0]);
        return true;
    }

    function wireLegacyTabButtons() {
        const legacyTextMap = {
            'الوصف': TAB_LABELS.tab1,
            'المميزات': TAB_LABELS.tab2,
            'المواصفات': TAB_LABELS.tab3,
            'الرسم البياني للسعر': TAB_LABELS.tab4
        };
        let tabCheck = setInterval(() => {
            const firstBtn = document.querySelector('.tab-buttons button');
            const firstTab = document.getElementById('tab1');
            if (firstBtn && firstTab) {
                showTab('tab1', firstBtn);
                document.querySelectorAll('.tab-buttons button').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.getAttribute('onclick')?.match(/'(.*?)'/)?.[1];
                        if (id) showTab(id, btn, true);
                    });
                    const oldText = btn.textContent.trim();
                    if (legacyTextMap[oldText]) btn.textContent = legacyTextMap[oldText];
                });
                clearInterval(tabCheck);
            }
        }, cfg.behavior.tabsBootstrap.pollIntervalMs);
        setTimeout(() => clearInterval(tabCheck), cfg.behavior.tabsBootstrap.giveUpAfterMs);
    }

    if (!buildTabButtonsIfMissing()) {
        wireLegacyTabButtons();
    }

    window.ProductPage.functions.showTab = showTab;
})();

// ================================================================================================
// 3. SKU HUB (VARIANT PICKER) + PRICE/RATING INJECTION
// ================================================================================================
(function () {
    const cfg = window.ProductPage.config;
    const sel = cfg.selectors;
    const idAttr = (cssSelector) => cssSelector.replace(/^#/, '');
    const esc = window.ProductPage.functions.escapeHtml;

    function drawStars(container, rating) {
        if (!container) return;
        const fullStars = Math.floor(rating);
        const hasHalf = rating % 1 >= 0.5 ? 1 : 0;
        let starsHTML = '';
        for (let i = 0; i < fullStars; i++) starsHTML += `<span class="star">★</span>`;
        if (hasHalf) starsHTML += `<span class="star half">★</span>`;
        for (let i = 0; i < (5 - fullStars - hasHalf); i++) starsHTML += `<span class="star empty">★</span>`;
        container.innerHTML = starsHTML;
    }

    const markup = `
        <div id="${idAttr(sel.internal.skuHubOverlay)}">
            <div class="sku-modal-content">
                <div class="sku-modal-header">
                    <h3>خيارات وموديلات المنتج</h3>
                    <button class="sku-close" onclick="window.ProductPage.functions.SKU_HUB.toggle(false)">&times;</button>
                </div>
                <div class="sku-slider-container">
                    <button class="sku-nav prev" onclick="window.ProductPage.functions.SKU_HUB.scroll('right')">
                        <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    <div class="sku-track" id="${idAttr(sel.internal.skuTrack)}"></div>
                    <button class="sku-nav next" onclick="window.ProductPage.functions.SKU_HUB.scroll('left')">
                        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', markup);

    const SKU_HUB = {
        items: [],
        toggle(state) {
            const el = document.querySelector(sel.internal.skuHubOverlay);
            if (el) {
                el.classList.toggle('active', state);
                document.body.style.overflow = state ? 'hidden' : '';
            }
        },
        scroll(direction) {
            const track = document.querySelector(sel.internal.skuTrack);
            if (track) {
                const amount = cfg.behavior.skuHub.scrollPx;
                track.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
            }
        },
        render(data) {
            this.items = data.filter(i => i.priceDiscounted > 0);
            if (!this.items.length) return;
            const minPrice = Math.min(...this.items.map(v => v.priceDiscounted));
            const minDelivery = Math.min(...this.items.map(v => v.maxDelivery));
            const track = document.querySelector(sel.internal.skuTrack);
            track.innerHTML = this.items.map(item => {
                let badge = '';
                if (item.priceDiscounted === minPrice) badge = '<span class="sku-badge badge-price">أفضل سعر</span>';
                else if (item.maxDelivery === minDelivery) badge = '<span class="sku-badge badge-delivery">أسرع شحن</span>';
                return `
                <div class="sku-card" onclick="window.ProductPage.functions.SKU_HUB.select('${encodeURIComponent(JSON.stringify(item))}')">
                ${badge}
                <div class="sku-card-img-wrap">
                <img src="${item.image}" class="sku-card-img" loading="lazy">
                </div>
                <div class="sku-card-info">
                <div class="sku-card-name">${esc(item.props)}</div>
                <div class="sku-card-pricing">
                <span class="sku-card-now">${item.priceDiscounted.toFixed(2)}</span>
                <span class="sku-card-old">${item.priceOriginal.toFixed(2)}</span>
                </div>
                <div class="sku-card-meta">
                <div class="meta-row">
                <svg viewBox="0 0 24 24"><path d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                <span>التوصيل: ${item.minDelivery}-${item.maxDelivery} يوم</span>
                </div>
                <div class="meta-row" style="color: ${item.shippingFee <= 0 ? '#10b981' : 'inherit'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; fill: none;"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>
                <span>${item.shippingFee <= 0 ? 'شحن مجاني بالكامل' : 'رسوم الشحن: ' + item.shippingFee.toFixed(2)}</span>
                </div>
                </div>
                </div>
                </div>`;
            }).join('');
            const btn = document.querySelector(sel.external.skuHubBtn);
            if (btn) btn.style.display = 'block';
        },
        select(encoded) {
            const item = JSON.parse(decodeURIComponent(encoded));
            if (window.ProductPage?.functions?.updateSKUPrice) window.ProductPage.functions.updateSKUPrice(item);
            if (window.ProductPage?.functions?.changeImage) {
                const thumbs = Array.from(document.querySelectorAll(`${sel.external.thumbSlider} img`));
                const i = thumbs.findIndex(m => m.src === item.image);
                if (i !== -1) window.ProductPage.functions.changeImage(i);
            }
            this.toggle(false);
        }
    };

    function renderSKUs(skuList) {
        const skuWrapper = document.getElementById('sku-images-wrapper') || Object.assign(document.createElement('div'), { id: 'sku-images-wrapper' });
        skuWrapper.style.display = 'contents';
        skuWrapper.innerHTML = '';
        const thumbSlider = document.querySelector(sel.external.thumbSlider);
        if (thumbSlider) thumbSlider.appendChild(skuWrapper);
        skuList.forEach(item => {
            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.props;
            img.title = item.props;
            img.loading = 'lazy';
            img._skuData = item;
            img.addEventListener('click', () => {
                if (typeof window.ProductPage?.functions?.updateSKUPrice === 'function') window.ProductPage.functions.updateSKUPrice(item);
            });
            skuWrapper.appendChild(img);
        });
        SKU_HUB.render(skuList);
        const skuParam = new URLSearchParams(window.location.search).get('sku');
        if (skuParam && skuParam !== '255') {
            setTimeout(() => {
                const allImgs = Array.from(document.querySelectorAll(`${sel.external.thumbSlider} img`));
                const targetImg = allImgs.find(i => i._skuData && i._skuData.skuIdx == skuParam);
                if (targetImg && window.ProductPage?.functions?.changeImage) {
                    window.ProductPage.functions.changeImage(allImgs.indexOf(targetImg));
                }
            }, 250);
        }
    }

    function injectData(data) {
        const symbol = cfg.currency.symbol;
        const weight = cfg.currency.rate || 1;
        const formatPrice = num => parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pOriginal = data.priceOriginal;
        const pDiscounted = data.priceDiscounted;
        const diff = pOriginal - pDiscounted;
        const hasDiscount = diff > 0.01;

        document.querySelectorAll(sel.external.priceDiscounted).forEach(el => el.textContent = `${formatPrice(pDiscounted)} ${symbol}`);
        const savingEl = document.querySelector(sel.external.priceSaving);
        const discountEl = document.querySelector(sel.external.discountPercentage);
        const originalPriceEls = document.querySelectorAll(sel.external.priceOriginal);

        if (hasDiscount) {
            originalPriceEls.forEach(el => {
                el.textContent = `${formatPrice(pOriginal)} ${symbol}`;
                el.style.display = 'inline-block';
            });
            if (discountEl) {
                discountEl.textContent = `-${Math.round((diff / pOriginal) * 100)}%`;
                discountEl.style.display = 'inline-block';
            }
            if (savingEl) {
                savingEl.style.display = 'block';
                savingEl.innerHTML = `<span class="save-label">وفر:</span> <span class="save-amount">${formatPrice(diff)} ${symbol}</span>`;
                const weightedDiff = diff / weight;
                const tier = cfg.behavior.priceSavingsColorTiers.find(t => weightedDiff < t.maxAmount);
                const color = tier ? tier.color : '#7f8c8d';
                savingEl.style.color = color;
                savingEl.style.fontWeight = 'bold';
                if (weightedDiff >= cfg.behavior.fireGifThreshold) {
                    const saveAmount = savingEl.querySelector('.save-amount');
                    if (saveAmount && !saveAmount.querySelector('.fire-gif')) {
                        const fireGif = document.createElement('img');
                        fireGif.alt = 'سعر مميز';
                        fireGif.src = '/public/assets/static/fire.gif';
                        fireGif.style.cssText = 'width:20px; vertical-align:middle; margin-left:5px;';
                        fireGif.classList.add('fire-gif');
                        saveAmount.appendChild(fireGif);
                    }
                }
            }
        } else {
            originalPriceEls.forEach(el => el.style.display = 'none');
            if (discountEl) discountEl.style.display = 'none';
            if (savingEl) savingEl.style.display = 'none';
        }

        document.querySelectorAll(sel.external.feeValue).forEach(el => {
            const isFree = data.shippingFee <= 0;
            el.textContent = isFree ? 'شحن مجاني' : `${formatPrice(data.shippingFee)} ${symbol}`;
            if (isFree) { el.style.color = '#00b894'; el.style.fontWeight = 'bold'; }
        });

        document.querySelectorAll(sel.external.timeValue).forEach(el => {
            const min = data.minDelivery;
            const max = data.maxDelivery;
            el.textContent = (min === max || !max) ? `${min} أيام` : `${max}-${min} أيام`;
        });

        drawStars(document.querySelector(sel.external.starsContainer), parseFloat(data.score) || 0);
        const rv = document.querySelector(sel.external.ratingValue);
        if (rv) rv.textContent = data.score.toFixed(1);
        const rc = document.querySelector(sel.external.reviewsCount);
        if (rc) rc.textContent = (data.reviews || 0).toLocaleString() + ' تقييمات';

        const moreRev = document.querySelector(sel.external.moreReviewsLink);
        if (moreRev && data.productAffCode) {
            moreRev.href = `https://s.click.aliexpress.com/${data.productAffCode}`;
            moreRev.parentElement.style.display = 'block';
        }

        const affLink = data.productAffCode ? `https://s.click.aliexpress.com/${data.productAffCode}` : null;
        const buyBtn = document.querySelector(sel.external.buyButton);
        if (buyBtn && affLink) buyBtn.href = affLink;
        if (moreRev && affLink) moreRev.href = affLink;

        const ordersEl = document.querySelector(sel.external.ordersCount);
        if (ordersEl) ordersEl.textContent = (data.orders || 0).toLocaleString();

        const storeWrapper = document.querySelector(sel.external.storeBarWrapper);
        if (storeWrapper && data.storeName) {
            const storeLink = `/page/store?store=${esc(data.storeId)}`;
            storeWrapper.innerHTML = `
                <div class="bar">
                    <img src="/public/assets/static/store.webp" class="profile-image" alt="Store">
                    <div class="text">${esc(data.storeName)}</div>
                    <div class="buttons">
                        <a href="${storeLink}" class="button">زيارة المتجر</a>
                        <a href="https://s.click.aliexpress.com/${esc(data.storeAffCode)}" target="_blank" rel="nofollow" class="button">متابعة</a>
                    </div>
                </div>`;
        }
    }

    Object.assign(window.ProductPage.functions, { SKU_HUB, renderSKUs, injectData });
})();

// ================================================================================================
// 4. PROMO COUPON BANNER
// ================================================================================================
(function () {
    function injectPromo(promoData) {
        const cfg = window.ProductPage.config;
        const sel = cfg.selectors;
        const idAttr = (cssSelector) => cssSelector.replace(/^#/, '');
        const esc = window.ProductPage.functions.escapeHtml;
        let container = document.querySelector(sel.external.couponContainer);
        const shelf = document.querySelector(sel.external.dynamicShelf);
        if (!promoData || !promoData.code || !promoData.code.trim()) {
            if (container) container.style.display = 'none';
            return;
        }
        if (!container && shelf) {
            container = document.createElement('div');
            container.className = sel.external.couponContainer.replace(/^\./, '');
            shelf.parentNode.insertBefore(container, shelf.nextSibling);
        }
        if (!container) return;

        const colors = cfg.behavior.promo.bannerColors;
        const theme = colors[Math.floor(Math.random() * colors.length)];
        container.style.setProperty('--theme-color', theme);

        let expiryTimestamp;
        if (typeof promoData.expiry === 'number' && promoData.expiry < 10000000000) {
            expiryTimestamp = Date.UTC(2025, 0, 1) + (promoData.expiry * 60 * 1000);
        } else {
            expiryTimestamp = new Date(promoData.expiry).getTime();
        }

        const updateTimer = () => {
            const diffMs = expiryTimestamp - Date.now();
            if (diffMs <= 0) {
                container.style.display = 'none';
                clearInterval(window.promoTimer);
                return;
            }
            const d = Math.floor(diffMs / 86400000);
            const h = Math.floor((diffMs % 86400000) / 3600000);
            const m = Math.floor((diffMs % 3600000) / 60000);
            const s = Math.floor((diffMs % 60000) / 1000);
            const timerEl = document.getElementById('promo-timer-text');
            if (timerEl) timerEl.textContent = d > 0 ? `⏳ ينتهي خلال ${d} يوم` : `⏳ ينتهي خلال ${h}:${m}:${s}`;
        };

        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.innerHTML = `
        <div class="coupon-row">
            <div class="coupon-code" id="${idAttr(sel.internal.couponCode)}">${esc(promoData.code)}</div>
            <button class="copy-button" onclick="window.ProductPage.functions.copyCoupon('${encodeURIComponent(promoData.code)}')">نسخ الكوبون</button>
        </div>
        <div class="promo-meta">
            <span class="qty-badge">🔥 متبقي: ${promoData.quantity} قطعة</span>
            <span id="promo-timer-text" class="timer-nari" style="color: #0048ff; font-weight: 800; font-size: 14px;">⏳ جاري الحساب...</span>
        </div>
    `;
        if (window.promoTimer) clearInterval(window.promoTimer);
        window.promoTimer = setInterval(updateTimer, 1000);
        updateTimer();
    }

    function copyCoupon(encodedCode) {
        const cfg = window.ProductPage.config;
        const target = encodedCode ? decodeURIComponent(encodedCode) : document.querySelector(cfg.selectors.internal.couponCode).textContent;
        const btn = document.querySelector('.copy-button');
        const done = () => {
            if (btn) {
                const old = btn.textContent;
                btn.textContent = 'تم! ✅';
                setTimeout(() => btn.textContent = old, 2000);
            }
        };
        if (navigator.clipboard) {
            navigator.clipboard.writeText(target).then(done);
        } else {
            const el = document.createElement('textarea');
            el.value = target;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            done();
        }
    }

    Object.assign(window.ProductPage.functions, { injectPromo, copyCoupon });
})();

// ================================================================================================
// 5. PRICE-HISTORY CHART (CHART.JS)
// ================================================================================================
(function () {
    const cfg = window.ProductPage.config;

    function renderJSONChart(finalData) {
        try {
            if (!finalData || !finalData.length) return;
            const sel = cfg.selectors;
            const idAttr = (cssSelector) => cssSelector.replace(/^#/, '');
            const currency = cfg.currency.symbol;
            finalData.sort((a, b) => a.rawTime - b.rawTime);
            const tab4 = document.querySelector(sel.external.chartTab);
            const chartCanvas = document.querySelector(sel.external.priceChartCanvas);
            if (!chartCanvas || !tab4) return;

            if (!chartCanvas.parentNode.id.includes('scroll-wrapper')) {
                const scrollContainer = document.createElement('div');
                scrollContainer.id = idAttr(sel.internal.chartScrollWrapper);
                const innerWrapper = document.createElement('div');
                innerWrapper.id = idAttr(sel.internal.chartInnerResizer);
                chartCanvas.parentNode.insertBefore(scrollContainer, chartCanvas);
                innerWrapper.appendChild(chartCanvas);
                scrollContainer.appendChild(innerWrapper);
            }

            const scrollContainer = document.querySelector(sel.internal.chartScrollWrapper);
            const isMobile = window.innerWidth < 768;
            const prices = finalData.map(x => Number(x.price)).filter(p => !isNaN(p));
            if (!prices.length) return;
            const dates = finalData.map(x => x.date);
            const min = Math.min(...prices), max = Math.max(...prices);
            const avg = +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
            const current = prices[prices.length - 1], prev = prices[prices.length - 2] || current;
            const getArrow = (v, c) => v > c ? `<span style="color:#ef4444;">▲</span>` : v < c ? `<span style="color:#10b981;">▼</span>` : '';
            const diffTotal = (current - prev).toFixed(2);
            const statsHtml = `<div class="price-stats"><div class="stat-item current"><strong>السعر الحالي</strong><span style="display:flex; align-items:center; gap:5px;">${current}${currency}${getArrow(current, prev)}</span><small style="font-size:11px;color:#666;">(${diffTotal}${currency})</small></div><div class="stat-item"><strong>المتوسط</strong><span>${avg}${currency}</span></div><div class="stat-item"><strong>أقل سعر</strong><span>${min}${currency}</span></div><div class="stat-item"><strong>أعلى سعر</strong><span>${max}${currency}</span></div></div>`;

            const oldStats = tab4.querySelector('.price-stats');
            if (oldStats) oldStats.remove();
            scrollContainer.insertAdjacentHTML('afterend', statsHtml);

            let tooltipEl = document.querySelector(sel.internal.chartTooltip) || Object.assign(document.createElement('div'), { id: idAttr(sel.internal.chartTooltip) });
            if (!tooltipEl.parentElement) document.body.appendChild(tooltipEl);

            const externalTooltipHandler = (context) => {
                const { chart, tooltip } = context;
                if (tooltip.opacity === 0) {
                    tooltipEl.style.opacity = 0;
                    setTimeout(() => { if (tooltipEl.style.opacity == 0) tooltipEl.style.display = 'none'; }, 200);
                    return;
                }
                tooltipEl.style.display = 'block';
                setTimeout(() => { tooltipEl.style.opacity = 1; }, 10);
                const idx = tooltip.dataPoints[0].dataIndex;
                const val = tooltip.dataPoints[0].raw;
                const pVal = idx > 0 ? prices[idx - 1] : val;
                const diff = +(val - pVal).toFixed(2);
                const perc = pVal !== 0 ? ((diff / pVal) * 100).toFixed(1) : 0;
                const arr = diff > 0 ? `<span style="color:#ef4444;">▲</span>` : diff < 0 ? `<span style="color:#10b981;">▼</span>` : '-';
                tooltipEl.innerHTML = `<div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #555;padding-bottom:4px;">${dates[idx]}</div><div>السعر:${val}${currency}</div><div style="font-size:12px;">التغير:${arr}${diff}(${perc}%)</div>`;
                const pos = chart.canvas.getBoundingClientRect();
                const tooltipWidth = tooltipEl.offsetWidth;
                const screenWidth = window.innerWidth;
                let leftPos = pos.left + window.pageXOffset + tooltip.caretX + 10;
                if (leftPos + tooltipWidth > screenWidth) leftPos = pos.left + window.pageXOffset + tooltip.caretX - tooltipWidth - 10;
                if (leftPos < 0) leftPos = 10;
                tooltipEl.style.left = leftPos + 'px';
                tooltipEl.style.top = (pos.top + window.pageYOffset + tooltip.caretY - 60) + 'px';
            };

            const ctx = chartCanvas.getContext('2d');
            if (window.myPriceChart) window.myPriceChart.destroy();
            window.myPriceChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        data: prices,
                        borderColor: '#ff6000',
                        backgroundColor: (c) => {
                            const a = c.chart.chartArea;
                            if (!a) return null;
                            const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
                            g.addColorStop(0, 'rgba(255, 96, 0, 0.15)');
                            g.addColorStop(1, 'rgba(255, 96, 0, 0)');
                            return g;
                        },
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHitRadius: 20,
                        fill: true,
                        stepped: 'before'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 10, bottom: 10 } },
                    animation: { duration: 400, easing: 'easeOutQuart' },
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { display: false }, tooltip: { enabled: false, external: externalTooltipHandler } },
                    scales: {
                        x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: isMobile ? 5 : 10 }, grid: { display: false } },
                        y: { position: 'right', grace: '15%', ticks: { precision: 2 }, grid: { color: '#f0f0f0', drawBorder: false } }
                    }
                }
            });
            if (isMobile) scrollContainer.scrollLeft = scrollContainer.scrollWidth;
        } catch (e) { console.error(e); }
    }

    window.ProductPage.functions.renderJSONChart = renderJSONChart;
})();

// ================================================================================================
// 6. CHART IMAGE EXPORT (DOWNLOAD / SHARE)
// ================================================================================================
(function () {
    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
        return currentY;
    }

    async function downloadChartAsImage(action = 'download') {
        const cfg = window.ProductPage.config;
        const chartInstance = window.myPriceChart;
        if (!chartInstance) return;
        const canvas = document.querySelector(cfg.selectors.external.priceChartCanvas);
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        const padding = 40;
        const headerHeight = 160;
        tempCanvas.width = canvas.width + (padding * 2);
        tempCanvas.height = canvas.height + headerHeight + padding + 20;
        const isDarkMode = document.body.classList.contains('dm');
        ctx.fillStyle = isDarkMode ? '#121212' : '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        const productName = document.querySelector('h1')?.innerText || 'تقرير الأسعار';
        const countryName = `${cfg.currency.nameAr} ${cfg.currency.flag}`;

        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 28px Arial';
        ctx.fillText('بـورصـة الأسـعـار', tempCanvas.width - padding, 50);
        ctx.fillStyle = isDarkMode ? '#eeeeee' : '#2c3e50';
        ctx.font = 'bold 20px Arial';
        const lastTextY = wrapText(ctx, productName, tempCanvas.width - padding, 90, tempCanvas.width - (padding * 2), 28);
        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('الدولة: ' + countryName, tempCanvas.width - padding, lastTextY + 35);
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '13px Arial';
        const dateStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
        ctx.fillText(window.location.hostname + ' | تحديث ' + dateStr, tempCanvas.width - padding, lastTextY + 60);
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 25;
        ctx.shadowOffsetY = 12;
        ctx.drawImage(canvas, padding, headerHeight);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isDarkMode ? '#333' : '#f0f0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(5, 5, tempCanvas.width - 10, tempCanvas.height - 10);

        const imageBase64 = tempCanvas.toDataURL('image/png', 1.0);
        if (action === 'share' && navigator.share) {
            const response = await fetch(imageBase64);
            const blob = await response.blob();
            const file = new File([blob], `Price-Report.png`, { type: 'image/png' });
            try {
                await navigator.share({ files: [file], title: productName, text: `تقرير أسعار ${productName}\nالمصدر:`, url: window.location.href });
            } catch (err) {}
        } else {
            const downloadLink = document.createElement('a');
            downloadLink.href = imageBase64;
            downloadLink.download = `Price-Report-${cfg.country.toUpperCase()}-${new Date().getTime()}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    }

    const observer = new MutationObserver(() => {
        const cfg = window.ProductPage.config;
        const sel = cfg.selectors;
        const idAttr = (cssSelector) => cssSelector.replace(/^#/, '');
        const stats = document.querySelector('.price-stats');
        if (stats && !document.querySelector(sel.internal.downloadBtnContainer)) {
            const containerHtml = `
                <div id="${idAttr(sel.internal.downloadBtnContainer)}">
                    <button id="btn-download-chart" onclick="window.ProductPage.functions.downloadChartAsImage('download')">
                        <span>📊</span> حفظ الرسم البياني
                    </button>
                    <button id="btn-share-chart" onclick="window.ProductPage.functions.downloadChartAsImage('share')">
                        <span>🔗</span> مشاركة التقرير
                    </button>
                </div>`;
            stats.insertAdjacentHTML('afterend', containerHtml);
            if (!navigator.share) document.getElementById('btn-share-chart').style.display = 'none';
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.ProductPage.functions.downloadChartAsImage = downloadChartAsImage;
})();

// ================================================================================================
// 7. TELEGRAM PRICE-ALERT WIDGET
// ================================================================================================
document.addEventListener('DOMContentLoaded', function () {
    const cfg = window.ProductPage.config;
    const sel = cfg.selectors;
    const idAttr = (cssSelector) => cssSelector.replace(/^#/, '');
    const uidEl = document.querySelector(sel.external.uidElement);
    const box = document.querySelector(sel.external.telegramAlertWrapper);
    if (!uidEl || !box) return;

    const uid = window.ProductPage?.data?.PRODUCT_DATA?.id || uidEl.innerText.trim();
    const countryName = `${cfg.currency.nameAr} ${cfg.currency.flag}`;

    const modalHtml = `
        <div class="is-overlay" id="${idAttr(sel.internal.telegramOverlay)}">
            <div class="is-modal">
                <h3>🔔 تتبع السعر الذكي</h3>
                <p style="font-size:13px;">الدولة المحددة: <b>${countryName}</b></p>
                <label>نسبة خصم سريعة:</label>
                <div class="is-chips">
                    <div class="is-chip" data-pct="10">خصم 10%</div>
                    <div class="is-chip" data-pct="25">خصم 25%</div>
                    <div class="is-chip" data-pct="40">خصم 40%</div>
                </div>
                <label>السعر المستهدف:</label>
                <input type="number" id="isPrice" placeholder="0.00"/>
                <label>الإيميل (اختياري):</label>
                <input type="email" id="isMail" placeholder="your@email.com"/>
                <div class="is-btns">
                    <button id="isGo" class="is-ok">تفعيل في تليجرام</button>
                    <button id="isClose" class="is-no">إلغاء</button>
                </div>
                <span class="is-info">سنرسل لك تنبيهاً فور انخفاض السعر لهذا المستوى.</span>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const btn = document.createElement('button');
    btn.className = 'iseek-btn';
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg> <span>تتبع السعر الآن</span>`;
    btn.onclick = () => { document.querySelector(sel.internal.telegramOverlay).style.display = 'flex'; };
    document.getElementById('isClose').onclick = () => { document.querySelector(sel.internal.telegramOverlay).style.display = 'none'; };

    function getCurrentPrice() {
        const priceEl = document.querySelector(sel.external.priceDiscounted);
        if (!priceEl) return 0;
        const rawText = priceEl.innerText.replace(/,/g, '');
        const match = rawText.match(/\d+(\.\d+)?/);
        return match ? parseFloat(match[0]) : 0;
    }

    document.querySelectorAll('.is-chip').forEach(chip => {
        chip.onclick = function () {
            const currentPrice = getCurrentPrice();
            if (currentPrice > 0) {
                const pct = parseInt(this.getAttribute('data-pct'));
                const target = (currentPrice * (1 - pct / 100)).toFixed(2);
                document.getElementById('isPrice').value = target;
                document.querySelectorAll('.is-chip').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
            }
        };
    });

    document.getElementById('isGo').onclick = async function () {
        const goBtn = this;
        let targetPrice = parseFloat(document.getElementById('isPrice').value) || 0;
        if (!targetPrice || targetPrice <= 0) {
            alert('⚠️ من فضلك أدخل سعر صحيح');
            return;
        }
        goBtn.disabled = true;
        goBtn.innerText = 'جاري التحضير...';
        const payload = {
            uid: uid,
            targetPrice: targetPrice,
            currentPrice: getCurrentPrice(),
            country: cfg.country,
            email: document.getElementById('isMail').value || 'none',
            fingerprint: localStorage.getItem('visitor_id') || 'GUEST',
            recordIdx: window.ProductPage?.data?.PRODUCT_DATA?.recordIndex ?? window.ProductPage?.data?.currentRecordIndex,
            skuIdx: (typeof window.selectedSkuIndex !== 'undefined') ? window.selectedSkuIndex : 255
        };
        try {
            const response = await fetch(cfg.endpoints.telegramAlert, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.token) {
                window.open(`https://t.me/${cfg.endpoints.telegramBot}?start=${result.token}`, '_blank');
                document.querySelector(sel.internal.telegramOverlay).style.display = 'none';
            } else {
                throw new Error();
            }
        } catch (err) {
            alert('⚠️ عذراً، حدث خطأ أثناء الاتصال. حاول مرة أخرى.');
        } finally {
            goBtn.disabled = false;
            goBtn.innerText = 'تفعيل في تليجرام';
        }
    };

    box.appendChild(btn);
});
