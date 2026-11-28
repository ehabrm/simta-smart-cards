/* Branches (فروعنا): shows the branches saved in the admin for this company.
   Additive: reads the public branches endpoint and renders inside #content of each layout.
   Nothing is shown if none are configured or the request fails. */
(function(){
"use strict";
var CFG=window.SIMTA_CONFIG||{},API=(CFG.API_BASE||"").replace(/\/$/,""),SLUG="simta",LIST=null;
var P='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
var css=".br-box{margin-top:18px;background:#faf6ef;border:1px solid #e8dfd2;border-radius:16px;padding:14px 16px;min-width:0}.br-box summary{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;cursor:pointer;list-style:none;color:#70451f}.br-box summary::-webkit-details-marker{display:none}.br-box summary i{width:28px;height:28px;border-radius:50%;background:#b58a55;color:#fff;display:grid;place-items:center;flex:none}.br-box summary i svg{width:16px;height:16px}.br-box summary::after{content:'';margin-inline-start:auto;width:9px;height:9px;border-inline-end:2px solid #70451f;border-bottom:2px solid #70451f;transform:rotate(45deg);transition:transform .2s}.br-box[open] summary::after{transform:rotate(-135deg)}.br-box ul{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px}.br-box li{display:flex;align-items:center;gap:8px;background:#fff;color:#4b2f18;border:1px solid #e8dfd2;border-radius:12px;padding:10px 12px;font-weight:700;font-size:15px;line-height:1.3;min-width:0;overflow-wrap:anywhere}.br-box li svg{width:18px;height:18px;flex:none;color:#b58a55}@media(max-width:340px){.br-box ul{grid-template-columns:1fr}}";
var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
function render(){
  if(!LIST)return;
  var en=document.documentElement.lang==="en";
  var roots=document.querySelectorAll(".root");
  for(var r=0;r<roots.length;r++){
    var host=roots[r].querySelector("#content");if(!host)continue;
    var d=host.querySelector(".br-box");
    if(!LIST.length){if(d)d.remove();continue}
    var tag=en?"en":"ar";
    if(d&&d.dataset.l===tag)continue;
    var open=d?d.open:true;
    if(!d){d=document.createElement("details");d.className="br-box";host.appendChild(d)}
    d.dataset.l=tag;d.open=open;
    var items=LIST.map(function(b){var t=en?(b[1]||b[0]):(b[0]||b[1]);return "<li>"+P+"<span></span></li>"});
    d.innerHTML="<summary><i>"+P+"</i><span>"+(en?"Our branches":"فروعنا")+"</span></summary><ul>"+items.join("")+"</ul>";
    var spans=d.querySelectorAll("li span");
    for(var k=0;k<spans.length;k++){var b=LIST[k];spans[k].textContent=en?(b[1]||b[0]):(b[0]||b[1])}
  }
}
try{
  var ac=new AbortController(),tm=setTimeout(function(){ac.abort()},5000);
  fetch(API+"/api/c/"+SLUG+"/branches",{cache:"no-store",signal:ac.signal})
   .then(function(r){return r.ok?r.json():Promise.reject()})
   .then(function(j){clearTimeout(tm);if(j&&j.configured===true&&Array.isArray(j.branches)){LIST=j.branches.map(function(b){return[String(b.name_ar||""),String(b.name_en||"")]});render()}})
   .catch(function(){});
}catch(e){}
new MutationObserver(function(){setTimeout(render,0)}).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
window.addEventListener("load",function(){setTimeout(render,300)});
})();
