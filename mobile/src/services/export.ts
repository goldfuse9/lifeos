import type { HcData } from './hcData';

/**
 * „Vzít si svoje data“ — export do JSON. Soubory příloh se nepřibalují
 * (byl by to obří soubor), jen jejich seznam; jdou otevřít a sdílet
 * jednotlivě. Formát má verzi, aby šel později i importovat.
 */
export async function buildExport(data: HcData, account: { name: string; email: string } | null): Promise<string> {
  const persons = await data.persons.list();
  const out = {
    format: 'humancare-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    account,
    persons: [] as unknown[],
  };
  for (const p of persons) {
    const records = await data.records.query({ personId: p.id, order: 'asc' });
    const files = await data.attachments.forRecords(records.map((r) => r.id));
    out.persons.push({
      ...p,
      personal: await data.personData.get(p.id, 'personal'),
      emergency: await data.personData.get(p.id, 'emergency'),
      doctors: (await data.personData.get(p.id, 'doctors')).list ?? [],
      cycle: await data.personData.get(p.id, 'cycle'),
      docs: await data.personData.get(p.id, 'docs'),
      meds: (await data.personData.get(p.id, 'meds')).list ?? [],
      records: records.map((r) => ({
        ...r,
        attachments: (files.get(r.id) ?? []).map((a) => ({ name: a.name, mimeType: a.mimeType, size: a.size, kind: a.kind, createdAt: a.createdAt })),
      })),
    });
  }
  return JSON.stringify(out, null, 2);
}
