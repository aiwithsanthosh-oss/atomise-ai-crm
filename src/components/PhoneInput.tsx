// src/components/PhoneInput.tsx
// Reusable phone input with country code selector
// Default: India (+91)

import { useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Country codes list ────────────────────────────────────────────────────────
export const COUNTRY_CODES = [
  { code: "+91",  country: "India",          iso: "IN" },
  { code: "+60",  country: "Malaysia",       iso: "MY" },
  { code: "+1",   country: "USA / Canada",   iso: "US" },
  { code: "+44",  country: "UK",             iso: "GB" },
  { code: "+61",  country: "Australia",      iso: "AU" },
  { code: "+65",  country: "Singapore",      iso: "SG" },
  { code: "+971", country: "UAE",            iso: "AE" },
  { code: "+966", country: "Saudi Arabia",   iso: "SA" },
  { code: "+974", country: "Qatar",          iso: "QA" },
  { code: "+973", country: "Bahrain",        iso: "BH" },
  { code: "+968", country: "Oman",           iso: "OM" },
  { code: "+962", country: "Jordan",         iso: "JO" },
  { code: "+20",  country: "Egypt",          iso: "EG" },
  { code: "+27",  country: "South Africa",   iso: "ZA" },
  { code: "+234", country: "Nigeria",        iso: "NG" },
  { code: "+254", country: "Kenya",          iso: "KE" },
  { code: "+49",  country: "Germany",        iso: "DE" },
  { code: "+33",  country: "France",         iso: "FR" },
  { code: "+39",  country: "Italy",          iso: "IT" },
  { code: "+34",  country: "Spain",          iso: "ES" },
  { code: "+31",  country: "Netherlands",    iso: "NL" },
  { code: "+7",   country: "Russia",         iso: "RU" },
  { code: "+86",  country: "China",          iso: "CN" },
  { code: "+81",  country: "Japan",          iso: "JP" },
  { code: "+82",  country: "South Korea",    iso: "KR" },
  { code: "+63",  country: "Philippines",    iso: "PH" },
  { code: "+62",  country: "Indonesia",      iso: "ID" },
  { code: "+66",  country: "Thailand",       iso: "TH" },
  { code: "+84",  country: "Vietnam",        iso: "VN" },
  { code: "+880", country: "Bangladesh",     iso: "BD" },
  { code: "+94",  country: "Sri Lanka",      iso: "LK" },
  { code: "+977", country: "Nepal",          iso: "NP" },
  { code: "+92",  country: "Pakistan",       iso: "PK" },
  { code: "+55",  country: "Brazil",         iso: "BR" },
  { code: "+52",  country: "Mexico",         iso: "MX" },
  { code: "+54",  country: "Argentina",      iso: "AR" },
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
        <div className="shrink-0 w-[100px] min-w-[90px]">
          <Select value={countryCode} onValueChange={onCountryCodeChange}>
            <SelectTrigger className={`${triggerBase} ${codeError ? "border-red-500" : ""}`}>
              <SelectValue>
                <span className="flex items-center gap-1 text-xs">
                  <span className="font-black text-primary/80 bg-primary/10 px-1 py-0.5 rounded text-[10px]">
                    {COUNTRY_CODES.find((c) => c.code === countryCode)?.iso}
                  </span>
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
                    <span className="font-black text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded text-[10px] shrink-0 w-8 text-center">{c.iso}</span>
                    <span className="font-bold text-primary shrink-0">{c.code}</span>
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
        <div className="flex-1 min-w-[120px]">
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