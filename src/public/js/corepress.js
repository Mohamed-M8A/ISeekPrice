// ===================  Header  ===================

(function injectAndInitializeHeader() {
    const host = window.location.hostname;
    const isMainDomain = host === "iseekprice.com" || host === "www.iseekprice.com";
    const countryMatch = host.match(/^(sa|ae|om|ma|dz|tn)\./i);
    const currentCountry = countryMatch ? countryMatch[1].toUpperCase() : "SA";

    const logoWrap = document.getElementById('logo-wrap');
    if (logoWrap) logoWrap.innerHTML = `<a href='/'><img alt='Logo' src='/public/assets/static/favicon.webp'/></a>`;

    const searchWrap = document.getElementById('search-wrap');
    if (searchWrap) {
        searchWrap.innerHTML = `
            <form class='search-box-form' onsubmit='startSearch(); return false;'>
                <input autocomplete='off' class='search-box-input' id='searchInput' placeholder='ابحث عن منتج...' type='text'/> 
                <button class='search-box-button' type='submit'>بحث <svg class='icon'><use href='/public/assets/static/icons.svg#i-search'/></svg></button>
            </form>
            <div class='search-history-dropdown' id='searchHistoryDropdown'></div>`;
    }

const actionsWrap = document.getElementById('actions-wrap');
    if (actionsWrap) {
        const countryNamesAr = {"SA":"السعودية","AE":"الإمارات","OM":"عُمان","MA":"المغرب","DZ":"الجزائر","TN":"تونس"};
        const currentNameAr = countryNamesAr[currentCountry] || "السعودية";
        actionsWrap.innerHTML = `
            <div class='custom-dropdown' id='countryDropdown'>
                <div class='selected'><img alt='flag' height='16' src='/public/assets/flags/${currentCountry.toLowerCase()}.png' width='16'/> ${currentNameAr}</div>
                <ul class='options'>
                    <li data-value='SA'><img alt='SA' height='16' src='/public/assets/flags/sa.png' width='16'/> السعودية</li>
                    <li data-value='AE'><img alt='AE' height='16' src='/public/assets/flags/ae.png' width='16'/> الإمارات</li>
                    <li data-value='OM'><img alt='OM' height='16' src='/public/assets/flags/om.png' width='16'/> عُمان</li>
                    <li data-value='MA'><img alt='MA' height='16' src='/public/assets/flags/ma.png' width='16'/> المغرب</li>
                    <li data-value='DZ'><img alt='DZ' height='16' src='/public/assets/flags/dz.png' width='16'/> الجزائر</li>
                    <li data-value='TN'><img alt='TN' height='16' src='/public/assets/flags/tn.png' width='16'/> تونس</li>
                </ul>
            </div>
            <div class='dark-mode-toggle'>
                <button aria-label='Dark Mode' id='dark-toggler'><svg class='icon'><use href='/public/assets/static/icons.svg#i-moon'/></svg></button>
            </div>
            <div class='cart-widget' id='cart-widget-header'>
                <span class='cart-icon'><svg class='icon'><use href='/public/assets/static/icons.svg#i-cart'/></svg></span>
                <span id='cart-count'>0</span>
            </div>`;
    }

    const topBar = document.getElementById('widget-topbar');
    if (topBar) topBar.innerHTML = `<button id='widget-toggle-btn'>&#9776;</button><div id='widget-desktop-cats'></div>`;

    const sideBar = document.getElementById('widget-sidebar');
    if (sideBar) {
        sideBar.innerHTML = `<div id='widget-header-bar'><span id='widget-sidebar-title'>التصنيفات</span><button id='widget-close-btn'>&#10006;</button></div><div id='widget-side-list'></div>`;
    }


const htmlEl=document.documentElement;const darkBtn=document.getElementById("dark-toggler");function applyTheme(theme,persist){const iconUse=darkBtn?darkBtn.querySelector("use"):null;const iconPath="/public/assets/static/icons.svg";if(theme==="dark"){htmlEl.classList.add("dark-mode");htmlEl.setAttribute("data-theme","dark");if(iconUse)iconUse.setAttribute("href",iconPath+"#i-sun");}else{htmlEl.classList.remove("dark-mode");htmlEl.setAttribute("data-theme","light");if(iconUse)iconUse.setAttribute("href",iconPath+"#i-moon");}
if(persist)localStorage.setItem("theme",theme);}
let savedTheme=localStorage.getItem("theme")||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");applyTheme(savedTheme,!1);if(darkBtn){darkBtn.addEventListener("click",e=>{e.preventDefault();applyTheme(htmlEl.classList.contains("dark-mode")?"light":"dark",!0)})}
    

function updateCartWidget(){const cart=JSON.parse(localStorage.getItem("cart"))||[];const countEl=document.getElementById("cart-count");if(countEl){countEl.textContent=cart.length;cart.length>0?countEl.classList.add("active"):countEl.classList.remove("active")}}
updateCartWidget();window.addEventListener("cartUpdated",updateCartWidget);const cartBtn=document.getElementById("cart-widget-header");if(cartBtn)cartBtn.onclick=()=>window.location.href="/page/cart/";const dropdown=document.getElementById("countryDropdown"),selected=dropdown?dropdown.querySelector(".selected"):null,options=dropdown?dropdown.querySelector(".options"):null
    

    if (isMainDomain) {
        fetch("/cdn-cgi/trace").then(e => e.text()).then(e => {
            const t = e.match(/loc=([A-Z]+)/);
            const loc = (t && t[1]) ? t[1].toLowerCase() : "sa";
            const target = ["sa", "ae", "om", "ma", "dz", "tn"].includes(loc) ? loc : "sa";
            window.location.replace(`https://${target}.iseekprice.com${window.location.pathname}${window.location.search}`);
        }).catch(() => {
            window.location.replace(`https://sa.iseekprice.com${window.location.pathname}${window.location.search}`);
        });
    }

    if (selected && options) {
        selected.onclick = e => {
            e.stopPropagation();
            dropdown.classList.toggle("open");
            options.style.display = dropdown.classList.contains("open") ? "block" : "none"
        };
        options.onclick = e => {
            const li = e.target.closest("li");
            if (li) {
                const newCountry = li.getAttribute("data-value").toLowerCase();
                window.location.href = `https://${newCountry}.iseekprice.com${window.location.pathname}${window.location.search}`;
            }
        }
    }
})();

