// --- 1. Config & Global Variables ---

(function() {
    const WIDGET_CONFIG = {
        ROOT_ID: 'souq-widget-root',
        DOMAIN: "https://www.iseekprice.com/",
        BASE_URL: "https://data.iseekprice.com/",
        IMG_BASE_URL: "https://media.iseekprice.com/",
        ALI_IMG_BASE: "https://ae-pic-a1.aliexpress-media.com/kf/",
        PLACEHOLDER: "/public/assets/static/save.jpg",
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

    const country = (localStorage.getItem("Cntry") || "SA").toUpperCase();
    const currencyConfig = COUNTRY_MAP[country] || COUNTRY_MAP["SA"];
    
    let initialFullData = null;
    let fileMap = null;

    const WidgetState = {
        activeWorker: null,
        controller: null,
        currentSearchId: 0,
        feedPromise: null,
        isInitializing: false
    };
    
    window.currentRecordIndex = 0;

// --- 2. Utilities ---
    
    const cleanProps = (str) => {
        if (!str) return "_";
        return str.replace(/\|/g, " - ").trim();
    };

    
const updateSchema = (price) => {
        const sc = document.getElementById('product-json-ld');
        if(sc){
            try{
                let d = JSON.parse(sc.text);
                d.offers.price = parseFloat(price).toFixed(2);
                const c = localStorage.getItem("Cntry") || "SA";
                d.offers.priceCurrency = {"SA":"SAR", "AE":"AED", "OM":"OMR", "MA":"MAD", "DZ":"DZD", "TN":"TND"}[c.toUpperCase()] || "SAR";
                
                const imgEl = document.getElementById('mainImage');
                if(imgEl && imgEl.src) d.image = imgEl.src;

                const descEl = document.querySelector('.short-description');
                if(descEl && descEl.textContent) d.description = descEl.textContent.trim();

                sc.text = JSON.stringify(d);
            }catch(e){}
        }
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
    
function injectWarningPopup() {
    const div = document.createElement("div");
    div.style = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#fff;border:1px solid #d93025;padding:15px;border-radius:8px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);direction:rtl;text-align:center;width:280px;font-family:sans-serif;";
    div.innerHTML = `<p style="margin:0 0 10px;color:#d93025;font-weight:bold;font-size:14px;">⚠️ المنتج قد لا يكون متوفراً حالياً</p>
                     <button onclick="this.parentElement.remove()" style="background:#f1f1f1;color:#333;border:none;padding:5px 15px;border-radius:4px;cursor:pointer;font-size:12px;">إغلاق</button>`;
    document.body.appendChild(div);
}

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
        const urlDatePath = this.getDatePath(product.urlDateOffset);
        card.href = `${domain}product/${urlDatePath}/${product.slug}/`;
        card.className = "post-card title-link";
        
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
                <div class="external-cart-button">
                    <svg class='icon'><use href='/public/assets/static/icons.svg#i-cart'/></svg>
                </div>
            </div>
            <div class="post-content">
                <h3 class="post-title">${safeTitle}</h3>
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
        
        products.forEach(p => {
            const card = this.createCard(p, domain);
            if (card) {
                fragment.appendChild(card);
                newCards.push(card);
            }
        });
        
        this.container.appendChild(fragment);

        newCards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('revealed');
            }, index * 15);
        });
    }
}

