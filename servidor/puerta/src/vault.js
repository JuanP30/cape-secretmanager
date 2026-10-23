// Cliente de `bw serve` (API local del CLI de Bitwarden, desbloqueado con el usuario de servicio «puerta»).
// Una credencial es «accionable» si tiene los campos cape_alias y cape_tipo.

export function crearVault(base = 'http://127.0.0.1:8087', f = fetch) {
  const pedir = async (ruta, opciones) => {
    const j = await (await f(base + ruta, opciones)).json();
    if (!j.success) throw new Error(`vault: ${ruta} falló`);
    return j.data;
  };
  return {
    sincronizar: () => pedir('/sync', { method: 'POST' }),
    // Las colecciones pueden venir anidadas («Default collection/VPS»): la empresa es la última parte.
    colecciones: async () => (await pedir('/list/object/collections')).data
      .map((c) => ({ id: c.id, nombre: String(c.name).split('/').pop().trim() })),
    items: async () => (await pedir('/list/object/items')).data,
    guardarItem: (item) => pedir(`/object/item/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }),
    organizacion: async () => (await pedir('/list/object/organizations')).data[0]?.id,
    crearItem: (item) => pedir('/object/item', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }),
    crearColeccion: (orgId, nombre) => pedir(`/object/org-collection?organizationId=${encodeURIComponent(orgId)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId, name: nombre, groups: [] }) }),
  };
}

export const campo = (item, nombre) => (item.fields || []).find((x) => x.name === nombre)?.value;

function empresaDe(item, colecciones, empresas) {
  const ids = new Set(item.collectionIds || []);
  return colecciones.find((c) => ids.has(c.id) && (empresas.includes('*') || empresas.includes(c.nombre)))?.nombre;
}

export function credencialesDe(items, colecciones, empresas) {
  return items
    .filter((i) => campo(i, 'cape_alias') && campo(i, 'cape_tipo'))
    .map((i) => ({ i, empresa: empresaDe(i, colecciones, empresas) }))
    .filter((x) => x.empresa)
    .map(({ i, empresa }) => ({ alias: campo(i, 'cape_alias'), tipo: campo(i, 'cape_tipo'), nombre: i.name, empresa }));
}

export function buscarAlias(items, colecciones, empresas, alias) {
  return items.find((i) => campo(i, 'cape_alias') === alias && empresaDe(i, colecciones, empresas)) || null;
}

export function secretosDe(item) {
  return [item.login?.password, ...(item.fields || []).filter((x) => x.type === 1).map((x) => x.value)]
    .filter(Boolean);
}
