"use client";

import { useEffect, useRef } from "react";

const ZOHO_FORM_URL = "https://forms.zohopublic.in/onewindow/form/StudyAbroadApplicationForm/formperma/jGJIp30LCf30UXhfAyzC82bep7S1ZSGZNrIfqN28bJ4";

export default function ZohoGuidanceForm() {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const referrer = window.top === window.self ? window.location.href : document.referrer;
    if (referrer && /^https?:\/\//i.test(referrer) && frame.current) frame.current.src = `${ZOHO_FORM_URL}?referrername=${encodeURIComponent(referrer.slice(0, 1800))}`;
  }, []);
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><iframe ref={frame} id="ziframe_542736" title="Future Atlas Contact form" src={ZOHO_FORM_URL} frameBorder="0" className="block h-[760px] w-full border-0" /></div>;
}