// =================== Footer ===================

const footerInjector = document.getElementById('footer');
if (footerInjector) {
    const sections = [
        { title: "عن الموقع", links: [{ text: "من نحن", url: "/page/info/about-us/" }, { text: "سياسة الموقع", url: "/page/info/policy/" }, { text: "اتصل بنا", url: "/page/info/contact/" }] },
        { title: "الأكثر متابعة", links: [{ text: "IWatch", url: "/page/iwatch/" }, { text: "Blog", url: "/page/blog/" }, { text: "Chat", url: "/page/iseekchat/" }] }
    ];
    const socialLinks = [
        { label: "YouTube", icon: "i-youtube", url: "https://www.youtube.com/@ISeekPrice" },
        { label: "Pinterest", icon: "i-pinterest", url: "https://www.pinterest.com/ISeekPrice" },
        { label: "Facebook", icon: "i-facebook", url: "https://www.facebook.com/profile.php?id=61579522981793" },
        { label: "Instagram", icon: "i-instagram", url: "https://www.instagram.com/iseekprice/" },
        { label: "X", icon: "i-x", url: "https://x.com/ISeekPrice" },
        { label: "Telegram", icon: "i-telegram", url: "https://t.me/+bmBnY0FumOwxZDQ0" }
    ];
    const sectionsHtml = sections.map(sec => `<div class='footer-links'><h3 class='footer-title'>${sec.title}</h3><ul>${sec.links.map(link => `<li><a href='${link.url}'>${link.text}</a></li>`).join('')}</ul></div>`).join('');
    const socialHtml = `<div class='footer-social-section'><h3 class='footer-title'>تابعونا علي</h3><div class='footer-social'>${socialLinks.map(soc => `<a aria-label='${soc.label}' href='${soc.url}' rel='noopener' target='_blank'><svg class='icon'><use href='/public/assets/static/icons.svg#${soc.icon}'/></svg></a>`).join('')}</div></div>`;
    footerInjector.innerHTML = `<div class='footer-container'><div class='footer-row'>${sectionsHtml}${socialHtml}</div></div><div class='footer-bottom'><p>&#169; 2024-${new Date().getFullYear()} جميع الحقوق محفوظة لموقع iseekprice.com</p></div>`;
}