// --- 4. Single Product Engine ---
    
    async function fetchRange(fileName, start, length, type) {
        if (!fileName) return;
        try {
            const res = await fetch(`${WIDGET_CONFIG.BASE_URL}${fileName}`, { 
                headers: { 'Range': `bytes=${start}-${start + length - 1}` } 
            });
            if (res.status !== 206) return;
            const buffer = await res.arrayBuffer();
            const view = new DataView(buffer);
            const decoder = new TextDecoder("utf-8");

            if (type === "LINKS") {
                const pCode = decoder.decode(new Uint8Array(buffer, 16, 14)).replace(/\0/g, '').trim();
                const sCode = decoder.decode(new Uint8Array(buffer, 30, 14)).replace(/\0/g, '').trim();
                const sName = decoder.decode(new Uint8Array(buffer, 44, 56)).replace(/\0/g, '').trim();
                if (initialFullData) {
                    initialFullData.productAffCode = pCode;
                    initialFullData.storeAffCode = sCode;
                    initialFullData.storeName = sName;
                    if (typeof window.injectData === "function") window.injectData(initialFullData);
                    updateSchema(initialFullData.priceDiscounted);
                }
            } else if (type === "SKU") {
                const skuList = [];
                for (let s = 0; s < 30; s++) {
                    const offset = 8 + (s * 214);
                    if (offset + 214 > buffer.byteLength) break;
                    const pDisc = view.getUint32(offset + 4, true) / 100;
                    if (pDisc === 0) continue;
                    const imgSlug = decoder.decode(new Uint8Array(buffer, offset + 14, 40)).replace(/\0/g, '').trim();
                    const rawProps = decoder.decode(new Uint8Array(buffer, offset + 54, 160)).replace(/\0/g, '').trim();
                    skuList.push({
                        skuIdx: s, priceOriginal: view.getUint32(offset, true) / 100,
                        priceDiscounted: pDisc, shippingFee: view.getUint32(offset + 8, true) / 100,
                        minDelivery: view.getUint8(offset + 12), maxDelivery: view.getUint8(offset + 13),
                        image: WIDGET_CONFIG.ALI_IMG_BASE + imgSlug + (imgSlug.includes('.') ? "" : ".jpg"),
                        props: cleanProps(rawProps)
                    });
                }
                if (typeof window.renderSKUs === "function") window.renderSKUs(skuList);
            } else if (type === "PROMO") {
                if (typeof window.injectPromo === "function") {
                    window.injectPromo({
                        expiry: view.getUint32(8, true), quantity: view.getUint16(12, true),
                        code: decoder.decode(new Uint8Array(buffer, 14, 18)).replace(/\0/g, '').trim()
                    });
                }
            } else if (type === "CHART") {
                if (typeof window.renderBinaryChart === "function") window.renderBinaryChart(buffer);
            }
        } catch (e) {}
    }

    async function initProductEngine() {
        const domUIDStr = document.querySelector(".UID")?.textContent.trim();
        if (!domUIDStr) return;

        if (!await loadMap()) return;
        const feedPath = getCloudPath("feed");
        if (!feedPath) return;

        const buffer = await getSharedFeedBuffer(feedPath);
        if (!buffer) return;

        const view = new DataView(buffer);
        const targetUID = BigInt(domUIDStr);
        const stride = 32;

        for (let i = 0; i < buffer.byteLength; i += stride) {
            if (view.getBigUint64(i, true) === targetUID) {
                const recordIndex = i / stride;
                window.currentRecordIndex = recordIndex;
                const flags = view.getUint8(i + 31);
                const inStock = (flags & 0x20) !== 0;
                
                if (!inStock) injectWarningPopup();

                initialFullData = {
                    storeId: view.getUint32(i + 8, true),
                    priceOriginal: view.getUint32(i + 12, true) / 100,
                    priceDiscounted: view.getUint32(i + 16, true) / 100,
                    shippingFee: view.getUint32(i + 20, true) / 100,
                    orders: view.getUint16(i + 24, true),
                    reviews: view.getUint16(i + 26, true),
                    score: view.getUint8(i + 28) / 10,
                    minDelivery: view.getUint8(i + 29),
                    maxDelivery: view.getUint8(i + 30),
                    sudStatus: flags & 0x1F,
                    isGlobal: inStock,
                    hasSKU: (flags & 0x40) !== 0,
                    hasPromo: (flags & 0x80) !== 0,
                    productAffCode: "", storeAffCode: "", storeName: ""
                };

                if (typeof window.injectData === "function") window.injectData(initialFullData);

                fetchRange(getCloudPath("links"), recordIndex * 100, 100, "LINKS");
                if (initialFullData.hasSKU) fetchRange(getCloudPath("sku"), recordIndex * 6428, 6428, "SKU");
                if (initialFullData.hasPromo) fetchRange(getCloudPath("promo"), recordIndex * 32, 32, "PROMO");
                fetchRange(getCloudPath("fluctuation"), recordIndex * 2932, 2932, "CHART");
                break;
            }
        }
    }
    
    // --- 5. Global Actions (SKU Updates) ---
    
    window.updateSKUPrice = function(item) {
        window.selectedSkuIndex = item.skuIdx;
        if (initialFullData && typeof window.injectData === "function") {
            window.injectData({
                ...initialFullData, priceOriginal: item.priceOriginal,
                priceDiscounted: item.priceDiscounted, shippingFee: item.shippingFee,
                minDelivery: item.minDelivery, maxDelivery: item.maxDelivery
            });
        }

        updateSchema(item.priceDiscounted);
        
        const variantEl = document.querySelector(".variant-value");
        if (variantEl) variantEl.textContent = item.props;
    };

    window.resetToInitialData = function() {
        if (initialFullData && typeof window.injectData === "function") {
            window.injectData(initialFullData);
            const variantEl = document.querySelector(".variant-value");
            if (variantEl) variantEl.textContent = "_";
        }
    };
    
    
// --- 6. Search Grid Engine ---
    
    async function initSearchWidget() {
        const root = document.getElementById(WIDGET_CONFIG.ROOT_ID);
        if (!root) return;

        if (!document.getElementById('widget-revealed-css')) {
            const style = document.createElement('style');
            style.id = 'widget-revealed-css';
            style.textContent = `.post-card{opacity:0;transform:translateY(15px);transition:opacity 0.5s ease,transform 0.5s ease;}.post-card.revealed{opacity:1;transform:translateY(0);}`;
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
            const totalToLoad = (currentIndex === 0) ? WIDGET_CONFIG.INITIAL_SIZE : 150;
            const subBatchSize = 50;
            let loadedInRound = 0;
            while (loadedInRound < totalToLoad && currentIndex < storeData.length) {
                const limit = Math.min(currentIndex + subBatchSize, storeData.length);
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
    
// --- 7. Bootstrapper ---

async function runGlobalBoot() {
        const root = document.getElementById(WIDGET_CONFIG.ROOT_ID);
        if (!root || WidgetState.isInitializing) return;

        WidgetState.isInitializing = true;

        if (WidgetState.controller) WidgetState.controller.abort();
        WidgetState.controller = new AbortController();

        const productEl = document.querySelector(".UID");
        const currentUID = productEl?.textContent.trim();
        
        if (productEl) {
            if (document.body.dataset.lastProductUid !== currentUID) {
                document.body.dataset.lastProductUid = currentUID;
                await initProductEngine();
            }
        } else {
            delete document.body.dataset.lastProductUid;
        }

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

})();
