const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async function() {
    const country = (process.env.COUNTRY || 'sa').toLowerCase();
    const baseUrl = 'https://data.iseekprice.com/';

    const RECORD_SIZE = 9400;
    const FEED_OFFSET = 8;
    const PROMO_OFFSET = 32;
    const SKU_OFFSET = 56;
    const FLUX_OFFSET = 6476;

    const fetchBufWithRetry = async (url, retries = 10, delayMs = 2000) => {
        if (!url) return Buffer.alloc(0);

        for (let i = 1; i <= retries; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json, application/octet-stream, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache'
                    }
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    return Buffer.from(arrayBuffer);
                } else {
                    console.log(`[Fetch Attempt ${i} - Bad Status]: ${response.status} for ${url}`);
                }
            } catch (err) {
                console.log(`[Fetch Attempt ${i} Failed]: ${url} - ${err.message}`);
            }
            if (i < retries) await delay(delayMs);
        }
        throw new Error(`Fetch failed after 10 retries: ${url}`);
    };

    try {
        const mapUrl = `${baseUrl}general/map.json?v=${Date.now()}`;
        let mapBuf;

        try {
            mapBuf = await fetchBufWithRetry(mapUrl);
        } catch (mapError) {
            console.error(`خطأ في جلب ملف الخريطة الرئيسي: ${mapError.message}`);
            return [];
        }

        const map = JSON.parse(mapBuf.toString('utf8'));
        const region = map.regions[country];

        const coreUrl = `${baseUrl}general/core_${map.core}.bin`;
        const linksUrl = region && region.links ? `${baseUrl}${country}/links_${region.links}.bin` : null;
        const buildUrl = region && region.build ? `${baseUrl}${country}/build_${region.build}.bin` : null;

        const [coreBuf, linksBuf, buildBuf] = await Promise.all([
            fetchBufWithRetry(coreUrl),
            fetchBufWithRetry(linksUrl),
            fetchBufWithRetry(buildUrl)
        ]);

        const products = new Map();

        for (let i = 0; i < coreBuf.length; i += 280) {
            const id = coreBuf.readBigUInt64LE(i).toString();
            const rawSlug = coreBuf.toString('utf8', i + 16, i + 80).replace(/\0/g, '').trim();
            const cleanSlug = rawSlug.toLowerCase();
            const productTitle = coreBuf.toString('utf8', i + 80, i + 280).replace(/\0/g, '').trim();
            const autoMetaDescription = `اكتشف سعر ومواصفات ${productTitle} وتتبع حركة الأسعار، الخصومات، والتقييمات المتوفرة في السوق حالياً لشراء ذكي بأفضل قيمة.`.substring(0, 155);

            products.set(id, {
                id: id,
                recordIndex: i / 280,
                slug: cleanSlug,
                title: productTitle,
                metaDescription: autoMetaDescription,
                skus: [],
                promo: null,
                chart: []
            });
        }

        for (let i = 0; i < linksBuf.length; i += 100) {
            const id = linksBuf.readBigUInt64LE(i).toString();
            if (products.has(id)) {
                const item = products.get(id);
                item.productAffCode = linksBuf.toString('utf8', i + 16, i + 30).replace(/\0/g, '').trim();
                item.storeAffCode = linksBuf.toString('utf8', i + 30, i + 44).replace(/\0/g, '').trim();
                item.storeName = linksBuf.toString('utf8', i + 44, i + 100).replace(/\0/g, '').trim();
            }
        }

        for (let i = 0; i + RECORD_SIZE <= buildBuf.length; i += RECORD_SIZE) {
            const id = buildBuf.readBigUInt64LE(i).toString();
            if (!products.has(id)) continue;
            const item = products.get(id);

            const fo = i + FEED_OFFSET;
            const status = buildBuf.readUInt8(fo + 23);
            const hasPromo = (status & 0x80) !== 0;
            const hasSku = (status & 0x40) !== 0;

            Object.assign(item, {
                storeId: buildBuf.readUInt32LE(fo),
                priceOriginal: buildBuf.readUInt32LE(fo + 4) / 100,
                priceDiscounted: buildBuf.readUInt32LE(fo + 8) / 100,
                shippingFee: buildBuf.readUInt32LE(fo + 12) / 100,
                orders: buildBuf.readUInt16LE(fo + 16),
                reviews: buildBuf.readUInt16LE(fo + 18),
                score: buildBuf.readUInt8(fo + 20) / 10,
                minDelivery: buildBuf.readUInt8(fo + 21),
                maxDelivery: buildBuf.readUInt8(fo + 22),
                inStock: (status & 0x20) !== 0,
                hasSku: hasSku,
                hasPromo: hasPromo
            });

            if (hasPromo) {
                const po = i + PROMO_OFFSET;
                item.promo = {
                    expiry: buildBuf.readUInt32LE(po),
                    quantity: buildBuf.readUInt16LE(po + 4),
                    code: buildBuf.toString('utf8', po + 6, po + 24).replace(/\0/g, '').trim()
                };
            }

            if (hasSku) {
                for (let s = 0; s < 30; s++) {
                    const so = i + SKU_OFFSET + (s * 214);
                    const pDisc = buildBuf.readUInt32LE(so + 4) / 100;
                    if (pDisc === 0) continue;

                    const imgSlug = buildBuf.toString('utf8', so + 14, so + 54).replace(/\0/g, '').trim();
                    const rawProps = buildBuf.toString('utf8', so + 54, so + 214).replace(/\0/g, '').trim();
                    const props = rawProps ? rawProps.replace(/\|/g, " - ").trim() : "_";
                    const image = "https://ae-pic-a1.aliexpress-media.com/kf/" + imgSlug + (imgSlug.includes('.') ? "" : ".jpg");

                    item.skus.push({
                        skuIdx: s,
                        priceOriginal: buildBuf.readUInt32LE(so) / 100,
                        priceDiscounted: pDisc,
                        shippingFee: buildBuf.readUInt32LE(so + 8) / 100,
                        minDelivery: buildBuf.readUInt8(so + 12),
                        maxDelivery: buildBuf.readUInt8(so + 13),
                        image: image,
                        props: props
                    });
                }
            }

            const fluxo = i + FLUX_OFFSET;
            const recordCount = buildBuf.readUInt32LE(fluxo);
            for (let c = 0; c < recordCount; c++) {
                const offset = fluxo + 4 + (c * 8);
                if (offset + 8 > i + RECORD_SIZE) break;
                const timeInMinutes = buildBuf.readUInt32LE(offset);
                const priceRaw = buildBuf.readInt32LE(offset + 4);
                if (timeInMinutes > 0 && priceRaw > 0) {
                    const pDate = new Date(Date.UTC(2025, 0, 1) + (timeInMinutes * 60 * 1000));
                    item.chart.push({
                        date: pDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
                        price: (priceRaw / 100).toFixed(2),
                        rawTime: timeInMinutes
                    });
                }
            }
        }

        return Array.from(products.values());

    } catch (e) {
        throw e;
    }
};