// =================== Cart + Back To Top + Share ===================

function showCartToast(m,t="success"){const h=document.createElement("div");document.body.prepend(h);const s=h.attachShadow({mode:"open"}),d=document.createElement("div");d.textContent=m;s.appendChild(d);const st=document.createElement("style");st.textContent=`div{position:fixed;top:20px;right:20px;min-width:220px;max-width:320px;background:${t==="error" ? "#e74c3c":"#2ecc71"};color:#fff;font-family:sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;box-shadow:0 4px 12px rgb(0 0 0 / .2);opacity:0;transform:translateX(120%);transition:all 0.4s ease;z-index:1000000}div.show{opacity:1;transform:translateX(0)}`;s.appendChild(st);setTimeout(()=>d.classList.add("show"),50);setTimeout(()=>{d.classList.remove("show");setTimeout(()=>h.remove(),400)},3000)}function addToCart(id){if (!id){showCartToast("عذراً، لم يتم العثور على معرف المنتج!","error");return}let c=JSON.parse(localStorage.getItem("cart")) || [];if (c.some(i=>i.id===id)){showCartToast("المنتج موجود بالفعل في المفضلة! ❤️","error");return}c.push({id:id,timestamp:new Date().getTime()});localStorage.setItem("cart",JSON.stringify(c));window.dispatchEvent(new Event("cartUpdated"));showCartToast("تمت الإضافة للمفضلة ❤️","success")}document.addEventListener("click",function (e){const b=e.target.closest(".external-cart-button");if (b){e.preventDefault();e.stopPropagation();const p=e.target.closest(".post-card");const id=p ? p.querySelector(".UID")?.textContent.trim():null;addToCart(id)}const a=e.target.closest(".add-to-cart");if (a){e.preventDefault();e.stopPropagation();const u=document.querySelector(".UID");addToCart(u ? u.textContent.trim():null)}});


