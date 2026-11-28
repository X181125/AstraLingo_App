import { Redirect } from "expo-router";
export default function Entry() {
  return <Redirect href="/settings?section=theme" />;
}
