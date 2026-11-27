/* Quote request (طلب عرض سعر): builds a ready WhatsApp message to the card's own representative.
   Nothing is sent by the site: the visitor reviews the text and sends it inside WhatsApp. */
(function(){
"use strict";
var K=window.COMPANY,CO={nameAr:K.nameAr,nameEn:K.nameEn,ink:K.quote.ink,accent:K.quote.accent,btnBg:K.quote.btnBg,
 fields:K.quote.fields,
 css:".qr-btn{grid-column:1/-1;display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border-radius:14px;border:1.5px solid "+K.quote.btnBorder+";background:"+K.quote.btnSoft+";color:"+K.quote.btnBg+";font-weight:700;font-size:16px;line-height:1.2;font-family:inherit;cursor:pointer;margin:0;padding:8px 12px}.v2 .qr-btn{grid-column:1/-1;min-height:54px;border-radius:16px}.qr-btn:active{transform:scale(.98)}",
 rep:function(){if(typeof rep==="undefined"||!rep||state!=="ready")return null;var w=digits(rep.whatsapp);if(!w)return null;return{id:rep.id,wa:w,phone:rep.phone||("+"+w),nameAr:rep.name_ar||rep.name_en||"",nameEn:rep.name_en||rep.name_ar||""}},
 en:function(){return english},before:"#save",
 hosts:function(){return Array.prototype.slice.call(document.querySelectorAll(".root .actions"))},
 install:function(sync){var o=render;render=function(){o.apply(this,arguments);sync()};sync()}};
var T={
 ar:{quote:"اطلب عرض سعر",title:"طلب عرض سعر",send:"تجهيز رسالة واتساب",
  note:"سيُجمَع طلبك في رسالة واتساب جاهزة للمندوب، تراجعها ثم ترسلها بنفسك.",
  req:"أكمل الحقول المطلوبة أولًا",from:"من البطاقة الرقمية",edit:"تعديل الطلب",openWa:"فتح واتساب بالرسالة",close:"إغلاق",choose:"اختر",
  hint:function(n,p){return "الوجهة: "+n+" — "+p+". يفتح الرابط محادثة واتساب مع المندوب والرسالة مُعبّأة كما هي أعلاه. لا يُرسل شيء إلا بضغطة إرسال منك داخل واتساب."}},
 en:{quote:"Request a quote",title:"Quote request",send:"Prepare WhatsApp message",
  note:"Your request is packed into a ready WhatsApp message to the rep. You review it and send it yourself.",
  req:"Please complete the required fields first",from:"Sent from the digital card",edit:"Edit request",openWa:"Open WhatsApp with the message",close:"Close",choose:"Choose",
  hint:function(n,p){return "Destination: "+n+" \u2014 "+p+". The link opens a WhatsApp chat with the rep, prefilled with the message above. Nothing is sent until you press send inside WhatsApp."}}
};
function getRep(){var r=CO.rep();return r&&r.wa?r:null}
function isEn(){return CO.en()}
function msgText(rep,vals,en){
 var t=en?T.en:T.ar,lines=[t.title+" \u2014 "+(en?CO.nameEn:CO.nameAr)];
 CO.fields.forEach(function(f){
  var v=String(vals[f.k]||"").trim();if(!v)return;
  if(f.t==="select"&&en){for(var i=0;i<f.opts.length;i++)if(f.opts[i].v===v){v=f.opts[i].en;break}}
  if(f.t==="date")v="\u2066"+v+"\u2069";
  if(f.uAr)v+=en?f.uEn:f.uAr;
  lines.push((en?f.mEn:f.mAr)+": "+v)});
 lines.push("\u2014");lines.push(t.from+" \u00b7 "+rep.id);
 return lines.join("\n")}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
var lastBtn=null;
function closeSheet(){var w=document.getElementById("qr-wrap");if(w)w.remove();document.documentElement.classList.remove("qr-lock");if(lastBtn){try{lastBtn.focus()}catch(e){}}}
function openSheet(btn){
 var rep=getRep();if(!rep)return;lastBtn=btn;
 var en=isEn(),t=en?T.en:T.ar,vals={},bad={},ready=false;
 var wrap=el("div","qr-wrap");wrap.id="qr-wrap";
 var back=el("div","qr-back");back.onclick=closeSheet;
 var sh=el("div","qr-sheet");sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");sh.dir=en?"ltr":"rtl";sh.lang=en?"en":"ar";
 wrap.appendChild(back);wrap.appendChild(sh);document.body.appendChild(wrap);document.documentElement.classList.add("qr-lock");
 wrap.addEventListener("keydown",function(e){if(e.key==="Escape")closeSheet()});
 function draw(){
  sh.innerHTML="";
  var head=el("div","qr-head");head.appendChild(el("b","qr-ttl",t.title+" \u2014 "+(en?CO.nameEn:CO.nameAr)));
  var x=el("button","qr-x","\u00d7");x.type="button";x.setAttribute("aria-label",t.close);x.onclick=closeSheet;head.appendChild(x);sh.appendChild(head);
  if(!ready){
   var form=el("div","qr-fields");
   CO.fields.forEach(function(f){
    var id="qr-"+f.k;var lab=el("label","qr-lab",(en?f.lEn:f.lAr));lab.htmlFor=id;form.appendChild(lab);
    var inp;
    if(f.t==="textarea"){inp=el("textarea","qr-in");inp.rows=3;inp.maxLength=500}
    else if(f.t==="select"){inp=el("select","qr-in");var o0=el("option",null,"\u2014");o0.value="";inp.appendChild(o0);
     f.opts.forEach(function(o){var op=el("option",null,en?o.en:o.v);op.value=o.v;inp.appendChild(op)})}
    else{inp=el("input","qr-in");inp.type=f.t;if(f.t==="number"){inp.inputMode="decimal";inp.min="0";inp.step="any"}else if(f.t==="text")inp.maxLength=120;
     var ph=en?f.pEn:f.pAr;if(ph)inp.placeholder=ph}
    inp.id=id;if(bad[f.k])inp.classList.add("qr-bad");
    inp.value=vals[f.k]||"";
    var h=function(){vals[f.k]=inp.value;if(bad[f.k]){delete bad[f.k];inp.classList.remove("qr-bad");if(!Object.keys(bad).length){var er=sh.querySelector(".qr-err");if(er)er.remove()}}};
    inp.addEventListener("input",h);inp.addEventListener("change",h);
    form.appendChild(inp)});
   sh.appendChild(form);
   if(Object.keys(bad).length){var er=el("p","qr-err",t.req);er.setAttribute("role","alert");sh.appendChild(er)}
   sh.appendChild(el("p","qr-note",t.note));
   var sb=el("button","qr-send",t.send);sb.type="button";sb.onclick=function(){
    var miss={};CO.fields.forEach(function(f){if(f.req&&!String(vals[f.k]||"").trim())miss[f.k]=1});
    if(Object.keys(miss).length){bad=miss;draw();return}
    ready=true;draw()};
   sh.appendChild(sb)}
  else{
   var msg=msgText(rep,vals,en);
   var pre=el("pre","qr-msg",msg);pre.dir="auto";sh.appendChild(pre);
   sh.appendChild(el("p","qr-note",t.hint(en?rep.nameEn:rep.nameAr,"\u2066"+rep.phone+"\u2069")));
   var a=el("a","qr-send qr-open",t.openWa);a.href="https://wa.me/"+rep.wa+"?text="+encodeURIComponent(msg);a.target="_blank";a.rel="noopener";sh.appendChild(a);
   var ed=el("button","qr-edit",t.edit);ed.type="button";ed.onclick=function(){ready=false;draw()};sh.appendChild(ed)}
 }
 draw();
 var f0=sh.querySelector(".qr-in");if(f0&&!(window.matchMedia&&matchMedia("(pointer:coarse)").matches)){try{f0.focus()}catch(e){}}
}
function css(){
 if(document.getElementById("qr-style"))return;
 var s=document.createElement("style");s.id="qr-style";
 s.textContent=CO.css+
 "html.qr-lock{overflow:hidden}"+
 ".qr-wrap{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}"+
 ".qr-back{position:absolute;inset:0;background:rgba(41,37,31,.55)}"+
 ".qr-sheet{position:relative;width:100%;max-width:520px;max-height:92vh;max-height:92dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#fff;color:"+CO.ink+";border-radius:22px 22px 0 0;padding:18px 18px max(22px,env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.25);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,'Noto Naskh Arabic',Arial,sans-serif;font-size:16px;line-height:1.5;box-sizing:border-box}"+
 ".qr-sheet *{box-sizing:border-box;font-family:inherit}"+
 "@media(min-width:700px){.qr-wrap{justify-content:center}.qr-sheet{border-radius:22px;max-height:88vh}}"+
 ".qr-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}"+
 ".qr-ttl{flex:1 1 auto;min-width:0;font-size:19px;line-height:1.4}"+
 ".qr-x{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid #ddd;background:#f6f2ec;color:"+CO.ink+";font-size:22px;line-height:1;cursor:pointer;padding:0}"+
 ".qr-fields{display:flex;flex-direction:column}"+
 ".qr-lab{margin:12px 0 5px;font-weight:700;font-size:14.5px}"+
 ".qr-in{width:100%;border:1.5px solid #d9cdbb;border-radius:12px;padding:12px 13px;font-size:16px;background:#fff;color:"+CO.ink+";min-height:48px}"+
 ".qr-in:focus{outline:2px solid "+CO.accent+";outline-offset:1px}"+
 "textarea.qr-in{resize:vertical}"+
 ".qr-bad{border-color:#c0392b;background:#fdf3f1}"+
 ".qr-err{color:#b02a1c;font-weight:700;margin:10px 0 0;font-size:14.5px}"+
 ".qr-note{margin:12px 0;font-size:13.5px;line-height:1.75;color:#6b5f52}"+
 ".qr-send{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border:0;border-radius:14px;background:"+CO.btnBg+";color:#fff;font-weight:800;font-size:16px;cursor:pointer;text-decoration:none;padding:10px 14px;text-align:center}"+
 ".qr-edit{display:block;margin:12px auto 0;background:none;border:0;color:"+CO.accent+";font-weight:700;font-size:15px;text-decoration:underline;cursor:pointer;padding:8px}"+
 ".qr-msg{white-space:pre-wrap;word-break:break-word;background:#f7f3ec;border:1px solid #e5dccd;border-radius:14px;padding:14px;margin:6px 0 0;font-size:15px;line-height:1.7}";
 document.head.appendChild(s)}
function sync(){
 css();
 var rep=getRep(),en=isEn(),t=en?T.en:T.ar;
 CO.hosts().forEach(function(h){
  var b=h.querySelector(".qr-btn");
  if(!rep){if(b)b.remove();return}
  if(!b){b=el("button","qr-btn");b.type="button";b.addEventListener("click",function(){openSheet(b)});var bf=CO.before&&h.querySelector(CO.before);if(bf)h.insertBefore(b,bf);else h.appendChild(b)}
  b.textContent=t.quote})}
CO.install(sync);
})();
