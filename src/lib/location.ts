export function normalizeLocation(rawCidade?: string | null, rawEstado?: string | null): { cidade: string; estado: string } {
  let cidade = (rawCidade || '').trim();
  let estado = (rawEstado || '').trim();

  if (cidade) {
    // Split by separators like '-', '/', ',', '.' or whitespace
    const parts = cidade.split(/[\s\-/,\.]+/).map(p => p.trim()).filter(Boolean);
    const nonStateParts: string[] = [];

    for (const part of parts) {
      const u = part.toUpperCase();
      if (u.length === 2 && /^[A-Z]{2}$/.test(u)) {
        if (!estado) estado = u;
      } else {
        nonStateParts.push(part);
      }
    }

    if (nonStateParts.length > 0) {
      cidade = nonStateParts.join(' ');
    }
  }

  if (estado) {
    estado = estado.toUpperCase().trim();
  }

  // Format UBERLANDIA to UBERLÂNDIA
  if (cidade.toUpperCase() === 'UBERLANDIA') {
    cidade = 'UBERLÂNDIA';
  }

  return { cidade, estado };
}

export function formatLocation(rawCidade?: string | null, rawEstado?: string | null): string {
  const { cidade, estado } = normalizeLocation(rawCidade, rawEstado);
  if (cidade && estado) {
    return `${cidade} - ${estado}`;
  }
  return cidade || estado || '';
}
