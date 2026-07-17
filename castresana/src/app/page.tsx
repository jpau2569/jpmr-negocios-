import { redirect } from 'next/navigation';

/** La raíz entra directamente al Inbox, el centro de operación diario. */
export default function HomePage() {
  redirect('/inbox');
}
