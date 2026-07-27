
(function() {
    const WIDGET_CONFIG = {
        ROOT_ID: 'souq-widget-root',
        DOMAIN: window.location.origin + "/",
        BASE_URL: "https://data.iseekprice.com/",
        IMG_BASE_URL: "https://media.iseekprice.com/",
        ALI_IMG_BASE: "https://ae-pic-a1.aliexpress-media.com/kf/",
        PLACEHOLDER: "/public/assets/static/save.webp",
        INITIAL_SIZE: 20,
        BATCH_SIZE: 150
    };

    const COUNTRY_MAP = {
        "SA": { symbol: "ر.س" },
        "AE": { symbol: "د.إ" },
        "OM": { symbol: "ر.ع" },
        "MA": { symbol: "د.م" },
        "DZ": { symbol: "د.ج" },
        "TN": { symbol: "د.ت" }
    };

    const hostMatch = window.location.hostname.match(/^(sa|ae|om|ma|dz|tn)\./i);
    const country = hostMatch ? hostMatch[1].toLowerCase() : "sa";
    const currencyConfig = COUNTRY_MAP[country] || COUNTRY_MAP["SA"];
    
    let fileMap = null;

    const WidgetState = {
        activeWorker: null,
        controller: null,
        currentSearchId: 0,
        feedPromise: null,
        isInitializing: false
    };

    // --- 2. Utilities ---
    
    const cleanProps = (str) => {
        if (!str) return "_";
        return str.replace(/\|/g, " - ").trim();
    };

    let mapPromise = null;
    async function loadMap() {
        if (window.fileMap) { fileMap = window.fileMap; return true; }
        if (mapPromise) return mapPromise;
        mapPromise = (async () => {
            try {
                const res = await fetch(`${WIDGET_CONFIG.BASE_URL}General/map.json?v=${Date.now()}`);
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
            } catch (e) { if (e.name !== 'AbortError') console.error("Feed Load Error"); }
            WidgetState.feedPromise = null;
            return null;
        })();
        return WidgetState.feedPromise;
    }

    function getCloudPath(type) {
        if (!fileMap) return null;
        if (type === "core" || type === "search" || type === "ids") {
            return `General/${type}_${fileMap[type]}.bin`;
        }
        const hash = fileMap.regions[country]?.[type];
        return hash ? `${country}/${type}_${hash}.bin` : null;
    }

// --- 3. UI Components ---
    
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
        }, { rootMargin: "150px" });
    }

    formatPriceDisplay(val) {
        return parseFloat(val).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    getDatePath(offset) {
        const d = new Date(Date.UTC(2025, 0, 1) + (offset * 86400000));
        return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    
    createCard(product, domain) {
        const feed = product?.feed;
        if (!product || !feed) return null;
        const card = document.createElement("a");

        card.onclick = () => {
        if (window.Ranker) window.Ranker.track(product.recordIndex, feed.price);
          };
        
        const urlDatePath = this.getDatePath(product.urlDateOffset);
        card.href = `${domain}product/${urlDatePath}/${product.slug}/`;
        card.className = "product-card title-link";
        
        const imgDatePath = this.getDatePath(product.imgDateOffset);
        const imageUrl = `${WIDGET_CONFIG.IMG_BASE_URL}${imgDatePath}/${product.id}_1.webp`;
        
        let badgeHTML = '';
        const price = this.formatPriceDisplay(feed.price);
        const original = this.formatPriceDisplay(feed.original);
        const deliveryTime = (feed.delivery.min === feed.delivery.max || !feed.delivery.max) 
            ? `${feed.delivery.min} يوم` 
            : `${feed.delivery.max}-${feed.delivery.min} يوم`;

        if (feed.status.inStock === 0) badgeHTML = '<div class="discount-badge out-of-stock">نفذت</div>';
        else if (feed.status.promo === 1) badgeHTML = '<div class="discount-badge promo">عرض خاص</div>';
        else if (feed.original > feed.price) {
            const discount = Math.round(((feed.original - feed.price) / feed.original) * 100);
            badgeHTML = `<div class="discount-badge">-${discount}%</div>`;
        }
        
        const safeTitle = product.title.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));

        card.innerHTML = `
            <span class="UID" style="display:none">${product.id}</span>
            <div class="image-container">
                ${badgeHTML}
                <img class="post-image" alt="${safeTitle}" src="${WIDGET_CONFIG.PLACEHOLDER}" data-src="${imageUrl}">
                <div class="cart-button">
                    <svg class='icon'><use href='/public/assets/static/icons.svg#i-cart'/></svg>
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
        
        const img = card.querySelector('.post-image');
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
        setTimeout(() => { card.classList.add('revealed'); }, index * 15);
    });
  }
}

// --- 4. Global Actions ---
    
    window.updateSKUPrice = function(item) {
        window.selectedSkuIndex = item.skuIdx;
        
        if (window.PRODUCT_DATA && typeof window.injectData === "function") {
            window.injectData({
                ...window.PRODUCT_DATA, 
                priceOriginal: item.priceOriginal,
                priceDiscounted: item.priceDiscounted, 
                shippingFee: item.shippingFee,
                minDelivery: item.minDelivery, 
                maxDelivery: item.maxDelivery
            });
        }
        
        const variantEl = document.querySelector(".variant-value");
        if (variantEl) variantEl.textContent = item.props;
    };

    window.resetToInitialData = function() {
        if (window.PRODUCT_DATA && typeof window.injectData === "function") {
            window.injectData(window.PRODUCT_DATA);
            const variantEl = document.querySelector(".variant-value");
            if (variantEl) variantEl.textContent = "_";
        }
    };
    
// --- 5. Search Grid Engine ---
    
    async function initSearchWidget() {
        const root = document.getElementById(WIDGET_CONFIG.ROOT_ID);
        if (!root) return;
        if (!document.getElementById('widget-revealed-css')) {
            const style = document.createElement('style');
            style.id = 'widget-revealed-css';
            style.textContent = `.product-card{opacity:0;transform:translateY(15px);transition:opacity 0.5s ease,transform 0.5s ease;}.product-card.revealed{opacity:1;transform:translateY(0);}`;
            document.head.appendChild(style);
        }
        if (WidgetState.activeWorker) {
            WidgetState.activeWorker.terminate();
            WidgetState.activeWorker = null;
        }
        root.innerHTML = `<div id="product-posts" class="product-grid"></div><div id="loader" class="loader-container"><div class="spinner"></div></div><button id="load-more" class="load-more-btn" style="display:none;">عرض المزيد</button>`;
        
             if (!await loadMap()) return;
             const feedPath = getCloudPath("feed");
             if (!feedPath) return;
             const sharedFeedBuffer = await getSharedFeedBuffer(feedPath);
             if (!sharedFeedBuffer) return;

            const grid = document.getElementById('product-posts');
            const loader = document.getElementById('loader');
            const loadMoreBtn = document.getElementById('load-more');
            const renderer = new Renderer('product-posts');
        
            let storeData = [];
            let currentIndex = 0;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            WidgetState.activeWorker = new Worker(URL.createObjectURL(blob));

            const displayBatch = async () => {
            const totalToLoad = (currentIndex === 0) ? WIDGET_CONFIG.INITIAL_SIZE : WIDGET_CONFIG.BATCH_SIZE;
            let loadedInRound = 0;
            while (loadedInRound < totalToLoad && currentIndex < storeData.length) {
            const stepSize = Math.min(50, totalToLoad - loadedInRound);
            const limit = Math.min(currentIndex + stepSize, storeData.length);
            const batch = storeData.slice(currentIndex, limit);
            if (batch.length > 0) {
            renderer.renderBatch(batch, WIDGET_CONFIG.DOMAIN);
            currentIndex = limit;
            loadedInRound += batch.length;
            await new Promise(r => setTimeout(r, 50));
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

            window.triggerWorkerSearch = async () => {
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
                corePath: getCloudPath("core"),
                searchPath: getCloudPath("search"),
                feedBuffer: sharedFeedBuffer,
                tokens: window.searchVariants || [],
                storeId: urlParams.get('store'),
                filters: window.currentFilters || null
            });
        };
        loadMoreBtn.onclick = displayBatch;
        window.triggerWorkerSearch();
    }
    
// --- 6. Bootstrapper ---
    
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

    document.addEventListener("DOMContentLoaded", runGlobalBoot);
    window.addEventListener("popstate", runGlobalBoot);
    
    let lastPath = location.href;
    ['pushState', 'replaceState'].forEach(meth => {
        const orig = history[meth];
        history[meth] = function() {
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
    
    window.startWidget = initSearchWidget;
    window.loadMap = loadMap;
    window.getCloudPath = getCloudPath;

    document.addEventListener('DOMContentLoaded', () => {
        if (window.PRODUCT_DATA && typeof window.injectData === 'function') {
            window.injectData(window.PRODUCT_DATA);
        }
        if (window.PRODUCT_SKUS && typeof window.renderSKUs === 'function') {
            window.renderSKUs(window.PRODUCT_SKUS);
        }
        if (window.PRODUCT_PROMO && typeof window.injectPromo === 'function') {
            window.injectPromo(window.PRODUCT_PROMO);
        }
        if (window.PRODUCT_CHART && typeof window.renderJSONChart === 'function') {
            window.renderJSONChart(window.PRODUCT_CHART);
        }
    });

})();
