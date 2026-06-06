// =================== IMGs ===================
const thumbContainer=document.querySelector('.thumbnail-container');const thumbSlider=document.querySelector('.thumbnails-slider');const mainImg=document.getElementById('mainImage');let currentIndex=0;const scrollAmount=240;function getThumbnails(){return[...document.querySelectorAll('.thumbnail-container img')]}
function applyImageStyle(img){if(!img)return;Object.assign(img.style,{objectFit:'contain',backgroundColor:'black',width:'100%',height:'100%'})}
function changeImage(index){const thumbnails=getThumbnails();const selectedThumb=thumbnails[index];if(!selectedThumb)return;currentIndex=index;mainImg.src=selectedThumb.src;applyImageStyle(mainImg);if(selectedThumb._skuData){if(typeof window.updateSKUPrice==="function"){window.updateSKUPrice(selectedThumb._skuData)}}else{if(typeof window.resetToInitialData==="function"){window.resetToInitialData()}}
thumbnails.forEach((img,i)=>img.classList.toggle('active-thumb',i===index));scrollThumbnailIntoView(index)}
function scrollThumbnailIntoView(index){const thumbnails=getThumbnails();const thumb=thumbnails[index];if(!thumb||!thumbContainer)return;const cRect=thumbContainer.getBoundingClientRect();const tRect=thumb.getBoundingClientRect();const isRTL=getComputedStyle(thumbContainer).direction==='rtl';const offset=tRect.left<cRect.left?tRect.left-cRect.left-10:tRect.right>cRect.right?tRect.right-cRect.right+10:0;thumbContainer.scrollLeft+=isRTL?offset:-offset}
document.getElementById('thumbsRight')?.addEventListener('click',()=>thumbContainer.scrollLeft+=scrollAmount);document.getElementById('thumbsLeft')?.addEventListener('click',()=>thumbContainer.scrollLeft-=scrollAmount);document.getElementById('mainImageRightArrow')?.addEventListener('click',()=>{const thumbnails=getThumbnails();if(thumbnails.length>0){changeImage((currentIndex-1+thumbnails.length)%thumbnails.length)}});document.getElementById('mainImageLeftArrow')?.addEventListener('click',()=>{const thumbnails=getThumbnails();if(thumbnails.length>0){changeImage((currentIndex+1)%thumbnails.length)}});thumbSlider?.addEventListener('click',(e)=>{if(e.target.tagName==='IMG'){const thumbnails=getThumbnails();const index=thumbnails.indexOf(e.target);if(index!==-1)changeImage(index);}});if(getThumbnails().length>0)changeImage(0)

//  Modal
function createModal(){if(document.getElementById("imageModal"))return;document.body.insertAdjacentHTML("beforeend",`
      <div id="imageModal" class="modal">
        <span class="close" onclick="closeModal()">&times;</span>
        <img class="modal-content" id="modalImage" />
        <span class="arrow left" onclick="navigateModal('prev')"></span>
        <span class="arrow right" onclick="navigateModal('next')"></span>
      </div>
    `)}
createModal();const modal=document.getElementById("imageModal");const modalImage=document.getElementById("modalImage");window.openModal=function(index){const thumbnails=getThumbnails();const targetIndex=(typeof index==='number')?index:currentIndex;if(!thumbnails[targetIndex])return;modal.style.display="flex";modalImage.src=thumbnails[targetIndex].src;applyImageStyle(modalImage);currentIndex=targetIndex};window.closeModal=function(){modal.style.display="none"};window.navigateModal=function(direction){const thumbnails=getThumbnails();if(thumbnails.length===0)return;currentIndex=direction==="next"?(currentIndex+1)%thumbnails.length:(currentIndex-1+thumbnails.length)%thumbnails.length;modalImage.src=thumbnails[currentIndex].src;applyImageStyle(modalImage)}

//  Customer IMG 
const avatarURL="/public/assets/static/client.png";document.querySelectorAll(".avatar-placeholder").forEach(placeholder=>{const img=new Image();img.src=avatarURL;img.alt="عميل";img.className="reviewer-img";img.width=50;img.height=50;img.loading="lazy";placeholder.appendChild(img)})

// =================== Tabs ===================

