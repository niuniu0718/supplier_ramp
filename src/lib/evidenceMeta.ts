import type { EvidenceVerificationStatus } from '../types'

export const VERIFICATION_META: Record<EvidenceVerificationStatus, {
  label: string
  tone: 'pending' | 'verified' | 'rejected'
  color: string
  bg: string
}> = {
  PENDING:  { label: '待认证', tone: 'pending',  color: '#ad6800', bg: '#fff5e6' },
  VERIFIED: { label: '已认证', tone: 'verified', color: '#1a7f37', bg: '#e6f4ea' },
  REJECTED: { label: '已退回', tone: 'rejected', color: '#b42318', bg: '#fee4e2' },
}

export function verificationMeta(status: EvidenceVerificationStatus) {
  return VERIFICATION_META[status] ?? VERIFICATION_META.VERIFIED
}
