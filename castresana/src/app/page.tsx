import { redirect } from 'next/navigation';

/** El Inbox es el centro de trabajo diario: la raíz entra directamente ahí. */
export default function HomePage() {
  redirect('/inbox');
}