let enableInitialScroll=!1;function showTab(id,btn,forceScroll=!1){document.querySelectorAll('[id^="tab"]').forEach(t=>t.style.display='none');document.querySelectorAll('.tab-buttons button').forEach(b=>b.classList.remove('active'));const target=document.getElementById(id);if(target){target.style.display='block';const targetTop=target.getBoundingClientRect().top+window.scrollY;const stickyHeight=document.querySelector('.tab-buttons')?.offsetHeight||0;setTimeout(()=>{if(enableInitialScroll||forceScroll){window.scrollTo({top:targetTop-stickyHeight-10,behavior:'smooth'})}},100)}
if(btn)btn.classList.add('active');}
let tabCheck=setInterval(()=>{const firstBtn=document.querySelector('.tab-buttons button');const firstTab=document.getElementById('tab1');if(firstBtn&&firstTab){showTab('tab1',firstBtn);document.querySelectorAll('.tab-buttons button').forEach(btn=>{btn.addEventListener('click',()=>{const id=btn.getAttribute('onclick')?.match(/'(.*?)'/)?.[1];if(id)showTab(id,btn,!0);})});clearInterval(tabCheck)}},100);setTimeout(()=>clearInterval(tabCheck),5000)

const textMap = {
  "الوصف": "التفاصيل",
  "المميزات": "المزايا",
  "المواصفات": "الخصائص الفنية",
  "الرسم البياني للسعر": "تحليل الأسعار",
  "تقييم العملاء": "آراء المستخدمين",
};

document.querySelectorAll(".tab-buttons button").forEach(btn => {
  const oldText = btn.textContent.trim();
  if (textMap[oldText]) {
    btn.textContent = textMap[oldText];
  }
});


// Tab (5)
const goToReviewsBtn=document.getElementById("goToReviews");if(goToReviewsBtn){goToReviewsBtn.addEventListener("click",function(e){e.preventDefault();const tabButtons=document.querySelectorAll('.tab-buttons button');const targetButton=Array.from(tabButtons).find(btn=>btn.getAttribute('onclick')?.includes("'tab5'"));if(targetButton){showTab('tab5',targetButton,!0);setTimeout(()=>{const reviewsSection=document.getElementById('tab5');if(reviewsSection){reviewsSection.scrollIntoView({behavior:'smooth'})}},300)}})}


// =================== Product UI Layout & Data Injection ===================


