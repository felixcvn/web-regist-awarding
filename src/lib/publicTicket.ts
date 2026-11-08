import type { PublicTicket } from './types';

// Runtime allowlist: a TypeScript type alone does not remove private fields.
export function toPublicTicket(participant: PublicTicket): PublicTicket {
  return {
    id: participant.id,
    nimNip: participant.nimNip,
    name: participant.name,
    role: participant.role,
    category: participant.category,
    batch: participant.batch,
    prodi: participant.prodi,
    qrToken: participant.qrToken,
    isCheckedIn: participant.isCheckedIn,
  };
}
