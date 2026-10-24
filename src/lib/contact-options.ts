export function contactOptions() {
  const phone = process.env.PUBLIC_OWNER_PHONE?.trim();
  const telegram = process.env.PUBLIC_OWNER_TELEGRAM?.trim().replace(/^@/, "");
  const whatsappValue = process.env.PUBLIC_OWNER_WHATSAPP?.trim() || '';
  let whatsappLink: string|null=null;
  if(/^https:\/\/wa\.me\/(?:\d{10,15}|message\/[A-Za-z0-9]+)\/?$/.test(whatsappValue))whatsappLink=whatsappValue;
  else if(/^[+\d ()-]+$/.test(whatsappValue)&&/^\d{10,15}$/.test(whatsappValue.replace(/\D/g,'')))whatsappLink=`https://wa.me/${whatsappValue.replace(/\D/g,'')}`;
  return {
    phone: phone && /^\+?[0-9 ()-]{7,25}$/.test(phone) && /^\d{10,15}$/.test(phone.replace(/\D/g, ""))
      ? `tel:${phone.replace(/[ ()-]/g, "")}` : null,
    telegram: telegram && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(telegram) ? `https://t.me/${telegram}` : null,
    whatsapp: whatsappLink,
  };
}
