/*
 * FILE: controller.js
 * PURPOSE: Drives the search-results grid widget (fetches the binary
 *          feed, hands it to the Worker, renders product cards) and acts
 *          as the bridge that feeds page-load product data (from
 *          window.ProductPage.data, set up in the layout) into make.js's
 *          render functions.
 *
 * KNOWN MIXED RESPONSIBILITY (flagged, not fixed in this pass):
 * The Renderer class below (search-result card rendering) is arguably a
 * separate concern from "controlling" the search widget lifecycle. A
 * future pass could split this into controller.js (lifecycle/bootstrap)
 * + renderer.js (card markup).
 *
 * DEPENDS ON: config.js, ranker.js, worker.js, make.js (for
 * window.ProductPage.functions.injectData / renderSKUs / injectPromo /
 * renderJSONChart / escapeHtml).
 *
 * PUBLIC API: everything here is exposed under window.ProductPage.functions.*.
 * Two bare aliases are kept, both required by files this pass does not
 * touch: window.getCloudPath (read directly by ranker.js) and
 * window.triggerWorkerSearch (read directly by search.js).
 *
 * SECTIONS:
 *   1) Config + state
 *   2) Utilities (cloud path resolution, binary feed fetch/cache)
 *   3) Search-result card renderer
 *   4) Global bridge (updateSKUPrice / resetToInitialData)
 *   5) Search grid engine (worker orchestration, batching, infinite scroll)
 *   6) Bootstrapper (route-change detection, initial page-load wiring)
 */

