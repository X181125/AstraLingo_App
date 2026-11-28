import { createContext, forwardRef, useContext } from "react";
import {
  StyleSheet, Text as NativeText, TextInput as NativeInput,
  type TextProps, type TextInputProps, type TextStyle, type StyleProp,
} from "react-native";

const regular = "Fredoka_400Regular";
const InheritedFamily = createContext(regular);

function familyFor(style: StyleProp<TextStyle>, inherited: string) {
  const { fontFamily, fontWeight } = StyleSheet.flatten(style) ?? {};
  if (fontFamily) return fontFamily;
  if (!fontWeight) return inherited;
  if (fontWeight === "bold" || Number(fontWeight) >= 700) return "Fredoka_700Bold";
  if (Number(fontWeight) >= 600) return "Fredoka_600SemiBold";
  if (Number(fontWeight) >= 500) return "Fredoka_500Medium";
  return regular;
}

export const Text = forwardRef<NativeText, TextProps>(function Text({ style, ...props }, ref) {
  const fontFamily = familyFor(style, useContext(InheritedFamily));
  return <InheritedFamily.Provider value={fontFamily}>
    <NativeText {...props} ref={ref} style={[style, { fontFamily, fontWeight: "normal" }]} />
  </InheritedFamily.Provider>;
});

export const TextInput = forwardRef<NativeInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const fontFamily = familyFor(style, regular);
  return <NativeInput {...props} ref={ref} style={[style, { fontFamily, fontWeight: "normal" }]} />;
});
