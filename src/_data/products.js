const fflate = require('fflate');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const readCleanString = (buf, start, end) => {
    let nullIdx = buf.indexOf(0, start);
    if (nullIdx === -1 || nullIdx > end) nullIdx = end;
    return buf.toString('utf8', start, nullIdx).trim();
};

const fetchBufWithRetry = async (url, retries = 5, delayMs = 2000) => {
    if (!url) return Buffer.alloc(0);

    for (let i = 1; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

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
            }
        } catch (err) {}
        if (i < retries) await delay(delayMs);
    }
    throw new Error(`Fetch failed after ${retries} retries: ${url}`);
};

const mapRecordsById = (buffer, recordSize) => {
    const map = new Map();
    if (!buffer || buffer.length < recordSize) return map;
    for (let i = 0; i + recordSize <= buffer.length; i += recordSize) {
        map.set(buffer.readBigUInt64LE(i), i);
    }
    return map;
};

module.exports = async function() {
    const country = (process.env.COUNTRY || 'sa').toLowerCase();
    const baseUrl = 'https://data.iseekprice.com/';

    const mapUrl = `${baseUrl}general/map.json?v=${Date.now()}`;
    const mapBuf = await fetchBufWithRetry(mapUrl);
    if (!mapBuf.length) return [];

    const map = JSON.parse(mapBuf.toString('utf8'));
    const region = map.regions ? map.regions[country] : null;
    const coreFilename = map.general ? map.general.core : null;

    if (!region || !region.bundle || !coreFilename) {
        throw new Error(`Incomplete deployment data for ${country}`);
    }

    const coreUrl = `${baseUrl}general/${coreFilename}`;
    const bundleUrl = `${baseUrl}${country}/${region.bundle}?v=${Date.now()}`;

    const [coreBuf, zipBuf] = await Promise.all([
        fetchBufWithRetry(coreUrl),
        fetchBufWithRetry(bundleUrl)
    ]);

    const unzipped = fflate.unzipSync(new Uint8Array(zipBuf));

    const getBufferFromZip = (filenameKey) => {
        const targetName = region[filenameKey];
        if (!targetName || !unzipped[targetName]) return Buffer.alloc(0);
        const u8 = unzipped[targetName];
        return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
    };

    const feedBuf = getBufferFromZip('feed');
    const promoBuf = getBufferFromZip('promo');
    const linksBuf = getBufferFromZip('links');
    const fluxBuf = getBufferFromZip('fluctuation');
    const skuBuf = getBufferFromZip('sku');

    const products = new Map();

    for (let i = 0; i + 280 <= coreBuf.length; i += 280) {
        const idBigInt = coreBuf.readBigUInt64LE(i);
        const cleanSlug = readCleanString(coreBuf, i + 16, i + 80).toLowerCase();
        const productTitle = readCleanString(coreBuf, i + 80, i + 280);
        const autoMetaDescription = `اكتشف سعر ومواصفات ${productTitle} وتتبع حركة الأسعار، الخصومات، والتقييمات المتوفرة في السوق حالياً لشراء ذكي بأفضل قيمة.`.substring(0, 155);

        products.set(idBigInt, {
            id: idBigInt.toString(),
            recordIndex: i / 280,
            slug: cleanSlug,
            title: productTitle,
            metaDescription: autoMetaDescription,
            skus: [],
            promo: null,
            chart: []
        });
    }

    const promoMap = mapRecordsById(promoBuf, 32);
    const linksMap = mapRecordsById(linksBuf, 100);
    const fluxMap = mapRecordsById(fluxBuf, 2932);
    const skuMap = mapRecordsById(skuBuf, 6428);

    for (let i = 0; i + 32 <= feedBuf.length; i += 32) {
        const idBigInt = feedBuf.readBigUInt64LE(i);
        if (!products.has(idBigInt)) continue;

        const item = products.get(idBigInt);
        const status = feedBuf.readUInt8(i + 31);
        const hasPromo = (status & 0x80) !== 0;
        const hasSku = (status & 0x40) !== 0;
        const isGlobal = (status & 0x20) !== 0;
        const sud = status & 0x1F;

        Object.assign(item, {
            storeId: feedBuf.readUInt32LE(i + 8),
            priceOriginal: feedBuf.readUInt32LE(i + 12) / 100,
            priceDiscounted: feedBuf.readUInt32LE(i + 16) / 100,
            shippingFee: feedBuf.readUInt32LE(i + 20) / 100,
            orders: feedBuf.readUInt16LE(i + 24),
            reviews: feedBuf.readUInt16LE(i + 26),
            score: feedBuf.readUInt8(i + 28) / 10,
            minDelivery: feedBuf.readUInt8(i + 29),
            maxDelivery: feedBuf.readUInt8(i + 30),
            inStock: isGlobal,
            isGlobal: isGlobal,
            sudTrend: sud,
            hasSku: hasSku,
            hasPromo: hasPromo
        });

        if (hasPromo && promoMap.has(idBigInt)) {
            const po = promoMap.get(idBigInt);
            item.promo = {
                expiry: promoBuf.readUInt32LE(po + 8),
                quantity: promoBuf.readUInt16LE(po + 12),
                code: readCleanString(promoBuf, po + 14, po + 32)
            };
        }

        if (linksMap.has(idBigInt)) {
            const lo = linksMap.get(idBigInt);
            item.productAffCode = readCleanString(linksBuf, lo + 16, lo + 30);
            item.storeAffCode = readCleanString(linksBuf, lo + 30, lo + 44);
            item.storeName = readCleanString(linksBuf, lo + 44, lo + 100);
        }

        if (fluxMap.has(idBigInt)) {
            const fo = fluxMap.get(idBigInt);
            const recordCount = fluxBuf.readUInt32LE(fo + 8);
            for (let c = 0; c < recordCount; c++) {
                const offset = fo + 12 + (c * 8);
                if (offset + 8 > fo + 2932) break;

                const timeInMinutes = fluxBuf.readUInt32LE(offset);
                const priceRaw = fluxBuf.readInt32LE(offset + 4);

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

        if (hasSku && skuMap.has(idBigInt)) {
            const soBase = skuMap.get(idBigInt);
            for (let s = 0; s < 30; s++) {
                const so = soBase + 8 + (s * 214);
                const pDisc = skuBuf.readUInt32LE(so + 4) / 100;
                if (pDisc === 0) continue;

                const imgSlug = readCleanString(skuBuf, so + 14, so + 54);
                const rawProps = readCleanString(skuBuf, so + 54, so + 214);
                const props = rawProps ? rawProps.replace(/\|/g, " - ").trim() : "_";
                const image = "https://ae-pic-a1.aliexpress-media.com/kf/" + imgSlug + (imgSlug.includes('.') ? "" : ".jpg");

                item.skus.push({
                    skuIdx: s,
                    priceOriginal: skuBuf.readUInt32LE(so) / 100,
                    priceDiscounted: pDisc,
                    shippingFee: skuBuf.readUInt32LE(so + 8) / 100,
                    minDelivery: skuBuf.readUInt8(so + 12),
                    maxDelivery: skuBuf.readUInt8(so + 13),
                    image: image,
                    props: props
                });
            }
        }
    }

    return Array.from(products.values());
};
