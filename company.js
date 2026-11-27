// Per-company settings for the card page and the quote request. Public values only, never secrets.
// To brand another company, copy this file's shape; card.js and quote.js read everything from here.
window.COMPANY = {
  nameAr: "سيمتا",
  nameEn: "SIMTA",
  titleName: "SIMTA",
  vcardOrg: "SIMTA Ready Mix Concrete",
  vcardFilePrefix: "SIMTA-",
  descAr: "سيمتا شركة متخصصة في الخرسانة الجاهزة، هدفنا أن نكون شريكًا يُعتمد عليه في مشروعك، والجودة هي أساس ما نقدّمه. تواصل مع ممثلنا لمعرفة المزيد.",
  descEn: "SIMTA is a ready-mix concrete company. We aim to be a partner you can rely on for your project, and quality is the foundation of what we offer. Contact our representative to learn more.",
  brand: {
    pageTitle: "SIMTA | بطاقة الموظف",
    metaDesc: "SIMTA digital business card",
    logo: "2-logo.jpg",
    logoAlt: "SIMTA سيمتا",
    emblem: "3-emblem.webp",
    icon: "3-emblem.webp",
    touchIcon: "4-apple-touch-icon.png",
    panelTitle: "سيمتا | SIMTA",
    footer: "SIMTA · READY MIX CONCRETE"
  },
  quote: {
    ink: "#29251f",
    accent: "#70451f",
    btnBg: "#4b2f18",
    btnBorder: "#b58a55",
    btnSoft: "#f6ecdc",
    fields: [
 {k:"qty",t:"number",req:1,lAr:"الكمية التقريبية (م³)",lEn:"Approximate quantity (m³)",pAr:"مثال: 50",pEn:"e.g. 50",mAr:"الكمية",mEn:"Quantity",uAr:" م³",uEn:" m³"},
 {k:"loc",t:"text",req:1,lAr:"موقع المشروع",lEn:"Project location",pAr:"المدينة، الحي",pEn:"City, district",mAr:"الموقع",mEn:"Location"},
 {k:"co",t:"text",lAr:"اسم الشركة أو المؤسسة (اختياري)",lEn:"Company or establishment name (optional)",pAr:"مثال: شركة المثال للمقاولات",pEn:"e.g. Example Contracting Co.",mAr:"الشركة أو المؤسسة",mEn:"Company"},
 {k:"date",t:"date",lAr:"موعد الصب المطلوب (اختياري)",lEn:"Requested pour date (optional)",mAr:"موعد الصب",mEn:"Pour date"},
 {k:"notes",t:"textarea",lAr:"ملاحظات (اختياري)",lEn:"Notes (optional)",mAr:"ملاحظات",mEn:"Notes"}
    ]
  }
};
