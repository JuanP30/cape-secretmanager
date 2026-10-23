// Correos de la Puerta (invitaciones). No habla SMTP: arma el correo MIME y lo entrega a un webhook
// (CORREO_WEBHOOK) con el mismo contrato que servidor/vaultwarden/cape-sendmail: {"raw": <MIME en base64url>}
// y la cabecera X-Vault-Key. Sin CORREO_WEBHOOK no se envía nada y la app muestra el código para pasarlo a mano.
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

export function armarMime(para, asunto, html) {
  return [`To: ${para}`, `Subject: =?UTF-8?B?${b64(asunto)}?=`, 'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html)].join('\r\n');
}

export function crearCorreo({ url = process.env.CORREO_WEBHOOK, clave = process.env.CORREO_CLAVE, fetchFn = fetch } = {}) {
  if (!url) return null;
  return async (para, asunto, html) => {
    const raw = Buffer.from(armarMime(para, asunto, html)).toString('base64url');
    const r = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vault-Key': clave || '' },
      body: JSON.stringify({ raw }), signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`el webhook de correo respondió ${r.status}`);
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function correoInvitacion({ nombre, correo, codigo, puerta, repo }) {
  const paso = (n, t) => `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#4b2a8c;font-weight:700">${n}</td><td style="padding:6px 0">${t}</td></tr>`;
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:auto;color:#2b2340">
<div style="background:linear-gradient(135deg,#4b2a8c,#2a1660);color:#fff;border-radius:12px 12px 0 0;padding:22px 28px;font-size:20px;font-weight:700">CAPE SecretManager</div>
<div style="border:1px solid #e6def7;border-top:0;border-radius:0 0 12px 12px;padding:26px 28px;line-height:1.55">
<p style="margin:0 0 14px">Hola ${esc(nombre || correo)}: te invitaron a <b>CAPE SecretManager</b>, el gestor de claves del equipo.</p>
<p style="margin:0 0 8px">Tu código de alta (vale 24 horas):</p>
<p style="font:700 26px/1 Menlo,Consolas,monospace;letter-spacing:.14em;color:#4b2a8c;background:#f3eefc;border-radius:10px;padding:14px 18px;display:inline-block;margin:0 0 18px">${esc(codigo)}</p>
<table style="border-collapse:collapse;font-size:15px">
${paso('1', `Construye e instala la app${repo ? ` siguiendo <a href="${esc(repo)}" style="color:#4b2a8c">el repo</a> (docs/2-app.md)` : ''}. Cuando pida la dirección de la Puerta, usa:<br><code style="background:#f3eefc;padding:2px 6px;border-radius:5px">${esc(puerta)}</code>`)}
${paso('2', 'Abre la app (candado de la barra, o ⌘⇧K / Ctrl+Shift+K) y toca <b>«Primera vez · tengo un código de alta»</b>.')}
${paso('3', `Escribe tu correo (<b>${esc(correo)}</b>), este código y una contraseña nueva de al menos 10 caracteres.`)}
${paso('4', 'Escanea el QR con tu app de códigos (Google o Microsoft Authenticator…), escribe los 6 dígitos de la entrada <b>CAPE SecretManager</b> y toca <b>Activar</b>. Luego <b>Entrar</b>.')}
</table>
<p style="margin:18px 0 0;font-size:13px;color:#6b6280">No compartas este código ni tu contraseña con nadie, tampoco con tu IA. Si no esperabas esta invitación, ignora el correo.</p>
</div></div>`;
}
