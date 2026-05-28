import { redirect } from 'next/navigation';
export default function LegacyRules() {
  redirect('/dedupe/rules');
}
