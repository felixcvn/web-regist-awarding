// Public registration window. The API stays closed unless REGISTRATION_OPEN=true
// is set at runtime; the landing page always renders the closed notice until
// <RegistrationForm /> is restored in app/page.tsx.
export function isRegistrationOpen(): boolean {
  return process.env.REGISTRATION_OPEN === 'true';
}

export const REGISTRATION_CLOSED_MESSAGE = 'Pendaftaran Fasilkom Awarding Night 2026 telah ditutup.';
