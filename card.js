const CFG=window.SIMTA_CONFIG||{};
const API=(CFG.API_BASE||"").replace(/\/$/,"");
const ID_RE=/^SMT-\d{3,6}$/;
let R=document;const $=i=>R.querySelector("#"+i)||document.createElement("i");
const params=new URLSearchParams(location.search);
const id=(params.get("id")||window.SIMTA_DEFAULT_ID||"").trim().toUpperCase();
let rep=null,state="loading",english=(params.get("lang")==="en");
const T={
 ar:{btn:"English",call:"اتصال",wa:"واتساب",save:"حفظ جهة الاتصال",share:"مشاركة البطاقة",phoneL:"الهاتف",emailL:"البريد الإلكتروني",deptL:"القسم",regionL:"الموقع",desc:"سيمتا شركة متخصصة في الخرسانة الجاهزة، هدفنا أن نكون شريكًا يُعتمد عليه في مشروعك، والجودة هي أساس ما نقدّمه. تواصل مع ممثلنا لمعرفة المزيد.",nfT:"البطاقة غير موجودة",nfB:"هذه البطاقة غير موجودة أو تم حذفها.",mtT:"الموقع تحت الصيانة",mtB:"الموقع تحت الصيانة حاليًا. نعمل على تحسين الخدمة، يُرجى المحاولة لاحقًا.",unT:"تعذّر تحميل البطاقة",unB:"لا يمكن الوصول إلى الخدمة الآن. حاول مرة أخرى بعد قليل.",loading:"جارٍ التحميل…",chip:"رقم الموظف",copied:"تم نسخ رابط البطاقة"},
 en:{btn:"العربية",call:"Call",wa:"WhatsApp",save:"Save contact",share:"Share card",phoneL:"Phone",emailL:"Email",deptL:"Department",regionL:"Location",desc:"SIMTA is a ready-mix concrete company. We aim to be a partner you can rely on for your project, and quality is the foundation of what we offer. Contact our representative to learn more.",nfT:"Card not found",nfB:"This card does not exist or has been deleted.",mtT:"Site under maintenance",mtB:"The site is currently under maintenance. We are working to improve the service. Please try again later.",unT:"Could not load this card",unB:"The service is not reachable right now. Please try again in a moment.",loading:"Loading…",chip:"Employee ID",copied:"Card link copied"}
};
const DEFAULT_AV='<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#e8dac5"/><circle cx="32" cy="25" r="11" fill="#9c7040"/><path d="M10 64c0-14 9-22 22-22s22 8 22 22z" fill="#9c7040"/></svg>';
const digits=s=>String(s||"").replace(/[^\d]/g,"");
const tel=s=>String(s||"").replace(/[^\d+]/g,"");
function setAvatar(el){el.innerHTML=DEFAULT_AV;if(!rep||!rep.photo_url)return;const im=new Image();im.alt="";im.onload=()=>{el.innerHTML="";el.appendChild(im)};im.src=API+rep.photo_url}
function renderOne(){
 const t=english?T.en:T.ar;
 const h=document.documentElement;h.lang=english?"en":"ar";h.dir=english?"ltr":"rtl";
 $("langBtn").textContent=t.btn;$("sideDesc").textContent=t.desc;$("companyDesc").textContent=t.desc;
 const msg=state==="notfound"?[t.nfT,t.nfB]:state==="maintenance"?[t.mtT,t.mtB]:state==="error"?[t.unT,t.unB]:null;
 $("hero").style.display=state==="ready"?"":"none";$("content").style.display=state==="ready"?"":"none";
 $("notfound").style.display=msg?"block":"none";
 if(msg){$("nfTitle").textContent=msg[0];$("nfBody").textContent=msg[1];return}
 if(state==="loading"){$("hero").style.display="";$("name").textContent=t.loading;return}
 const nm=(english?rep.name_en:rep.name_ar)||rep.name_en||rep.name_ar;
 $("name").textContent=nm;setAvatar($("avatar"));
 $("role").textContent=(english?rep.title_en:rep.title_ar)||rep.title_en||rep.title_ar;
 $("repId").textContent=t.chip+" · "+rep.id;
 $("callT").textContent=t.call;$("waT").textContent=t.wa;$("save").textContent=t.save;$("share").textContent=t.share;
 $("phoneL").textContent=t.phoneL;$("emailL").textContent=t.emailL;$("regionL").textContent=t.regionL;$("deptL").textContent=t.deptL;
 $("phone").textContent=rep.phone;$("phoneRow").href="tel:"+tel(rep.phone);$("call").href="tel:"+tel(rep.phone);
 const wa=digits(rep.whatsapp);$("wa").style.display=wa?"":"none";if(wa){$("wa").href="https://wa.me/"+wa;$("wa").target="_blank";$("wa").rel="noopener"}
 $("emailRow").style.display=rep.email?"":"none";if(rep.email){$("email").textContent=rep.email;$("emailRow").href="mailto:"+encodeURIComponent(rep.email).replace(/%40/g,"@")}
 const dept=english?rep.dept_en:rep.dept_ar;$("deptRow").style.display=dept?"":"none";$("dept").textContent=dept||"";
 const loc=english?rep.location_en:rep.location_ar;$("region").parentNode.parentNode.style.display=loc?"":"none";$("region").textContent=loc||"";
 document.title="SIMTA | "+nm;
}
function render(){document.querySelectorAll(".root").forEach(r=>{R=r;renderOne()})}
function toggleLang(){english=!english;render()}
function toast(m){const e=document.getElementById("toast");e.textContent=m;e.classList.add("on");setTimeout(()=>e.classList.remove("on"),2200)}
const vesc=s=>String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
function buildVcard(r){
 const loc=r.location_en||r.location_ar;
 const L=["BEGIN:VCARD","VERSION:3.0","N;CHARSET=utf-8:;"+vesc(r.name_en||r.name_ar)+";;;","FN;CHARSET=utf-8:"+vesc(r.name_en||r.name_ar),"ORG;CHARSET=utf-8:SIMTA Ready Mix Concrete"+(r.dept_en?";"+vesc(r.dept_en):""),"TITLE;CHARSET=utf-8:"+vesc(r.title_en||r.title_ar),"TEL;TYPE=CELL,VOICE:"+tel(r.phone)];
 if(digits(r.whatsapp))L.push("TEL;TYPE=CELL,WHATSAPP:+"+digits(r.whatsapp));
 if(r.email)L.push("EMAIL;TYPE=INTERNET,WORK:"+vesc(r.email));
 if(loc)L.push("ADR;TYPE=WORK;CHARSET=utf-8:;;"+vesc(loc)+";;;;");
 if(r.name_ar&&r.name_en)L.push("NOTE;CHARSET=utf-8:"+vesc(r.name_ar));
 L.push("URL:"+location.origin+location.pathname+"?id="+r.id,"END:VCARD");return L.join("\r\n")
}
function downloadVcard(){if(!rep)return;const blob=new Blob([buildVcard(rep)],{type:"text/vcard;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="SIMTA-"+rep.id+".vcf";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function shareCard(){
 const url=location.origin+location.pathname+"?id="+rep.id;const t=english?T.en:T.ar;
 if(navigator.share){try{await navigator.share({title:"SIMTA | "+(english?rep.name_en:rep.name_ar),url});return}catch(e){if(e&&e.name==="AbortError")return}}
 try{await navigator.clipboard.writeText(url);toast(t.copied)}catch(e){window.prompt(url,url)}
}
async function load(){
 if(!ID_RE.test(id)){state="notfound";render();return}
 render();
 try{
  let q="";const day=new Date().toISOString().slice(0,10);let first=false;
  try{if(params.get("preview")==="1")q="?preview=1";else if(localStorage.getItem("simta_seen")!==day){q="?f=1";first=true}}catch(e){}
  const res=await fetch(API+"/api/employees/"+encodeURIComponent(id)+q,{cache:"no-store"});
  try{if(first&&res.ok)localStorage.setItem("simta_seen",day)}catch(e){}
  if(res.status===404||res.status===400){state="notfound"}
  else if(res.status===503){let d=null;try{d=await res.json()}catch(e){}state=(d&&d.code==="maintenance")?"maintenance":"error"}
  else if(!res.ok){state="error"}
  else{rep=await res.json();state=(rep&&rep.id===id)?"ready":"error"}
 }catch(e){state="error"}
 render();
}
load();
document.addEventListener("click",(e)=>{const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act;if(a==="toggleLang")toggleLang();else if(a==="downloadVcard")downloadVcard();else if(a==="shareCard")shareCard()});
