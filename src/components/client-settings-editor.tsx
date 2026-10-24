"use client";

import { useState, type FormEvent } from "react";
import { CLIENT_UI_DEFAULTS, TEXT_LABELS, clientUiSchema, contrast, type ClientUi } from "@/lib/client-ui";

export function ClientSettingsEditor({initial}: {initial: {revision: number; settings: ClientUi}}) {
  const [settings, setSettings] = useState(initial.settings);
  const [revision, setRevision] = useState(initial.revision);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const parsed = clientUiSchema.safeParse(settings);
    if (!parsed.success) {setFailed(true); setMessage(parsed.error.issues[0].message); return;}
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/admin/settings", {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({revision, settings: parsed.data})});
      const data = await response.json();
      if (!response.ok) {setFailed(true); setMessage(response.status === 409 ? "Другой администратор уже изменил настройки. Скопируйте свой текст и обновите страницу перед повторным сохранением." : response.status === 401 ? "Сессия завершилась. Войдите заново." : data.error || "Не удалось сохранить настройки."); return;}
      setRevision(data.revision); setSettings(data.settings); setMessage("Настройки сохранены. Они появятся при следующем открытии каталога.");
    } catch {setFailed(true); setMessage("Нет связи с сервером. Изменения не потеряны — повторите сохранение.");}
    finally {setBusy(false);}
  }
  return <form onSubmit={save} aria-busy={busy} className="grid gap-6">
    <fieldset disabled={busy} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <legend className="px-2 text-lg font-semibold">Цвета интерфейса</legend>
      <p className="text-sm text-slate-600">Контраст текста и основных действий с белым и выбранным фоном — не ниже 4.5:1. Неудачное сочетание сохранить нельзя.</p>
      <div className="grid gap-4 sm:grid-cols-3">{([['primary','Основной цвет кнопок и ссылок'],['text','Основной текст'],['background','Фон каталога']] as const).map(([key,label])=><label key={key} className="grid gap-2 text-sm font-medium">{label}
        <input aria-label={`${label}: выбрать цвет`} type="color" value={settings.colors[key]} className="h-12 w-full cursor-pointer rounded border" onChange={e=>setSettings({...settings,colors:{...settings.colors,[key]:e.target.value}})}/>
        <input aria-label={`${label}: HEX`} value={settings.colors[key]} maxLength={7} pattern="#[0-9A-Fa-f]{6}" required className="min-h-11 rounded border p-2" onChange={e=>setSettings({...settings,colors:{...settings.colors,[key]:e.target.value}})}/>
      </label>)}</div>
      <div className="rounded-xl border p-5" style={{background:settings.colors.background,color:settings.colors.text}} aria-label="Предпросмотр цветов">
        <p className="mb-4 font-semibold">Проверить даты и стоимость</p>
        <div className="flex flex-wrap gap-3"><span className="inline-flex min-h-12 items-center rounded-lg px-5 font-semibold" style={{background:settings.colors.primary,color:'#FFFFFF'}}>Основное действие</span><span className="inline-flex min-h-12 items-center rounded-lg border-2 bg-white px-5 font-semibold" style={{borderColor:settings.colors.primary,color:settings.colors.primary}}>Вторичное действие</span></div>
        <p className="mt-4 text-sm">Контраст кнопки с белым: {contrast(settings.colors.primary,'#FFFFFF').toFixed(2)}:1</p>
      </div>
    </fieldset>
    <fieldset disabled={busy} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <legend className="px-2 text-lg font-semibold">Клиентские тексты</legend>
      <p className="text-sm text-slate-600">Только обычный текст. Фотографии, описания, ссылки связи, юридические согласия и правила расчёта здесь не меняются.</p>
      <div className="grid gap-4 md:grid-cols-2">{Object.entries(TEXT_LABELS).map(([key,label])=><label key={key} className="grid gap-2 text-sm font-medium">{label}
        <textarea rows={key.endsWith('Button')?2:3} required maxLength={key.endsWith('Button')?40:240} value={settings.texts[key as keyof ClientUi['texts']]} className="w-full rounded-lg border border-slate-300 p-3" onChange={e=>setSettings({...settings,texts:{...settings.texts,[key]:e.target.value}})}/>
      </label>)}</div>
    </fieldset>
    <div className="flex flex-wrap gap-3"><button disabled={busy} type="submit" className="min-h-12 rounded-lg bg-blue-700 px-6 font-semibold text-white disabled:opacity-60">{busy?'Сохраняем…':'Сохранить настройки'}</button><button disabled={busy} type="button" className="min-h-12 rounded-lg border border-slate-300 bg-white px-5" onClick={()=>{setSettings(structuredClone(CLIENT_UI_DEFAULTS));setMessage('Стандартные значения подставлены. Для применения нажмите «Сохранить настройки».');setFailed(false);}}>Подставить стандартные значения</button></div>
    <p role={failed?'alert':'status'} className={failed?'text-red-800':'text-emerald-800'}>{message}</p>
  </form>;
}
