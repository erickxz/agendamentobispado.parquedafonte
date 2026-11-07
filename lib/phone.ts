/** Remove tudo que não é dígito. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Máscara enquanto o usuário digita: "(41) 99999-8888" ou "(41) 3333-4444". */
export function maskPhone(value: string): string {
  let d = digitsOnly(value);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);

  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/**
 * Converte um telefone brasileiro para E.164 sem o "+" (formato usado pelo wa.me): "5541999998888".
 * Aceita com ou sem o 55 na frente. Retorna null se não for um número válido.
 */
export function toE164(value: string): string | null {
  let d = digitsOnly(value);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;

  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99 || d[0] === "0" || d[1] === "0") return null;

  const local = d.slice(2);
  if (local.length === 9 && local[0] !== "9") return null; // celular começa com 9
  if (local.length === 8 && !/^[2-5]/.test(local)) return null; // fixo começa com 2–5

  return `55${d}`;
}

/** "5541999998888" → "(41) 99999-8888" */
export function formatE164ForDisplay(e164: string): string {
  return maskPhone(e164.startsWith("55") ? e164.slice(2) : e164);
}