(function () {
    window.ProductPage = window.ProductPage || {};
    window.ProductPage.functions = window.ProductPage.functions || {};

    const cfg = window.ProductPage.config;
    const sel = cfg.selectors;

    // ================================================================================================
    // 1. CONFIG + STATE
    // ================================================================================================
    const WIDGET_CONFIG = {
        ROOT_ID: sel.external.searchWidgetRoot,
        DOMAIN: window.location.origin + '/',
        BASE_URL: cfg.endpoints.dataBase,
        IMG_BASE_URL: cfg.endpoints.mediaBase,
        PLACEHOLDER: cfg.endpoints.placeholderImg,
        INITIAL_SIZE: cfg.behavior.searchGrid.initialBatchSize,
        BATCH_SIZE: cfg.behavior.searchGrid.loadMoreBatchSize
    };

    const country = cfg.country;
    const currencyConfig = cfg.currency;

    let fileMap = null;

    const WidgetState = {
        activeWorker: null,
        controller: null,
        currentSearchId: 0,
        feedPromise: null,
        isInitializing: false
    };

    // ================================================================================================
    // 2. UTILITIES
    // ================================================================================================

    let mapPromise = null;
    async function loadMap() {
        if (window.fileMap) { fileMap = window.fileMap; return true; }
        if (mapPromise) return mapPromise;
        mapPromise = (async () => {
            try {
                const res = await fetch(`${WIDGET_CONFIG.BASE_URL}general/map.json?v=${Date.now()}`);
                if (res.ok) {
                    window.fileMap = await res.json();
                    fileMap = window.fileMap;
                    return true;
                }
            } catch (e) {}
            mapPromise = null;
            return false;
        })();
        return mapPromise;
    }

    async function getSharedFeedBuffer(path) {
        if (window.sharedFeedBuffer) return window.sharedFeedBuffer;
        if (WidgetState.feedPromise) return WidgetState.feedPromise;
        WidgetState.feedPromise = (async () => {
            try {
                const res = await fetch(`${WIDGET_CONFIG.BASE_URL}${path}`, {
                    signal: WidgetState.controller?.signal
                });
                if (res.ok) {
                    window.sharedFeedBuffer = await res.arrayBuffer();
                    return window.sharedFeedBuffer;
                }
            } catch (e) { if (e.name !== 'AbortError') console.error('Feed Load Error'); }
            WidgetState.feedPromise = null;
            return null;
        })();
        return WidgetState.feedPromise;
    }

    function getCloudPath(type) {
        if (!fileMap) return null;
        if (type === 'core' || type === 'search' || type === 'ids') {
            return `general/${type}_${fileMap[type]}.bin`;
        }
        const hash = fileMap.regions[country]?.[type];
        return hash ? `${country}/${type}_${hash}.bin` : null;
    }

    // ================================================================================================
    // 3. SEARCH-RESULT CARD RENDERER
    // ================================================================================================

    class Renderer {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            this.observer.unobserve(img);
                        }
                    }
                });
            }, { rootMargin: cfg.behavior.searchGrid.imageLazyLoadMargin });
        }

        formatPriceDisplay(val) {
            return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        getDatePath(offset) {
            const d = new Date(Date.UTC(2025, 0, 1) + (offset * 86400000));
            return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
        }

        createCard(product, domain) {
            const feed = product?.feed;
            if (!product || !feed) return null;
            const card = document.createElement('a');

            card.onclick = () => {
                if (window.Ranker) window.Ranker.track(product.recordIndex, feed.price);
            };

            const urlDatePath = this.getDatePath(product.urlDateOffset);
            card.href = `${domain}product/${urlDatePath}/${product.slug}/`;
            card.className = `${sel.internal.productCard.slice(1)} title-link`;

            const imgDatePath = this.getDatePath(product.imgDateOffset);
            const imageUrl = `${WIDGET_CONFIG.IMG_BASE_URL}${imgDatePath}/${product.id}_1.webp`;

            const badgeClass = sel.internal.discountBadge.slice(1);
            let badgeHTML = '';
            const price = this.formatPriceDisplay(feed.price);
            const original = this.formatPriceDisplay(feed.original);
            const deliveryTime = (feed.delivery.min === feed.delivery.max || !feed.delivery.max)
                ? `${feed.delivery.min} يوم`
                : `${feed.delivery.max}-${feed.delivery.min} يوم`;

            if (feed.status.inStock === 0) badgeHTML = `<div class="${badgeClass} out-of-stock">نفذت</div>`;
            else if (feed.status.promo === 1) badgeHTML = `<div class="${badgeClass} promo">عرض خاص</div>`;
            else if (feed.original > feed.price) {
                const discount = Math.round(((feed.original - feed.price) / feed.original) * 100);
                badgeHTML = `<div class="${badgeClass}">-${discount}%</div>`;
            }

            const safeTitle = window.ProductPage.functions.escapeHtml(product.title);

            card.innerHTML = `
            <span class="${sel.external.uidElement.slice(1)}" style="display:none">${product.id}</span>
            <div class="image-container">
                ${badgeHTML}
                <img class="${sel.internal.postImage.slice(1)}" alt="${safeTitle}" src="${WIDGET_CONFIG.PLACEHOLDER}" data-src="${imageUrl}">
                <div class="${sel.internal.cartButton.slice(1)}">
                    <svg class='icon'><use href='${cfg.endpoints.iconsSvg}#i-cart'/></svg>
                </div>
            </div>
            <div class="product-content">
                <h3 class="p-title">${safeTitle}</h3>
                <div class="price-display">
                    <span class="discounted-price">${price} ${currencyConfig.symbol}</span>
                    ${feed.original > feed.price ? `<span class="original-price">${original} ${currencyConfig.symbol}</span>` : ''}
                </div>
                <div class="product-meta-details">
                    <div class="meta-item">★ ${feed.score}</div>
                    <div class="meta-item">${feed.orders.toLocaleString()} تم بيع</div>
                    <div class="meta-item">${deliveryTime}</div>
                </div>
            </div>`;

            const img = card.querySelector(sel.internal.postImage);
            if (img) this.observer.observe(img);
            return card;
        }

        renderBatch(products, domain) {
            const fragment = document.createDocumentFragment();
            const newCards = [];

            let displayedProducts = products;
            if (window.Ranker) displayedProducts = window.Ranker.applyBoost(products);

            displayedProducts.forEach(p => {
                const card = this.createCard(p, domain);
                if (card) {
                    fragment.appendChild(card);
                    newCards.push(card);
                }
            });

            this.container.appendChild(fragment);
            newCards.forEach((card, index) => {
                setTimeout(() => { card.classList.add('revealed'); }, index * cfg.behavior.searchGrid.cardRevealStaggerMs);
            });
        }
    }

    // ================================================================================================
    // 4. GLOBAL BRIDGE (PRODUCT SKU <-> MAKE.JS)
    // ================================================================================================

    window.ProductPage.functions.updateSKUPrice = function(item) {
        window.selectedSkuIndex = item.skuIdx;

        if (window.ProductPage?.data?.PRODUCT_DATA && typeof window.ProductPage?.functions?.injectData === "function") {
            window.ProductPage.functions.injectData({
                ...window.ProductPage.data.PRODUCT_DATA,
                priceOriginal: item.priceOriginal,
                priceDiscounted: item.priceDiscounted,
                shippingFee: item.shippingFee,
                minDelivery: item.minDelivery,
                maxDelivery: item.maxDelivery
            });
        }

        const variantEl = document.querySelector(sel.external.variantValue);
        if (variantEl) variantEl.textContent = item.props;
    };

    window.ProductPage.functions.resetToInitialData = function() {
        if (window.ProductPage?.data?.PRODUCT_DATA && typeof window.ProductPage?.functions?.injectData === "function") {
            window.ProductPage.functions.injectData(window.ProductPage.data.PRODUCT_DATA);
            const variantEl = document.querySelector(sel.external.variantValue);
            if (variantEl) variantEl.textContent = "_";
        }
    };

    // ================================================================================================
    // 5. SEARCH GRID ENGINE
    // ================================================================================================

    async function initSearchWidget() {
        const idAttr = (cssSelector) => cssSelector.replace(/^#/, '');
        const root = document.getElementById(WIDGET_CONFIG.ROOT_ID);
        if (!root) return;
        if (!document.getElementById('widget-revealed-css')) {
            const style = document.createElement('style');
            style.id = 'widget-revealed-css';
            style.textContent = `${sel.internal.productCard}{opacity:0;transform:translateY(15px);transition:opacity 0.5s ease,transform 0.5s ease;}${sel.internal.productCard}.revealed{opacity:1;transform:translateY(0);}`;
            document.head.appendChild(style);
        }
        if (WidgetState.activeWorker) {
            WidgetState.activeWorker.terminate();
            WidgetState.activeWorker = null;
        }
        root.innerHTML = `<div id="${idAttr(sel.internal.productPostsGrid)}" class="product-grid"></div><div id="${idAttr(sel.internal.resultsLoader)}" class="loader-container"><div class="spinner"></div></div><button id="${idAttr(sel.internal.loadMoreBtn)}" class="load-more-btn" style="display:none;">عرض المزيد</button>`;

        if (!await loadMap()) return;
        const feedPath = getCloudPath('feed');
        if (!feedPath) return;
        const sharedFeedBuffer = await getSharedFeedBuffer(feedPath);
        if (!sharedFeedBuffer) return;

        const grid = document.querySelector(sel.internal.productPostsGrid);
        const loader = document.querySelector(sel.internal.resultsLoader);
        const loadMoreBtn = document.querySelector(sel.internal.loadMoreBtn);
        const renderer = new Renderer(idAttr(sel.internal.productPostsGrid));

        let storeData = [];
        let currentIndex = 0;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        WidgetState.activeWorker = new Worker(URL.createObjectURL(blob));

        const displayBatch = async () => {
            const totalToLoad = (currentIndex === 0) ? WIDGET_CONFIG.INITIAL_SIZE : WIDGET_CONFIG.BATCH_SIZE;
            let loadedInRound = 0;
            while (loadedInRound < totalToLoad && currentIndex < storeData.length) {
                const stepSize = Math.min(cfg.behavior.searchGrid.renderSubBatchSize, totalToLoad - loadedInRound);
                const limit = Math.min(currentIndex + stepSize, storeData.length);
                const batch = storeData.slice(currentIndex, limit);
                if (batch.length > 0) {
                    renderer.renderBatch(batch, WIDGET_CONFIG.DOMAIN);
                    currentIndex = limit;
                    loadedInRound += batch.length;
                    await new Promise(r => setTimeout(r, cfg.behavior.searchGrid.renderStepDelayMs));
                } else break;
            }
            loadMoreBtn.style.display = (currentIndex < storeData.length) ? 'block' : 'none';
        };

        WidgetState.activeWorker.onmessage = (e) => {
            if (e.data.searchId !== WidgetState.currentSearchId) return;
            if (e.data.type === 'BATCH') {
                loader.style.display = 'none';
                storeData.push(...e.data.batch);
                if (currentIndex === 0) displayBatch();
                window.postMessage(e.data, location.origin);
            } else if (e.data.type === 'DONE') {
                loader.style.display = 'none';
                if (storeData.length === 0) grid.innerHTML = '<div class="no-results">لا توجد نتائج تطابق بحثك حالياً</div>';
                window.postMessage({ type: 'DONE', core: e.data.core, feed: e.data.feed }, location.origin);
            }
        };

        window.ProductPage.functions.triggerWorkerSearch = async () => {
            grid.innerHTML = '';
            loader.style.display = 'flex';
            loadMoreBtn.style.display = 'none';
            storeData = [];
            currentIndex = 0;
            WidgetState.currentSearchId = Date.now();

            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('query');

            if (query && (!window.searchVariants || window.searchVariants.length === 0)) {
                await new Promise(resolve => {
                    const timeout = setTimeout(resolve, 300);
                    window.addEventListener('SearchTokensReady', () => { clearTimeout(timeout); resolve(); }, { once: true });
                });
            }

            WidgetState.activeWorker.postMessage({
                searchId: WidgetState.currentSearchId,
                baseUrl: WIDGET_CONFIG.BASE_URL,
                corePath: getCloudPath('core'),
                searchPath: getCloudPath('search'),
                feedBuffer: sharedFeedBuffer,
                tokens: window.searchVariants || [],
                storeId: urlParams.get('store'),
                filters: window.currentFilters || null
            });
        };
        window.triggerWorkerSearch = window.ProductPage.functions.triggerWorkerSearch;
        loadMoreBtn.onclick = displayBatch;
        window.triggerWorkerSearch();
    }

    // ================================================================================================
    // 6. BOOTSTRAPPER
    // ================================================================================================

    async function runGlobalBoot() {
        await loadMap();
        if (window.Ranker) window.Ranker.init();
        const root = document.getElementById(WIDGET_CONFIG.ROOT_ID);
        if (!root || WidgetState.isInitializing) return;

        WidgetState.isInitializing = true;
        if (WidgetState.controller) WidgetState.controller.abort();
        WidgetState.controller = new AbortController();

        await initSearchWidget();
        WidgetState.isInitializing = false;
    }

    document.addEventListener('DOMContentLoaded', runGlobalBoot);
    window.addEventListener('popstate', runGlobalBoot);

    let lastPath = location.href;
    ['pushState', 'replaceState'].forEach(meth => {
        const orig = history[meth];
        history[meth] = function () {
            const rv = orig.apply(this, arguments);
            window.dispatchEvent(new Event('locationchange'));
            return rv;
        };
    });

    window.addEventListener('locationchange', () => {
        if (location.href !== lastPath) {
            lastPath = location.href;
            runGlobalBoot();
        }
    });

    window.ProductPage.functions.startWidget = initSearchWidget;
    window.ProductPage.functions.loadMap = loadMap;
    window.ProductPage.functions.getCloudPath = getCloudPath;
    window.getCloudPath = getCloudPath;

    document.addEventListener('DOMContentLoaded', () => {
        if (window.ProductPage?.data?.PRODUCT_DATA && typeof window.ProductPage?.functions?.injectData === 'function') {
            window.ProductPage.functions.injectData(window.ProductPage.data.PRODUCT_DATA);
        }
        if (window.ProductPage?.data?.PRODUCT_SKUS && typeof window.ProductPage?.functions?.renderSKUs === 'function') {
            window.ProductPage.functions.renderSKUs(window.ProductPage.data.PRODUCT_SKUS);
        }
        if (window.ProductPage?.data?.PRODUCT_PROMO && typeof window.ProductPage?.functions?.injectPromo === 'function') {
            window.ProductPage.functions.injectPromo(window.ProductPage.data.PRODUCT_PROMO);
        }
        if (window.ProductPage?.data?.PRODUCT_CHART && typeof window.ProductPage?.functions?.renderJSONChart === 'function') {
            window.ProductPage.functions.renderJSONChart(window.ProductPage.data.PRODUCT_CHART);
        }
    });

})();
