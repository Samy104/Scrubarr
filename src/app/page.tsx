import { redirect } from 'next/navigation';
export default function RootRedirect() {
  redirect('/dedupe/movies');
}