(function() {

    function drawStars(container, rating) {
        if (!container) return;
        const fullStars = Math.floor(rating);
        const hasHalf = rating % 1 >= 0.5 ? 1 : 0;
        let starsHTML = "";
        for (let i = 0; i < fullStars; i++) starsHTML += `<span class="star">★</span>`;
        if (hasHalf) starsHTML += `<span class="star half">★</span>`;
        for (let i = 0; i < (5 - fullStars - hasHalf); i++) starsHTML += `<span class="star empty">★</span>`;
        container.innerHTML = starsHTML;
    }
      
    const markup = `
        <div id="skuHubOverlay">
            <div class="sku-modal-content">
                <div class="sku-modal-header">
                    <h3>خيارات وموديلات المنتج</h3>
                    <button class="sku-close" onclick="window.SKU_HUB.toggle(false)">&times;</button>
                </div>
                <div class="sku-slider-container">
                    <button class="sku-nav prev" onclick="window.SKU_HUB.scroll('right')">
                        <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    <div class="sku-track" id="skuTrack"></div>
                    <button class="sku-nav next" onclick="window.SKU_HUB.scroll('left')">
                        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', markup);

    window.SKU_HUB = {
        items: [],
        toggle: function(s) {
            const el = document.getElementById('skuHubOverlay');
            if (el) {
                el.classList.toggle('active', s);
                document.body.style.overflow = s ? 'hidden' : '';
            }
        },
        scroll: function(d) {
            const t = document.getElementById('skuTrack');
            if (t) {
                const a = 300;
                t.scrollBy({ left: d === 'left' ? -a : a, behavior: 'smooth' });
            }
        },
        render: function(data) {
            this.items = data.filter(i => i.priceDiscounted > 0);
            if (!this.items.length) return;
            const minP = Math.min(...this.items.map(v => v.priceDiscounted));
            const minD = Math.min(...this.items.map(v => v.maxDelivery));
            const track = document.getElementById('skuTrack');
            track.innerHTML = this.items.map(item => {
                let badge = "";
                if (item.priceDiscounted === minP) badge = '<span class="sku-badge badge-price">أفضل سعر</span>';
                else if (item.maxDelivery === minD) badge = '<span class="sku-badge badge-delivery">أسرع شحن</span>';
                return `
                <div class="sku-card" onclick="window.SKU_HUB.select('${encodeURIComponent(JSON.stringify(item))}')">
                ${badge}
                <div class="sku-card-img-wrap">
                <img src="${item.image}" class="sku-card-img" loading="lazy">
                </div>
                <div class="sku-card-info">
                <div class="sku-card-name">${item.props}</div>
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
            const btn = document.getElementById('skuHubBtn');
            if (btn) btn.style.display = 'block';
        },
        select: function(enc) {
            const item = JSON.parse(decodeURIComponent(enc));
            if (window.updateSKUPrice) window.updateSKUPrice(item);
            if (window.changeImage) {
                const th = Array.from(document.querySelectorAll('.thumbnails-slider img'));
                const i = th.findIndex(m => m.src === item.image);
                if (i !== -1) window.changeImage(i);
            }
            this.toggle(false);
        }
    };

    window.renderSKUs = function(skuList) {
        const skuWrapper = document.getElementById('sku-images-wrapper') || Object.assign(document.createElement('div'), {id:'sku-images-wrapper'});
        skuWrapper.style.display = 'contents';
        skuWrapper.innerHTML = "";
        const thumbSlider = document.querySelector('.thumbnails-slider');
        if (thumbSlider) thumbSlider.appendChild(skuWrapper);
        skuList.forEach(item => {
            const img = document.createElement("img");
            img.src = item.image;
            img.alt = item.props;
            img.title = item.props;
            img.loading = "lazy";
            img._skuData = item;
            img.addEventListener('click', () => {
                if (typeof window.updateSKUPrice === "function") window.updateSKUPrice(item);
            });
            skuWrapper.appendChild(img);
        });
        if (window.SKU_HUB) window.SKU_HUB.render(skuList);
        const skuParam = new URLSearchParams(window.location.search).get('sku');
        if (skuParam && skuParam !== '255') {
            setTimeout(() => {
                const allImgs = Array.from(document.querySelectorAll('.thumbnails-slider img'));
                const targetImg = allImgs.find(i => i._skuData && i._skuData.skuIdx == skuParam);
                if (targetImg && typeof window.changeImage === 'function') {
                    window.changeImage(allImgs.indexOf(targetImg));
                }
            }, 250);
        }
    };

    window.injectData = function(data) {
        const hostMatch = window.location.hostname.match(/^(sa|ae|om|ma|dz|tn)\./i);
        const activeCountry = hostMatch ? hostMatch[1].toUpperCase() : "SA";
        const countryInfo = {
            "SA": {symbol:"ر.س", rate:1},
            "AE": {symbol:"د.إ", rate:0.98},
            "OM": {symbol:"ر.ع", rate:0.10},
            "MA": {symbol:"د.م", rate:2.70},
            "DZ": {symbol:"د.ج", rate:36.00},
            "TN": {symbol:"د.ت", rate:0.83}
        };
        const config = countryInfo[activeCountry] || countryInfo.SA;
        const symbol = config.symbol;
        const weight = config.rate || 1;
        const formatPrice = num => parseFloat(num).toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
        const pOriginal = data.priceOriginal;
        const pDiscounted = data.priceDiscounted;
        const diff = pOriginal - pDiscounted;
        const hasDiscount = diff > 0.01;
        
        document.querySelectorAll(".price-discounted").forEach(el => el.textContent = `${formatPrice(pDiscounted)} ${symbol}`);
        const savingEl = document.querySelector(".price-saving");
        const discountEl = document.querySelector(".discount-percentage");
        const originalPriceEls = document.querySelectorAll(".price-original");
        
        if (hasDiscount) {
            originalPriceEls.forEach(el => {
                el.textContent = `${formatPrice(pOriginal)} ${symbol}`;
                el.style.display = "inline-block";
            });
            if (discountEl) {
                discountEl.textContent = `-${Math.round((diff / pOriginal) * 100)}%`;
                discountEl.style.display = "inline-block";
            }
            if (savingEl) {
                savingEl.style.display = "block";
                savingEl.innerHTML = `<span class="save-label">وفر:</span> <span class="save-amount">${formatPrice(diff)} ${symbol}</span>`;
                const weightedDiff = diff / weight;
                let color = "#7f8c8d";
                if (weightedDiff < 100) color = "#16a085";
                else if (weightedDiff < 400) color = "#1abc9c";
                else if (weightedDiff < 600) color = "#3498db";
                else if (weightedDiff < 900) color = "#2ecc71";
                else if (weightedDiff < 1200) color = "#e67e22";
                else if (weightedDiff < 1600) color = "#c0392b";
                else if (weightedDiff < 2000) color = "#f5008b";
                else if (weightedDiff < 3000) color = "#8e44ad";
                else color = "#FFD700";
                savingEl.style.color = color;
                savingEl.style.fontWeight = "bold";
                if (weightedDiff >= 500) {
                    const saveAmount = savingEl.querySelector(".save-amount");
                    if (saveAmount && !saveAmount.querySelector(".fire-gif")) {
                        const fireGif = document.createElement("img");
                        fireGif.alt = "سعر مميز";
                        fireGif.src = "/public/assets/static/fire.gif";
                        fireGif.style.cssText = "width:20px; vertical-align:middle; margin-left:5px;";
                        fireGif.classList.add("fire-gif");
                        saveAmount.appendChild(fireGif);
                    }
                }
            }
        } else {
            originalPriceEls.forEach(el => el.style.display = "none");
            if (discountEl) discountEl.style.display = "none";
            if (savingEl) savingEl.style.display = "none";
        }

        document.querySelectorAll(".fee-value").forEach(el => {
            const isFree = data.shippingFee <= 0;
            el.textContent = isFree ? "شحن مجاني" : `${formatPrice(data.shippingFee)} ${symbol}`;
            if (isFree) { el.style.color = "#00b894"; el.style.fontWeight = "bold"; }
        });

        document.querySelectorAll(".time-value").forEach(el => {
            const min = data.minDelivery;
            const max = data.maxDelivery;
            el.textContent = (min === max || !max) ? `${min} أيام` : `${max}-${min} أيام`;
        });

        drawStars(document.getElementById("stars"), parseFloat(data.score) || 0);
        const rv = document.getElementById("ratingValue"); if (rv) rv.textContent = data.score.toFixed(1);
        const rc = document.getElementById("goToReviews"); if (rc) rc.textContent = (data.reviews || 0).toLocaleString() + " تقييمات";    
                                             
        const moreRev = document.querySelector(".more-reviews-link a");
        if (moreRev && data.productAffCode) {
            moreRev.href = `https://s.click.aliexpress.com/${data.productAffCode}`;
            moreRev.parentElement.style.display = "block";
        }                         

        const affLink = data.productAffCode ? `https://s.click.aliexpress.com/${data.productAffCode}` : null;
        const buyBtn = document.querySelector(".buy-button");
        if (buyBtn && affLink) buyBtn.href = affLink;
        if (moreRev && affLink) moreRev.href = affLink;

        const ordersEl = document.querySelector(".orders-count");
        if (ordersEl) ordersEl.textContent = (data.orders || 0).toLocaleString();

        const storeWrapper = document.getElementById('store-bar-wrapper');
        if (storeWrapper && data.storeName) {
            const storeLink = `/page/store?store=${data.storeId}`;
            storeWrapper.innerHTML = `
                <div class="bar">
                    <img src="/public/assets/static/store.webp" class="profile-image" alt="Store">
                    <div class="text">${data.storeName}</div>
                    <div class="buttons">
                        <a href="${storeLink}" class="button">زيارة المتجر</a>
                        <a href="https://s.click.aliexpress.com/${data.storeAffCode}" target="_blank" rel="nofollow" class="button">متابعة</a>
                    </div>
                </div>`;
        }
    };

    document.querySelectorAll('.Customer-Reviews .stars-group').forEach(group => {
        const rating = parseFloat(group.getAttribute('data-rating')) || 5;
        drawStars(group, rating);
    });

