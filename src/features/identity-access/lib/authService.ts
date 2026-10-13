import { getSupabaseClient } from '../../../lib/supabase/client';
import {
  serializeAvailabilityWindows,
  type AvailabilityWindow,
} from './availabilityService';

export interface SignUpInput {
  name: string;
  whatsapp: string;
  email: string;
  password: string;
  availability: readonly AvailabilityWindow[];
}

export interface SignInInput {
  email: string;
  password: string;
}

export type AuthSessionListener = (hasSession: boolean) => void;

export function normalizeBrazilianWhatsApp(value: string): string {
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    if (!digits.startsWith('55')) {
      throw new Error('Informe um WhatsApp brasileiro com DDD.');
    }
    digits = digits.slice(2);
  } else if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  if (!/^[1-9]\d{9,10}$/.test(digits)) {
    throw new Error('Informe um WhatsApp válido com DDD.');
  }

  return `+55${digits}`;
}

export async function signUp(input: SignUpInput) {
  const name = input.name.trim();
  const email = input.email.trim();

  if (!name || !email || !input.password) {
    throw new Error('Preencha nome, e-mail e senha.');
  }

  const availabilityWindows = serializeAvailabilityWindows(input.availability);
  const whatsappE164 = normalizeBrazilianWhatsApp(input.whatsapp);
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        name,
        whatsapp_e164: whatsappE164,
          availability_windows: availabilityWindows,
      },
    },
  });

  if (error) {
    throw new Error('Não foi possível criar sua conta. Confira os dados e tente novamente.');
  }

  return data;
}

export async function signIn(input: SignInInput) {
  const email = input.email.trim();

  if (!email || !input.password) {
    throw new Error('Informe seu e-mail e senha.');
  }

  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) {
    throw new Error('Não foi possível entrar. Confira seu e-mail e senha.');
  }

  return data;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });

  if (error) {
    throw new Error('Não foi possível sair. Tente novamente.');
  }
}

export function subscribeToAuthState(
  listener: AuthSessionListener,
): () => void {
  let client;

  try {
    client = getSupabaseClient();
  } catch (error) {
    if (error instanceof Error && error.message === 'Configuração do Supabase ausente.') {
      return () => {};
    }
    throw error;
  }

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    listener(Boolean(session));
  });

  return () => data.subscription.unsubscribe();
}
