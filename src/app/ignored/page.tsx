import { redirect } from 'next/navigation';
export default function LegacyIgnored() {
  redirect('/dedupe/ignored');
}
