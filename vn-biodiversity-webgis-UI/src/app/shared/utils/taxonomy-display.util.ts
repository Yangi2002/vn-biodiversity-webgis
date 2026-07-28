export function taxonomyDisplayName(canonicalName: string, vietnameseName?: string | null): string {
  if (vietnameseName && vietnameseName !== canonicalName) {
    return vietnameseName;
  }

  const normalized = canonicalName.trim().toLowerCase();
  const labels: Record<string, string> = {
    animalia: 'Động vật - Animalia',
    plantae: 'Thực vật - Plantae',
    fungi: 'Nấm - Fungi',
    chromista: 'Sinh vật nguyên sinh - Chromista',
    protista: 'Sinh vật nguyên sinh - Protista',
    bacteria: 'Vi khuẩn thật - Bacteria',
    archaea: 'Vi khuẩn cổ - Archaea',
  };

  return labels[normalized] ?? canonicalName;
}

export function hasSeparateScientificName(canonicalName: string, displayName: string): boolean {
  return displayName !== canonicalName && !displayName.endsWith(`- ${canonicalName}`);
}
