// ─── Password Validation Utility ─────────────────────────────────────────────
// Used in Auth.tsx and Settings.tsx

export type PasswordRule = {
    id: string;
    label: string;
    test: (password: string) => boolean;
  };
  
  export const PASSWORD_RULES: PasswordRule[] = [
    {
      id: "length",
      label: "At least 6 characters",
      test: (p) => p.length >= 6,
    },
    {
      id: "uppercase",
      label: "At least 1 uppercase letter (A-Z)",
      test: (p) => /[A-Z]/.test(p),
    },
    {
      id: "numeric",
      label: "At least 1 number (0-9)",
      test: (p) => /[0-9]/.test(p),
    },
    {
      id: "special",
      label: "At least 1 special character (!@#$...)",
      test: (p) => /[^A-Za-z0-9]/.test(p),
    },
  ];
  
  // Returns null if valid, or an error message string if invalid
  export function validatePassword(password: string): string | null {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(password)) {
        return `Password must have ${rule.label.toLowerCase()}.`;
      }
    }
    return null;
  }
  
  // Returns a score 0-4 based on how many rules pass
  export function passwordStrength(password: string): number {
    return PASSWORD_RULES.filter((r) => r.test(password)).length;
  }