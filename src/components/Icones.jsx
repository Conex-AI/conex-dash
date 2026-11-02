// Ícones do menu, os mesmos do protótipo.
const P = { width: 18, height: 18, viewBox: '0 0 18 18', 'aria-hidden': true }

export const ICONES = {
  dashboard: (
    <svg {...P}>
      <rect x="2" y="2" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="2" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2" y="10" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  conversas: (
    <svg {...P}>
      <path d="M3 4.5 C3 3.7 3.7 3 4.5 3 H13.5 C14.3 3 15 3.7 15 4.5 V11 C15 11.8 14.3 12.5 13.5 12.5 H8 L5 15 V12.5 H4.5 C3.7 12.5 3 11.8 3 11 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  metricas: (
    <svg {...P}>
      <path d="M3 15 V9 M7.5 15 V4 M12 15 V7 M16 15 V11" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  ),
  pix: (
    <svg {...P}>
      <rect x="2.5" y="4" width="13" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 8 H15.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  followup: (
    <svg {...P}>
      <path d="M3 9 A6 6 0 1 1 5 13.5 M3 14.5 V11 H6.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clientes: (
    <svg {...P}>
      <circle cx="9" cy="6.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 15.5 C3.5 12.5 6 11.5 9 11.5 C12 11.5 14.5 12.5 15 15.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
}
