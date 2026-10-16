export function contactOptions() {
  const phone = process.env.PUBLIC_OWNER_PHONE?.trim();
  const telegram = process.env.PUBLIC_OWNER_TELEGRAM?.trim().replace(/^@/, "");
  const whatsapp = process.env.PUBLIC_OWNER_WHATSAPP?.replace(/\D/g, "");
  return {
    phone: phone && /^\+?[0-9 ()-]{7,25}$/.test(phone) && /^\d{10,15}$/.test(phone.replace(/\D/g, ""))
      ? `tel:${phone.replace(/[ ()-]/g, "")}` : null,
    telegram: telegram && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(telegram) ? `https://t.me/${telegram}` : null,
    whatsapp: whatsapp && /^\d{10,15}$/.test(whatsapp) ? `https://wa.me/${whatsapp}` : null,
  };
}