function injectReviewLink() {
    const tab5 = document.getElementById('tab5');
    if (tab5 && !tab5.querySelector('.more-reviews-link')) {
        tab5.insertAdjacentHTML('beforeend', `
            <div class="more-reviews-link" style="text-align:center; margin-top:20px;">
                <a href="#" rel="noopener" target="_blank" style="color:#ffffff !important; background-color:#ff6000; padding:10px 20px; display:inline-block; border-radius:5px; font-weight:bold; text-decoration:none;">شاهد المزيد من المراجعات في المتجر الرسمي ←</a>
            </div>
        `);
    }
}

    injectReviewLink();

})();


// =================== Promo ===================

window.injectPromo=function(promoData){let container=document.querySelector('.coupon-container');const shelf=document.getElementById('dynamic-shelf');if(!promoData||!promoData.code||!promoData.code.trim()){if(container)container.style.display='none';return}
if(!container&&shelf){container=document.createElement('div');container.className='coupon-container';shelf.parentNode.insertBefore(container,shelf.nextSibling)}
if(!container)return;const colors=['#ff4757','#e91e63','#ff6b81','#ff5722'];const theme=colors[Math.floor(Math.random()*colors.length)];container.style.setProperty('--theme-color',theme);let expiryTimestamp;if(typeof promoData.expiry==='number'&&promoData.expiry<10000000000){expiryTimestamp=Date.UTC(2025,0,1)+(promoData.expiry*60*1000)}else{expiryTimestamp=new Date(promoData.expiry).getTime()}
const updateTimer=()=>{const diffMs=expiryTimestamp-Date.now();if(diffMs<=0){container.style.display='none';clearInterval(window.promoTimer);return}
const d=Math.floor(diffMs/86400000);const h=Math.floor((diffMs%86400000)/3600000);const m=Math.floor((diffMs%3600000)/60000);const s=Math.floor((diffMs%60000)/1000);const timerEl=document.getElementById('promo-timer-text');if(timerEl){timerEl.textContent=d>0?`⏳ ينتهي خلال ${d} يوم`:`⏳ ينتهي خلال ${h}:${m}:${s}`}};container.style.display='flex';container.style.flexDirection='column';container.innerHTML=`
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px;">
            <div class="coupon-code" id="couponCode">${promoData.code}</div>
            <button class="copy-button" onclick="copyCoupon('${promoData.code}')">نسخ الكوبون</button>
        </div>
        <div class="promo-meta">
            <span class="qty-badge">🔥 متبقي: ${promoData.quantity} قطعة</span>
            <span id="promo-timer-text" class="timer-nari" style="color: #0048ff; font-weight: 800; font-size: 14px;">⏳ جاري الحساب...</span>
        </div>
    `;if(window.promoTimer)clearInterval(window.promoTimer);window.promoTimer=setInterval(updateTimer,1000);updateTimer()};window.copyCoupon=function(code){const target=code||document.getElementById('couponCode').textContent;const btn=document.querySelector('.copy-button');const done=()=>{if(btn){const old=btn.textContent;btn.textContent="تم! ✅";setTimeout(()=>btn.textContent=old,2000)}};if(navigator.clipboard){navigator.clipboard.writeText(target).then(done)}else{const el=document.createElement("textarea");el.value=target;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);done()}}


