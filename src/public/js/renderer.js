/*
 * FILE: renderer.js
 * PURPOSE: Builds and renders individual search-result product cards
 *          (image, badge, price, meta row) into the search grid, with
 *          lazy image loading via IntersectionObserver. Extracted out
 *          of controller.js, which was mixing "search widget lifecycle"
 *          with "how a card looks" — two different concerns.
 *
 * DEPENDS ON: config.js (selectors, currency, endpoints, behavior) and
 * make.js (for window.ProductPage.functions.escapeHtml).
 *
 * PUBLIC API: exposes the Renderer class as
 * window.ProductPage.functions.Renderer. controller.js instantiates it
 * with `new window.ProductPage.functions.Renderer(containerId)`.
 */
(function () {
    window.ProductPage = window.ProductPage || {};
    window.ProductPage.functions = window.ProductPage.functions || {};

    const cfg = window.ProductPage.config;
    const sel = cfg.selectors;
    const currencyConfig = cfg.currency;

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
            const imageUrl = `${cfg.endpoints.mediaBase}${imgDatePath}/${product.id}_1.webp`;

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
                <img class="${sel.internal.postImage.slice(1)}" alt="${safeTitle}" src="${cfg.endpoints.placeholderImg}" data-src="${imageUrl}">
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

    window.ProductPage.functions.Renderer = Renderer;
})();
