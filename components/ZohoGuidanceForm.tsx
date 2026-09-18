const formUrl = "https://forms.zohopublic.in/onewindow/form/StudyAbroadApplicationForm/formperma/jGJIp30LCf30UXhfAyzC82bep7S1ZSGZNrIfqN28bJ4";

export default function ZohoGuidanceForm() {
  return (
    <div className="min-h-[1180px] overflow-hidden bg-white">
      <iframe
        aria-label="Future Atlas Contact form"
        className="h-[1180px] w-full border-0"
        referrerPolicy="strict-origin-when-cross-origin"
        src={formUrl}
        title="Future Atlas Contact form"
      />
    </div>
  );
}