// =================== Chart ===================

window.renderJSONChart=function(finalData){try{if(!finalData||!finalData.length)return;const hostMatch=window.location.hostname.match(/^(sa|ae|om|ma|dz|tn)\./i);const country=hostMatch?hostMatch[1].toUpperCase():"SA";const currencyMap={"SA":"ر.س","AE":"د.إ","OM":"ر.ع","MA":"د.م","DZ":"د.ج","TN":"د.ت"};const currency=currencyMap[country]||"ر.س";finalData.sort((a,b)=>a.rawTime-b.rawTime);const tab4=document.getElementById("tab4");const chartCanvas=document.getElementById("priceChart");if(!chartCanvas||!tab4)return;if(!chartCanvas.parentNode.id.includes("scroll-wrapper")){const scrollContainer=document.createElement("div");scrollContainer.id="chart-scroll-wrapper";const innerWrapper=document.createElement("div");innerWrapper.id="chart-inner-resizer";chartCanvas.parentNode.insertBefore(scrollContainer,chartCanvas);innerWrapper.appendChild(chartCanvas);scrollContainer.appendChild(innerWrapper)}const resizer=document.getElementById("chart-inner-resizer");const scrollContainer=document.getElementById("chart-scroll-wrapper");const isMobile=window.innerWidth<768;const prices=finalData.map(x=>Number(x.price)).filter(p=>!isNaN(p));if(!prices.length)return;const dates=finalData.map(x=>x.date);const min=Math.min(...prices),max=Math.max(...prices);const avg=+(prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(2);const current=prices[prices.length-1],prev=prices[prices.length-2]||current;const getArrow=(v,c)=>v>c?`<span style="color:#ef4444;">▲</span>`:v<c?`<span style="color:#10b981;">▼</span>`:"";const diffTotal=(current-prev).toFixed(2);const statsHtml=` <div class="price-stats"><div class="stat-item current"><strong>السعر الحالي</strong><span style="display:flex; align-items:center; gap:5px;">${current}${currency}${getArrow(current,prev)}</span><small style="font-size:11px;color:#666;">(${diffTotal}${currency})</small></div><div class="stat-item"><strong>المتوسط</strong><span>${avg}${currency}</span></div><div class="stat-item"><strong>أقل سعر</strong><span>${min}${currency}</span></div><div class="stat-item"><strong>أعلى سعر</strong><span>${max}${currency}</span></div></div>`;const oldStats=tab4.querySelector(".price-stats");if(oldStats)oldStats.remove();scrollContainer.insertAdjacentHTML("afterend",statsHtml);let tooltipEl=document.getElementById("chart-tooltip")||Object.assign(document.createElement("div"),{id:"chart-tooltip"});if(!tooltipEl.parentElement)document.body.appendChild(tooltipEl);const externalTooltipHandler=(context)=>{const{chart,tooltip}=context;if(tooltip.opacity===0){tooltipEl.style.opacity=0;setTimeout(()=>{if(tooltipEl.style.opacity==0)tooltipEl.style.display="none"},200);return}tooltipEl.style.display="block";setTimeout(()=>{tooltipEl.style.opacity=1},10);const idx=tooltip.dataPoints[0].dataIndex;const val=tooltip.dataPoints[0].raw;const pVal=idx>0?prices[idx-1]:val;const diff=+(val-pVal).toFixed(2);const perc=pVal!==0?((diff/pVal)*100).toFixed(1):0;const arr=diff>0?`<span style="color:#ef4444;">▲</span>`:diff<0?`<span style="color:#10b981;">▼</span>`:"-";tooltipEl.innerHTML=` <div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #555;padding-bottom:4px;">${dates[idx]}</div><div>السعر:${val}${currency}</div><div style="font-size:12px;">التغير:${arr}${diff}(${perc}%)</div>`;const pos=chart.canvas.getBoundingClientRect();const tooltipWidth=tooltipEl.offsetWidth;const screenWidth=window.innerWidth;let leftPos=pos.left+window.pageXOffset+tooltip.caretX+10;if(leftPos+tooltipWidth>screenWidth){leftPos=pos.left+window.pageXOffset+tooltip.caretX-tooltipWidth-10}if(leftPos<0)leftPos=10;tooltipEl.style.left=leftPos+'px';tooltipEl.style.top=(pos.top+window.pageYOffset+tooltip.caretY-60)+'px'};const ctx=chartCanvas.getContext("2d");if(window.myPriceChart)window.myPriceChart.destroy();window.myPriceChart=new Chart(ctx,{type:"line",data:{labels:dates,datasets:[{data:prices,borderColor:"#ff6000",backgroundColor:(c)=>{const a=c.chart.chartArea;if(!a)return null;const g=c.chart.ctx.createLinearGradient(0,a.top,0,a.bottom);g.addColorStop(0,'rgba(255, 96, 0, 0.15)');g.addColorStop(1,'rgba(255, 96, 0, 0)');return g},borderWidth:2.5,pointRadius:0,pointHoverRadius:6,pointHitRadius:20,fill:true,stepped:'before'}]},options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:10,bottom:10}},animation:{duration:400,easing:'easeOutQuart'},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{enabled:false,external:externalTooltipHandler}},scales:{x:{ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:isMobile?5:10},grid:{display:false}},y:{position:'right',grace:'15%',ticks:{precision:2},grid:{color:'#f0f0f0',drawBorder:false}}}}});if(isMobile)scrollContainer.scrollLeft=scrollContainer.scrollWidth}catch(e){console.error(e)}};


