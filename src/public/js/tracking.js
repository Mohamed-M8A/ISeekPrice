/*
 * FILE: tracking.js
 * PURPOSE: First-party analytics — visitor/session identity and event
 *          batching, sent to the analytics endpoint via sendBeacon.
 *
 * EXTRACTED FROM: corepress.js (previously mixed with header/footer/theme
 * injection). Split out so this can be developed and tested independently
 * without touching site-chrome code, and vice versa.
 *
 * DEPENDS ON: config.js (must load before this file).
 *
 * SECTIONS:
 *   1) Visitor ID manager (persistent, localStorage)
 *   2) Session ID manager (per-tab, sessionStorage)
 *   3) ISeekTracker — event queue + flush logic
 */

(function () {
    'use strict';

    const cfg = window.ProductPage.config;

    // ================================================================================================
    // 1. VISITOR ID MANAGER
    // ================================================================================================
    const visitorManager = {
        generate() {
            return `${Date.now()}-${Math.random().toString(36).substring(2, 9).toLowerCase()}-${Math.random().toString(36).substring(2, 9).toLowerCase()}`;
        },
        getPersistentId() {
            let id = localStorage.getItem('visitor_id');
            if (!id) {
                id = this.generate();
                localStorage.setItem('visitor_id', id);
            }
            return id;
        }
    };

    // ================================================================================================
    // 2. SESSION ID MANAGER
    // ================================================================================================
    const sessionManager = {
        generate() {
            return `${Date.now()}-${Math.random().toString(36).substring(2, 9).toLowerCase()}`;
        },
        getSessionId() {
            let id = sessionStorage.getItem('session_id');
            if (!id) {
                id = this.generate();
                sessionStorage.setItem('session_id', id);
            }
            return id;
        }
    };

    // ================================================================================================
    // 3. ISEEKTRACKER: QUEUE + FLUSH
    // ================================================================================================
    const ISeekTracker = {
        queue: [],
        startTime: Date.now(),
        config: {
            workerUrl: cfg.endpoints.analytics,
            country: cfg.country
        },

        getDeviceInfo() {
            const ua = navigator.userAgent;
            let type = 'desktop';
            if (/tablet|ipad|playbook|silk/i.test(ua)) type = 'tablet';
            else if (/mobile|android|iphone|ipod|iemobile|blackberry|kindle|opera mini/i.test(ua)) type = 'mobile';
            return { type, res: `${screen.width}x${screen.height}` };
        },

        pushEvent(eventType, detail = '', destination = '') {
            this.queue.push({
                'event-type': eventType,
                'detail': detail,
                'destination': destination,
                'timestamp': Date.now()
            });
        },

        flush() {
            if (this.queue.length === 0) return;
            const duration = Math.floor((Date.now() - this.startTime) / 1000);
            const device = this.getDeviceInfo();
            const payload = {
                'visitor-id': visitorManager.getPersistentId(),
                'session-id': sessionManager.getSessionId(),
                'duration': duration,
                'country': this.config.country,
                'path': window.location.pathname,
                'referrer': document.referrer || 'direct',
                'product-id': document.querySelector(cfg.selectors.external.uidElement)?.innerText.trim() || 'none',
                'user-agent': navigator.userAgent,
                'device-type': device.type,
                'screen-resolution': device.res,
                'events': this.queue
            };
            const data = JSON.stringify(payload);
            if (navigator.sendBeacon) {
                const blob = new Blob([data], { type: 'application/json' });
                navigator.sendBeacon(this.config.workerUrl, blob);
            } else {
                fetch(this.config.workerUrl, {
                    method: 'POST',
                    body: data,
                    keepalive: true,
                    headers: { 'Content-Type': 'application/json' }
                }).catch(() => {});
            }
            this.queue = [];
        },

        init() {
            this.pushEvent('view');
            document.addEventListener('click', (e) => {
                const el = e.target.closest('a, button, .add-to-cart, .cart-button');
                if (el) {
                    const info = el.innerText.trim() || el.ariaLabel || el.className || 'click';
                    const destination = el.tagName === 'A' ? el.href : '';
                    this.pushEvent('click', info.substring(0, 50), destination);
                    if (destination && !destination.includes(window.location.hostname)) {
                        this.flush();
                    }
                }
            });
            window.addEventListener('pagehide', () => this.flush());
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') this.flush();
            });
        }
    };

    window.ProductPage.tracker = ISeekTracker;
    ISeekTracker.init();
})();
