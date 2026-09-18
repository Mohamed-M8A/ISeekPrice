/*
 * FILE: config.js
 * PURPOSE: Single source of truth for the entire site's JS layer.
 *
 * WHY THIS FILE EXISTS:
 * Country/currency data, DOM selectors, and magic numbers used to be
 * scattered and duplicated across corepress.js, controller.js and
 * make.js. This file centralizes ALL of it. Every other script should
 * READ from window.ProductPage.config — never redefine its own copy.
 *
 * LOAD ORDER: this file MUST be the first <script> tag loaded, before
 * corepress.js, tracking.js, ranker.js, make.js, controller.js, search.js.
 *
 * SECTIONS:
 *   1) Namespace bootstrap
 *   2) Country / currency map
 *   3) Shared API endpoints
 *   4) DOM selectors — external (theme-editable) vs internal (script-owned)
 *   5) Behavior constants — timings, thresholds, colors
 */

(function () {
    'use strict';

    // ================================================================================================
    // 1. NAMESPACE BOOTSTRAP
    // ================================================================================================
    // 🏠 Everyone else moves in here instead of squatting on window.* directly.
    // Keeps us from colliding with ads/analytics scripts that also love
    // generic global names. functions/ holds callable code, data/ holds
    // the per-page product data mirror set up in the layout.
    window.ProductPage = window.ProductPage || {};
    window.ProductPage.functions = window.ProductPage.functions || {};

    // ================================================================================================
    // 2. COUNTRY / CURRENCY MAP
    // ================================================================================================
    // 🌍 Adding a 7th country? This is the ONLY place to touch.
    const COUNTRY_MAP = {
        sa: { symbol: 'ر.س', nameAr: 'السعودية', flag: '🇸🇦', rate: 1 },
        ae: { symbol: 'د.إ', nameAr: 'الإمارات', flag: '🇦🇪', rate: 0.98 },
        om: { symbol: 'ر.ع', nameAr: 'عُمان', flag: '🇴🇲', rate: 0.10 },
        ma: { symbol: 'د.م', nameAr: 'المغرب', flag: '🇲🇦', rate: 2.70 },
        dz: { symbol: 'د.ج', nameAr: 'الجزائر', flag: '🇩🇿', rate: 36.00 },
        tn: { symbol: 'د.ت', nameAr: 'تونس', flag: '🇹🇳', rate: 0.83 }
    };
    const DEFAULT_COUNTRY = 'sa';

    function detectCountry() {
        const match = window.location.hostname.match(/^(sa|ae|om|ma|dz|tn)\./i);
        return match ? match[1].toLowerCase() : DEFAULT_COUNTRY;
    }

    const activeCountryCode = detectCountry();
    const activeCountry = COUNTRY_MAP[activeCountryCode] || COUNTRY_MAP[DEFAULT_COUNTRY];

    // ================================================================================================
    // 3. SHARED API ENDPOINTS
    // ================================================================================================
    // 🔌 Every fetch() URL in the codebase should trace back to here.
    const ENDPOINTS = {
        dataBase: 'https://data.iseekprice.com/',
        mediaBase: 'https://media.iseekprice.com/',
        aliImageBase: 'https://ae-pic-a1.aliexpress-media.com/kf/',
        analytics: 'https://analytics.iseekprice.com',
        telegramAlert: 'https://notify.iseekprice.com/submit-alert',
        telegramBot: 'ISeekPrice_bot',
        weightsJson: '/public/json/weights.json',
        synonymsJson: '/public/json/key.json',
        placeholderImg: '/public/assets/static/save.webp',
        iconsSvg: '/public/assets/static/icons.svg'
    };

    // ================================================================================================
    // 4. DOM SELECTORS
    // ================================================================================================
    // Two very different kinds of selectors live here — keep them apart:
    //
    // 🎯 EXTERNAL — points to elements a THEME AUTHOR places in their own
    //    page template (product page markup, header/footer anchor points).
    //    Porting this script to another site? These are what you edit.
    //
    // 🔒 INTERNAL — elements these scripts create AND consume themselves
    //    (modals, dropdowns, generated cards...). Nobody outside this
    //    codebase touches them. You CAN rename them, but the matching
    //    CSS in style.css is written against these exact values — change
    //    both together, or the UI will silently lose its styling.
    const SELECTORS = {
        external: {
            // Product gallery
            thumbTrack: '.track-x',
            thumbSlider: '.track-s',
            mainImage: '#mainImage',

            // Pricing / product data display
            priceDiscounted: '.price-discounted',
            priceOriginal: '.price-original',
            priceSaving: '.price-saving',
            discountPercentage: '.discount-percentage',
            feeValue: '.fee-value',
            timeValue: '.time-value',
            variantValue: '.variant-value',
            ordersCount: '.orders-count',
            starsContainer: '#stars',
            ratingValue: '#ratingValue',
            reviewsCount: '#reviewsCount',
            moreReviewsLink: '.more-reviews-link a',
            buyButton: '.buy-button',
            storeBarWrapper: '#store-bar-wrapper',
            uidElement: '.UID',

            // Promo coupon anchor point
            dynamicShelf: '#dynamic-shelf',
            couponContainer: '.coupon-container',

            // Price chart
            priceChartCanvas: '#priceChart',
            chartTab: '#tab4',

            // Telegram price-alert anchor point
            telegramAlertWrapper: '#telegram-alert-wrapper',

            // Search widget mount point
            searchWidgetRoot: 'souq-widget-root', // used with getElementById — no #

            // Site chrome anchor points (corepress.js injects into these)
            logoWrap: '#logo-wrap',
            searchWrap: '#search-wrap',
            actionsWrap: '#actions-wrap',
            widgetTopbar: '#widget-topbar',
            widgetSidebar: '#widget-sidebar',
            footer: '#footer',

            // Share modal
            shareOpenBtn: '#shareOpenBtn',

            // Written directly in the product-page template, not generated
            // by any script (confirmed by reading the live template)
            skuHubBtn: '#skuHubBtn',
            addToCartButton: '.add-to-cart'
        },

        internal: {
            // Header widgets corepress.js builds & wires up itself
            darkToggler: '#dark-toggler',
            countryDropdown: '#countryDropdown',
            cartWidgetHeader: '#cart-widget-header',
            cartCount: '#cart-count',

            // Cart trigger elements (found inside generated card / product markup)
            cartButton: '.cart-button',
            productCard: '.product-card',
            discountBadge: '.discount-badge',
            postImage: '.post-image',

            // Lightbox modal (make.js builds it via insertAdjacentHTML)
            imageModal: '#imageModal',
            modalImage: '#modalImage',

            // SKU hub overlay
            skuHubOverlay: '#skuHubOverlay',
            skuTrack: '#skuTrack',

            // Promo coupon
            couponCode: '#couponCode',

            // Price chart internals
            chartScrollWrapper: '#chart-scroll-wrapper',
            chartInnerResizer: '#chart-inner-resizer',
            chartTooltip: '#chart-tooltip',
            downloadBtnContainer: '#btn-download-container',

            // Telegram alert modal
            telegramOverlay: '#isOverlay',

            // Search results grid (controller.js builds this markup itself)
            productPostsGrid: '#product-posts',
            resultsLoader: '#loader',
            loadMoreBtn: '#load-more',

            // Share modal
            shareModal: '#shareModal'
        }
    };

    // ================================================================================================
    // 5. BEHAVIOR CONSTANTS
    // ================================================================================================
    // ⏱️ Timings, thresholds, and colors that used to be "magic numbers"
    // buried inside function bodies. Tweak the FEEL of the site from here
    // without hunting through every file.
    const BEHAVIOR = {
        gallery: {
            thumbScrollPx: 240          // 🖼️ how far the thumbnail strip scrolls per arrow click
        },
        skuHub: {
            scrollPx: 300               // how far the variant-card strip scrolls per arrow click
        },
        tabsBootstrap: {
            pollIntervalMs: 100,        // how often we check if tab buttons have rendered yet
            giveUpAfterMs: 5000         // stop polling after this long (something's wrong)
        },
        searchGrid: {
            initialBatchSize: 20,       // cards rendered on first paint
            loadMoreBatchSize: 150,     // cards rendered per "load more" click
            renderSubBatchSize: 50,     // cards rendered per animation-frame chunk within a batch
            renderStepDelayMs: 50,      // pause between render sub-batches (keeps scroll smooth)
            cardRevealStaggerMs: 15,    // stagger between each card's fade-in animation
            imageLazyLoadMargin: '150px' // IntersectionObserver rootMargin for lazy images
        },
        backToTop: {
            showAfterScrollPx: 800      // ⬆️ button appears once you've scrolled this far down
        },
        toast: {
            durationMs: 3000,           // 🍞 how long a cart toast stays visible
            fadeInMs: 50,
            fadeOutMs: 400
        },
        promo: {
            // 🎨 banner picks a random accent color from this palette each time
            bannerColors: ['#ff4757', '#e91e63', '#ff6b81', '#ff5722']
        },
        priceSavingsColorTiers: [
            // 💰 "you saved X" text color, tiered by the saved amount
            // (normalized by currency.rate so tiers feel right in every country)
            { maxAmount: 100, color: '#16a085' },
            { maxAmount: 400, color: '#1abc9c' },
            { maxAmount: 600, color: '#3498db' },
            { maxAmount: 900, color: '#2ecc71' },
            { maxAmount: 1200, color: '#e67e22' },
            { maxAmount: 1600, color: '#c0392b' },
            { maxAmount: 2000, color: '#f5008b' },
            { maxAmount: 3000, color: '#8e44ad' },
            { maxAmount: Infinity, color: '#FFD700' } // 🔥 fire-gif kicks in around here too
        ],
        fireGifThreshold: 500 // weighted savings amount where the 🔥 gif appears next to "you saved"
    };

    // --- Expose everything under the namespace --------------------------
    window.ProductPage.config = {
        countryMap: COUNTRY_MAP,
        country: activeCountryCode,
        currency: activeCountry,
        endpoints: ENDPOINTS,
        selectors: SELECTORS,
        behavior: BEHAVIOR
    };
})();
