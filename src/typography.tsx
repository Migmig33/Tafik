import React from "react";
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  TextInputProps,
  TextProps,
} from "react-native";

const families = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

function familyFor(style: TextProps["style"] | TextInputProps["style"]): string {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const numeric = typeof weight === "number" ? weight : Number.parseInt(weight ?? "400", 10);
  if (weight === "bold" || numeric >= 700) return families.bold;
  if (numeric >= 600) return families.semibold;
  if (numeric >= 500) return families.medium;
  return families.regular;
}

export function Text({ style, ...props }: TextProps) {
  return (
    <NativeText
      {...props}
      style={[style, { fontFamily: familyFor(style), fontWeight: "normal" }]}
    />
  );
}

export function TextInput({ style, ...props }: TextInputProps) {
  return (
    <NativeTextInput
      {...props}
      style={[style, { fontFamily: familyFor(style), fontWeight: "normal" }]}
    />
  );
}
