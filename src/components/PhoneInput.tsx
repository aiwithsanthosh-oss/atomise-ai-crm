// src/components/PhoneInput.tsx
// Reusable phone input with country code selector
// Default: India (+91)

import { useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Country codes list ────────────────────────────────────────────────────────
export const COUNTRY_CODES = [
  { code: "+91",  country: "India",          flag: "🇮🇳" },
  { code: "+60",  country: "Malaysia",       flag: "🇲🇾" },
  { code: "+1",   country: "USA / Canada",   flag: "🇺🇸" },
  { code: "+44",  country: "UK",             flag: "🇬🇧" },
  { code: "+61",  country: "Australia",      flag: "🇦🇺" },
  { code: "+65",  country: "Singapore",      flag: "🇸🇬" },
  { code: "+971", country: "UAE",            flag: "🇦🇪" },
  { code: "+966", country: "Saudi Arabia",   flag: "🇸🇦" },
  { code: "+974", country: "Qatar",          flag: "🇶🇦" },
  { code: "+973", country: "Bahrain",        flag: "🇧🇭" },
  { code: "+968", country: "Oman",           flag: "🇴🇲" },
  { code: "+962", country: "Jordan",         flag: "🇯🇴" },
  { code: "+20",  country: "Egypt",          flag: "🇪🇬" },
  { code: "+27",  country: "South Africa",   flag: "🇿🇦" },
  { code: "+234", country: "Nigeria",        flag: "🇳🇬" },
  { code: "+254", country: "Kenya",          flag: "🇰🇪" },
  { code: "+49",  country: "Germany",        flag: "🇩🇪" },
  { code: "+33",  country: "France",         flag: "🇫🇷" },
  { code: "+39",  country: "Italy",          flag: "🇮🇹" },
  { code: "+34",  country: "Spain",          flag: "🇪🇸" },
  { code: "+31",  country: "Netherlands",    flag: "🇳🇱" },
  { code: "+7",   country: "Russia",         flag: "🇷🇺" },
  { code: "+86",  country: "China",          flag: "🇨🇳" },
  { code: "+81",  country: "Japan",          flag: "🇯🇵" },
  { code: "+82",  country: "South Korea",    flag: "🇰🇷" },
  { code: "+63",  country: "Philippines",    flag: "🇵🇭" },
  { code: "+62",  country: "Indonesia",      flag: "🇮🇩" },
  { code: "+66",  country: "Thailand",       flag: "🇹🇭" },
  { code: "+84",  country: "Vietnam",        flag: "🇻🇳" },
  { code: "+880", country: "Bangladesh",     flag: "🇧🇩" },
  { code: "+94",  country: "Sri Lanka",      flag: "🇱🇰" },
  { code: "+977", country: "Nepal",          flag: "🇳🇵" },
  { code: "+92",  country: "Pakistan",       flag: "🇵🇰" },
  { code: "+55",  country: "Brazil",         flag: "🇧🇷" },
  { code: "+52",  country: "Mexico",         flag: "🇲🇽" },
  { code: "+54",  country: "Argentina",      flag: "🇦🇷" },
];

// ─── Helper to split a stored full number ─────────────────────────────────────
export function splitPhone(fullNumber: string): { code: string; number: string } {
  if (!fullNumber) return { code: "+91", number: "" };
  const match = COUNTRY_CODES.find((c) => fullNumber.startsWith(c.code));
  if (match) {
    return { code: match.code, number: fullNumber.slice(match.code.length).trim() };
  }
  return { code: "+91", number: fullNumber };
}

// ─── Helper to join code + number ────────────────────────────────────────────
export function joinPhone(code: string, number: string): string {
  if (!number.trim()) return "";
  return `${code}${number.trim()}`;
}

// ─── PhoneInput Component ─────────────────────────────────────────────────────
interface PhoneInputProps {
  countryCode: string;
  phoneNumber: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneNumberChange: (number: string) => void;
  codeError?: string;
  numberError?: string;
  inputClassName?: string;
  // Style variant: "auth" for login page style, "form" for CRM forms
  variant?: "auth" | "form";
}

export function PhoneInput({
  countryCode,
  phoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
  codeError,
  numberError,
  inputClassName = "",
  variant = "form",
}: PhoneInputProps) {

  const isAuth = variant === "auth";

  const baseInput = isAuth
    ? "bg-background/50 h-11 rounded-xl border border-border text-foreground text-sm px-3 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all w-full"
    : "w-full h-11 card-elevated border border-border text-foreground text-sm font-medium rounded-xl px-3 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all";

  const triggerBase = isAuth
    ? "bg-background/50 h-11 rounded-xl border border-border text-foreground text-sm"
    : "h-11 card-elevated border border-border text-foreground text-sm font-medium rounded-xl";

  return (
    <div className="space-y-2">
      {/* Country Code + Number row */}
      <div className="flex gap-2">
        {/* Country Code Selector */}
        <div className="shrink-0 w-[130px]">
          <Select value={countryCode} onValueChange={onCountryCodeChange}>
            <SelectTrigger className={`${triggerBase} ${codeError ? "border-red-500" : ""}`}>
              <SelectValue>
                <span className="flex items-center gap-1.5 text-sm">
                  {COUNTRY_CODES.find((c) => c.code === countryCode)?.flag}
                  <span className="font-bold">{countryCode}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              className="bg-popover border-border max-h-60 overflow-y-auto"
              style={{ zIndex: 99999 }}
            >
              {COUNTRY_CODES.map((c) => (
                <SelectItem key={c.code + c.country} value={c.code} className="text-sm">
                  <span className="flex items-center gap-2">
                    <span>{c.flag}</span>
                    <span className="font-bold text-primary">{c.code}</span>
                    <span className="text-muted-foreground/70 text-xs">{c.country}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {codeError && (
            <p className="text-xs text-red-400 font-medium mt-1">{codeError}</p>
          )}
        </div>

        {/* Phone Number */}
        <div className="flex-1 min-w-0">
          <input
            type="tel"
            placeholder="98765 43210"
            value={phoneNumber}
            onChange={(e) => onPhoneNumberChange(e.target.value.replace(/[^0-9\s\-()]/g, ""))}
            className={`${baseInput} ${numberError ? "border-red-500" : ""} ${inputClassName}`}
          />
        </div>
      </div>

      {/* Number error below */}
      {numberError && (
        <p className="text-xs text-red-400 font-medium">{numberError}</p>
      )}
    </div>
  );
}