(function (){const b=document.createElement('div');b.id='back-to-top';b.innerHTML=`<a aria-label='Back to Top' href='#top'><svg class='icon'><use xlink:href='/public/assets/static/icons.svg#i-arrow-t'/></svg></a>`;document.body.appendChild(b);window.addEventListener('scroll',()=>{b.classList.toggle('show',window.scrollY>800)},{passive:true});b.addEventListener('click',(e)=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'})})})();


document.addEventListener('DOMContentLoaded', function () {
    const pageUrl = encodeURIComponent(window.location.href);
    const pageTitle = encodeURIComponent(document.title);
    const modalHTML = `<div class='share-modal' id='shareModal' style="display:none;"><div class='modal-content'><span class='modal-close-btn' id='shareCloseBtn'>&times;</span><h3 class='modal-title'>مشاركة مع الاصدقاء</h3><div class='share-links'><a class='share-btn s-fb' href="https://www.facebook.com/sharer/sharer.php?u=${pageUrl}" target='_blank'><svg class="icon"><use href='/public/assets/static/icons.svg#i-facebook'/></svg><span>فيسبوك</span></a><a class='share-btn s-x' href="https://twitter.com/intent/tweet?text=${pageTitle}&url=${pageUrl}" target='_blank'><svg class="icon"><use href='/public/assets/static/icons.svg#i-x'/></svg><span>إكس</span></a><a class='share-btn s-wa' href="https://api.whatsapp.com/send?text=${pageTitle}%20${pageUrl}" target='_blank'><svg class="icon"><use href='/public/assets/static/icons.svg#i-whatsapp'/></svg><span>واتساب</span></a><a class='share-btn s-tg' href="https://t.me/share/url?url=${pageUrl}&text=${pageTitle}" target='_blank'><svg class="icon"><use href='/public/assets/static/icons.svg#i-telegram'/></svg><span>تليجرام</span></a><a class='share-btn s-pin' href="https://pinterest.com/pin/create/button/?url=${pageUrl}&description=${pageTitle}" target='_blank'><svg class="icon"><use href='/public/assets/static/icons.svg#i-pinterest'/></svg><span>بينترست</span></a><a class='share-btn s-rd' href="https://reddit.com/submit?url=${pageUrl}&title=${pageTitle}" target='_blank'><svg class="icon"><use href='/public/assets/static/icons.svg#i-reddit'/></svg><span>ريديت</span></a><a class='share-btn s-em' href="mailto:?subject=${pageTitle}&body=${pageUrl}"><svg class="icon"><use href='/public/assets/static/icons.svg#i-email'/></svg><span>بريد إلكتروني</span></a><a class='share-btn s-copy' id='copyLinkBtn' href="javascript:void(0);" rel="nofollow"><svg class="icon"><use href='/public/assets/static/icons.svg#i-copy'/></svg><span>نسخ الرابط</span></a></div></div></div>`;document.body.insertAdjacentHTML('beforeend',modalHTML);const m=document.getElementById('shareModal'),o=document.getElementById('shareOpenBtn'),c=document.getElementById('shareCloseBtn'),cp=document.getElementById('copyLinkBtn'),cl=()=>{m.style.display='none',document.body.style.overflow='auto'};if(o)o.onclick=()=>{m.style.display='block',document.body.style.overflow='hidden'};if(c)c.onclick=cl;window.onclick=e=>{if(e.target==m)cl()};if(cp)cp.onclick=()=>{navigator.clipboard.writeText(window.location.href).then(()=>{alert('تم نسخ الرابط بنجاح!')}).catch(e=>console.error(e))};document.querySelectorAll('.share-btn').forEach(b=>{if(!b.classList.contains('s-em')&&!b.classList.contains('s-wa')&&b.id!=='copyLinkBtn'){b.onclick=function(e){e.preventDefault();window.open(this.href,'share-dialog','width=600,height=400')}}})})


// =================== Track ===================

const VIDManager={generate(){return`VID-${Date.now()}-${Math.random().toString(36).substring(2,9).toUpperCase()}-${Math.random().toString(36).substring(2,9).toUpperCase()}`},getPersistentId(){let i=localStorage.getItem("visitor_id");if(!i){i=this.generate();localStorage.setItem("visitor_id",i)}return i}};

const SIDManager={generate(){return`SID-${Date.now()}-${Math.random().toString(36).substring(2,9).toUpperCase()}`},getSessionId(){let i=sessionStorage.getItem("session_id");if(!i){i=this.generate();sessionStorage.setItem("session_id",i)}return i}};


const ISeekTracker={queue:[],startTime:Date.now(),config:{workerUrl:"https://analytics.iseekprice.com",sub:window.location.hostname.match(/^(sa|ae|om|ma|dz|tn)\./i)?.[1].toUpperCase()||"SA"},getDeviceInfo(){const ua=navigator.userAgent;let type="Desktop";if(/tablet|ipad|playbook|silk/i.test(ua))type="Tablet";else if(/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Opera Mini/i.test(ua))type="Mobile";return{type:type,res:`${screen.width}x${screen.height}`}},pushEvent(ev,det="",dest=""){this.queue.push({ev:ev,det:det,dest:dest,ts:Date.now()})},flush(){if(this.queue.length===0)return;const duration=Math.floor((Date.now()-this.startTime)/1000);const device=this.getDeviceInfo();const payload={vid:VIDManager.getPersistentId(),sid:SIDManager.getSessionId(),dur:duration,sub:this.config.sub,path:window.location.pathname,ref:document.referrer||"direct",pid:document.querySelector('.UID')?.innerText.trim()||"none",ua:navigator.userAgent,dt:device.type,sr:device.res,events:this.queue};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});navigator.sendBeacon(this.config.workerUrl,blob);this.queue=[]},init(){this.pushEvent("VIEW");document.addEventListener("click",(e)=>{const el=e.target.closest("a, button, .add-to-cart, .external-cart-button");if(el){const info=el.innerText.trim()||el.ariaLabel||el.className||"click";const destination=el.tagName==="A"?el.href:"";this.pushEvent("CLICK",info.substring(0,50),destination);if(destination&&!destination.includes(window.location.hostname)){this.flush()}}});window.addEventListener("pagehide",()=>this.flush());window.addEventListener("visibilitychange",()=>{if(document.visibilityState==='hidden')this.flush();})}};ISeekTracker.init()