// =================== Download Chart ===================

(function(){function wrapText(ctx,text,x,y,maxWidth,lineHeight){const words=text.split(' ');let line='';let currentY=y;for(let n=0;n<words.length;n++){let testLine=line+words[n]+' ';let metrics=ctx.measureText(testLine);if(metrics.width>maxWidth&&n>0){ctx.fillText(line,x,currentY);line=words[n]+' ';currentY+=lineHeight}else{line=testLine}}
ctx.fillText(line,x,currentY);return currentY}
window.downloadChartAsImage=async function(action='download'){const chartInstance=window.myPriceChart;if(!chartInstance)return;const canvas=document.getElementById("priceChart");const tempCanvas=document.createElement("canvas");const ctx=tempCanvas.getContext("2d");const padding=40;const headerHeight=160;tempCanvas.width=canvas.width+(padding*2);tempCanvas.height=canvas.height+headerHeight+padding+20;const isDarkMode=document.body.classList.contains('dark-mode');ctx.fillStyle=isDarkMode?"#121212":"#ffffff";ctx.fillRect(0,0,tempCanvas.width,tempCanvas.height);const productName=document.querySelector("h1")?.innerText||"تقرير الأسعار";const hostMatch=window.location.hostname.match(/^(sa|ae|om|ma|dz|tn)\./i);const countryCode=hostMatch?hostMatch[1].toUpperCase():"SA";const countryData={"SA":"السعودية 🇸🇦","AE":"الإمارات 🇦🇪","OM":"عُمان 🇴🇲","MA":"المغرب 🇲🇦","DZ":"الجزائر 🇩🇿","TN":"تونس 🇹🇳"};const countryName=countryData[countryCode]||"السعودية 🇸🇦";ctx.direction="rtl";ctx.textAlign="right";ctx.fillStyle="#e74c3c";ctx.font="bold 28px Arial";ctx.fillText("بـورصـة الأسـعـار",tempCanvas.width-padding,50);ctx.fillStyle=isDarkMode?"#eeeeee":"#2c3e50";ctx.font="bold 20px Arial";const lastTextY=wrapText(ctx,productName,tempCanvas.width-padding,90,tempCanvas.width-(padding*2),28);ctx.fillStyle="#3498db";ctx.font="bold 16px Arial";ctx.fillText("الدولة: "+countryName,tempCanvas.width-padding,lastTextY+35);ctx.fillStyle="#7f8c8d";ctx.font="13px Arial";const dateStr=new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'});ctx.fillText(window.location.hostname+" | تحديث "+dateStr,tempCanvas.width-padding,lastTextY+60);ctx.shadowColor="rgba(0,0,0,0.2)";ctx.shadowBlur=25;ctx.shadowOffsetY=12;ctx.drawImage(canvas,padding,headerHeight);ctx.shadowBlur=0;ctx.strokeStyle=isDarkMode?"#333":"#f0f0f0";ctx.lineWidth=2;ctx.strokeRect(5,5,tempCanvas.width-10,tempCanvas.height-10);const imageBase64=tempCanvas.toDataURL("image/png",1.0);if(action==='share'&&navigator.share){const response=await fetch(imageBase64);const blob=await response.blob();const file=new File([blob],`Price-Report.png`,{type:"image/png"});try{await navigator.share({files:[file],title:productName,text:`تقرير أسعار ${productName}\nالمصدر:`,url:window.location.href})}catch(err){}}else{const downloadLink=document.createElement("a");downloadLink.href=imageBase64;downloadLink.download=`Price-Report-${countryCode}-${new Date().getTime()}.png`;document.body.appendChild(downloadLink);downloadLink.click();document.body.removeChild(downloadLink)}};const observer=new MutationObserver(()=>{const stats=document.querySelector(".price-stats");if(stats&&!document.getElementById("btn-download-container")){const containerHtml=`
                <div id="btn-download-container">
                    <button id="btn-download-chart" onclick="downloadChartAsImage('download')">
                        <span>📊</span> حفظ الرسم البياني
                    </button>
                    <button id="btn-share-chart" onclick="downloadChartAsImage('share')">
                        <span>🔗</span> مشاركة التقرير
                    </button>
                </div>`;stats.insertAdjacentHTML("afterend",containerHtml);if(!navigator.share){document.getElementById("btn-share-chart").style.display="none"}}});observer.observe(document.body,{childList:!0,subtree:!0})})()


// =================== Telegram Alerts ===================

document.addEventListener('DOMContentLoaded',function(){const uidEl=document.querySelector('.UID');const box=document.getElementById('telegram-alert-wrapper');if(!uidEl||!box)return;const uid = window.PRODUCT_DATA?.id || uidEl.innerText.trim();const bot='ISeekPrice_bot';const hostMatch=window.location.hostname.match(/^(sa|ae|om|ma|dz|tn)\./i);const rawCountry=hostMatch?hostMatch[1].toUpperCase():"SA";const workerUrl='https://notify.iseekprice.com/submit-alert';const countriesMap={'SA':'السعودية 🇸🇦','AE':'الإمارات 🇦🇪','OM':'عُمان 🇴🇲','MA':'المغرب 🇦🇪','DZ':'الجزائر 🇩🇿','TN':'تونس 🇹🇳'};const countryName=countriesMap[rawCountry]||rawCountry;const modalHtml=`
        <div class="is-overlay" id="isOverlay">
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
        </div>`;document.body.insertAdjacentHTML('beforeend',modalHtml);const btn=document.createElement('button');btn.className='iseek-btn';btn.innerHTML=`<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg> <span>تتبع السعر الآن</span>`;btn.onclick=()=>document.getElementById('isOverlay').style.display='flex';document.getElementById('isClose').onclick=()=>document.getElementById('isOverlay').style.display='none';function getCurrentPrice(){const priceEl=document.querySelector('.price-discounted');if(!priceEl)return 0;const rawText=priceEl.innerText.replace(/,/g,'');const match=rawText.match(/\d+(\.\d+)?/);return match?parseFloat(match[0]):0}
document.querySelectorAll('.is-chip').forEach(chip=>{chip.onclick=function(){const currentPrice=getCurrentPrice();if(currentPrice>0){const pct=parseInt(this.getAttribute('data-pct'));const target=(currentPrice*(1-pct/100)).toFixed(2);document.getElementById('isPrice').value=target;document.querySelectorAll('.is-chip').forEach(c=>c.classList.remove('active'));this.classList.add('active')}}});document.getElementById('isGo').onclick=async function(){const goBtn=this;let targetP=parseFloat(document.getElementById('isPrice').value)||0;if(!targetP||targetP<=0){alert("⚠️ من فضلك أدخل سعر صحيح");return}
goBtn.disabled=!0;goBtn.innerText="جاري التحضير...";const payload={uid:uid,targetPrice:targetP,currentPrice:getCurrentPrice(),country:rawCountry,email:document.getElementById('isMail').value||'none',fingerprint:localStorage.getItem('user_fingerprint')||'ID-GUEST',recordIdx: window.PRODUCT_DATA?.recordIndex ?? window.currentRecordIndex,skuIdx: (typeof window.selectedSkuIndex !== 'undefined') ? window.selectedSkuIndex : 255};try{const response=await fetch(workerUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(result.token){window.open(`https://t.me/${bot}?start=${result.token}`,'_blank');document.getElementById('isOverlay').style.display='none'}else{throw new Error()}}catch(err){alert("⚠️ عذراً، حدث خطأ أثناء الاتصال. حاول مرة أخرى.")}finally{goBtn.disabled=!1;goBtn.innerText="تفعيل في تليجرام"}};box.appendChild(btn)})
