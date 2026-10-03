import TextRecognition from '@react-native-ml-kit/text-recognition';
import { linesByPosition } from '@/domain/scanParse';

/**
 * Rozpoznání textu z fotky přímo v telefonu (Google ML Kit, latinka
 * včetně české diakritiky). Model je součástí aplikace — fotka ani text
 * nikam neodcházejí.
 */
export async function recognizeText(uri: string): Promise<string> {
  const r = await TextRecognition.recognize(uri);
  const items = r.blocks.flatMap((b) =>
    b.lines.map((l) => ({ text: l.text, top: l.frame?.top ?? 0, left: l.frame?.left ?? 0, height: l.frame?.height ?? 12 })),
  );
  return items.length ? linesByPosition(items) : r.text;
}
