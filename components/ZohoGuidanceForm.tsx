"use client";

import { useState } from "react";

const formUrl = "https://forms.zohopublic.in/onewindow/form/StudyAbroadApplicationForm/formperma/jGJIp30LCf30UXhfAyzC82bep7S1ZSGZNrIfqN28bJ4";

export default function ZohoGuidanceForm() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative min-h-[1180px] overflow-hidden bg-white">
      {!loaded && (
        <div className="absolute inset-0 z-10 space-y-6 bg-white py-2" aria-label="Loading application form">
          <div className="skeleton-sweep h-8 w-64 rounded bg-slate-200" />
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="grid gap-4 sm:grid-cols-2">
              <div className="skeleton-sweep h-14 rounded bg-slate-100" />
              <div className="skeleton-sweep h-14 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}
      <iframe
        aria-label="Future Atlas Contact form"
        className={`h-[1180px] w-full border-0 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        referrerPolicy="strict-origin-when-cross-origin"
        src={formUrl}
        title="Future Atlas Contact form"
      />
    </div>
  );
}
