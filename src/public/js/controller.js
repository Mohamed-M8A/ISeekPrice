/*
 * FILE: controller.js
 * PURPOSE: Drives the search-results grid widget (fetches the binary
 *          feed, spins up worker.js as a real Worker file, orchestrates
 *          renderer.js to draw product cards) and acts as the bridge
 *          that feeds page-load product data (from
 *          window.ProductPage.data, set up in the layout) into make.js's
 *          render functions.
 *
 * NOTE: The search-result card renderer used to live here as a class.
 * It has been split out into renderer.js (a separate concern: "how a
 * card looks" vs. "controlling the search widget lifecycle"). This file
 * instantiates it via window.ProductPage.functions.Renderer.
 *
 * DEPENDS ON: config.js, ranker.js, renderer.js, make.js (for
 * window.ProductPage.functions.injectData / renderSKUs / injectPromo /
 * renderJSONChart). worker.js is NOT a page dependency here — it is
 * loaded on demand as a real Worker file via `new Worker(...)`, not as
 * a <script> tag.
 *
 * PUBLIC API: everything here is exposed under window.ProductPage.functions.*.
 * Two bare aliases are kept, both required by files this pass does not
 * touch: window.getCloudPath (read directly by ranker.js) and
 * window.triggerWorkerSearch (read directly by search.js).
 *
 * SECTIONS:
 *   1) Config + state
 *   2) Utilities (cloud path resolution, binary feed fetch/cache)
 *   3) Global bridge (updateSKUPrice / resetToInitialData)
 *   4) Search grid engine (worker orchestration, batching, infinite scroll)
 *   5) Bootstrapper (route-change detection, initial page-load wiring)
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
        INITIAL_SIZE: cfg.behavior.searchGrid.initialBatchSize,
        BATCH_SIZE: cfg.behavior.searchGrid.loadMoreBatchSize
    };

    const country = cfg.country;

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
    // 3. GLOBAL BRIDGE (PRODUCT SKU <-> MAKE.JS)
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
    // 4. SEARCH GRID ENGINE
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
        const renderer = new window.ProductPage.functions.Renderer(idAttr(sel.internal.productPostsGrid));

        let storeData = [];
        let currentIndex = 0;

        WidgetState.activeWorker = new Worker('/public/js/worker.js');

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
    // 5. BOOTSTRAPPER
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
