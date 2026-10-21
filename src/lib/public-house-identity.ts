// Tilda links use a stable Product UID. An editable internal slug must not
// redirect an existing card to another house, even after the UID is unlinked.
export function publicHouseIdentity(value: string) {
  const uid = /^tilda-(\d{1,30})$/.exec(value)?.[1];
  return uid ? { tildaProductUid: uid } : { slug: value };
}
