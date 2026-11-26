import { Link, type Href } from "expo-router";
import type { ComponentProps } from "react";

export function ExternalLink({href, style, ...props}: Omit<ComponentProps<typeof Link>, "href"> & {href: Href & string}) {
  return <Link {...props} href={href} target="_blank" rel="noopener noreferrer"
    style={[{fontFamily:"Fredoka_500Medium"},style]}/>;
}
